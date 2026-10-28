import {useEffect, useRef, useState} from 'react';

import {createContainer, createFragmentElement, createRow} from '../model/pageDefinition';
import {useStore} from '../store';
import {Icon} from './Icon';

import type {TemplateEditing} from './templateEditing';

/**
 * The contextual "add" menu of the template editor: a container, a row, or
 * a fragment from the loaded collections, inserted where the selection says.
 * Opens from the floating button on the canvas and from the layout panel.
 */
export interface AddMenuPlacement {
	/** Height the menu may use, so it never leaves the area it opens in. */
	maxHeight: number;
	vertical: 'up' | 'down';
}

export function AddMenu({editing, onClose, placement}: {editing: TemplateEditing; onClose: () => void; placement?: AddMenuPlacement}) {
	const {state} = useStore();
	const [query, setQuery] = useState('');
	const search = useRef<HTMLInputElement>(null);
	const menu = useRef<HTMLDivElement>(null);

	useEffect(() => {
		search.current?.focus();

		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		const onPointerDown = (event: PointerEvent) => {
			if (menu.current && !menu.current.contains(event.target as Node)) {
				onClose();
			}
		};

		document.addEventListener('keydown', onKey);
		document.addEventListener('pointerdown', onPointerDown, true);

		return () => {
			document.removeEventListener('keydown', onKey);
			document.removeEventListener('pointerdown', onPointerDown, true);
		};
	}, [onClose]);

	const add = (element: Parameters<TemplateEditing['insert']>[0]) => {
		editing.insert(element);
		onClose();
	};

	const normalized = query.trim().toLowerCase();
	const matches = (text: string) => !normalized || text.toLowerCase().includes(normalized);

	const where = editing.after ? `after ${describeShort(editing.after)}` : `into ${editing.target.type === 'Root' ? 'the page' : describeShort(editing.target)}`;

	return (
		<div aria-label="Add to the page" className={`showroom-add${placement?.vertical === 'up' ? ' showroom-add--up' : ''}`} ref={menu} role="dialog" style={placement ? {maxHeight: `${placement.maxHeight}px`} : undefined}>
			<div className="showroom-add__header">
				<span className="text-secondary small" title={`Add ${where}`}>
					Add {where}
				</span>
				<button aria-label="Close" className="btn btn-unstyled btn-sm btn-monospaced" onClick={onClose} type="button">
					<Icon symbol="times" />
				</button>
			</div>

			<div className="showroom-add__structure">
				<button className="btn btn-secondary btn-sm" onClick={() => add(createContainer())} type="button">
					<Icon className="mr-1" symbol="container" />
					Container
				</button>
				<div aria-label="Row with columns" className="btn-group" role="group">
					{[1, 2, 3, 4, 6].map((columns) => (
						<button className="btn btn-secondary btn-sm" key={columns} onClick={() => add(createRow(columns))} title={`Row with ${columns} column${columns === 1 ? '' : 's'}`} type="button">
							{columns === 1 ? <Icon className="mr-1" symbol="table" /> : null}
							{columns}
							{columns === 6 ? ' cols' : ''}
						</button>
					))}
				</div>
			</div>

			<input aria-label="Find a fragment" className="form-control form-control-sm showroom-add__search" onChange={(event) => setQuery(event.target.value)} placeholder="Find a fragment…" ref={search} type="search" value={query} />

			<div className="showroom-add__list">
				{state.collections.map((collection) => {
					const fragments = collection.fragments.filter((fragment) => matches(fragment.name) || matches(collection.name));

					if (!fragments.length) {
						return null;
					}

					return (
						<div className="showroom-add__group" key={collection.key}>
							<div className="showroom-add__group-title">{collection.name}</div>
							{fragments.map((fragment) => (
								<button className="btn btn-unstyled showroom-add__item" key={fragment.key} onClick={() => add(createFragmentElement(fragment))} type="button">
									{fragment.thumbnail ? <img alt="" className="showroom-thumb mr-2" src={fragment.thumbnail} /> : <Icon className="mr-2 text-secondary" symbol="code" />}
									<span className="text-truncate">{fragment.name}</span>
								</button>
							))}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function describeShort(element: {definition: Record<string, any>; type: string}): string {
	if (element.type === 'Fragment') {
		return element.definition.name || element.definition.fragment?.key || 'the fragment';
	}

	if (element.type === 'Section' || element.type === 'Container') {
		return element.definition.name || 'the container';
	}

	if (element.type === 'Row') {
		return 'the row';
	}

	if (element.type === 'Column') {
		return 'the column';
	}

	return element.type.toLowerCase();
}
