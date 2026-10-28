import {describe, expect, it} from 'vitest';

import {markdownToText, parseFrontmatter, parseMarkdown, parseSpecOptions, rewriteLink} from './markdown';

describe('documentation markdown', () => {
	it('splits embeds out of the prose', () => {
		const {segments, title} = parseMarkdown('# Button\n\nIntro.\n\n```fragment\nkey: lsds-button\nvariant: outline\n```\n\nAfter.\n\n```js\nconsole.log(1);\n```\n');

		expect(title).toBe('Button');
		expect(segments.map((segment) => segment.type)).toEqual(['html', 'embed', 'html']);
		expect(segments[1]).toEqual({spec: {kind: 'fragment', options: {key: 'lsds-button', variant: 'outline'}}, type: 'embed'});
		expect((segments[0] as {html: string}).html).toContain('<h1>Button</h1>');
		expect((segments[2] as {html: string}).html).toContain('<code class="language-js">');
	});

	it('reads the frontmatter', () => {
		const {body, frontmatter} = parseFrontmatter('---\ntitle: Getting started\norder: 1\n---\n# Hello\n');

		expect(frontmatter).toEqual({order: '1', title: 'Getting started'});
		expect(body).toBe('# Hello\n');
		expect(parseMarkdown('---\ntitle: From frontmatter\n---\n# Heading\n').title).toBe('From frontmatter');
	});

	it('rewrites links to pages and assets', () => {
		expect(rewriteLink('tokens.md')).toBe('?path=/docs/tokens');
		expect(rewriteLink('./page-composition.md#agents')).toBe('?path=/docs/page-composition#agents');
		expect(rewriteLink('fragment:liferay-sites-ds/lsds-button')).toBe('?path=/fragment/liferay-sites-ds/lsds-button');
		expect(rewriteLink('template:builtin-lsds-home')).toBe('?path=/template/builtin-lsds-home');
		expect(rewriteLink('https://liferay.com/')).toBe('https://liferay.com/');
		expect(rewriteLink('#section')).toBe('#section');

		const {segments} = parseMarkdown('See [the card](fragment:liferay-sites-ds/lsds-card).');

		expect((segments[0] as {html: string}).html).toContain('href="?path=/fragment/liferay-sites-ds/lsds-card"');
	});

	it('runs the sanitizer over every prose chunk', () => {
		const {segments} = parseMarkdown('a\n\n```tokens\nset: sdsBrand\n```\n\nb', {sanitize: (html) => `<!--clean-->${html}`});

		expect(segments.filter((segment) => segment.type === 'html').every((segment) => (segment as {html: string}).html.startsWith('<!--clean-->'))).toBe(true);
	});

	it('parses spec options and flattens to text', () => {
		expect(parseSpecOptions('key: x\n# comment\nflag\n editable.text-1: Hello: world ')).toEqual({'editable.text-1': 'Hello: world', flag: 'true', key: 'x'});
		expect(markdownToText('---\ntitle: T\n---\n# Title\n\nSome **bold** [link](x.md).\n\n```fragment\nkey: y\n```\n')).toBe('Title Some bold link.');
	});
});
