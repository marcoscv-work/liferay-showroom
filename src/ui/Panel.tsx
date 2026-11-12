import {useCallback, useEffect, useRef, useState} from 'react';

import {componentArgsKey} from '../model/components';
import {fragmentArgsKey, useCurrentTheme, useStore} from '../store';
import {CodePanel} from './CodePanel';
import {ConfigurationControls} from './controls/ConfigurationControls';
import {EditableControls} from './controls/EditableControls';
import {Icon} from './Icon';
import {LayoutPanel} from './LayoutPanel';
import {Markdown} from './Markdown';
import {StyleBookPanel} from './StyleBookPanel';
import {useRender} from './useRender';

import type {PanelTab} from '../store';

export function Panel() {
	const {dispatch, state} = useStore();
	const output = useRender();

	const warnings = [...output.warnings, ...state.runtimeWarnings];

	const tabs: {id: PanelTab; label: string; symbol: string}[] = [];

	if (state.selection.kind === 'template') {
		tabs.push({id: 'layout', label: 'Layout', symbol: 'columns'});
	}
	else {
		tabs.push({id: 'controls', label: 'Controls', symbol: 'cog'});

		if (output.fragment?.docs || output.component?.docs) {
			tabs.push({id: 'docs', label: 'Docs', symbol: 'document-text'});
		}
	}

	tabs.push({id: 'stylebook', label: 'Style book', symbol: 'color-picker'}, {id: 'code', label: 'Code', symbol: 'code'}, {id: 'warnings', label: warnings.length ? `Warnings (${warnings.length})` : 'Warnings', symbol: 'warning-full'});

	const active = tabs.some((tab) => tab.id === state.panelTab) ? state.panelTab : tabs[0].id;

	const resize = usePanelResize();

	return (
		<section aria-label="Addons" className="showroom-panel">
			<div
				aria-label="Resize the panel"
				aria-orientation="horizontal"
				aria-valuemax={clampPanelHeight(window.innerHeight)}
				aria-valuemin={MIN_PANEL_HEIGHT}
				aria-valuenow={resize.height}
				className="showroom-panel__resizer"
				role="separator"
				tabIndex={0}
				title="Drag to resize, or use the arrow keys"
				{...resize.props}
			/>
			<ul className="nav nav-underline showroom-panel__tabs" role="tablist">
				{tabs.map((tab) => (
					<li className="nav-item" key={tab.id}>
						<button aria-selected={tab.id === active} className={`nav-link btn btn-unstyled${tab.id === active ? ' active' : ''}`} onClick={() => dispatch({tab: tab.id, type: 'setPanelTab'})} role="tab" type="button">
							<Icon className="mr-2" symbol={tab.symbol} />
							{tab.label}
						</button>
					</li>
				))}
			</ul>

			<div className="showroom-panel__content">
				{active === 'controls' && (output.component ? <ComponentControls /> : <FragmentControls />)}
				{active === 'docs' && (output.fragment?.docs || output.component?.docs) && <Markdown markdown={(output.fragment?.docs || output.component?.docs)!} />}
				{active === 'layout' && <LayoutPanel />}
				{active === 'stylebook' && <StyleBookPanel />}
				{active === 'code' && <CodePanel />}
				{active === 'warnings' && (
					<div>
						{!warnings.length && (
							<div className="alert alert-success mb-0">
								<span className="alert-indicator">
									<Icon symbol="check-circle-full" />
								</span>
								<strong className="lead">Clean.</strong> Nothing needed Liferay to render.
							</div>
						)}
						{warnings.map((warning, index) => (
							<div className="alert alert-warning py-2" key={`${warning}-${index}`}>
								<span className="alert-indicator">
									<Icon symbol="warning-full" />
								</span>
								<span className="showroom-mono showroom-warning">{warning}</span>
							</div>
						))}
					</div>
				)}
			</div>
		</section>
	);
}

const MIN_PANEL_HEIGHT = 160;

/** How much of the window the preview keeps whatever the panel is dragged to. */
const PREVIEW_RESERVE = 200;

function clampPanelHeight(height: number): number {
	return Math.round(Math.min(Math.max(MIN_PANEL_HEIGHT, height), Math.max(MIN_PANEL_HEIGHT, window.innerHeight - PREVIEW_RESERVE)));
}

/**
 * The bar that resizes the panel. It captures the pointer while it is
 * dragged: the preview above it is an iframe, which would otherwise take the
 * pointer the moment it moved over it, and the drag would stop following and
 * never see the button released. The arrow keys resize it too.
 */
function usePanelResize(): {height: number; props: React.HTMLAttributes<HTMLDivElement>} {
	const [height, setHeight] = useState(() => {
		try {
			return Number(localStorage.getItem('liferay-showroom:panel-height') ?? localStorage.getItem('liferay-storybook:panel-height')) || 320;
		}
		catch {
			return 320;
		}
	});
	const drag = useRef<{height: number; pointer: number; y: number} | null>(null);
	const [dragging, setDragging] = useState(false);

	useEffect(() => {
		document.documentElement.style.setProperty('--sb-panel-height', `${height}px`);

		try {
			localStorage.setItem('liferay-showroom:panel-height', String(height));
		}
		catch {
			// Not persisted.
		}
	}, [height]);

	/* While dragging, nothing else reacts to the pointer and no text gets selected */
	useEffect(() => {
		document.documentElement.classList.toggle('showroom-resizing', dragging);

		return () => document.documentElement.classList.remove('showroom-resizing');
	}, [dragging]);

	const stop = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		if (!drag.current) {
			return;
		}

		if (event.currentTarget.hasPointerCapture(drag.current.pointer)) {
			event.currentTarget.releasePointerCapture(drag.current.pointer);
		}

		drag.current = null;
		setDragging(false);
	}, []);

	return {
		height,
		props: {
			onKeyDown: (event) => {
				const step = event.shiftKey ? 64 : 16;
				const next = event.key === 'ArrowUp' ? (current: number) => current + step : event.key === 'ArrowDown' ? (current: number) => current - step : event.key === 'Home' ? () => MIN_PANEL_HEIGHT : event.key === 'End' ? () => window.innerHeight : null;

				if (next) {
					event.preventDefault();
					setHeight((current) => clampPanelHeight(next(current)));
				}
			},
			onLostPointerCapture: stop,
			onPointerCancel: stop,
			onPointerDown: (event) => {
				if (event.button !== 0) {
					return;
				}

				event.preventDefault();
				event.currentTarget.setPointerCapture(event.pointerId);
				drag.current = {height, pointer: event.pointerId, y: event.clientY};
				setDragging(true);
			},
			onPointerMove: (event) => {
				if (drag.current) {
					setHeight(clampPanelHeight(drag.current.height + (drag.current.y - event.clientY)));
				}
			},
			onPointerUp: stop,
		},
	};
}

/** A React component's props, as the same controls a fragment's configuration gets. */
function ComponentControls() {
	const {dispatch, state} = useStore();
	const theme = useCurrentTheme();
	const output = useRender();

	if (!output.component) {
		return null;
	}

	const key = componentArgsKey(output.component.key);
	const args = state.fragmentArgs[key] ?? {configuration: {}, editables: {}};

	return (
		<ConfigurationControls
			configurationJSON={output.component.configuration}
			emptyText="This component declares no props. Describe them in its configuration.json to get controls."
			onChange={(name, value) => dispatch({args: {...args, configuration: {...args.configuration, [name]: value}}, key, type: 'setFragmentArgs'})}
			onReset={() => dispatch({key, type: 'resetFragmentArgs'})}
			theme={theme}
			values={output.configurationRaw}
		/>
	);
}

function FragmentControls() {
	const {dispatch, state} = useStore();
	const theme = useCurrentTheme();
	const output = useRender();

	if (!output.fragment) {
		return <p className="text-secondary">Select a fragment to see its controls.</p>;
	}

	const fragment = output.fragment;
	const key = fragmentArgsKey(fragment.collectionKey, fragment.key);
	const args = state.fragmentArgs[key] ?? {configuration: {}, editables: {}};

	return (
		<div>
			<ConfigurationControls
				configurationJSON={fragment.configuration}
				onChange={(name, value) => dispatch({args: {...args, configuration: {...args.configuration, [name]: value}}, key, type: 'setFragmentArgs'})}
				onReset={() => dispatch({key, type: 'resetFragmentArgs'})}
				theme={theme}
				values={output.configurationRaw}
			/>

			<h3 className="sheet-subtitle mt-4">Editables</h3>
			<EditableControls
				editables={output.editables}
				focused={state.focusedEditable}
				onChange={(id, value) => {
					const editables = {...args.editables};

					if (value === null) {
						delete editables[id];
					}
					else {
						editables[id] = value;
					}

					dispatch({args: {...args, editables}, key, type: 'setFragmentArgs'});
				}}
				values={args.editables}
			/>
		</div>
	);
}
