import DOMPurify from 'dompurify';
import {useEffect, useMemo, useRef, useState} from 'react';

import {parseMarkdown} from '../docs/markdown';
import {effectiveTokenValue} from '../model/tokens';
import {useCurrentStyleBook, useCurrentTheme, useStore} from '../store';
import {selectionFromURL} from './App';
import {Icon} from './Icon';
import {buildFragmentStory, buildTemplateStory, findFragmentByKey} from './story';
import {useColorScheme} from './useRender';

import type {EmbedSpec} from '../docs/markdown';
import type {EditableValue} from '../model/fragmentRenderer';
import type {FrontendToken} from '../model/types';

const sanitize = (html: string) => DOMPurify.sanitize(html, {ADD_ATTR: ['target']});

/**
 * Renders documentation Markdown. Plain blocks become HTML; the `fragment`,
 * `template` and `tokens` blocks become live previews on the current theme
 * and style book. Links to other pages and assets select them in place.
 */
export function Markdown({markdown}: {markdown: string}) {
	const {dispatch} = useStore();
	const parsed = useMemo(() => parseMarkdown(markdown, {sanitize}), [markdown]);

	const onClick = (event: React.MouseEvent) => {
		const link = (event.target as HTMLElement).closest?.('a[href]');

		if (!link) {
			return;
		}

		const href = link.getAttribute('href') ?? '';

		if (!href.startsWith('?path=')) {
			return;
		}

		const selection = selectionFromURL(href);

		if (selection) {
			event.preventDefault();
			dispatch({selection, type: 'select'});
		}
	};

	return (
		<div className="storybook-docs" onClick={onClick}>
			{parsed.segments.map((segment, index) =>
				segment.type === 'html' ? <div className="storybook-docs__prose" dangerouslySetInnerHTML={{__html: segment.html}} key={index} /> : <Embed key={index} spec={segment.spec} />
			)}
		</div>
	);
}

function Embed({spec}: {spec: EmbedSpec}) {
	switch (spec.kind) {
		case 'fragment':
			return <FragmentEmbed options={spec.options} />;
		case 'template':
			return <TemplateEmbed options={spec.options} />;
		case 'tokens':
			return <TokensEmbed options={spec.options} />;
		default:
			return null;
	}
}

const RESERVED = new Set(['collection', 'key', 'height', 'id', 'name', 'title']);

function FragmentEmbed({options}: {options: Record<string, string>}) {
	const {dispatch, state} = useStore();
	const theme = useCurrentTheme();
	const styleBook = useCurrentStyleBook();
	const colorScheme = useColorScheme();

	const found = options.key ? findFragmentByKey(state.collections, options.key, options.collection || undefined) : null;

	const story = useMemo(() => {
		if (!found) {
			return null;
		}

		const configuration: Record<string, any> = {};
		const editables: Record<string, EditableValue> = {};

		for (const [name, value] of Object.entries(options)) {
			if (RESERVED.has(name)) {
				continue;
			}

			if (name.startsWith('editable.')) {
				// `editable.text-1: Hello` sets the text; `editable.link-1.href: /x` one property of a link or image
				const [id, property = 'text'] = name.slice('editable.'.length).split('.');

				editables[id] = {...(editables[id] ?? {}), [property]: value};
			}
			else {
				configuration[name] = value === 'true' ? true : value === 'false' ? false : value;
			}
		}

		return buildFragmentStory(found.fragment, found.collection, {configuration, editables}, {collections: state.collections, colorScheme, styleBook, theme}, {namespace: `doc${options.key.replace(/[^a-z0-9]/gi, '')}`, padding: 'py-3'});
	}, [colorScheme, found, options, state.collections, styleBook, theme]);

	if (!found || !story) {
		return <EmbedMissing what={`fragment "${options.key ?? ''}"`} />;
	}

	const caption = options.title ?? `${found.collection.name} / ${found.fragment.name}`;

	return (
		<figure className="storybook-embed">
			<AutoFrame document={story.document} height={options.height} title={caption} />
			<figcaption className="storybook-embed__caption">
				<Icon className="mr-1" symbol="code" />
				<button className="btn btn-unstyled storybook-embed__link" onClick={() => dispatch({selection: {collectionKey: found.collection.key, fragmentKey: found.fragment.key, kind: 'fragment'}, type: 'select'})} type="button">
					{caption}
				</button>
				{Object.keys(story.configurationRaw).length > 0 && (
					<span className="storybook-embed__args storybook-mono">
						{Object.entries(options)
							.filter(([name]) => !RESERVED.has(name))
							.map(([name, value]) => `${name}=${value}`)
							.join(' ')}
					</span>
				)}
			</figcaption>
		</figure>
	);
}

function TemplateEmbed({options}: {options: Record<string, string>}) {
	const {dispatch, state} = useStore();
	const theme = useCurrentTheme();
	const styleBook = useCurrentStyleBook();
	const colorScheme = useColorScheme();

	const template = state.templates.find((candidate) => candidate.id === options.id || candidate.name === options.name) ?? null;

	const story = useMemo(() => (template ? buildTemplateStory(template, {collections: state.collections, colorScheme, styleBook, theme}, 'view') : null), [colorScheme, state.collections, styleBook, template, theme]);

	if (!template || !story) {
		return <EmbedMissing what={`page template "${options.id ?? options.name ?? ''}"`} />;
	}

	return (
		<figure className="storybook-embed">
			<AutoFrame document={story.document} height={options.height ?? '480'} scroll title={template.name} />
			<figcaption className="storybook-embed__caption">
				<Icon className="mr-1" symbol="page" />
				<button className="btn btn-unstyled storybook-embed__link" onClick={() => dispatch({selection: {id: template.id, kind: 'template'}, type: 'select'})} type="button">
					{options.title ?? template.name}
				</button>
			</figcaption>
		</figure>
	);
}

function TokensEmbed({options}: {options: Record<string, string>}) {
	const theme = useCurrentTheme();
	const styleBook = useCurrentStyleBook();

	if (!theme) {
		return <EmbedMissing what="theme" />;
	}

	const wanted = (options.category ?? options.set ?? '').toLowerCase();

	const sets: {label: string; tokens: FrontendToken[]}[] = [];

	for (const category of theme.categories) {
		const categoryMatches = !options.category || category.name.toLowerCase() === wanted || category.label.toLowerCase() === wanted;

		for (const set of category.sets) {
			const setMatches = options.set ? set.name.toLowerCase() === options.set.toLowerCase() || set.label.toLowerCase() === options.set.toLowerCase() : categoryMatches;

			if (setMatches) {
				sets.push({label: `${category.label} / ${set.label}`, tokens: set.tokens});
			}
		}
	}

	if (!sets.length) {
		return <EmbedMissing what={`tokens "${options.category ?? options.set ?? ''}" in ${theme.name}`} />;
	}

	return (
		<div className="storybook-embed storybook-embed--tokens">
			{sets.map((set) => (
				<table className="table table-sm storybook-tokens-table" key={set.label}>
					<caption className="storybook-embed__caption">{set.label}</caption>
					<thead>
						<tr>
							<th scope="col">Token</th>
							<th scope="col">CSS variable</th>
							<th scope="col">{styleBook.name}</th>
						</tr>
					</thead>
					<tbody>
						{set.tokens.map((token) => {
							const value = effectiveTokenValue(theme, styleBook, token.name);
							const overridden = styleBook.values[token.name] !== undefined;

							return (
								<tr key={token.name}>
									<th scope="row">
										{token.label}
										{overridden && <span className="label label-info ml-2">style book</span>}
									</th>
									<td className="storybook-mono">--{token.cssVariable}</td>
									<td>
										{token.editorType === 'ColorPicker' && <span className="storybook-swatch mr-2" style={{background: value}} />}
										<span className="storybook-mono">{value}</span>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			))}
		</div>
	);
}

function EmbedMissing({what}: {what: string}) {
	return (
		<div className="alert alert-warning storybook-embed__missing">
			<span className="alert-indicator">
				<Icon symbol="warning-full" />
			</span>
			Nothing to embed: {what} is not loaded.
		</div>
	);
}

/** A preview iframe that follows the height its document reports. */
function AutoFrame({document, height, scroll = false, title}: {document: string; height?: string; scroll?: boolean; title: string}) {
	const frame = useRef<HTMLIFrameElement>(null);
	const [reported, setReported] = useState<number | null>(null);

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			if (event.source === frame.current?.contentWindow && event.data?.type === 'storybook:height') {
				setReported(Math.ceil(Number(event.data.height) || 0));
			}
		};

		window.addEventListener('message', onMessage);

		return () => window.removeEventListener('message', onMessage);
	}, []);

	const fixed = height ? Number(height) : null;
	const style = fixed ? {height: `${fixed}px`} : {height: `${Math.max(reported ?? 0, 48)}px`};

	return <iframe className={`storybook-embed__frame${scroll ? ' storybook-embed__frame--scroll' : ''}`} ref={frame} sandbox="allow-scripts allow-same-origin" scrolling={scroll ? 'yes' : 'no'} srcDoc={document} style={style} title={title} />;
}
