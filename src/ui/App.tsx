import {useEffect} from 'react';

import {importZip} from '../model/zip';
import {readPersistedState, useStore} from '../store';
import {loadBuiltinCollections, loadBuiltinStyleBooks, loadBuiltinTemplates, loadBuiltinThemes} from '../store/load';
import {Canvas} from './Canvas';
import {Icon} from './Icon';
import {Panel} from './Panel';
import {Sidebar} from './Sidebar';
import {Toolbar} from './Toolbar';

export function App() {
	const {dispatch, state} = useStore();

	useEffect(() => {
		let cancelled = false;

		Promise.all([loadBuiltinCollections(), loadBuiltinThemes(), loadBuiltinTemplates(), loadBuiltinStyleBooks()]).then(([collections, themes, templates, styleBooks]) => {
			if (!cancelled) {
				dispatch({collections, persisted: readPersistedState(), styleBooks, templates, themes, type: 'loaded'});
			}
		});

		return () => {
			cancelled = true;
		};
	}, [dispatch]);

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			const data = event.data;

			if (!data || typeof data !== 'object') {
				return;
			}

			if (data.type === 'storybook:warning') {
				dispatch({message: String(data.message), type: 'runtimeWarning'});
			}
			else if (data.type === 'storybook:select') {
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
			const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.name.toLowerCase().endsWith('.zip'));

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
			<div className="cadmin storybook-loading" role="status">
				<div className="storybook-loading__card">
					<span aria-hidden="true" className="storybook-brand__logo storybook-loading__logo">
						<Icon symbol="page-template" />
					</span>
					<div className="storybook-loading__title">Liferay Storybook</div>
					<div className="storybook-loading__subtitle text-secondary">Fragments · Templates · Style books</div>
					<span aria-hidden="true" className="storybook-loading__spinner" />
					<div className="storybook-loading__text text-secondary">Loading themes, fragment collections and style books…</div>
				</div>
			</div>
		);
	}

	return (
		<div className="cadmin storybook">
			<Sidebar />
			<main className="storybook-main">
				<Toolbar />
				<Canvas />
				<Panel />
			</main>
		</div>
	);
}

export async function importFile(file: File, dispatch: ReturnType<typeof useStore>['dispatch']): Promise<void> {
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
