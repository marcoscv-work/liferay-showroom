import {allFields, defaultRawValue, parseConfiguration, resolveFieldValue} from './configuration';

import type {ReactComponent, Theme} from './types';

/**
 * React components documented next to the fragments: the ones a team uses
 * elsewhere in Liferay, outside the page editor. They are optional and not
 * Liferay assets, so nothing exports them; the showroom renders them with
 * their props as controls, described in the format fragments use.
 */

/** Where a component's control values are kept, next to the fragments' args. */
export function componentArgsKey(key: string): string {
	return `react:${key}`;
}

/** The control values as the controls store them, defaults filled in. */
export function componentRawValues(component: ReactComponent, values: Record<string, any> = {}): Record<string, any> {
	const {configuration} = parseConfiguration(component.configuration);
	const raw: Record<string, any> = {};

	for (const field of allFields(configuration)) {
		raw[field.name] = values[field.name] ?? defaultRawValue(field);
	}

	return raw;
}

/** The props the component receives: the values a fragment template would read, with a palette colour as its name. */
export function componentProps(component: ReactComponent, raw: Record<string, any>, theme: Theme | null): Record<string, any> {
	const {configuration} = parseConfiguration(component.configuration);
	const props: Record<string, any> = {};

	for (const field of allFields(configuration)) {
		const value = resolveFieldValue(field, raw[field.name], theme);

		props[field.name] = field.type === 'colorPalette' ? value.cssClass || value.color || '' : value;
	}

	return props;
}

/** The component's name in JSX: what its import declares, else its folder in PascalCase. */
export function componentTag(component: ReactComponent): string {
	const declared = component.importStatement?.match(/import\s+([A-Z][\w$]*)/)?.[1];

	return declared ?? component.key.replace(/(^|[-_\s]+)(\w)/g, (_, __, letter: string) => letter.toUpperCase());
}

function propAttribute(name: string, value: any): string | null {
	if (value === null || value === undefined || value === '' || value === false) {
		return null;
	}

	if (value === true) {
		return name;
	}

	if (typeof value === 'string' && !/["\n{}]/.test(value)) {
		return `${name}="${value}"`;
	}

	return `${name}={${JSON.stringify(value)}}`;
}

/** How to use the component with the props set in the controls, ready to paste. */
export function usageSnippet(component: ReactComponent, props: Record<string, any>): string {
	const tag = componentTag(component);
	const importLine = component.importStatement ?? `import ${tag} from './components/${component.key}';`;
	const attributes = Object.entries(props)
		.map(([name, value]) => propAttribute(name, value))
		.filter((attribute): attribute is string => attribute !== null);

	const jsx = attributes.length ? `<${tag}\n${attributes.map((attribute) => `\t${attribute}`).join('\n')}\n/>` : `<${tag} />`;

	return `${importLine}\n\n${jsx}\n`;
}
