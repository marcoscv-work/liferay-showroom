/**
 * Extracts the rendered HTML and the CSS a Storybook story actually uses, so
 * that a React design system can be turned into plain Liferay fragments.
 *
 *   node scripts/extract-stories.mjs <storybook-url> <out-dir> <story-id> [<story-id>...]
 *
 * For every story it writes `<out-dir>/<story-id>.html` (the story root's
 * markup) and `<out-dir>/<story-id>.css` (the rules whose selectors match an
 * element of that markup, the keyframes they reference and the custom
 * properties they read). CSS-module class names (`_name_hash_line`) are
 * rewritten to `<prefix>-name` in both files.
 *
 * Playwright is resolved from `PLAYWRIGHT_MODULE` when set (a path to a
 * `playwright` package), otherwise from the project's dependencies. Set
 * `PLAYWRIGHT_CHANNEL=chrome` to drive the installed Google Chrome, or
 * `PLAYWRIGHT_EXECUTABLE` to point at a specific Chromium build.
 */
import {createRequire} from 'node:module';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const [storybookURL, outDir, ...storyIds] = process.argv.slice(2);

if (!storybookURL || !outDir || !storyIds.length) {
	console.error('Usage: node scripts/extract-stories.mjs <storybook-url> <out-dir> <story-id>...');
	process.exit(1);
}

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const prefix = process.env.CLASS_PREFIX || 'lsds';

mkdirSync(outDir, {recursive: true});

const browser = await chromium.launch({
	channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
	executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined,
});
const page = await browser.newPage({viewport: {width: 1280, height: 900}});

for (const storyId of storyIds) {
	const url = `${storybookURL.replace(/\/$/, '')}/iframe.html?id=${storyId}&viewMode=story`;

	await page.goto(url, {waitUntil: 'networkidle'});
	await page.waitForSelector('#storybook-root > :not(style):not(script)', {state: 'attached', timeout: 30000});
	await page.waitForTimeout(800);

	const result = await page.evaluate(
		({prefix}) => {
			const root = document.getElementById('storybook-root');
			const elements = [root, ...root.querySelectorAll('*')];

			const stripPseudo = (selector) =>
				selector
					.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, (match) => (/^:(not|is|where|has|nth-child|nth-of-type|first-child|last-child|only-child)/.test(match) ? match : ''))
					.trim();

			const matchesAny = (selector) => {
				for (const part of selector.split(',')) {
					const base = stripPseudo(part);

					if (!base || base === '*') {
						continue;
					}

					try {
						if (elements.some((element) => element.matches(base))) {
							return true;
						}
					}
					catch {
						// Unsupported selector: keep it out.
					}
				}

				return false;
			};

			const kept = [];
			const keyframes = new Map();
			const variableRules = [];

			const visit = (rules, wrap) => {
				for (const rule of rules) {
					if (rule.type === CSSRule.STYLE_RULE) {
						const selector = rule.selectorText;

						if (/^:root|^html|^body|^\[data-mantine-color-scheme|^:where\(html|^:where\(body/.test(selector)) {
							if ([...rule.style].some((property) => property.startsWith('--'))) {
								variableRules.push({selector, text: rule.cssText, wrap});
							}

							continue;
						}

						if (matchesAny(selector)) {
							kept.push(wrap(rule.cssText));
						}
					}
					else if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE) {
						const condition = rule.conditionText ?? rule.media?.mediaText ?? '';
						const prefixText = rule.type === CSSRule.MEDIA_RULE ? '@media' : '@supports';

						visit(rule.cssRules, (text) => wrap(`${prefixText} ${condition} {\n${text}\n}`));
					}
					else if (rule.type === CSSRule.KEYFRAMES_RULE) {
						keyframes.set(rule.name, rule.cssText);
					}
					else if (rule.cssRules) {
						visit(rule.cssRules, wrap);
					}
				}
			};

			for (const sheet of document.styleSheets) {
				try {
					visit(sheet.cssRules, (text) => text);
				}
				catch {
					// Cross-origin stylesheet (fonts): nothing to extract.
				}
			}

			let css = kept.join('\n');

			const usedKeyframes = new Set();

			for (const name of keyframes.keys()) {
				if (new RegExp(`(^|[\\s,:])${name}([\\s,;!]|$)`).test(css)) {
					usedKeyframes.add(name);
				}
			}

			const usedVariables = new Set();

			const collectVariables = (text) => {
				for (const match of text.matchAll(/var\(\s*(--[a-zA-Z0-9-_]+)/g)) {
					usedVariables.add(match[1]);
				}
			};

			collectVariables(css);

			for (const name of usedKeyframes) {
				collectVariables(keyframes.get(name));
			}

			const inlineStyles = elements.map((element) => element.getAttribute('style') || '').join('\n');

			collectVariables(inlineStyles);

			let added = true;

			const declarations = new Map();

			while (added) {
				added = false;

				for (const rule of variableRules) {
					for (const property of rule.style ? [] : []) {
						void property;
					}
				}

				for (const rule of variableRules) {
					const text = rule.text;

					for (const match of text.matchAll(/(--[a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g)) {
						const [, name, value] = match;

						if (usedVariables.has(name) && !declarations.has(`${rule.selector}|${name}`)) {
							declarations.set(`${rule.selector}|${name}`, {name, selector: rule.selector, value: value.trim(), wrap: rule.wrap});
							added = true;

							for (const inner of value.matchAll(/var\(\s*(--[a-zA-Z0-9-_]+)/g)) {
								usedVariables.add(inner[1]);
							}
						}
					}
				}
			}

			const variablesBySelector = new Map();

			for (const declaration of declarations.values()) {
				const key = declaration.selector;

				if (!variablesBySelector.has(key)) {
					variablesBySelector.set(key, {wrap: declaration.wrap, lines: []});
				}

				variablesBySelector.get(key).lines.push(`\t${declaration.name}: ${declaration.value};`);
			}

			const variableCSS = [...variablesBySelector.entries()].map(([selector, {lines, wrap}]) => wrap(`${selector} {\n${lines.join('\n')}\n}`)).join('\n');

			const keyframeCSS = [...usedKeyframes].map((name) => keyframes.get(name)).join('\n');

			const rename = (text) => text.replace(/_([a-zA-Z][a-zA-Z0-9]*)_[a-z0-9]{5}_[0-9]+/g, (_, name) => `${prefix}-${name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`);

			const clone = root.cloneNode(true);

			clone.querySelectorAll('style, script').forEach((element) => element.remove());

			const html = rename(clone.innerHTML);

			return {
				css: rename([variableCSS, keyframeCSS, css].filter(Boolean).join('\n\n')),
				html,
				title: document.title,
			};
		},
		{prefix}
	);

	writeFileSync(join(outDir, `${storyId}.html`), result.html);
	writeFileSync(join(outDir, `${storyId}.css`), result.css);

	console.log(`${storyId}: ${result.html.length} chars of HTML, ${result.css.length} chars of CSS`);
}

await browser.close();
