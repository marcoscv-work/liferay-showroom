import {useId, useState} from 'react';

import {contrastRatio, normalizeColor} from '../model/colors';
import {humanize} from '../model/liferayContext';
import {CUSTOM_CATEGORY, createCustomColor, effectiveTokenValue, pageBackground} from '../model/tokens';
import {useCurrentStyleBook, useCurrentTheme, useStore} from '../store';
import {ConfirmButton} from './ConfirmButton';
import {Icon} from './Icon';

import type {FrontendToken, Theme} from '../model/types';

/** How a colour does as text on a background, by WCAG 2.2 AA. */
export function contrastVerdict(ratio: number | null): {label: string; level: 'fail' | 'large' | 'text'} | null {
	if (ratio === null) {
		return null;
	}

	return ratio >= 4.5 ? {label: 'passes for text', level: 'text'} : ratio >= 3 ? {label: 'large text and controls only', level: 'large'} : {label: 'decoration only', level: 'fail'};
}

export function ContrastChip({background, color}: {background: string; color: string}) {
	const ratio = contrastRatio(color, background);
	const verdict = contrastVerdict(ratio);

	if (!verdict || ratio === null) {
		return null;
	}

	return (
		<span className={`showroom-contrast showroom-contrast--${verdict.level}`} title={`Contrast with the page background (${background}), by WCAG 2.2 AA`}>
			{ratio.toFixed(1)}:1 <span className="showroom-contrast__label">{verdict.label}</span>
		</span>
	);
}

/** Names already taken by tokens, as names and as CSS variables, so a new colour clashes with neither. */
function takenNames(theme: Theme): string[] {
	return Object.values(theme.tokens).flatMap((token) => [token.name, token.cssVariable.replace(/-/g, '')]);
}

/**
 * The colours of the style book in use: the ones it adds to its theme,
 * which can be created, renamed, changed and removed here, and the theme's
 * own as a palette to pick one from.
 */
export function StyleBookColors({onPick}: {onPick: (tokenName: string) => void}) {
	const {dispatch} = useStore();
	const theme = useCurrentTheme();
	const styleBook = useCurrentStyleBook();

	if (!theme) {
		return null;
	}

	const custom = styleBook.customTokens ?? [];
	const background = pageBackground(theme, styleBook);
	const sets = theme.categories
		.filter((category) => category.name !== CUSTOM_CATEGORY.name)
		.flatMap((category) => category.sets.map((set) => ({label: `${humanize(category.label)} / ${humanize(set.label)}`, name: `${category.name}/${set.name}`, tokens: set.tokens.filter((token) => token.editorType === 'ColorPicker')})))
		.filter((set) => set.tokens.length);

	const total = sets.reduce((count, set) => count + set.tokens.length, 0);
	const changed = sets.reduce((count, set) => count + set.tokens.filter((token) => styleBook.values[token.name] !== undefined).length, 0);

	return (
		<section aria-label="Colours" className="showroom-palette">
			<h3 className="sheet-subtitle">Colours</h3>

			<h4 className="showroom-stylebook__set-title">Added to this style book</h4>
			<p className="text-secondary small mb-2">
				Colours the theme has no token for, such as the ones of a brand. Each becomes a token of the style book: fragments use it as <span className="showroom-mono">var(--name)</span> and Liferay imports it with the style book.
			</p>

			{custom.length > 0 && (
				<ul className="showroom-palette__custom">
					{custom.map((token) => (
						<CustomColor background={background} key={token.name} onRemove={() => dispatch({name: token.name, type: 'removeCustomToken'})} onUpdate={(patch) => dispatch({name: token.name, type: 'updateCustomToken', ...patch})} token={token} />
					))}
				</ul>
			)}

			<AddColor onAdd={(label, value) => dispatch({tokens: [createCustomColor(label, value, takenNames(theme))], type: 'addCustomTokens'})} />

			<details className="showroom-palette__theme">
				<summary>
					From the theme <span className="label label-secondary ml-1">{total}</span>
					{changed > 0 && <span className="label label-info ml-1">{changed} changed</span>}
				</summary>
				<p className="text-secondary small my-2">Pick one to find it in the table below and change it.</p>
				{sets.map((set) => (
					<div className="showroom-palette__set" key={set.name}>
						<h5 className="showroom-palette__set-title">{set.label}</h5>
						<div className="showroom-palette__grid">
							{set.tokens.map((token) => {
								const value = effectiveTokenValue(theme, styleBook, token.name);
								const overridden = styleBook.values[token.name] !== undefined;

								return (
									<button aria-label={`${humanize(token.label)}: ${value}${overridden ? ', changed' : ''}`} className={`showroom-palette__swatch${overridden ? ' showroom-palette__swatch--changed' : ''}`} key={token.name} onClick={() => onPick(token.name)} style={{background: value}} title={`${humanize(token.label)}: ${value}`} type="button" />
								);
							})}
						</div>
					</div>
				))}
			</details>
		</section>
	);
}

function ColorValue({label, onChange, value}: {label: string; onChange: (value: string) => void; value: string}) {
	const hex = normalizeColor(value);

	return (
		<>
			<input aria-label={`${label} colour`} className="showroom-color__input" onChange={(event) => onChange(event.target.value)} type="color" value={hex ? hex.slice(0, 7) : '#000000'} />
			<input aria-invalid={hex ? undefined : true} aria-label={`${label} value`} className="form-control form-control-sm showroom-color__text" onChange={(event) => onChange(event.target.value)} spellCheck={false} type="text" value={value} />
		</>
	);
}

function CustomColor({background, onRemove, onUpdate, token}: {background: string; onRemove: () => void; onUpdate: (patch: {label?: string; value?: string}) => void; token: FrontendToken}) {
	return (
		<li className="showroom-palette__row">
			<input aria-label={`Name of ${token.label}`} className="form-control form-control-sm showroom-palette__name" onChange={(event) => onUpdate({label: event.target.value})} type="text" value={token.label} />
			<ColorValue label={token.label} onChange={(value) => onUpdate({value})} value={token.defaultValue} />
			<span className="showroom-mono showroom-palette__variable" title="The CSS custom property fragments use">
				--{token.cssVariable}
			</span>
			<ContrastChip background={background} color={token.defaultValue} />
			<ConfirmButton className="btn btn-unstyled btn-sm btn-monospaced showroom-palette__remove" confirmLabel={<Icon symbol="check" />} onConfirm={onRemove} title={`Remove ${token.label}`}>
				<Icon symbol="trash" />
			</ConfirmButton>
		</li>
	);
}

function AddColor({onAdd}: {onAdd: (label: string, value: string) => void}) {
	const [label, setLabel] = useState('');
	const [value, setValue] = useState('#7414ff');
	const nameId = useId();
	const valid = Boolean(label.trim()) && normalizeColor(value) !== null;

	return (
		<form
			className="showroom-palette__add"
			onSubmit={(event) => {
				event.preventDefault();

				if (valid) {
					onAdd(label.trim(), value.trim());
					setLabel('');
				}
			}}
		>
			<label className="sr-only" htmlFor={nameId}>
				Name of the new colour
			</label>
			<input className="form-control form-control-sm showroom-palette__name" id={nameId} onChange={(event) => setLabel(event.target.value)} placeholder="Name, such as Brand purple" type="text" value={label} />
			<ColorValue label="New colour" onChange={setValue} value={value} />
			<button className="btn btn-secondary btn-sm" disabled={!valid} type="submit">
				<Icon className="mr-1" symbol="plus" />
				Add colour
			</button>
		</form>
	);
}
