import './lib/dom';

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

import {createElement, createFragmentElement, exportTree, fieldsFromEditableValues, normalizeTree, renderPage} from '../src/model/pageDefinition';
import {buildPreviewDocument} from '../src/preview/document';
import {readCheckout} from './lib/assets';

import type {EditableValue} from '../src/model/fragmentRenderer';
import type {Collection, PageElement, Theme} from '../src/model/types';

/**
 * The product landing (`public/landing/index.html`) is a page template made
 * of the Liferay Sites DS fragments, rendered to static HTML on the LSDS Dark
 * style book: the landing is itself a page of the assets it presents, and
 * it shows up in the sidebar as "Product landing", editable and exportable.
 *
 *   npx vite-node scripts/landing.ts            renders templates/landing/page-definition.json
 *   npx vite-node scripts/landing.ts --compose  rewrites the definition from the composition below first
 */

const root = resolve(new URL('..', import.meta.url).pathname);
const templateDir = join(root, 'templates', 'landing');
const outDir = join(root, 'public', 'landing');

const checkout = readCheckout(root);

const ds = checkout.collections.find(({collection}) => collection.key === 'liferay-sites-ds')?.collection;

if (!ds) {
	throw new Error('The liferay-sites-ds collection is missing; run scripts/build-lsds.mjs first');
}

const SHOWROOM = '../';

/* The product shot is addressed on the published site, so the template also shows it inside the app and after a Liferay import */
const SITE = String(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).homepage ?? '').replace(/\/?$/, '/');

type Values = Record<string, EditableValue>;

function block(key: string, values: Values): PageElement {
	const fragment = ds!.fragments.find((candidate) => candidate.key === key);

	if (!fragment) {
		throw new Error(`No fragment ${key} in ${ds!.name}`);
	}

	const element = createFragmentElement(fragment);
	const types: Record<string, string> = {};

	for (const match of fragment.html.matchAll(/data-lfr-editable-id="([^"]+)"[^>]*data-lfr-editable-type="([^"]+)"/g)) {
		types[match[1]] = match[2];
	}

	element.definition.fragmentFields = fieldsFromEditableValues(values, types);

	return element;
}

function compose(): PageElement {
	const section = createElement('Section', {indexed: true, layout: {widthType: 'Fluid'}, name: 'Product landing'}, [
		block('lsds-hero', {
			'image-1': {alt: 'The Showroom showing the LSDS Button fragment with its documentation', src: `${SITE}images/product-shot.png`},
			'link-1': {href: SHOWROOM, text: 'Open the Showroom'},
			'link-2': {href: `${SHOWROOM}?path=/releases`, text: 'See the releases'},
			'text-1': {text: 'Liferay Showroom'},
			'text-2': {text: 'Fragment sets, page templates and style books, rendered without a Liferay: documented, versioned and readable by agents. Everything you see is exactly what gets imported.'},
			'title-1': {text: 'Your Liferay design system, published'},
		}),
		block('lsds-section-card-grid', {
			'link-1': {href: `${SHOWROOM}?path=/docs/getting-started`, text: 'Read the docs'},
			'text-1': {text: '<p>The site is built from Liferay’s own export formats, so there is no second truth: what a designer reviews here is what a developer imports there.</p>'},
			'text-2': {text: 'Fragments, templates, style books'},
			'text-3': {text: 'Every asset renders live with its configuration as controls and its editables as fields, on the theme and style book you pick in the toolbar.'},
			'text-4': {text: 'Versioned releases'},
			'text-5': {text: 'A release is a tag and a manifest of every asset’s hash. The changelog is computed, so it is exact about which fragments changed, file by file.'},
			'text-6': {text: 'Readable by agents'},
			'text-7': {text: 'catalog.json and llms.txt describe every fragment, field and token. An agent composes a page; drop the JSON on the site and it becomes a template.'},
			'title-1': {text: 'Exactly what you import'},
		}),
		block('lsds-section-highlight-text', {
			'link-1': {href: SHOWROOM, text: 'Try it now'},
			'text-1': {text: 'Drop a Liferay export anywhere on the page.'},
			'text-2': {text: 'A fragment set, a page template, a style book, a built theme or a bare page-definition.json: it renders at once, stays in your browser, and exports back as the zip Liferay imports.'},
		}),
		block('lsds-section-faq', {
			'text-1': {text: '<p>What teams ask before they publish.</p>'},
			'text-2': {text: 'Does it need a running Liferay?'},
			'text-3': {text: '<p>No. It runs on GitHub Pages or any static host. A FreeMarker interpreter and Liferay’s own page structure render fragments and templates in the browser; Liferay is only where the zips go.</p>'},
			'text-4': {text: 'How does a team version its assets?'},
			'text-5': {text: '<p>With git. The folders are the Liferay export layout, a release is a tag, and the Releases page compares the manifests of two versions asset by asset, with a link to the history of each one.</p>'},
			'text-6': {text: 'Is this a Design Library?'},
			'text-7': {text: '<p>It is its published face. The Design Library edits and owns the assets inside the portal; this site shows a version of them to anyone without a portal, and imports the same zips a Design Library exports.</p>'},
			'title-1': {text: 'Questions'},
		}),
		block('lsds-banner', {
			'link-1': {href: SHOWROOM, text: 'Open the Showroom'},
			'text-1': {text: 'Publish your design system'},
			'text-2': {text: '<p>Start from your own export, or from the Liferay Sites design system that ships with the site.</p>'},
		}),
		block('lsds-footer', {
			'link-1': {href: SHOWROOM, text: 'Showroom'},
			'link-10': {href: 'https://learn.liferay.com/w/dxp/site-building/creating-pages/page-fragments-and-widgets/developer-guide/developing-page-fragments', text: 'Developing fragments'},
			'link-11': {href: 'https://learn.liferay.com/w/dxp/site-building/site-appearance/style-books', text: 'Style books'},
			'link-12': {href: 'https://www.liferay.com/', text: 'Liferay'},
			'link-2': {href: `${SHOWROOM}?path=/docs/getting-started`, text: 'Getting started'},
			'link-3': {href: `${SHOWROOM}?path=/docs/tokens-and-style-books`, text: 'Tokens and style books'},
			'link-4': {href: `${SHOWROOM}?path=/docs/page-composition`, text: 'Page composition'},
			'link-5': {href: `${SHOWROOM}?path=/releases`, text: 'Releases'},
			'link-6': {href: 'https://github.com/marcoscv-work/liferay-showroom', text: 'GitHub'},
			'link-7': {href: `${SHOWROOM}llms.txt`, text: 'llms.txt'},
			'link-8': {href: `${SHOWROOM}catalog.json`, text: 'catalog.json'},
			'link-9': {href: 'https://makenaford.github.io/liferay-sites-design-system/', text: 'Liferay Sites design system'},
			'title-1': {text: 'Product'},
			'title-2': {text: 'Resources'},
		}),
	]);

	return createElement('Root', {}, [section]);
}

const definitionPath = join(templateDir, 'page-definition.json');

if (process.argv.includes('--compose') || !existsSync(definitionPath)) {
	mkdirSync(templateDir, {recursive: true});
	writeFileSync(join(templateDir, 'page-template.json'), JSON.stringify({name: 'Product landing', type: 'content-page'}, null, '\t') + '\n');
	writeFileSync(definitionPath, JSON.stringify({pageElement: exportTree(compose()), settings: {}, version: 1.1}, null, '\t') + '\n');

	console.log(`Composed ${definitionPath}`);
}

const tree = normalizeTree(JSON.parse(readFileSync(definitionPath, 'utf8')).pageElement);

/* Resources and theme assets are reached from /landing/ by relative URL, never inlined */

const collections: Collection[] = checkout.collections.map(({collection}) => ({
	...collection,
	resources: Object.fromEntries(Object.keys(collection.resources).map((name) => [name, `../collections/${collection.key}/resources/${name}`])),
}));

const lsdsTheme = checkout.themes.find((candidate) => candidate.key === 'classic-lsds');

if (!lsdsTheme) {
	throw new Error('The classic-lsds theme is missing');
}

const theme: Theme = {
	...lsdsTheme,
	css: ['../themes/classic/css/clay.css', '../themes/classic/css/main.css', '../themes/classic-lsds/css/fonts.css'],
	imagesPath: '../themes/classic/images',
};

const styleBook = checkout.styleBooks.find(({styleBook: candidate}) => candidate.key === 'builtin-lsds-dark')?.styleBook;

const page = renderPage(tree, {collections, imagesPath: theme.imagesPath, layoutMode: 'view', theme});

/* On the static page, the site's own files are reached by relative URL, so the landing also works locally and offline */
page.html = page.html.split(SITE).join('../');

for (const warning of page.warnings) {
	console.warn(`landing: ${warning}`);
}

const html = buildPreviewDocument({
	colorScheme: 'dark',
	css: page.css,
	description: 'Fragment sets, page templates and style books of a Liferay design system, rendered without a Liferay: documented, versioned and readable by agents.',
	fragmentCSS: '',
	html: page.html,
	js: page.js,
	mode: 'template',
	standalone: true,
	theme,
	title: 'Liferay Showroom: your Liferay design system, published',
	tokenValues: styleBook?.values ?? {},
});

mkdirSync(outDir, {recursive: true});
writeFileSync(join(outDir, 'index.html'), html);

console.log(`Landing: ${outDir}/index.html (${Math.round(html.length / 1024)} kB, ${page.warnings.length} warning(s))`);
