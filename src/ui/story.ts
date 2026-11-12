import {componentProps, componentRawValues} from '../model/components';
import {allFields, defaultRawValue, parseConfiguration} from '../model/configuration';
import {renderFragment, wrapFragmentScript} from '../model/fragmentRenderer';
import {renderPage} from '../model/pageDefinition';
import {buildPreviewDocument} from '../preview/document';
import {assetURL} from '../store/load';

import type {EditableInfo, EditableValue} from '../model/fragmentRenderer';
import type {Collection, Fragment, PageTemplate, ReactComponent, StyleBook, Theme} from '../model/types';

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

export interface ComponentStory {
	configurationRaw: Record<string, any>;
	document: string;
	props: Record<string, any>;
}

const PROPS_ELEMENT = /<script type="application\/json" id="showroom-component-props">[\s\S]*?<\/script>/;

/** The frame document without its props: the same key means the frame keeps running and only the props are posted to it. */
export function componentFrameKey(document: string): string {
	return document.replace(PROPS_ELEMENT, '');
}

/**
 * The scripts that load the in-frame runtime (`src/components/runtime.tsx`).
 * The build emits it as `assets/component-runtime.js`; the dev server serves
 * the source, after the React Refresh preamble its transform expects.
 */
function componentRuntimeScripts(): string {
	if (import.meta.env.DEV) {
		return `<script type="module">
import RefreshRuntime from ${JSON.stringify(assetURL('@react-refresh'))};
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;
</script>
<script type="module" src="${assetURL('src/components/runtime.tsx')}"></script>`;
	}

	return `<script type="module" src="${assetURL('assets/component-runtime.js')}"></script>`;
}

export function buildComponentStory(component: ReactComponent, values: Record<string, any>, context: StoryContext): ComponentStory {
	const configurationRaw = componentRawValues(component, values);
	const props = componentProps(component, configurationRaw, context.theme);
	const json = JSON.stringify(props).replace(/</g, '\\u003c');

	return {
		configurationRaw,
		document: buildPreviewDocument({
			bodyEnd: `<script type="application/json" id="showroom-component-props">${json}</script>\n${componentRuntimeScripts()}`,
			colorScheme: context.colorScheme,
			css: '',
			fragmentCSS: '',
			html: '<div class="container-fluid container-fluid-max-xl py-4"><div id="showroom-component-root"></div></div>',
			htmlAttributes: `data-showroom-component="${component.key.replace(/[^\w-]/g, '')}"`,
			js: '',
			mode: 'story',
			theme: context.theme,
			tokenValues: context.styleBook.values,
		}),
		props,
	};
}
