import {useEffect, useRef, useState} from 'react';

import {VIEWPORTS} from '../model/types';
import {useStore} from '../store';
import {AddMenu} from './AddMenu';
import {DocsView} from './DocsView';
import {Icon} from './Icon';
import {useTemplateEditing} from './templateEditing';
import {ReleasesView} from './ReleasesView';
import {useRender} from './useRender';

export function Canvas() {
	const {dispatch, state} = useStore();
	const output = useRender();
	const frame = useRef<HTMLIFrameElement>(null);

	const viewport = VIEWPORTS.find((candidate) => candidate.id === state.viewport) ?? VIEWPORTS[0];
	const editing = useTemplateEditing();
	const [rect, setRect] = useState<{height: number; left: number; top: number; width: number} | null>(null);
	const [adding, setAdding] = useState(false);
	const wrapper = useRef<HTMLDivElement>(null);
	const [frameSize, setFrameSize] = useState({height: 0, width: 0});

	useEffect(() => {
		const element = wrapper.current;

		if (!element || typeof ResizeObserver !== 'function') {
			return;
		}

		const observer = new ResizeObserver(() => setFrameSize({height: element.clientHeight, width: element.clientWidth}));

		observer.observe(element);

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			if (event.source === frame.current?.contentWindow && event.data?.type === 'showroom:rect') {
				setRect(event.data.rect ?? null);
			}
		};

		window.addEventListener('message', onMessage);

		return () => window.removeEventListener('message', onMessage);
	}, []);

	useEffect(() => {
		setAdding(false);
	}, [state.selectedItemId, state.selection]);

	useEffect(() => {
		dispatch({type: 'clearRuntimeWarnings'});
	}, [dispatch, output.document]);

	useEffect(() => {
		frame.current?.contentWindow?.postMessage({id: state.selectedItemId, scroll: true, type: 'showroom:select'}, '*');
	}, [state.selectedItemId, output.document]);

	useEffect(() => {
		const iframe = frame.current;

		if (!iframe) {
			return;
		}

		const onLoad = () => {
			iframe.contentWindow?.postMessage({id: state.selectedItemId, scroll: false, type: 'showroom:select'}, '*');
		};

		iframe.addEventListener('load', onLoad);

		return () => iframe.removeEventListener('load', onLoad);
	}, [state.selectedItemId]);

	if (state.selection.kind === 'doc') {
		return <DocsView slug={state.selection.slug} />;
	}

	if (state.selection.kind === 'releases') {
		return <ReleasesView />;
	}

	return (
		<section aria-label="Preview" className="showroom-canvas">
			<div className="showroom-canvas__frame-wrapper" ref={wrapper} style={{maxWidth: viewport.width ? `${viewport.width}px` : undefined}}>
				<iframe className="showroom-canvas__frame" ref={frame} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" srcDoc={output.document} title="Preview" />
				{editing && <FloatingAdd adding={adding} editing={editing} frameSize={frameSize} rect={state.selectedItemId ? rect : null} setAdding={setAdding} />}
			</div>
		</section>
	);
}

/**
 * The "+" that sits on the selected element of a page template (or in the
 * corner of the page when nothing is selected) and opens the add menu there.
 */
function FloatingAdd({adding, editing, frameSize, rect, setAdding}: {adding: boolean; editing: NonNullable<ReturnType<typeof useTemplateEditing>>; frameSize: {height: number; width: number}; rect: {height: number; left: number; top: number; width: number} | null; setAdding: (open: boolean) => void}) {
	const size = 36;
	const margin = 8;

	/* On the selected element's bottom-right corner, kept inside the visible frame; in the frame's corner when the element is scrolled out of view */
	const visible = rect && frameSize.height > 0 && rect.top < frameSize.height && rect.top + rect.height > 0;

	const style = visible
		? {
				left: `${Math.min(Math.max(margin, rect.left + rect.width - size - margin), Math.max(margin, frameSize.width - size - margin))}px`,
				top: `${Math.min(Math.max(margin, rect.top + rect.height - size / 2), Math.max(margin, frameSize.height - size - margin))}px`,
		  }
		: {bottom: '1rem', right: '1rem'};

	const label = editing.after ? 'Add after the selected element' : editing.target.type === 'Root' ? 'Add to the page' : 'Add to the selected container';

	return (
		<div className="showroom-floating-add" style={style}>
			<button aria-expanded={adding} aria-label={label} className="btn btn-primary btn-monospaced showroom-floating-add__button" onClick={() => setAdding(!adding)} title={label} type="button">
				<Icon symbol="plus" />
			</button>
			{adding && <AddMenu editing={editing} onClose={() => setAdding(false)} />}
		</div>
	);
}
