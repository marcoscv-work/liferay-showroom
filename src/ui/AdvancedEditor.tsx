import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {BLOCK_MIME, MOVE_MIME, ancestorsOf, createBlockElement, dropElement, moveElement, parseBlock} from '../model/dropping';
import {acceptsChildren} from '../model/pageDefinition';
import {VIEWPORTS} from '../model/types';
import {downloadBlob, exportTemplateZip} from '../model/zip';
import {useCurrentStyleBook, useStore} from '../store';
import {Icon, IconButton} from './Icon';
import {ALT, ItemProperties, MOD, TYPE_ICONS, describe} from './LayoutPanel';
import {TemplateSaveStatus} from './SaveStatus';
import {useTemplateEditing} from './templateEditing';
import {useRender} from './useRender';

import type {Block, DropPosition} from '../model/dropping';
import type {Fragment, PageElement, PageTemplate, ViewportId} from '../model/types';
import type {TemplateEditing} from './templateEditing';

/**
 * The advanced template editor: the page template alone on screen, with a
 * palette of blocks and the layers of the page on the left, the page in the
 * middle and the selected element's properties on the right. Blocks and
 * elements are dragged onto the page or the layers; everything else in the
 * showroom (the asset tree, the addons panel) stays out of the way.
 */
export function AdvancedEditor() {
	const {dispatch, state} = useStore();
	const editing = useTemplateEditing();
	const [notice, setNotice] = useState('');
	const [outlines, setOutlines] = useState(() => readFlag('outlines', true));
	const [leftTab, setLeftTab] = useState<'blocks' | 'layers'>(() => (readFlag('layers', false) ? 'layers' : 'blocks'));

	useEffect(() => writeFlag('outlines', outlines), [outlines]);
	useEffect(() => writeFlag('layers', leftTab === 'layers'), [leftTab]);

	useEffect(() => {
		if (!notice) {
			return;
		}

		const timeout = window.setTimeout(() => setNotice(''), 3000);

		return () => window.clearTimeout(timeout);
	}, [notice]);

	const template = editing?.template ?? null;

	const drop = useCallback(
		(payload: {block?: Block | null; move?: string | null}, targetId: string | null, position: DropPosition) => {
			if (!template) {
				return;
			}

			let root: PageElement | null = null;
			let selectId: string | null = null;

			if (payload.move) {
				root = moveElement(template.root, payload.move, targetId, position);
				selectId = payload.move;
			}
			else if (payload.block) {
				const element = createBlockElement(payload.block, state.collections);

				if (!element) {
					setNotice('That fragment is no longer loaded.');

					return;
				}

				root = dropElement(template.root, element, targetId, position);
				selectId = element.id;
			}
			else {
				return;
			}

			if (!root) {
				setNotice(payload.move && isColumn(template.root, payload.move) ? 'Columns only move within their row.' : 'That cannot go there.');

				return;
			}

			if (root === template.root) {
				return;
			}

			dispatch({id: template.id, root, type: 'updateTemplate'});
			dispatch({id: selectId, type: 'selectItem'});
		},
		[dispatch, state.collections, template]
	);

	if (!editing || !template) {
		return null;
	}

	return (
		<div className="showroom-editor">
			<EditorBar editing={editing} notice={notice} outlines={outlines} setOutlines={setOutlines} />
			<div className="showroom-editor__body">
				<aside aria-label="Blocks and layers" className="showroom-editor__side showroom-editor__side--left">
					<ul className="nav nav-underline showroom-editor__tabs" role="tablist">
						{(
							[
								['blocks', 'Blocks', 'plus'],
								['layers', 'Layers', 'columns'],
							] as const
						).map(([id, label, symbol]) => (
							<li className="nav-item" key={id}>
								<button aria-selected={leftTab === id} className={`nav-link btn btn-unstyled${leftTab === id ? ' active' : ''}`} onClick={() => setLeftTab(id)} role="tab" type="button">
									<Icon className="mr-2" symbol={symbol} />
									{label}
								</button>
							</li>
						))}
					</ul>
					<div className="showroom-editor__side-body">{leftTab === 'blocks' ? <BlocksPanel editing={editing} /> : <LayersPanel drop={drop} template={template} />}</div>
				</aside>
				<EditorCanvas drop={drop} outlines={outlines} template={template} />
				<aside aria-label="Properties" className="showroom-editor__side showroom-editor__side--right">
					<Inspector editing={editing} />
				</aside>
			</div>
		</div>
	);
}

function readFlag(name: string, fallback: boolean): boolean {
	try {
		const value = localStorage.getItem(`liferay-showroom:editor-${name}`);

		return value === null ? fallback : value === '1';
	}
	catch {
		return fallback;
	}
}

function writeFlag(name: string, value: boolean): void {
	try {
		localStorage.setItem(`liferay-showroom:editor-${name}`, value ? '1' : '0');
	}
	catch {
		// Not remembered.
	}
}

function isColumn(root: PageElement, id: string): boolean {
	const path = ancestorsOf(root, id);

	return path[path.length - 1]?.type === 'Column';
}

/* ------------------------------------------------------------------------ */
/* Top bar                                                                   */
/* ------------------------------------------------------------------------ */

const VIEWPORT_ICONS: Record<ViewportId, string> = {
	desktop: 'desktop',
	landscapeMobile: 'mobile-landscape',
	portraitMobile: 'mobile-portrait',
	tablet: 'tablet-portrait',
};

function EditorBar({editing, notice, outlines, setOutlines}: {editing: TemplateEditing; notice: string; outlines: boolean; setOutlines: (value: boolean) => void}) {
	const {dispatch, state} = useStore();
	const styleBook = useCurrentStyleBook();
	const output = useRender();
	const template = editing.template;

	const openPreview = () => {
		const blob = new Blob([output.document], {type: 'text/html'});

		window.open(URL.createObjectURL(blob), '_blank');
	};

	return (
		<header className="showroom-editor__bar">
			<button className="btn btn-secondary btn-sm" onClick={() => dispatch({type: 'setAdvancedEditing', value: false})} title="Back to the showroom. Your changes are already saved." type="button">
				<Icon className="mr-1" symbol="angle-left" />
				Back
			</button>

			<div className="showroom-editor__name">
				<input aria-label="Template name" className="form-control form-control-sm" onChange={(event) => dispatch({id: template.id, name: event.target.value, type: 'renameTemplate'})} type="text" value={template.name} />
				<TemplateSaveStatus template={template} />
			</div>

			<div aria-label="History" className="btn-group" role="group">
				<IconButton className="btn btn-secondary btn-sm btn-monospaced" disabled={!editing.canUndo} label={`Undo (${MOD}Z)`} onClick={editing.undo} symbol="undo" />
				<IconButton className="btn btn-secondary btn-sm btn-monospaced" disabled={!editing.canRedo} label={`Redo (${MOD}⇧Z)`} onClick={editing.redo} symbol="redo" />
			</div>

			<div aria-label="Viewport" className="btn-group" role="group">
				{VIEWPORTS.map((viewport) => (
					<IconButton
						className="btn btn-secondary btn-sm btn-monospaced"
						key={viewport.id}
						label={viewport.width ? `${viewport.label} (${viewport.width}px)` : viewport.label}
						onClick={() => dispatch({type: 'setViewport', viewport: viewport.id})}
						pressed={state.viewport === viewport.id}
						symbol={VIEWPORT_ICONS[viewport.id]}
					/>
				))}
			</div>

			<span aria-live="polite" className="showroom-editor__notice" role="status">
				{notice && (
					<>
						<Icon className="mr-1" symbol="warning-full" />
						{notice}
					</>
				)}
			</span>

			<div className="showroom-editor__bar-end">
				<IconButton className="btn btn-secondary btn-sm btn-monospaced" label={outlines ? 'Hide the structure outlines' : 'Show the structure outlines'} onClick={() => setOutlines(!outlines)} pressed={outlines} symbol="grid" />

				<label className="showroom-toolbar__label">
					<span className="text-secondary small">Style book</span>
					<select className="form-control form-control-sm" onChange={(event) => dispatch({key: event.target.value, type: 'setStyleBook'})} value={styleBook.key}>
						{state.styleBooks.map((candidate) => (
							<option key={candidate.key} value={candidate.key}>
								{candidate.name}
							</option>
						))}
					</select>
				</label>

				<IconButton className="btn btn-secondary btn-sm btn-monospaced" label="Open the rendered page in a new tab" onClick={openPreview} symbol="shortcut" />

				<button
					className="btn btn-primary btn-sm"
					onClick={async () => downloadBlob(await exportTemplateZip(template), `${template.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-page-template.zip`)}
					title="Export as a Liferay page template zip"
					type="button"
				>
					<Icon className="mr-1" symbol="download" />
					Export template
				</button>
			</div>
		</header>
	);
}

/* ------------------------------------------------------------------------ */
/* Blocks                                                                    */
/* ------------------------------------------------------------------------ */

function startBlockDrag(event: React.DragEvent, block: Block) {
	event.dataTransfer.setData(BLOCK_MIME, JSON.stringify(block));
	event.dataTransfer.effectAllowed = 'copy';
}

function BlocksPanel({editing}: {editing: TemplateEditing}) {
	const {state} = useStore();
	const [query, setQuery] = useState('');

	const normalized = query.trim().toLowerCase();
	const matches = (text: string) => !normalized || text.toLowerCase().includes(normalized);

	const where = editing.after ? `after ${describe(editing.after, state.collections)}` : editing.target.type === 'Root' ? 'to the end of the page' : `into ${describe(editing.target, state.collections)}`;

	const add = (block: Block) => {
		const element = createBlockElement(block, state.collections);

		if (element) {
			editing.insert(element);
		}
	};

	const layoutBlocks: {block: Block; label: string; symbol: string}[] = [
		{block: {kind: 'container'}, label: 'Container', symbol: 'container'},
		...[1, 2, 3, 4].map((columns) => ({block: {columns, kind: 'row'} as Block, label: columns === 1 ? 'Row' : `${columns} columns`, symbol: 'columns'})),
	];

	return (
		<div className="showroom-blocks">
			<p className="showroom-blocks__hint text-secondary small">Drag a block onto the page or the layers, or click it to add it {where}.</p>

			<input aria-label="Find a block" className="form-control form-control-sm showroom-blocks__search" onChange={(event) => setQuery(event.target.value)} placeholder="Find a block…" type="search" value={query} />

			{layoutBlocks.some((item) => matches(item.label)) && (
				<BlockGroup title="Layout">
					{layoutBlocks
						.filter((item) => matches(item.label))
						.map((item) => (
							<BlockCard block={item.block} key={item.label} label={item.label} onAdd={add} where={where}>
								{item.block.kind === 'row' ? <RowGlyph columns={item.block.columns} /> : <span className="showroom-block__glyph showroom-block__glyph--container" />}
							</BlockCard>
						))}
				</BlockGroup>
			)}

			{state.collections.map((collection) => {
				const fragments = collection.fragments.filter((fragment) => matches(fragment.name) || matches(collection.name));

				if (!fragments.length) {
					return null;
				}

				return (
					<BlockGroup count={fragments.length} key={collection.key} title={collection.name}>
						{fragments.map((fragment) => (
							<BlockCard block={{collectionKey: collection.key, fragmentKey: fragment.key, kind: 'fragment'}} key={fragment.key} label={fragment.name} onAdd={add} where={where}>
								<FragmentGlyph fragment={fragment} />
							</BlockCard>
						))}
					</BlockGroup>
				);
			})}
		</div>
	);
}

function BlockGroup({children, count, title}: {children: React.ReactNode; count?: number; title: string}) {
	return (
		<details className="showroom-blocks__group" open>
			<summary className="showroom-blocks__group-title">
				<Icon className="showroom-details__chevron mr-1" symbol="angle-right" />
				<span className="text-truncate">{title}</span>
				{count ? <span className="showroom-blocks__count">{count}</span> : null}
			</summary>
			<div className="showroom-blocks__grid">{children}</div>
		</details>
	);
}

function BlockCard({block, children, label, onAdd, where}: {block: Block; children: React.ReactNode; label: string; onAdd: (block: Block) => void; where: string}) {
	return (
		<button className="btn btn-unstyled showroom-block" draggable onClick={() => onAdd(block)} onDragStart={(event) => startBlockDrag(event, block)} title={`${label}: drag onto the page, or click to add it ${where}`} type="button">
			<span aria-hidden="true" className="showroom-block__preview">
				{children}
			</span>
			<span className="showroom-block__label">{label}</span>
		</button>
	);
}

function RowGlyph({columns}: {columns: number}) {
	return (
		<span className="showroom-block__glyph showroom-block__glyph--row">
			{Array.from({length: columns}, (_, index) => (
				<span key={index} />
			))}
		</span>
	);
}

function FragmentGlyph({fragment}: {fragment: Fragment}) {
	if (fragment.thumbnail) {
		return <img alt="" className="showroom-block__thumbnail" draggable={false} src={fragment.thumbnail} />;
	}

	return <Icon className="showroom-block__icon" symbol={fragment.icon || 'code'} />;
}

/* ------------------------------------------------------------------------ */
/* Layers                                                                    */
/* ------------------------------------------------------------------------ */

type DropHint = {id: string; position: DropPosition} | null;

function hintFor(event: React.DragEvent, element: PageElement): DropPosition {
	const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
	const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);

	if (element.type === 'Root') {
		return 'inside';
	}

	if (acceptsChildren(element) || element.type === 'Row') {
		return ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside';
	}

	return ratio < 0.5 ? 'before' : 'after';
}

function readDrag(event: React.DragEvent): {block?: Block | null; move?: string | null} | null {
	const types = Array.from(event.dataTransfer.types);

	if (types.includes(MOVE_MIME)) {
		return {move: event.dataTransfer.getData(MOVE_MIME)};
	}

	if (types.includes(BLOCK_MIME)) {
		return {block: parseBlock(event.dataTransfer.getData(BLOCK_MIME))};
	}

	return null;
}

function isEditorDrag(event: React.DragEvent): boolean {
	const types = Array.from(event.dataTransfer.types);

	return types.includes(MOVE_MIME) || types.includes(BLOCK_MIME);
}

function LayersPanel({drop, template}: {drop: (payload: {block?: Block | null; move?: string | null}, targetId: string | null, position: DropPosition) => void; template: PageTemplate}) {
	const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
	const [hint, setHint] = useState<DropHint>(null);

	const toggle = (id: string) =>
		setCollapsed((current) => {
			const next = new Set(current);

			if (next.has(id)) {
				next.delete(id);
			}
			else {
				next.add(id);
			}

			return next;
		});

	return (
		<ul aria-label="Layers" className="showroom-layers" onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget as Node) && setHint(null)}>
			<LayerNode collapsed={collapsed} depth={0} drop={drop} element={template.root} hint={hint} setHint={setHint} toggle={toggle} />
		</ul>
	);
}

function LayerNode({
	collapsed,
	depth,
	drop,
	element,
	hint,
	setHint,
	toggle,
}: {
	collapsed: Set<string>;
	depth: number;
	drop: (payload: {block?: Block | null; move?: string | null}, targetId: string | null, position: DropPosition) => void;
	element: PageElement;
	hint: DropHint;
	setHint: (hint: DropHint) => void;
	toggle: (id: string) => void;
}) {
	const {dispatch, state} = useStore();
	const selected = state.selectedItemId === element.id;
	const isCollapsed = collapsed.has(element.id);
	const hasChildren = element.pageElements.length > 0;
	const rowHint = hint?.id === element.id ? hint.position : null;
	const ref = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (selected) {
			ref.current?.scrollIntoView({block: 'nearest'});
		}
	}, [selected]);

	return (
		<li className="showroom-layers__item">
			<div
				className={`showroom-layers__row${selected ? ' showroom-layers__row--selected' : ''}${rowHint ? ` showroom-layers__row--drop-${rowHint}` : ''}`}
				draggable={element.type !== 'Root'}
				onDragOver={(event) => {
					if (!isEditorDrag(event)) {
						return;
					}

					event.preventDefault();
					event.stopPropagation();

					const position = hintFor(event, element);

					if (rowHint !== position) {
						setHint({id: element.id, position});
					}
				}}
				onDragStart={(event) => {
					event.stopPropagation();
					event.dataTransfer.setData(MOVE_MIME, element.id);
					event.dataTransfer.effectAllowed = 'move';
				}}
				onDrop={(event) => {
					const payload = readDrag(event);

					event.preventDefault();
					event.stopPropagation();
					setHint(null);

					if (payload) {
						drop(payload, element.type === 'Root' ? null : element.id, hintFor(event, element));
					}
				}}
				style={{paddingLeft: `${4 + depth * 14}px`}}
			>
				{hasChildren ? (
					<button aria-expanded={!isCollapsed} aria-label={isCollapsed ? 'Expand' : 'Collapse'} className="btn btn-unstyled showroom-layers__toggle" onClick={() => toggle(element.id)} type="button">
						<Icon symbol={isCollapsed ? 'angle-right' : 'angle-down'} />
					</button>
				) : (
					<span className="showroom-layers__toggle" />
				)}
				<button aria-current={selected ? 'true' : undefined} className="btn btn-unstyled showroom-layers__select" onClick={() => dispatch({id: element.type === 'Root' ? null : element.id, type: 'selectItem'})} ref={ref} type="button">
					<Icon className="showroom-layers__icon" symbol={TYPE_ICONS[element.type] ?? 'code'} />
					<span className="text-truncate">{describe(element, state.collections)}</span>
				</button>
				{element.type !== 'Root' && <Icon className="showroom-layers__grip" symbol="drag" />}
			</div>
			{hasChildren && !isCollapsed && (
				<ul className="showroom-layers__children">
					{element.pageElements.map((child) => (
						<LayerNode collapsed={collapsed} depth={depth + 1} drop={drop} element={child} hint={hint} key={child.id} setHint={setHint} toggle={toggle} />
					))}
				</ul>
			)}
		</li>
	);
}

/* ------------------------------------------------------------------------ */
/* Canvas                                                                    */
/* ------------------------------------------------------------------------ */

function EditorCanvas({drop, outlines, template}: {drop: (payload: {block?: Block | null; move?: string | null}, targetId: string | null, position: DropPosition) => void; outlines: boolean; template: PageTemplate}) {
	const {dispatch, state} = useStore();
	const output = useRender();
	const frame = useRef<HTMLIFrameElement>(null);
	const viewport = VIEWPORTS.find((candidate) => candidate.id === state.viewport) ?? VIEWPORTS[0];

	const labels = useMemo(() => {
		const map: Record<string, string> = {};

		const walk = (element: PageElement) => {
			map[element.id] = describe(element, state.collections);
			element.pageElements.forEach(walk);
		};

		walk(template.root);

		return map;
	}, [state.collections, template.root]);

	const settings = useRef({labels, outlines, selectedItemId: state.selectedItemId});
	const scrollY = useRef(0);

	settings.current = {labels, outlines, selectedItemId: state.selectedItemId};

	const sync = useCallback((scroll: boolean | 'instant') => {
		const target = frame.current?.contentWindow;

		target?.postMessage({advanced: true, labels: settings.current.labels, outlines: settings.current.outlines, type: 'showroom:editor'}, '*');
		target?.postMessage({id: settings.current.selectedItemId, scroll, type: 'showroom:select'}, '*');
	}, []);

	useEffect(() => {
		dispatch({type: 'clearRuntimeWarnings'});
	}, [dispatch, output.document]);

	useEffect(() => {
		const iframe = frame.current;

		if (!iframe) {
			return;
		}

		/* Every change re-renders the page: keep the scroll where it was, then bring the selection into view */
		const onLoad = () => {
			const win = iframe.contentWindow;

			if (win) {
				win.scrollTo(0, scrollY.current);
				win.addEventListener('scroll', () => (scrollY.current = win.scrollY), {passive: true});
			}

			sync('instant');
		};

		iframe.addEventListener('load', onLoad);

		return () => iframe.removeEventListener('load', onLoad);
	}, [sync]);

	useEffect(() => {
		sync(false);
	}, [labels, outlines, sync]);

	useEffect(() => {
		sync(true);
	}, [state.selectedItemId, output.document, sync]);

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			if (event.source !== frame.current?.contentWindow || event.data?.type !== 'showroom:drop') {
				return;
			}

			const data = event.data;
			const position: DropPosition = data.position === 'before' || data.position === 'after' ? data.position : 'inside';

			drop({block: parseBlock(data.block), move: typeof data.move === 'string' ? data.move : null}, typeof data.targetId === 'string' ? data.targetId : null, position);
		};

		window.addEventListener('message', onMessage);

		return () => window.removeEventListener('message', onMessage);
	}, [drop]);

	return (
		<section aria-label="Page" className="showroom-editor__canvas">
			<div className="showroom-editor__frame-wrapper" style={{maxWidth: viewport.width ? `${viewport.width}px` : undefined}}>
				<iframe className="showroom-canvas__frame" ref={frame} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" srcDoc={output.document} title="Page being edited" />
				{!template.root.pageElements.length && (
					<div className="showroom-editor__empty">
						<Icon className="showroom-editor__empty-icon" symbol="plus" />
						<div className="showroom-editor__empty-title">An empty page</div>
						<div className="text-secondary">Drag blocks from the left onto it, or click one to add it.</div>
					</div>
				)}
			</div>
		</section>
	);
}

/* ------------------------------------------------------------------------ */
/* Inspector                                                                 */
/* ------------------------------------------------------------------------ */

function Inspector({editing}: {editing: TemplateEditing}) {
	const {dispatch, state} = useStore();
	const {selected, template} = editing;

	const path = selected ? ancestorsOf(template.root, selected.id) : [template.root];
	const canEdit = Boolean(selected && selected.type !== 'Root');

	return (
		<div className="showroom-inspector">
			<div className="showroom-inspector__head">
				<nav aria-label="Selected element" className="showroom-inspector__path">
					{path.map((element, index) => {
						const last = index === path.length - 1;

						return (
							<span className="showroom-inspector__crumb" key={element.id}>
								{last ? (
									<span aria-current="location" className="text-truncate">
										{describe(element, state.collections)}
									</span>
								) : (
									<>
										<button className="btn btn-unstyled text-truncate" onClick={() => dispatch({id: element.type === 'Root' ? null : element.id, type: 'selectItem'})} type="button">
											{describe(element, state.collections)}
										</button>
										<Icon className="showroom-inspector__separator" symbol="angle-right" />
									</>
								)}
							</span>
						);
					})}
				</nav>
				<div aria-label="Selection actions" className="btn-group" role="group">
					<IconButton className="btn btn-secondary btn-sm btn-monospaced" disabled={!canEdit} label={`Move up (${ALT}↑)`} onClick={() => editing.move(-1)} symbol="order-arrow-up" />
					<IconButton className="btn btn-secondary btn-sm btn-monospaced" disabled={!canEdit} label={`Move down (${ALT}↓)`} onClick={() => editing.move(1)} symbol="order-arrow-down" />
					<IconButton className="btn btn-secondary btn-sm btn-monospaced" disabled={!canEdit} label={`Duplicate (${MOD}D)`} onClick={editing.duplicate} symbol="copy" />
					<IconButton className="btn btn-secondary btn-sm btn-monospaced" disabled={!canEdit} label="Delete (Delete or Backspace)" onClick={editing.remove} symbol="trash" />
				</div>
			</div>
			<div className="showroom-inspector__body">
				<ItemProperties element={selected ?? template.root} key={selected?.id ?? template.root.id} template={template} />
			</div>
		</div>
	);
}
