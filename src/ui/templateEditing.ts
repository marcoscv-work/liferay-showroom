import {acceptsChildren, findElement, findParent, updateTree} from '../model/pageDefinition';
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
	insert: (element: PageElement) => void;
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

	return {after, insert, selected, target, template};
}
