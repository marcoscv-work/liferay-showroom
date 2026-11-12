import {describe, expect, it} from 'vitest';

import {colorScales, contrastPairs} from './palette';

import type {FrontendToken, StyleBook, Theme} from './types';

function theme(colors: Record<string, string>): Theme {
	const tokens: FrontendToken[] = Object.entries(colors).map(([name, defaultValue]) => ({cssVariable: name, defaultValue, editorType: 'ColorPicker', label: name, name}));

	return {
		categories: [{label: 'Colors', name: 'colors', sets: [{label: 'All', name: 'all', tokens}]}],
		css: [],
		description: '',
		imagesPath: '',
		key: 'classic',
		name: 'Classic',
		source: 'builtin',
		tokens: Object.fromEntries(tokens.map((token) => [token.name, token])),
	};
}

const styleBook: StyleBook = {key: 'sb', name: 'SB', source: 'imported', themeKey: 'classic', values: {gray200Color: '#dddddd'}};

describe('colorScales', () => {
	it('lines up the steps a stem has, numbers in order and shades light to dark', () => {
		const {loose, scales} = colorScales(
			theme({
				bodyColor: '#111',
				brandColor1: '#00f',
				brandColor2: '#0f0',
				gray100Color: '#eee',
				gray200Color: '#ccc',
				gray900Color: '#111',
				primaryColor: '#0b5fff',
				primaryD1Color: '#0053f0',
				primaryL0Color: '#5791ff',
				primaryL1Color: '#80acff',
			}),
			styleBook
		);

		expect(scales.map((scale) => [scale.name, scale.steps.map((step) => step.step).join(' ')])).toEqual([
			['Gray', '100 200 900'],
			['Primary', 'L1 L0  D1'],
		]);
		expect(scales[0].steps[1]).toMatchObject({changed: true, value: '#dddddd'});
		expect(loose.map((step) => step.token.name)).toEqual(['bodyColor', 'brandColor1', 'brandColor2']);
	});
});

describe('contrastPairs', () => {
	it('pairs a text colour with the background of its component, the rest with the page, worst first', () => {
		const pairs = contrastPairs(
			theme({
				bodyBgColor: '#ffffff',
				bodyColor: '#1c1c24',
				btnPrimaryBackgroundColor: '#0b5fff',
				btnPrimaryBorderColor: '#0b5fff',
				btnPrimaryColor: '#ffffff',
				btnOutlineColor: '#80acff',
				btnDisabledColor: '#cccccc',
				gray100Color: '#eeeeee',
				labelTonalBg: '#f0f5ff',
				labelTonalText: '#004ad7',
				textMuted: '#a7a9bc',
			}),
			null
		);

		expect(pairs.map((pair) => [pair.text.name, pair.background.name, Number(pair.ratio.toFixed(1))])).toEqual([
			['btnOutlineColor', 'the page background', 2.3],
			['textMuted', 'the page background', 2.3],
			['btnPrimaryColor', 'Btn primary background color', 5.1],
			['labelTonalText', 'Label tonal bg', 6.5],
			['bodyColor', 'Body bg color', 16.9],
		]);
	});

	it('follows a value that points at another token', () => {
		const pairs = contrastPairs(theme({bodyBgColor: '#ffffff', btnBackgroundColor: 'var(--primary)', btnColor: 'var(--white, #fff)', primary: '#0b5fff'}), null);

		expect(pairs.map((pair) => [pair.text.name, pair.textValue, pair.background.value, Number(pair.ratio.toFixed(1))])).toEqual([['btnColor', '#fff', '#0b5fff', 5.1]]);
	});

	it('leaves out what is not a colour it can measure', () => {
		expect(contrastPairs(theme({bodyBgColor: 'var(--body-bg)', bodyColor: 'var(--dark)', linkColor: 'transparent'}), null)).toEqual([]);
	});
});
