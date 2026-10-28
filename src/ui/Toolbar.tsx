import {VIEWPORTS} from '../model/types';
import {downloadBlob, exportCollectionZip, exportStyleBookZip, exportTemplateZip, templateDefinitionJSON} from '../model/zip';
import {DEFAULT_STYLE_BOOK_KEY, useCurrentStyleBook, useCurrentTheme, useStore} from '../store';
import {ConfirmButton} from './ConfirmButton';
import {Icon, IconButton} from './Icon';
import {useCurrentTemplate, useRender} from './useRender';

import type {StyleBook, ViewportId} from '../model/types';

const VIEWPORT_ICONS: Record<ViewportId, string> = {
	desktop: 'desktop',
	landscapeMobile: 'mobile-landscape',
	portraitMobile: 'mobile-portrait',
	tablet: 'tablet-portrait',
};

export function Toolbar() {
	const {dispatch, state} = useStore();
	const theme = useCurrentTheme();
	const styleBook = useCurrentStyleBook();
	const template = useCurrentTemplate();
	const output = useRender();

	const doc = state.selection.kind === 'doc' ? state.docs.find((candidate) => candidate.slug === (state.selection as {slug: string}).slug) : null;
	const showsFrame = state.selection.kind === 'fragment' || state.selection.kind === 'template' || state.selection.kind === 'none';

	const title = output.fragment ? `${output.collection?.name ?? ''} / ${output.fragment.name}` : template ? template.name : doc ? doc.title : state.selection.kind === 'releases' ? 'Releases' : 'Liferay Showroom';

	const createStyleBook = (copy: boolean) => {
		const name = copy ? `${styleBook.name} copy` : `Style book ${state.styleBooks.length}`;

		const created: StyleBook = {
			key: `style-book-${Date.now().toString(36)}`,
			name,
			source: 'imported',
			themeKey: theme?.key ?? null,
			values: copy ? {...styleBook.values} : {},
		};

		dispatch({styleBook: created, type: 'addStyleBook'});
	};

	const openPreview = () => {
		const blob = new Blob([output.document], {type: 'text/html'});

		window.open(URL.createObjectURL(blob), '_blank');
	};

	return (
		<header className="showroom-toolbar">
			<h1 className="showroom-toolbar__title text-truncate" title={title}>
				{title}
			</h1>

			<div className="showroom-toolbar__group">
				<label className="showroom-toolbar__label">
					<span className="text-secondary small">Theme</span>
					<select className="form-control form-control-sm" onChange={(event) => dispatch({key: event.target.value, type: 'setTheme'})} value={theme?.key ?? ''}>
						{state.themes.map((candidate) => (
							<option key={candidate.key} value={candidate.key}>
								{candidate.name}
							</option>
						))}
					</select>
				</label>

				<label className="showroom-toolbar__label">
					<span className="text-secondary small">Style book</span>
					<select className="form-control form-control-sm" onChange={(event) => dispatch({key: event.target.value, type: 'setStyleBook'})} value={styleBook.key}>
						{state.styleBooks.map((candidate) => (
							<option key={candidate.key} value={candidate.key}>
								{candidate.name}
								{candidate.themeKey && theme && candidate.themeKey !== theme.key ? ` (${candidate.themeKey})` : ''}
							</option>
						))}
					</select>
				</label>

				<div className="btn-group" role="group" aria-label="Style book actions">
					<IconButton className="btn btn-secondary btn-sm btn-monospaced" label="Create an empty style book" onClick={() => createStyleBook(false)} symbol="plus" />
					<IconButton className="btn btn-secondary btn-sm btn-monospaced" label="Duplicate the current style book" onClick={() => createStyleBook(true)} symbol="copy" />
					<IconButton
						className="btn btn-secondary btn-sm btn-monospaced"
						label="Export the style book as a Liferay zip"
						onClick={async () => downloadBlob(await exportStyleBookZip(styleBook, theme), `${styleBook.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-style-book.zip`)}
						symbol="download"
					/>
					{styleBook.key !== DEFAULT_STYLE_BOOK_KEY && (
						<ConfirmButton className="btn btn-secondary btn-sm btn-monospaced" confirmLabel={<Icon symbol="check" />} onConfirm={() => dispatch({key: styleBook.key, type: 'removeStyleBook'})} title="Delete the style book">
							<Icon symbol="trash" />
						</ConfirmButton>
					)}
				</div>
			</div>

			<div aria-label="Viewport" className="btn-group" role="group">
				{showsFrame && VIEWPORTS.map((viewport) => (
					<IconButton
						className="btn btn-secondary btn-sm btn-monospaced"
						key={viewport.id}
						label={viewport.width ? `${viewport.label} (${viewport.width}px)` : viewport.label}
						onClick={() => dispatch({type: 'setViewport', viewport: viewport.id})}
						pressed={state.viewport === viewport.id}
						symbol={VIEWPORT_ICONS[viewport.id]}
					/>
				))}
			</div>

			<div className="showroom-toolbar__group showroom-toolbar__actions">
				{output.fragment && output.collection && (
					<button
						className="btn btn-secondary btn-sm"
						onClick={async () =>
							downloadBlob(
								await exportCollectionZip({...output.collection!, fragments: [output.fragment!], name: output.fragment!.name}),
								`${output.fragment!.key}-fragment.zip`
							)
						}
						title="Export this fragment alone as a Liferay fragment set zip"
						type="button"
					>
						<Icon className="mr-1" symbol="download" />
						Export fragment
					</button>
				)}
				{template && (
					<>
						<button
							className="btn btn-secondary btn-sm"
							onClick={() => downloadBlob(new Blob([templateDefinitionJSON(template)], {type: 'application/json'}), 'page-definition.json')}
							title="Download page-definition.json"
							type="button"
						>
							<Icon className="mr-1" symbol="code" />
							page-definition.json
						</button>
						<button
							className="btn btn-primary btn-sm"
							onClick={async () => downloadBlob(await exportTemplateZip(template), `${template.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-page-template.zip`)}
							title="Export as a Liferay page template zip"
							type="button"
						>
							<Icon className="mr-1" symbol="download" />
							Export template
						</button>
					</>
				)}
				{showsFrame && <IconButton className="btn btn-secondary btn-sm btn-monospaced" label="Open the rendered page in a new tab" onClick={openPreview} symbol="shortcut" />}
			</div>
		</header>
	);
}
