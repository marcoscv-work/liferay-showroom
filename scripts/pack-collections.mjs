/**
 * Packs every fragment collection under `collections/` into a JSON file the
 * app can fetch at runtime (`public/collections/<name>.json`) plus an index.
 *
 * A collection folder mirrors a Liferay fragment collection export:
 *
 *   collections/<collection>/collection.json
 *   collections/<collection>/<fragment>/fragment.json
 *   collections/<collection>/<fragment>/index.html|index.css|index.js|configuration.json|thumbnail.png
 *   collections/<collection>/resources/<file>
 */
import {existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join, extname} from 'node:path';

const root = new URL('../collections/', import.meta.url).pathname;
const out = new URL('../public/collections/', import.meta.url).pathname;

mkdirSync(out, {recursive: true});

const mime = {
	'.gif': 'image/gif',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
};

function readText(path) {
	return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function readDataURL(path) {
	if (!existsSync(path)) {
		return '';
	}

	const type = mime[extname(path).toLowerCase()] || 'application/octet-stream';

	return `data:${type};base64,${readFileSync(path).toString('base64')}`;
}

const index = [];

for (const collectionDir of readdirSync(root)) {
	const collectionPath = join(root, collectionDir);

	if (!statSync(collectionPath).isDirectory()) {
		continue;
	}

	const collection = JSON.parse(readText(join(collectionPath, 'collection.json')) || '{}');

	const fragments = [];

	for (const fragmentDir of readdirSync(collectionPath)) {
		const fragmentPath = join(collectionPath, fragmentDir);

		if (!statSync(fragmentPath).isDirectory() || fragmentDir === 'resources') {
			continue;
		}

		const fragmentJSON = JSON.parse(readText(join(fragmentPath, 'fragment.json')) || '{}');

		fragments.push({
			configuration: readText(join(fragmentPath, fragmentJSON.configurationPath || 'configuration.json')),
			css: readText(join(fragmentPath, fragmentJSON.cssPath || 'index.css')),
			html: readText(join(fragmentPath, fragmentJSON.htmlPath || 'index.html')),
			icon: fragmentJSON.icon || 'code',
			js: readText(join(fragmentPath, fragmentJSON.jsPath || 'index.js')),
			key: fragmentJSON.fragmentEntryKey || fragmentDir,
			name: fragmentJSON.name || fragmentDir,
			thumbnail: readDataURL(join(fragmentPath, fragmentJSON.thumbnailPath || 'thumbnail.png')),
			type: fragmentJSON.type || 'component',
		});
	}

	const resources = {};

	const resourcesPath = join(collectionPath, 'resources');

	if (existsSync(resourcesPath)) {
		for (const file of readdirSync(resourcesPath)) {
			resources[file] = readDataURL(join(resourcesPath, file));
		}
	}

	const packed = {
		description: collection.description || '',
		fragments,
		key: collectionDir,
		name: collection.name || collectionDir,
		resources,
		theme: collection.theme || null,
	};

	writeFileSync(join(out, `${collectionDir}.json`), JSON.stringify(packed));

	index.push({key: collectionDir, name: packed.name, fragments: fragments.length});
}

writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, '\t'));

/* Page templates under `templates/<name>/page-definition.json` */

const templatesRoot = new URL('../templates/', import.meta.url).pathname;
const templates = [];

if (existsSync(templatesRoot)) {
	for (const templateDir of readdirSync(templatesRoot)) {
		const definitionPath = join(templatesRoot, templateDir, 'page-definition.json');

		if (!existsSync(definitionPath)) {
			continue;
		}

		const template = JSON.parse(readText(join(templatesRoot, templateDir, 'page-template.json')) || '{}');

		templates.push({
			definition: JSON.parse(readFileSync(definitionPath, 'utf8')),
			key: templateDir,
			name: template.name || templateDir,
		});
	}
}

writeFileSync(join(out, 'templates.json'), JSON.stringify(templates));

/* Style books under `style-books/<name>/style-book.json` + `frontend-tokens-values.json` */

const styleBooksRoot = new URL('../style-books/', import.meta.url).pathname;
const styleBooks = [];

if (existsSync(styleBooksRoot)) {
	for (const dir of readdirSync(styleBooksRoot)) {
		const styleBookPath = join(styleBooksRoot, dir, 'style-book.json');

		if (!existsSync(styleBookPath)) {
			continue;
		}

		const styleBook = JSON.parse(readFileSync(styleBookPath, 'utf8'));
		const valuesPath = join(styleBooksRoot, dir, styleBook.frontendTokensValuesPath || 'frontend-tokens-values.json');

		styleBooks.push({
			key: dir,
			name: styleBook.name || dir,
			themeId: styleBook.themeId || null,
			values: existsSync(valuesPath) ? JSON.parse(readFileSync(valuesPath, 'utf8')) : styleBook.frontendTokensValues || {},
		});
	}
}

writeFileSync(join(out, 'style-books.json'), JSON.stringify(styleBooks));

console.log(`Packed ${styleBooks.length} style book(s)`);

console.log(`Packed ${templates.length} page template(s)`);

console.log(`Packed ${index.length} collection(s): ${index.map((c) => `${c.name} (${c.fragments})`).join(', ')}`);
