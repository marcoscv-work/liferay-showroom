import {parseHTML} from 'linkedom';

/**
 * The fragment renderer post-processes its output with a DOM (editables,
 * fragment fields, drop zones) when `DOMParser` exists. Outside the browser,
 * linkedom provides one, so the scripts render exactly what the app renders.
 * linkedom parses a bare `<body>` as a fragment, hence the full document.
 */
class NodeDOMParser {
	parseFromString(html: string, _type: string) {
		const body = /^\s*<body[\s>]/i.test(html) ? html : `<body>${html}</body>`;

		return parseHTML(`<!doctype html><html><head></head>${body}</html>`).document;
	}
}

if (typeof globalThis.DOMParser === 'undefined') {
	(globalThis as any).DOMParser = NodeDOMParser;
}
