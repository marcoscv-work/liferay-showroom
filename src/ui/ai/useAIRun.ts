import {useCallback, useEffect, useRef, useState} from 'react';

import {getAIProvider} from '../../ai/provider';

import type {AIRequest} from '../../ai/types';

export type AIRunState = {status: 'idle'} | {progress: string; status: 'running'} | {answer: unknown; status: 'done'} | {message: string; status: 'error'};

/**
 * Runs a request on the registered provider and follows it: the line of
 * progress it reports, its answer or its error, and a way to cancel. A run
 * left behind (the dialog closed) is cancelled.
 */
export function useAIRun(): {cancel: () => void; reset: () => void; run: (request: AIRequest) => void; state: AIRunState} {
	const [state, setState] = useState<AIRunState>({status: 'idle'});
	const controller = useRef<AbortController | null>(null);

	const cancel = useCallback(() => {
		controller.current?.abort();
		controller.current = null;
		setState({status: 'idle'});
	}, []);

	useEffect(() => () => controller.current?.abort(), []);

	const run = useCallback((request: AIRequest) => {
		const provider = getAIProvider();

		if (!provider) {
			setState({message: 'No AI provider is connected.', status: 'error'});

			return;
		}

		controller.current?.abort();

		const current = new AbortController();

		controller.current = current;
		setState({progress: 'Starting', status: 'running'});

		provider
			.run(request, {
				onProgress: (progress) => {
					if (!current.signal.aborted) {
						setState({progress, status: 'running'});
					}
				},
				signal: current.signal,
			})
			.then((answer) => {
				if (!current.signal.aborted) {
					setState({answer, status: 'done'});
				}
			})
			.catch((error) => {
				if (!current.signal.aborted) {
					setState({message: error instanceof Error && error.message ? error.message : 'The request failed.', status: 'error'});
				}
			});
	}, []);

	const reset = useCallback(() => setState({status: 'idle'}), []);

	return {cancel, reset, run, state};
}
