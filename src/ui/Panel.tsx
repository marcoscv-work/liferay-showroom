import {useCallback, useEffect, useState} from 'react';

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

		if (output.fragment?.docs) {
			tabs.push({id: 'docs', label: 'Docs', symbol: 'document-text'});
		}
	}

	tabs.push({id: 'stylebook', label: 'Style book', symbol: 'color-picker'}, {id: 'code', label: 'Code', symbol: 'code'}, {id: 'warnings', label: warnings.length ? `Warnings (${warnings.length})` : 'Warnings', symbol: 'warning-full'});

	const active = tabs.some((tab) => tab.id === state.panelTab) ? state.panelTab : tabs[0].id;

	const resize = usePanelResize();

	return (
		<section aria-label="Addons" className="storybook-panel">
			<div aria-hidden="true" className="storybook-panel__resizer" onPointerDown={resize} title="Drag to resize" />
			<ul className="nav nav-underline storybook-panel__tabs" role="tablist">
				{tabs.map((tab) => (
					<li className="nav-item" key={tab.id}>
						<button aria-selected={tab.id === active} className={`nav-link btn btn-unstyled${tab.id === active ? ' active' : ''}`} onClick={() => dispatch({tab: tab.id, type: 'setPanelTab'})} role="tab" type="button">
							<Icon className="mr-2" symbol={tab.symbol} />
							{tab.label}
						</button>
					</li>
				))}
			</ul>

			<div className="storybook-panel__content">
				{active === 'controls' && <FragmentControls />}
				{active === 'docs' && output.fragment?.docs && <Markdown markdown={output.fragment.docs} />}
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
								<span className="storybook-mono storybook-warning">{warning}</span>
							</div>
						))}
					</div>
				)}
			</div>
		</section>
	);
}

function usePanelResize() {
	const [height, setHeight] = useState(() => {
		try {
			return Number(localStorage.getItem('liferay-storybook:panel-height')) || 320;
		}
		catch {
			return 320;
		}
	});

	useEffect(() => {
		document.documentElement.style.setProperty('--sb-panel-height', `${height}px`);

		try {
			localStorage.setItem('liferay-storybook:panel-height', String(height));
		}
		catch {
			// Not persisted.
		}
	}, [height]);

	return useCallback(
		(event: React.PointerEvent) => {
			const startY = event.clientY;
			const startHeight = height;

			const onMove = (move: PointerEvent) => {
				setHeight(Math.min(Math.max(160, startHeight + (startY - move.clientY)), window.innerHeight - 200));
			};

			const onUp = () => {
				window.removeEventListener('pointermove', onMove);
				window.removeEventListener('pointerup', onUp);
			};

			window.addEventListener('pointermove', onMove);
			window.addEventListener('pointerup', onUp);
		},
		[height]
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
