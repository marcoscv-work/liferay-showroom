import {buildTokenCSS} from '../model/tokens';

import type {Theme} from '../model/types';

/**
 * Builds the `srcdoc` of the preview iframe. The order matches a Liferay
 * page: theme CSS (Clay + the theme's main.css), the `:root` style book
 * variables, then fragment CSS, then the page markup and the fragment JS.
 */

export interface PreviewDocumentOptions {
	bodyClass?: string;
	colorScheme?: 'light' | 'dark';
	css: string;
	/** `<meta name="description">` of a standalone page. */
	description?: string;
	/** A page on its own (the landing): no editor bridge, links work, a `<title>`. */
	standalone?: boolean;
	title?: string;
	fragmentCSS: string;
	html: string;
	js: string;
	mode: 'story' | 'template';
	theme: Theme | null;
	tokenValues: Record<string, string>;
}

/**
 * Stand-in for the `@liferay/fragment-impl/api` module that fragment
 * JavaScript can import at runtime: the storage helpers work on the browser
 * storages, the form helpers are no-ops.
 */
export const FRAGMENT_API_MODULE = `
const storage = (store) => ({
	TYPES: {FUNCTIONAL: 'functional', NECESSARY: 'necessary', PERFORMANCE: 'performance', PERSONALIZATION: 'personalization'},
	getItem(key) { try { return store.getItem(key); } catch (error) { return null; } },
	setItem(key, value) { try { store.setItem(key, value); } catch (error) {} },
	removeItem(key) { try { store.removeItem(key); } catch (error) {} }
});
export const localStorage = storage(window.localStorage);
export const sessionStorage = storage(window.sessionStorage);
const noop = () => {};
export const focusInput = noop;
export const getTranslationInput = () => null;
export const handleInputLengthError = noop;
export const showInputError = noop;
export const hideInputError = noop;
export const registerInputFeedback = noop;
export const registerLocalizedInput = noop;
export const registerUnlocalizedInput = noop;
export const renderDateInput = noop;
export const updateDLVideo = noop;
export const openCMSFileSelectorModal = noop;
export const LocalizationSelect = () => null;
`;

export function importMap(): string {
	const url = `data:text/javascript;base64,${typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(FRAGMENT_API_MODULE))) : Buffer.from(FRAGMENT_API_MODULE).toString('base64')}`;

	return `<script type="importmap">${JSON.stringify({imports: {'@liferay/fragment-impl/api': url}})}</script>`;
}

export const BRIDGE_SCRIPT = `
window.__showroomReport = function (message) {
	parent.postMessage({type: 'showroom:warning', message: String(message)}, '*');
};

window.addEventListener('error', function (event) {
	window.__showroomReport('JavaScript error: ' + event.message);
});

window.Liferay = window.Liferay || {
	Language: {
		available: {en_US: 'English (United States)'},
		get: function (key) { return key; },
		format: function (key) { return key; }
	},
	ThemeDisplay: {
		getBCP47LanguageId: function () { return 'en-US'; },
		getLanguageId: function () { return 'en_US'; },
		getPathThemeImages: function () { return document.documentElement.getAttribute('data-images-path') || ''; },
		getPathThemeRoot: function () { return ''; },
		getPortalURL: function () { return ''; },
		getScopeGroupId: function () { return '0'; },
		getUserId: function () { return '0'; },
		isSignedIn: function () { return false; }
	},
	Util: {
		LocalStorage: {
			TYPES: {FUNCTIONAL: 'functional', NECESSARY: 'necessary', PERFORMANCE: 'performance', PERSONALIZATION: 'personalization'},
			getItem: function (key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } },
			setItem: function (key, value) { try { window.localStorage.setItem(key, value); } catch (e) {} },
			removeItem: function (key) { try { window.localStorage.removeItem(key); } catch (e) {} }
		},
		SessionStorage: {
			TYPES: {FUNCTIONAL: 'functional', NECESSARY: 'necessary', PERFORMANCE: 'performance', PERSONALIZATION: 'personalization'},
			getItem: function (key) { try { return window.sessionStorage.getItem(key); } catch (e) { return null; } },
			setItem: function (key, value) { try { window.sessionStorage.setItem(key, value); } catch (e) {} },
			removeItem: function (key) { try { window.sessionStorage.removeItem(key); } catch (e) {} }
		},
		ns: function (namespace, object) { return object; },
		escapeHTML: function (text) { return String(text).replace(/[&<>"']/g, function (c) { return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]; }); },
		getCheckedCheckboxes: function () { return ''; }
	},
	on: function () {},
	once: function () {},
	fire: function () {},
	detach: function () {},
	component: function () {},
	componentReady: function () { return Promise.resolve(); },
	Loader: {require: function () {}},
	SPA: null,
	authToken: 'showroom'
};

/*
 * Links never navigate the preview: the document is a srcdoc, so even "#"
 * would resolve against the showroom's own URL and load the app inside the
 * frame. In-page anchors scroll, target="_blank" links open a tab, and
 * everything else is inert, like a page in the Liferay editor.
 */
document.addEventListener('click', function (event) {
	var target = event.target;
	var link = target && target.closest ? target.closest('a[href]') : null;

	if (!link) {
		return;
	}

	if (link.getAttribute('target') === '_blank') {
		return;
	}

	event.preventDefault();

	var href = link.getAttribute('href') || '';

	if (href.length > 1 && href.charAt(0) === '#') {
		var anchor = document.getElementById(href.slice(1));

		if (anchor) {
			anchor.scrollIntoView({behavior: 'smooth', block: 'start'});
		}
	}
});

document.addEventListener('submit', function (event) {
	event.preventDefault();
});

(function () {
	var mode = document.documentElement.getAttribute('data-showroom-mode');

	/* Selection only makes sense inside the editor's canvas; the page opened on its own just works */

	if (mode !== 'template' || window.parent === window) {
		return;
	}

	var selected = null;

	function reportRect() {
		var rect = selected ? selected.getBoundingClientRect() : null;

		parent.postMessage({type: 'showroom:rect', rect: rect ? {top: rect.top, left: rect.left, width: rect.width, height: rect.height} : null}, '*');

		placeChip();
	}

	/*
	 * The advanced editor: the parent switches it on with a showroom:editor
	 * message. The selected element gets a chip with its name and a grip to
	 * drag it; blocks from the palette and moved elements are dropped before,
	 * after or inside the element under the pointer, and the drop goes back
	 * to the parent, which owns the tree.
	 */

	var advanced = false;
	var labels = {};
	var chip = null;
	var indicator = null;
	var movingId = null;

	var INSIDE_ONLY = {Root: true, Column: true, FragmentDropZone: true, DropZone: true, CollectionItem: true};
	var CONTAINERS = {Section: true, Container: true};

	function ensureEditorUI() {
		if (!document.body) {
			return;
		}

		if (!indicator) {
			indicator = document.createElement('div');
			indicator.className = 'showroom-drop-indicator';
			indicator.setAttribute('aria-hidden', 'true');
			document.body.appendChild(indicator);
		}

		if (!chip) {
			chip = document.createElement('div');
			chip.className = 'showroom-chip';
			chip.setAttribute('draggable', 'true');
			chip.setAttribute('title', 'Drag to move');
			chip.innerHTML = '<span class="showroom-chip__grip" aria-hidden="true"></span><span class="showroom-chip__label"></span>';

			chip.addEventListener('dragstart', function (event) {
				if (!selected) {
					event.preventDefault();

					return;
				}

				movingId = selected.getAttribute('data-item-id');
				event.dataTransfer.setData('application/x-showroom-move', movingId);
				event.dataTransfer.effectAllowed = 'move';
				document.documentElement.setAttribute('data-showroom-dragging', '');
			});

			chip.addEventListener('dragend', function () {
				movingId = null;
				hideIndicator();
			});

			document.body.appendChild(chip);
		}
	}

	function placeChip() {
		if (!chip) {
			return;
		}

		var id = selected ? selected.getAttribute('data-item-id') : null;

		if (!advanced || !selected || !id) {
			chip.style.display = 'none';

			return;
		}

		var rect = selected.getBoundingClientRect();
		var height = 22;

		chip.querySelector('.showroom-chip__label').textContent = labels[id] || selected.getAttribute('data-item-type') || '';
		chip.style.display = 'flex';
		chip.style.left = Math.max(0, Math.min(rect.left, window.innerWidth - chip.offsetWidth)) + 'px';
		chip.style.top = (rect.top >= height ? rect.top - height : Math.max(0, rect.top)) + 'px';
		chip.classList.toggle('showroom-chip--inside', rect.top < height);
	}

	function hideIndicator() {
		document.documentElement.removeAttribute('data-showroom-dragging');

		if (indicator) {
			indicator.style.display = 'none';
		}
	}

	function dragKind(event) {
		var types = Array.prototype.slice.call((event.dataTransfer && event.dataTransfer.types) || []);

		if (types.indexOf('application/x-showroom-move') !== -1) {
			return 'move';
		}

		if (types.indexOf('application/x-showroom-block') !== -1) {
			return 'block';
		}

		return null;
	}

	function dropTarget(event) {
		var item = event.target && event.target.closest ? event.target.closest('[data-item-id]') : null;

		/* Never onto the element being moved or anything inside it */

		if (item && movingId) {
			var moving = document.querySelector('[data-item-id="' + movingId + '"]');

			if (moving && moving.contains(item)) {
				return {invalid: true};
			}
		}

		if (!item) {
			return {id: null, position: 'inside', rect: null};
		}

		var type = item.getAttribute('data-item-type');
		var rect = item.getBoundingClientRect();
		var y = event.clientY - rect.top;
		var edge = Math.min(16, rect.height / 4);
		var position;

		if (INSIDE_ONLY[type]) {
			position = 'inside';
		}
		else if (CONTAINERS[type]) {
			position = y < edge ? 'before' : y > rect.height - edge ? 'after' : 'inside';
		}
		else {
			position = y < rect.height / 2 ? 'before' : 'after';
		}

		return {id: item.getAttribute('data-item-id'), position: position, rect: rect};
	}

	function showIndicator(target) {
		ensureEditorUI();

		var style = indicator.style;

		indicator.className = 'showroom-drop-indicator showroom-drop-indicator--' + (target.rect ? target.position : 'page');
		style.display = 'block';

		if (!target.rect) {
			style.left = '4px';
			style.top = '4px';
			style.width = (window.innerWidth - 8) + 'px';
			style.height = (window.innerHeight - 8) + 'px';

			return;
		}

		var rect = target.rect;

		style.left = rect.left + 'px';
		style.width = rect.width + 'px';

		if (target.position === 'inside') {
			style.top = rect.top + 'px';
			style.height = rect.height + 'px';
		}
		else {
			style.top = (target.position === 'before' ? rect.top : rect.bottom) - 2 + 'px';
			style.height = '4px';
		}
	}

	document.addEventListener('dragover', function (event) {
		if (!advanced || !dragKind(event)) {
			return;
		}

		/* Scroll the page while dragging near its top or bottom edge */

		if (event.clientY < 48) {
			window.scrollBy(0, -16);
		}
		else if (event.clientY > window.innerHeight - 48) {
			window.scrollBy(0, 16);
		}

		var target = dropTarget(event);

		if (target.invalid) {
			event.dataTransfer.dropEffect = 'none';
			hideIndicator();

			return;
		}

		event.preventDefault();
		event.dataTransfer.dropEffect = dragKind(event) === 'move' ? 'move' : 'copy';
		document.documentElement.setAttribute('data-showroom-dragging', '');
		showIndicator(target);
	});

	document.addEventListener('dragleave', function (event) {
		if (!event.relatedTarget) {
			hideIndicator();
		}
	});

	document.addEventListener('drop', function (event) {
		var kind = advanced ? dragKind(event) : null;

		if (!kind) {
			return;
		}

		event.preventDefault();
		hideIndicator();

		var target = dropTarget(event);

		if (target.invalid) {
			return;
		}

		parent.postMessage({
			type: 'showroom:drop',
			block: kind === 'block' ? event.dataTransfer.getData('application/x-showroom-block') : null,
			move: kind === 'move' ? movingId || event.dataTransfer.getData('application/x-showroom-move') : null,
			position: target.position,
			targetId: target.id
		}, '*');

		movingId = null;
	});

	function setSelected(id) {
		if (selected) {
			selected.classList.remove('showroom-selected');
		}

		selected = id ? document.querySelector('[data-item-id="' + id + '"]') : null;

		if (selected) {
			selected.classList.add('showroom-selected');
		}

		reportRect();
	}

	document.addEventListener('keydown', function (event) {
		var target = event.target;

		if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
			return;
		}

		var mod = event.metaKey || event.ctrlKey;
		var key = event.key;
		var lower = key.toLowerCase();
		var shortcut = (mod && (lower === 'z' || lower === 'y' || lower === 'd')) || (!mod && (key === 'Delete' || key === 'Backspace')) || (event.altKey && (key === 'ArrowUp' || key === 'ArrowDown')) || key === 'Escape';

		if (!shortcut) {
			return;
		}

		event.preventDefault();

		parent.postMessage({type: 'showroom:key', key: {key: key, meta: event.metaKey, ctrl: event.ctrlKey, shift: event.shiftKey, alt: event.altKey}}, '*');
	});

	window.addEventListener('scroll', reportRect, true);
	window.addEventListener('resize', reportRect);

	if (typeof ResizeObserver === 'function') {
		new ResizeObserver(reportRect).observe(document.documentElement);
	}

	document.addEventListener('click', function (event) {
		var item = event.target && event.target.closest ? event.target.closest('[data-item-id]') : null;

		if (!item) {
			return;
		}

		/* Select, but let the click reach the fragment: menus, accordions and tabs keep working while editing */

		parent.postMessage({type: 'showroom:select', id: item.getAttribute('data-item-id')}, '*');
	}, true);

	document.addEventListener('mouseover', function (event) {
		var item = event.target && event.target.closest ? event.target.closest('[data-item-id]') : null;

		document.querySelectorAll('.showroom-hover').forEach(function (element) {
			element.classList.remove('showroom-hover');
		});

		if (item) {
			item.classList.add('showroom-hover');
		}
	});

	window.addEventListener('message', function (event) {
		var data = event.data || {};

		if (data.type === 'showroom:editor') {
			advanced = Boolean(data.advanced);
			labels = data.labels || {};

			if (advanced) {
				document.documentElement.setAttribute('data-showroom-editor', 'advanced');
				ensureEditorUI();
			}
			else {
				document.documentElement.removeAttribute('data-showroom-editor');
			}

			if (data.outlines) {
				document.documentElement.setAttribute('data-showroom-outlines', '');
			}
			else {
				document.documentElement.removeAttribute('data-showroom-outlines');
			}

			placeChip();
		}

		if (data.type === 'showroom:select') {
			setSelected(data.id);

			if (selected && data.scroll) {
				selected.scrollIntoView({behavior: data.scroll === 'instant' ? 'auto' : 'smooth', block: 'nearest'});
			}
		}
	});

	parent.postMessage({type: 'showroom:ready'}, '*');
})();

/* In a story, clicking an editable points the editor at its control */

(function () {
	if (document.documentElement.getAttribute('data-showroom-mode') !== 'story' || window.parent === window) {
		return;
	}

	document.addEventListener('click', function (event) {
		var editable = event.target && event.target.closest ? event.target.closest('[data-lfr-editable-id], [data-lfr-background-image-id]') : null;

		if (!editable) {
			return;
		}

		parent.postMessage({type: 'showroom:editable', id: editable.getAttribute('data-lfr-editable-id') || editable.getAttribute('data-lfr-background-image-id')}, '*');
	}, true);
})();

/* The documentation embeds size their frame with the height the document reports */

(function () {
	var reportHeight = function () {
		parent.postMessage({type: 'showroom:height', height: document.documentElement.scrollHeight}, '*');
	};

	if (typeof ResizeObserver === 'function') {
		new ResizeObserver(reportHeight).observe(document.documentElement);
	}

	window.addEventListener('load', reportHeight);
})();
`;

export const PREVIEW_CSS = `
.showroom-placeholder {
	align-items: center;
	background: repeating-linear-gradient(45deg, rgba(0,0,0,0.04), rgba(0,0,0,0.04) 8px, rgba(0,0,0,0.08) 8px, rgba(0,0,0,0.08) 16px);
	border: 1px dashed rgba(0,0,0,0.3);
	color: rgba(0,0,0,0.6);
	display: flex;
	font-family: system-ui, sans-serif;
	font-size: 13px;
	justify-content: center;
	min-height: 64px;
	padding: 16px;
}
.lfr-drop-zone--empty {
	border: 1px dashed rgba(0,0,0,0.3);
	color: rgba(0,0,0,0.5);
	font-family: system-ui, sans-serif;
	font-size: 12px;
	min-height: 48px;
	padding: 12px;
	text-align: center;
}
[data-showroom-mode="template"] [data-item-id] {
	cursor: pointer;
	position: relative;
}
/* Drawn on top of the item, not as an outline: an inset outline is covered by any child that paints a background (a hero, a full-bleed section) */
[data-showroom-mode="template"] [data-item-id].showroom-hover::after,
[data-showroom-mode="template"] [data-item-id].showroom-selected::after {
	content: '';
	inset: 0;
	pointer-events: none;
	position: absolute;
	z-index: 2147483000;
}
[data-showroom-mode="template"] [data-item-id].showroom-hover::after {
	border: 1px dashed rgba(11, 95, 255, 0.7);
}
[data-showroom-mode="template"] [data-item-id].showroom-selected::after {
	border: 2px solid #0b5fff;
}
[data-showroom-mode="template"] .lfr-layout-structure-item-column:empty,
[data-showroom-mode="template"] .lfr-layout-structure-item-container:empty {
	min-height: 48px;
	outline: 1px dashed rgba(0,0,0,0.2);
	outline-offset: -1px;
}
[data-showroom-mode="template"] .lfr-layout-structure-item-column:empty::after,
[data-showroom-mode="template"] .lfr-layout-structure-item-container:empty::after {
	color: rgba(0,0,0,0.4);
	content: 'Empty: select it and add a fragment';
	display: block;
	font-family: system-ui, sans-serif;
	font-size: 12px;
	padding: 14px;
	text-align: center;
}
`;

/* The advanced editor's structure outlines, element chip and drop indicator */
export const EDITOR_CSS = `
[data-showroom-outlines] [data-item-type="Section"],
[data-showroom-outlines] [data-item-type="Container"],
[data-showroom-outlines] [data-item-type="Row"],
[data-showroom-outlines] [data-item-type="Column"] {
	outline: 1px dashed rgba(11, 95, 255, 0.35);
	outline-offset: -1px;
}
[data-showroom-editor="advanced"] .lfr-layout-structure-item-column:empty::after,
[data-showroom-editor="advanced"] .lfr-layout-structure-item-container:empty::after {
	content: 'Drop a block here';
}
/* Empty slots take the page's own text color, so they read on light and dark designs alike */
[data-showroom-mode="template"] .lfr-layout-structure-item-column:empty,
[data-showroom-mode="template"] .lfr-layout-structure-item-container:empty {
	outline-color: color-mix(in srgb, currentColor 30%, transparent);
}
[data-showroom-mode="template"] .lfr-layout-structure-item-column:empty::after,
[data-showroom-mode="template"] .lfr-layout-structure-item-container:empty::after {
	color: color-mix(in srgb, currentColor 60%, transparent);
}
[data-showroom-dragging] [data-item-id].showroom-hover::after {
	border: 0;
}
.showroom-drop-indicator {
	background: #0b5fff;
	border-radius: 2px;
	box-shadow: 0 0 0 1px #fff;
	display: none;
	pointer-events: none;
	position: fixed;
	z-index: 2147483646;
}
.showroom-drop-indicator--inside,
.showroom-drop-indicator--page {
	background: rgba(11, 95, 255, 0.08);
	border: 2px dashed #0b5fff;
	box-shadow: none;
}
.showroom-chip {
	align-items: center;
	background: #0b5fff;
	border-radius: 4px 4px 0 0;
	box-sizing: border-box;
	color: #fff;
	cursor: grab;
	display: none;
	font: 600 12px/1 system-ui, -apple-system, sans-serif;
	gap: 6px;
	height: 22px;
	max-width: 280px;
	padding: 0 8px 0 6px;
	position: fixed;
	user-select: none;
	white-space: nowrap;
	z-index: 2147483647;
}
.showroom-chip--inside {
	border-radius: 0 0 4px 0;
}
.showroom-chip__grip {
	background-image: radial-gradient(circle, #fff 1px, transparent 1.5px);
	background-size: 4px 4px;
	flex: none;
	height: 12px;
	width: 8px;
}
.showroom-chip__label {
	overflow: hidden;
	text-overflow: ellipsis;
}
`;

function escapeHTML(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildPreviewDocument(options: PreviewDocumentOptions): string {
	const {bodyClass = '', colorScheme = 'light', css, description, fragmentCSS, html, js, mode, standalone = false, theme, title, tokenValues} = options;

	const links = (theme?.css ?? []).map((href) => `<link rel="stylesheet" href="${href}">`).join('\n');

	const tokenCSS = buildTokenCSS(theme, tokenValues);

	/*
	 * Liferay's dark mode marks the page with `data-color-scheme="dark"` and
	 * applies the dark values of the style book. The canvas follows the
	 * showroom's own scheme the same way: the attribute, `color-scheme`, and
	 * dark values for the page background and text tokens.
	 */
	const schemeCSS =
		colorScheme === 'dark'
			? `:root[data-color-scheme="dark"] { color-scheme: dark; --body-bg: #070b13; --body-color: #f1f2f5; --white: #070b13; --gray-100: #272833; --gray-200: #30313f; --gray-300: #3c3d4d; --gray-600: #a7a9bc; --gray-900: #f1f2f5; --dark: #f1f2f5; --light: #272833; }
body { background-color: var(--body-bg); color: var(--body-color); }`
			: '';

	return `<!doctype html>
<html lang="en" data-color-scheme="${colorScheme}" data-showroom-mode="${mode}" data-images-path="${theme?.imagesPath ?? ''}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${title ? `<title>${escapeHTML(title)}</title>` : ''}
${description ? `<meta name="description" content="${escapeHTML(description)}">` : ''}
${links}
<style id="showroom-tokens">${tokenCSS}</style>
<style id="showroom-scheme">${schemeCSS}</style>
<style id="showroom-fragment-css">${fragmentCSS}</style>
<style id="showroom-item-css">${css}</style>
<style id="showroom-preview-css">${PREVIEW_CSS}${mode === 'template' && !standalone ? EDITOR_CSS : ''}</style>
${importMap()}
${standalone ? '' : `<script>${BRIDGE_SCRIPT}</script>`}
</head>
<body class="${bodyClass}">
${html}
<script>${js}</script>
</body>
</html>`;
}
