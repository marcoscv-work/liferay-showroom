import {useMemo} from 'react';

import {useEditorScheme} from './editorScheme';

import {allFields, defaultRawValue, parseConfiguration} from '../model/configuration';
import {renderFragment, wrapFragmentScript} from '../model/fragmentRenderer';
import {renderPage} from '../model/pageDefinition';
import {fragmentArgsKey, useCurrentStyleBook, useCurrentTheme, useStore} from '../store';
import {buildPreviewDocument} from '../preview/document';

import type {EditableInfo} from '../model/fragmentRenderer';
import type {Collection, Fragment, PageTemplate} from '../model/types';

export interface RenderOutput {
	collection: Collection | null;
	configurationRaw: Record<string, any>;
	css: string;
	document: string;
	editables: EditableInfo[];
	fragment: Fragment | null;
	html: string;
	js: string;
	template: PageTemplate | null;
	warnings: string[];
}

export function useCurrentFragment(): {collection: Collection | null; fragment: Fragment | null} {
	const {state} = useStore();

	if (state.selection.kind !== 'fragment') {
		return {collection: null, fragment: null};
	}

	const {collectionKey, fragmentKey} = state.selection;

	const collection = state.collections.find((candidate) => candidate.key === collectionKey) ?? null;
	const fragment = collection?.fragments.find((candidate) => candidate.key === fragmentKey) ?? null;

	return {collection, fragment};
}

export function useCurrentTemplate(): PageTemplate | null {
	const {state} = useStore();

	if (state.selection.kind !== 'template') {
		return null;
	}

	const {id} = state.selection;

	return state.templates.find((template) => template.id === id) ?? null;
}

export function useColorScheme(): 'light' | 'dark' {
	return useEditorScheme().effective;
}

export function useRender(): RenderOutput {
	const {state} = useStore();
	const colorScheme = useColorScheme();
	const theme = useCurrentTheme();
	const styleBook = useCurrentStyleBook();
	const {collection, fragment} = useCurrentFragment();
	const template = useCurrentTemplate();

	const args = fragment ? state.fragmentArgs[fragmentArgsKey(fragment.collectionKey, fragment.key)] : undefined;

	return useMemo(() => {
		const tokenValues = styleBook.values;

		if (fragment) {
			const {configuration} = parseConfiguration(fragment.configuration);
			const configurationRaw: Record<string, any> = {};

			for (const field of allFields(configuration)) {
				configurationRaw[field.name] = args?.configuration[field.name] ?? defaultRawValue(field);
			}

			const namespace = 'story';

			const result = renderFragment(fragment, {
				collection,
				configuration: configurationRaw,
				editables: args?.editables ?? {},
				imagesPath: theme?.imagesPath ?? '',
				layoutMode: 'view',
				namespace,
				theme,
			});

			const html = `<div class="lfr-layout-structure-item-root" id="main-content"><div class="container-fluid container-fluid-max-xl py-4"><div class="lfr-layout-structure-item-fragment lfr-layout-structure-item-${fragment.key.toLowerCase()}" id="fragment-${namespace}">${result.html}</div></div></div>`;
			const js = wrapFragmentScript(result.js, namespace, configurationRaw, 'view');

			return {
				collection,
				configurationRaw,
				css: '',
				document: buildPreviewDocument({colorScheme, css: '', fragmentCSS: result.css, html, js, mode: 'story', theme, tokenValues}),
				editables: result.editables,
				fragment,
				html: result.html,
				js,
				template: null,
				warnings: result.warnings,
			};
		}

		if (template) {
			const result = renderPage(template.root, {collections: state.collections, imagesPath: theme?.imagesPath ?? '', layoutMode: 'edit', theme});

			return {
				collection: null,
				configurationRaw: {},
				css: result.css,
				document: buildPreviewDocument({colorScheme, css: result.css, fragmentCSS: '', html: result.html, js: result.js, mode: 'template', theme, tokenValues}),
				editables: [],
				fragment: null,
				html: result.html,
				js: result.js,
				template,
				warnings: result.warnings,
			};
		}

		return {
			collection: null,
			configurationRaw: {},
			css: '',
			document: buildPreviewDocument({
				colorScheme,
				css: '',
				fragmentCSS: '',
				html: '<div class="container-fluid container-fluid-max-xl py-5"><h1>Liferay Storybook</h1><p class="lead">Pick a fragment or a page template from the sidebar.</p></div>',
				js: '',
				mode: 'story',
				theme,
				tokenValues,
			}),
			editables: [],
			fragment: null,
			html: '',
			js: '',
			template: null,
			warnings: [],
		};
	}, [args, collection, colorScheme, fragment, state.collections, styleBook.values, template, theme]);
}
