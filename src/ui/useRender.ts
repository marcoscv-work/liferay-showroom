import {useMemo} from 'react';

import {useEditorScheme} from './editorScheme';

import {styleBookScheme} from '../model/tokens';
import {fragmentArgsKey, useCurrentStyleBook, useCurrentTheme, useStore} from '../store';
import {buildPreviewDocument} from '../preview/document';
import {buildFragmentStory, buildTemplateStory} from './story';

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

/** The scheme of the preview: the style book's when it declares or implies one, else the editor's. */
export function useColorScheme(): 'light' | 'dark' {
	const editor = useEditorScheme().effective;
	const theme = useCurrentTheme();
	const styleBook = useCurrentStyleBook();

	return styleBookScheme(styleBook, theme) ?? editor;
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
		const context = {collections: state.collections, colorScheme, styleBook, theme};

		if (fragment) {
			const story = buildFragmentStory(fragment, collection, args ?? {}, context);

			return {
				collection,
				configurationRaw: story.configurationRaw,
				css: '',
				document: story.document,
				editables: story.editables,
				fragment,
				html: story.html,
				js: story.js,
				template: null,
				warnings: story.warnings,
			};
		}

		if (template) {
			const story = buildTemplateStory(template, context);

			return {
				collection: null,
				configurationRaw: {},
				css: story.css,
				document: story.document,
				editables: [],
				fragment: null,
				html: story.html,
				js: story.js,
				template,
				warnings: story.warnings,
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
				html: '<div class="container-fluid container-fluid-max-xl py-5"><h1>Liferay Showroom</h1><p class="lead">Pick a fragment or a page template from the sidebar.</p></div>',
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
	}, [args, collection, colorScheme, fragment, state.collections, styleBook, template, theme]);
}
