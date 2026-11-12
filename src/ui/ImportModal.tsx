import {useId, useMemo, useRef, useState} from 'react';

import {AI_ACTIONS, buildRequest} from '../ai/actions';
import {useAIProvider} from '../ai/provider';
import {DRAFTS_KEY, DRAFTS_NAME, readResult} from '../ai/results';
import {useStore} from '../store';
import {importFile} from './App';
import {AIError, AIMessages, AIWorking, CopyBriefButton, GenerateButton, ProviderStatus, useAIContext} from './ai/parts';
import {useAIRun} from './ai/useAIRun';
import {Icon} from './Icon';
import {closeImportDialog, isAssetFile, readImages, setImportImages, useImportDialog} from './importDialog';
import {Modal} from './Modal';
import {StyleBookImport} from './StyleBookImport';

import type {AIAction, AIContext} from '../ai/actions';
import type {AIImage, AIResult} from '../ai/types';

const DRAFTS_DESCRIPTION = 'Fragments written with AI, kept as drafts until someone reviews them. Export the set to take them to the repository or to Liferay.';

/**
 * The import dialog: Liferay exports go in by dropping or choosing them, and
 * a design, a Figma frame or a website goes in through one of the AI
 * features, which turn it into drafts to review.
 */
export function ImportModal() {
	const dialog = useImportDialog();

	if (!dialog.open) {
		return null;
	}

	return <ImportDialog images={dialog.images} notice={dialog.notice} />;
}

function ImportDialog({images, notice}: {images: AIImage[]; notice: string}) {
	const [action, setAction] = useState<AIAction | null>(null);

	return (
		<Modal className="showroom-import" onClose={closeImportDialog} title={action ? action.title : 'Import'}>
			{!action && <Home images={images} notice={notice} onPick={setAction} />}
			{action?.id === 'style-book-from-website' && <StyleBookImport action={action} images={images} onBack={() => setAction(null)} />}
			{action && action.id !== 'style-book-from-website' && <ActionView action={action} images={images} onBack={() => setAction(null)} />}
		</Modal>
	);
}

function Home({images, notice, onPick}: {images: AIImage[]; notice: string; onPick: (action: AIAction) => void}) {
	const {dispatch} = useStore();
	const input = useRef<HTMLInputElement>(null);
	const [over, setOver] = useState(false);
	const [rejected, setRejected] = useState<string[]>([]);

	const onFiles = async (list: FileList | null) => {
		const files = Array.from(list ?? []);
		const assets = files.filter(isAssetFile);

		for (const file of assets) {
			await importFile(file, dispatch);
		}

		const read = await readImages(files);

		setRejected(read.rejected);

		if (read.images.length) {
			setImportImages([...images, ...read.images]);
		}
		else if (assets.length && !read.rejected.length) {
			closeImportDialog();
		}

		if (input.current) {
			input.current.value = '';
		}
	};

	return (
		<div className="showroom-modal__body">
			<input accept=".zip,.json,image/png,image/jpeg,image/webp,image/gif" hidden multiple onChange={(event) => onFiles(event.target.files)} ref={input} type="file" />

			{/* The window takes the drop itself (see App), so this only shows where and offers the file chooser */}
			<button className={`showroom-import__zone${over ? ' showroom-import__zone--over' : ''}`} onClick={() => input.current?.click()} onDragEnter={() => setOver(true)} onDragLeave={() => setOver(false)} onDrop={() => setOver(false)} type="button">
				<Icon className="showroom-import__zone-icon" symbol="upload" />
				<span className="showroom-import__zone-title">Drop files here, or choose them</span>
				<span className="showroom-import__zone-text">Liferay exports: fragment sets, page templates, style books, built themes or a page-definition.json. Or an image of a design, to build from it with AI.</span>
			</button>

			{(notice || rejected.length > 0) && (
				<div className="alert alert-warning py-2" role="alert">
					<span className="alert-indicator">
						<Icon symbol="warning-full" />
					</span>
					{notice || `Too large to use (5 MB at most): ${rejected.join(', ')}.`}
				</div>
			)}

			<ImageTray images={images} />

			<section aria-labelledby="showroom-ai-create" className="showroom-ai-section">
				<h3 className="showroom-ai-heading" id="showroom-ai-create">
					<Icon className="mr-2" symbol="stars" />
					Create with AI
				</h3>
				<div className="showroom-ai-cards">
					{AI_ACTIONS.filter((candidate) => candidate.kind === 'create').map((candidate) => (
						<button className="showroom-ai-card" key={candidate.id} onClick={() => onPick(candidate)} type="button">
							<span aria-hidden="true" className="showroom-ai-card__icon">
								<Icon symbol={candidate.symbol} />
							</span>
							<span className="showroom-ai-card__title">{candidate.title}</span>
							<span className="showroom-ai-card__text">{candidate.description}</span>
						</button>
					))}
				</div>
				<ProviderStatus />
				<p className="showroom-ai-status">
					<Icon className="mr-1" symbol="stars" />
					To rework a fragment that is already here (design tokens, accessibility, docs), open it and use Improve with AI in its toolbar.
				</p>
			</section>
		</div>
	);
}

function ImageTray({images}: {images: AIImage[]}) {
	if (!images.length) {
		return null;
	}

	return (
		<ul aria-label="Images to build from" className="showroom-import__tray">
			{images.map((image, index) => (
				<li className="showroom-import__thumb" key={`${image.name}-${index}`}>
					<img alt="" src={`data:${image.mediaType};base64,${image.data}`} />
					<span className="text-truncate" title={image.name}>
						{image.name}
					</span>
					<button aria-label={`Remove ${image.name}`} className="btn btn-unstyled btn-sm btn-monospaced" onClick={() => setImportImages(images.filter((_, other) => other !== index))} title="Remove" type="button">
						<Icon symbol="times" />
					</button>
				</li>
			))}
		</ul>
	);
}

function isURL(text: string): boolean {
	try {
		return /^https?:$/.test(new URL(text.trim()).protocol);
	}
	catch {
		return false;
	}
}

function ActionView({action, images, onBack}: {action: AIAction; images: AIImage[]; onBack: () => void}) {
	const context = useAIContext();
	const provider = useAIProvider();
	const {cancel, reset, run, state} = useAIRun();
	const [url, setURL] = useState('');
	const [notes, setNotes] = useState('');
	const input = useRef<HTMLInputElement>(null);
	const urlId = useId();
	const notesId = useId();

	const ready = images.length > 0 || isURL(url);
	const request = () => buildRequest(action.id, {images, notes, url: isURL(url) ? url.trim() : undefined}, context);

	if (state.status === 'running') {
		return <AIWorking onCancel={cancel} progress={state.progress} />;
	}

	if (state.status === 'error') {
		return <AIError message={state.message} onBack={reset} />;
	}

	if (state.status === 'done') {
		return <ResultView answer={state.answer} action={action} context={context} notice={provider?.notice} onDiscard={reset} />;
	}

	return (
		<>
			<div className="showroom-modal__body">
				<p className="showroom-ai-lead">{action.description}</p>

				<div className="form-group">
					<span className="showroom-ai-label">{action.id === 'design-system-from-website' ? 'Screenshots (optional)' : 'The design'}</span>
					<input
						accept="image/png,image/jpeg,image/webp,image/gif"
						hidden
						multiple
						onChange={async (event) => {
							const read = await readImages(Array.from(event.target.files ?? []));

							setImportImages([...images, ...read.images]);
							event.target.value = '';
						}}
						ref={input}
						type="file"
					/>
					<ImageTray images={images} />
					<button className="btn btn-secondary btn-sm" onClick={() => input.current?.click()} type="button">
						<Icon className="mr-1" symbol="picture" />
						{images.length ? 'Add another image' : 'Choose an image'}
					</button>
					<span className="showroom-ai-hint">or drop it anywhere on the window</span>
				</div>

				<div className="form-group">
					<label className="showroom-ai-label" htmlFor={urlId}>
						{action.id === 'design-system-from-website' ? 'Website' : 'Figma link (optional)'}
					</label>
					<input className="form-control form-control-sm" id={urlId} inputMode="url" onChange={(event) => setURL(event.target.value)} placeholder={action.id === 'design-system-from-website' ? 'https://design.example.com' : 'https://www.figma.com/design/…'} type="url" value={url} />
				</div>

				<div className="form-group">
					<label className="showroom-ai-label" htmlFor={notesId}>
						Anything to add? (optional)
					</label>
					<textarea className="form-control form-control-sm" id={notesId} onChange={(event) => setNotes(event.target.value)} placeholder="Which part of the design to take, a variant you need, what to leave out…" rows={2} value={notes} />
				</div>

				<ProviderStatus />
			</div>
			<div className="showroom-modal__footer">
				<button className="btn btn-secondary btn-sm mr-auto" onClick={onBack} type="button">
					<Icon className="mr-1" symbol="angle-left" />
					Back
				</button>
				<CopyBriefButton disabled={!ready} request={request} />
				<GenerateButton disabled={!ready} onClick={() => run(request())} />
			</div>
		</>
	);
}

function ResultView({action, answer, context, notice, onDiscard}: {action: AIAction; answer: unknown; context: AIContext; notice?: string; onDiscard: () => void}) {
	const {dispatch} = useStore();
	const result: AIResult = useMemo(() => readResult(action.id, answer, context), [action.id, answer, context]);
	const empty = !result.fragments.length && !result.template && !result.styleBook;

	const keep = () => {
		dispatch({collection: {description: DRAFTS_DESCRIPTION, key: DRAFTS_KEY, name: DRAFTS_NAME}, fragments: result.fragments, theme: context.theme?.key ?? null, type: 'addDraftFragments'});

		if (result.styleBook) {
			dispatch({styleBook: result.styleBook, type: 'addStyleBook'});
		}

		if (result.template) {
			dispatch({templates: [result.template], type: 'addTemplates'});
		}
		else if (result.fragments[0]) {
			dispatch({selection: {collectionKey: DRAFTS_KEY, fragmentKey: result.fragments[0].key, kind: 'fragment'}, type: 'select'});
		}

		closeImportDialog();
	};

	return (
		<>
			<div className="showroom-modal__body">
				{!empty && (
					<>
						<h3 className="showroom-ai-subtitle">Drafts to review</h3>
						<ul className="showroom-ai-drafts">
							{result.styleBook && (
								<li>
									<Icon className="mr-2" symbol="color-picker" />
									Style book <strong>{result.styleBook.name}</strong>, {Object.keys(result.styleBook.values).length} token value(s)
								</li>
							)}
							{result.fragments.map((fragment) => (
								<li key={fragment.key}>
									<Icon className="mr-2" symbol="cards2" />
									Fragment <strong>{fragment.name}</strong>
								</li>
							))}
							{result.template && (
								<li>
									<Icon className="mr-2" symbol="page" />
									Page template <strong>{result.template.name}</strong>
								</li>
							)}
						</ul>
					</>
				)}
				<AIMessages notes={result.notes} notice={notice} warnings={result.warnings} />
				{!empty && <p className="showroom-ai-status">Nothing is published: the fragments go to the "{DRAFTS_NAME}" set in this browser, where you can open, edit, export or delete them.</p>}
			</div>
			<div className="showroom-modal__footer">
				<button className="btn btn-secondary btn-sm" onClick={onDiscard} type="button">
					Discard
				</button>
				{!empty && (
					<button className="btn btn-primary btn-sm" onClick={keep} type="button">
						Keep as drafts
					</button>
				)}
			</div>
		</>
	);
}
