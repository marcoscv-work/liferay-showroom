import {useMemo, useRef} from 'react';

import {VIEWPORTS} from '../model/types';
import {useCurrentStyleBook, useCurrentTheme, useStore} from '../store';
import {buildSpecimen} from './specimen';
import {StyleBookPanel} from './StyleBookPanel';
import {useColorScheme} from './useRender';

/**
 * A style book on a page of its own: its editor at full size, and next to it
 * a specimen that shows the style book at work and follows every change.
 */
export function StyleBookView() {
	const {state} = useStore();
	const theme = useCurrentTheme();
	const styleBook = useCurrentStyleBook();
	const colorScheme = useColorScheme();
	const frame = useRef<HTMLIFrameElement>(null);
	const scroll = useRef(0);
	const shown = useRef('');

	const specimen = useMemo(() => buildSpecimen({collections: state.collections, colorScheme, styleBook, theme}), [colorScheme, state.collections, styleBook, theme]);

	/* The specimen reloads with every change: remember how far it was scrolled, to put it back */
	if (shown.current !== specimen) {
		scroll.current = frame.current?.contentWindow?.scrollY ?? scroll.current;
		shown.current = specimen;
	}

	const viewport = VIEWPORTS.find((candidate) => candidate.id === state.viewport) ?? VIEWPORTS[0];

	return (
		<section aria-label="Style book" className="showroom-stylebook-page">
			<div className="showroom-stylebook-page__editor">
				<StyleBookPanel />
			</div>
			<aside aria-label="Preview of the style book" className="showroom-stylebook-page__preview">
				<div className="showroom-stylebook-page__frame" style={{maxWidth: viewport.width ? `${viewport.width}px` : undefined}}>
					<iframe onLoad={() => frame.current?.contentWindow?.scrollTo(0, scroll.current)} ref={frame} sandbox="allow-scripts allow-same-origin" srcDoc={specimen} title="Style book preview" />
				</div>
			</aside>
		</section>
	);
}
