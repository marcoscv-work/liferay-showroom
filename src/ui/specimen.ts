import {escapeHTML} from '../freemarker';
import {createElement, createFragmentElement, renderPage} from '../model/pageDefinition';
import {customTokenKind} from '../model/tokens';
import {buildPreviewDocument} from '../preview/document';

import type {Collection, Fragment, StyleBook, Theme} from '../model/types';

/**
 * The page a style book is previewed on while it is edited: its own tokens
 * put to use, a few fragments made for its theme, and the basic elements
 * every theme styles. It changes as the style book does.
 */

const SPECIMEN_CSS = `
.specimen { padding: 1.5rem; }
.specimen__title { color: inherit; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em; margin: 2rem 0 0.75rem; opacity: 0.65; text-transform: uppercase; }
.specimen__title:first-child { margin-top: 0; }
.specimen__row { align-items: center; display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
.specimen__token { align-items: center; display: flex; flex-direction: column; font-size: 0.75rem; gap: 0.375rem; text-align: center; }
.specimen__color { border: 1px solid rgba(128, 128, 128, 0.35); border-radius: 0.5rem; height: 3.5rem; width: 5rem; }
.specimen__space { background: rgba(128, 128, 128, 0.25); border-inline: 2px solid currentColor; height: 1.5rem; max-width: 100%; }
.specimen__radius { border: 2px solid currentColor; height: 3.5rem; width: 3.5rem; }
.specimen__type { line-height: 1.2; margin: 0 0 0.5rem; }
.specimen__fragment { margin-bottom: 1rem; }
`;

/** Fragments worth showing first, when the theme has a set of its own. */
const PREFERRED = [/button/i, /card/i, /hero|banner/i, /label|chip|badge/i, /link/i, /heading|title/i];

function pickFragments(collections: Collection[], theme: Theme): Fragment[] {
	const own = collections.filter((collection) => collection.theme === theme.key);
	const pool = (own.length ? own : collections.filter((collection) => !collection.theme)).flatMap((collection) => collection.fragments);
	const picked: Fragment[] = [];

	for (const pattern of PREFERRED) {
		const fragment = pool.find((candidate) => pattern.test(candidate.key) && !picked.includes(candidate));

		if (fragment && picked.length < 4) {
			picked.push(fragment);
		}
	}

	return picked;
}

function ownTokens(styleBook: StyleBook): string {
	const tokens = styleBook.customTokens ?? [];

	if (!tokens.length) {
		return '';
	}

	const reference = (token: {cssVariable: string}) => `var(--${escapeHTML(token.cssVariable)})`;
	const label = (token: {label: string}) => `<span>${escapeHTML(token.label)}</span>`;
	const of = (...kinds: string[]) => tokens.filter((token) => kinds.includes(customTokenKind(token)));

	const colors = of('color').map((token) => `<div class="specimen__token"><span class="specimen__color" style="background: ${reference(token)}"></span>${label(token)}</div>`);
	const families = of('fontFamily').map((token) => `<p class="specimen__type" style="font-family: ${reference(token)}; font-size: 1.75rem">${escapeHTML(token.label)}: the quick brown fox</p>`);
	const sizes = of('fontSize').map((token) => `<p class="specimen__type" style="font-size: ${reference(token)}">${escapeHTML(token.label)}</p>`);
	const weights = of('fontWeight').map((token) => `<p class="specimen__type" style="font-weight: ${reference(token)}">${escapeHTML(token.label)}: the quick brown fox</p>`);
	const spaces = of('spacing').map((token) => `<div class="specimen__token" style="align-items: flex-start"><span class="specimen__space" style="width: ${reference(token)}"></span>${label(token)}</div>`);
	const radii = of('radius').map((token) => `<div class="specimen__token"><span class="specimen__radius" style="border-radius: ${reference(token)}"></span>${label(token)}</div>`);

	return [
		'<h2 class="specimen__title">Added to this style book</h2>',
		colors.length ? `<div class="specimen__row">${colors.join('')}</div>` : '',
		[...families, ...sizes, ...weights].join(''),
		spaces.length ? `<div class="specimen__row" style="align-items: flex-start; flex-direction: column">${spaces.join('')}</div>` : '',
		radii.length ? `<div class="specimen__row">${radii.join('')}</div>` : '',
	].join('');
}

const BASICS = `
<h2 class="specimen__title">Type</h2>
<h1>Heading one</h1>
<h2>Heading two</h2>
<h3>Heading three</h3>
<p class="lead">A lead paragraph introduces the page in a sentence or two.</p>
<p>Body text sets the tone of a site. It has to stay readable at length, with <a href="#">a link that stands out</a> and <span class="text-muted">muted text that still reads</span>.</p>

<h2 class="specimen__title">Actions</h2>
<div class="specimen__row">
	<button class="btn btn-primary" type="button">Primary</button>
	<button class="btn btn-secondary" type="button">Secondary</button>
	<button class="btn btn-outline-primary" type="button">Outline</button>
	<button class="btn btn-link" type="button">Link</button>
</div>

<h2 class="specimen__title">Feedback</h2>
<div class="alert alert-info" role="status">An informative message, with <a class="alert-link" href="#">a link</a>.</div>
<div class="alert alert-success" role="status">It worked.</div>
<div class="alert alert-warning" role="status">Check this before you go on.</div>
<div class="alert alert-danger" role="status">Something went wrong.</div>
<div class="specimen__row">
	<span class="badge badge-primary">Primary</span>
	<span class="badge badge-secondary">Secondary</span>
	<span class="badge badge-success">Success</span>
	<span class="badge badge-warning">Warning</span>
	<span class="badge badge-danger">Danger</span>
</div>

<h2 class="specimen__title">Surfaces and forms</h2>
<div class="card" style="max-width: 24rem">
	<div class="card-body">
		<h3 class="card-title">A card</h3>
		<p class="card-text">Cards hold a piece of content with its own actions.</p>
		<div class="form-group">
			<label for="specimen-input">A field</label>
			<input class="form-control" id="specimen-input" placeholder="Placeholder text" type="text" />
		</div>
		<button class="btn btn-primary btn-sm" type="button">Save</button>
	</div>
</div>
`;

export function buildSpecimen({collections, colorScheme, styleBook, theme}: {collections: Collection[]; colorScheme: 'light' | 'dark'; styleBook: StyleBook; theme: Theme | null}): string {
	const fragments = theme ? pickFragments(collections, theme) : [];
	const page = fragments.length ? renderPage(createElement('Root', {}, fragments.map((fragment) => createElement('Section', {layout: {widthType: 'Fluid'}}, [createFragmentElement(fragment)]))), {collections, imagesPath: theme?.imagesPath ?? '', layoutMode: 'view', theme}) : null;

	const html = `<main class="specimen">${ownTokens(styleBook)}${page ? `<h2 class="specimen__title">Fragments on this theme</h2><div class="specimen__fragment">${page.html}</div>` : ''}${BASICS}</main>`;

	return buildPreviewDocument({colorScheme, css: `${page?.css ?? ''}\n${SPECIMEN_CSS}`, fragmentCSS: '', html, js: page?.js ?? '', mode: 'story', theme, tokenValues: styleBook.values});
}
