import {useSyncExternalStore} from 'react';

import type {AIProvider} from './types';

/**
 * Where the AI features get their model. The showroom registers no provider
 * of its own: AI configuration belongs to Liferay AI Hub, and that link is
 * open. Whatever connects it calls `registerAIProvider`, from the bundle or
 * from the page through `window.LiferayShowroom.ai.registerProvider`, and
 * every feature starts working, since each one only needs `provider.run`.
 */

let current: AIProvider | null = null;

const listeners = new Set<() => void>();

export function registerAIProvider(provider: AIProvider | null): void {
	current = provider;

	for (const listener of listeners) {
		listener();
	}
}

export function getAIProvider(): AIProvider | null {
	return current;
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);

	return () => listeners.delete(listener);
}

export function useAIProvider(): AIProvider | null {
	return useSyncExternalStore(subscribe, getAIProvider, getAIProvider);
}

declare global {
	interface Window {
		LiferayShowroom?: {ai: {registerProvider: (provider: AIProvider | null) => void}};
	}
}

/** Opens the registration to the page and starts the demo provider when the address asks for it (`?ai=demo`). */
export function initAI(): void {
	if (typeof window === 'undefined') {
		return;
	}

	window.LiferayShowroom = {...window.LiferayShowroom, ai: {registerProvider: registerAIProvider}};

	if (new URLSearchParams(window.location.search).get('ai') === 'demo') {
		import('./demo').then(({demoProvider}) => {
			if (!current) {
				registerAIProvider(demoProvider);
			}
		});
	}
}
