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

describe('AI drafts', () => {
	const fragment = (key: string) => ({collectionKey: '', configuration: '', css: '', html: `<p>${key}</p>`, icon: 'stars', js: '', key, name: key, thumbnail: '', type: 'component'});
	const drafts = {description: '', key: 'ai-drafts', name: 'AI drafts'};

	it('creates the drafts collection once and adds to it after', () => {
		let state = reducer(loaded(), {collection: drafts, fragments: [fragment('one')], theme: 'classic', type: 'addDraftFragments'});

		state = reducer(state, {collection: drafts, fragments: [fragment('two')], theme: 'classic', type: 'addDraftFragments'});

		expect(state.collections).toHaveLength(1);
		expect(state.collections[0]).toMatchObject({key: 'ai-drafts', source: 'imported', theme: 'classic'});
		expect(state.collections[0].fragments.map((candidate) => [candidate.collectionKey, candidate.key])).toEqual([
			['ai-drafts', 'one'],
			['ai-drafts', 'two'],
		]);
		expect(persistedState(state).collections).toHaveLength(1);
	});

	it('replaces a fragment of an imported collection only', () => {
		let state = reducer(loaded(), {collection: drafts, fragments: [fragment('one')], theme: null, type: 'addDraftFragments'});

		state = reducer(state, {collectionKey: 'ai-drafts', fragment: {...fragment('one'), html: '<p>changed</p>'}, type: 'updateFragment'});

		expect(state.collections[0].fragments[0].html).toBe('<p>changed</p>');
	});
});

describe('custom colours', () => {
	const color = {cssVariable: 'brand-purple', defaultValue: '#7414ff', editorType: 'ColorPicker' as const, label: 'Brand purple', name: 'brandPurple'};

	it('adds, changes and removes them on the style book in use, and keeps the change', () => {
		let state = reducer(loaded(), {key: 'builtin-dark', type: 'setStyleBook'});

		state = reducer(state, {tokens: [color, color], type: 'addCustomTokens'});
		state = reducer(state, {name: 'brandPurple', type: 'setTokenValue', value: '#000000'});
		state = reducer(state, {label: 'Purple', name: 'brandPurple', type: 'updateCustomToken', value: '#8a2be2'});

		const styleBook = state.styleBooks.find((candidate) => candidate.key === 'builtin-dark')!;

		expect(styleBook.customTokens).toEqual([{...color, defaultValue: '#8a2be2', label: 'Purple'}]);
		expect(persistedState(state).styleBooks.map((candidate) => candidate.key)).toEqual(['builtin-dark']);

		state = reducer(state, {name: 'brandPurple', type: 'removeCustomToken'});

		expect(state.styleBooks.find((candidate) => candidate.key === 'builtin-dark')).toMatchObject({customTokens: [], values: {'--brand': '#000'}});
	});
});

describe('removeFragment', () => {
	const fragment = (key: string) => ({collectionKey: '', configuration: '', css: '', html: `<p>${key}</p>`, icon: 'stars', js: '', key, name: key, thumbnail: '', type: 'component'});
	const drafts = {description: '', key: 'ai-drafts', name: 'AI drafts'};

	it('deletes one fragment, moves the selection on, and drops a set left empty', () => {
		let state = reducer(loaded(), {collection: drafts, fragments: [fragment('one'), fragment('two')], theme: null, type: 'addDraftFragments'});

		state = reducer(state, {selection: {collectionKey: 'ai-drafts', fragmentKey: 'one', kind: 'fragment'}, type: 'select'});
		state = reducer(state, {collectionKey: 'ai-drafts', fragmentKey: 'one', type: 'removeFragment'});

		expect(state.collections[0].fragments.map((candidate) => candidate.key)).toEqual(['two']);
		expect(state.selection).toEqual({collectionKey: 'ai-drafts', fragmentKey: 'two', kind: 'fragment'});

		state = reducer(state, {collectionKey: 'ai-drafts', fragmentKey: 'two', type: 'removeFragment'});

		expect(state.collections).toEqual([]);
		expect(state.selection).toEqual({kind: 'none'});
	});

	it('leaves what ships with the showroom alone', () => {
		const state = {...loaded(), collections: [{description: '', fragments: [{...fragment('button'), collectionKey: 'basic'}], key: 'basic', name: 'Basic', resources: {}, source: 'builtin' as const}]};

		expect(reducer(state, {collectionKey: 'basic', fragmentKey: 'button', type: 'removeFragment'})).toBe(state);
	});
});

describe('theme defaults', () => {
	it('come back with what was changed or added on them', () => {
		let state = loaded();

		state = reducer(state, {name: '--brand', type: 'setTokenValue', value: '#123456'});
		state = reducer(state, {tokens: [{cssVariable: 'gap', defaultValue: '2rem', editorType: 'Length', label: 'Gap', name: 'gap'}], type: 'addCustomTokens'});

		const persisted = persistedState(state);
		const again = reducer(initialState, {collections: [], docs: [], persisted, releases: [], styleBooks: [], templates: [], themes: [], type: 'loaded'});

		expect(again.styleBooks[0]).toMatchObject({customTokens: [{name: 'gap'}], key: 'theme-defaults', values: {'--brand': '#123456'}});
	});
});
