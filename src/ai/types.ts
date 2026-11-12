import type {Fragment, FrontendToken, PageTemplate, StyleBook} from '../model/types';

/**
 * The AI features of the showroom: what each one asks a model for and what
 * comes back. Nothing here knows which model answers. A provider does, and
 * the showroom ships none: the link to Liferay AI Hub is left open, so the
 * features are ready for whichever provider is registered (see `provider.ts`).
 */

export type AIActionId = 'fragment-from-design' | 'template-from-design' | 'style-book-from-website' | 'design-system-from-website' | 'tokenize-fragment' | 'review-accessibility' | 'write-docs';

/** An image a request carries: a screenshot, a mockup or an exported frame. */
export interface AIImage {
	/** Base64, without the `data:` prefix. */
	data: string;
	mediaType: string;
	name: string;
}

/**
 * What a provider receives. `system` and `prompt` are ready to send to a
 * model as they are; `data` carries the same context as structured values,
 * for a provider that builds its own prompt or runs an agent of its own.
 */
export interface AIRequest {
	action: AIActionId;
	data: Record<string, unknown>;
	images: AIImage[];
	prompt: string;

	/** JSON Schema of the answer the showroom can read. */
	schema: Record<string, unknown>;
	system: string;

	/** A page to read: a website or a Figma link. The provider fetches it; the browser cannot. */
	url?: string;
}

export interface AIRunOptions {
	/** A line on what the model is doing, for the person waiting. */
	onProgress?: (message: string) => void;
	signal?: AbortSignal;
}

/** Runs a request on a model and returns the answer as JSON matching `request.schema`. */
export interface AIProvider {
	id: string;
	name: string;

	/** Shown next to the results, when the provider has something to say about them (a demo, a preview). */
	notice?: string;
	run(request: AIRequest, options?: AIRunOptions): Promise<unknown>;
}

/** What a design or a website became: drafts for the person to review, never published as they arrive. */
export interface AIResult {
	fragments: Fragment[];

	/** What the model says it did, assumed or left out. */
	notes: string[];
	styleBook: StyleBook | null;
	template: PageTemplate | null;

	/** What the showroom's own checks found in the answer. */
	warnings: string[];
}

/**
 * The colours proposed for a style book, each for the person to accept or
 * not: values for tokens the theme has, and colours no token covers, which
 * the style book would add as tokens of its own.
 */
export interface StyleBookProposal {
	customColors: {label: string; source: string; suggested: boolean; value: string}[];
	mappings: {current: string; source: string; token: FrontendToken; value: string}[];
	name: string;
	notes: string[];
	warnings: string[];
}

/** A fragment the model reworked, with what it changed and why. */
export interface AIImprovement {
	changes: {detail: string; title: string}[];
	fragment: Fragment;
	warnings: string[];
}
