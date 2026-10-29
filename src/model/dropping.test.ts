import {describe, expect, it} from 'vitest';

import {ancestorsOf, canContain, createBlockElement, dropElement, moveElement, parseBlock} from './dropping';
import {createElement} from './pageDefinition';

import type {Collection, PageElement} from './types';

function element(type: PageElement['type'], id: string, children: PageElement[] = []): PageElement {
	return {...createElement(type, {}, children), id};
}

function page(): PageElement {
	return element('Root', 'root', [
		element('Section', 'container', [element('Fragment', 'title'), element('Fragment', 'text')]),
		element('Row', 'row', [element('Column', 'left', [element('Fragment', 'card')]), element('Column', 'right')]),
	]);
}

function ids(node: PageElement): unknown {
	return node.pageElements.length ? {[node.id]: node.pageElements.map(ids)} : node.id;
}

describe('canContain', () => {
	it('follows the layout structure rules', () => {
		expect(canContain(element('Row', 'r'), element('Column', 'c'))).toBe(true);
		expect(canContain(element('Row', 'r'), element('Fragment', 'f'))).toBe(false);
		expect(canContain(element('Section', 's'), element('Column', 'c'))).toBe(false);
		expect(canContain(element('Column', 'c'), element('Row', 'r'))).toBe(true);
		expect(canContain(element('Fragment', 'f'), element('Fragment', 'g'))).toBe(false);
	});
});

describe('dropElement', () => {
	it('drops before, after and inside', () => {
		const block = element('Fragment', 'new');

		expect(ids(dropElement(page(), block, 'title', 'before')!)).toEqual({root: [{container: ['new', 'title', 'text']}, {row: [{left: ['card']}, 'right']}]});
		expect(ids(dropElement(page(), block, 'title', 'after')!)).toEqual({root: [{container: ['title', 'new', 'text']}, {row: [{left: ['card']}, 'right']}]});
		expect(ids(dropElement(page(), block, 'right', 'inside')!)).toEqual({root: [{container: ['title', 'text']}, {row: [{left: ['card']}, {right: ['new']}]}]});
	});

	it('appends to the page without a target', () => {
		expect(ids(dropElement(page(), element('Fragment', 'new'), null, 'inside')!)).toEqual({root: [{container: ['title', 'text']}, {row: [{left: ['card']}, 'right']}, 'new']});
	});

	it('refuses places the structure does not allow', () => {
		expect(dropElement(page(), element('Fragment', 'new'), 'row', 'inside')).toBeNull();
		expect(dropElement(page(), element('Fragment', 'new'), 'left', 'before')).toBeNull();
		expect(dropElement(page(), element('Fragment', 'new'), 'title', 'inside')).toBeNull();
		expect(dropElement(page(), element('Fragment', 'new'), 'missing', 'after')).toBeNull();
	});
});

describe('moveElement', () => {
	it('moves an element across containers', () => {
		expect(ids(moveElement(page(), 'card', 'title', 'after')!)).toEqual({root: [{container: ['title', 'card', 'text']}, {row: ['left', 'right']}]});
		expect(ids(moveElement(page(), 'text', 'right', 'inside')!)).toEqual({root: [{container: ['title']}, {row: [{left: ['card']}, {right: ['text']}]}]});
	});

	it('moves within the same parent', () => {
		expect(ids(moveElement(page(), 'title', 'text', 'after')!)).toEqual({root: [{container: ['text', 'title']}, {row: [{left: ['card']}, 'right']}]});
	});

	it('reorders columns within their row only', () => {
		expect(ids(moveElement(page(), 'left', 'right', 'after')!)).toEqual({root: [{container: ['title', 'text']}, {row: ['right', {left: ['card']}]}]});
		expect(moveElement(page(), 'left', 'title', 'after')).toBeNull();
	});

	it('refuses a move into itself', () => {
		expect(moveElement(page(), 'row', 'card', 'after')).toBeNull();
		expect(moveElement(page(), 'root', null, 'inside')).toBeNull();
	});

	it('returns the same tree when the element is already there', () => {
		const tree = page();

		expect(moveElement(tree, 'row', 'row', 'before')).toBe(tree);
		expect(moveElement(tree, 'title', 'text', 'before')).toBe(tree);
	});
});

describe('blocks', () => {
	const collections = [{description: '', fragments: [{collectionKey: 'set', configuration: '', css: '', html: '<p>Hi</p>', icon: '', js: '', key: 'hello', name: 'Hello', thumbnail: '', type: 'component'}], key: 'set', name: 'Set', resources: {}, source: 'builtin'}] as Collection[];

	it('parses drag data and ignores anything else', () => {
		expect(parseBlock('{"kind":"row","columns":3}')).toEqual({columns: 3, kind: 'row'});
		expect(parseBlock('{"kind":"fragment","collectionKey":"set","fragmentKey":"hello"}')).toEqual({collectionKey: 'set', fragmentKey: 'hello', kind: 'fragment'});
		expect(parseBlock('{"kind":"script"}')).toBeNull();
		expect(parseBlock('not json')).toBeNull();
		expect(parseBlock(undefined)).toBeNull();
	});

	it('creates the element a block stands for', () => {
		expect(createBlockElement({kind: 'container'}, collections)?.type).toBe('Section');
		expect(createBlockElement({columns: 3, kind: 'row'}, collections)?.pageElements).toHaveLength(3);
		expect(createBlockElement({collectionKey: 'set', fragmentKey: 'hello', kind: 'fragment'}, collections)?.definition.fragment).toMatchObject({key: 'hello'});
		expect(createBlockElement({collectionKey: 'set', fragmentKey: 'gone', kind: 'fragment'}, collections)).toBeNull();
	});
});

describe('ancestorsOf', () => {
	it('lists the chain from the root', () => {
		expect(ancestorsOf(page(), 'card').map((node) => node.id)).toEqual(['root', 'row', 'left', 'card']);
		expect(ancestorsOf(page(), 'missing')).toEqual([]);
	});
});
