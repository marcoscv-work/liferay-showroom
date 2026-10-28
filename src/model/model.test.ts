import {describe, expect, it} from 'vitest';

import {buildConfigurationModel, defaultRawValue, parseConfiguration} from './configuration';
import {createContainer, createElement, createRow, exportTree, renderPage, resolveStyleValue} from './pageDefinition';
import {buildTokenCSS, parseStyleBookValues, parseTokenDefinition} from './tokens';

import type {Collection, Theme} from './types';

const definition = {
	frontendTokenCategories: [
		{
			frontendTokenSets: [
				{
					frontendTokens: [
						{defaultValue: '#0b5fff', editorType: 'ColorPicker', label: 'brand-color-1', mappings: [{type: 'cssVariable', value: 'brand-color-1'}], name: 'brandColor1', type: 'String'},
						{defaultValue: 'brandColor1', editorType: 'ColorPicker', label: 'primary', mappings: [{type: 'cssVariable', value: 'primary'}], name: 'primaryColor', type: 'String'},
						{defaultValue: '3rem', editorType: 'Length', label: 'spacer-5', mappings: [{type: 'cssVariable', value: 'spacer-5'}], name: 'spacer5', type: 'String'},
					],
					label: 'brand-colors',
					name: 'brandColors',
				},
			],
			label: 'color-system',
			name: 'colorSystem',
		},
	],
};

function theme(): Theme {
	const {categories, tokens} = parseTokenDefinition(definition);

	return {categories, css: [], description: '', imagesPath: '/images', key: 'test', name: 'Test', source: 'builtin', tokens};
}

describe('tokens', () => {
	it('parses the token definition and emits every token with references resolved', () => {
		const css = buildTokenCSS(theme(), {brandColor1: '#ff0000'});

		expect(css).toContain('--brand-color-1: #ff0000;');
		expect(css).toContain('--primary: var(--brand-color-1);');
		expect(css).toContain('--spacer-5: 3rem;');
	});

	it('reads both style book value formats', () => {
		expect(parseStyleBookValues({frontendTokensValues: {spacer5: {cssVariableMapping: 'spacer-5', value: '1rem'}}}, null)).toEqual({spacer5: '1rem'});
		expect(parseStyleBookValues({}, {brandColor1: {value: '#fff'}})).toEqual({brandColor1: '#fff'});
	});
});

describe('configuration', () => {
	const json = JSON.stringify({
		fieldSets: [
			{
				fields: [
					{defaultValue: 'primary', name: 'color', type: 'colorPalette'},
					{dataType: 'int', defaultValue: 3, name: 'count', type: 'text'},
					{defaultValue: true, name: 'flag', type: 'checkbox'},
					{defaultValue: 'brandColor1', name: 'picked', type: 'colorPicker'},
					{name: 'size', type: 'select', typeOptions: {validValues: [{label: 'small', value: 'sm'}]}},
				],
				label: 'general',
			},
		],
	});

	it('resolves values like FragmentEntryConfigurationParser', () => {
		const {configuration} = parseConfiguration(json);
		const model = buildConfigurationModel(configuration, {}, theme());

		expect(model.color).toEqual({color: 'primary', cssClass: 'primary', rgbValue: 'var(--primary)'});
		expect(model.count).toBe(3);
		expect(model.flag).toBe(true);
		expect(model.picked).toBe('var(--brand-color-1)');
		expect(model.size).toBe('sm');
	});

	it('uses the first select option as default', () => {
		const {configuration} = parseConfiguration(json);

		expect(defaultRawValue(configuration.fieldSets[0].fields[4])).toBe('sm');
	});
});

describe('page definition', () => {
	const collection: Collection = {
		description: '',
		fragments: [
			{
				collectionKey: 'test',
				configuration: JSON.stringify({fieldSets: [{fields: [{defaultValue: 'h2', name: 'headingLevel', type: 'select', typeOptions: {validValues: [{label: 'h1', value: 'h1'}, {label: 'h2', value: 'h2'}]}}], label: ''}]}),
				css: '.component-heading { margin: 0; }',
				html: '<${configuration.headingLevel} class="component-heading" data-lfr-editable-id="element-text" data-lfr-editable-type="text">Heading Example</${configuration.headingLevel}>',
				icon: 'text',
				js: '',
				key: 'heading',
				name: 'Heading',
				thumbnail: '',
				type: 'component',
			},
		],
		key: 'test',
		name: 'Test',
		resources: {},
		source: 'builtin',
	};

	it('renders containers, rows, columns and fragments with Liferay markup', () => {
		const container = createContainer();
		const row = createRow(2);
		const fragment = createElement('Fragment', {fragment: {key: 'BASIC_COMPONENT-heading'}, fragmentConfig: {headingLevel: 'h1'}, fragmentStyle: {paddingTop: '5', backgroundColor: 'brandColor1'}});

		row.pageElements[0].pageElements.push(fragment);
		container.pageElements.push(row);

		const root = createElement('Root', {}, [container]);

		const result = renderPage(root, {collections: [collection], imagesPath: '', layoutMode: 'view', theme: theme()});

		expect(result.html).toContain('container-fluid container-fluid-max-xl');
		expect(result.html).toContain('class="row align-items-start"');
		expect(result.html).toContain('col col-lg-6 col-md-6 col-sm-12 col-12');
		expect(result.html).toContain('<h1 class="component-heading"');
		expect(result.css).toContain('padding-top: var(--spacer-5) !important;');
		expect(result.css).toContain('background-color: var(--brand-color-1) !important;');
		expect(result.css).toContain('.component-heading { margin: 0; }');
		expect(result.warnings).toEqual([]);
	});

	it('strips showroom-only data on export', () => {
		const fragment = createElement('Fragment', {fragment: {collectionKey: 'test', key: 'heading'}, fragmentConfig: {}});
		const exported = exportTree(createElement('Root', {}, [fragment]));

		expect(exported).toEqual({pageElements: [{definition: {fragment: {key: 'heading'}, fragmentConfig: {}}, type: 'Fragment'}], type: 'Root'});
	});

	it('maps style values to tokens, px and opacity', () => {
		expect(resolveStyleValue('marginTop', '3', null)).toBe('var(--spacer-3, 0.75rem)');
		expect(resolveStyleValue('borderWidth', '2', null)).toBe('2px');
		expect(resolveStyleValue('opacity', '20', null)).toBe('0.2');
		expect(resolveStyleValue('textColor', 'primary', null)).toBe('var(--primary)');
		expect(resolveStyleValue('width', '50%', null)).toBe('50%');
	});
});

describe('style book scheme', () => {
	it('is declared, or read from the body colour, or unknown', async () => {
		const {styleBookScheme} = await import('./tokens');

		expect(styleBookScheme({colorScheme: 'light', key: 'a', name: 'A', source: 'imported', themeKey: null, values: {mantineColorBody: '#000000'}}, null)).toBe('light');
		expect(styleBookScheme({key: 'b', name: 'B', source: 'imported', themeKey: null, values: {mantineColorBody: '#070b13'}}, null)).toBe('dark');
		expect(styleBookScheme({key: 'c', name: 'C', source: 'imported', themeKey: null, values: {bodyBgColor: 'rgb(250, 250, 252)'}}, null)).toBe('light');
		expect(styleBookScheme({key: 'd', name: 'D', source: 'imported', themeKey: null, values: {brandColor: '#0b5fff'}}, null)).toBeNull();
		expect(styleBookScheme(null, null)).toBeNull();
	});
});
