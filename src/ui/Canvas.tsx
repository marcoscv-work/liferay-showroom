import {useEffect, useRef} from 'react';

import {VIEWPORTS} from '../model/types';
import {useStore} from '../store';
import {useRender} from './useRender';

export function Canvas() {
	const {dispatch, state} = useStore();
	const output = useRender();
	const frame = useRef<HTMLIFrameElement>(null);

	const viewport = VIEWPORTS.find((candidate) => candidate.id === state.viewport) ?? VIEWPORTS[0];

	useEffect(() => {
		dispatch({type: 'clearRuntimeWarnings'});
	}, [dispatch, output.document]);

	useEffect(() => {
		frame.current?.contentWindow?.postMessage({id: state.selectedItemId, scroll: true, type: 'storybook:select'}, '*');
	}, [state.selectedItemId, output.document]);

	useEffect(() => {
		const iframe = frame.current;

		if (!iframe) {
			return;
		}

		const onLoad = () => {
			iframe.contentWindow?.postMessage({id: state.selectedItemId, scroll: false, type: 'storybook:select'}, '*');
		};

		iframe.addEventListener('load', onLoad);

		return () => iframe.removeEventListener('load', onLoad);
	}, [state.selectedItemId]);

	return (
		<section aria-label="Preview" className="storybook-canvas">
			<div className="storybook-canvas__frame-wrapper" style={{maxWidth: viewport.width ? `${viewport.width}px` : undefined}}>
				<iframe className="storybook-canvas__frame" ref={frame} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" srcDoc={output.document} title="Preview" />
			</div>
		</section>
	);
}
