import {useStore} from '../store';
import {Icon} from './Icon';
import {Markdown} from './Markdown';

/** A documentation page in the main area, in place of the preview frame. */
export function DocsView({slug}: {slug: string}) {
	const {state} = useStore();

	const page = state.docs.find((candidate) => candidate.slug === slug) ?? null;

	if (!page) {
		return (
			<section aria-label="Documentation" className="showroom-docs-view">
				<div className="alert alert-warning">
					<span className="alert-indicator">
						<Icon symbol="warning-full" />
					</span>
					There is no page called {slug}.
				</div>
			</section>
		);
	}

	return (
		<section aria-label="Documentation" className="showroom-docs-view">
			<article className="showroom-docs-view__page">
				<Markdown markdown={page.markdown} />
			</article>
		</section>
	);
}
