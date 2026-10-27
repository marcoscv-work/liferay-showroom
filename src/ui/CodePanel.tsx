import {useState} from 'react';

import {templateDefinitionJSON} from '../model/zip';
import {Icon} from './Icon';
import {useRender} from './useRender';

export function CodePanel() {
	const output = useRender();

	const tabs: {id: string; label: string; content: string}[] = [];

	if (output.fragment) {
		tabs.push(
			{content: output.html, id: 'rendered', label: 'Rendered HTML'},
			{content: output.fragment.html, id: 'html', label: 'index.html'},
			{content: output.fragment.css, id: 'css', label: 'index.css'},
			{content: output.fragment.js, id: 'js', label: 'index.js'},
			{content: output.fragment.configuration, id: 'configuration', label: 'configuration.json'},
			{content: JSON.stringify(output.configurationRaw, null, '\t'), id: 'fragmentConfig', label: 'fragmentConfig'}
		);
	}
	else if (output.template) {
		tabs.push(
			{content: templateDefinitionJSON(output.template), id: 'definition', label: 'page-definition.json'},
			{content: output.html, id: 'rendered', label: 'Rendered HTML'},
			{content: output.css, id: 'css', label: 'Generated CSS'}
		);
	}

	const [active, setActive] = useState<string>('');

	const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

	if (!current) {
		return <p className="text-secondary">Nothing selected.</p>;
	}

	return (
		<div className="storybook-code">
			<div className="d-flex align-items-center">
				<ul className="nav nav-underline storybook-code__tabs" role="tablist">
					{tabs.map((tab) => (
						<li className="nav-item" key={tab.id}>
							<button aria-selected={tab.id === current.id} className={`nav-link${tab.id === current.id ? ' active' : ''}`} onClick={() => setActive(tab.id)} role="tab" type="button">
								{tab.label}
							</button>
						</li>
					))}
				</ul>
				<button className="btn btn-secondary btn-sm ml-auto" onClick={() => navigator.clipboard?.writeText(current.content)} type="button">
					<Icon className="mr-1" symbol="copy" />
					Copy
				</button>
			</div>
			<pre className="storybook-code__content">
				<code>{current.content || '(empty)'}</code>
			</pre>
		</div>
	);
}
