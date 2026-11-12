import {useEffect, useMemo, useState} from 'react';

import {agentBrief} from '../../ai/brief';
import {useAIProvider} from '../../ai/provider';
import {useCurrentStyleBook, useCurrentTheme, useStore} from '../../store';
import {Icon} from '../Icon';

import type {AIContext} from '../../ai/actions';
import type {AIRequest} from '../../ai/types';

/** What the AI features know about the showroom as it is now. */
export function useAIContext(): AIContext {
	const {state} = useStore();
	const theme = useCurrentTheme();
	const styleBook = useCurrentStyleBook();

	return useMemo(() => ({collections: state.collections, styleBook, theme}), [state.collections, styleBook, theme]);
}

/** Says where the AI comes from: the provider connected, or that the link to AI Hub is still open. */
export function ProviderStatus() {
	const provider = useAIProvider();

	if (provider) {
		return (
			<p className="showroom-ai-status">
				<Icon className="mr-1" symbol="check-circle" />
				Connected to {provider.name}.{provider.notice ? ` ${provider.notice}` : ''}
			</p>
		);
	}

	return (
		<p className="showroom-ai-status">
			<Icon className="mr-1" symbol="info-circle" />
			AI runs through Liferay AI Hub, which is not connected to this showroom yet. Until it is, prepare a request here and copy it as a brief for a coding agent working in the repository.
		</p>
	);
}

/** Copies the request as a brief for a coding agent, which needs no provider. */
export function CopyBriefButton({disabled, request}: {disabled?: boolean; request: () => AIRequest}) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) {
			return;
		}

		const timeout = window.setTimeout(() => setCopied(false), 2000);

		return () => window.clearTimeout(timeout);
	}, [copied]);

	return (
		<button
			className="btn btn-secondary btn-sm"
			disabled={disabled}
			onClick={async () => {
				await navigator.clipboard?.writeText(agentBrief(request()));
				setCopied(true);
			}}
			title="Copy the request with its rules and context, to give to a coding agent in the repository"
			type="button"
		>
			<Icon className="mr-1" symbol={copied ? 'check' : 'copy'} />
			<span aria-live="polite">{copied ? 'Copied' : 'Copy agent brief'}</span>
		</button>
	);
}

/** The button that starts a run, in Clay's AI style. Disabled, with the reason, while no provider is connected. */
export function GenerateButton({disabled, label = 'Generate', onClick}: {disabled?: boolean; label?: string; onClick: () => void}) {
	const provider = useAIProvider();

	return (
		<button className="btn btn-ai btn-ai-gradient btn-sm showroom-ai-generate" disabled={disabled || !provider} onClick={onClick} title={provider ? undefined : 'Available once Liferay AI Hub is connected'} type="button">
			<Icon className="mr-1" symbol="stars" />
			{label}
		</button>
	);
}

/** What shows while a model works: the line it reports, and a way out. */
export function AIWorking({onCancel, progress}: {onCancel: () => void; progress: string}) {
	return (
		<div className="showroom-ai-working">
			<span aria-hidden="true" className="showroom-ai-working__orb">
				<Icon symbol="stars" />
			</span>
			<p aria-live="polite" className="showroom-ai-working__text" role="status">
				{progress}…
			</p>
			<button className="btn btn-secondary btn-sm" onClick={onCancel} type="button">
				Cancel
			</button>
		</div>
	);
}

export function AIMessages({notes, notice, warnings}: {notes?: string[]; notice?: string; warnings: string[]}) {
	return (
		<>
			{notice && (
				<div className="alert alert-info py-2">
					<span className="alert-indicator">
						<Icon symbol="info-circle" />
					</span>
					{notice}
				</div>
			)}
			{notes && notes.length > 0 && (
				<div className="showroom-ai-notes">
					<h4 className="showroom-ai-subtitle">Notes from the model</h4>
					<ul>
						{notes.map((note, index) => (
							<li key={index}>{note}</li>
						))}
					</ul>
				</div>
			)}
			{warnings.length > 0 && (
				<div className="alert alert-warning py-2">
					<span className="alert-indicator">
						<Icon symbol="warning-full" />
					</span>
					<strong className="lead">Check before you keep it.</strong>
					<ul className="showroom-ai-warnings">
						{warnings.map((warning, index) => (
							<li key={index}>{warning}</li>
						))}
					</ul>
				</div>
			)}
		</>
	);
}

export function AIError({message, onBack}: {message: string; onBack: () => void}) {
	return (
		<div className="showroom-ai-result">
			<div className="alert alert-danger" role="alert">
				<span className="alert-indicator">
					<Icon symbol="exclamation-full" />
				</span>
				{message}
			</div>
			<div className="showroom-modal__footer">
				<button className="btn btn-secondary btn-sm" onClick={onBack} type="button">
					Back
				</button>
			</div>
		</div>
	);
}
