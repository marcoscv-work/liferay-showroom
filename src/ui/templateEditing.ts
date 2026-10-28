import {acceptsChildren, cloneSubtree, findElement, findParent, removeFromTree, updateTree} from '../model/pageDefinition';
import {useStore} from '../store';
import {useCurrentTemplate} from './useRender';

import type {PageElement, PageTemplate} from '../model/types';

/**
 * Where a new element goes, from the selection: into the selected container
 * (or the page when nothing is selected), or right after a selected element
 * that takes no children. Shared by the layout panel and the floating add
 * button on the canvas.
 */
export interface TemplateEditing {
	canRedo: boolean;
	canUndo: boolean;
	duplicate: () => void;
	insert: (element: PageElement) => void;
	move: (direction: -1 | 1) => void;
	redo: () => void;
	remove: () => void;
	undo: () => void;
	/** The selected element, when the selection is a fragment or another leaf: the new one goes after it. */
	after: PageElement | null;
	selected: PageElement | null;
	/** The container that receives the new element. */
	target: PageElement;
	template: PageTemplate;
}

export function useTemplateEditing(): TemplateEditing | null {
	const {dispatch, state} = useStore();
	const template = useCurrentTemplate();

	if (!template) {
		return null;
	}

	const selected = state.selectedItemId ? findElement(template.root, state.selectedItemId) : null;
	const after = selected && !acceptsChildren(selected) ? selected : null;
	const target = selected && acceptsChildren(selected) ? selected : selected ? findParent(template.root, selected.id) ?? template.root : template.root;

	const insert = (element: PageElement) => {
		let root: PageElement;

		if (after) {
			const parent = findParent(template.root, after.id) ?? template.root;

			root = updateTree(template.root, parent.id, (node) => {
				const index = node.pageElements.findIndex((child) => child.id === after.id);
				const pageElements = [...node.pageElements];

				pageElements.splice(index + 1, 0, element);

				return {...node, pageElements};
			});
		}
		else {
			root = updateTree(template.root, target.id, (node) => ({...node, pageElements: [...node.pageElements, element]}));
		}

		dispatch({id: template.id, root, type: 'updateTemplate'});
		dispatch({id: element.id, type: 'selectItem'});
	};

	const update = (root: PageElement) => dispatch({id: template.id, root, type: 'updateTemplate'});

	const editable = selected && selected.type !== 'Root' ? selected : null;

	const move = (direction: -1 | 1) => {
		const parent = editable ? findParent(template.root, editable.id) : null;

		if (!editable || !parent) {
			return;
		}

		update(
			updateTree(template.root, parent.id, (node) => {
				const index = node.pageElements.findIndex((child) => child.id === editable.id);
				const next = index + direction;

				if (next < 0 || next >= node.pageElements.length) {
					return node;
				}

				const pageElements = [...node.pageElements];

				[pageElements[index], pageElements[next]] = [pageElements[next], pageElements[index]];

				return {...node, pageElements};
			})
		);
	};

	/* After a delete the selection moves to a neighbour, so Delete can be pressed again */
	const remove = () => {
		const parent = editable ? findParent(template.root, editable.id) : null;

		if (!editable || !parent) {
			return;
		}

		const index = parent.pageElements.findIndex((child) => child.id === editable.id);
		const neighbour = parent.pageElements[index + 1] ?? parent.pageElements[index - 1] ?? (parent.type === 'Root' ? null : parent);

		update(removeFromTree(template.root, editable.id));
		dispatch({id: neighbour?.id ?? null, type: 'selectItem'});
	};

	const duplicate = () => {
		const parent = editable ? findParent(template.root, editable.id) : null;

		if (!editable || !parent) {
			return;
		}

		const clone = cloneSubtree(editable);

		update(
			updateTree(template.root, parent.id, (node) => {
				const index = node.pageElements.findIndex((child) => child.id === editable.id);
				const pageElements = [...node.pageElements];

				pageElements.splice(index + 1, 0, clone);

				return {...node, pageElements};
			})
		);
		dispatch({id: clone.id, type: 'selectItem'});
	};

	const history = state.templateHistory[template.id];

	return {
		after,
		canRedo: Boolean(history?.future.length),
		canUndo: Boolean(history?.past.length),
		duplicate,
		insert,
		move,
		redo: () => dispatch({id: template.id, type: 'redoTemplate'}),
		remove,
		selected,
		target,
		template,
		undo: () => dispatch({id: template.id, type: 'undoTemplate'}),
	};
}

/** Whether a key event belongs to a field the user is typing in, where editor shortcuts must not fire. */
export function isTyping(target: EventTarget | null): boolean {
	const element = target as HTMLElement | null;

	if (!element || !element.tagName) {
		return false;
	}

	return element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName);
}

export interface ShortcutKey {
	alt: boolean;
	ctrl: boolean;
	key: string;
	meta: boolean;
	shift: boolean;
}

/** Runs the template editor shortcut a key stands for, and says whether there was one. */
export function runShortcut(editing: TemplateEditing, key: ShortcutKey, deselect: () => void): boolean {
	const mod = key.meta || key.ctrl;
	const lower = key.key.toLowerCase();

	if (mod && lower === 'z') {
		if (key.shift) {
			editing.redo();
		}
		else {
			editing.undo();
		}

		return true;
	}

	if (mod && lower === 'y') {
		editing.redo();

		return true;
	}

	if (mod && lower === 'd') {
		editing.duplicate();

		return true;
	}

	if (!mod && (key.key === 'Delete' || key.key === 'Backspace')) {
		editing.remove();

		return true;
	}

	if (key.alt && (key.key === 'ArrowUp' || key.key === 'ArrowDown')) {
		editing.move(key.key === 'ArrowUp' ? -1 : 1);

		return true;
	}

	if (key.key === 'Escape' && editing.selected) {
		deselect();

		return true;
	}

	return false;
}
