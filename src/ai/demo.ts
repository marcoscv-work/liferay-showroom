import type {Fragment} from '../model/types';
import type {TokenInfo} from './actions';
import type {AIProvider, AIRequest, AIRunOptions} from './types';

/**
 * A stand-in provider for showing and testing the AI features without a
 * model: `?ai=demo` in the address registers it. Its answers are written
 * here, the same whatever the design, apart from the three that rework a
 * fragment, which do a mechanical version of the real job. It says so in
 * every result.
 */

const PLACEHOLDER = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='420' viewBox='0 0 640 420'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23c9b8ff'/%3E%3Cstop offset='1' stop-color='%237414ff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='640' height='420' rx='16' fill='url(%23g)'/%3E%3Ccircle cx='170' cy='140' r='64' fill='%23fff' opacity='.7'/%3E%3C/svg%3E";

const HIGHLIGHT = {
	configuration: JSON.stringify(
		{
			fieldSets: [
				{
					fields: [
						{
							defaultValue: 'start',
							description: 'Which side the image sits on.',
							label: 'Image position',
							name: 'imagePosition',
							type: 'select',
							typeOptions: {
								validValues: [
									{label: 'Start', value: 'start'},
									{label: 'End', value: 'end'},
								],
							},
						},
					],
					label: 'Layout',
				},
			],
		},
		null,
		'\t'
	),
	css: `.demo-highlight {
	align-items: center;
	display: grid;
	gap: 2rem;
	grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
}

.demo-highlight[data-image-position="end"] .demo-highlight__media {
	order: 2;
}

.demo-highlight__media img {
	border-radius: var(--border-radius-lg, 0.5rem);
	display: block;
	height: auto;
	max-width: 100%;
}

.demo-highlight__eyebrow {
	color: var(--primary, #0b5fff);
	font-size: 0.875rem;
	font-weight: 600;
	letter-spacing: 0.04em;
	margin: 0 0 0.5rem;
	text-transform: uppercase;
}

.demo-highlight__title {
	color: var(--body-color, #272833);
	margin: 0 0 0.75rem;
}

.demo-highlight__text {
	color: var(--secondary, #6b6c7e);
	margin: 0 0 1.25rem;
}

.demo-highlight__link:focus-visible {
	outline: 2px solid var(--primary, #0b5fff);
	outline-offset: 2px;
}
`,
	docs: `# Feature highlight

A picture next to a short message with one link. Use it to introduce a single feature or a section of the site.

## When to use it

- One idea that deserves an image and a call to action.
- Alternating down a page, with the image position switched on every other one.

## When not to

- A list of features: use cards in a row.
- The top of the page: use a hero.

## Accessibility

The image is an editable: give it alternative text when it says something the text does not, and leave it empty when it is decoration.
`,
	html: `<div class="demo-highlight" data-image-position="\${configuration.imagePosition}">
	<div class="demo-highlight__media">
		<img alt="" data-lfr-editable-id="image" data-lfr-editable-type="image" src="${PLACEHOLDER}" />
	</div>
	<div class="demo-highlight__body">
		<p class="demo-highlight__eyebrow" data-lfr-editable-id="eyebrow" data-lfr-editable-type="text">New</p>
		<h2 class="demo-highlight__title" data-lfr-editable-id="title" data-lfr-editable-type="text">Publish a design system people can read</h2>
		<p class="demo-highlight__text" data-lfr-editable-id="description" data-lfr-editable-type="rich-text">Fragments, page templates and style books, shown live and documented next to the code that makes them.</p>
		<a class="btn btn-primary demo-highlight__link" data-lfr-editable-id="primary-link" data-lfr-editable-type="link" href="#">See how it works</a>
	</div>
</div>
`,
	js: '',
	key: 'feature-highlight',
	name: 'Feature highlight',
};

const QUOTE = {
	configuration: '{"fieldSets": []}',
	css: `.demo-quote {
	border-inline-start: 4px solid var(--primary, #0b5fff);
	margin: 0;
	padding: 0.5rem 0 0.5rem 1.25rem;
}

.demo-quote__text {
	color: var(--body-color, #272833);
	font-size: 1.25rem;
	margin: 0 0 0.75rem;
}

.demo-quote__author {
	color: var(--secondary, #6b6c7e);
	font-size: 0.875rem;
	font-style: normal;
}
`,
	docs: '# Quote\n\nA sentence someone said, with who said it. Keep it to one or two lines.\n',
	html: `<figure class="demo-quote">
	<blockquote class="demo-quote__text" data-lfr-editable-id="quote" data-lfr-editable-type="rich-text">It took an afternoon to document what we had been explaining in meetings for a year.</blockquote>
	<figcaption class="demo-quote__author" data-lfr-editable-id="author" data-lfr-editable-type="text">Design lead, a team like yours</figcaption>
</figure>
`,
	js: '',
	key: 'quote',
	name: 'Quote',
};

function highlightElement(position: string, title: string) {
	return {
		definition: {
			fragment: {collectionKey: 'ai-drafts', key: HIGHLIGHT.key},
			fragmentConfig: {imagePosition: position},
			fragmentFields: [{id: 'title', value: {text: {value_i18n: {en_US: title}}}}],
		},
		type: 'Fragment',
	};
}

function pageDefinition(): string {
	return JSON.stringify({
		pageElement: {
			pageElements: [
				{
					definition: {indexed: true, layout: {widthType: 'Fixed'}},
					pageElements: [
						highlightElement('start', 'Publish a design system people can read'),
						{
							definition: {gutters: true, numberOfColumns: 2},
							pageElements: [
								{definition: {size: 6}, pageElements: [{definition: {fragment: {collectionKey: 'ai-drafts', key: QUOTE.key}, fragmentConfig: {}, fragmentFields: []}, type: 'Fragment'}], type: 'Column'},
								{
									definition: {size: 6},
									pageElements: [{definition: {fragment: {collectionKey: 'ai-drafts', key: QUOTE.key}, fragmentConfig: {}, fragmentFields: [{id: 'quote', value: {text: {value_i18n: {en_US: 'Every fragment has a page that says when to use it. Nobody asks any more.'}}}}]}, type: 'Fragment'}],
									type: 'Column',
								},
							],
							type: 'Row',
						},
						highlightElement('end', 'Everything you see is what gets imported'),
					],
					type: 'Section',
				},
			],
			type: 'Root',
		},
		settings: {},
		version: 1.1,
	});
}

function tokens(request: AIRequest): TokenInfo[] {
	return Array.isArray(request.data.tokens) ? (request.data.tokens as TokenInfo[]) : [];
}

function designSystem(request: AIRequest) {
	const brand = tokens(request)
		.filter((token) => token.type === 'ColorPicker' && /^(primary|brand-?color-?1|btn-primary-background-color)$/i.test(token.name))
		.map((token) => ({name: token.name, value: '#7414ff'}));

	const fonts = tokens(request)
		.filter((token) => /^font-family-base$/i.test(token.name))
		.map((token) => ({name: token.name, value: 'Georgia, "Times New Roman", serif'}));

	let name = 'Sample brand';

	try {
		name = new URL(request.url ?? '').hostname.replace(/^www\./, '') || name;
	}
	catch {
		// No address to name it after.
	}

	return {fragments: [HIGHLIGHT, QUOTE], name, notes: ['Demo mode: the address was not read. These are sample tokens and fragments.'], pageDefinition: pageDefinition(), tokens: [...brand, ...fonts]};
}

function tokenize(fragment: Fragment, request: AIRequest) {
	const changes: {detail: string; title: string}[] = [];
	let {css} = fragment;

	for (const token of tokens(request)) {
		if (token.type !== 'ColorPicker' || !/^#[0-9a-f]{3,8}$/i.test(token.value)) {
			continue;
		}

		const pattern = new RegExp(`${token.value}(?![0-9a-f])`, 'gi');
		const count = css.match(pattern)?.length ?? 0;

		if (count) {
			css = css.replace(pattern, `var(--${token.cssVariable})`);
			changes.push({detail: `${token.value} replaced ${count} time(s) in index.css.`, title: token.label || token.name});
		}
	}

	return {changes, configuration: fragment.configuration, css, html: fragment.html, js: fragment.js};
}

function accessibility(fragment: Fragment) {
	const changes: {detail: string; title: string}[] = [];
	let missing = 0;

	const html = fragment.html.replace(/<img\b(?![^>]*\balt=)([^>]*)>/gi, (_, attributes: string) => {
		missing++;

		return `<img alt=""${attributes}>`;
	});

	if (missing) {
		changes.push({detail: `${missing} image(s) had no alt attribute. Added alt="", which an editor replaces with a description when the image carries meaning.`, title: '1.1.1 Non-text Content'});
	}

	if (/data-lfr-editable-type="link"/.test(fragment.html)) {
		changes.push({detail: 'No change: the link text is an editable. Whoever writes it has to make it say where the link goes.', title: '2.4.4 Link Purpose (In Context)'});
	}

	return {changes, configuration: fragment.configuration, css: fragment.css, html, js: fragment.js};
}

function docs(fragment: Fragment) {
	const editables = [...fragment.html.matchAll(/data-lfr-editable-id="([^"]+)"[^>]*data-lfr-editable-type="([^"]+)"/g)].map((match) => `- \`${match[1]}\` (${match[2]})`);
	let fields: string[] = [];

	try {
		fields = (JSON.parse(fragment.configuration || '{}').fieldSets ?? []).flatMap((fieldSet: any) => (fieldSet.fields ?? []).map((field: any) => `- **${field.label ?? field.name}** (\`${field.name}\`, ${field.type})`));
	}
	catch {
		// No readable configuration.
	}

	return {
		changes: [],
		docs: [`# ${fragment.name}`, '', 'Demo mode: this page lists what the code declares. A model would also say when to use the fragment and what to watch for.', '', '## Configuration', '', ...(fields.length ? fields : ['None.']), '', '## Editables', '', ...(editables.length ? editables : ['None.']), ''].join('\n'),
	};
}

const STEPS: Record<AIRequest['action'], string[]> = {
	'design-system-from-website': ['Reading the site', 'Collecting colours and type', 'Writing the fragments', 'Composing the home page'],
	'fragment-from-design': ['Looking at the design', 'Matching the tokens', 'Writing the fragment'],
	'review-accessibility': ['Reading the fragment', 'Checking it against WCAG 2.2 AA'],
	'template-from-design': ['Looking at the page', 'Matching blocks to the catalog', 'Composing the page'],
	'tokenize-fragment': ['Reading the fragment', 'Matching values to tokens'],
	'write-docs': ['Reading the fragment', 'Writing the page'],
};

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Cancelled', 'AbortError'));

			return;
		}

		const timeout = setTimeout(resolve, milliseconds);

		signal?.addEventListener('abort', () => {
			clearTimeout(timeout);
			reject(new DOMException('Cancelled', 'AbortError'));
		});
	});
}

export function demoAnswer(request: AIRequest): unknown {
	const fragment = request.data.fragment as Fragment | undefined;

	switch (request.action) {
		case 'fragment-from-design':
			return {fragments: [HIGHLIGHT], notes: ['Demo mode: the design was not read. This is a sample fragment.']};
		case 'template-from-design':
			return {fragments: [HIGHLIGHT, QUOTE], name: 'Sample page', notes: ['Demo mode: the design was not read. This is a sample page.'], pageDefinition: pageDefinition()};
		case 'design-system-from-website':
			return designSystem(request);
		case 'tokenize-fragment':
			return tokenize(fragment!, request);
		case 'review-accessibility':
			return accessibility(fragment!);
		case 'write-docs':
			return docs(fragment!);
	}
}

export const demoProvider: AIProvider = {
	id: 'demo',
	name: 'Demo',
	notice: 'Demo mode. No model was called: this is sample output the showroom wrote itself.',
	async run(request: AIRequest, options: AIRunOptions = {}) {
		for (const step of STEPS[request.action]) {
			options.onProgress?.(step);

			await wait(700, options.signal);
		}

		return demoAnswer(request);
	},
};
