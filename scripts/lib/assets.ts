import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';

import {parseTokenDefinition} from '../../src/model/tokens';
import {normalizeTree} from '../../src/model/pageDefinition';

import type {Collection, Fragment, PageTemplate, StyleBook, Theme} from '../../src/model/types';

/**
 * Reads the assets of a checkout (`collections/`, `templates/`,
 * `style-books/`, `public/themes/`) into the app's model, for the scripts
 * that run outside the browser: the release and the AI catalog.
 */

const MIME: Record<string, string> = {
	'.gif': 'image/gif',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.webm': 'video/webm',
	'.webp': 'image/webp',
};

export interface AssetFiles {
	/** Repository-relative path of the asset folder. */
	path: string;
	/** File name to content, for hashing. */
	files: Record<string, Buffer>;
}

export interface Checkout {
	collections: {collection: Collection; files: AssetFiles; fragmentFiles: Record<string, AssetFiles>; order: number}[];
	root: string;
	styleBooks: {styleBook: StyleBook; files: AssetFiles}[];
	templates: {template: PageTemplate; files: AssetFiles}[];
	themes: Theme[];
}

function readText(path: string): string {
	return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function readJSON(path: string): any {
	const text = readText(path);

	return text ? JSON.parse(text) : {};
}

function dataURL(path: string): string {
	return `data:${MIME[extname(path).toLowerCase()] ?? 'application/octet-stream'};base64,${readFileSync(path).toString('base64')}`;
}

function directories(path: string): string[] {
	return existsSync(path) ? readdirSync(path).filter((name) => statSync(join(path, name)).isDirectory()).sort() : [];
}

export function sha256(data: Buffer | string): string {
	return createHash('sha256').update(data).digest('hex');
}

/** One hash for a set of files, stable across platforms (sorted names, name + content). */
export function hashFiles(files: Record<string, Buffer | string>): string {
	const hash = createHash('sha256');

	for (const name of Object.keys(files).sort()) {
		hash.update(name).update('\0').update(files[name]).update('\0');
	}

	return hash.digest('hex');
}

export function readCheckout(root: string): Checkout {
	const checkout: Checkout = {collections: [], root, styleBooks: [], templates: [], themes: readThemes(root)};

	const collectionsRoot = join(root, 'collections');

	for (const collectionDir of directories(collectionsRoot)) {
		const collectionPath = join(collectionsRoot, collectionDir);
		const collectionJSON = readJSON(join(collectionPath, 'collection.json'));

		const collection: Collection = {
			collapsed: collectionJSON.collapsed === true,
			description: collectionJSON.description ?? '',
			fragments: [],
			key: collectionDir,
			name: collectionJSON.name ?? collectionDir,
			resources: {},
			source: 'builtin',
			theme: collectionJSON.theme ?? null,
		};

		const fragmentFiles: Record<string, AssetFiles> = {};
		const setFiles: Record<string, Buffer> = {};

		if (existsSync(join(collectionPath, 'collection.json'))) {
			setFiles['collection.json'] = readFileSync(join(collectionPath, 'collection.json'));
		}

		for (const fragmentDir of directories(collectionPath)) {
			if (fragmentDir === 'resources') {
				continue;
			}

			const fragmentPath = join(collectionPath, fragmentDir);
			const fragmentJSON = readJSON(join(fragmentPath, 'fragment.json'));

			const names = {
				configuration: fragmentJSON.configurationPath || 'configuration.json',
				css: fragmentJSON.cssPath || 'index.css',
				html: fragmentJSON.htmlPath || 'index.html',
				js: fragmentJSON.jsPath || 'index.js',
			};

			const docs = readText(join(fragmentPath, 'README.md'));

			const fragment: Fragment = {
				collectionKey: collectionDir,
				configuration: readText(join(fragmentPath, names.configuration)),
				css: readText(join(fragmentPath, names.css)),
				...(docs ? {docs} : {}),
				html: readText(join(fragmentPath, names.html)),
				icon: fragmentJSON.icon || 'code',
				js: readText(join(fragmentPath, names.js)),
				key: fragmentJSON.fragmentEntryKey || fragmentDir,
				name: fragmentJSON.name || fragmentDir,
				thumbnail: '',
				type: fragmentJSON.type || 'component',
			};

			collection.fragments.push(fragment);

			const files: Record<string, Buffer> = {};

			for (const name of ['fragment.json', names.html, names.css, names.js, names.configuration]) {
				if (existsSync(join(fragmentPath, name))) {
					files[name] = readFileSync(join(fragmentPath, name));
				}
			}

			fragmentFiles[fragment.key] = {files, path: `collections/${collectionDir}/${fragmentDir}`};

			for (const [name, content] of Object.entries(files)) {
				setFiles[`${fragmentDir}/${name}`] = content;
			}
		}

		const resourcesPath = join(collectionPath, 'resources');

		if (existsSync(resourcesPath)) {
			for (const file of readdirSync(resourcesPath).sort()) {
				collection.resources[file] = dataURL(join(resourcesPath, file));
				setFiles[`resources/${file}`] = readFileSync(join(resourcesPath, file));
			}
		}

		checkout.collections.push({collection, files: {files: setFiles, path: `collections/${collectionDir}`}, fragmentFiles, order: Number(collectionJSON.order ?? 0)});
	}

	const templatesRoot = join(root, 'templates');

	for (const templateDir of directories(templatesRoot)) {
		const definitionPath = join(templatesRoot, templateDir, 'page-definition.json');

		if (!existsSync(definitionPath)) {
			continue;
		}

		const templateJSON = readJSON(join(templatesRoot, templateDir, 'page-template.json'));
		const definition = JSON.parse(readFileSync(definitionPath, 'utf8'));

		checkout.templates.push({
			files: {
				files: {
					'page-definition.json': readFileSync(definitionPath),
					...(existsSync(join(templatesRoot, templateDir, 'page-template.json')) ? {'page-template.json': readFileSync(join(templatesRoot, templateDir, 'page-template.json'))} : {}),
				},
				path: `templates/${templateDir}`,
			},
			template: {id: `builtin-${templateDir}`, name: templateJSON.name || templateDir, root: normalizeTree(definition.pageElement), source: 'builtin'},
		});
	}

	const styleBooksRoot = join(root, 'style-books');

	for (const dir of directories(styleBooksRoot)) {
		const styleBookPath = join(styleBooksRoot, dir, 'style-book.json');

		if (!existsSync(styleBookPath)) {
			continue;
		}

		const styleBookJSON = readJSON(styleBookPath);
		const valuesName = styleBookJSON.frontendTokensValuesPath || 'frontend-tokens-values.json';
		const valuesPath = join(styleBooksRoot, dir, valuesName);
		const valuesJSON = existsSync(valuesPath) ? readJSON(valuesPath) : styleBookJSON.frontendTokensValues ?? {};

		const values: Record<string, string> = {};

		for (const [name, entry] of Object.entries<any>(valuesJSON)) {
			values[name] = typeof entry === 'object' && entry !== null ? String(entry.value ?? '') : String(entry);
		}

		checkout.styleBooks.push({
			files: {files: {'style-book.json': readFileSync(styleBookPath), ...(existsSync(valuesPath) ? {[valuesName]: readFileSync(valuesPath)} : {})}, path: `style-books/${dir}`},
			styleBook: {key: `builtin-${dir}`, name: styleBookJSON.name || dir, source: 'builtin', themeKey: typeof styleBookJSON.themeId === 'string' ? styleBookJSON.themeId.split('_WAR_')[0] : null, values},
		});
	}

	return checkout;
}

function readThemes(root: string): Theme[] {
	const themes: Theme[] = [];
	const themesRoot = join(root, 'public', 'themes');

	for (const dir of directories(themesRoot)) {
		const definitionPath = join(themesRoot, dir, 'frontend-token-definition.json');

		if (!existsSync(definitionPath)) {
			continue;
		}

		const themeJSON = readJSON(join(themesRoot, dir, 'theme.json'));
		const {categories, tokens} = parseTokenDefinition(JSON.parse(readFileSync(definitionPath, 'utf8')));

		themes.push({categories, css: [], description: themeJSON.description ?? '', imagesPath: '', key: dir, name: themeJSON.name ?? dir, source: 'builtin', tokens});
	}

	return themes;
}

export function readDocs(root: string): {markdown: string; slug: string; title: string; order: number}[] {
	const docsRoot = join(root, 'docs');

	if (!existsSync(docsRoot)) {
		return [];
	}

	return readdirSync(docsRoot)
		.filter((name) => name.endsWith('.md'))
		.sort()
		.map((file) => {
			const markdown = readFileSync(join(docsRoot, file), 'utf8');
			const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
			const meta: Record<string, string> = {};

			for (const line of frontmatter ? frontmatter[1].split('\n') : []) {
				const colon = line.indexOf(':');

				if (colon > 0) {
					meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
				}
			}

			const heading = markdown.replace(/^---[\s\S]*?---/, '').match(/^#\s+(.+)$/m);

			return {markdown, order: Number(meta.order ?? 0), slug: file.replace(/\.md$/, ''), title: meta.title || (heading ? heading[1].trim() : file.replace(/\.md$/, ''))};
		});
}
