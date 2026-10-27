export interface Fragment {
	collectionKey: string;
	configuration: string;
	css: string;
	html: string;
	icon: string;
	js: string;
	key: string;
	name: string;
	thumbnail: string;
	type: string;
}

export interface Collection {
	description: string;
	fragments: Fragment[];
	key: string;
	name: string;
	resources: Record<string, string>;
	source: 'builtin' | 'imported';
}

export interface FrontendToken {
	cssVariable: string;
	defaultValue: string;
	editorType: 'ColorPicker' | 'Length' | 'Text' | 'Select';
	label: string;
	name: string;
	validValues?: {label: string; value: string}[];
}

export interface FrontendTokenSet {
	label: string;
	name: string;
	tokens: FrontendToken[];
}

export interface FrontendTokenCategory {
	label: string;
	name: string;
	sets: FrontendTokenSet[];
}

export interface Theme {
	categories: FrontendTokenCategory[];
	css: string[];
	description: string;
	imagesPath: string;
	key: string;
	name: string;
	source: 'builtin' | 'imported';
	tokens: Record<string, FrontendToken>;
}

export interface StyleBook {
	key: string;
	name: string;
	source: 'builtin' | 'imported';
	themeKey: string | null;
	values: Record<string, string>;
}

export type EditableValue = string | Record<string, any>;

export interface PageElement {
	definition: Record<string, any>;
	id: string;
	pageElements: PageElement[];
	type: 'Root' | 'Section' | 'Container' | 'Row' | 'Column' | 'Fragment' | 'FragmentDropZone' | 'DropZone' | 'Widget' | 'Collection' | 'CollectionItem' | 'Form' | string;
}

export interface PageTemplate {
	id: string;
	name: string;
	root: PageElement;
	source: 'builtin' | 'imported' | 'created';
}

export type ViewportId = 'desktop' | 'tablet' | 'landscapeMobile' | 'portraitMobile';

export interface Viewport {
	id: ViewportId;
	label: string;
	width: number | null;
}

export const VIEWPORTS: Viewport[] = [
	{id: 'desktop', label: 'Desktop', width: null},
	{id: 'tablet', label: 'Tablet', width: 768},
	{id: 'landscapeMobile', label: 'Landscape phone', width: 576},
	{id: 'portraitMobile', label: 'Portrait phone', width: 375},
];
