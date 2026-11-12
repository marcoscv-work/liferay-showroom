import {findAction} from './actions';

import type {AIRequest} from './types';

/**
 * The same request as a brief for a coding agent working in the repository:
 * what to do, the rules, the context and where each file goes. It needs no
 * provider, so every AI feature can be handed to an agent today.
 */

const WHERE: Record<AIRequest['action'], string> = {
	'design-system-from-website': 'Write the style book to `style-books/<name>/frontend-tokens-values.json` and `style-book.json`, each fragment to `collections/<set>/<fragment>/` and the home page to `templates/<name>/page-definition.json`. Use a new set under `collections/` named after the design system, with its `collection.json`.',
	'fragment-from-design': 'Write each fragment to `collections/<set>/<fragment>/`: `fragment.json`, `index.html`, `index.css`, `index.js`, `configuration.json` and `README.md`. Pick the set it belongs to, or ask.',
	'review-accessibility': 'Edit the fragment\'s files in place, under `collections/<set>/<fragment>/`, and list each finding in the commit or the pull request.',
	'style-book-from-website': 'Write the style book to `style-books/<name>/`: `style-book.json`, the values in `frontend-tokens-values.json` and, when it adds colours of its own, their definition in `frontend-token-definition.json` (a category "custom" with a set "customColors").',
	'template-from-design': 'Write the page to `templates/<name>/page-definition.json`, and any new fragment to `collections/<set>/<fragment>/`. In the page, refer to a new fragment with the key of the set you put it in, not "ai-drafts".',
	'tokenize-fragment': 'Edit the fragment\'s files in place, under `collections/<set>/<fragment>/`.',
	'write-docs': 'Write the page to `collections/<set>/<fragment>/README.md`.',
};

export function agentBrief(request: AIRequest): string {
	const action = findAction(request.action);
	const inputs: string[] = [];

	if (request.url) {
		inputs.push(`- Read ${request.url}`);
	}

	for (const image of request.images) {
		inputs.push(`- Attach the image "${image.name}" to this conversation.`);
	}

	return [
		`# ${action.title}`,
		'',
		request.system,
		'',
		'## Task',
		'',
		request.prompt,
		...(inputs.length ? ['', '## Inputs', '', ...inputs] : []),
		'',
		'## Where it goes',
		'',
		`This repository is a Liferay Showroom: its folders are the Liferay export layout. ${WHERE[request.action]}`,
		'',
		'Run `npm run build` and `npm test` when you are done: every fragment has to render without errors. Open the result in the showroom (`npm run dev`) and check it against the source before you commit.',
		'',
	].join('\n');
}
