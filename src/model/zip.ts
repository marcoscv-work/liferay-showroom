import JSZip from 'jszip';

import {parseStyleBookValues, parseTokenDefinition, serializeStyleBook} from './tokens';
import {exportTree, normalizeTree} from './pageDefinition';

import type {Collection, Fragment, PageTemplate, StyleBook, Theme} from './types';

/**
 * Import and export of the zip formats Liferay produces and consumes:
 *
 * - Fragment collections (`collection.json` + `fragments/<key>/...`).
 * - Page templates (`page-templates/<set>/<template>/page-definition.json`).
 * - Style books (`style-book.json` + `frontend-tokens-values.json`).
 * - Themes (a built theme war: `css/clay.css`, `css/main.css`,
 *   `WEB-INF/frontend-token-definition.json`, `images/clay/icons.svg`).
 */

const IMAGE_MIME: Record<string, string> = {
	gif: 'image/gif',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	png: 'image/png',
	svg: 'image/svg+xml',
	webp: 'image/webp',
};

export interface ImportResult {
	collections: Collection[];
	errors: string[];
	styleBooks: StyleBook[];
	templates: PageTemplate[];
	themes: Theme[];
}

function slug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

async function dataURL(file: JSZip.JSZipObject, name: string): Promise<string> {
	const extension = name.split('.').pop()?.toLowerCase() ?? '';
	const type = IMAGE_MIME[extension] ?? 'application/octet-stream';
	const base64 = await file.async('base64');

	return `data:${type};base64,${base64}`;
}

export async function importZip(data: ArrayBuffer | Blob, fileName: string): Promise<ImportResult> {
	const result: ImportResult = {collections: [], errors: [], styleBooks: [], templates: [], themes: []};

	let zip: JSZip;

	try {
		zip = await JSZip.loadAsync(data);
	}
	catch (error) {
		result.errors.push(`${fileName}: ${(error as Error).message}`);

		return result;
	}

	const files = Object.keys(zip.files).filter((path) => !zip.files[path].dir);

	await importCollections(zip, files, fileName, result);
	await importTemplates(zip, files, result);
	await importStyleBooks(zip, files, fileName, result);
	await importThemes(zip, files, fileName, result);

	if (!result.collections.length && !result.templates.length && !result.styleBooks.length && !result.themes.length && !result.errors.length) {
		result.errors.push(`${fileName}: no fragment collection, page template, style book or theme found in the zip`);
	}

	return result;
}

async function importCollections(zip: JSZip, files: string[], fileName: string, result: ImportResult): Promise<void> {
	const fragmentJSONs = files.filter((path) => path.endsWith('fragment.json') && !path.includes('__MACOSX'));

	if (!fragmentJSONs.length) {
		return;
	}

	const collectionJSONs = files.filter((path) => path.endsWith('collection.json') && !path.includes('__MACOSX'));

	const groups = new Map<string, {name: string; description: string; prefix: string; fragments: string[]}>();

	for (const fragmentPath of fragmentJSONs) {
		const fragmentDir = fragmentPath.slice(0, fragmentPath.lastIndexOf('/') + 1);

		let collectionPath = collectionJSONs
			.filter((path) => fragmentDir.startsWith(path.slice(0, path.lastIndexOf('/') + 1)))
			.sort((a, b) => b.length - a.length)[0];

		let prefix = collectionPath ? collectionPath.slice(0, collectionPath.lastIndexOf('/') + 1) : '';

		if (!groups.has(prefix)) {
			let name = fileName.replace(/\.zip$/i, '');
			let description = '';

			if (collectionPath) {
				try {
					const json = JSON.parse(await zip.files[collectionPath].async('string'));

					name = json.name ?? name;
					description = json.description ?? '';
				}
				catch (error) {
					result.errors.push(`${collectionPath}: ${(error as Error).message}`);
				}
			}

			groups.set(prefix, {description, fragments: [], name, prefix});
		}

		groups.get(prefix)!.fragments.push(fragmentPath);
	}

	for (const group of groups.values()) {
		const key = `${slug(group.name)}-${Math.random().toString(36).slice(2, 7)}`;

		const collection: Collection = {
			description: group.description,
			fragments: [],
			key,
			name: group.name,
			resources: {},
			source: 'imported',
		};

		for (const fragmentPath of group.fragments) {
			const dir = fragmentPath.slice(0, fragmentPath.lastIndexOf('/') + 1);
			const dirName = dir.split('/').filter(Boolean).pop() ?? 'fragment';

			let fragmentJSON: any = {};

			try {
				fragmentJSON = JSON.parse(await zip.files[fragmentPath].async('string'));
			}
			catch (error) {
				result.errors.push(`${fragmentPath}: ${(error as Error).message}`);
			}

			const read = async (relative: string | undefined, fallback: string) => {
				const file = zip.files[`${dir}${relative ?? fallback}`];

				return file ? file.async('string') : '';
			};

			const thumbnailName = fragmentJSON.thumbnailPath ?? 'thumbnail.png';
			const thumbnailFile = zip.files[`${dir}${thumbnailName}`];

			const fragment: Fragment = {
				collectionKey: key,
				configuration: await read(fragmentJSON.configurationPath, 'configuration.json'),
				css: await read(fragmentJSON.cssPath, 'index.css'),
				html: await read(fragmentJSON.htmlPath, 'index.html'),
				icon: fragmentJSON.icon ?? 'code',
				js: await read(fragmentJSON.jsPath, 'index.js'),
				key: fragmentJSON.fragmentEntryKey ?? dirName,
				name: fragmentJSON.name ?? dirName,
				thumbnail: thumbnailFile ? await dataURL(thumbnailFile, thumbnailName) : '',
				type: fragmentJSON.type ?? 'component',
			};

			collection.fragments.push(fragment);
		}

		const resourcesPrefix = `${group.prefix}resources/`;

		for (const path of files.filter((candidate) => candidate.startsWith(resourcesPrefix))) {
			const name = path.slice(resourcesPrefix.length);

			collection.resources[name] = await dataURL(zip.files[path], name);
		}

		collection.fragments.sort((a, b) => a.name.localeCompare(b.name));

		result.collections.push(collection);
	}
}

async function importTemplates(zip: JSZip, files: string[], result: ImportResult): Promise<void> {
	for (const path of files.filter((candidate) => candidate.endsWith('page-definition.json') && !candidate.includes('__MACOSX'))) {
		const dir = path.slice(0, path.lastIndexOf('/') + 1);

		let name = dir.split('/').filter(Boolean).pop() ?? 'Page template';

		const templateJSON = zip.files[`${dir}page-template.json`] ?? zip.files[`${dir}display-page-template.json`] ?? zip.files[`${dir}master-page.json`];

		if (templateJSON) {
			try {
				const json = JSON.parse(await templateJSON.async('string'));

				name = json.name ?? name;
			}
			catch (error) {
				result.errors.push(`${path}: ${(error as Error).message}`);
			}
		}

		try {
			const json = JSON.parse(await zip.files[path].async('string'));

			if (!json.pageElement) {
				result.errors.push(`${path}: missing "pageElement"`);
				continue;
			}

			result.templates.push({
				id: `template-${slug(name)}-${Math.random().toString(36).slice(2, 7)}`,
				name,
				root: normalizeTree(json.pageElement),
				source: 'imported',
			});
		}
		catch (error) {
			result.errors.push(`${path}: ${(error as Error).message}`);
		}
	}
}

async function importStyleBooks(zip: JSZip, files: string[], fileName: string, result: ImportResult): Promise<void> {
	for (const path of files.filter((candidate) => candidate.endsWith('style-book.json') && !candidate.includes('__MACOSX'))) {
		const dir = path.slice(0, path.lastIndexOf('/') + 1);

		try {
			const styleBookJSON = JSON.parse(await zip.files[path].async('string'));

			const valuesFile = zip.files[`${dir}${styleBookJSON.frontendTokensValuesPath ?? 'frontend-tokens-values.json'}`];
			const tokenValuesJSON = valuesFile ? JSON.parse(await valuesFile.async('string')) : null;

			const name = styleBookJSON.name ?? dir.split('/').filter(Boolean).pop() ?? fileName;

			result.styleBooks.push({
				key: `style-book-${slug(name)}-${Math.random().toString(36).slice(2, 7)}`,
				name,
				source: 'imported',
				themeKey: typeof styleBookJSON.themeId === 'string' ? styleBookJSON.themeId.split('_WAR_')[0] : null,
				values: parseStyleBookValues(styleBookJSON, tokenValuesJSON),
			});
		}
		catch (error) {
			result.errors.push(`${path}: ${(error as Error).message}`);
		}
	}
}

async function importThemes(zip: JSZip, files: string[], fileName: string, result: ImportResult): Promise<void> {
	const definitionPath = files.find((path) => path.endsWith('frontend-token-definition.json') && !path.includes('__MACOSX'));
	const clayPath = files.find((path) => /(^|\/)css\/clay(\.[^/]*)?\.css$/.test(path));
	const mainPath = files.find((path) => /(^|\/)css\/main(\.[^/]*)?\.css$/.test(path));

	if (!clayPath && !mainPath) {
		return;
	}

	const base = (clayPath ?? mainPath)!.replace(/css\/[^/]*$/, '');

	let categories: Theme['categories'] = [];
	let tokens: Theme['tokens'] = {};

	if (definitionPath) {
		try {
			const parsed = parseTokenDefinition(JSON.parse(await zip.files[definitionPath].async('string')));

			categories = parsed.categories;
			tokens = parsed.tokens;
		}
		catch (error) {
			result.errors.push(`${definitionPath}: ${(error as Error).message}`);
		}
	}

	const css: string[] = [];

	for (const path of [clayPath, mainPath]) {
		if (!path) {
			continue;
		}

		let text = await zip.files[path].async('string');

		text = await inlineRelativeURLs(text, zip, base, files);

		css.push(URL.createObjectURL(new Blob([text], {type: 'text/css'})));
	}

	const iconsPath = files.find((path) => path.startsWith(base) && path.endsWith('images/clay/icons.svg'));

	let imagesPath = '';

	if (iconsPath) {
		const svg = await zip.files[iconsPath].async('string');

		imagesPath = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'})).replace(/$/, '');
	}

	let name = fileName.replace(/\.zip$/i, '');

	const packageProperties = files.find((path) => path.endsWith('liferay-plugin-package.properties'));

	if (packageProperties) {
		const text = await zip.files[packageProperties].async('string');
		const match = /^name=(.*)$/m.exec(text);

		if (match) {
			name = match[1].trim();
		}
	}

	result.themes.push({
		categories,
		css,
		description: 'Imported theme',
		imagesPath,
		key: `theme-${slug(name)}-${Math.random().toString(36).slice(2, 7)}`,
		name,
		source: 'imported',
		tokens,
	});
}

async function inlineRelativeURLs(css: string, zip: JSZip, base: string, files: string[]): Promise<string> {
	const matches = [...css.matchAll(/url\((['"]?)(\.\.\/[^'")]+)\1\)/g)];

	for (const match of matches) {
		const relative = match[2].replace(/^\.\.\//, '');
		const path = files.find((candidate) => candidate === `${base}${relative}`);

		if (!path) {
			continue;
		}

		const data = await dataURL(zip.files[path], path);

		css = css.split(match[0]).join(`url("${data}")`);
	}

	return css;
}

/* ------------------------------------------------------------------------ */
/* Export                                                                    */
/* ------------------------------------------------------------------------ */

export async function exportTemplateZip(template: PageTemplate): Promise<Blob> {
	const zip = new JSZip();

	const setFolder = zip.folder('page-templates')!.folder('storybook')!;

	setFolder.file('page-template-collection.json', JSON.stringify({description: 'Page templates created with Liferay Storybook', name: 'Storybook'}, null, '\t'));

	const folder = setFolder.folder(slug(template.name) || 'page-template')!;

	folder.file('page-template.json', JSON.stringify({name: template.name, type: 'content-page'}, null, '\t'));
	folder.file('page-definition.json', JSON.stringify({pageElement: exportTree(template.root), settings: {}, version: 1.1}, null, '\t'));

	return zip.generateAsync({type: 'blob'});
}

export function templateDefinitionJSON(template: PageTemplate): string {
	return JSON.stringify({pageElement: exportTree(template.root), settings: {}, version: 1.1}, null, '\t');
}

export async function exportStyleBookZip(styleBook: StyleBook, theme: Theme | null): Promise<Blob> {
	const zip = new JSZip();

	const {styleBookJSON, tokenValuesJSON} = serializeStyleBook(styleBook, theme);

	const folder = zip.folder('style-books')!.folder(slug(styleBook.name) || 'style-book')!;

	folder.file('style-book.json', JSON.stringify(styleBookJSON, null, '\t'));
	folder.file('frontend-tokens-values.json', JSON.stringify(tokenValuesJSON, null, '\t'));

	return zip.generateAsync({type: 'blob'});
}

export async function exportCollectionZip(collection: Collection): Promise<Blob> {
	const zip = new JSZip();

	const folder = zip.folder(slug(collection.name) || 'collection')!;

	folder.file('collection.json', JSON.stringify({description: collection.description, name: collection.name}, null, '\t'));

	const fragments = folder.folder('fragments')!;

	for (const fragment of collection.fragments) {
		const fragmentFolder = fragments.folder(fragment.key)!;

		fragmentFolder.file(
			'fragment.json',
			JSON.stringify(
				{
					cacheable: false,
					configurationPath: 'configuration.json',
					cssPath: 'index.css',
					htmlPath: 'index.html',
					icon: fragment.icon,
					jsPath: 'index.js',
					name: fragment.name,
					type: fragment.type,
				},
				null,
				'\t'
			)
		);
		fragmentFolder.file('index.html', fragment.html);
		fragmentFolder.file('index.css', fragment.css);
		fragmentFolder.file('index.js', fragment.js);
		fragmentFolder.file('configuration.json', fragment.configuration || '{"fieldSets": []}');
	}

	const resources = folder.folder('resources')!;

	for (const [name, data] of Object.entries(collection.resources)) {
		const base64 = data.split(',')[1];

		if (base64) {
			resources.file(name, base64, {base64: true});
		}
	}

	return zip.generateAsync({type: 'blob'});
}

export function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');

	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();

	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
