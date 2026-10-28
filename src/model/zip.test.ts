import JSZip from 'jszip';
import {describe, expect, it} from 'vitest';

import {createContainer, createElement, createRow, renderPage} from './pageDefinition';
import {exportCollectionZip, exportStyleBookZip, exportTemplateZip, importZip} from './zip';

import type {Collection, PageTemplate, StyleBook} from './types';

const collection: Collection = {
	description: 'Test collection',
	fragments: [
		{
			collectionKey: 'test',
			configuration: '{"fieldSets": []}',
			css: '.hello { color: red; }',
			html: '<p class="hello">Hello ${fragmentEntryLinkNamespace}</p>',
			icon: 'code',
			js: 'console.log(1);',
			key: 'hello',
			name: 'Hello',
			thumbnail: '',
			type: 'component',
		},
	],
	key: 'test',
	name: 'Test',
	resources: {'logo.png': 'data:image/png;base64,iVBORw0KGgo='},
	source: 'imported',
};

describe('zip round trips', () => {
	it('exports and imports a fragment collection', async () => {
		const blob = await exportCollectionZip(collection);
		const result = await importZip(await blob.arrayBuffer(), 'test.zip');

		expect(result.errors).toEqual([]);
		expect(result.collections).toHaveLength(1);
		expect(result.collections[0].name).toBe('Test');
		expect(result.collections[0].fragments[0]).toMatchObject({css: '.hello { color: red; }', html: '<p class="hello">Hello ${fragmentEntryLinkNamespace}</p>', key: 'hello', name: 'Hello'});
		expect(result.collections[0].resources['logo.png']).toBe('data:image/png;base64,iVBORw0KGgo=');
	});

	it('fetches the resources a bundled collection serves as files', async () => {
		const originalFetch = globalThis.fetch;
		const requested: string[] = [];

		globalThis.fetch = (async (input: any) => {
			requested.push(String(input));

			return new Response(new Uint8Array([137, 80, 78, 71]), {status: 200});
		}) as typeof fetch;

		try {
			const blob = await exportCollectionZip({...collection, resources: {'hero.png': 'https://example.test/collections/test/resources/hero.png', 'logo.png': 'data:image/png;base64,iVBORw0KGgo='}, source: 'builtin'});
			const zip = await JSZip.loadAsync(await blob.arrayBuffer());

			expect(requested).toEqual(['https://example.test/collections/test/resources/hero.png']);
			expect(Object.keys(zip.files).filter((name) => name.includes('/resources/') && !name.endsWith('/')).sort()).toEqual(['test/resources/hero.png', 'test/resources/logo.png']);
			expect(await zip.file('test/resources/hero.png')!.async('uint8array')).toEqual(new Uint8Array([137, 80, 78, 71]));
		}
		finally {
			globalThis.fetch = originalFetch;
		}
	});

	it('exports and imports a page template', async () => {
		const row = createRow(3);

		row.pageElements[1].pageElements.push(createElement('Fragment', {fragment: {collectionKey: 'test', key: 'hello'}, fragmentConfig: {}, fragmentStyle: {paddingTop: '4'}}));

		const container = createContainer();

		container.pageElements.push(row);

		const template: PageTemplate = {id: 'tpl', name: 'Landing', root: createElement('Root', {}, [container]), source: 'created'};

		const blob = await exportTemplateZip(template);
		const zip = await JSZip.loadAsync(await blob.arrayBuffer());

		expect(Object.keys(zip.files).some((path) => path.endsWith('page-templates/showroom/landing/page-definition.json'))).toBe(true);
		expect(Object.keys(zip.files).some((path) => path.endsWith('page-templates/showroom/landing/page-template.json'))).toBe(true);

		const result = await importZip(await blob.arrayBuffer(), 'landing.zip');

		expect(result.errors).toEqual([]);
		expect(result.templates).toHaveLength(1);
		expect(result.templates[0].name).toBe('Landing');

		const imported = result.templates[0].root;

		expect(imported.pageElements[0].type).toBe('Section');
		expect(imported.pageElements[0].pageElements[0].type).toBe('Row');
		expect(imported.pageElements[0].pageElements[0].pageElements).toHaveLength(3);

		const fragment = imported.pageElements[0].pageElements[0].pageElements[1].pageElements[0];

		expect(fragment.definition.fragment).toEqual({key: 'hello'});
		expect(fragment.definition.fragmentStyle).toEqual({paddingTop: '4'});

		const rendered = renderPage(imported, {collections: [collection], imagesPath: '', layoutMode: 'view', theme: null});

		expect(rendered.html).toContain('Hello ');
		expect(rendered.warnings).toEqual([]);
	});

	it('imports a Liferay site initializer page definition and reports missing fragments', async () => {
		const zip = new JSZip();

		zip.file(
			'site-initializer/layouts/03_support/page-definition.json',
			JSON.stringify({
				pageElement: {
					pageElements: [
						{
							definition: {indexed: true, layout: {widthType: 'Fixed'}},
							pageElements: [
								{definition: {fragment: {key: 'dialect-text', siteKey: 'Guest'}, fragmentConfig: {textType: 'h1'}, fragmentFields: [{id: 'element-text', value: {text: {value_i18n: {en_US: 'Support'}}}}]}, type: 'Fragment'},
								{definition: {widgetInstance: {widgetConfig: {}, widgetName: 'com_liferay_knowledge_base_web_portlet_DisplayPortlet'}}, type: 'Widget'},
							],
							type: 'Section',
						},
					],
					type: 'Root',
				},
				settings: {masterPage: {key: 'liferay-one'}},
				version: 1.1,
			})
		);
		zip.file('site-initializer/layouts/03_support/page.json', JSON.stringify({name_i18n: {en_US: 'Support'}}));

		const result = await importZip(await zip.generateAsync({type: 'arraybuffer'}), 'liferay-one.zip');

		expect(result.errors).toEqual([]);
		expect(result.templates).toHaveLength(1);

		const rendered = renderPage(result.templates[0].root, {collections: [collection], imagesPath: '', layoutMode: 'edit', theme: null});

		expect(rendered.html).toContain('showroom-placeholder');
		expect(rendered.html).toContain('com_liferay_knowledge_base_web_portlet_DisplayPortlet');
		expect(rendered.warnings).toEqual(['Fragment "dialect-text" is not in any loaded collection']);
	});

	it('exports and imports a style book', async () => {
		const styleBook: StyleBook = {key: 'sb', name: 'Dark brand', source: 'imported', themeKey: 'classic', values: {brandColor1: '#111111', spacer5: '4rem'}};

		const blob = await exportStyleBookZip(styleBook, null);
		const result = await importZip(await blob.arrayBuffer(), 'dark-brand.zip');

		expect(result.errors).toEqual([]);
		expect(result.styleBooks).toHaveLength(1);
		expect(result.styleBooks[0].name).toBe('Dark brand');
		expect(result.styleBooks[0].values).toEqual({brandColor1: '#111111', spacer5: '4rem'});
	});

	it('reports a zip without Liferay content', async () => {
		const zip = new JSZip();

		zip.file('readme.txt', 'nothing here');

		const result = await importZip(await zip.generateAsync({type: 'arraybuffer'}), 'empty.zip');

		expect(result.errors).toHaveLength(1);
	});
});
