import type {Theme} from './types';

/**
 * Mirrors the `configuration.json` contract of a Liferay fragment and the
 * values `FragmentEntryConfigurationParser` hands to the FreeMarker template.
 */

export interface ConfigurationField {
	dataType?: string;
	defaultValue?: any;
	description?: string;
	label: string;
	localizable?: boolean;
	name: string;
	type: string;
	typeOptions?: Record<string, any>;
}

export interface ConfigurationFieldSet {
	configurationRole?: string;
	fields: ConfigurationField[];
	label: string;
}

export interface Configuration {
	fieldSets: ConfigurationFieldSet[];
}

export function parseConfiguration(json: string): {configuration: Configuration; error: string | null} {
	if (!json || !json.trim()) {
		return {configuration: {fieldSets: []}, error: null};
	}

	try {
		const parsed = JSON.parse(json);

		const fieldSets: ConfigurationFieldSet[] = Array.isArray(parsed.fieldSets)
			? parsed.fieldSets.map((fieldSet: any) => ({
					configurationRole: fieldSet.configurationRole,
					fields: Array.isArray(fieldSet.fields)
						? fieldSet.fields.filter((field: any) => field && field.name).map((field: any) => ({...field, label: field.label ?? field.name, type: field.type ?? 'text'}))
						: [],
					label: fieldSet.label ?? '',
				}))
			: [];

		return {configuration: {fieldSets}, error: null};
	}
	catch (error) {
		return {configuration: {fieldSets: []}, error: `configuration.json: ${(error as Error).message}`};
	}
}

export function allFields(configuration: Configuration): ConfigurationField[] {
	return configuration.fieldSets.flatMap((fieldSet) => fieldSet.fields);
}

/**
 * The raw value the page editor would persist in `fragmentConfig` for a field
 * when nothing has been changed yet.
 */
export function defaultRawValue(field: ConfigurationField): any {
	const {defaultValue, type} = field;

	switch (type) {
		case 'checkbox':
			return defaultValue === true || defaultValue === 'true';
		case 'colorPalette':
			if (defaultValue && typeof defaultValue === 'object') {
				return {color: defaultValue.color ?? defaultValue.cssClass ?? '', cssClass: defaultValue.cssClass ?? defaultValue.color ?? '', rgbValue: defaultValue.rgbValue ?? ''};
			}

			if (typeof defaultValue === 'string' && defaultValue) {
				return {color: defaultValue, cssClass: defaultValue, rgbValue: ''};
			}

			return {color: '', cssClass: '', rgbValue: ''};
		case 'select': {
			if (defaultValue !== undefined && defaultValue !== null) {
				return String(defaultValue);
			}

			const first = field.typeOptions?.validValues?.[0];

			return first ? String(first.value) : '';
		}
		case 'text':
		case 'length':
		case 'url':
		case 'colorPicker':
			return defaultValue === undefined || defaultValue === null ? '' : String(defaultValue);
		case 'itemSelector':
		case 'collectionSelector':
		case 'navigationMenuSelector':
		case 'videoSelector':
			return defaultValue && typeof defaultValue === 'object' ? defaultValue : {};
		default:
			return defaultValue ?? '';
	}
}

const CLAY_COLORS = ['primary', 'secondary', 'success', 'info', 'warning', 'danger', 'light', 'dark', 'white', 'black'];

/**
 * Converts the persisted `fragmentConfig` value into the value the template
 * reads through `configuration.<name>`, the way
 * `FragmentEntryConfigurationParserImpl.getFieldValue` does.
 */
export function resolveFieldValue(field: ConfigurationField, raw: any, theme: Theme | null): any {
	const value = raw === undefined ? defaultRawValue(field) : raw;

	switch (field.type) {
		case 'checkbox':
			return value === true || value === 'true';
		case 'colorPalette': {
			const object = value && typeof value === 'object' ? value : typeof value === 'string' ? {color: value} : {};

			const color = object.color ?? object.cssClass ?? '';

			return {
				color,
				cssClass: object.cssClass ?? color,
				rgbValue: object.rgbValue || resolveColorValue(color, theme),
			};
		}
		case 'colorPicker': {
			const text = value === undefined || value === null ? '' : String(value);

			if (theme && theme.tokens[text]) {
				return `var(--${theme.tokens[text].cssVariable})`;
			}

			return text;
		}
		case 'text':
		case 'select':
		case 'length': {
			const dataType = field.dataType ?? inferDataType(field);

			if (dataType === 'int' || dataType === 'double') {
				const number = Number(value);

				return Number.isNaN(number) ? 0 : number;
			}

			if (dataType === 'bool') {
				return value === true || value === 'true';
			}

			return value === undefined || value === null ? '' : String(value);
		}
		case 'url':
			return value === undefined || value === null ? '' : String(value);
		case 'videoSelector':
			return value && typeof value === 'object' ? value : {};
		case 'itemSelector':
		case 'collectionSelector':
		case 'navigationMenuSelector':
			return value && typeof value === 'object' && Object.keys(value).length ? value : null;
		default:
			return value;
	}
}

function inferDataType(field: ConfigurationField): string {
	const validation = field.typeOptions?.validation;

	if (validation && validation.type === 'number') {
		return 'int';
	}

	if (typeof field.defaultValue === 'number') {
		return Number.isInteger(field.defaultValue) ? 'int' : 'double';
	}

	return 'string';
}

function resolveColorValue(color: string, theme: Theme | null): string {
	if (!color) {
		return '';
	}

	if (theme && theme.tokens[color]) {
		return `var(--${theme.tokens[color].cssVariable})`;
	}

	if (CLAY_COLORS.includes(color)) {
		return `var(--${color})`;
	}

	return color;
}

export function buildConfigurationModel(configuration: Configuration, raw: Record<string, any>, theme: Theme | null): Record<string, any> {
	const model: Record<string, any> = {};

	for (const field of allFields(configuration)) {
		model[field.name] = resolveFieldValue(field, raw[field.name], theme);
	}

	return model;
}
