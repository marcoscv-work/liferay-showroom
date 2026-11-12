import {describe, expect, it} from 'vitest';

import {advancedEditingFromURL, selectionFromURL, urlFromSelection} from './App';

describe('URL state', () => {
	it('round-trips a template selection', () => {
		const selection = selectionFromURL('?path=/template/builtin-lsds-home');

		expect(selection).toEqual({id: 'builtin-lsds-home', kind: 'template'});
		expect(urlFromSelection(selection!)).toBe('/template/builtin-lsds-home');
	});

	it('round-trips a React component selection', () => {
		const selection = selectionFromURL('?path=/component/empty-state');

		expect(selection).toEqual({key: 'empty-state', kind: 'component'});
		expect(urlFromSelection(selection!)).toBe('/component/empty-state');
	});

	it('opens the advanced editor only with edit=1', () => {
		expect(advancedEditingFromURL('?path=/template/home&edit=1')).toBe(true);
		expect(advancedEditingFromURL('?path=/template/home')).toBe(false);
		expect(advancedEditingFromURL('?path=/template/home&edit=0')).toBe(false);
	});
});
