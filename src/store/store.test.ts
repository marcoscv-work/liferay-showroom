import {describe, expect, it} from 'vitest';

import {createElement} from '../model/pageDefinition';
import {initialState, isModifiedBuiltin, persistedState, reducer} from './index';

import type {PageTemplate, StyleBook} from '../model/types';
import type {State} from './index';

function template(id: string, source: PageTemplate['source'] = 'builtin'): PageTemplate {
	return {id, name: id, root: createElement('Root', {}, [createElement('Fragment', {fragment: {key: 'hello'}})]), source};
}

function loaded(): State {
	const styleBooks: StyleBook[] = [{key: 'builtin-dark', name: 'Dark', source: 'builtin', themeKey: null, values: {'--brand': '#000'}}];

	return reducer(initialState, {collections: [], docs: [], persisted: {}, releases: [], styleBooks, templates: [template('builtin-home'), template('builtin-landing')], themes: [], type: 'loaded'});
}

describe('persistedState', () => {
	it('leaves out the built-ins nobody changed', () => {
		const persisted = persistedState(loaded());

		expect(persisted.templates).toEqual([]);
		expect(persisted.styleBooks).toEqual([]);
	});

	it('keeps edited built-ins and everything imported', () => {
		let state = loaded();

		state = reducer(state, {id: 'builtin-home', name: 'My home', type: 'renameTemplate'});
		state = reducer(state, {templates: [template('mine', 'created')], type: 'addTemplates'});

		expect(persistedState(state).templates.map((candidate) => candidate.id)).toEqual(['builtin-home', 'mine']);
	});

	it('treats a saved copy with the same content as unchanged', () => {
		const state = loaded();
		const copy = {...state.builtinTemplates[0], root: JSON.parse(JSON.stringify(state.builtinTemplates[0].root))};

		expect(isModifiedBuiltin(copy, state.builtinTemplates)).toBe(false);
		expect(isModifiedBuiltin({...copy, root: {...copy.root, pageElements: []}}, state.builtinTemplates)).toBe(true);
	});
});

describe('resetTemplate', () => {
	it('restores the shipped version, and undo brings the edit back', () => {
		let state = loaded();
		const original = state.templates[0];

		state = reducer(state, {id: original.id, root: {...original.root, pageElements: []}, type: 'updateTemplate'});
		expect(isModifiedBuiltin(state.templates[0], state.builtinTemplates)).toBe(true);

		state = reducer(state, {id: original.id, type: 'resetTemplate'});
		expect(state.templates[0]).toBe(original);

		state = reducer(state, {id: original.id, type: 'undoTemplate'});
		expect(state.templates[0].root.pageElements).toEqual([]);
	});

	it('ignores templates that are not built-in', () => {
		const state = reducer(loaded(), {templates: [template('mine', 'created')], type: 'addTemplates'});

		expect(reducer(state, {id: 'mine', type: 'resetTemplate'})).toBe(state);
	});
});
