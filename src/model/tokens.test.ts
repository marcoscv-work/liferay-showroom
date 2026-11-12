import {describe, expect, it} from 'vitest';

import {buildTokenCSS, createCustomColor, parseCustomTokens, serializeCustomTokens, serializeStyleBook, withCustomTokens} from './tokens';

import type {StyleBook, Theme} from './types';

const theme: Theme = {
	categories: [{label: 'Colors', name: 'colors', sets: []}],
	css: [],
	description: '',
	imagesPath: '',
	key: 'classic',
	name: 'Classic',
	source: 'builtin',
	tokens: {primary: {cssVariable: 'primary', defaultValue: '#0b5fff', editorType: 'ColorPicker', label: 'Primary', name: 'primary'}},
};

describe('custom tokens', () => {
	it('names a colour the way a theme names its tokens', () => {
		expect(createCustomColor('Brand purple', '#7414ff')).toEqual({cssVariable: 'brand-purple', defaultValue: '#7414ff', editorType: 'ColorPicker', label: 'Brand purple', name: 'brandPurple'});
		expect(createCustomColor('Gris 100 (más claro)', '#f1f2f5').name).toBe('gris100MasClaro');
		expect(createCustomColor('500', '#333')).toMatchObject({cssVariable: 'color-500', name: 'color500'});
		expect(createCustomColor('', '#333').name).toBe('color');
	});

	it('keeps names unique among the ones taken', () => {
		expect(createCustomColor('Primary', '#000', ['primary'])).toMatchObject({cssVariable: 'primary-2', name: 'primary2'});
		expect(createCustomColor('Primary', '#000', ['primary', 'primary2']).name).toBe('primary3');
	});

	it('adds them to the theme as tokens of a category of their own', () => {
		const styleBook: StyleBook = {customTokens: [createCustomColor('Brand purple', '#7414ff'), {...createCustomColor('x', '#000'), name: 'primary'}], key: 'sb', name: 'SB', source: 'imported', themeKey: 'classic', values: {}};
		const merged = withCustomTokens(theme, styleBook)!;

		expect(Object.keys(merged.tokens)).toEqual(['primary', 'brandPurple']);
		expect(merged.tokens.primary.defaultValue).toBe('#0b5fff');
		expect(merged.categories[1]).toMatchObject({name: 'custom', sets: [{name: 'customColors'}]});
		expect(buildTokenCSS(merged, {})).toContain('--brand-purple: #7414ff;');
		expect(withCustomTokens(theme, {...styleBook, customTokens: []})).toBe(theme);
	});

	it('round-trips through the definition Liferay exports', () => {
		const tokens = [createCustomColor('Brand purple', '#7414ff')];
		const definition = serializeCustomTokens(tokens);

		expect(definition.frontendTokenCategories[0].frontendTokenSets[0].frontendTokens[0]).toEqual({defaultValue: '#7414ff', editorType: 'ColorPicker', label: 'Brand purple', mappings: [{type: 'cssVariable', value: 'brand-purple'}], name: 'brandPurple', type: 'String'});
		expect(parseCustomTokens(definition)).toEqual([{...tokens[0], validValues: undefined}]);
		expect(serializeCustomTokens([])).toBeNull();
	});

	it('points the style book at its definition only when it has one', () => {
		const styleBook: StyleBook = {key: 'sb', name: 'SB', source: 'imported', themeKey: 'classic', values: {brandPurple: '#000'}};

		expect(serializeStyleBook(styleBook, theme).styleBookJSON.frontendTokenDefinitionPath).toBeUndefined();

		const withTokens = serializeStyleBook({...styleBook, customTokens: [createCustomColor('Brand purple', '#7414ff')]}, theme);

		expect(withTokens.styleBookJSON.frontendTokenDefinitionPath).toBe('frontend-token-definition.json');
		expect(withTokens.tokenValuesJSON.brandPurple.cssVariableMapping).toBe('brand-purple');
	});
});
