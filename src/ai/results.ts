import {allFields, defaultRawValue, parseConfiguration} from '../model/configuration';
import {renderFragment} from '../model/fragmentRenderer';
import {normalizeTree} from '../model/pageDefinition';

import type {Collection, Fragment, PageElement, PageTemplate, StyleBook} from '../model/types';
import type {AIContext} from './actions';
import type {AIActionId, AIImprovement, AIResult} from './types';

/**
 * Turns a model's answer into showroom assets. An answer is never trusted
 * as it arrives: every field is checked, what does not fit is dropped with
 * a warning, and what is kept goes in as a draft for a person to review.
 */

/** The collection AI drafts are kept in, an imported one like any other. */
export const DRAFTS_KEY = 'ai-drafts';

export const DRAFTS_NAME = 'AI drafts';

export function slug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function string(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function strings(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim()) : [];
}

function uniqueKey(key: string, taken: Set<string>): string {
	let candidate = key;

	for (let index = 2; taken.has(candidate); index++) {
		candidate = `${key}-${index}`;
	}

	taken.add(candidate);

	return candidate;
}

/** The warnings a fragment raises when the showroom renders it with its defaults. */
export function checkFragment(fragment: Fragment, context: AIContext): string[] {
	const warnings: string[] = [];
	const {configuration, error} = parseConfiguration(fragment.configuration);

	if (error) {
		warnings.push(`${fragment.name}: ${error}`);
	}

	const raw: Record<string, unknown> = {};

	for (const field of allFields(configuration)) {
		raw[field.name] = defaultRawValue(field);
	}

	try {
		const rendered = renderFragment(fragment, {collection: null, configuration: raw, editables: {}, imagesPath: context.theme?.imagesPath ?? '', namespace: 'ai', theme: context.theme});

		warnings.push(...rendered.warnings.map((warning) => `${fragment.name}: ${warning}`));
	}
	catch (failure) {
		warnings.push(`${fragment.name}: does not render (${(failure as Error).message})`);
	}

	if (/\b(?:src|href)=["']https?:\/\//i.test(fragment.html) || /@import\s|url\(\s*["']?https?:/i.test(fragment.css)) {
		warnings.push(`${fragment.name}: loads something from another site.`);
	}

	/* A draft's script runs in the preview as soon as it is shown: say so when it looks beyond its own element */
	if (/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|importScripts|localStorage|sessionStorage|indexedDB)\b|document\.cookie|\b(?:parent|top|opener)\s*\.|\bimport\s*\(|\beval\s*\(|new\s+Function\b/.test(fragment.js)) {
		warnings.push(`${fragment.name}: its script reaches beyond the fragment (network, storage or the page around it). Read index.js before keeping it.`);
	}

	return warnings;
}

function readFragments(value: unknown, taken: Set<string>, warnings: string[], context: AIContext): {fragments: Fragment[]; renamed: Map<string, string>} {
	const fragments: Fragment[] = [];
	const renamed = new Map<string, string>();

	for (const item of Array.isArray(value) ? value : []) {
		if (!item || typeof item !== 'object' || !string((item as any).html).trim()) {
			warnings.push('A fragment came back without markup and was left out.');

			continue;
		}

		const raw = item as Record<string, unknown>;
		const name = string(raw.name).trim() || 'Untitled fragment';
		const wanted = slug(string(raw.key) || name) || 'fragment';
		const key = uniqueKey(wanted, taken);

		renamed.set(string(raw.key) || wanted, key);
		renamed.set(wanted, key);

		const fragment: Fragment = {
			collectionKey: DRAFTS_KEY,
			configuration: string(raw.configuration).trim() || '{"fieldSets": []}',
			css: string(raw.css),
			...(string(raw.docs).trim() ? {docs: string(raw.docs)} : {}),
			html: string(raw.html),
			icon: 'stars',
			js: string(raw.js),
			key,
			name,
			thumbnail: '',
			type: 'component',
		};

		warnings.push(...checkFragment(fragment, context));
		fragments.push(fragment);
	}

	return {fragments, renamed};
}

function countFragments(element: PageElement): number {
	return (element.type === 'Fragment' ? 1 : 0) + element.pageElements.reduce((total, child) => total + countFragments(child), 0);
}

function readTemplate(text: string, name: string, drafts: Fragment[], renamed: Map<string, string>, context: AIContext, warnings: string[]): PageTemplate | null {
	if (!text.trim()) {
		return null;
	}

	let json: any;

	try {
		json = JSON.parse(text);
	}
	catch (error) {
		warnings.push(`The page definition is not valid JSON (${(error as Error).message}) and was left out.`);

		return null;
	}

	const pageElement = json?.pageElement ?? (json?.type === 'Root' ? json : null);

	if (!pageElement || typeof pageElement !== 'object') {
		warnings.push('The page definition has no "pageElement" and was left out.');

		return null;
	}

	/* Point every fragment at the collection that has it: a draft of this answer, or one in the catalog */
	const resolve = (element: any) => {
		if (element?.type === 'Fragment') {
			const reference = (element.definition ??= {}).fragment ?? {};
			const key = string(reference.key);
			const draft = drafts.find((fragment) => fragment.key === (renamed.get(key) ?? key));

			if (draft && (reference.collectionKey === DRAFTS_KEY || !reference.collectionKey || !inCatalog(context.collections, reference))) {
				element.definition.fragment = {collectionKey: DRAFTS_KEY, key: draft.key};
			}
			else {
				const collection = context.collections.find((candidate) => (!reference.collectionKey || candidate.key === reference.collectionKey) && candidate.fragments.some((fragment) => fragment.key === key)) ?? context.collections.find((candidate) => candidate.fragments.some((fragment) => fragment.key === key));

				if (collection) {
					element.definition.fragment = {collectionKey: collection.key, key};
				}
				else {
					warnings.push(`The page uses a fragment that does not exist: ${key || '(no key)'}.`);
				}
			}
		}

		for (const child of Array.isArray(element?.pageElements) ? element.pageElements : []) {
			resolve(child);
		}
	};

	resolve(pageElement);

	const root = normalizeTree(pageElement);

	if (!countFragments(root)) {
		warnings.push('The page definition places no fragments and was left out.');

		return null;
	}

	return {id: `template-${slug(name) || 'ai-draft'}-${Math.random().toString(36).slice(2, 7)}`, name, root, source: 'imported'};
}

function inCatalog(collections: Collection[], reference: {collectionKey?: string; key?: string}): boolean {
	return collections.some((collection) => collection.key === reference.collectionKey && collection.fragments.some((fragment) => fragment.key === reference.key));
}

function readStyleBook(value: unknown, name: string, context: AIContext, warnings: string[]): StyleBook | null {
	const {theme} = context;
	const values: Record<string, string> = {};
	const unknown: string[] = [];

	for (const item of Array.isArray(value) ? value : []) {
		const token = string((item as any)?.name).trim();
		const tokenValue = string((item as any)?.value).trim();

		if (!token || !tokenValue) {
			continue;
		}

		/* A value is CSS that ends up in a declaration: nothing that could close it or open a rule */
		if (/[;{}<>]/.test(tokenValue)) {
			warnings.push(`The value of ${token} is not a plain CSS value and was left out.`);

			continue;
		}

		if (theme && !theme.tokens[token]) {
			unknown.push(token);

			continue;
		}

		values[token] = tokenValue;
	}

	if (unknown.length) {
		warnings.push(`${unknown.length} value(s) were for tokens the theme does not have and were left out: ${unknown.slice(0, 6).join(', ')}${unknown.length > 6 ? '…' : ''}.`);
	}

	if (!Object.keys(values).length) {
		return null;
	}

	return {key: `style-book-${slug(name) || 'ai-draft'}-${Math.random().toString(36).slice(2, 7)}`, name, source: 'imported', themeKey: theme?.key ?? null, values};
}

/** What a design or a website became. `raw` is the provider's answer, whatever it is. */
export function readResult(action: AIActionId, raw: unknown, context: AIContext): AIResult {
	const answer = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const warnings: string[] = [];
	const taken = new Set(context.collections.find((collection) => collection.key === DRAFTS_KEY)?.fragments.map((fragment) => fragment.key) ?? []);
	const {fragments, renamed} = readFragments(answer.fragments, taken, warnings, context);
	const name = string(answer.name).trim();

	const template = action === 'fragment-from-design' ? null : readTemplate(string(answer.pageDefinition), name || 'AI draft page', fragments, renamed, context, warnings);
	const styleBook = action === 'design-system-from-website' ? readStyleBook(answer.tokens, name || 'AI draft', context, warnings) : null;

	if (!fragments.length && !template && !styleBook) {
		warnings.push('Nothing usable came back.');
	}

	return {fragments, notes: strings(answer.notes), styleBook, template, warnings};
}

/** A fragment as the model reworked it. Files it did not return stay as they were. */
export function readImprovement(action: AIActionId, raw: unknown, original: Fragment, context: AIContext): AIImprovement {
	const answer = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const keep = (value: unknown, current: string) => (typeof value === 'string' && value.trim() ? value : current);

	const fragment: Fragment =
		action === 'write-docs'
			? {...original, docs: keep(answer.docs, original.docs ?? '')}
			: {...original, configuration: keep(answer.configuration, original.configuration), css: keep(answer.css, original.css), html: keep(answer.html, original.html), js: typeof answer.js === 'string' ? answer.js : original.js};

	const changes = (Array.isArray(answer.changes) ? answer.changes : [])
		.map((change) => ({detail: string((change as any)?.detail).trim(), title: string((change as any)?.title).trim()}))
		.filter((change) => change.title || change.detail);

	const before = checkFragment(original, context);
	const warnings = action === 'write-docs' ? [] : checkFragment(fragment, context).filter((warning) => !before.includes(warning));

	return {changes, fragment, warnings};
}

/** The files of a fragment that differ between two versions of it. */
export function changedFiles(before: Fragment, after: Fragment): {after: string; before: string; name: string}[] {
	const files: [string, string, string][] = [
		['index.html', before.html, after.html],
		['index.css', before.css, after.css],
		['index.js', before.js, after.js],
		['configuration.json', before.configuration, after.configuration],
		['README.md', before.docs ?? '', after.docs ?? ''],
	];

	return files.filter(([, from, to]) => from.trim() !== to.trim()).map(([name, from, to]) => ({after: to, before: from, name}));
}
