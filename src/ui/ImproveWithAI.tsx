import {useEffect, useId, useMemo, useRef, useState} from 'react';

import {AI_ACTIONS, buildRequest} from '../ai/actions';
import {diffHunks, diffLines} from '../ai/diff';
import {useAIProvider} from '../ai/provider';
import {DRAFTS_KEY, DRAFTS_NAME, changedFiles, readImprovement, slug} from '../ai/results';
import {useStore} from '../store';
import {AIError, AIMessages, AIWorking, CopyBriefButton, GenerateButton, ProviderStatus, useAIContext} from './ai/parts';
import {useAIRun} from './ai/useAIRun';
import {Icon} from './Icon';
import {Modal} from './Modal';

import type {AIAction, AIContext} from '../ai/actions';
import type {Collection, Fragment} from '../model/types';

const IMPROVEMENTS = AI_ACTIONS.filter((action) => action.kind === 'improve');

/**
 * The AI features that rework the fragment on screen: a button in its
 * toolbar with the three of them, each opening a dialog that ends in a
 * review of what changed.
 */
export function ImproveWithAI({collection, fragment}: {collection: Collection; fragment: Fragment}) {
	const [open, setOpen] = useState(false);
	const [action, setAction] = useState<AIAction | null>(null);
	const root = useRef<HTMLDivElement>(null);
	const menuId = useId();

	useEffect(() => {
		if (!open) {
			return;
		}

		const onPointerDown = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};

		window.addEventListener('pointerdown', onPointerDown);

		return () => window.removeEventListener('pointerdown', onPointerDown);
	}, [open]);

	return (
		<div
			className="showroom-ai-menu"
			onKeyDown={(event) => {
				if (event.key === 'Escape' && open) {
					setOpen(false);
					root.current?.querySelector('button')?.focus();
				}
			}}
			ref={root}
		>
			<button aria-controls={open ? menuId : undefined} aria-expanded={open} aria-haspopup="menu" className="btn btn-outline-ai btn-sm" onClick={() => setOpen(!open)} type="button">
				<Icon className="mr-1" symbol="stars" />
				Improve with AI
			</button>
			{open && (
				<ul className="dropdown-menu dropdown-menu-ai dropdown-menu-right show showroom-ai-menu__list" id={menuId} role="menu">
					{IMPROVEMENTS.map((candidate) => (
						<li key={candidate.id} role="none">
							<button
								className="dropdown-item showroom-ai-menu__item"
								onClick={() => {
									setOpen(false);
									setAction(candidate);
								}}
								role="menuitem"
								type="button"
							>
								<Icon className="mr-2" symbol={candidate.symbol} />
								<span>
									<span className="showroom-ai-menu__title">{candidate.title}</span>
									<span className="showroom-ai-menu__text">{candidate.description}</span>
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
			{action && <ImproveDialog action={action} collection={collection} fragment={fragment} onClose={() => setAction(null)} />}
		</div>
	);
}

function ImproveDialog({action, collection, fragment, onClose}: {action: AIAction; collection: Collection; fragment: Fragment; onClose: () => void}) {
	const context = useAIContext();
	const provider = useAIProvider();
	const {cancel, reset, run, state} = useAIRun();
	const [notes, setNotes] = useState('');
	const notesId = useId();

	const request = () => buildRequest(action.id, {fragment, notes}, context);

	return (
		<Modal className="showroom-improve" onClose={onClose} title={`${action.title}: ${fragment.name}`}>
			{state.status === 'running' && <AIWorking onCancel={cancel} progress={state.progress} />}
			{state.status === 'error' && <AIError message={state.message} onBack={reset} />}
			{state.status === 'done' && <Review action={action} answer={state.answer} collection={collection} context={context} fragment={fragment} notice={provider?.notice} onClose={onClose} onDiscard={reset} />}
			{state.status === 'idle' && (
				<>
					<div className="showroom-modal__body">
						<p className="showroom-ai-lead">{action.description}</p>
						<div className="form-group">
							<label className="showroom-ai-label" htmlFor={notesId}>
								Anything to add? (optional)
							</label>
							<textarea className="form-control form-control-sm" id={notesId} onChange={(event) => setNotes(event.target.value)} placeholder="What to focus on, or what to leave as it is…" rows={2} value={notes} />
						</div>
						<ProviderStatus />
					</div>
					<div className="showroom-modal__footer">
						<CopyBriefButton request={request} />
						<GenerateButton label="Run" onClick={() => run(request())} />
					</div>
				</>
			)}
		</Modal>
	);
}

function Review({action, answer, collection, context, fragment, notice, onClose, onDiscard}: {action: AIAction; answer: unknown; collection: Collection; context: AIContext; fragment: Fragment; notice?: string; onClose: () => void; onDiscard: () => void}) {
	const {dispatch} = useStore();
	const improvement = useMemo(() => readImprovement(action.id, answer, fragment, context), [action.id, answer, context, fragment]);
	const files = useMemo(() => changedFiles(fragment, improvement.fragment), [fragment, improvement]);
	const [active, setActive] = useState(0);
	const file = files[Math.min(active, files.length - 1)];
	const editable = collection.source === 'imported';

	const apply = () => {
		if (editable) {
			dispatch({collectionKey: collection.key, fragment: improvement.fragment, type: 'updateFragment'});
		}
		else {
			const taken = new Set(context.collections.find((candidate) => candidate.key === DRAFTS_KEY)?.fragments.map((candidate) => candidate.key) ?? []);
			let key = slug(fragment.key) || 'fragment';

			for (let index = 2; taken.has(key); index++) {
				key = `${slug(fragment.key) || 'fragment'}-${index}`;
			}

			dispatch({
				collection: {description: 'Fragments written or reworked with AI, kept as drafts until someone reviews them. Export the set to take them to the repository or to Liferay.', key: DRAFTS_KEY, name: DRAFTS_NAME},
				fragments: [{...improvement.fragment, key, name: `${fragment.name} (AI draft)`}],
				theme: collection.theme ?? context.theme?.key ?? null,
				type: 'addDraftFragments',
			});
			dispatch({selection: {collectionKey: DRAFTS_KEY, fragmentKey: key, kind: 'fragment'}, type: 'select'});
		}

		onClose();
	};

	return (
		<>
			<div className="showroom-modal__body">
				{improvement.changes.length > 0 && (
					<div>
						<h3 className="showroom-ai-subtitle">{action.id === 'review-accessibility' ? 'Findings' : 'Changes'}</h3>
						<ul className="showroom-ai-changes">
							{improvement.changes.map((change, index) => (
								<li className="showroom-ai-change" key={index}>
									<strong>{change.title}</strong>
									{change.detail && <span>{change.detail}</span>}
								</li>
							))}
						</ul>
					</div>
				)}

				{!files.length && <p className="showroom-ai-lead">{improvement.changes.length ? 'None of them changes the fragment\'s files.' : 'Nothing to change: the fragment is as it should be.'}</p>}

				{file && (
					<div>
						<ul className="nav nav-underline showroom-code__tabs" role="tablist">
							{files.map((candidate, index) => (
								<li className="nav-item" key={candidate.name}>
									<button aria-selected={candidate === file} className={`nav-link${candidate === file ? ' active' : ''}`} onClick={() => setActive(index)} role="tab" type="button">
										{candidate.name}
									</button>
								</li>
							))}
						</ul>
						<Diff after={file.after} before={file.before} />
					</div>
				)}

				<AIMessages notice={notice} warnings={improvement.warnings} />

				{files.length > 0 && !editable && <p className="showroom-ai-status">This fragment ships with the showroom, so the reworked version is saved as a copy in the "{DRAFTS_NAME}" set. Export it from there to take it to the repository.</p>}
			</div>
			<div className="showroom-modal__footer">
				<button className="btn btn-secondary btn-sm" onClick={files.length ? onDiscard : onClose} type="button">
					{files.length ? 'Discard' : 'Close'}
				</button>
				{files.length > 0 && (
					<button className="btn btn-primary btn-sm" onClick={apply} type="button">
						{editable ? 'Apply to the fragment' : 'Save a copy as a draft'}
					</button>
				)}
			</div>
		</>
	);
}

/** What changed in a file: the lines removed and added, with a little around them. */
function Diff({after, before}: {after: string; before: string}) {
	const hunks = useMemo(() => diffHunks(diffLines(before, after)), [after, before]);

	return (
		<pre aria-label="Changes" className="showroom-diff">
			{hunks.map((line, index) =>
				line ? (
					<span className={`showroom-diff__line showroom-diff__line--${line.kind}`} key={index}>
						<span aria-hidden="true" className="showroom-diff__mark">
							{line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}
						</span>
						<span className="sr-only">{line.kind === 'added' ? 'Added: ' : line.kind === 'removed' ? 'Removed: ' : ''}</span>
						{line.text || ' '}
						{'\n'}
					</span>
				) : (
					<span className="showroom-diff__gap" key={index}>
						{'⋯\n'}
					</span>
				)
			)}
		</pre>
	);
}
