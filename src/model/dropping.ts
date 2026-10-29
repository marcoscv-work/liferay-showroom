import {acceptsChildren, createContainer, createFragmentElement, createRow, findElement, findParent, removeFromTree, updateTree} from './pageDefinition';

import type {Collection, PageElement} from './types';

/**
 * Drag and drop on a page definition tree, as the advanced template editor
 * does it: a block dropped before, after or inside an element, or an element
 * of the page moved the same way. Pure functions, so the canvas and the
 * layers panel share them.
 */

export type DropPosition = 'after' | 'before' | 'inside';

/** A block of the editor palette, as it travels in a drag. */
export type Block = {kind: 'container'} | {columns: number; kind: 'row'} | {collectionKey: string; fragmentKey: string; kind: 'fragment'};

export const BLOCK_MIME = 'application/x-showroom-block';

export const MOVE_MIME = 'application/x-showroom-move';

/** Whether `child` may sit directly inside `parent`, as in Liferay's layout structure: columns only in rows, rows hold nothing else. */
export function canContain(parent: PageElement, child: PageElement): boolean {
	if (parent.type === 'Row') {
		return child.type === 'Column';
	}

	if (child.type === 'Column' || child.type === 'Root') {
		return false;
	}

	return acceptsChildren(parent);
}

interface Slot {
	index: number;
	parentId: string;
}

/** Where an element dropped on `targetId` lands; `null` when the tree does not allow it there. No target means the end of the page. */
export function resolveDrop(root: PageElement, targetId: string | null, position: DropPosition, element: PageElement): Slot | null {
	const target = targetId ? findElement(root, targetId) : root;

	if (!target) {
		return null;
	}

	if (position === 'inside' || target.type === 'Root') {
		return canContain(target, element) ? {index: target.pageElements.length, parentId: target.id} : null;
	}

	const parent = findParent(root, target.id);

	if (!parent || !canContain(parent, element)) {
		return null;
	}

	const index = parent.pageElements.findIndex((child) => child.id === target.id);

	return {index: position === 'before' ? index : index + 1, parentId: parent.id};
}

function insertAt(root: PageElement, element: PageElement, slot: Slot): PageElement {
	return updateTree(root, slot.parentId, (node) => {
		const pageElements = [...node.pageElements];

		pageElements.splice(slot.index, 0, element);

		return {...node, pageElements};
	});
}

/** The tree with a new element dropped on the target, or `null` when it cannot go there. */
export function dropElement(root: PageElement, element: PageElement, targetId: string | null, position: DropPosition): PageElement | null {
	const slot = resolveDrop(root, targetId, position, element);

	return slot ? insertAt(root, element, slot) : null;
}

/** The tree with an existing element moved to the target: the same tree when the element is already there, `null` when the move is not possible (into itself, a column out of its row). */
export function moveElement(root: PageElement, id: string, targetId: string | null, position: DropPosition): PageElement | null {
	const element = findElement(root, id);

	if (targetId === id) {
		return root;
	}

	if (!element || element.type === 'Root' || (targetId && findElement(element, targetId))) {
		return null;
	}

	const without = removeFromTree(root, id);
	const slot = resolveDrop(without, targetId, position, element);

	if (!slot) {
		return null;
	}

	const moved = insertAt(without, element, slot);

	return JSON.stringify(moved) === JSON.stringify(root) ? root : moved;
}

/** The page element a palette block creates, or `null` when its fragment is no longer loaded. */
export function createBlockElement(block: Block, collections: Collection[]): PageElement | null {
	if (block.kind === 'container') {
		return createContainer();
	}

	if (block.kind === 'row') {
		return createRow(Math.min(Math.max(1, Math.round(block.columns)), 12));
	}

	const fragment = collections.find((collection) => collection.key === block.collectionKey)?.fragments.find((candidate) => candidate.key === block.fragmentKey);

	return fragment ? createFragmentElement(fragment) : null;
}

/** Reads a block from drag data, ignoring anything that is not one. */
export function parseBlock(raw: unknown): Block | null {
	if (typeof raw !== 'string' || !raw) {
		return null;
	}

	try {
		const block = JSON.parse(raw);

		if (block?.kind === 'container') {
			return {kind: 'container'};
		}

		if (block?.kind === 'row' && Number.isFinite(block.columns)) {
			return {columns: Number(block.columns), kind: 'row'};
		}

		if (block?.kind === 'fragment' && typeof block.collectionKey === 'string' && typeof block.fragmentKey === 'string') {
			return {collectionKey: block.collectionKey, fragmentKey: block.fragmentKey, kind: 'fragment'};
		}
	}
	catch {
		// Not a block.
	}

	return null;
}

/** The chain from the root down to an element, for the editor's breadcrumb. */
export function ancestorsOf(root: PageElement, id: string): PageElement[] {
	if (root.id === id) {
		return [root];
	}

	for (const child of root.pageElements) {
		const path = ancestorsOf(child, id);

		if (path.length) {
			return [root, ...path];
		}
	}

	return [];
}
