import {Component, createElement} from 'react';
import {createRoot} from 'react-dom/client';

import type {ComponentType, ErrorInfo, ReactNode} from 'react';

/**
 * Runs inside the preview frame of a React component, with its own React:
 * the component sees the frame's window and document, so portals, media
 * queries and focus behave as on a page. The frame names the component on
 * `<html data-showroom-component>`, carries the first props in
 * `#showroom-component-props` and posts `showroom:component-props` as the
 * controls change, which re-renders without reloading.
 */

const modules = import.meta.glob<{default: ComponentType<any>}>('/components/*/index.{tsx,jsx,ts,js}');

declare global {
	interface Window {
		__showroomReport?: (message: string) => void;
	}
}

function report(message: string) {
	window.__showroomReport?.(message);
}

class Boundary extends Component<{children?: ReactNode; onError: () => void}, {error: Error | null}> {
	state = {error: null as Error | null};

	static getDerivedStateFromError(error: Error) {
		return {error};
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		this.props.onError();
		report(`React: ${error.message}${info.componentStack ? `\n${info.componentStack.trim().split('\n')[0]}` : ''}`);
	}

	render() {
		const {error} = this.state;

		if (error) {
			return createElement('div', {className: 'alert alert-danger', role: 'alert'}, `The component failed to render: ${error.message}`);
		}

		return this.props.children;
	}
}

const key = document.documentElement.dataset.showroomComponent ?? '';
const container = document.getElementById('showroom-component-root');
const loader = Object.entries(modules).find(([path]) => path.startsWith(`/components/${key}/index.`))?.[1];

let props: Record<string, any> = {};

try {
	props = JSON.parse(document.getElementById('showroom-component-props')?.textContent || '{}');
}
catch {
	// No initial props.
}

if (!container || !loader) {
	report(`React component "${key}" is not in the build.`);
}
else {
	const root = createRoot(container);
	let Rendered: ComponentType<any> | null = null;
	let generation = 0;
	let failed = false;

	const render = () => {
		if (Rendered) {
			root.render(createElement(Boundary, {key: generation, onError: () => void (failed = true)}, createElement(Rendered, props)));
		}
	};

	window.addEventListener('message', (event) => {
		if (event.data?.type === 'showroom:component-props') {
			props = event.data.props ?? {};

			/* The component keeps its state across prop changes; after an error, a fresh boundary lets a prop that fixes it render again */
			if (failed) {
				failed = false;
				generation += 1;
			}

			render();
		}
	});

	loader()
		.then((module) => {
			if (typeof module.default !== 'function' && typeof module.default !== 'object') {
				report(`components/${key}: index has no default export.`);

				return;
			}

			Rendered = module.default;
			render();
		})
		.catch((error) => report(`components/${key}: ${(error as Error).message}`));
}
