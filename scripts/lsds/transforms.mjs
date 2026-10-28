/**
 * Hand-written touches to the extracted markup that make a fragment usable in
 * Liferay where the story's own markup is not: a story placeholder becomes an
 * editable. Each entry rewrites the first element matching `selector`.
 * Applied by build-lsds on a DOM (linkedom), so the same code runs anywhere.
 */
import {parseHTML} from 'linkedom';

const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="680" viewBox="0 0 1200 680"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#adc9ff"/><stop offset="0.6" stop-color="#7414ff"/><stop offset="1" stop-color="#0b5fff"/></linearGradient></defs><rect width="1200" height="680" rx="16" fill="url(#g)"/><text x="600" y="352" text-anchor="middle" font-family="sans-serif" font-size="32" font-weight="700" fill="#fff">Product shot</text></svg>');

export const TRANSFORMS = {
	'lsds-hero': [
		{
			html: `<img alt="" data-lfr-editable-id="image-1" data-lfr-editable-type="image" src="${PLACEHOLDER}" style="border-radius: 8px; display: block; height: calc(21.25rem * var(--mantine-scale)); object-fit: cover; width: 100%;">`,
			selector: '.lsds-hero-media > div',
		},
	],
};

export function applyTransforms(key, html) {
	const transforms = TRANSFORMS[key];

	if (!transforms) {
		return html;
	}

	const {document} = parseHTML(`<!doctype html><html><head></head><body>${html}</body></html>`);

	for (const {html: replacement, selector} of transforms) {
		const element = document.querySelector(selector);

		if (element) {
			const holder = document.createElement('div');

			holder.innerHTML = replacement;
			element.replaceWith(...holder.childNodes);
		}
	}

	return document.body.innerHTML;
}
