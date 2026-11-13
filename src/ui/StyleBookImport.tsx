import {useId, useMemo, useRef, useState} from 'react';

import {buildRequest} from '../ai/actions';
import {useAIProvider} from '../ai/provider';
import {proposalFromColors, readStyleBookProposal, styleBookFromProposal} from '../ai/results';
import {extractColors} from '../model/colors';
import {humanize} from '../model/liferayContext';
import {BODY_TOKENS, pageBackground} from '../model/tokens';
import {useStore} from '../store';
import {AIError, AIMessages, AIWorking, CopyBriefButton, GenerateButton, ProviderStatus, useAIContext} from './ai/parts';
import {useAIRun} from './ai/useAIRun';
import {Icon} from './Icon';
import {closeImportDialog, readImages, setImportImages} from './importDialog';
import {ContrastChip} from './StyleBookColors';

import type {AIAction, AIContext} from '../ai/actions';
import type {AIImage, StyleBookProposal} from '../ai/types';

function isURL(text: string): boolean {
	try {
		return /^https?:$/.test(new URL(text.trim()).protocol);
	}
	catch {
		return false;
	}
}

/**
 * A style book from the colours of a brand. The colours come from a website
 * or a screenshot, which a model has to read, or from a stylesheet or a
 * tokens file pasted here, which the showroom reads itself: that part works
 * with no model at all, and ends in the same review.
 */
export function StyleBookImport({action, images, onBack}: {action: AIAction; images: AIImage[]; onBack: () => void}) {
	const context = useAIContext();
	const provider = useAIProvider();
	const {cancel, reset, run, state} = useAIRun();
	const [url, setURL] = useState('');
	const [source, setSource] = useState('');
	const [notes, setNotes] = useState('');
	const [local, setLocal] = useState<StyleBookProposal | null>(null);
	const imageInput = useRef<HTMLInputElement>(null);
	const fileInput = useRef<HTMLInputElement>(null);
	const urlId = useId();
	const sourceId = useId();
	const notesId = useId();

	const colors = useMemo(() => (source.trim() ? extractColors(source) : []), [source]);
	const ready = images.length > 0 || isURL(url) || colors.length > 0;
	const request = () => buildRequest(action.id, {colors, images, notes, url: isURL(url) ? url.trim() : undefined}, context);

	if (local) {
		return <ProposalReview context={context} onDiscard={() => setLocal(null)} proposal={local} />;
	}

	if (state.status === 'running') {
		return <AIWorking onCancel={cancel} progress={state.progress} />;
	}

	if (state.status === 'error') {
		return <AIError message={state.message} onBack={reset} />;
	}

	if (state.status === 'done') {
		return <ProposalReview context={context} notice={provider?.notice} onDiscard={reset} proposal={readStyleBookProposal(state.answer, context)} />;
	}

	return (
		<>
			<div className="showroom-modal__body">
				<p className="showroom-ai-lead">{action.description}</p>

				<div className="form-group">
					<label className="showroom-ai-label" htmlFor={sourceId}>
						Stylesheet or design tokens
					</label>
					<textarea
						className="form-control form-control-sm showroom-mono"
						id={sourceId}
						onChange={(event) => setSource(event.target.value)}
						placeholder={':root { --brand: #7414ff; --ink: #1c1c24; }\n\nor a tokens file: {"brand": {"500": {"$value": "#7414ff"}}}'}
						rows={4}
						spellCheck={false}
						value={source}
					/>
					<input
						accept=".css,.scss,.less,.json,.txt,text/css,application/json"
						hidden
						onChange={async (event) => {
							const file = event.target.files?.[0];

							if (file) {
								setSource(await file.text());
							}

							event.target.value = '';
						}}
						ref={fileInput}
						type="file"
					/>
					<div className="showroom-stylebook-import__found">
						<button className="btn btn-secondary btn-sm" onClick={() => fileInput.current?.click()} type="button">
							<Icon className="mr-1" symbol="upload" />
							Choose a file
						</button>
						<span aria-live="polite" className="showroom-ai-hint">
							{source.trim() ? `${colors.length} colour${colors.length === 1 ? '' : 's'} found` : 'Paste the CSS of the site, its custom properties, or a tokens export from Figma or Style Dictionary. This part needs no AI.'}
						</span>
						{colors.length > 0 && (
							<span aria-hidden="true" className="showroom-stylebook-import__strip">
								{colors.slice(0, 24).map((color, index) => (
									<span key={index} style={{background: color.hex}} title={`${color.name ?? ''} ${color.hex}`.trim()} />
								))}
							</span>
						)}
					</div>
				</div>

				<div className="form-group">
					<label className="showroom-ai-label" htmlFor={urlId}>
						Website (read by AI)
					</label>
					<input className="form-control form-control-sm" id={urlId} inputMode="url" onChange={(event) => setURL(event.target.value)} placeholder="https://www.example.com" type="url" value={url} />
				</div>

				<div className="form-group">
					<span className="showroom-ai-label">Screenshots (read by AI)</span>
					<input
						accept="image/png,image/jpeg,image/webp,image/gif"
						hidden
						multiple
						onChange={async (event) => {
							const read = await readImages(Array.from(event.target.files ?? []));

							setImportImages([...images, ...read.images]);
							event.target.value = '';
						}}
						ref={imageInput}
						type="file"
					/>
					{images.length > 0 && (
						<ul aria-label="Screenshots" className="showroom-import__tray">
							{images.map((image, index) => (
								<li className="showroom-import__thumb" key={`${image.name}-${index}`}>
									<img alt="" src={`data:${image.mediaType};base64,${image.data}`} />
									<span className="text-truncate">{image.name}</span>
									<button aria-label={`Remove ${image.name}`} className="btn btn-unstyled btn-sm btn-monospaced" onClick={() => setImportImages(images.filter((_, other) => other !== index))} title="Remove" type="button">
										<Icon symbol="times" />
									</button>
								</li>
							))}
						</ul>
					)}
					<button className="btn btn-secondary btn-sm" onClick={() => imageInput.current?.click()} type="button">
						<Icon className="mr-1" symbol="picture" />
						{images.length ? 'Add another image' : 'Choose an image'}
					</button>
				</div>

				<div className="form-group">
					<label className="showroom-ai-label" htmlFor={notesId}>
						Anything to add? (optional)
					</label>
					<textarea className="form-control form-control-sm" id={notesId} onChange={(event) => setNotes(event.target.value)} placeholder="Which colour is the brand's, what to leave out…" rows={2} value={notes} />
				</div>

				<ProviderStatus />
			</div>
			<div className="showroom-modal__footer">
				<button className="btn btn-secondary btn-sm mr-auto" onClick={onBack} type="button">
					<Icon className="mr-1" symbol="angle-left" />
					Back
				</button>
				<CopyBriefButton disabled={!ready} request={request} />
				{colors.length > 0 && (
					<button className="btn btn-secondary btn-sm" onClick={() => setLocal(proposalFromColors(colors, context))} title="Review the colours found, without AI: the ones named after a theme token go to it, the rest become colours of the style book" type="button">
						Review the {colors.length} colour{colors.length === 1 ? '' : 's'}
					</button>
				)}
				<GenerateButton disabled={!ready} label="Map with AI" onClick={() => run(request())} />
			</div>
		</>
	);
}

/** The proposal, colour by colour: what each would change, how it reads on the page, and a say on each. */
function ProposalReview({context, notice, onDiscard, proposal}: {context: AIContext; notice?: string; onDiscard: () => void; proposal: StyleBookProposal}) {
	const {dispatch} = useStore();
	const [name, setName] = useState(proposal.name);
	const [mapped, setMapped] = useState<Set<number>>(() => new Set(proposal.mappings.map((_, index) => index)));
	const [added, setAdded] = useState<Set<number>>(() => new Set(proposal.customColors.flatMap((color, index) => (color.suggested ? [index] : []))));
	const [labels, setLabels] = useState<string[]>(() => proposal.customColors.map((color) => color.label));
	const nameId = useId();

	/* Contrast is measured on the page the style book would give: its own background when it sets one */
	const background = useMemo(() => {
		const index = proposal.mappings.findIndex((mapping, candidate) => mapped.has(candidate) && BODY_TOKENS.includes(mapping.token.name));

		return index === -1 ? pageBackground(context.theme, context.styleBook) : proposal.mappings[index].value;
	}, [context, mapped, proposal]);

	const toggle = (set: Set<number>, update: (next: Set<number>) => void, index: number) => {
		const next = new Set(set);

		if (!next.delete(index)) {
			next.add(index);
		}

		update(next);
	};

	const count = mapped.size + added.size;

	const create = () => {
		const styleBook = styleBookFromProposal(
			name,
			proposal.mappings.filter((_, index) => mapped.has(index)),
			proposal.customColors.flatMap((color, index) => (added.has(index) ? [{...color, label: labels[index].trim() || color.label}] : [])),
			context
		);

		/* The new style book opens on its page, where its colours can go on being edited */
		dispatch({styleBook, type: 'addStyleBook'});
		dispatch({selection: {key: styleBook.key, kind: 'styleBook'}, type: 'select'});
		closeImportDialog();
	};

	return (
		<>
			<div className="showroom-modal__body">
				<div className="form-group">
					<label className="showroom-ai-label" htmlFor={nameId}>
						Style book name
					</label>
					<input className="form-control form-control-sm" id={nameId} onChange={(event) => setName(event.target.value)} type="text" value={name} />
				</div>

				{proposal.mappings.length > 0 && (
					<div>
						<h3 className="showroom-ai-subtitle">Theme tokens to change</h3>
						<table className="table table-autofit table-sm showroom-table showroom-proposal">
							<thead>
								<tr>
									<th scope="col">
										<span className="sr-only">Use</span>
									</th>
									<th className="table-cell-expand" scope="col">
										Token
									</th>
									<th scope="col">Now</th>
									<th scope="col">Proposed</th>
									<th scope="col">On the page</th>
									<th className="table-cell-expand-small" scope="col">
										From
									</th>
								</tr>
							</thead>
							<tbody>
								{proposal.mappings.map((mapping, index) => (
									<tr key={mapping.token.name}>
										<td>
											<input aria-label={`Use ${mapping.value} for ${humanize(mapping.token.label)}`} checked={mapped.has(index)} onChange={() => toggle(mapped, setMapped, index)} type="checkbox" />
										</td>
										<th className="showroom-table__name" scope="row">
											{humanize(mapping.token.label)}
											<span className="d-block text-secondary small font-weight-normal showroom-mono">{mapping.token.name}</span>
										</th>
										<td>
											<Swatch value={mapping.current} />
										</td>
										<td>
											<Swatch value={mapping.value} />
										</td>
										<td>{/bg|background|surface/i.test(mapping.token.name) ? <span className="text-secondary small">a background</span> : <ContrastChip background={background} color={mapping.value} />}</td>
										<td className="text-secondary small">{mapping.source}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{proposal.customColors.length > 0 && (
					<div>
						<h3 className="showroom-ai-subtitle">Colours to add</h3>
						<p className="text-secondary small mb-2">No theme token covers these. Each one picked becomes a colour of the style book, which you can rename, change or remove afterwards.</p>
						<table className="table table-autofit table-sm showroom-table showroom-proposal">
							<thead>
								<tr>
									<th scope="col">
										<span className="sr-only">Add</span>
									</th>
									<th className="table-cell-expand" scope="col">
										Name
									</th>
									<th scope="col">Colour</th>
									<th scope="col">On the page</th>
									<th className="table-cell-expand-small" scope="col">
										From
									</th>
								</tr>
							</thead>
							<tbody>
								{proposal.customColors.map((color, index) => (
									<tr key={`${color.value}-${index}`}>
										<td>
											<input aria-label={`Add ${labels[index]} (${color.value})`} checked={added.has(index)} onChange={() => toggle(added, setAdded, index)} type="checkbox" />
										</td>
										<td>
											<input aria-label={`Name of ${color.value}`} className="form-control form-control-sm" onChange={(event) => setLabels(labels.map((label, other) => (other === index ? event.target.value : label)))} type="text" value={labels[index]} />
										</td>
										<td>
											<Swatch value={color.value} />
										</td>
										<td>
											<ContrastChip background={background} color={color.value} />
										</td>
										<td className="text-secondary small">{color.source}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				<AIMessages notes={proposal.notes} notice={notice} warnings={proposal.warnings} />
			</div>
			<div className="showroom-modal__footer">
				<button className="btn btn-secondary btn-sm" onClick={onDiscard} type="button">
					Discard
				</button>
				<button className="btn btn-primary btn-sm" disabled={!count} onClick={create} type="button">
					Create the style book ({count})
				</button>
			</div>
		</>
	);
}

function Swatch({value}: {value: string}) {
	return (
		<span className="showroom-proposal__swatch">
			<span aria-hidden="true" className="showroom-swatch" style={{background: value}} />
			<span className="showroom-mono">{value}</span>
		</span>
	);
}
