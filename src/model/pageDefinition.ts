import {escapeHTML} from '../freemarker';
import {allFields, defaultRawValue, parseConfiguration} from './configuration';
import {renderFragment, wrapFragmentScript} from './fragmentRenderer';

import type {EditableValue} from './fragmentRenderer';
import type {Collection, Fragment, PageElement, Theme} from './types';

/**
 * Renders a Liferay `page-definition.json` tree (the headless and site
 * initializer format) into the markup the layout renderer produces, so that
 * page templates look in the showroom the way they look in the portal.
 */

let counter = 0;

export function newId(prefix = 'item'): string {
	counter += 1;

	return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function createElement(type: PageElement['type'], definition: Record<string, any> = {}, children: PageElement[] = []): PageElement {
	return {definition, id: newId(type.toLowerCase()), pageElements: children, type};
}

export function createRow(numberOfColumns = 2): PageElement {
	const size = Math.floor(12 / numberOfColumns);

	const columns: PageElement[] = [];

	for (let i = 0; i < numberOfColumns; i++) {
		columns.push(createElement('Column', {size: i === numberOfColumns - 1 ? 12 - size * (numberOfColumns - 1) : size}));
	}

	return createElement(
		'Row',
		{
			gutters: true,
			indexed: true,
			modulesPerRow: numberOfColumns,
			numberOfColumns,
			reverseOrder: false,
			verticalAlignment: 'top',
		},
		columns
	);
}

export function createContainer(): PageElement {
	return createElement('Section', {indexed: true, layout: {widthType: 'Fixed'}});
}

export function createFragmentElement(fragment: Fragment): PageElement {
	const {configuration} = parseConfiguration(fragment.configuration);

	const fragmentConfig: Record<string, any> = {};

	for (const field of allFields(configuration)) {
		fragmentConfig[field.name] = defaultRawValue(field);
	}

	return createElement('Fragment', {
		fragment: {collectionKey: fragment.collectionKey, key: fragment.key},
		fragmentConfig,
		fragmentFields: [],
		indexed: true,
	});
}

/**
 * Assigns ids to an imported tree and normalizes the shapes the showroom
 * relies on.
 */
export function normalizeTree(element: any): PageElement {
	return {
		definition: element?.definition && typeof element.definition === 'object' ? {...element.definition} : {},
		id: newId(String(element?.type ?? 'item').toLowerCase()),
		pageElements: Array.isArray(element?.pageElements) ? element.pageElements.map(normalizeTree) : [],
		type: element?.type ?? 'Fragment',
	};
}

/**
 * Produces the exportable tree: ids are internal and `fragment.collectionKey`
 * is a showroom hint Liferay ignores, so both are stripped.
 */
export function exportTree(element: PageElement): any {
	const definition: Record<string, any> = {...element.definition};

	if (definition.fragment) {
		const {collectionKey, ...rest} = definition.fragment;

		definition.fragment = rest;
	}

	const exported: any = {type: element.type};

	if (Object.keys(definition).length) {
		exported.definition = definition;
	}

	if (element.pageElements.length) {
		exported.pageElements = element.pageElements.map(exportTree);
	}

	return exported;
}

export function findElement(root: PageElement, id: string): PageElement | null {
	if (root.id === id) {
		return root;
	}

	for (const child of root.pageElements) {
		const found = findElement(child, id);

		if (found) {
			return found;
		}
	}

	return null;
}

export function findParent(root: PageElement, id: string): PageElement | null {
	for (const child of root.pageElements) {
		if (child.id === id) {
			return root;
		}

		const found = findParent(child, id);

		if (found) {
			return found;
		}
	}

	return null;
}

export function updateTree(root: PageElement, id: string, updater: (element: PageElement) => PageElement): PageElement {
	if (root.id === id) {
		return updater(root);
	}

	return {...root, pageElements: root.pageElements.map((child) => updateTree(child, id, updater))};
}

export function removeFromTree(root: PageElement, id: string): PageElement {
	return {...root, pageElements: root.pageElements.filter((child) => child.id !== id).map((child) => removeFromTree(child, id))};
}

export function cloneSubtree(element: PageElement): PageElement {
	return {
		definition: JSON.parse(JSON.stringify(element.definition)),
		id: newId(element.type.toLowerCase()),
		pageElements: element.pageElements.map(cloneSubtree),
		type: element.type,
	};
}

export const CONTAINER_TYPES = new Set(['Root', 'Section', 'Container', 'Column', 'FragmentDropZone', 'DropZone', 'CollectionItem']);

export function acceptsChildren(element: PageElement): boolean {
	return CONTAINER_TYPES.has(element.type);
}

/* ------------------------------------------------------------------------ */
/* Styles                                                                    */
/* ------------------------------------------------------------------------ */

const STYLE_TEMPLATES: Record<string, string> = {
	backgroundColor: 'background-color: {value} !important;',
	borderColor: 'border-color: {value} !important;',
	borderRadius: 'border-radius: {value} !important;',
	borderWidth: 'border-style: solid; border-width: {value} !important;',
	display: 'display: {value} !important;',
	fontFamily: 'font-family: {value} !important;',
	fontSize: 'font-size: {value} !important;',
	fontWeight: 'font-weight: {value} !important;',
	height: 'height: {value} !important;',
	marginBottom: 'margin-bottom: {value} !important;',
	marginLeft: 'margin-left: {value} !important;',
	marginRight: 'margin-right: {value} !important;',
	marginTop: 'margin-top: {value} !important;',
	maxHeight: 'max-height: {value} !important;',
	maxWidth: 'max-width: {value} !important;',
	minHeight: 'min-height: {value} !important;',
	minWidth: 'min-width: {value} !important;',
	opacity: 'opacity: {value} !important;',
	overflow: 'overflow: {value} !important;',
	paddingBottom: 'padding-bottom: {value} !important;',
	paddingLeft: 'padding-left: {value} !important;',
	paddingRight: 'padding-right: {value} !important;',
	paddingTop: 'padding-top: {value} !important;',
	shadow: 'box-shadow: {value} !important;',
	textAlign: 'text-align: {value} !important;',
	textColor: 'color: {value} !important;',
	width: 'width: {value} !important;',
};

const SPACING_KEYS = new Set(['marginBottom', 'marginLeft', 'marginRight', 'marginTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingTop']);

const CLAY_COLORS = ['primary', 'secondary', 'success', 'info', 'warning', 'danger', 'light', 'dark', 'white', 'black'];

export function resolveStyleValue(key: string, value: any, theme: Theme | null): string | null {
	if (value === undefined || value === null || value === '' || (typeof value === 'object' && !Object.keys(value).length)) {
		return null;
	}

	if (key === 'backgroundImage' || key === 'backgroundFragmentImage') {
		const url = typeof value === 'object' ? value.url?.value ?? value.url ?? '' : String(value);

		return typeof url === 'string' && url ? `url("${url}")` : null;
	}

	const text = String(value).trim();

	if (key === 'opacity') {
		const number = Number(text);

		return Number.isNaN(number) ? text : number > 1 ? String(number / 100) : String(number);
	}

	if (key === 'borderWidth' && /^-?\d+(\.\d+)?$/.test(text)) {
		return `${text}px`;
	}

	if (SPACING_KEYS.has(key) && /^\d+$/.test(text)) {
		const tokenName = `spacer${text}`;

		if (theme?.tokens[tokenName]) {
			return `var(--${theme.tokens[tokenName].cssVariable})`;
		}

		return `var(--spacer-${text}, ${Number(text) * 0.25}rem)`;
	}

	if (key === 'shadow' && text === 'none') {
		return 'none';
	}

	if (theme?.tokens[text]) {
		return `var(--${theme.tokens[text].cssVariable})`;
	}

	if ((key === 'backgroundColor' || key === 'textColor' || key === 'borderColor') && CLAY_COLORS.includes(text)) {
		return `var(--${text})`;
	}

	return text;
}

function stylesCSS(selector: string, styles: Record<string, any>, theme: Theme | null): string {
	const declarations: string[] = [];

	for (const [key, raw] of Object.entries(styles)) {
		if (key === 'hidden') {
			if (raw === true) {
				declarations.push('display: none !important;');
			}

			continue;
		}

		const template = STYLE_TEMPLATES[key] ?? (key === 'backgroundImage' || key === 'backgroundFragmentImage' ? 'background-image: {value} !important; background-position: 50% 50%; background-repeat: no-repeat; background-size: cover;' : null);

		if (!template) {
			continue;
		}

		const value = resolveStyleValue(key, raw, theme);

		if (value === null) {
			continue;
		}

		declarations.push(template.split('{value}').join(value));
	}

	if (!declarations.length) {
		return '';
	}

	return `${selector} {\n\t${declarations.join('\n\t')}\n}\n`;
}

const VIEWPORT_QUERIES: Record<string, string> = {
	landscapeMobile: '(max-width: 767.98px)',
	portraitMobile: '(max-width: 575.98px)',
	tablet: '(max-width: 991.98px)',
};

function collectStyles(element: PageElement): Record<string, any> {
	const definition = element.definition;

	const styles: Record<string, any> = {};

	const layout = definition.layout ?? {};

	for (const key of Object.keys(STYLE_TEMPLATES)) {
		if (layout[key] !== undefined && layout[key] !== '') {
			styles[key] = layout[key];
		}
	}

	if (layout.backgroundImage) {
		styles.backgroundImage = layout.backgroundImage;
	}

	if (layout.backgroundColor) {
		styles.backgroundColor = layout.backgroundColor;
	}

	if (definition.backgroundColor) {
		styles.backgroundColor = definition.backgroundColor;
	}

	Object.assign(styles, definition.fragmentStyle ?? {});

	return styles;
}

/* ------------------------------------------------------------------------ */
/* Rendering                                                                 */
/* ------------------------------------------------------------------------ */

export interface PageRenderContext {
	collections: Collection[];
	imagesPath: string;
	layoutMode: 'view' | 'edit';
	theme: Theme | null;
}

export interface PageRenderResult {
	css: string;
	html: string;
	js: string;
	warnings: string[];
}

export function findFragment(collections: Collection[], reference: {collectionKey?: string; key?: string} | undefined): {collection: Collection; fragment: Fragment} | null {
	if (!reference?.key) {
		return null;
	}

	const candidates = [reference.key, reference.key.replace(/^BASIC_COMPONENT-/, ''), reference.key.toLowerCase()];

	for (const collection of collections) {
		if (reference.collectionKey && collection.key !== reference.collectionKey) {
			continue;
		}

		for (const fragment of collection.fragments) {
			if (candidates.includes(fragment.key)) {
				return {collection, fragment};
			}
		}
	}

	if (reference.collectionKey) {
		return findFragment(collections, {key: reference.key});
	}

	return null;
}

const cssClass = (classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

const ALIGN_CLASSES: Record<string, string> = {
	Baseline: 'align-items-baseline',
	Center: 'align-items-center',
	End: 'align-items-end',
	Start: 'align-items-start',
	Stretch: 'align-items-stretch',
	'align-items-baseline': 'align-items-baseline',
	'align-items-center': 'align-items-center',
	'align-items-end': 'align-items-end',
	'align-items-start': 'align-items-start',
	'align-items-stretch': 'align-items-stretch',
	middle: 'align-items-center',
};

const JUSTIFY_CLASSES: Record<string, string> = {
	Center: 'justify-content-center',
	End: 'justify-content-end',
	SpaceAround: 'justify-content-around',
	SpaceBetween: 'justify-content-between',
	Start: 'justify-content-start',
	'justify-content-around': 'justify-content-around',
	'justify-content-between': 'justify-content-between',
	'justify-content-center': 'justify-content-center',
	'justify-content-end': 'justify-content-end',
	'justify-content-start': 'justify-content-start',
};

const DISPLAY_CLASSES: Record<string, string> = {
	FlexColumn: 'd-flex flex-column',
	FlexRow: 'd-flex flex-row',
	'flex-column': 'd-flex flex-column',
	'flex-row': 'd-flex flex-row',
};

const WRAP_CLASSES: Record<string, string> = {
	NoWrap: 'flex-nowrap',
	Wrap: 'flex-wrap',
	WrapReverse: 'flex-wrap-reverse',
	'nowrap': 'flex-nowrap',
	'wrap': 'flex-wrap',
	'wrap-reverse': 'flex-wrap-reverse',
};

const VERTICAL_ALIGNMENT: Record<string, string> = {bottom: 'align-items-end', middle: 'align-items-center', top: 'align-items-start'};

export function renderPage(root: PageElement, context: PageRenderContext): PageRenderResult {
	const css: string[] = [];
	const js: string[] = [];
	const warnings: string[] = [];
	const renderedFragmentCSS = new Set<string>();

	const html = renderElement(root, {context, css, js, renderedFragmentCSS, warnings});

	return {css: css.join('\n'), html, js: js.join('\n'), warnings};
}

interface RenderState {
	context: PageRenderContext;
	css: string[];
	js: string[];
	renderedFragmentCSS: Set<string>;
	warnings: string[];
}

function itemClass(element: PageElement, kind: string): string {
	return `lfr-layout-structure-item-${kind} lfr-layout-structure-item-${element.id}`;
}

function emitItemStyles(element: PageElement, state: RenderState): void {
	const selector = `.lfr-layout-structure-item-${element.id}`;
	const styles = collectStyles(element);

	state.css.push(stylesCSS(selector, styles, state.context.theme));

	for (const viewport of element.definition.fragmentViewports ?? []) {
		const query = VIEWPORT_QUERIES[viewport.id];

		if (!query || !viewport.fragmentViewportStyle) {
			continue;
		}

		const rule = stylesCSS(selector, viewport.fragmentViewportStyle, state.context.theme);

		if (rule) {
			state.css.push(`@media ${query} {\n${rule}}\n`);
		}
	}

	if (element.definition.customCSS) {
		state.css.push(String(element.definition.customCSS).split('[$FRAGMENT_CLASS$]').join(`lfr-layout-structure-item-${element.id}`));
	}

	for (const viewport of element.definition.customCSSViewports ?? []) {
		const query = VIEWPORT_QUERIES[viewport.id];

		if (query && viewport.customCSS) {
			state.css.push(`@media ${query} {\n${String(viewport.customCSS).split('[$FRAGMENT_CLASS$]').join(`lfr-layout-structure-item-${element.id}`)}\n}\n`);
		}
	}
}

function dataAttributes(element: PageElement): string {
	return `data-item-id="${element.id}" data-item-type="${element.type}"`;
}

function renderChildren(element: PageElement, state: RenderState): string {
	return element.pageElements.map((child) => renderElement(child, state)).join('\n');
}

export function renderElement(element: PageElement, state: RenderState): string {
	const definition = element.definition;

	switch (element.type) {
		case 'Root':
			return `<div class="lfr-layout-structure-item-root" id="main-content" ${dataAttributes(element)}>${renderChildren(element, state)}</div>`;
		case 'Section':
		case 'Container': {
			emitItemStyles(element, state);

			const layout = definition.layout ?? {};
			const tag = String(definition.htmlProperties?.htmlTag ?? definition.htmlTag ?? 'div').toLowerCase();
			const widthType = String(layout.widthType ?? definition.widthType ?? 'Fluid').toLowerCase();

			const classes = cssClass([
				itemClass(element, 'container'),
				...(definition.cssClasses ?? []),
				definition.cssClass,
				widthType === 'fixed' && 'container-fluid container-fluid-max-xl',
				DISPLAY_CLASSES[layout.contentDisplay ?? definition.contentDisplay],
				ALIGN_CLASSES[layout.align ?? definition.align],
				JUSTIFY_CLASSES[layout.justify ?? definition.justify],
				WRAP_CLASSES[layout.flexWrap ?? definition.flexWrap],
			]);

			return `<${tag} class="${classes}" ${dataAttributes(element)}>${renderChildren(element, state)}</${tag}>`;
		}
		case 'Row': {
			emitItemStyles(element, state);

			const gutters = definition.gutters !== false;
			const classes = cssClass([itemClass(element, 'row'), ...(definition.cssClasses ?? [])]);
			const rowClasses = cssClass(['row', !gutters && 'no-gutters', VERTICAL_ALIGNMENT[definition.verticalAlignment ?? 'top'], definition.reverseOrder && 'flex-row-reverse']);

			return `<div class="${classes}" ${dataAttributes(element)}><div class="${rowClasses}">${renderChildren(element, state)}</div></div>`;
		}
		case 'Column': {
			emitItemStyles(element, state);

			const size = Number(definition.size ?? 12) || 12;
			const viewports: Record<string, number> = {};

			for (const viewport of definition.columnViewports ?? []) {
				const viewportSize = Number(viewport.columnViewportDefinition?.size);

				if (viewportSize) {
					viewports[viewport.id] = viewportSize;
				}
			}

			const classes = cssClass([
				itemClass(element, 'column'),
				'col',
				`col-lg-${size}`,
				`col-md-${viewports.tablet ?? size}`,
				`col-sm-${viewports.landscapeMobile ?? 12}`,
				`col-${viewports.portraitMobile ?? 12}`,
			]);

			return `<div class="${classes}" ${dataAttributes(element)}>${renderChildren(element, state)}</div>`;
		}
		case 'Fragment':
			return renderFragmentElement(element, state);
		case 'FragmentDropZone':
			return renderChildren(element, state);
		case 'DropZone':
			return `<div class="${itemClass(element, 'drop-zone')} showroom-placeholder" ${dataAttributes(element)}><span class="showroom-placeholder__label">Drop zone (master page content)</span>${renderChildren(element, state)}</div>`;
		case 'Widget':
			return `<div class="${itemClass(element, 'widget')} showroom-placeholder" ${dataAttributes(element)}><span class="showroom-placeholder__label">Widget ${escapeHTML(String(definition.widgetInstance?.widgetName ?? ''))} needs Liferay</span></div>`;
		case 'Collection':
			emitItemStyles(element, state);

			return `<div class="${itemClass(element, 'collection')} showroom-placeholder" ${dataAttributes(element)}><span class="showroom-placeholder__label">Collection display needs Liferay data</span>${renderChildren(element, state)}</div>`;
		case 'Form':
			emitItemStyles(element, state);

			return `<div class="${itemClass(element, 'form')} showroom-placeholder" ${dataAttributes(element)}><span class="showroom-placeholder__label">Form container needs Liferay objects</span>${renderChildren(element, state)}</div>`;
		default:
			state.warnings.push(`Page element type "${element.type}" is not supported and was skipped`);

			return '';
	}
}

/**
 * Converts the `fragmentFields` of a page definition into normalized editable
 * values.
 */
export function editableValuesFromFields(fields: any[] | undefined): Record<string, EditableValue> {
	const values: Record<string, EditableValue> = {};

	for (const field of fields ?? []) {
		if (!field?.id || !field.value) {
			continue;
		}

		const value: EditableValue = {};
		const {value: raw} = field;

		const localized = (object: any): string | undefined => {
			if (!object || typeof object !== 'object') {
				return typeof object === 'string' ? object : undefined;
			}

			if (object.value_i18n) {
				return object.value_i18n.en_US ?? Object.values<string>(object.value_i18n)[0];
			}

			if (typeof object.value === 'string') {
				return object.value;
			}

			return undefined;
		};

		if (raw.text !== undefined) {
			value.text = localized(raw.text);
		}

		if (raw.html !== undefined) {
			value.text = localized(raw.html);
		}

		if (raw.fragmentImage) {
			value.src = localized(raw.fragmentImage.url);
			value.alt = localized(raw.fragmentImage.description);
		}

		if (raw.backgroundFragmentImage) {
			value.src = localized(raw.backgroundFragmentImage.url);
		}

		if (raw.fragmentLink) {
			const link = raw.fragmentLink.value ?? raw.fragmentLink;

			value.href = localized(link.href);

			if (link.target) {
				value.target = String(link.target).toLowerCase() === 'blank' ? '_blank' : String(link.target);
			}

			if (link.text !== undefined && value.text === undefined) {
				value.text = localized(link.text);
			}
		}

		if (raw.date !== undefined) {
			value.text = localized(raw.date);
		}

		if (Object.values(value).some((v) => v !== undefined)) {
			values[field.id] = value;
		}
	}

	return values;
}

export function fieldsFromEditableValues(values: Record<string, EditableValue>, types: Record<string, string>): any[] {
	const fields: any[] = [];

	for (const [id, value] of Object.entries(values)) {
		const type = types[id] ?? 'text';
		const raw: Record<string, any> = {};

		if (type === 'image' || type === 'background-image') {
			if (value.src) {
				const key = type === 'image' ? 'fragmentImage' : 'backgroundFragmentImage';

				raw[key] = {url: {value: value.src}};

				if (value.alt && type === 'image') {
					raw[key].description = {value_i18n: {en_US: value.alt}};
				}
			}
		}
		else if (type === 'html' || type === 'rich-text') {
			if (value.text !== undefined) {
				raw.html = {value_i18n: {en_US: value.text}};
			}
		}
		else if (value.text !== undefined) {
			raw.text = {value_i18n: {en_US: value.text}};
		}

		if (value.href !== undefined && value.href !== '') {
			raw.fragmentLink = {value: {href: {value_i18n: {en_US: value.href}}, ...(value.target === '_blank' ? {target: 'Blank'} : {})}};
		}

		if (Object.keys(raw).length) {
			fields.push({id, value: raw});
		}
	}

	return fields;
}

function renderFragmentElement(element: PageElement, state: RenderState): string {
	const {context} = state;
	const definition = element.definition;

	emitItemStyles(element, state);

	const found = findFragment(context.collections, definition.fragment);

	const classes = cssClass([itemClass(element, 'fragment'), found && `lfr-layout-structure-item-${found.fragment.key.toLowerCase()}`, ...(definition.cssClasses ?? [])]);

	if (!found) {
		state.warnings.push(`Fragment "${definition.fragment?.key ?? '?'}" is not in any loaded collection`);

		return `<div class="${classes} showroom-placeholder" ${dataAttributes(element)}><span class="showroom-placeholder__label">Fragment ${escapeHTML(String(definition.fragment?.key ?? '?'))} is not loaded</span></div>`;
	}

	const namespace = element.id.replace(/[^a-zA-Z0-9]/g, '');

	const dropZones: Record<string, string> = {};

	for (const child of element.pageElements) {
		if (child.type === 'FragmentDropZone') {
			const id = String(child.definition.fragmentDropZoneId ?? Object.keys(dropZones).length + 1);

			dropZones[id] = renderChildren(child, state);
		}
	}

	const {configuration} = parseConfiguration(found.fragment.configuration);
	const raw: Record<string, any> = {};

	for (const field of allFields(configuration)) {
		raw[field.name] = definition.fragmentConfig?.[field.name] ?? defaultRawValue(field);
	}

	const result = renderFragment(found.fragment, {
		collection: found.collection,
		configuration: raw,
		dropZones,
		editables: editableValuesFromFields(definition.fragmentFields),
		imagesPath: context.imagesPath,
		layoutMode: context.layoutMode,
		namespace,
		theme: context.theme,
	});

	state.warnings.push(...result.warnings.map((warning) => `${found.fragment.name}: ${warning}`));

	if (!state.renderedFragmentCSS.has(found.fragment.key) && result.css.trim()) {
		state.renderedFragmentCSS.add(found.fragment.key);
		state.css.push(result.css);
	}

	const script = wrapFragmentScript(result.js, namespace, raw, context.layoutMode);

	if (script) {
		state.js.push(script);
	}

	return `<div class="${classes}" id="fragment-${namespace}" ${dataAttributes(element)}>${result.html}</div>`;
}
