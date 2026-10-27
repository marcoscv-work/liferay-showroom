import {createContext, useContext, useEffect, useMemo, useReducer} from 'react';

import type {Dispatch, ReactNode} from 'react';

import type {EditableValue} from '../model/fragmentRenderer';
import type {Collection, PageElement, PageTemplate, StyleBook, Theme, ViewportId} from '../model/types';

export type Selection = {kind: 'fragment'; collectionKey: string; fragmentKey: string} | {kind: 'template'; id: string} | {kind: 'none'};

export type PanelTab = 'controls' | 'stylebook' | 'layout' | 'code' | 'warnings';

export interface FragmentArgs {
	configuration: Record<string, any>;
	editables: Record<string, EditableValue>;
}

export interface State {
	collections: Collection[];
	fragmentArgs: Record<string, FragmentArgs>;
	loading: boolean;
	panelTab: PanelTab;
	runtimeWarnings: string[];
	selectedItemId: string | null;
	selection: Selection;
	styleBookKey: string;
	styleBooks: StyleBook[];
	templates: PageTemplate[];
	themeKey: string;
	themes: Theme[];
	viewport: ViewportId;
}

export const DEFAULT_STYLE_BOOK_KEY = 'theme-defaults';

export const initialState: State = {
	collections: [],
	fragmentArgs: {},
	loading: true,
	panelTab: 'controls',
	runtimeWarnings: [],
	selectedItemId: null,
	selection: {kind: 'none'},
	styleBookKey: DEFAULT_STYLE_BOOK_KEY,
	styleBooks: [{key: DEFAULT_STYLE_BOOK_KEY, name: 'Theme defaults', source: 'builtin', themeKey: null, values: {}}],
	templates: [],
	themeKey: 'classic',
	themes: [],
	viewport: 'desktop',
};

export type Action =
	| {type: 'loaded'; collections: Collection[]; styleBooks: StyleBook[]; templates: PageTemplate[]; themes: Theme[]; persisted: Partial<PersistedState>}
	| {type: 'select'; selection: Selection}
	| {type: 'setPanelTab'; tab: PanelTab}
	| {type: 'setTheme'; key: string}
	| {type: 'setStyleBook'; key: string}
	| {type: 'setViewport'; viewport: ViewportId}
	| {type: 'setFragmentArgs'; key: string; args: FragmentArgs}
	| {type: 'resetFragmentArgs'; key: string}
	| {type: 'setTokenValue'; name: string; value: string | null}
	| {type: 'addStyleBook'; styleBook: StyleBook; select?: boolean}
	| {type: 'renameStyleBook'; key: string; name: string}
	| {type: 'removeStyleBook'; key: string}
	| {type: 'addCollections'; collections: Collection[]}
	| {type: 'removeCollection'; key: string}
	| {type: 'addThemes'; themes: Theme[]}
	| {type: 'addTemplates'; templates: PageTemplate[]; select?: boolean}
	| {type: 'updateTemplate'; id: string; root: PageElement}
	| {type: 'renameTemplate'; id: string; name: string}
	| {type: 'removeTemplate'; id: string}
	| {type: 'selectItem'; id: string | null}
	| {type: 'runtimeWarning'; message: string}
	| {type: 'clearRuntimeWarnings'}
	| {type: 'resetAll'};

export interface PersistedState {
	collections: Collection[];
	fragmentArgs: Record<string, FragmentArgs>;
	selection: Selection;
	styleBookKey: string;
	styleBooks: StyleBook[];
	templates: PageTemplate[];
	themeKey: string;
	viewport: ViewportId;
}

const STORAGE_KEY = 'liferay-storybook:v1';

export function fragmentArgsKey(collectionKey: string, fragmentKey: string): string {
	return `${collectionKey}/${fragmentKey}`;
}

function reducer(state: State, action: Action): State {
	switch (action.type) {
		case 'loaded': {
			const {persisted} = action;

			const collections = [...action.collections, ...(persisted.collections ?? [])];
			const persistedStyleBooks = (persisted.styleBooks ?? []).filter((styleBook) => styleBook.key !== DEFAULT_STYLE_BOOK_KEY);
			const styleBooks = [
				...initialState.styleBooks,
				...action.styleBooks.map((styleBook) => persistedStyleBooks.find((candidate) => candidate.key === styleBook.key) ?? styleBook),
				...persistedStyleBooks.filter((styleBook) => !styleBook.key.startsWith('builtin-')),
			];

			const themeKey = action.themes.some((theme) => theme.key === persisted.themeKey) ? persisted.themeKey! : action.themes[0]?.key ?? 'classic';

			const persistedTemplates = persisted.templates ?? [];
			const templates = [...action.templates.map((template) => persistedTemplates.find((candidate) => candidate.id === template.id) ?? template), ...persistedTemplates.filter((template) => !template.id.startsWith('builtin-'))];

			let selection = persisted.selection ?? initialState.selection;

			if (selection.kind === 'fragment') {
				const {collectionKey, fragmentKey} = selection;

				if (!collections.some((collection) => collection.key === collectionKey && collection.fragments.some((fragment) => fragment.key === fragmentKey))) {
					selection = {kind: 'none'};
				}
			}

			if (selection.kind === 'template') {
				const {id} = selection;

				if (!templates.some((template) => template.id === id)) {
					selection = {kind: 'none'};
				}
			}

			if (selection.kind === 'none' && collections[0]?.fragments[0]) {
				selection = {kind: 'fragment', collectionKey: collections[0].key, fragmentKey: collections[0].fragments[0].key};
			}

			return {
				...state,
				collections,
				fragmentArgs: persisted.fragmentArgs ?? {},
				loading: false,
				panelTab: selection.kind === 'template' ? 'layout' : 'controls',
				selection,
				styleBookKey: styleBooks.some((styleBook) => styleBook.key === persisted.styleBookKey) ? persisted.styleBookKey! : DEFAULT_STYLE_BOOK_KEY,
				styleBooks,
				templates,
				themeKey,
				themes: action.themes,
				viewport: persisted.viewport ?? 'desktop',
			};
		}
		case 'select': {
			let themeKey = state.themeKey;
			let styleBookKey = state.styleBookKey;

			if (action.selection.kind === 'fragment') {
				const {collectionKey} = action.selection;
				const collection = state.collections.find((candidate) => candidate.key === collectionKey);

				if (collection?.theme && collection.theme !== state.themeKey && state.themes.some((theme) => theme.key === collection.theme)) {
					themeKey = collection.theme;

					const current = state.styleBooks.find((styleBook) => styleBook.key === state.styleBookKey);

					if (current?.themeKey && current.themeKey !== themeKey) {
						styleBookKey = state.styleBooks.find((styleBook) => styleBook.themeKey === themeKey)?.key ?? DEFAULT_STYLE_BOOK_KEY;
					}
				}
			}

			return {
				...state,
				panelTab: action.selection.kind === 'template' ? (state.panelTab === 'controls' ? 'layout' : state.panelTab) : state.panelTab === 'layout' ? 'controls' : state.panelTab,
				runtimeWarnings: [],
				selectedItemId: null,
				selection: action.selection,
				styleBookKey,
				themeKey,
			};
		}
		case 'setPanelTab':
			return {...state, panelTab: action.tab};
		case 'setTheme':
			return {...state, runtimeWarnings: [], themeKey: action.key};
		case 'setStyleBook':
			return {...state, styleBookKey: action.key};
		case 'setViewport':
			return {...state, viewport: action.viewport};
		case 'setFragmentArgs':
			return {...state, fragmentArgs: {...state.fragmentArgs, [action.key]: action.args}};
		case 'resetFragmentArgs': {
			const fragmentArgs = {...state.fragmentArgs};

			delete fragmentArgs[action.key];

			return {...state, fragmentArgs};
		}
		case 'setTokenValue':
			return {
				...state,
				styleBooks: state.styleBooks.map((styleBook) => {
					if (styleBook.key !== state.styleBookKey) {
						return styleBook;
					}

					const values = {...styleBook.values};

					if (action.value === null) {
						delete values[action.name];
					}
					else {
						values[action.name] = action.value;
					}

					return {...styleBook, values};
				}),
			};
		case 'addStyleBook':
			return {...state, styleBookKey: action.select === false ? state.styleBookKey : action.styleBook.key, styleBooks: [...state.styleBooks, action.styleBook]};
		case 'renameStyleBook':
			return {...state, styleBooks: state.styleBooks.map((styleBook) => (styleBook.key === action.key ? {...styleBook, name: action.name} : styleBook))};
		case 'removeStyleBook':
			return {
				...state,
				styleBookKey: state.styleBookKey === action.key ? DEFAULT_STYLE_BOOK_KEY : state.styleBookKey,
				styleBooks: state.styleBooks.filter((styleBook) => styleBook.key !== action.key || styleBook.key === DEFAULT_STYLE_BOOK_KEY || styleBook.source === 'builtin'),
			};
		case 'addCollections':
			return {...state, collections: [...state.collections, ...action.collections]};
		case 'removeCollection': {
			const collections = state.collections.filter((collection) => collection.key !== action.key);

			const selection = state.selection.kind === 'fragment' && state.selection.collectionKey === action.key ? ({kind: 'none'} as Selection) : state.selection;

			return {...state, collections, selection};
		}
		case 'addThemes':
			return {...state, themeKey: action.themes[0]?.key ?? state.themeKey, themes: [...state.themes, ...action.themes]};
		case 'addTemplates': {
			const templates = [...state.templates, ...action.templates];

			if (action.select !== false && action.templates[0]) {
				return {...state, panelTab: 'layout', selectedItemId: null, selection: {kind: 'template', id: action.templates[0].id}, templates};
			}

			return {...state, templates};
		}
		case 'updateTemplate':
			return {...state, templates: state.templates.map((template) => (template.id === action.id ? {...template, root: action.root} : template))};
		case 'renameTemplate':
			return {...state, templates: state.templates.map((template) => (template.id === action.id ? {...template, name: action.name} : template))};
		case 'removeTemplate': {
			const templates = state.templates.filter((template) => template.id !== action.id);
			const selection = state.selection.kind === 'template' && state.selection.id === action.id ? ({kind: 'none'} as Selection) : state.selection;

			return {...state, selection, templates};
		}
		case 'selectItem':
			return {...state, selectedItemId: action.id};
		case 'runtimeWarning':
			return state.runtimeWarnings.includes(action.message) ? state : {...state, runtimeWarnings: [...state.runtimeWarnings, action.message]};
		case 'clearRuntimeWarnings':
			return state.runtimeWarnings.length ? {...state, runtimeWarnings: []} : state;
		case 'resetAll':
			return {...state, fragmentArgs: {}, styleBookKey: DEFAULT_STYLE_BOOK_KEY, styleBooks: state.styleBooks.filter((styleBook) => styleBook.source === 'builtin'), templates: state.templates.filter((template) => template.source === 'builtin'), collections: state.collections.filter((collection) => collection.source === 'builtin')};
	}
}

export function readPersistedState(): Partial<PersistedState> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);

		return raw ? JSON.parse(raw) : {};
	}
	catch {
		return {};
	}
}

function persist(state: State): void {
	const persisted: PersistedState = {
		collections: state.collections.filter((collection) => collection.source === 'imported'),
		fragmentArgs: state.fragmentArgs,
		selection: state.selection,
		styleBookKey: state.styleBookKey,
		styleBooks: state.styleBooks.filter((styleBook) => styleBook.key !== DEFAULT_STYLE_BOOK_KEY || Object.keys(styleBook.values).length > 0),
		templates: state.templates,
		themeKey: state.themeKey,
		viewport: state.viewport,
	};

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
	}
	catch {
		// Quota exceeded or storage disabled: the session simply is not persisted.
	}
}

const StoreContext = createContext<{state: State; dispatch: Dispatch<Action>} | null>(null);

export function StoreProvider({children}: {children: ReactNode}) {
	const [state, dispatch] = useReducer(reducer, initialState);

	useEffect(() => {
		if (!state.loading) {
			persist(state);
		}
	}, [state]);

	const value = useMemo(() => ({dispatch, state}), [state]);

	return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
	const store = useContext(StoreContext);

	if (!store) {
		throw new Error('useStore must be used inside StoreProvider');
	}

	return store;
}

export function useCurrentTheme(): Theme | null {
	const {state} = useStore();

	return state.themes.find((theme) => theme.key === state.themeKey) ?? state.themes[0] ?? null;
}

export function useCurrentStyleBook(): StyleBook {
	const {state} = useStore();

	return state.styleBooks.find((styleBook) => styleBook.key === state.styleBookKey) ?? state.styleBooks[0];
}
