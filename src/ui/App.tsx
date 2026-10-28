import {useEffect} from 'react';

import {importPageDefinition, importZip} from '../model/zip';
import {readPersistedState, useStore} from '../store';

import type {Selection} from '../store';
import {assetURL, loadBuiltinCollections, loadBuiltinDocs, loadBuiltinStyleBooks, loadBuiltinTemplates, loadBuiltinThemes, loadReleases} from '../store/load';
import {Canvas} from './Canvas';
import {Icon} from './Icon';
import {Panel} from './Panel';
import {Sidebar} from './Sidebar';
import {Toolbar} from './Toolbar';

/**
 * The URL mirrors the selection, Storybook style:
 * `?path=/fragment/<collection>/<fragment>`, `?path=/template/<id>`,
 * `?path=/docs/<slug>` or `?path=/releases`.
 */
export function selectionFromURL(search: string): Selection | null {
	const path = new URLSearchParams(search).get('path');

	if (!path) {
		return null;
	}

	const [, kind, ...rest] = path.split('/');

	if (kind === 'fragment' && rest.length >= 2) {
		return {collectionKey: decodeURIComponent(rest[0]), fragmentKey: decodeURIComponent(rest.slice(1).join('/')), kind: 'fragment'};
	}

	if (kind === 'template' && rest[0]) {
		return {id: decodeURIComponent(rest.join('/')), kind: 'template'};
	}

	if (kind === 'docs' && rest[0]) {
		return {kind: 'doc', slug: decodeURIComponent(rest.join('/')).replace(/#.*$/, '')};
	}

	if (kind === 'releases') {
		return {kind: 'releases'};
	}

	return null;
}

export function urlFromSelection(selection: Selection): string | null {
	if (selection.kind === 'fragment') {
		return `/fragment/${encodeURIComponent(selection.collectionKey)}/${encodeURIComponent(selection.fragmentKey)}`;
	}

	if (selection.kind === 'template') {
		return `/template/${encodeURIComponent(selection.id)}`;
	}

	if (selection.kind === 'doc') {
		return `/docs/${encodeURIComponent(selection.slug)}`;
	}

	if (selection.kind === 'releases') {
		return '/releases';
	}

	return null;
}

export function App() {
	const {dispatch, state} = useStore();

	useEffect(() => {
		let cancelled = false;

		Promise.all([loadBuiltinCollections(), loadBuiltinThemes(), loadBuiltinTemplates(), loadBuiltinStyleBooks(), loadBuiltinDocs(), loadReleases()]).then(([collections, themes, templates, styleBooks, docs, releases]) => {
			if (!cancelled) {
				const persisted = readPersistedState();
				const fromURL = selectionFromURL(window.location.search);

				dispatch({collections, docs, persisted: fromURL ? {...persisted, selection: fromURL} : persisted, releases, styleBooks, templates, themes, type: 'loaded'});
			}
		});

		return () => {
			cancelled = true;
		};
	}, [dispatch]);

	useEffect(() => {
		if (state.loading) {
			return;
		}

		const path = urlFromSelection(state.selection);
		const url = new URL(window.location.href);

		url.search = path ? `?path=${path}` : '';

		if (url.href !== window.location.href) {
			window.history.pushState(null, '', url);
		}
	}, [state.loading, state.selection]);

	useEffect(() => {
		const onPopState = () => {
			const selection = selectionFromURL(window.location.search);

			if (selection) {
				dispatch({selection, type: 'select'});
			}
		};

		window.addEventListener('popstate', onPopState);

		return () => window.removeEventListener('popstate', onPopState);
	}, [dispatch]);

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			const data = event.data;

			if (!data || typeof data !== 'object') {
				return;
			}

			if (data.type === 'showroom:warning') {
				dispatch({message: String(data.message), type: 'runtimeWarning'});
			}
			else if (data.type === 'showroom:editable' && typeof data.id === 'string') {
				dispatch({id: data.id, type: 'focusEditable'});
			}
			else if (data.type === 'showroom:select') {
				dispatch({id: data.id ?? null, type: 'selectItem'});
				dispatch({tab: 'layout', type: 'setPanelTab'});
			}
		};

		window.addEventListener('message', onMessage);

		return () => window.removeEventListener('message', onMessage);
	}, [dispatch]);

	useEffect(() => {
		const onDragOver = (event: DragEvent) => {
			if (event.dataTransfer?.types.includes('Files')) {
				event.preventDefault();
			}
		};

		const onDrop = async (event: DragEvent) => {
			const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => /\.(zip|json)$/i.test(file.name));

			if (!files.length) {
				return;
			}

			event.preventDefault();

			for (const file of files) {
				await importFile(file, dispatch);
			}
		};

		window.addEventListener('dragover', onDragOver);
		window.addEventListener('drop', onDrop);

		return () => {
			window.removeEventListener('dragover', onDragOver);
			window.removeEventListener('drop', onDrop);
		};
	}, [dispatch]);

	if (state.loading) {
		return (
			<div className="cadmin showroom-loading" role="status">
				<div className="showroom-loading__card">
					<span aria-hidden="true" className="showroom-brand__logo showroom-loading__logo">
						<img alt="" src={assetURL('images/showroom-mark.svg')} />
					</span>
					<div className="showroom-loading__title">Liferay Showroom</div>
					<div className="showroom-loading__subtitle text-secondary">Fragments · Templates · Style books</div>
					<span aria-hidden="true" className="showroom-loading__spinner" />
					<div className="showroom-loading__text text-secondary">Loading themes, fragment collections and style books…</div>
				</div>
			</div>
		);
	}

	const showsPanel = state.selection.kind !== 'doc' && state.selection.kind !== 'releases';

	return (
		<div className="cadmin showroom">
			<Sidebar />
			<main className={`showroom-main${showsPanel ? '' : ' showroom-main--page'}`}>
				<Toolbar />
				<Canvas />
				{showsPanel && <Panel />}
			</main>
		</div>
	);
}

export async function importFile(file: File, dispatch: ReturnType<typeof useStore>['dispatch']): Promise<void> {
	if (/\.json$/i.test(file.name)) {
		const imported = importPageDefinition(await file.text(), file.name);

		if (imported.template) {
			dispatch({templates: [imported.template], type: 'addTemplates'});
		}
		else {
			dispatch({message: `Import: ${imported.error}`, type: 'runtimeWarning'});
		}

		return;
	}

	const result = await importZip(await file.arrayBuffer(), file.name);

	if (result.collections.length) {
		dispatch({collections: result.collections, type: 'addCollections'});
	}

	if (result.themes.length) {
		dispatch({themes: result.themes, type: 'addThemes'});
	}

	if (result.styleBooks.length) {
		for (const styleBook of result.styleBooks) {
			dispatch({styleBook, type: 'addStyleBook'});
		}
	}

	if (result.templates.length) {
		dispatch({templates: result.templates, type: 'addTemplates'});
	}

	for (const error of result.errors) {
		dispatch({message: `Import: ${error}`, type: 'runtimeWarning'});
	}

	if (result.collections.length && !result.templates.length) {
		const collection = result.collections[0];

		if (collection.fragments[0]) {
			dispatch({selection: {collectionKey: collection.key, fragmentKey: collection.fragments[0].key, kind: 'fragment'}, type: 'select'});
		}
	}
}
