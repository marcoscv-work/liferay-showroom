import {describe, expect, it} from 'vitest';

import {colorLabel, contrastRatio, extractColors, extractColorsFromCSS, extractColorsFromTokens, normalizeColor} from './colors';

describe('colours', () => {
	it('reads the spellings CSS has', () => {
		expect(normalizeColor('#0B5')).toBe('#00bb55');
		expect(normalizeColor('#0b5fff80')).toBe('#0b5fff80');
		expect(normalizeColor('rgb(11, 95, 255)')).toBe('#0b5fff');
		expect(normalizeColor('rgb(11 95 255 / 50%)')).toBe('#0b5fff80');
		expect(normalizeColor('hsl(0, 100%, 50%)')).toBe('#ff0000');
		expect(normalizeColor('hsl(210deg 50% 40%)')).toBe('#336699');
		expect(normalizeColor('White')).toBe('#ffffff');
		expect(normalizeColor('linear-gradient(red, blue)')).toBeNull();
		expect(normalizeColor('var(--x)')).toBeNull();
	});

	it('measures contrast as WCAG does', () => {
		expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
		expect(contrastRatio('#fff', '#fff')).toBe(1);
		expect(contrastRatio('#0b5fff', '#ffffff')!).toBeCloseTo(5.13, 2);
		expect(contrastRatio('nope', '#fff')).toBeNull();
	});

	it('finds the colours a stylesheet declares, then the ones it uses most', () => {
		const colors = extractColorsFromCSS(`
			/* --ignored: #123456; */
			:root { --brand: #7414FF; --brand-hover: var(--brand); --space: 1rem; --ink: rgb(39, 40, 51); --ghost: var(--missing, #fff); }
			a { color: #7414ff; } a:hover { color: #0b5fff; border-color: #0b5fff; } p { color: #0b5fff; } hr { color: #abcdef; }
		`);

		expect(colors).toEqual([
			{hex: '#7414ff', name: '--brand', uses: 2},
			{hex: '#7414ff', name: '--brand-hover', uses: 2},
			{hex: '#272833', name: '--ink', uses: 1},
			{hex: '#ffffff', name: '--ghost', uses: 1},
			{hex: '#0b5fff', name: null, uses: 3},
			{hex: '#abcdef', name: null, uses: 1},
		]);
	});

	it('reads design token files, references and Figma colours included', () => {
		const colors = extractColorsFromTokens({
			brand: {'500': {$type: 'color', $value: '#7414ff'}, hover: {value: '{brand.500}'}},
			figma: {surface: {resolvedValue: {a: 1, b: 1, g: 1, r: 1}}},
			spacing: {md: {$value: '16px'}},
		});

		expect(colors).toEqual([
			{hex: '#7414ff', name: 'brand-500', uses: 0},
			{hex: '#7414ff', name: 'brand-hover', uses: 0},
			{hex: '#ffffff', name: 'figma-surface', uses: 0},
		]);
	});

	it('tells a tokens file from a stylesheet', () => {
		expect(extractColors('{"ink": {"value": "#272833"}}')).toEqual([{hex: '#272833', name: 'ink', uses: 0}]);
		expect(extractColors('{ not json }\n a { color: red }')).toEqual([]);
		expect(extractColors('a { color: #ff0000 }')).toEqual([{hex: '#ff0000', name: null, uses: 1}]);
	});

	it('labels a colour after its name', () => {
		expect(colorLabel({hex: '#7414ff', name: '--color-brand-purple-600', uses: 0})).toBe('Brand purple 600');
		expect(colorLabel({hex: '#7414ff', name: 'brandPurple', uses: 0})).toBe('Brand purple');
		expect(colorLabel({hex: '#7414ff', name: null, uses: 3})).toBe('#7414ff');
	});
});
