import {normalizeTree} from '../model/pageDefinition';
import {parseTokenDefinition} from '../model/tokens';

import type {Collection, PageTemplate, Theme} from '../model/types';

/**
 * Loads the assets bundled with the storybook: the packed fragment
 * collections and the built Liferay themes under `public/`.
 */

const BUILTIN_THEMES: {key: string; name: string; description: string}[] = [
	{description: 'The default Liferay DXP theme (Clay Atlas).', key: 'classic', name: 'Classic'},
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

			themes.push({
				categories,
				css: [assetURL(`themes/${builtin.key}/css/clay.css`), assetURL(`themes/${builtin.key}/css/main.css`)],
				description: builtin.description,
				imagesPath: assetURL(`themes/${builtin.key}/images`),
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
