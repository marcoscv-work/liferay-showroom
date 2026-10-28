/**
 * Turns the Liferay Sites Design System Storybook into Liferay assets:
 *
 * - `collections/liferay-sites-ds/`: one fragment per component story in
 *   `scripts/lsds/spec.mjs` (HTML with editables and configuration bindings,
 *   the CSS the story uses, the plain JavaScript behaviours, a thumbnail).
 * - `collections/liferay-sites-ds-pages/`: one fragment per block of every
 *   built page, and `templates/<page>/page-definition.json` composing them.
 * - `public/themes/classic-lsds/frontend-token-definition.json`: the Classic
 *   token definition plus every design token the fragments read.
 * - `style-books/lsds-dark` and `style-books/lsds-light`: the token values of
 *   both colour schemes, in Liferay's style book format.
 *
 *   PLAYWRIGHT_MODULE=<path to playwright> PLAYWRIGHT_CHANNEL=chrome node scripts/build-lsds.mjs
 */
import {createRequire} from 'node:module';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

import {localizeMedia} from './lsds/media.mjs';
import {COLLECTION, FRAGMENTS, PAGES, STORYBOOK_URL, STYLE_BOOKS, THEME, VARIANT_ROOTS} from './lsds/spec.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = new URL('../', import.meta.url).pathname;
const behaviors = readFileSync(join(root, 'scripts/lsds/behaviors.js'), 'utf8');

const liveSelector = (selector) => selector.replace(/\.lsds-([a-z0-9-]+)/g, (_, name) => `[class*="_${name.replace(/-([a-z0-9])/g, (__, ch) => ch.toUpperCase())}_"]`);

const collectionDir = join(root, 'collections', COLLECTION.key);
const pagesCollectionDir = join(root, 'collections', `${COLLECTION.key}-pages`);

rmSync(collectionDir, {force: true, recursive: true});
rmSync(pagesCollectionDir, {force: true, recursive: true});
mkdirSync(collectionDir, {recursive: true});
mkdirSync(pagesCollectionDir, {recursive: true});

const browser = await chromium.launch({channel: process.env.PLAYWRIGHT_CHANNEL || undefined, executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined});
const page = await browser.newPage({viewport: {width: 1280, height: 900}});

/** Every custom property read by any fragment, with its values per scheme. */
const tokens = {base: new Map(), dark: new Map(), light: new Map(), used: new Set()};

async function openStory(storyId) {
	await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`, {waitUntil: 'networkidle'});
	await page.waitForSelector('#storybook-root > :not(style):not(script)', {state: 'attached', timeout: 30000});
	await page.waitForTimeout(600);
}

/**
 * Runs inside the story page. Returns the fragment HTML, the CSS it uses,
 * the variant rules and the token values it reads.
 */
const EXTRACT = ({bindings, index, rootSelector, scope, selectorsToLift, storybookURL, variantOnly}) => {
	const storyRoot = document.getElementById('storybook-root');

	/* `.lsds-acc-root` in the spec is `_accRoot_<hash>_<line>` in the live DOM */
	const live = (selector) => selector.replace(/\.lsds-([a-z0-9-]+)/g, (_, name) => `[class*="_${name.replace(/-([a-z0-9])/g, (__, ch) => ch.toUpperCase())}_"]`);

	let roots = rootSelector ? [...storyRoot.querySelectorAll(live(rootSelector))] : [...storyRoot.children].filter((element) => !['STYLE', 'SCRIPT'].includes(element.tagName));

	if (rootSelector && !roots.length) {
		throw new Error(`No element matches ${rootSelector}`);
	}

	const target = roots[index ?? 0];

	/* Variant rules: inline custom properties of component roots, keyed by data attributes */

	const samples = [];

	for (const selector of selectorsToLift) {
		for (const element of storyRoot.querySelectorAll(live(selector))) {
			const style = element.getAttribute('style');

			if (!style) {
				continue;
			}

			const attrs = {};

			for (const name of ['data-variant', 'data-size', 'data-marker', 'data-inverted', 'data-orientation']) {
				if (element.hasAttribute(name)) {
					attrs[name] = element.getAttribute(name);
				}
			}

			const declarations = {};

			for (const part of style.split(';')) {
				const trimmed = part.trim();

				if (trimmed.startsWith('--')) {
					const colon = trimmed.indexOf(':');

					declarations[trimmed.slice(0, colon).trim()] = trimmed.slice(colon + 1).trim();
				}
			}

			if (Object.keys(declarations).length) {
				samples.push({attrs, declarations, selector});
			}
		}
	}

	if (variantOnly) {
		return {samples};
	}

	let clone = target.cloneNode(true);

	clone.querySelectorAll('style, script').forEach((element) => element.remove());

	/* Lift the inline custom properties of component roots */

	for (const selector of selectorsToLift) {
		for (const element of [clone, ...clone.querySelectorAll(live(selector))].filter((candidate) => candidate.matches(live(selector)))) {
			const style = element.getAttribute('style');

			if (!style) {
				continue;
			}

			const rest = style
				.split(';')
				.map((part) => part.trim())
				.filter((part) => part && !part.startsWith('--'));

			if (rest.length) {
				element.setAttribute('style', rest.join('; ') + ';');
			}
			else {
				element.removeAttribute('style');
			}
		}
	}

	/* Absolute media URLs */

	for (const element of clone.querySelectorAll('[src], [href], [poster], [srcset]')) {
		for (const attribute of ['src', 'href', 'poster']) {
			const value = element.getAttribute(attribute);

			if (value && !/^(https?:|data:|#|mailto:|tel:|javascript:)/.test(value)) {
				element.setAttribute(attribute, new URL(value, storybookURL + '/').href);
			}
		}

		const srcset = element.getAttribute('srcset');

		if (srcset) {
			element.setAttribute(
				'srcset',
				srcset
					.split(',')
					.map((candidate) => {
						const [url, descriptor] = candidate.trim().split(/\s+/);

						return `${/^(https?:|data:)/.test(url) ? url : new URL(url, storybookURL + '/').href}${descriptor ? ` ${descriptor}` : ''}`;
					})
					.join(', ')
			);
		}
	}

	/* DS buttons become links so that they are editable in Liferay */

	for (const button of [clone, ...clone.querySelectorAll('button.mantine-Button-root')].filter((candidate) => candidate.matches('button.mantine-Button-root'))) {
		const link = document.createElement('a');

		for (const attribute of button.attributes) {
			if (attribute.name !== 'type') {
				link.setAttribute(attribute.name, attribute.value);
			}
		}

		link.setAttribute('href', '#');
		link.innerHTML = button.innerHTML;

		if (button === clone) {
			clone = link;
		}
		else {
			button.replaceWith(link);
		}
	}

	/* Editables */

	const INLINE = new Set(['SPAN', 'STRONG', 'EM', 'B', 'I', 'BR', 'SVG', 'SMALL', 'SUP', 'SUB', 'CODE']);
	const BLOCK_IN_LINK = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'SECTION', 'ARTICLE', 'IMG', 'VIDEO']);

	const hasOnlyInline = (element) => [...element.children].every((child) => INLINE.has(child.tagName) && hasOnlyInline(child));
	const hasText = (element) => element.textContent.trim().length > 0;

	const candidates = [];

	for (const element of [clone, ...clone.querySelectorAll('*')]) {
		const tag = element.tagName;
		const classes = [...element.classList].join(' ');

		if (tag === 'IMG') {
			candidates.push({element, type: 'image'});
		}
		else if (tag === 'A') {
			if (![...element.querySelectorAll('*')].some((descendant) => BLOCK_IN_LINK.has(descendant.tagName)) && hasText(element)) {
				candidates.push({element, type: 'link'});
			}
		}
		else if (/^H[1-6]$/.test(tag) || tag === 'BLOCKQUOTE') {
			if (hasOnlyInline(element) && hasText(element)) {
				candidates.push({element, type: element.querySelector('span, strong, em') ? 'rich-text' : 'text'});
			}
		}
		else if (tag === 'P') {
			if (hasOnlyInline(element) && hasText(element)) {
				candidates.push({element, type: 'rich-text'});
			}
		}
		else if (/(^|\s)_[a-zA-Z]*(title|heading|description|labeltext|label|tablabel|statvalue|statlabel|message|acclabel|listtitle|listdescription|columntitle|footercopy|chiplabeltext|value)_[a-z0-9]{5}_[0-9]+(\s|$)/i.test(classes)) {
			if (hasOnlyInline(element) && hasText(element)) {
				candidates.push({element, type: element.querySelector('span, strong, em') ? 'rich-text' : 'text'});
			}
		}
	}

	const chosen = candidates.filter(({element}) => !candidates.some((other) => other.element !== element && other.element.contains(element)));

	const counters = {};

	for (const {element, type} of chosen) {
		const kind = type === 'image' ? 'image' : type === 'link' ? 'link' : /^H[1-6]$/.test(element.tagName) ? 'title' : 'text';

		counters[kind] = (counters[kind] ?? 0) + 1;

		element.setAttribute('data-lfr-editable-id', `${kind}-${counters[kind]}`);
		element.setAttribute('data-lfr-editable-type', type);

		if (type === 'image' && !element.getAttribute('alt')) {
			element.setAttribute('alt', '');
		}
	}

	/* Configuration bindings */

	for (const binding of bindings ?? []) {
		for (const element of [clone, ...clone.querySelectorAll(live(binding.selector))].filter((candidate) => candidate.matches(live(binding.selector)))) {
			element.setAttribute(binding.attribute, `\${configuration.${binding.field}}`);
		}
	}

	/* Generated ids become namespaced */

	let html = clone.outerHTML;

	const generatedIds = new Set([...html.matchAll(/mantine-[a-z0-9]{8,}/g)].map((match) => match[0]));

	for (const id of generatedIds) {
		html = html.split(id).join('lsds-${fragmentEntryLinkNamespace}');
	}

	html = html.replace(/__m__-_r_([a-z0-9]+)_/g, 'lsds-grid-$1');

	/* CSS */

	const elements = [target, ...target.querySelectorAll('*')];

	const stripPseudo = (selector) =>
		selector.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, (match) => (/^:(not|is|where|has|nth-child|nth-of-type|first-child|last-child|only-child|nth-last-child)/.test(match) ? match : '')).trim();

	/*
	 * State attributes (`data-reveal-state="in"`, `data-active`, `data-open`)
	 * are toggled by the components at runtime, so a selector is also tried
	 * with the attribute values removed: the rule for the other state must
	 * travel with the fragment.
	 */
	const relax = (selector) => selector.replace(/\[(data-[a-z-]+)(?:[~|^$*]?=[^\]]*)?\]/g, '[$1]');

	/* Attributes that only exist at runtime (`data-open` on a closed menu) are dropped for a last try */
	const bare = (selector) => selector.replace(/\[data-[a-z-]+(?:[~|^$*]?=[^\]]*)?\]/g, '') || selector;

	const matchesAny = (selector) => {
		for (const part of selector.split(',')) {
			const base = stripPseudo(part);

			if (!base || base === '*' || /#storybook-root|\.sb-/.test(base)) {
				continue;
			}

			for (const candidate of [base, relax(base), bare(base)]) {
				try {
					if (elements.some((element) => element.matches(candidate))) {
						return true;
					}
				}
				catch {
					// Unsupported selector.
				}
			}
		}

		return false;
	};

	const kept = [];
	const keyframes = new Map();
	const variables = {base: {}, dark: {}, light: {}};

	/*
	 * Fragment CSS is global in Liferay, and every fragment of this set ships
	 * its own copy of the shared component rules, so each rule is scoped to
	 * its fragment wrapper: nothing leaks between fragments and the order
	 * inside a fragment is all that matters.
	 */
	const splitSelectors = (selector) => {
		const parts = [];

		let depth = 0;
		let current = '';

		for (const ch of selector) {
			if (ch === '(') {
				depth++;
			}
			else if (ch === ')') {
				depth--;
			}

			if (ch === ',' && depth === 0) {
				parts.push(current.trim());
				current = '';
			}
			else {
				current += ch;
			}
		}

		if (current.trim()) {
			parts.push(current.trim());
		}

		return parts;
	};

	const scopePart = (part) => {
		if (!scope) {
			return part;
		}

		/* A document-level head (`body:has(…)`, `html[...]`) stays in front of the scope */
		const match = /^((?:html|body|:root)(?:[^\s]*\([^)]*\))*[^\s]*)\s+(.+)$/.exec(part);

		if (match) {
			return `${match[1]} ${scope} ${match[2]}`;
		}

		return `${scope} ${part}`;
	};

	const scopeSelector = (selector) => (scope ? splitSelectors(selector).map(scopePart).join(', ') : selector);

	const visit = (rules, wrap) => {
		for (const rule of rules) {
			if (rule.type === CSSRule.STYLE_RULE) {
				const selector = rule.selectorText;

				if (/^:root|^:host|^html|^body/.test(selector)) {
					const scheme = /dark/.test(selector) ? 'dark' : /light/.test(selector) ? 'light' : 'base';

					let onlyVariables = true;

					for (const property of rule.style) {
						if (property.startsWith('--')) {
							variables[scheme][property] = rule.style.getPropertyValue(property).trim();
						}
						else {
							onlyVariables = false;
						}
					}

					/* `body:has(.header[data-position="fixed"]) .hero-banner {…}` styles an element inside the fragment: keep it */
					if (onlyVariables || !/\s/.test(selector.trim())) {
						continue;
					}
				}

				if (/#storybook-root|\.sb-|\.docs-story/.test(selector)) {
					continue;
				}

				if (matchesAny(selector)) {
					kept.push(wrap(`${scopeSelector(selector)} { ${rule.style.cssText} }`));
				}
			}
			else if (rule.type === CSSRule.KEYFRAMES_RULE) {
				keyframes.set(rule.name, rule.cssText);
			}
			else if (rule.cssRules) {
				/*
				 * @media, @supports, @container and @layer keep their grouping
				 * around the rules they hold. Layers matter: Mantine's core CSS
				 * sits in `@layer mantine`, which is what lets the design
				 * system's unlayered rules win regardless of source order.
				 */
				const header = rule.cssText.slice(0, rule.cssText.indexOf('{')).trim();

				visit(rule.cssRules, (text) => wrap(`${header} {\n${text}\n}`));
			}
		}
	};

	for (const sheet of document.styleSheets) {
		try {
			visit(sheet.cssRules, (text) => text);
		}
		catch {
			// Cross-origin stylesheet.
		}
	}

	let css = kept.join('\n');

	const usedKeyframes = [...keyframes.keys()].filter((name) => new RegExp(`(^|[\\s,:])${name}([\\s,;!]|$)`).test(css));

	css = [...usedKeyframes.map((name) => keyframes.get(name)), css].join('\n');

	const rename = (text) =>
		text
			.replace(/_([a-zA-Z][a-zA-Z0-9]*)_[a-z0-9]{5}_[0-9]+/g, (_, name) => `lsds-${name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`)
			.replace(/__m__-_r_([a-z0-9]+)_/g, 'lsds-grid-$1');

	return {css: rename(css), html: rename(html), samples, variables};
};

function collectTokens(variables) {
	for (const scheme of ['base', 'dark', 'light']) {
		for (const [name, value] of Object.entries(variables[scheme] ?? {})) {
			tokens[scheme].set(name, value);
		}
	}
}

function usedVariables(text) {
	for (const match of text.matchAll(/var\(\s*(--[a-zA-Z0-9-_]+)/g)) {
		tokens.used.add(match[1]);
	}
}

function fragmentFiles(dir, {css, fields, html, icon, js, key, name}) {
	mkdirSync(dir, {recursive: true});

	writeFileSync(
		join(dir, 'fragment.json'),
		JSON.stringify({cacheable: false, configurationPath: 'configuration.json', cssPath: 'index.css', fragmentEntryKey: key, htmlPath: 'index.html', icon, jsPath: 'index.js', name, thumbnailPath: 'thumbnail.png', type: 'component'}, null, '\t') + '\n'
	);
	writeFileSync(join(dir, 'index.html'), html + '\n');
	writeFileSync(join(dir, 'index.css'), css + '\n');
	writeFileSync(join(dir, 'index.js'), js ? behaviors : '');
	writeFileSync(join(dir, 'configuration.json'), JSON.stringify({fieldSets: fields.length ? [{fields, label: 'options'}] : []}, null, '\t') + '\n');
}

function wrapFragment(key, inner) {
	return `<div class="lsds-fragment lsds-fragment-${key}">\n${inner}\n</div>`;
}

const WRAPPER_CSS = `.lsds-fragment {
	background: var(--mantine-color-body);
	color: var(--sds-surfaces-text-primary);
	font-family: var(--mantine-font-family, "Source Sans 3", -apple-system, system-ui, "Segoe UI", sans-serif);
	font-size: var(--mantine-font-size-md, 1rem);
	line-height: var(--mantine-line-height, 1.55);
	-webkit-font-smoothing: antialiased;
}
.lsds-fragment *, .lsds-fragment *::before, .lsds-fragment *::after {
	box-sizing: border-box;
}
.lsds-fragment a {
	text-decoration: none;
}
.lsds-fragment img, .lsds-fragment video {
	max-width: 100%;
}`;

/**
 * Decides, per custom property, which data attributes it depends on across
 * the sampled instances, and emits one rule per attribute combination.
 */
function buildVariantRules(samples) {
	const rules = new Map();

	const bySelector = new Map();

	for (const sample of samples) {
		if (!bySelector.has(sample.selector)) {
			bySelector.set(sample.selector, []);
		}

		bySelector.get(sample.selector).push(sample);
	}

	for (const [selector, group] of bySelector) {
		const attributeNames = [...new Set(group.flatMap((sample) => Object.keys(sample.attrs)))];
		const properties = [...new Set(group.flatMap((sample) => Object.keys(sample.declarations)))];

		for (const property of properties) {
			const dependsOn = attributeNames.filter((attribute) => {
				const byValue = new Map();

				for (const sample of group) {
					if (!(property in sample.declarations) || !(attribute in sample.attrs)) {
						continue;
					}

					const others = attributeNames.filter((name) => name !== attribute).map((name) => `${name}=${sample.attrs[name] ?? ''}`).join('|');
					const key = `${others}`;

					if (!byValue.has(key)) {
						byValue.set(key, new Map());
					}

					byValue.get(key).set(sample.attrs[attribute], sample.declarations[property]);
				}

				return [...byValue.values()].some((values) => new Set(values.values()).size > 1);
			});

			for (const sample of group) {
				if (!(property in sample.declarations)) {
					continue;
				}

				const keyed = dependsOn
					.filter((attribute) => attribute in sample.attrs)
					.sort()
					.map((attribute) => `[${attribute}="${sample.attrs[attribute]}"]`)
					.join('');

				const ruleSelector = `${selector}${keyed}`;

				if (!rules.has(ruleSelector)) {
					rules.set(ruleSelector, new Map());
				}

				if (!rules.get(ruleSelector).has(property)) {
					rules.get(ruleSelector).set(property, sample.declarations[property]);
				}
			}
		}
	}

	return [...rules.entries()]
		.sort((a, b) => (a[0].match(/\[/g) || []).length - (b[0].match(/\[/g) || []).length)
		.map(([ruleSelector, declarations]) => [ruleSelector, [...declarations.entries()].map(([property, value]) => `${property}: ${value};`).join(' ')]);
}

function buildCSS(css, variantRules, scope) {
	const variants = variantRules.map(([selector, text]) => `${scope} ${selector} { ${text} }`).join('\n');

	return [WRAPPER_CSS, variants, css].filter(Boolean).join('\n\n');
}

/* ------------------------------------------------------------------------ */
/* Components                                                                */
/* ------------------------------------------------------------------------ */

for (const spec of FRAGMENTS) {
	await openStory(spec.story);

	const result = await page.evaluate(EXTRACT, {bindings: spec.bindings ?? [], index: spec.index ?? 0, rootSelector: spec.root, scope: `.lsds-fragment-${spec.key}`, selectorsToLift: VARIANT_ROOTS, storybookURL: STORYBOOK_URL, variantOnly: false});

	const samples = [...result.samples];

	for (const storyId of spec.variantStories ?? []) {
		await openStory(storyId);

		const extra = await page.evaluate(EXTRACT, {bindings: [], index: 0, rootSelector: spec.root, scope: '', selectorsToLift: VARIANT_ROOTS, storybookURL: STORYBOOK_URL, variantOnly: true});

		samples.push(...extra.samples);
	}

	collectTokens(result.variables);

	const variantRules = buildVariantRules(samples);

	const css = buildCSS(result.css, variantRules, `.lsds-fragment-${spec.key}`);

	usedVariables(css);
	usedVariables(result.html);

	const dir = join(collectionDir, spec.key);

	fragmentFiles(dir, {css, fields: spec.fields, html: wrapFragment(spec.key, result.html), icon: spec.icon, js: spec.js, key: spec.key, name: spec.name});

	await openStory(spec.story);

	const element = await page.$(`#storybook-root ${liveSelector(spec.root)}`);

	if (element) {
		await element.screenshot({path: join(dir, 'thumbnail.png'), scale: 'css'}).catch(() => {});
	}

	console.log(`${spec.key}: ${result.html.length} chars HTML, ${css.length} chars CSS, ${variantRules.length} variant rules`);
}

writeFileSync(join(collectionDir, 'collection.json'), JSON.stringify({description: COLLECTION.description, name: COLLECTION.name, theme: COLLECTION.theme}, null, '\t') + '\n');

/* ------------------------------------------------------------------------ */
/* Built pages                                                               */
/* ------------------------------------------------------------------------ */

const slug = (text) =>
	text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);

for (const pageSpec of PAGES) {
	await openStory(pageSpec.story);

	const blocks = await page.evaluate(() => {
		const storyRoot = document.getElementById('storybook-root');

		let container = storyRoot;

		const content = (element) => [...element.children].filter((child) => !['STYLE', 'SCRIPT'].includes(child.tagName));

		while (content(container).length === 1 && !['SECTION', 'HEADER', 'FOOTER'].includes(content(container)[0].tagName)) {
			container = content(container)[0];
		}

		return content(container)
			.map((element, index) => ({
				heading: (element.querySelector('h1, h2, h3')?.textContent ?? element.getAttribute('aria-label') ?? '').trim(),
				height: Math.round(Math.max(element.getBoundingClientRect().height, ...[...element.children].map((child) => child.getBoundingClientRect().height))),
				index,
				tag: element.tagName.toLowerCase(),
			}));
	});

	const pageElements = [];

	for (const block of blocks) {
		await openStory(pageSpec.story);

		const containerSelector = await page.evaluate(() => {
			let container = document.getElementById('storybook-root');
			let selector = '#storybook-root';

			const content = (element) => [...element.children].filter((child) => !['STYLE', 'SCRIPT'].includes(child.tagName));

			while (content(container).length === 1 && !['SECTION', 'HEADER', 'FOOTER'].includes(content(container)[0].tagName)) {
				container = content(container)[0];
				selector += ' > :not(style):not(script)';
			}

			return selector;
		});

		const key = `${pageSpec.fragmentPrefix}-${String(block.index + 1).padStart(2, '0')}-${slug(block.tag === 'header' ? 'header' : block.tag === 'footer' ? 'footer' : block.heading || 'section') || 'section'}`;

		const result = await page.evaluate(EXTRACT, {bindings: [], index: block.index, rootSelector: `${containerSelector} > :not(style):not(script)`, scope: `.lsds-fragment-${key}`, selectorsToLift: VARIANT_ROOTS, storybookURL: STORYBOOK_URL, variantOnly: false});

		collectTokens(result.variables);

		const name = `${pageSpec.name}: ${block.index + 1}. ${block.tag === 'header' ? 'Header' : block.tag === 'footer' ? 'Footer' : block.heading || 'Section'}`;

		let css = buildCSS(result.css, buildVariantRules(result.samples), `.lsds-fragment-${key}`);

		if (block.tag === 'header') {
			/* The header is position: fixed; its fragment keeps the band's height so it shows on its own and pushes nothing */
			css += `\n.lsds-fragment-${key} {\n\tmin-height: ${block.height}px;\n\tposition: relative;\n}\n`;
		}

		usedVariables(css);
		usedVariables(result.html);

		const dir = join(pagesCollectionDir, key);

		fragmentFiles(dir, {css, fields: [], html: wrapFragment(key, result.html), icon: block.tag === 'header' ? 'menu' : block.tag === 'footer' ? 'menu' : 'page', js: pageSpec.js, key, name});

		const handle = await page.evaluateHandle(({index, selector}) => document.querySelectorAll(`${selector} > :not(style):not(script)`)[index], {index: block.index, selector: containerSelector});
		const element = handle.asElement();

		if (element) {
			await element.screenshot({path: join(dir, 'thumbnail.png'), scale: 'css'}).catch(() => {});
		}

		pageElements.push({definition: {fragment: {collectionKey: `${COLLECTION.key}-pages`, key}, fragmentConfig: {}, indexed: true, name}, type: 'Fragment'});

		console.log(`${key}: ${result.html.length} chars HTML, ${css.length} chars CSS`);
	}

	const templateDir = join(root, 'templates', pageSpec.key);

	mkdirSync(templateDir, {recursive: true});
	writeFileSync(join(templateDir, 'page-template.json'), JSON.stringify({name: pageSpec.name, type: 'content-page'}, null, '\t') + '\n');
	writeFileSync(
		join(templateDir, 'page-definition.json'),
		JSON.stringify(
			{
				pageElement: {
					pageElements: [{definition: {indexed: true, layout: {widthType: 'Fluid'}, name: pageSpec.name}, pageElements, type: 'Section'}],
					type: 'Root',
				},
				settings: {},
				version: 1.1,
			},
			null,
			'\t'
		) + '\n'
	);
}

writeFileSync(join(pagesCollectionDir, 'collection.json'), JSON.stringify({description: 'Every block of the Liferay Sites Design System built pages as a fragment, composed into page templates. Generated by scripts/build-lsds.mjs.', name: 'Liferay Sites DS pages', theme: COLLECTION.theme}, null, '\t') + '\n');

/* The images and videos the blocks load from the design system host become resources of the set */

await localizeMedia(pagesCollectionDir, `${STORYBOOK_URL}/assets`);

await browser.close();

/* ------------------------------------------------------------------------ */
/* Theme tokens and style books                                              */
/* ------------------------------------------------------------------------ */

/* Resolve every variable the fragments read, following references */

const needed = new Set(tokens.used);

let grew = true;

while (grew) {
	grew = false;

	for (const name of [...needed]) {
		for (const scheme of ['base', 'dark', 'light']) {
			const value = tokens[scheme].get(name);

			if (value) {
				for (const match of value.matchAll(/var\(\s*(--[a-zA-Z0-9-_]+)/g)) {
					if (!needed.has(match[1])) {
						needed.add(match[1]);
						grew = true;
					}
				}
			}
		}
	}
}

const tokenName = (variable) => variable.replace(/^--/, '').replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());

const editorType = (value) => (/^(#|rgb|hsl|light-dark)/.test(value) ? 'ColorPicker' : /^(-?[0-9.]+(px|rem|em|%|vw|vh|ms|s)|calc\(|clamp\()/.test(value) ? 'Length' : undefined);

const categories = new Map();

const defaultValueOf = (variable) => tokens.dark.get(variable) ?? tokens.base.get(variable) ?? tokens.light.get(variable) ?? '';

const sorted = [...needed].filter((variable) => defaultValueOf(variable) !== '').sort();

for (const variable of sorted) {
	const parts = variable.replace(/^--/, '').split('-');
	const categoryKey = parts[0] === 'sds' ? `sds-${parts[1] ?? 'tokens'}` : parts[0] === 'mantine' ? `mantine-${parts[1] ?? 'tokens'}` : parts[0];
	const value = defaultValueOf(variable);

	if (!categories.has(categoryKey)) {
		categories.set(categoryKey, []);
	}

	const type = editorType(value);

	categories.get(categoryKey).push({
		defaultValue: value,
		...(type ? {editorType: type} : {}),
		label: variable.replace(/^--/, ''),
		mappings: [{type: 'cssVariable', value: variable.replace(/^--/, '')}],
		name: tokenName(variable),
		type: 'String',
	});
}

const classicDefinition = JSON.parse(readFileSync(join(root, 'public/themes/classic/frontend-token-definition.json'), 'utf8'));

const lsdsCategories = [...categories.entries()].map(([categoryKey, frontendTokens]) => ({
	frontendTokenSets: [{frontendTokens, label: categoryKey, name: tokenName(`--${categoryKey}`)}],
	label: `lsds-${categoryKey}`,
	name: tokenName(`--lsds-${categoryKey}`),
}));

const themeDir = join(root, 'public/themes', THEME.key);

mkdirSync(themeDir, {recursive: true});
writeFileSync(join(themeDir, 'frontend-token-definition.json'), JSON.stringify({frontendTokenCategories: [...classicDefinition.frontendTokenCategories, ...lsdsCategories]}, null, '\t') + '\n');
writeFileSync(join(themeDir, 'theme.json'), JSON.stringify({assets: 'classic', description: THEME.description, name: THEME.name}, null, '\t') + '\n');
mkdirSync(join(themeDir, 'css'), {recursive: true});
writeFileSync(join(themeDir, 'css', 'fonts.css'), "/* The Liferay Sites Design System typeface, loaded once by the theme (the Storybook loads it in its preview head). */\n@import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400..700&display=swap');\n");

for (const styleBook of STYLE_BOOKS) {
	const dir = join(root, 'style-books', styleBook.key);

	mkdirSync(dir, {recursive: true});

	const values = {};

	for (const variable of sorted) {
		const value = tokens[styleBook.scheme].get(variable) ?? tokens.base.get(variable);

		if (value !== undefined && value !== defaultValueOf(variable)) {
			values[tokenName(variable)] = {cssVariableMapping: variable.replace(/^--/, ''), value};
		}
	}

	if (styleBook.scheme === 'dark') {
		values.fontFamilyBase = {cssVariableMapping: 'font-family-base', value: '"Source Sans 3", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'};
	}
	else {
		values.fontFamilyBase = {cssVariableMapping: 'font-family-base', value: '"Source Sans 3", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'};
	}

	writeFileSync(join(dir, 'style-book.json'), JSON.stringify({frontendTokensValuesPath: 'frontend-tokens-values.json', name: styleBook.name, themeId: `${THEME.key}_WAR_${THEME.key}theme`}, null, '\t') + '\n');
	writeFileSync(join(dir, 'frontend-tokens-values.json'), JSON.stringify(values, null, '\t') + '\n');

	console.log(`${styleBook.name}: ${Object.keys(values).length} token values`);
}

console.log(`Theme ${THEME.name}: ${sorted.length} design tokens in ${categories.size} categories`);

if (!existsSync(join(root, 'style-books'))) {
	mkdirSync(join(root, 'style-books'));
}
