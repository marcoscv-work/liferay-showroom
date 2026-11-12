import {contrastRatio, parseColor} from './colors';
import {effectiveTokenValue, pageBackground} from './tokens';

import type {FrontendToken, StyleBook, Theme} from './types';

/**
 * A theme's colour tokens seen as a palette: the scales its names describe
 * (`gray100Color` to `gray900Color`, `primaryL3Color` to `primaryD2Color`)
 * and the pairs of text and background that have to contrast. Both are read
 * off the token names, which is all a token definition says about a role.
 */

/**
 * A colour token's value as a colour: a value that points at another token,
 * by name or as `var(--its-css-variable)`, takes that token's.
 */
export function resolvedColor(theme: Theme, styleBook: StyleBook | null, name: string, depth = 0): string {
	const value = effectiveTokenValue(theme, styleBook, name);
	const reference = value.trim().match(/^var\(\s*--([\w-]+)\s*(?:,\s*(.+))?\)$/);

	if (!reference || depth > 8) {
		return value;
	}

	const target = Object.values(theme.tokens).find((token) => token.cssVariable === reference[1] && token.name !== name);

	return target ? resolvedColor(theme, styleBook, target.name, depth + 1) : reference[2]?.trim() ?? value;
}

export interface ScaleStep {
	changed: boolean;

	/** What tells it apart in its scale: `100`, `L2`, `D1`, or nothing for the colour the scale is named after. */
	step: string;
	token: FrontendToken;
	value: string;
}

export interface ColorScale {
	name: string;
	steps: ScaleStep[];
}

/** A token's name as words: "btnPrimaryHoverColor" reads "Btn primary hover color". A theme's labels are often too short to stand alone ("Color"). */
export function tokenTitle(token: FrontendToken): string {
	return words(token.name);
}

function words(text: string): string {
	const spaced = text
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Za-z])([0-9])/g, '$1 $2')
		.toLowerCase()
		.trim();

	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A token name as a scale and a place in it: light to dark for `L`/`D` steps, in number order otherwise. */
function scalePlace(name: string): {order: number; stem: string; step: string} {
	const bare = name.replace(/Color$/, '');
	const shade = bare.match(/^(.*?)(L|D|Lighten|Darken)(\d+)$/);

	if (shade && shade[1]) {
		const amount = Number(shade[3]);
		const light = shade[2].startsWith('L');

		return {order: light ? -(amount + 1) : amount, stem: shade[1], step: `${light ? 'L' : 'D'}${shade[3]}`};
	}

	const numbered = bare.match(/^(.*?)(\d+)$/);

	if (numbered && numbered[1]) {
		return {order: Number(numbered[2]), stem: numbered[1].replace(/Color$/, ''), step: numbered[2]};
	}

	return {order: 0, stem: bare, step: ''};
}

/** The scales among a theme's colour tokens (three steps or more with one stem), and the colours that belong to none. */
export function colorScales(theme: Theme, styleBook: StyleBook | null): {loose: ScaleStep[]; scales: ColorScale[]} {
	const groups = new Map<string, {order: number; step: ScaleStep}[]>();

	for (const category of theme.categories) {
		for (const set of category.sets) {
			for (const token of set.tokens) {
				if (token.editorType !== 'ColorPicker') {
					continue;
				}

				const place = scalePlace(token.name);
				const key = `${category.name}/${set.name}/${place.stem}`;

				groups.set(key, [...(groups.get(key) ?? []), {order: place.order, step: {changed: styleBook?.values[token.name] !== undefined, step: place.step, token, value: resolvedColor(theme, styleBook, token.name)}}]);
			}
		}
	}

	const scales: ColorScale[] = [];
	const loose: ScaleStep[] = [];

	for (const [key, members] of groups) {
		if (members.length >= 3) {
			scales.push({name: words(key.slice(key.lastIndexOf('/') + 1)), steps: members.sort((a, b) => a.order - b.order).map((member) => member.step)});
		}
		else {
			loose.push(...members.map((member) => member.step));
		}
	}

	return {loose, scales};
}

export interface ContrastPair {
	background: {name: string; value: string};
	ratio: number;
	text: FrontendToken;
	textValue: string;
}

const BACKGROUND = /(BackgroundColor|BgColor|Background|Bg)$/;

/** Names that say a colour is text, when it has no background of its own to sit on. */
const TEXT = /(Text|Link|Muted|Anchor)|^(body|h[1-6]|heading\w*|blockquote\w*|btn\w*)Color$/;

/** Not text, or text WCAG does not measure: borders, shadows and disabled states. */
const NOT_TEXT = /(Border|Shadow|Background|Bg|Disabled|Line|Stroke|Fill|From|To)(?![a-z])/;

/**
 * The pairs of text and background a theme's token names describe, with
 * their contrast under a style book, worst first: a `…Color` or `…Text`
 * with the `…BackgroundColor` or `…Bg` of the same component, and every
 * other text colour against the page background.
 */
export function contrastPairs(theme: Theme, styleBook: StyleBook | null): ContrastPair[] {
	const colors = Object.values(theme.tokens).filter((token) => token.editorType === 'ColorPicker');
	const value = (token: FrontendToken) => resolvedColor(theme, styleBook, token.name);
	const page = pageBackground(theme, styleBook);
	const pairs: ContrastPair[] = [];
	const paired = new Set<string>();

	const add = (text: FrontendToken, background: {name: string; value: string}) => {
		const ratio = contrastRatio(value(text), background.value);

		if (ratio !== null && parseColor(value(text))?.a !== 0) {
			pairs.push({background, ratio, text, textValue: value(text)});
		}

		paired.add(text.name);
	};

	for (const background of colors) {
		const stem = background.name.replace(BACKGROUND, '');

		if (stem === background.name) {
			continue;
		}

		const text = colors.find((candidate) => candidate.name === `${stem}Color` || candidate.name === `${stem}Text`);

		if (text) {
			add(text, {name: tokenTitle(background), value: value(background)});
		}
	}

	for (const text of colors) {
		if (!paired.has(text.name) && TEXT.test(text.name) && !NOT_TEXT.test(text.name)) {
			add(text, {name: 'the page background', value: page});
		}
	}

	return pairs.sort((a, b) => a.ratio - b.ratio);
}
