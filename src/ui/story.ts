import {allFields, defaultRawValue, parseConfiguration} from '../model/configuration';
import {renderFragment, wrapFragmentScript} from '../model/fragmentRenderer';
import {renderPage} from '../model/pageDefinition';
import {buildPreviewDocument} from '../preview/document';

import type {EditableInfo, EditableValue} from '../model/fragmentRenderer';
import type {Collection, Fragment, PageTemplate, StyleBook, Theme} from '../model/types';

/**
 * Builds the preview documents the canvas and the documentation embeds share:
 * a fragment story (one fragment with its args on a Liferay-like page) and a
 * page template.
 */

export interface StoryContext {
	collections: Collection[];
	colorScheme: 'light' | 'dark';
	styleBook: StyleBook;
	theme: Theme | null;
}

export interface FragmentStoryArgs {
	configuration?: Record<string, any>;
	editables?: Record<string, EditableValue>;
}

export interface FragmentStory {
	configurationRaw: Record<string, any>;
	css: string;
	document: string;
	editables: EditableInfo[];
	html: string;
	js: string;
	warnings: string[];
}

export function buildFragmentStory(fragment: Fragment, collection: Collection | null, args: FragmentStoryArgs, context: StoryContext, {namespace = 'story', padding = 'py-4'}: {namespace?: string; padding?: string} = {}): FragmentStory {
	const {configuration} = parseConfiguration(fragment.configuration);
	const configurationRaw: Record<string, any> = {};

	for (const field of allFields(configuration)) {
		configurationRaw[field.name] = args.configuration?.[field.name] ?? defaultRawValue(field);
	}

	const result = renderFragment(fragment, {
		collection,
		configuration: configurationRaw,
		editables: args.editables ?? {},
		imagesPath: context.theme?.imagesPath ?? '',
		layoutMode: 'view',
		namespace,
		theme: context.theme,
	});

	const html = `<div class="lfr-layout-structure-item-root" id="main-content"><div class="container-fluid container-fluid-max-xl ${padding}"><div class="lfr-layout-structure-item-fragment lfr-layout-structure-item-${fragment.key.toLowerCase()}" id="fragment-${namespace}">${result.html}</div></div></div>`;
	const js = wrapFragmentScript(result.js, namespace, configurationRaw, 'view');

	return {
		configurationRaw,
		css: result.css,
		document: buildPreviewDocument({colorScheme: context.colorScheme, css: '', fragmentCSS: result.css, html, js, mode: 'story', theme: context.theme, tokenValues: context.styleBook.values}),
		editables: result.editables,
		html: result.html,
		js,
		warnings: result.warnings,
	};
}

export interface TemplateStory {
	css: string;
	document: string;
	html: string;
	js: string;
	warnings: string[];
}

export function buildTemplateStory(template: PageTemplate, context: StoryContext, layoutMode: 'view' | 'edit' = 'edit'): TemplateStory {
	const result = renderPage(template.root, {collections: context.collections, imagesPath: context.theme?.imagesPath ?? '', layoutMode, theme: context.theme});

	return {
		css: result.css,
		document: buildPreviewDocument({colorScheme: context.colorScheme, css: result.css, fragmentCSS: '', html: result.html, js: result.js, mode: 'template', theme: context.theme, tokenValues: context.styleBook.values}),
		html: result.html,
		js: result.js,
		warnings: result.warnings,
	};
}

export function findFragmentByKey(collections: Collection[], key: string, collectionKey?: string): {collection: Collection; fragment: Fragment} | null {
	for (const collection of collections) {
		if (collectionKey && collection.key !== collectionKey) {
			continue;
		}

		const fragment = collection.fragments.find((candidate) => candidate.key === key);

		if (fragment) {
			return {collection, fragment};
		}
	}

	return null;
}
