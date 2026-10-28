import {useMemo, useState} from 'react';

import {AddMenu} from './AddMenu';
import {useTemplateEditing} from './templateEditing';

import {allFields, defaultRawValue, parseConfiguration} from '../model/configuration';
import {renderFragment} from '../model/fragmentRenderer';
import {humanize} from '../model/liferayContext';
import {
	cloneSubtree,
	createElement,
	editableValuesFromFields,
	fieldsFromEditableValues,
	findElement,
	findFragment,
	findParent,
	removeFromTree,
	updateTree,
} from '../model/pageDefinition';
import {useCurrentTheme, useStore} from '../store';
import {ConfigurationControls, swatchColor} from './controls/ConfigurationControls';
import {EditableControls} from './controls/EditableControls';
import {Icon, IconButton, Toggle} from './Icon';
import {useCurrentTemplate} from './useRender';

import type {EditableValue} from '../model/fragmentRenderer';
import type {Fragment, PageElement, PageTemplate, Theme} from '../model/types';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = IS_MAC ? '⌘' : 'Ctrl+';
const ALT = IS_MAC ? '⌥' : 'Alt+';

/**
 * The page template editor: a tree of the page definition, structural
 * actions (containers, rows, fragments) and the properties of the selected
 * item, mirroring the Liferay page editor's configuration panels.
 */
export function LayoutPanel() {
	const {dispatch, state} = useStore();
	const template = useCurrentTemplate();
	const editing = useTemplateEditing();
	const [adding, setAdding] = useState(false);

	if (!template || !editing) {
		return <p className="text-secondary">Select or create a page template.</p>;
	}

	const selected = editing.selected;

	const canEdit = Boolean(selected && selected.type !== 'Root');

	return (
		<div className="showroom-layout">
			<div className="showroom-layout__tree">
				<div className="showroom-layout__toolbar">
					<div className="showroom-layout__add">
						<button aria-expanded={adding} className="btn btn-primary btn-sm" onClick={() => setAdding((open) => !open)} type="button">
							<Icon className="mr-1" symbol="plus" />
							Add{editing.after ? ` after ${describe(editing.after, state.collections)}` : editing.target.type === 'Root' ? ' to the page' : ` to ${describe(editing.target, state.collections)}`}
						</button>
						{adding && <AddMenu editing={editing} onClose={() => setAdding(false)} />}
					</div>
					<div className="showroom-layout__actions">
					<div className="btn-group" role="group" aria-label="Selection actions">
						<IconButton className="btn btn-secondary btn-sm btn-monospaced" disabled={!canEdit} label={`Move up (${ALT}↑)`} onClick={() => editing.move(-1)} symbol="order-arrow-up" />
						<IconButton className="btn btn-secondary btn-sm btn-monospaced" disabled={!canEdit} label={`Move down (${ALT}↓)`} onClick={() => editing.move(1)} symbol="order-arrow-down" />
						<IconButton className="btn btn-secondary btn-sm btn-monospaced" disabled={!canEdit} label={`Duplicate (${MOD}D)`} onClick={editing.duplicate} symbol="copy" />
						<IconButton className="btn btn-secondary btn-sm btn-monospaced" disabled={!canEdit} label="Delete (Delete or Backspace)" onClick={editing.remove} symbol="trash" />
					</div>
					<div className="btn-group" role="group" aria-label="History">
						<IconButton className="btn btn-secondary btn-sm btn-monospaced" disabled={!editing.canUndo} label={`Undo (${MOD}Z)`} onClick={editing.undo} symbol="undo" />
						<IconButton className="btn btn-secondary btn-sm btn-monospaced" disabled={!editing.canRedo} label={`Redo (${MOD}⇧Z)`} onClick={editing.redo} symbol="redo" />
					</div>
					</div>
				</div>

				<ul className="nav nav-stacked showroom-tree">
					<TreeNode depth={0} element={template.root} template={template} />
				</ul>
			</div>

			<div className="showroom-layout__properties">{selected ? <ItemProperties element={selected} template={template} /> : <p className="text-secondary">Click an element in the preview or the tree to edit it.</p>}</div>
		</div>
	);
}

function describe(element: PageElement, collections: ReturnType<typeof useStore>['state']['collections']): string {
	switch (element.type) {
		case 'Root':
			return 'Page';
		case 'Section':
		case 'Container':
			return element.definition.name || `Container (${String(element.definition.layout?.widthType ?? 'Fluid').toLowerCase()})`;
		case 'Row':
			return `Row · ${element.pageElements.length} column${element.pageElements.length === 1 ? '' : 's'}`;
		case 'Column':
			return `Column ${element.definition.size ?? 12}/12`;
		case 'Fragment': {
			const found = findFragment(collections, element.definition.fragment);

			return element.definition.name || (found ? found.fragment.name : `Fragment ${element.definition.fragment?.key ?? ''}`);
		}
		case 'FragmentDropZone':
			return `Drop zone ${element.definition.fragmentDropZoneId ?? ''}`;
		default:
			return element.type;
	}
}

const TYPE_ICONS: Record<string, string> = {
	Collection: 'list',
	Column: 'columns',
	Container: 'container',
	DropZone: 'drop',
	Form: 'forms',
	Fragment: 'code',
	FragmentDropZone: 'drop',
	Root: 'page',
	Row: 'table',
	Section: 'container',
	Widget: 'cog',
};

function TreeNode({depth, element, template}: {depth: number; element: PageElement; template: PageTemplate}) {
	const {dispatch, state} = useStore();

	const selected = state.selectedItemId === element.id;

	return (
		<>
			<li className="nav-item">
				<button
					aria-current={selected ? 'true' : undefined}
					className={`nav-link btn btn-unstyled showroom-tree__node${selected ? ' active' : ''}`}
					onClick={() => dispatch({id: element.id, type: 'selectItem'})}
					style={{paddingLeft: `${8 + depth * 14}px`}}
					type="button"
				>
					<Icon className="mr-2 text-secondary showroom-tree__icon" symbol={TYPE_ICONS[element.type] ?? 'code'} />
					<span className="text-truncate">{describe(element, state.collections)}</span>
					<span className="showroom-tree__type">{element.type === 'Section' ? 'Container' : element.type}</span>
				</button>
			</li>
			{element.pageElements.map((child) => (
				<TreeNode depth={depth + 1} element={child} key={child.id} template={template} />
			))}
		</>
	);
}

/* ------------------------------------------------------------------------ */
/* Properties                                                                */
/* ------------------------------------------------------------------------ */

function Field({children, label}: {children: React.ReactNode; label: string}) {
	return (
		<div className="form-group form-group-sm">
			<label className="showroom-field-label">{label}</label>
			{children}
		</div>
	);
}

function ItemProperties({element, template}: {element: PageElement; template: PageTemplate}) {
	const {dispatch, state} = useStore();
	const theme = useCurrentTheme();

	const patch = (updater: (definition: Record<string, any>) => Record<string, any>) => {
		dispatch({id: template.id, root: updateTree(template.root, element.id, (node) => ({...node, definition: updater(node.definition)})), type: 'updateTemplate'});
	};

	const setDefinition = (key: string, value: any) => patch((definition) => ({...definition, [key]: value}));

	const setLayout = (key: string, value: any) => patch((definition) => ({...definition, layout: {...(definition.layout ?? {}), [key]: value}}));

	const setStyle = (key: string, value: string) =>
		patch((definition) => {
			const fragmentStyle = {...(definition.fragmentStyle ?? {})};

			if (value === '') {
				delete fragmentStyle[key];
			}
			else {
				fragmentStyle[key] = value;
			}

			return {...definition, fragmentStyle};
		});

	const definition = element.definition;

	if (element.type === 'Root') {
		return (
			<div>
				<h3 className="sheet-title">Page</h3>
				<p className="text-secondary">
					The root of the page definition. Add containers, rows and fragments with the buttons on the left. Exporting produces a Liferay page template zip you can import under <em>Design → Page Templates</em>.
				</p>
				<Field label="Template name">
					<input className="form-control form-control-sm" onChange={(event) => dispatch({id: template.id, name: event.target.value, type: 'renameTemplate'})} type="text" value={template.name} />
				</Field>
			</div>
		);
	}

	if (element.type === 'Fragment') {
		return <FragmentProperties definition={definition} element={element} patch={patch} setDefinition={setDefinition} setStyle={setStyle} theme={theme} />;
	}

	if (element.type === 'Section' || element.type === 'Container') {
		const layout = definition.layout ?? {};

		return (
			<div>
				<h3 className="sheet-title">Container</h3>
				<div className="showroom-grid">
					<Field label="Name">
						<input className="form-control form-control-sm" onChange={(event) => setDefinition('name', event.target.value)} type="text" value={definition.name ?? ''} />
					</Field>
					<Field label="Width">
						<select className="form-control form-control-sm" onChange={(event) => setLayout('widthType', event.target.value)} value={layout.widthType ?? 'Fluid'}>
							<option value="Fluid">Fluid</option>
							<option value="Fixed">Fixed (container-fluid-max-xl)</option>
						</select>
					</Field>
					<Field label="HTML tag">
						<select className="form-control form-control-sm" onChange={(event) => setDefinition('htmlProperties', {...(definition.htmlProperties ?? {}), htmlTag: event.target.value})} value={definition.htmlProperties?.htmlTag ?? 'Div'}>
							{['Div', 'Section', 'Header', 'Footer', 'Main', 'Nav', 'Article', 'Aside'].map((tag) => (
								<option key={tag} value={tag}>
									{tag.toLowerCase()}
								</option>
							))}
						</select>
					</Field>
					<Field label="Content display">
						<select className="form-control form-control-sm" onChange={(event) => setLayout('contentDisplay', event.target.value)} value={layout.contentDisplay ?? 'Block'}>
							<option value="Block">Block</option>
							<option value="FlexRow">Flex row</option>
							<option value="FlexColumn">Flex column</option>
						</select>
					</Field>
					<Field label="Align items">
						<select className="form-control form-control-sm" onChange={(event) => setLayout('align', event.target.value)} value={layout.align ?? ''}>
							<option value="">Default</option>
							{['Start', 'Center', 'End', 'Stretch', 'Baseline'].map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					</Field>
					<Field label="Justify content">
						<select className="form-control form-control-sm" onChange={(event) => setLayout('justify', event.target.value)} value={layout.justify ?? ''}>
							<option value="">Default</option>
							{['Start', 'Center', 'End', 'SpaceBetween', 'SpaceAround'].map((option) => (
								<option key={option} value={option}>
									{humanize(option.replace(/([A-Z])/g, ' $1'))}
								</option>
							))}
						</select>
					</Field>
				</div>
				<StyleEditor definition={definition} setStyle={setStyle} theme={theme} />
				<CustomCSSEditor definition={definition} setDefinition={setDefinition} />
			</div>
		);
	}

	if (element.type === 'Row') {
		const setColumns = (count: number) => {
			const size = Math.floor(12 / count);

			dispatch({
				id: template.id,
				root: updateTree(template.root, element.id, (node) => {
					const columns = node.pageElements.slice(0, count);

					while (columns.length < count) {
						columns.push(createElement('Column', {size}));
					}

					const pageElements = columns.map((column, index) => ({...column, definition: {...column.definition, size: index === count - 1 ? 12 - size * (count - 1) : size}}));

					return {...node, definition: {...node.definition, modulesPerRow: count, numberOfColumns: count}, pageElements};
				}),
				type: 'updateTemplate',
			});
		};

		return (
			<div>
				<h3 className="sheet-title">Row</h3>
				<div className="showroom-grid">
					<Field label="Columns">
						<select className="form-control form-control-sm" onChange={(event) => setColumns(Number(event.target.value))} value={element.pageElements.length}>
							{[1, 2, 3, 4, 5, 6].map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</select>
					</Field>
					<Field label="Vertical alignment">
						<select className="form-control form-control-sm" onChange={(event) => setDefinition('verticalAlignment', event.target.value)} value={definition.verticalAlignment ?? 'top'}>
							<option value="top">Top</option>
							<option value="middle">Middle</option>
							<option value="bottom">Bottom</option>
						</select>
					</Field>
					<div className="form-group form-group-sm pt-4">
						<Toggle checked={definition.gutters !== false} label="Gutters" onChange={(checked) => setDefinition('gutters', checked)} />
					</div>
					<div className="form-group form-group-sm pt-4">
						<Toggle checked={definition.reverseOrder === true} label="Reverse order" onChange={(checked) => setDefinition('reverseOrder', checked)} />
					</div>
				</div>
				<StyleEditor definition={definition} setStyle={setStyle} theme={theme} />
			</div>
		);
	}

	if (element.type === 'Column') {
		const viewports: Record<string, number | undefined> = {};

		for (const viewport of definition.columnViewports ?? []) {
			viewports[viewport.id] = viewport.columnViewportDefinition?.size;
		}

		const setViewportSize = (id: string, size: number | undefined) => {
			const columnViewports = ['tablet', 'landscapeMobile', 'portraitMobile'].map((viewportId) => ({
				columnViewportDefinition: viewportId === id ? (size ? {size} : {}) : viewports[viewportId] ? {size: viewports[viewportId]} : {},
				id: viewportId,
			}));

			setDefinition('columnViewports', columnViewports);
		};

		return (
			<div>
				<h3 className="sheet-title">Column</h3>
				<div className="showroom-grid">
					<Field label="Desktop size">
						<input className="form-control form-control-sm" max={12} min={1} onChange={(event) => setDefinition('size', Number(event.target.value))} type="number" value={definition.size ?? 12} />
					</Field>
					{[
						['tablet', 'Tablet size'],
						['landscapeMobile', 'Landscape phone size'],
						['portraitMobile', 'Portrait phone size'],
					].map(([id, label]) => (
						<Field key={id} label={label}>
							<input className="form-control form-control-sm" max={12} min={1} onChange={(event) => setViewportSize(id, event.target.value ? Number(event.target.value) : undefined)} placeholder={id === 'tablet' ? String(definition.size ?? 12) : '12'} type="number" value={viewports[id] ?? ''} />
						</Field>
					))}
				</div>
				<StyleEditor definition={definition} setStyle={setStyle} theme={theme} />
			</div>
		);
	}

	return (
		<div>
			<h3 className="sheet-title">{element.type}</h3>
			<p className="text-secondary">This element type is rendered as a placeholder: it needs Liferay data ({state.collections.length} collections loaded).</p>
		</div>
	);
}

function FragmentProperties({
	definition,
	element,
	patch,
	setDefinition,
	setStyle,
	theme,
}: {
	definition: Record<string, any>;
	element: PageElement;
	patch: (updater: (definition: Record<string, any>) => Record<string, any>) => void;
	setDefinition: (key: string, value: any) => void;
	setStyle: (key: string, value: string) => void;
	theme: Theme | null;
}) {
	const {state} = useStore();

	const found = findFragment(state.collections, definition.fragment);

	const configurationRaw = useMemo(() => {
		if (!found) {
			return {};
		}

		const {configuration} = parseConfiguration(found.fragment.configuration);
		const raw: Record<string, any> = {};

		for (const field of allFields(configuration)) {
			raw[field.name] = definition.fragmentConfig?.[field.name] ?? defaultRawValue(field);
		}

		return raw;
	}, [definition.fragmentConfig, found]);

	const editables = useMemo(() => {
		if (!found) {
			return [];
		}

		return renderFragment(found.fragment, {collection: found.collection, configuration: configurationRaw, imagesPath: '', namespace: 'props', theme}).editables;
	}, [configurationRaw, found, theme]);

	const editableValues = useMemo(() => editableValuesFromFields(definition.fragmentFields), [definition.fragmentFields]);

	const editableTypes: Record<string, string> = {};

	for (const editable of editables) {
		editableTypes[editable.id] = editable.type;
	}

	const setEditable = (id: string, value: EditableValue | null) => {
		const values = {...editableValues};

		if (value === null) {
			delete values[id];
		}
		else {
			values[id] = value;
		}

		setDefinition('fragmentFields', fieldsFromEditableValues(values, editableTypes));
	};

	if (!found) {
		return (
			<div>
				<h3 className="sheet-title">Fragment {definition.fragment?.key}</h3>
				<div className="alert alert-warning">
					<span className="alert-indicator">
						<Icon symbol="warning-full" />
					</span>
					This fragment is not in any loaded collection. Import the collection it belongs to.
				</div>
			</div>
		);
	}

	return (
		<div>
			<h3 className="sheet-title">
				{found.fragment.name} <span className="label label-secondary ml-1">{found.collection.name}</span>
			</h3>
			<Field label="Name in the page editor">
				<input className="form-control form-control-sm" onChange={(event) => setDefinition('name', event.target.value)} type="text" value={definition.name ?? ''} />
			</Field>

			<h4 className="sheet-subtitle">Configuration</h4>
			<ConfigurationControls
				configurationJSON={found.fragment.configuration}
				onChange={(name, value) => patch((current) => ({...current, fragmentConfig: {...(current.fragmentConfig ?? {}), [name]: value}}))}
				theme={theme}
				values={configurationRaw}
			/>

			<h4 className="sheet-subtitle">Editables</h4>
			<EditableControls editables={editables} onChange={setEditable} values={editableValues} />

			<StyleEditor definition={element.definition} setStyle={setStyle} theme={theme} />
			<CustomCSSEditor definition={definition} setDefinition={setDefinition} />
		</div>
	);
}

const SPACING = ['', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

function Section({children, count, title}: {children: React.ReactNode; count?: number; title: string}) {
	return (
		<details className="showroom-details">
			<summary className="showroom-details__summary">
				<Icon className="showroom-details__chevron mr-2" symbol="angle-right" />
				{title}
				{count ? <span className="label label-secondary ml-2">{count}</span> : null}
			</summary>
			<div className="showroom-details__body">{children}</div>
		</details>
	);
}

function StyleEditor({definition, setStyle, theme}: {definition: Record<string, any>; setStyle: (key: string, value: string) => void; theme: Theme | null}) {
	const styles = definition.fragmentStyle ?? {};

	const colorTokens = theme ? Object.values(theme.tokens).filter((token) => token.editorType === 'ColorPicker') : [];

	const colorField = (key: string, label: string) => (
		<Field key={key} label={label}>
			<div className="showroom-color">
				<span className="showroom-swatch" style={{background: swatchColor(styles[key] ?? '', theme)}} />
				<select className="form-control form-control-sm" onChange={(event) => setStyle(key, event.target.value)} value={theme?.tokens[styles[key]] ? styles[key] : ''}>
					<option value="">{styles[key] && !theme?.tokens[styles[key]] ? 'Custom' : 'None'}</option>
					{colorTokens.map((token) => (
						<option key={token.name} value={token.name}>
							{humanize(token.label)}
						</option>
					))}
				</select>
				<input aria-label={`${label} custom value`} className="form-control form-control-sm showroom-color__text" onChange={(event) => setStyle(key, event.target.value)} placeholder="#hex" type="text" value={styles[key] ?? ''} />
			</div>
		</Field>
	);

	const spacingField = (key: string, label: string) => (
		<Field key={key} label={label}>
			<select className="form-control form-control-sm" onChange={(event) => setStyle(key, event.target.value)} value={SPACING.includes(String(styles[key] ?? '')) ? String(styles[key] ?? '') : 'custom'}>
				{SPACING.map((value) => (
					<option key={value} value={value}>
						{value === '' ? '–' : value}
					</option>
				))}
				{!SPACING.includes(String(styles[key] ?? '')) && <option value="custom">{styles[key]}</option>}
			</select>
		</Field>
	);

	const textField = (key: string, label: string, placeholder = '') => (
		<Field key={key} label={label}>
			<input className="form-control form-control-sm" onChange={(event) => setStyle(key, event.target.value)} placeholder={placeholder} type="text" value={styles[key] ?? ''} />
		</Field>
	);

	return (
		<Section count={Object.keys(styles).length} title="Styles">
			<h5 className="showroom-group-title">Spacing (spacer tokens)</h5>
			<div className="showroom-grid showroom-grid--4">
				{spacingField('paddingTop', 'Padding top')}
				{spacingField('paddingRight', 'Padding right')}
				{spacingField('paddingBottom', 'Padding bottom')}
				{spacingField('paddingLeft', 'Padding left')}
				{spacingField('marginTop', 'Margin top')}
				{spacingField('marginRight', 'Margin right')}
				{spacingField('marginBottom', 'Margin bottom')}
				{spacingField('marginLeft', 'Margin left')}
			</div>

			<h5 className="showroom-group-title">Colors</h5>
			<div className="showroom-grid">
				{colorField('backgroundColor', 'Background')}
				{colorField('textColor', 'Text color')}
				{colorField('borderColor', 'Border color')}
			</div>

			<h5 className="showroom-group-title">Size and shape</h5>
			<div className="showroom-grid">
				{textField('width', 'Width', 'e.g. 100%, 320px')}
				{textField('maxWidth', 'Max width', 'e.g. 1200px')}
				{textField('height', 'Height', 'e.g. 400px')}
				{textField('minHeight', 'Min height', 'e.g. 50vh')}
				{textField('borderRadius', 'Border radius', 'e.g. 8px or borderRadiusLg')}
				{textField('borderWidth', 'Border width', 'e.g. 1')}
				<Field label="Shadow">
					<select className="form-control form-control-sm" onChange={(event) => setStyle('shadow', event.target.value)} value={styles.shadow ?? ''}>
						<option value="">–</option>
						<option value="none">none</option>
						<option value="boxShadowSm">boxShadowSm</option>
						<option value="boxShadow">boxShadow</option>
						<option value="boxShadowLg">boxShadowLg</option>
					</select>
				</Field>
				<Field label="Text align">
					<select className="form-control form-control-sm" onChange={(event) => setStyle('textAlign', event.target.value)} value={styles.textAlign ?? ''}>
						<option value="">–</option>
						<option value="left">left</option>
						<option value="center">center</option>
						<option value="right">right</option>
					</select>
				</Field>
				{textField('fontSize', 'Font size', 'e.g. 18px')}
				{textField('fontWeight', 'Font weight', 'e.g. 700 or fontWeightBold')}
				{textField('opacity', 'Opacity', '0–100')}
			</div>
		</Section>
	);
}

function CustomCSSEditor({definition, setDefinition}: {definition: Record<string, any>; setDefinition: (key: string, value: any) => void}) {
	return (
		<Section title="Advanced">
			<Field label="CSS classes">
				<input
					className="form-control form-control-sm"
					onChange={(event) =>
						setDefinition(
							'cssClasses',
							event.target.value
								.split(/\s+/)
								.map((c) => c.trim())
								.filter(Boolean)
						)
					}
					placeholder="my-class another-class"
					type="text"
					value={(definition.cssClasses ?? []).join(' ')}
				/>
			</Field>
			<Field label="Custom CSS (use .[$FRAGMENT_CLASS$] for this element)">
				<textarea className="form-control form-control-sm showroom-code-input" onChange={(event) => setDefinition('customCSS', event.target.value)} rows={4} spellCheck={false} value={definition.customCSS ?? ''} />
			</Field>
		</Section>
	);
}
