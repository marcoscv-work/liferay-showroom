import './lib/dom';

import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

import {markdownToText} from '../src/docs/markdown';
import {allFields, defaultRawValue, parseConfiguration} from '../src/model/configuration';
import {renderFragment} from '../src/model/fragmentRenderer';
import {readCheckout, readDocs} from './lib/assets';

/**
 * The machine-readable face of the site, for AI agents and tooling:
 *
 * - `public/catalog.json`: every fragment with its configuration fields,
 *   editables and docs, every page template and style book, with the URL
 *   that shows each one.
 * - `public/llms.txt`: the same as a document an agent reads in one go,
 *   plus how to compose a page definition the site imports.
 *
 *   npx vite-node scripts/catalog.ts [--site https://host/path/]
 */

function argument(name: string, fallback: string): string {
	const index = process.argv.indexOf(`--${name}`);

	return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const root = resolve(new URL('..', import.meta.url).pathname);
const packageJSON = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const site = argument('site', packageJSON.homepage ?? './').replace(/\/?$/, '/');
const checkout = readCheckout(root);
const docs = readDocs(root);

const theme = (key: string | null | undefined) => checkout.themes.find((candidate) => candidate.key === key) ?? checkout.themes[0] ?? null;

const catalog = {
	collections: [...checkout.collections].sort((a, b) => a.order - b.order || a.collection.name.localeCompare(b.collection.name)).map(({collection}) => ({
		description: collection.description,
		fragments: collection.fragments.map((fragment) => {
			const {configuration} = parseConfiguration(fragment.configuration);
			const raw: Record<string, any> = {};

			for (const field of allFields(configuration)) {
				raw[field.name] = defaultRawValue(field);
			}

			const rendered = renderFragment(fragment, {collection, configuration: raw, editables: {}, imagesPath: '', namespace: 'catalog', theme: theme(collection.theme)});

			return {
				configuration: allFields(configuration).map((field) => ({
					default: defaultRawValue(field),
					description: field.description || undefined,
					label: field.label,
					name: field.name,
					options: field.typeOptions?.validValues?.map((option: any) => String(option.value)) ?? undefined,
					type: field.type,
				})),
				docs: fragment.docs ? markdownToText(fragment.docs) : undefined,
				editables: rendered.editables.map((editable) => ({default: editable.defaultValue, id: editable.id, type: editable.type})),
				key: fragment.key,
				name: fragment.name,
				type: fragment.type,
				url: `${site}?path=/fragment/${encodeURIComponent(collection.key)}/${encodeURIComponent(fragment.key)}`,
			};
		}),
		key: collection.key,
		name: collection.name,
		resources: Object.keys(collection.resources),
		theme: collection.theme ?? null,
	})),
	docs: docs.map((doc) => ({slug: doc.slug, text: markdownToText(doc.markdown), title: doc.title, url: `${site}?path=/docs/${doc.slug}`})),
	generated: new Date().toISOString(),
	pageDefinition: {
		description: 'A page template is a Liferay page-definition.json: {"pageElement": <Root>, "version": 1.1}. Element types nest Root > Section > Container > Row > Column > Fragment. A Fragment element is {"type": "Fragment", "definition": {"fragment": {"collectionKey": "<collection key>", "key": "<fragment key>"}, "fragmentConfig": {<configuration name>: <value>}, "fragmentFields": [{"id": "<editable id>", "value": {"text": {"value_i18n": {"en_US": "<text>"}}}}]}}. For a link editable the value is {"text": {"value_i18n": {"en_US": "<label>"}}, "fragmentLink": {"value": {"href": {"value_i18n": {"en_US": "<url>"}}}}}; for an image, {"fragmentImage": {"url": {"value": "<src>"}}}. A Row is {"type": "Row", "definition": {"numberOfColumns": N}, "pageElements": [{"type": "Column", "definition": {"size": 12/N}, "pageElements": [...]}]}. Drop the JSON file on the site, or import it through the Liferay headless API.',
		importURL: site,
	},
	releases: `${site}collections/releases.json`,
	site,
	styleBooks: checkout.styleBooks.map(({styleBook}) => ({key: styleBook.key.replace(/^builtin-/, ''), name: styleBook.name, theme: styleBook.themeKey, tokens: Object.keys(styleBook.values).length})),
	templates: checkout.templates.map(({template}) => ({
		fragments: collectFragments(template.root),
		id: template.id,
		name: template.name,
		url: `${site}?path=/template/${encodeURIComponent(template.id)}`,
	})),
	themes: checkout.themes.map((candidate) => ({
		categories: candidate.categories.map((category) => ({label: category.label, name: category.name, sets: category.sets.map((set) => ({label: set.label, name: set.name, tokens: set.tokens.map((token) => ({cssVariable: token.cssVariable, default: token.defaultValue, name: token.name, type: token.editorType}))})) })),
		key: candidate.key,
		name: candidate.name,
	})),
	version: packageJSON.version,
};

function collectFragments(element: any): {collectionKey?: string; key?: string}[] {
	const found: {collectionKey?: string; key?: string}[] = [];

	if (element.type === 'Fragment') {
		found.push({collectionKey: element.definition?.fragment?.collectionKey, key: element.definition?.fragment?.key});
	}

	for (const child of element.pageElements ?? []) {
		found.push(...collectFragments(child));
	}

	return found;
}

const lines: string[] = [];

lines.push(`# Liferay Storybook ${packageJSON.version}`, '');
lines.push(`> A published, versioned set of Liferay design assets: fragment sets, page templates and style books, rendered without a Liferay. Everything listed here is exactly what gets imported into Liferay. Site: ${site}`, '');
lines.push(`Machine-readable catalog: ${site}catalog.json. Release manifests: ${site}collections/releases.json. Each fragment and template has a URL that shows it live; append the URL to point a reviewer at it.`, '');

lines.push('## How to compose a page', '');
lines.push(catalog.pageDefinition.description, '');
lines.push('Use the fragment keys and collection keys below. Configuration values go in `fragmentConfig` by field name and editable values in `fragmentFields` by editable id, both listed per fragment.', '');

for (const collection of catalog.collections) {
	lines.push(`## Fragment set: ${collection.name} (key \`${collection.key}\`)`, '');

	if (collection.description) {
		lines.push(collection.description, '');
	}

	for (const fragment of collection.fragments) {
		lines.push(`### ${fragment.name} (key \`${fragment.key}\`)`, '');
		lines.push(`- URL: ${fragment.url}`);

		if (fragment.configuration.length) {
			lines.push(`- Configuration: ${fragment.configuration.map((field) => `${field.name} (${field.type}${field.options ? `: ${field.options.join(' | ')}` : ''}, default ${JSON.stringify(field.default)})`).join('; ')}`);
		}

		if (fragment.editables.length) {
			lines.push(`- Editables: ${fragment.editables.map((editable) => `${editable.id} (${editable.type})`).join(', ')}`);
		}

		if (fragment.docs) {
			lines.push('', fragment.docs);
		}

		lines.push('');
	}
}

lines.push('## Page templates', '');

for (const template of catalog.templates) {
	lines.push(`- ${template.name} (id \`${template.id}\`): ${template.url}. Fragments in order: ${template.fragments.map((fragment) => fragment.key).join(', ')}`);
}

lines.push('', '## Style books', '');

for (const styleBook of catalog.styleBooks) {
	lines.push(`- ${styleBook.name} (key \`${styleBook.key}\`, theme ${styleBook.theme}, ${styleBook.tokens} token values)`);
}

lines.push('', '## Documentation', '');

for (const doc of catalog.docs) {
	lines.push(`### ${doc.title}`, '', `URL: ${doc.url}`, '', doc.text, '');
}

mkdirSync(join(root, 'public'), {recursive: true});
writeFileSync(join(root, 'public', 'catalog.json'), JSON.stringify(catalog, null, '\t') + '\n');
writeFileSync(join(root, 'public', 'llms.txt'), lines.join('\n') + '\n');

console.log(`Catalog: ${catalog.collections.reduce((total, collection) => total + collection.fragments.length, 0)} fragment(s), ${catalog.templates.length} template(s), ${catalog.styleBooks.length} style book(s), ${catalog.docs.length} doc page(s) → public/catalog.json, public/llms.txt`);
