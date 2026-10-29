import {useRef, useState} from 'react';

import {createElement} from '../model/pageDefinition';
import {downloadBlob, exportAllZip, exportCollectionZip} from '../model/zip';
import {useStore} from '../store';
import {assetURL} from '../store/load';
import {importFile} from './App';
import {ConfirmButton} from './ConfirmButton';
import {useEditorScheme} from './editorScheme';
import {Icon, IconButton} from './Icon';

import type {Collection, PageTemplate} from '../model/types';

export function Sidebar() {
	const {dispatch, state} = useStore();
	const [query, setQuery] = useState('');
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

	const isCollapsed = (collection: Collection) => collapsed[collection.key] ?? collection.collapsed === true;
	const fileInput = useRef<HTMLInputElement>(null);
	const editorScheme = useEditorScheme();

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

	const [exporting, setExporting] = useState(false);

	const downloadAll = async () => {
		setExporting(true);

		try {
			const name = 'Liferay Showroom assets';
			const {blob} = await exportAllZip({collections: state.collections, name, styleBooks: state.styleBooks, templates: state.templates, themes: state.themes});

			downloadBlob(blob, `liferay-showroom-assets-${new Date().toISOString().slice(0, 10)}.zip`);
		}
		catch (error) {
			dispatch({message: `Download all: ${(error as Error).message}`, type: 'runtimeWarning'});
		}
		finally {
			setExporting(false);
		}
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
		<aside className="showroom-sidebar">
			<div className="showroom-sidebar__header">
				<div className="showroom-brand">
					<span aria-hidden="true" className="showroom-brand__logo">
						<img alt="" src={assetURL('images/showroom-mark.svg')} />
					</span>
					<div>
						<div className="showroom-brand__title">Liferay Showroom</div>
						<div className="showroom-brand__subtitle text-secondary">Fragments · Templates · Style books</div>
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

			<nav aria-label="Stories" className="showroom-sidebar__tree">
				{(state.docs.length > 0 || state.releases.length > 0) && (
					<div className="showroom-section">
						<div className="showroom-section__title">
							<span>Docs</span>
						</div>
						<ul className="nav nav-stacked">
							{[...state.docs]
								.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
								.filter((doc) => matches(doc.title))
								.map((doc) => {
									const active = state.selection.kind === 'doc' && state.selection.slug === doc.slug;

									return (
										<li className="nav-item" key={doc.slug}>
											<button aria-current={active ? 'page' : undefined} className={`nav-link btn btn-unstyled${active ? ' active' : ''}`} onClick={() => dispatch({selection: {kind: 'doc', slug: doc.slug}, type: 'select'})} type="button">
												<Icon className="mr-2" symbol="document-text" />
												<span className="text-truncate">{doc.title}</span>
											</button>
										</li>
									);
								})}
							{state.releases.length > 0 && matches('releases') && (
								<li className="nav-item">
									<button aria-current={state.selection.kind === 'releases' ? 'page' : undefined} className={`nav-link btn btn-unstyled${state.selection.kind === 'releases' ? ' active' : ''}`} onClick={() => dispatch({selection: {kind: 'releases'}, type: 'select'})} type="button">
										<Icon className="mr-2" symbol="tag" />
										<span className="text-truncate">Releases</span>
										<span className="label label-secondary ml-2">{state.releases.length}</span>
									</button>
								</li>
							)}
						</ul>
					</div>
				)}

				<div className="showroom-section">
					<div className="showroom-section__title">
						<span>Fragments</span>
						<button className="btn btn-unstyled btn-sm text-primary" onClick={() => fileInput.current?.click()} title="Import a fragment collection, page template, style book or theme zip" type="button">
							<Icon className="mr-1" symbol="import" />
							Import
						</button>
					</div>

					{state.collections.map((collection) => (
						<CollectionNode
							collapsed={isCollapsed(collection) && !normalizedQuery}
							collection={collection}
							key={collection.key}
							matches={matches}
							onRemove={collection.source === 'imported' ? () => dispatch({key: collection.key, type: 'removeCollection'}) : undefined}
							onToggle={() => setCollapsed({...collapsed, [collection.key]: !isCollapsed(collection)})}
						/>
					))}
				</div>

				<div className="showroom-section">
					<div className="showroom-section__title">
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
									<li className="nav-item showroom-nav-row" key={template.id}>
										<button
											aria-current={active ? 'page' : undefined}
											className={`nav-link btn btn-unstyled${active ? ' active' : ''}`}
											onClick={() => dispatch({selection: {id: template.id, kind: 'template'}, type: 'select'})}
											type="button"
										>
											<Icon className="mr-2" symbol="page" />
											<span className="text-truncate">{template.name}</span>
										</button>
										<ConfirmButton className="btn btn-unstyled btn-sm btn-monospaced showroom-nav-row__action" confirmLabel={<Icon symbol="check" />} onConfirm={() => dispatch({id: template.id, type: 'removeTemplate'})} title={`Delete ${template.name}`}>
											<Icon symbol="times" />
										</ConfirmButton>
									</li>
								);
							})}
					</ul>
				</div>
			</nav>

			<div className="showroom-sidebar__footer">
				<input accept=".zip,.json" hidden multiple onChange={(event) => onFiles(event.target.files)} ref={fileInput} type="file" />
				<div className="showroom-sidebar__transfer">
					<button
						className="btn btn-secondary btn-sm"
						onClick={() => fileInput.current?.click()}
						title="Import Liferay exports: fragment sets, page templates, style books, built themes or a page-definition.json. You can also drop the files anywhere on the window."
						type="button"
					>
						<Icon className="mr-1" symbol="upload" />
						Import
					</button>
					<button
						className="btn btn-secondary btn-sm"
						disabled={exporting}
						onClick={downloadAll}
						title="Download the Design Library: every fragment set, page template and style book loaded, including what you imported or edited, in one zip with a manifest, ready to import in Liferay."
						type="button"
					>
						<Icon className="mr-1" symbol="download" />
						{exporting ? 'Packing…' : 'Design Library'}
					</button>
				</div>

				<div className="showroom-editor-scheme">
					<span className="text-secondary small">Editor theme</span>
					<div aria-label="Editor colour scheme" className="btn-group" role="group" title="Colour scheme of this editor only; the preview keeps its theme and style book">
						<IconButton className="btn btn-secondary btn-sm btn-monospaced" label="Light editor" onClick={() => editorScheme.setScheme('light')} pressed={editorScheme.scheme === 'light'} symbol="sun" />
						<IconButton className="btn btn-secondary btn-sm btn-monospaced" label="Dark editor" onClick={() => editorScheme.setScheme('dark')} pressed={editorScheme.scheme === 'dark'} symbol="moon" />
						<IconButton className="btn btn-secondary btn-sm btn-monospaced" label="Follow the system" onClick={() => editorScheme.setScheme('auto')} pressed={editorScheme.scheme === 'auto'} symbol="display" />
					</div>
				</div>
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
		<div className="showroom-collection">
			<div className="showroom-nav-row">
				<button aria-expanded={!collapsed} className="btn btn-unstyled showroom-collection__toggle" onClick={onToggle} type="button">
					<Icon className="mr-2" symbol={collapsed ? 'angle-right-small' : 'angle-down-small'} />
					<span className="showroom-collection__name text-truncate">{collection.name}</span>
					<span className="label label-secondary ml-2">{collection.fragments.length}</span>
				</button>
				<button
					aria-label={`Export ${collection.name} as a fragment set zip`}
					className="btn btn-unstyled btn-sm btn-monospaced showroom-nav-row__action"
					onClick={async () => downloadBlob(await exportCollectionZip(collection), `${collection.key}-fragments.zip`)}
					title="Export this collection as a Liferay fragment set zip"
					type="button"
				>
					<Icon symbol="download" />
				</button>
				{onRemove && (
					<button aria-label={`Remove ${collection.name}`} className="btn btn-unstyled btn-sm btn-monospaced showroom-nav-row__action" onClick={onRemove} title="Remove this imported collection" type="button">
						<Icon symbol="times" />
					</button>
				)}
			</div>

			{!collapsed && (
				<ul className="nav nav-stacked showroom-collection__items">
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
									{fragment.thumbnail ? <img alt="" className="showroom-thumb mr-2" src={fragment.thumbnail} /> : <Icon className="mr-2" symbol="code" />}
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
