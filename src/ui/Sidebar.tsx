import {useRef, useState} from 'react';

import {createElement} from '../model/pageDefinition';
import {useStore} from '../store';
import {importFile} from './App';
import {ConfirmButton} from './ConfirmButton';
import {Icon} from './Icon';

import type {Collection, PageTemplate} from '../model/types';

export function Sidebar() {
	const {dispatch, state} = useStore();
	const [query, setQuery] = useState('');
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
	const fileInput = useRef<HTMLInputElement>(null);

	const normalizedQuery = query.trim().toLowerCase();

	const matches = (text: string) => !normalizedQuery || text.toLowerCase().includes(normalizedQuery);

	const createTemplate = () => {
		const template: PageTemplate = {
			id: `template-${Date.now().toString(36)}`,
			name: `Page template ${state.templates.length + 1}`,
			root: createElement('Root'),
			source: 'created',
		};

		dispatch({templates: [template], type: 'addTemplates'});
	};

	const onFiles = async (files: FileList | null) => {
		for (const file of Array.from(files ?? [])) {
			await importFile(file, dispatch);
		}

		if (fileInput.current) {
			fileInput.current.value = '';
		}
	};

	return (
		<aside className="storybook-sidebar">
			<div className="storybook-sidebar__header">
				<div className="storybook-brand">
					<span aria-hidden="true" className="storybook-brand__logo">
						<Icon symbol="page-template" />
					</span>
					<div>
						<div className="storybook-brand__title">Liferay Storybook</div>
						<div className="storybook-brand__subtitle text-secondary">Fragments · Templates · Style books</div>
					</div>
				</div>

				<div className="input-group input-group-sm">
					<div className="input-group-item input-group-prepend">
						<input aria-label="Search fragments and templates" className="form-control" onChange={(event) => setQuery(event.target.value)} placeholder="Find components…" type="search" value={query} />
					</div>
					<span className="input-group-item input-group-item-shrink input-group-append">
						<span className="input-group-text">
							<Icon symbol="search" />
						</span>
					</span>
				</div>
			</div>

			<nav aria-label="Stories" className="storybook-sidebar__tree">
				<div className="storybook-section">
					<div className="storybook-section__title">
						<span>Fragments</span>
						<button className="btn btn-unstyled btn-sm text-primary" onClick={() => fileInput.current?.click()} title="Import a fragment collection, page template, style book or theme zip" type="button">
							<Icon className="mr-1" symbol="import" />
							Import
						</button>
					</div>

					{state.collections.map((collection) => (
						<CollectionNode
							collapsed={Boolean(collapsed[collection.key]) && !normalizedQuery}
							collection={collection}
							key={collection.key}
							matches={matches}
							onRemove={collection.source === 'imported' ? () => dispatch({key: collection.key, type: 'removeCollection'}) : undefined}
							onToggle={() => setCollapsed({...collapsed, [collection.key]: !collapsed[collection.key]})}
						/>
					))}
				</div>

				<div className="storybook-section">
					<div className="storybook-section__title">
						<span>Page templates</span>
						<button className="btn btn-unstyled btn-sm text-primary" onClick={createTemplate} type="button">
							<Icon className="mr-1" symbol="plus" />
							New
						</button>
					</div>

					{state.templates.length === 0 && <div className="text-secondary small px-2">No templates yet. Create one or drop a Liferay page template zip here.</div>}

					<ul className="nav nav-stacked">
						{state.templates
							.filter((template) => matches(template.name))
							.map((template) => {
								const active = state.selection.kind === 'template' && state.selection.id === template.id;

								return (
									<li className="nav-item storybook-nav-row" key={template.id}>
										<button
											aria-current={active ? 'page' : undefined}
											className={`nav-link btn btn-unstyled${active ? ' active' : ''}`}
											onClick={() => dispatch({selection: {id: template.id, kind: 'template'}, type: 'select'})}
											type="button"
										>
											<Icon className="mr-2" symbol="page" />
											<span className="text-truncate">{template.name}</span>
										</button>
										<ConfirmButton className="btn btn-unstyled btn-sm btn-monospaced storybook-nav-row__action" confirmLabel={<Icon symbol="check" />} onConfirm={() => dispatch({id: template.id, type: 'removeTemplate'})} title={`Delete ${template.name}`}>
											<Icon symbol="times" />
										</ConfirmButton>
									</li>
								);
							})}
					</ul>
				</div>
			</nav>

			<div className="storybook-sidebar__footer">
				<input accept=".zip" hidden multiple onChange={(event) => onFiles(event.target.files)} ref={fileInput} type="file" />
				<button className="btn btn-secondary btn-block btn-sm" onClick={() => fileInput.current?.click()} type="button">
					<Icon className="mr-1" symbol="upload" />
					Import zip…
				</button>
				<p className="text-secondary small mt-2 mb-0">Drop Liferay exports anywhere: fragment collections, page templates, style books or built themes.</p>
			</div>
		</aside>
	);
}

function CollectionNode({
	collapsed,
	collection,
	matches,
	onRemove,
	onToggle,
}: {
	collapsed: boolean;
	collection: Collection;
	matches: (text: string) => boolean;
	onRemove?: () => void;
	onToggle: () => void;
}) {
	const {dispatch, state} = useStore();

	const fragments = collection.fragments.filter((fragment) => matches(fragment.name) || matches(collection.name));

	if (!fragments.length) {
		return null;
	}

	return (
		<div className="storybook-collection">
			<div className="storybook-nav-row">
				<button aria-expanded={!collapsed} className="btn btn-unstyled storybook-collection__toggle" onClick={onToggle} type="button">
					<Icon className="mr-2" symbol={collapsed ? 'angle-right-small' : 'angle-down-small'} />
					<span className="storybook-collection__name text-truncate">{collection.name}</span>
					<span className="label label-secondary ml-2">{collection.fragments.length}</span>
				</button>
				{onRemove && (
					<button aria-label={`Remove ${collection.name}`} className="btn btn-unstyled btn-sm btn-monospaced storybook-nav-row__action" onClick={onRemove} title="Remove this imported collection" type="button">
						<Icon symbol="times" />
					</button>
				)}
			</div>

			{!collapsed && (
				<ul className="nav nav-stacked storybook-collection__items">
					{fragments.map((fragment) => {
						const active = state.selection.kind === 'fragment' && state.selection.collectionKey === collection.key && state.selection.fragmentKey === fragment.key;

						return (
							<li className="nav-item" key={fragment.key}>
								<button
									aria-current={active ? 'page' : undefined}
									className={`nav-link btn btn-unstyled${active ? ' active' : ''}`}
									onClick={() => dispatch({selection: {collectionKey: collection.key, fragmentKey: fragment.key, kind: 'fragment'}, type: 'select'})}
									type="button"
								>
									{fragment.thumbnail ? <img alt="" className="storybook-thumb mr-2" src={fragment.thumbnail} /> : <Icon className="mr-2" symbol="code" />}
									<span className="text-truncate">{fragment.name}</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
