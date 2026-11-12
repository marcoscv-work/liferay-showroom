import {describe, expect, it} from 'vitest';

import {componentProps, componentRawValues, componentTag, usageSnippet} from './components';

import type {ReactComponent} from './types';

const component: ReactComponent = {
	configuration: JSON.stringify({
		fieldSets: [
			{
				fields: [
					{defaultValue: 'Nothing here', label: 'Title', name: 'title', type: 'text'},
					{defaultValue: 'empty', label: 'Variant', name: 'variant', type: 'select', typeOptions: {validValues: [{value: 'empty'}, {value: 'search'}]}},
					{defaultValue: true, label: 'Show action', name: 'showAction', type: 'checkbox'},
					{defaultValue: 3, label: 'Columns', name: 'columns', type: 'text', typeOptions: {validation: {type: 'number'}}},
					{defaultValue: 'primary', label: 'Accent', name: 'accent', type: 'colorPalette'},
					{label: 'Note', name: 'note', type: 'text'},
				],
			},
		],
	}),
	description: '',
	key: 'empty-state',
	name: 'Empty state',
	source: '',
	sourceFile: 'index.tsx',
};

describe('components', () => {
	it('fills in the defaults and turns values into props', () => {
		const raw = componentRawValues(component, {showAction: false, title: 'No results'});

		expect(componentProps(component, raw, null)).toEqual({accent: 'primary', columns: 3, note: '', showAction: false, title: 'No results', variant: 'empty'});
	});

	it('names the tag after the import, else after the folder', () => {
		expect(componentTag(component)).toBe('EmptyState');
		expect(componentTag({...component, importStatement: "import Blank from '@acme/ui/blank';"})).toBe('Blank');
	});

	it('writes a snippet with the props set', () => {
		const props = componentProps(component, componentRawValues(component, {title: 'Say "hi"'}), null);

		expect(usageSnippet(component, props)).toBe(
			"import EmptyState from './components/empty-state';\n\n<EmptyState\n\ttitle={\"Say \\\"hi\\\"\"}\n\tvariant=\"empty\"\n\tshowAction\n\tcolumns={3}\n\taccent=\"primary\"\n/>\n"
		);
		expect(usageSnippet({...component, configuration: ''}, {})).toBe("import EmptyState from './components/empty-state';\n\n<EmptyState />\n");
	});
});
