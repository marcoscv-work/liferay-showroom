import {useEffect, useState} from 'react';

/**
 * The colour scheme of the editor itself (the Clay shell), separate from the
 * theme and style book being previewed. `auto` follows the operating system.
 */
export type EditorScheme = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'liferay-showroom:editor-scheme';
const EVENT = 'showroom:editor-scheme';

export function readEditorScheme(): EditorScheme {
	try {
		const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('liferay-storybook:editor-scheme');

		return stored === 'light' || stored === 'dark' ? stored : 'auto';
	}
	catch {
		return 'auto';
	}
}

export function writeEditorScheme(scheme: EditorScheme): void {
	try {
		if (scheme === 'auto') {
			localStorage.removeItem(STORAGE_KEY);
		}
		else {
			localStorage.setItem(STORAGE_KEY, scheme);
		}
	}
	catch {
		// Not persisted.
	}

	applyEditorScheme(scheme);
	window.dispatchEvent(new CustomEvent(EVENT));
}

export function applyEditorScheme(scheme: EditorScheme): void {
	if (scheme === 'auto') {
		document.documentElement.removeAttribute('data-editor-scheme');
	}
	else {
		document.documentElement.setAttribute('data-editor-scheme', scheme);
	}
}

function systemScheme(): 'light' | 'dark' {
	return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useEditorScheme(): {effective: 'light' | 'dark'; scheme: EditorScheme; setScheme: (scheme: EditorScheme) => void} {
	const [scheme, setSchemeState] = useState<EditorScheme>(readEditorScheme);
	const [system, setSystem] = useState<'light' | 'dark'>(systemScheme);

	useEffect(() => {
		applyEditorScheme(scheme);
	}, [scheme]);

	useEffect(() => {
		const onChange = () => setSchemeState(readEditorScheme());

		window.addEventListener(EVENT, onChange);

		const query = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
		const onSystem = () => setSystem(systemScheme());

		query?.addEventListener('change', onSystem);

		return () => {
			window.removeEventListener(EVENT, onChange);
			query?.removeEventListener('change', onSystem);
		};
	}, []);

	return {effective: scheme === 'auto' ? system : scheme, scheme, setScheme: writeEditorScheme};
}
