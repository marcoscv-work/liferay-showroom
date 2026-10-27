import {normalizeTree} from '../model/pageDefinition';
import {parseStyleBookValues, parseTokenDefinition} from '../model/tokens';

import type {Collection, PageTemplate, StyleBook, Theme} from '../model/types';

/**
 * Loads the assets bundled with the storybook: the packed fragment
 * collections and the built Liferay themes under `public/`.
 */

const BUILTIN_THEMES: {assets?: string; key: string; name: string; description: string}[] = [
	{description: 'The default Liferay DXP theme (Clay Atlas).', key: 'classic', name: 'Classic'},
	{assets: 'classic', description: 'Classic plus the Liferay Sites Design System tokens, driven by the LSDS style books.', key: 'classic-lsds', name: 'Classic + Liferay Sites DS'},
	{description: 'Liferay 2025+ theme with the Prism design tokens.', key: 'prism', name: 'Prism'},
	{description: 'Dialect theme (Liferay marketing design system).', key: 'dialect', name: 'Dialect'},
	{description: 'Minimal theme used by the CMS experience.', key: 'cms', name: 'CMS'},
];

export function assetURL(path: string): string {
	const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

	return new URL(`${base}${path}`, window.location.href).href;
}

export async function loadBuiltinThemes(): Promise<Theme[]> {
	const themes: Theme[] = [];

	for (const builtin of BUILTIN_THEMES) {
		try {
			const response = await fetch(assetURL(`themes/${builtin.key}/frontend-token-definition.json`));

			if (!response.ok) {
				continue;
			}

			const {categories, tokens} = parseTokenDefinition(await response.json());
			const assets = builtin.assets ?? builtin.key;

			themes.push({
				categories,
				css: [assetURL(`themes/${assets}/css/clay.css`), assetURL(`themes/${assets}/css/main.css`)],
				description: builtin.description,
				imagesPath: assetURL(`themes/${assets}/images`),
				key: builtin.key,
				name: builtin.name,
				source: 'builtin',
				tokens,
			});
		}
		catch {
			// A missing theme is simply not offered.
		}
	}

	return themes;
}

export async function loadBuiltinCollections(): Promise<Collection[]> {
	const collections: Collection[] = [];

	try {
		const response = await fetch(assetURL('collections/index.json'));

		if (!response.ok) {
			return collections;
		}

		const index: {key: string}[] = await response.json();

		for (const entry of index) {
			const packed = await (await fetch(assetURL(`collections/${entry.key}.json`))).json();

			collections.push({
				description: packed.description ?? '',
				fragments: (packed.fragments ?? []).map((fragment: any) => ({...fragment, collectionKey: entry.key})),
				key: entry.key,
				name: packed.name ?? entry.key,
				resources: packed.resources ?? {},
				source: 'builtin',
				theme: packed.theme ?? null,
			});
		}
	}
	catch {
		// No bundled collections.
	}

	return collections;
}

export async function loadBuiltinTemplates(): Promise<PageTemplate[]> {
	try {
		const response = await fetch(assetURL('collections/templates.json'));

		if (!response.ok) {
			return [];
		}

		const packed: {definition: any; key: string; name: string}[] = await response.json();

		return packed
			.filter((entry) => entry.definition?.pageElement)
			.map((entry) => ({id: `builtin-${entry.key}`, name: entry.name, root: normalizeTree(entry.definition.pageElement), source: 'builtin' as const}));
	}
	catch {
		return [];
	}
}

export async function loadBuiltinStyleBooks(): Promise<StyleBook[]> {
	try {
		const response = await fetch(assetURL('collections/style-books.json'));

		if (!response.ok) {
			return [];
		}

		const packed: {key: string; name: string; themeId: string | null; values: any}[] = await response.json();

		return packed.map((entry) => ({
			key: `builtin-${entry.key}`,
			name: entry.name,
			source: 'builtin' as const,
			themeKey: typeof entry.themeId === 'string' ? entry.themeId.split('_WAR_')[0] : null,
			values: parseStyleBookValues(null, entry.values),
		}));
	}
	catch {
		return [];
	}
}
