import {useId, useMemo, useState} from 'react';

import {contrastRatio, normalizeColor} from '../model/colors';
import {colorScales, contrastPairs, tokenTitle} from '../model/palette';
import {CUSTOM_TOKEN_KINDS, createCustomToken, customTokenKind, pageBackground} from '../model/tokens';
import {useCurrentStyleBook, useCurrentTheme, useStore} from '../store';
import {ConfirmButton} from './ConfirmButton';
import {Icon} from './Icon';

import type {ScaleStep} from '../model/palette';
import type {CustomTokenKind} from '../model/tokens';
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
		<span className={`showroom-contrast showroom-contrast--${verdict.level}`} title={`Contrast with ${background}, by WCAG 2.2 AA`}>
			{ratio.toFixed(1)}:1 <span className="showroom-contrast__label">{verdict.label}</span>
		</span>
	);
}

/** Names already taken by tokens, as names and as CSS variables, so a new token clashes with neither. */
function takenNames(theme: Theme): string[] {
	return Object.values(theme.tokens).flatMap((token) => [token.name, token.cssVariable.replace(/-/g, '')]);
}

/* ------------------------------------------------------------------------ */
/* The style book's own tokens                                               */
/* ------------------------------------------------------------------------ */

const GROUPS: {kinds: (CustomTokenKind | 'other')[]; title: string}[] = [
	{kinds: ['color'], title: 'Colours'},
	{kinds: ['fontFamily', 'fontSize', 'fontWeight'], title: 'Typography'},
	{kinds: ['spacing'], title: 'Spacing'},
	{kinds: ['radius'], title: 'Radius'},
	{kinds: ['other'], title: 'Other'},
];

/**
 * The tokens the style book in use adds to its theme: colours, fonts,
 * spacings and radii of a brand that the theme has no token for. Each can be
 * created, renamed, changed and removed here.
 */
export function StyleBookOwnTokens() {
	const {dispatch} = useStore();
	const theme = useCurrentTheme();
	const styleBook = useCurrentStyleBook();

	if (!theme) {
		return null;
	}

	const own = styleBook.customTokens ?? [];
	const background = pageBackground(theme, styleBook);

	return (
		<section aria-label="Tokens added to this style book" className="showroom-palette">
			<h3 className="sheet-subtitle">Added to this style book</h3>
			<p className="text-secondary small mb-2">
				What the theme has no token for: the colours of a brand, a display font, a spacing, a radius. Each becomes a token of the style book that fragments use as <span className="showroom-mono">var(--name)</span>, and Liferay imports it with the style book.
			</p>

			{GROUPS.map((group) => {
				const tokens = own.filter((token) => group.kinds.includes(customTokenKind(token)));

				if (!tokens.length) {
					return null;
				}

				return (
					<div key={group.title}>
						<h4 className="showroom-stylebook__set-title">{group.title}</h4>
						<ul className="showroom-palette__custom">
							{tokens.map((token) => (
								<OwnToken background={background} key={token.name} onRemove={() => dispatch({name: token.name, type: 'removeCustomToken'})} onUpdate={(patch) => dispatch({name: token.name, type: 'updateCustomToken', ...patch})} token={token} />
							))}
						</ul>
					</div>
				);
			})}

			<AddToken onAdd={(kind, label, value) => dispatch({tokens: [createCustomToken(kind, label, value, takenNames(theme))], type: 'addCustomTokens'})} />
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

/** A value that is safe to hand to a style: no way out of the declaration it lands in. */
function plain(value: string): string {
	return /[;{}<>]/.test(value) ? '' : value;
}

/** What a token's value looks like, for the kinds a small sample can show. */
function Preview({kind, value}: {kind: CustomTokenKind | 'other'; value: string}) {
	const safe = plain(value.trim());

	if (!safe) {
		return null;
	}

	switch (kind) {
		case 'fontFamily':
			return (
				<span aria-hidden="true" className="showroom-token-preview showroom-token-preview--text" style={{fontFamily: safe}}>
					Ag
				</span>
			);
		case 'fontSize':
			return (
				<span aria-hidden="true" className="showroom-token-preview showroom-token-preview--text" style={{fontSize: `min(${safe}, 2rem)`}}>
					Ag
				</span>
			);
		case 'fontWeight':
			return (
				<span aria-hidden="true" className="showroom-token-preview showroom-token-preview--text" style={{fontWeight: safe as any}}>
					Ag
				</span>
			);
		case 'spacing':
			return <span aria-hidden="true" className="showroom-token-preview showroom-token-preview--space" style={{width: `min(${safe}, 8rem)`}} />;
		case 'radius':
			return <span aria-hidden="true" className="showroom-token-preview showroom-token-preview--radius" style={{borderRadius: safe}} />;
		default:
			return null;
	}
}

function OwnToken({background, onRemove, onUpdate, token}: {background: string; onRemove: () => void; onUpdate: (patch: {label?: string; value?: string}) => void; token: FrontendToken}) {
	const kind = customTokenKind(token);

	return (
		<li className="showroom-palette__row">
			<input aria-label={`Name of ${token.label}`} className="form-control form-control-sm showroom-palette__name" onChange={(event) => onUpdate({label: event.target.value})} type="text" value={token.label} />
			{kind === 'color' ? (
				<ColorValue label={token.label} onChange={(value) => onUpdate({value})} value={token.defaultValue} />
			) : (
				<input aria-label={`${token.label} value`} className="form-control form-control-sm showroom-palette__value" onChange={(event) => onUpdate({value: event.target.value})} spellCheck={false} type="text" value={token.defaultValue} />
			)}
			<Preview kind={kind} value={token.defaultValue} />
			<span className="showroom-mono showroom-palette__variable" title="The CSS custom property fragments use">
				--{token.cssVariable}
			</span>
			{kind === 'color' && <ContrastChip background={background} color={token.defaultValue} />}
			<ConfirmButton className="btn btn-unstyled btn-sm btn-monospaced showroom-palette__remove" confirmLabel={<Icon symbol="check" />} onConfirm={onRemove} title={`Remove ${token.label}`}>
				<Icon symbol="trash" />
			</ConfirmButton>
		</li>
	);
}

const PLACEHOLDERS: Record<CustomTokenKind, string> = {
	color: 'Name, such as Brand purple',
	fontFamily: 'Name, such as Display font',
	fontSize: 'Name, such as Display size',
	fontWeight: 'Name, such as Display weight',
	radius: 'Name, such as Card radius',
	spacing: 'Name, such as Section gap',
};

function AddToken({onAdd}: {onAdd: (kind: CustomTokenKind, label: string, value: string) => void}) {
	const [kind, setKind] = useState<CustomTokenKind>('color');
	const [label, setLabel] = useState('');
	const [value, setValue] = useState(CUSTOM_TOKEN_KINDS.color.value);
	const kindId = useId();
	const nameId = useId();
	const valid = Boolean(label.trim()) && (kind === 'color' ? normalizeColor(value) !== null : Boolean(plain(value.trim())));

	return (
		<form
			className="showroom-palette__add"
			onSubmit={(event) => {
				event.preventDefault();

				if (valid) {
					onAdd(kind, label.trim(), value.trim());
					setLabel('');
				}
			}}
		>
			<label className="sr-only" htmlFor={kindId}>
				Kind of token
			</label>
			<select
				className="form-control form-control-sm showroom-palette__kind"
				id={kindId}
				onChange={(event) => {
					const next = event.target.value as CustomTokenKind;

					setKind(next);
					setValue(CUSTOM_TOKEN_KINDS[next].value);
				}}
				value={kind}
			>
				{(Object.keys(CUSTOM_TOKEN_KINDS) as CustomTokenKind[]).map((candidate) => (
					<option key={candidate} value={candidate}>
						{CUSTOM_TOKEN_KINDS[candidate].label}
					</option>
				))}
			</select>
			<label className="sr-only" htmlFor={nameId}>
				Name of the new token
			</label>
			<input className="form-control form-control-sm showroom-palette__name" id={nameId} onChange={(event) => setLabel(event.target.value)} placeholder={PLACEHOLDERS[kind]} type="text" value={label} />
			{kind === 'color' ? <ColorValue label="New colour" onChange={setValue} value={value} /> : <input aria-label="Value of the new token" className="form-control form-control-sm showroom-palette__value" onChange={(event) => setValue(event.target.value)} spellCheck={false} type="text" value={value} />}
			<Preview kind={kind} value={value} />
			<button className="btn btn-secondary btn-sm" disabled={!valid} type="submit">
				<Icon className="mr-1" symbol="plus" />
				Add
			</button>
		</form>
	);
}

/* ------------------------------------------------------------------------ */
/* The palette and its contrast                                              */
/* ------------------------------------------------------------------------ */

function Swatch({onPick, step}: {onPick: (name: string) => void; step: ScaleStep}) {
	const label = tokenTitle(step.token);

	return (
		<button aria-label={`${label}: ${step.value}${step.changed ? ', changed' : ''}`} className={`showroom-palette__swatch${step.changed ? ' showroom-palette__swatch--changed' : ''}`} onClick={() => onPick(step.token.name)} style={{background: step.value}} title={`${label}: ${step.value}`} type="button" />
	);
}

/**
 * The colours of the theme as the style book in use leaves them: its scales
 * as strips, light to dark, the rest as loose swatches, and the pairs of
 * text and background with their contrast, worst first. Picking a colour
 * finds its token in the table.
 */
export function StyleBookPalette({onPick}: {onPick: (tokenName: string) => void}) {
	const theme = useCurrentTheme();
	const styleBook = useCurrentStyleBook();
	const palette = useMemo(() => (theme ? colorScales(theme, styleBook) : {loose: [], scales: []}), [styleBook, theme]);
	const pairs = useMemo(() => (theme ? contrastPairs(theme, styleBook) : []), [styleBook, theme]);

	if (!theme) {
		return null;
	}

	const failing = pairs.filter((pair) => pair.ratio < 4.5).length;
	const total = palette.loose.length + palette.scales.reduce((count, scale) => count + scale.steps.length, 0);

	return (
		<section aria-label="Palette" className="showroom-palette">
			<details className="showroom-palette__details" open>
				<summary>
					Palette <span className="label label-secondary ml-1">{total} colours</span>
				</summary>
				<p className="text-secondary small my-2">The theme's colours with this style book's values. A dot marks the ones it changes; pick one to find its token in the table below.</p>

				<div className="showroom-scales">
					{palette.scales.map((scale) => (
						<div className="showroom-scale" key={`${scale.name}-${scale.steps[0].token.name}`}>
							<span className="showroom-scale__name">{scale.name}</span>
							<div className="showroom-scale__steps">
								{scale.steps.map((step) => (
									<span className="showroom-scale__step" key={step.token.name}>
										<Swatch onPick={onPick} step={step} />
										<span aria-hidden="true" className="showroom-scale__label">
											{step.step || '·'}
										</span>
									</span>
								))}
							</div>
						</div>
					))}
				</div>

				{palette.loose.length > 0 && (
					<>
						<h4 className="showroom-palette__set-title">On their own</h4>
						<div className="showroom-palette__grid">
							{palette.loose.map((step) => (
								<Swatch key={step.token.name} onPick={onPick} step={step} />
							))}
						</div>
					</>
				)}
			</details>

			{pairs.length > 0 && (
				<details className="showroom-palette__details" open={failing > 0}>
					<summary>
						Contrast <span className="label label-secondary ml-1">{pairs.length} pairs</span>
						{failing > 0 ? <span className="label label-warning ml-1">{failing} below 4.5:1</span> : <span className="label label-success ml-1">all pass for text</span>}
					</summary>
					<p className="text-secondary small my-2">Text colours on the background they sit on, as the token names pair them, worst first. The ratio is WCAG's; 4.5:1 is the minimum for body text and 3:1 for large text and controls.</p>
					<ul className="showroom-pairs">
						{pairs.map((pair) => (
							<li key={pair.text.name}>
								<button className="showroom-pair" onClick={() => onPick(pair.text.name)} title="Find the text colour in the table" type="button">
									<span aria-hidden="true" className="showroom-pair__sample" style={{background: pair.background.value, color: pair.textValue}}>
										Aa
									</span>
									<span className="showroom-pair__names">
										<strong>{tokenTitle(pair.text)}</strong>
										<span className="text-secondary"> on {pair.background.name}</span>
									</span>
									<ContrastChip background={pair.background.value} color={pair.textValue} />
								</button>
							</li>
						))}
					</ul>
				</details>
			)}
		</section>
	);
}
