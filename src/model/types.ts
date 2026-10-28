export interface Fragment {
	collectionKey: string;
	configuration: string;
	css: string;
	/** Markdown next to the fragment (`README.md`), shown in the Docs tab. Never exported. */
	docs?: string;
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
	collapsed?: boolean;
	source: 'builtin' | 'imported';
	theme?: string | null;
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
	/** The scheme the style book is designed for. Declared in `style-book.json` (`colorScheme`), or inferred from the body colour it sets. */
	colorScheme?: 'light' | 'dark' | null;
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

/** A Markdown page of the documentation (`docs/<slug>.md`). */
export interface DocPage {
	markdown: string;
	order: number;
	slug: string;
	source: 'builtin' | 'imported';
	title: string;
}

/** One exportable asset as recorded in a release manifest (`releases/<version>.json`). */
export interface ReleaseAsset {
	/** Per-file hashes (`index.html`, `index.css`, ...) so a change can be located. */
	files?: Record<string, string>;
	hash: string;
	key: string;
	name: string;
	/** The collection a fragment belongs to. */
	parent?: string;
	/** Repository path, for the history link. */
	path?: string;
	type: 'fragment-set' | 'fragment' | 'page-template' | 'style-book';
}

export interface ReleaseManifest {
	assets: ReleaseAsset[];
	commit?: string;
	date: string;
	/** Zips attached to the GitHub release, by file name. */
	downloads?: {file: string; name: string}[];
	/** Hand-written notes for the release, Markdown. */
	notes?: string;
	/** `owner/name` on GitHub, for links. */
	repository?: string;
	version: string;
}
