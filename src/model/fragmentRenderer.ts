import {render} from '../freemarker';
import {buildConfigurationModel, parseConfiguration} from './configuration';
import {buildLiferayContext} from './liferayContext';

import type {Collection, Fragment, Theme} from './types';

/**
 * A normalized editable value. It is what the storybook persists and what it
 * converts from/to the `fragmentFields` of a page definition.
 */
export interface EditableValue {
	alt?: string;
	href?: string;
	src?: string;
	target?: string;
	text?: string;
}

export interface EditableInfo {
	/** What the fragment renders when nothing overrides it. */
	defaultValue: EditableValue;
	id: string;
	type: string;
}

export interface FragmentRenderOptions {
	collection: Collection | null;
	configuration: Record<string, any>;
	dropZones?: Record<string, string>;
	editables?: Record<string, EditableValue>;
	imagesPath: string;
	layoutMode?: 'view' | 'edit';
	locale?: string;
	namespace: string;
	theme: Theme | null;
}

export interface FragmentRenderResult {
	css: string;
	editables: EditableInfo[];
	html: string;
	js: string;
	warnings: string[];
}

const RESOURCE_PATTERN = /\[resources:([^\]]+)\]/g;

export function replaceResources(text: string, collection: Collection | null): string {
	return text.replace(RESOURCE_PATTERN, (match, name: string) => {
		const resource = collection?.resources[name.trim()];

		return resource ?? match;
	});
}

export function renderFragment(fragment: Fragment, options: FragmentRenderOptions): FragmentRenderResult {
	const warnings: string[] = [];

	const {configuration, error} = parseConfiguration(fragment.configuration);

	if (error) {
		warnings.push(error);
	}

	const model = buildLiferayContext({
		imagesPath: options.imagesPath,
		layoutMode: options.layoutMode ?? 'view',
		locale: options.locale ?? 'en_US',
		namespace: options.namespace,
	});

	model.configuration = buildConfigurationModel(configuration, options.configuration, options.theme);

	const template = replaceResources(fragment.html, options.collection);

	const result = render(template, model);

	warnings.push(...result.warnings);

	const editables: EditableInfo[] = [];

	let html = result.output;

	if (typeof DOMParser !== 'undefined') {
		html = postProcess(html, options, editables, warnings);
	}

	return {
		css: replaceResources(fragment.css, options.collection),
		editables,
		html,
		js: fragment.js,
		warnings,
	};
}

const EDITABLE_TAGS: Record<string, string> = {
	'action': 'button',
	'date-time': 'span',
	'html': 'div',
	'image': 'img',
	'link': 'a',
	'rich-text': 'div',
	'text': 'span',
};

function postProcess(html: string, options: FragmentRenderOptions, editables: EditableInfo[], warnings: string[]): string {
	const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');

	for (const element of Array.from(doc.querySelectorAll('lfr-editable'))) {
		const type = element.getAttribute('type') ?? 'text';
		const replacement = doc.createElement(EDITABLE_TAGS[type] ?? 'div');

		for (const attribute of Array.from(element.attributes)) {
			if (attribute.name === 'id') {
				replacement.setAttribute('data-lfr-editable-id', attribute.value);
			}
			else if (attribute.name === 'type') {
				replacement.setAttribute('data-lfr-editable-type', attribute.value);
			}
			else {
				replacement.setAttribute(attribute.name, attribute.value);
			}
		}

		if (type === 'image') {
			const img = element.querySelector('img');

			if (img) {
				for (const attribute of Array.from(img.attributes)) {
					if (!replacement.hasAttribute(attribute.name)) {
						replacement.setAttribute(attribute.name, attribute.value);
					}
				}
			}
			else {
				replacement.setAttribute('src', element.getAttribute('src') ?? '');
				replacement.setAttribute('alt', element.getAttribute('alt') ?? '');
			}
		}
		else {
			replacement.innerHTML = element.innerHTML;
		}

		element.replaceWith(replacement);
	}

	const seen = new Set<string>();

	for (const element of Array.from(doc.querySelectorAll('[data-lfr-editable-id]'))) {
		const id = element.getAttribute('data-lfr-editable-id') ?? '';
		const type = element.getAttribute('data-lfr-editable-type') ?? 'text';

		if (!seen.has(id)) {
			seen.add(id);
			editables.push({defaultValue: readEditableDefault(element, type), id, type});
		}

		const value = options.editables?.[id];

		if (!value) {
			continue;
		}

		applyEditableValue(element, type, value, doc);
	}

	for (const element of Array.from(doc.querySelectorAll('lfr-drop-zone'))) {
		const id = element.getAttribute('data-lfr-drop-zone-id') ?? element.getAttribute('id') ?? '';
		const replacement = doc.createElement('div');

		replacement.className = 'lfr-drop-zone';
		replacement.setAttribute('data-drop-zone-id', id);
		replacement.setAttribute('data-drop-zone-namespace', options.namespace);

		const content = options.dropZones?.[id];

		if (content) {
			replacement.innerHTML = content;
		}
		else if ((options.layoutMode ?? 'view') === 'edit') {
			replacement.classList.add('lfr-drop-zone--empty');
			replacement.innerHTML = `<div class="lfr-drop-zone__placeholder">Drop zone ${id}</div>`;
		}

		element.replaceWith(replacement);
	}

	for (const element of Array.from(doc.querySelectorAll('[data-lfr-background-image-id]'))) {
		const id = element.getAttribute('data-lfr-background-image-id') ?? '';

		if (!seen.has(id)) {
			seen.add(id);
			editables.push({defaultValue: {src: ((element as HTMLElement).style.backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1] ?? ''}, id, type: 'background-image'});
		}

		const value = options.editables?.[id];

		if (value?.src) {
			(element as HTMLElement).style.backgroundImage = `url("${value.src}")`;
		}
	}

	if (doc.querySelector('script') && !fragmentHasScriptTaglib(html)) {
		warnings.push('Inline <script> tags are removed by Liferay in fragment HTML; put the code in index.js');
	}

	return doc.body.innerHTML;
}

function fragmentHasScriptTaglib(html: string): boolean {
	return html.includes('<script>');
}

function readEditableDefault(element: Element, type: string): EditableValue {
	switch (type) {
		case 'image': {
			const img = element.tagName === 'IMG' ? element : element.querySelector('img');

			return {alt: img?.getAttribute('alt') ?? '', src: img?.getAttribute('src') ?? ''};
		}
		case 'link':
		case 'action': {
			const anchor = element.tagName === 'A' || element.tagName === 'BUTTON' ? element : element.querySelector('a');

			return {href: anchor?.getAttribute('href') ?? '', target: anchor?.getAttribute('target') ?? undefined, text: (anchor ?? element).textContent?.trim() ?? ''};
		}
		case 'rich-text':
		case 'html':
			return {text: element.innerHTML.trim()};
		default:
			return {text: element.textContent?.trim() ?? ''};
	}
}

function applyEditableValue(element: Element, type: string, value: EditableValue, doc: Document): void {
	switch (type) {
		case 'image':
		case 'background-image': {
			const img = element.tagName === 'IMG' ? element : element.querySelector('img');

			if (value.src !== undefined && value.src !== '') {
				if (img) {
					img.setAttribute('src', value.src);
				}
				else {
					(element as HTMLElement).style.backgroundImage = `url("${value.src}")`;
				}
			}

			if (value.alt !== undefined && img) {
				img.setAttribute('alt', value.alt);
			}

			if (value.href) {
				const link = doc.createElement('a');

				link.setAttribute('href', value.href);

				if (value.target) {
					link.setAttribute('target', value.target);
				}

				element.replaceWith(link);
				link.appendChild(element);
			}

			break;
		}
		case 'link':
		case 'action': {
			const anchor = element.tagName === 'A' || element.tagName === 'BUTTON' ? element : element.querySelector('a');

			if (anchor && value.href !== undefined) {
				anchor.setAttribute('href', value.href);
			}

			if (anchor && value.target) {
				anchor.setAttribute('target', value.target);
			}

			if (value.text !== undefined) {
				(anchor ?? element).innerHTML = value.text;
			}

			break;
		}
		case 'text':
		case 'date-time':
			if (value.text !== undefined) {
				element.textContent = value.text;
			}

			break;
		default:
			if (value.text !== undefined) {
				element.innerHTML = value.text;
			}

			if (value.href !== undefined) {
				const link = doc.createElement('a');

				link.setAttribute('href', value.href);

				if (value.target) {
					link.setAttribute('target', value.target);
				}

				link.innerHTML = element.innerHTML;
				element.innerHTML = '';
				element.appendChild(link);
			}
	}
}

/**
 * Wraps `index.js` the way Liferay does: the script runs with
 * `fragmentElement`, `configuration`, `fragmentNamespace` and `layoutMode`
 * in scope.
 */
export function wrapFragmentScript(js: string, namespace: string, configuration: Record<string, any>, layoutMode: 'view' | 'edit'): string {
	if (!js.trim()) {
		return '';
	}

	return `(function (fragmentElement, configuration, fragmentNamespace, layoutMode, fragmentEntryLinkNamespace) {
try {
${js}
}
catch (error) {
	window.__storybookReport && window.__storybookReport('index.js (' + fragmentNamespace + '): ' + (error && error.message ? error.message : error));
}
})(document.getElementById(${JSON.stringify(`fragment-${namespace}`)}), ${JSON.stringify(configuration)}, ${JSON.stringify(namespace)}, ${JSON.stringify(layoutMode)}, ${JSON.stringify(namespace)});`;
}
