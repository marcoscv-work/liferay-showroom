import {useId} from 'react';

import {allFields, defaultRawValue, parseConfiguration} from '../../model/configuration';
import {humanize} from '../../model/liferayContext';
import {Icon, Toggle} from '../Icon';

import type {ReactNode} from 'react';

import type {ConfigurationField} from '../../model/configuration';
import type {Theme} from '../../model/types';

const CLAY_COLORS = ['primary', 'secondary', 'success', 'info', 'warning', 'danger', 'light', 'dark', 'white', 'black'];

/** Up to this many options an enumeration renders as inline radios, like Storybook does. */
const RADIO_LIMIT = 6;

export interface ConfigurationControlsProps {
	configurationJSON: string;
	onChange: (name: string, value: any) => void;
	onReset?: () => void;
	theme: Theme | null;
	values: Record<string, any>;
}

/**
 * The args table: one row per `configuration.json` field, with the name,
 * description and default on the left and a control on the right. Values
 * are stored in the shape the page editor persists in `fragmentConfig`.
 */
export function ConfigurationControls({configurationJSON, onChange, onReset, theme, values}: ConfigurationControlsProps) {
	const {configuration, error} = parseConfiguration(configurationJSON);

	if (error) {
		return (
			<div className="alert alert-danger">
				<span className="alert-indicator">
					<Icon symbol="exclamation-full" />
				</span>
				{error}
			</div>
		);
	}

	if (!allFields(configuration).length) {
		return <p className="text-secondary">This fragment has no configuration fields.</p>;
	}

	return (
		<div>
			{onReset && (
				<div className="d-flex justify-content-end mb-2">
					<button className="btn btn-secondary btn-sm" onClick={onReset} type="button">
						<Icon className="mr-1" symbol="reset" />
						Reset controls
					</button>
				</div>
			)}

			<ArgsTable>
				{configuration.fieldSets.map((fieldSet, index) => (
					<tbody key={`${fieldSet.label}-${index}`}>
						{fieldSet.label && configuration.fieldSets.length > 1 && (
							<tr className="storybook-args__group">
								<th colSpan={2} scope="colgroup">
									{humanize(fieldSet.label)}
								</th>
							</tr>
						)}
						{fieldSet.fields.map((field) => (
							<ArgRow defaultValue={formatDefault(field)} description={field.description ? humanize(field.description) : humanize(field.label).toLowerCase() !== humanize(field.name).toLowerCase() ? humanize(field.label) : undefined} key={field.name} name={field.name}>
								<FieldControl field={field} onChange={(value) => onChange(field.name, value)} theme={theme} value={values[field.name] ?? defaultRawValue(field)} />
							</ArgRow>
						))}
					</tbody>
				))}
			</ArgsTable>
		</div>
	);
}

export function ArgsTable({children, nameHeading = 'Name', valueHeading = 'Control'}: {children: ReactNode; nameHeading?: string; valueHeading?: string}) {
	return (
		<table className="table storybook-args">
			<colgroup>
				<col className="storybook-args__name-col" />
				<col />
			</colgroup>
			<thead>
				<tr>
					<th className="storybook-args__name-heading" scope="col">
						{nameHeading}
					</th>
					<th scope="col">{valueHeading}</th>
				</tr>
			</thead>
			{children}
		</table>
	);
}

export function ArgRow({children, defaultValue, description, name, tag}: {children: ReactNode; defaultValue?: string; description?: string; name: string; tag?: string}) {
	return (
		<tr>
			<th className="storybook-args__name" scope="row">
				<span className="storybook-args__id">{name}</span>
				{tag && <span className="label label-secondary ml-2 align-middle">{tag}</span>}
				{description && <span className="storybook-args__description">{description}</span>}
				{defaultValue !== undefined && defaultValue !== '' && (
					<span className="storybook-args__default">
						default <span className="storybook-mono">{defaultValue}</span>
					</span>
				)}
			</th>
			<td className="storybook-args__control">{children}</td>
		</tr>
	);
}

function formatDefault(field: ConfigurationField): string {
	const value = defaultRawValue(field);

	if (value && typeof value === 'object') {
		return value.color ?? JSON.stringify(value);
	}

	return String(value);
}

export function RadioGroup({name, onChange, options, value}: {name: string; onChange: (value: string) => void; options: {label: string; value: string}[]; value: string}) {
	const id = useId();

	return (
		<div className="storybook-radios" role="radiogroup">
			{options.map((option) => (
				<div className="custom-control custom-radio custom-control-inline" key={option.value}>
					<label>
						<input checked={value === option.value} className="custom-control-input" name={`${id}-${name}`} onChange={() => onChange(option.value)} type="radio" value={option.value} />
						<span className="custom-control-label">
							<span className="custom-control-label-text">{option.label}</span>
						</span>
					</label>
				</div>
			))}
		</div>
	);
}

function FieldControl({field, onChange, theme, value}: {field: ConfigurationField; onChange: (value: any) => void; theme: Theme | null; value: any}) {
	switch (field.type) {
		case 'checkbox':
			return <Toggle checked={value === true || value === 'true'} label={value === true || value === 'true' ? 'true' : 'false'} onChange={onChange} />;
		case 'select': {
			const options: {label: string; value: string}[] = (field.typeOptions?.validValues ?? []).map((option: any) => ({label: humanize(String(option.label ?? option.value)), value: String(option.value)}));

			if (options.length <= RADIO_LIMIT) {
				return <RadioGroup name={field.name} onChange={onChange} options={options} value={String(value ?? '')} />;
			}

			return (
				<select className="form-control form-control-sm" onChange={(event) => onChange(event.target.value)} value={String(value ?? '')}>
					{options.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			);
		}
		case 'colorPalette': {
			const current = value && typeof value === 'object' ? value.color ?? value.cssClass ?? '' : String(value ?? '');
			const colorTokens = theme ? Object.values(theme.tokens).filter((token) => token.editorType === 'ColorPicker') : [];

			return (
				<div className="storybook-color">
					<span className="storybook-swatch" style={{background: swatchColor(current, theme)}} />
					<select
						className="form-control form-control-sm"
						onChange={(event) => {
							const color = event.target.value;

							onChange(color ? {color, cssClass: color, rgbValue: ''} : {color: '', cssClass: '', rgbValue: ''});
						}}
						value={current}
					>
						<option value="">None</option>
						<optgroup label="Clay colors">
							{CLAY_COLORS.map((color) => (
								<option key={color} value={color}>
									{color}
								</option>
							))}
						</optgroup>
						{colorTokens.length > 0 && (
							<optgroup label={`${theme?.name} tokens`}>
								{colorTokens.map((token) => (
									<option key={token.name} value={token.name}>
										{humanize(token.label)}
									</option>
								))}
							</optgroup>
						)}
					</select>
				</div>
			);
		}
		case 'colorPicker': {
			const text = String(value ?? '');
			const colorTokens = theme ? Object.values(theme.tokens).filter((token) => token.editorType === 'ColorPicker') : [];
			const isToken = Boolean(theme?.tokens[text]);

			return (
				<div className="storybook-color">
					<input aria-label={`${humanize(field.label)} color`} className="storybook-color__input" onChange={(event) => onChange(event.target.value)} type="color" value={isToken ? '#000000' : /^#[0-9a-f]{6}$/i.test(text) ? text : '#000000'} />
					<select className="form-control form-control-sm" onChange={(event) => onChange(event.target.value)} value={isToken ? text : ''}>
						<option value="">Custom value</option>
						{colorTokens.map((token) => (
							<option key={token.name} value={token.name}>
								{humanize(token.label)}
							</option>
						))}
					</select>
					<input aria-label={`${humanize(field.label)} value`} className="form-control form-control-sm storybook-color__text" onChange={(event) => onChange(event.target.value)} type="text" value={text} />
				</div>
			);
		}
		case 'text': {
			const validation = field.typeOptions?.validation;
			const isNumber = validation?.type === 'number' || field.dataType === 'int' || field.dataType === 'double';

			if (isNumber) {
				return <input className="form-control form-control-sm storybook-args__input" max={validation?.max} min={validation?.min} onChange={(event) => onChange(event.target.value)} type="number" value={String(value ?? '')} />;
			}

			return <input className="form-control form-control-sm storybook-args__input" onChange={(event) => onChange(event.target.value)} type="text" value={String(value ?? '')} />;
		}
		case 'length':
			return <input className="form-control form-control-sm storybook-args__input" onChange={(event) => onChange(event.target.value)} placeholder="e.g. 16px, 2rem, 50%" type="text" value={String(value ?? '')} />;
		case 'url':
			return <input className="form-control form-control-sm storybook-args__input" onChange={(event) => onChange(event.target.value)} placeholder="https://" type="url" value={String(value ?? '')} />;
		case 'itemSelector':
		case 'collectionSelector':
		case 'navigationMenuSelector':
		case 'videoSelector':
			return (
				<div className="text-secondary small">
					<span className="label label-secondary mr-1">{field.type}</span> needs Liferay content.
					{field.type === 'videoSelector' && (
						<input
							className="form-control form-control-sm mt-1 storybook-args__input"
							onChange={(event) => onChange(event.target.value ? {url: event.target.value} : {})}
							placeholder="Video URL"
							type="url"
							value={typeof value === 'object' && value ? String(value.url ?? '') : ''}
						/>
					)}
				</div>
			);
		default:
			return <input className="form-control form-control-sm storybook-args__input" onChange={(event) => onChange(event.target.value)} type="text" value={typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')} />;
	}
}

export function swatchColor(name: string, theme: Theme | null): string {
	if (!name) {
		return 'transparent';
	}

	if (theme?.tokens[name]) {
		const token = theme.tokens[name];

		return /^#|^rgb|^hsl/.test(token.defaultValue) ? token.defaultValue : `var(--${token.cssVariable}, ${token.defaultValue})`;
	}

	const clay: Record<string, string> = {
		black: '#000',
		danger: '#da1414',
		dark: '#272833',
		info: '#2e5aac',
		light: '#f1f2f5',
		primary: '#0b5fff',
		secondary: '#6b6c7e',
		success: '#287d3c',
		warning: '#b95000',
		white: '#fff',
	};

	return clay[name] ?? name;
}
