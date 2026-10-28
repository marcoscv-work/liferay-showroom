import {marked} from 'marked';

import type {Token, Tokens} from 'marked';

/**
 * Documentation Markdown. Plain Markdown, plus three fenced blocks that embed
 * the live system instead of a picture of it:
 *
 * ```fragment
 * key: lsds-button
 * variant: outline
 * ```
 *
 * ```tokens
 * category: colors
 * ```
 *
 * ```template
 * id: builtin-lsds-home
 * ```
 *
 * Every other block is rendered to HTML. Links to `other-page.md` become
 * `?path=/docs/other-page`; `fragment:<collection>/<key>` and
 * `template:<id>` link to the asset. The caller sanitizes the HTML.
 */

export type EmbedKind = 'fragment' | 'template' | 'tokens';

export const EMBED_KINDS: EmbedKind[] = ['fragment', 'template', 'tokens'];

export interface EmbedSpec {
	kind: EmbedKind;
	options: Record<string, string>;
}

export type Segment = {type: 'html'; html: string} | {type: 'embed'; spec: EmbedSpec};

export interface ParsedMarkdown {
	frontmatter: Record<string, string>;
	segments: Segment[];
	/** The first level-one heading, or the frontmatter title. */
	title: string;
}

export interface ParseOptions {
	/** Sanitizes a chunk of rendered HTML. Defaults to the identity; the app passes DOMPurify. */
	sanitize?: (html: string) => string;
}

/** `key: value` lines, as inside an embed block. */
export function parseSpecOptions(text: string): Record<string, string> {
	const options: Record<string, string> = {};

	for (const line of text.split('\n')) {
		const trimmed = line.trim();

		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}

		const colon = trimmed.indexOf(':');

		if (colon === -1) {
			options[trimmed] = 'true';

			continue;
		}

		options[trimmed.slice(0, colon).trim()] = trimmed.slice(colon + 1).trim();
	}

	return options;
}

export function parseFrontmatter(markdown: string): {body: string; frontmatter: Record<string, string>} {
	const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

	if (!match) {
		return {body: markdown, frontmatter: {}};
	}

	return {body: markdown.slice(match[0].length), frontmatter: parseSpecOptions(match[1])};
}

export function rewriteLink(href: string): string {
	if (/^(https?:|mailto:|tel:|#|\?path=)/i.test(href)) {
		return href;
	}

	const fragment = href.match(/^fragment:([^/]+)\/(.+)$/);

	if (fragment) {
		return `?path=/fragment/${encodeURIComponent(fragment[1])}/${encodeURIComponent(fragment[2])}`;
	}

	const template = href.match(/^template:(.+)$/);

	if (template) {
		return `?path=/template/${encodeURIComponent(template[1])}`;
	}

	if (href === 'releases:') {
		return '?path=/releases';
	}

	const doc = href.match(/^(?:\.\/)?([a-z0-9][a-z0-9/_-]*)\.md(#.*)?$/i);

	if (doc) {
		return `?path=/docs/${doc[1].replace(/^docs\//, '')}${doc[2] ?? ''}`;
	}

	return href;
}

export function parseMarkdown(markdown: string, {sanitize = (html) => html}: ParseOptions = {}): ParsedMarkdown {
	const {body, frontmatter} = parseFrontmatter(markdown);

	const tokens = marked.lexer(body, {gfm: true});

	marked.walkTokens(tokens, (token) => {
		if (token.type === 'link') {
			(token as Tokens.Link).href = rewriteLink((token as Tokens.Link).href);
		}
	});

	const segments: Segment[] = [];

	let pending: Token[] = [];
	let title = frontmatter.title ?? '';

	const flush = () => {
		if (!pending.length) {
			return;
		}

		const html = marked.parser(pending, {gfm: true});

		segments.push({html: sanitize(html), type: 'html'});

		pending = [];
	};

	for (const token of tokens) {
		if (token.type === 'heading' && (token as Tokens.Heading).depth === 1 && !title) {
			title = (token as Tokens.Heading).text;
		}

		if (token.type === 'code' && EMBED_KINDS.includes(((token as Tokens.Code).lang ?? '').trim() as EmbedKind)) {
			flush();

			segments.push({spec: {kind: (token as Tokens.Code).lang!.trim() as EmbedKind, options: parseSpecOptions((token as Tokens.Code).text)}, type: 'embed'});

			continue;
		}

		pending.push(token);
	}

	flush();

	return {frontmatter, segments, title};
}

/** The plain text of a Markdown document, for search and the AI catalog. */
export function markdownToText(markdown: string): string {
	const {body} = parseFrontmatter(markdown);

	return body
		.replace(/```[a-z]*\n[\s\S]*?```/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[#>*_`~]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}
