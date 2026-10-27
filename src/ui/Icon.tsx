import {assetURL} from '../store/load';

/**
 * A Lexicon icon from the Clay spritemap bundled with the Classic theme.
 */
export function Icon({className = '', symbol}: {className?: string; symbol: string}) {
	return (
		<svg aria-hidden="true" className={`lexicon-icon lexicon-icon-${symbol} ${className}`.trim()} focusable="false" role="presentation">
			<use href={`${assetURL('themes/classic/images/clay/icons.svg')}#${symbol}`} />
		</svg>
	);
}

export function IconButton({
	children,
	className = 'btn btn-unstyled btn-sm btn-monospaced',
	disabled,
	label,
	onClick,
	pressed,
	symbol,
}: {
	children?: React.ReactNode;
	className?: string;
	disabled?: boolean;
	label: string;
	onClick: () => void;
	pressed?: boolean;
	symbol: string;
}) {
	return (
		<button aria-label={label} aria-pressed={pressed} className={`${className}${pressed ? ' active' : ''}`} disabled={disabled} onClick={onClick} title={label} type="button">
			<Icon symbol={symbol} />
			{children}
		</button>
	);
}

export function Toggle({checked, label, onChange}: {checked: boolean; label?: string; onChange: (checked: boolean) => void}) {
	return (
		<label className="toggle-switch">
			<input checked={checked} className="toggle-switch-check" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
			<span aria-hidden="true" className="toggle-switch-bar">
				<span className="toggle-switch-handle" />
			</span>
			{label && <span className="toggle-switch-text toggle-switch-text-right">{label}</span>}
		</label>
	);
}
