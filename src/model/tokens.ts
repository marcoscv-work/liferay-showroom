import type {FrontendToken, FrontendTokenCategory, StyleBook, Theme} from './types';

/**
 * Parses a Liferay theme `frontend-token-definition.json`.
 */
export function parseTokenDefinition(json: any): {categories: FrontendTokenCategory[]; tokens: Record<string, FrontendToken>} {
	const categories: FrontendTokenCategory[] = [];
	const tokens: Record<string, FrontendToken> = {};

	for (const category of json?.frontendTokenCategories ?? []) {
		const sets = [];

		for (const set of category.frontendTokenSets ?? []) {
			const setTokens: FrontendToken[] = [];

			for (const token of set.frontendTokens ?? []) {
				const mapping = (token.mappings ?? []).find((m: any) => m.type === 'cssVariable');

				if (!mapping || !token.name) {
					continue;
				}

				const editorType = token.editorType === 'ColorPicker' ? 'ColorPicker' : token.editorType === 'Length' ? 'Length' : token.validValues ? 'Select' : 'Text';

				const parsed: FrontendToken = {
					cssVariable: mapping.value,
					defaultValue: token.defaultValue === undefined ? '' : String(token.defaultValue),
					editorType,
					label: token.label ?? token.name,
					name: token.name,
					validValues: token.validValues,
				};

				setTokens.push(parsed);
				tokens[token.name] = parsed;
			}

			sets.push({label: set.label ?? set.name ?? '', name: set.name ?? '', tokens: setTokens});
		}

		categories.push({label: category.label ?? category.name ?? '', name: category.name ?? '', sets});
	}

	return {categories, tokens};
}

/** Where a style book's own tokens sit among the theme's: a category and a set of their own, as Liferay's editor creates them. */
export const CUSTOM_CATEGORY = {label: 'Custom', name: 'custom'};

export const CUSTOM_SET = {label: 'Colors', name: 'customColors'};

/**
 * The theme as a style book extends it: the style book's own tokens after
 * the theme's, so everything that reads the theme (the CSS, the colour
 * pickers, the style book panel) sees them as tokens like any other.
 */
export function withCustomTokens(theme: Theme | null, styleBook: StyleBook | null): Theme | null {
	const custom = (styleBook?.customTokens ?? []).filter((token) => !theme?.tokens[token.name]);

	if (!theme || !custom.length) {
		return theme;
	}

	return {
		...theme,
		categories: [...theme.categories, {...CUSTOM_CATEGORY, sets: [{...CUSTOM_SET, tokens: custom}]}],
		tokens: {...theme.tokens, ...Object.fromEntries(custom.map((token) => [token.name, token]))},
	};
}

function words(label: string): string[] {
	return (
		label
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.match(/[A-Za-z]+|[0-9]+/g) ?? []
	).map((word) => word.toLowerCase());
}

/**
 * A colour a style book adds: named after its label the way a theme names
 * its tokens (`brandPurple`, exposed as `--brand-purple`), and unique among
 * the names taken.
 */
export function createCustomColor(label: string, value: string, taken: Iterable<string> = []): FrontendToken {
	const parts = words(label);
	const used = new Set(Array.from(taken, (name) => name.toLowerCase()));
	const base = parts.length ? parts : ['color'];

	/* A CSS custom property may start with a digit, a JavaScript-style token name reads better without */
	const prefixed = /^[0-9]/.test(base[0]) ? ['color', ...base] : base;

	let suffix = 1;
	let candidate = prefixed;

	while (used.has(candidate.join('').toLowerCase())) {
		suffix++;
		candidate = [...prefixed, String(suffix)];
	}

	return {
		cssVariable: candidate.join('-'),
		defaultValue: value,
		editorType: 'ColorPicker',
		label: label.trim() || 'Color',
		name: candidate.map((word, index) => (index ? word.charAt(0).toUpperCase() + word.slice(1) : word)).join(''),
	};
}

/** A style book's own tokens as the `frontend-token-definition.json` Liferay exports with it, or `null` when it has none. */
export function serializeCustomTokens(tokens: FrontendToken[] | undefined): any | null {
	if (!tokens?.length) {
		return null;
	}

	return {
		frontendTokenCategories: [
			{
				...CUSTOM_CATEGORY,
				frontendTokenSets: [
					{
						...CUSTOM_SET,
						frontendTokens: tokens.map((token) => ({
							defaultValue: token.defaultValue,
							editorType: token.editorType,
							label: token.label,
							mappings: [{type: 'cssVariable', value: token.cssVariable}],
							name: token.name,
							type: 'String',
						})),
					},
				],
			},
		],
	};
}

/** The tokens a style book's own definition declares, whatever category it files them under. */
export function parseCustomTokens(json: any): FrontendToken[] {
	return Object.values(parseTokenDefinition(json).tokens);
}

/**
 * Converts a style book's token values into the `:root {}` rule Liferay
 * injects in the page head.
 */
export function buildTokenCSS(theme: Theme | null, values: Record<string, string>): string {
	if (!theme) {
		return '';
	}

	const declarations: string[] = [];

	for (const token of Object.values(theme.tokens)) {
		const override = values[token.name];
		const value = override === undefined || override === null || override === '' ? token.defaultValue : override;

		if (value === undefined || value === null || value === '') {
			continue;
		}

		declarations.push(`--${token.cssVariable}: ${resolveTokenReference(value, theme)};`);
	}

	if (!declarations.length) {
		return '';
	}

	return `:root {\n\t${declarations.join('\n\t')}\n}`;
}

/**
 * A token value can reference another token by name (e.g. `brandColor1`).
 * Liferay resolves those references to `var(--brand-color-1)`.
 */
export function resolveTokenReference(value: string, theme: Theme | null): string {
	if (theme && theme.tokens[value]) {
		return `var(--${theme.tokens[value].cssVariable})`;
	}

	return value;
}

export function effectiveTokenValue(theme: Theme, styleBook: StyleBook | null, name: string, depth = 0): string {
	const value = styleBook && styleBook.values[name] !== undefined ? styleBook.values[name] : theme.tokens[name]?.defaultValue ?? '';

	if (depth < 10 && value !== name && theme.tokens[value]) {
		return effectiveTokenValue(theme, styleBook, value, depth + 1);
	}

	return value;
}

/**
 * Parses the two style book formats Liferay produces: the export zip
 * (`style-book.json` + `frontend-tokens-values.json`) and the site
 * initializer layout, whose `style-book.json` carries
 * `frontendTokensValues` inline.
 */
export function parseStyleBookValues(styleBookJSON: any, tokenValuesJSON: any): Record<string, string> {
	const source = tokenValuesJSON ?? styleBookJSON?.frontendTokensValues ?? {};

	const values: Record<string, string> = {};

	for (const [name, entry] of Object.entries<any>(source)) {
		if (entry && typeof entry === 'object' && 'value' in entry) {
			values[name] = String(entry.value);
		}
		else if (typeof entry === 'string' || typeof entry === 'number') {
			values[name] = String(entry);
		}
	}

	return values;
}

export function serializeStyleBook(styleBook: StyleBook, theme: Theme | null): {styleBookJSON: any; tokenValuesJSON: any} {
	const tokenValuesJSON: Record<string, any> = {};

	for (const [name, value] of Object.entries(styleBook.values)) {
		tokenValuesJSON[name] = {
			cssVariableMapping: theme?.tokens[name]?.cssVariable ?? styleBook.customTokens?.find((token) => token.name === name)?.cssVariable ?? name,
			value,
		};
	}

	return {
		styleBookJSON: {
			...(styleBook.colorScheme ? {colorScheme: styleBook.colorScheme} : {}),
			...(styleBook.customTokens?.length ? {frontendTokenDefinitionPath: 'frontend-token-definition.json'} : {}),
			frontendTokensValuesPath: 'frontend-tokens-values.json',
			name: styleBook.name,
			themeId: theme ? `${theme.key}_WAR_${theme.key}theme` : undefined,
		},
		tokenValuesJSON,
	};
}

/** Tokens whose value tells the scheme of a style book: the page or body background. */
export const BODY_TOKENS = ['mantineColorBody', 'bodyBgColor', 'bodyBg', 'bodyBackgroundColor', 'sdsSurfacesPage', 'sdsSurfacesBackground'];

export function colorLuminance(value: string): number | null {
	const hex = value.trim().match(/^#([0-9a-f]{3,8})$/i);
	let r: number, g: number, b: number;

	if (hex) {
		let digits = hex[1];

		if (digits.length === 3 || digits.length === 4) {
			digits = digits.split('').map((d) => d + d).join('');
		}

		r = parseInt(digits.slice(0, 2), 16);
		g = parseInt(digits.slice(2, 4), 16);
		b = parseInt(digits.slice(4, 6), 16);
	}
	else {
		const rgb = value.trim().match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);

		if (!rgb) {
			return null;
		}

		[r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
	}

	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * The scheme a style book is designed for: what it declares, else what the
 * body colour it sets says, else nothing (the editor's scheme applies).
 */
export function styleBookScheme(styleBook: StyleBook | null, theme: Theme | null): 'light' | 'dark' | null {
	if (!styleBook) {
		return null;
	}

	if (styleBook.colorScheme) {
		return styleBook.colorScheme;
	}

	for (const name of BODY_TOKENS) {
		if (styleBook.values[name] === undefined) {
			continue;
		}

		const value = theme ? effectiveTokenValue(theme, styleBook, name) : styleBook.values[name];
		const luminance = colorLuminance(value);

		if (luminance !== null) {
			return luminance < 0.5 ? 'dark' : 'light';
		}
	}

	return null;
}

/** The colour pages sit on with this theme and style book, to measure contrast against. White when no token says. */
export function pageBackground(theme: Theme | null, styleBook: StyleBook | null): string {
	if (theme) {
		for (const name of [...BODY_TOKENS.filter((candidate) => styleBook?.values[candidate] !== undefined), ...BODY_TOKENS]) {
			if (theme.tokens[name]) {
				const value = effectiveTokenValue(theme, styleBook, name);

				if (colorLuminance(value) !== null) {
					return value;
				}
			}
		}
	}

	return '#ffffff';
}
