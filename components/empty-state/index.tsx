import './empty-state.css';

export interface EmptyStateProps {
	actionLabel?: string;
	description?: string;
	onAction?: () => void;
	small?: boolean;

	/** The theme's empty states spritemap, when the page has no `Liferay.ThemeDisplay`. */
	spritemap?: string;

	/** A symbol of `empty_states.svg`: `empty-state`, `search-state`, `success-state`, `ai-chat`... */
	symbol?: string;
	title: string;
}

/**
 * The Clay empty state with one of the animated illustrations of the
 * theme's `empty_states.svg`, as `ClayEmptyState` renders an `illustration`
 * `ClayIcon`. The illustration follows the light and dark scheme and stops
 * moving for people who prefer reduced motion.
 */
export default function EmptyState({actionLabel, description, onAction, small = false, spritemap, symbol = 'empty-state', title}: EmptyStateProps) {
	const href = spritemap ?? (window as any).Liferay?.ThemeDisplay?.getPathThemeEmptyStatesSpritemap?.() ?? '';

	return (
		<div className={`c-empty-state c-empty-state-animation empty-state${small ? ' c-empty-state-sm' : ''}`}>
			<div className="c-empty-state-image">
				<div className="c-empty-state-illustration">
					<svg aria-hidden="true" className={`c-empty-state-icon c-empty-state-icon-${symbol}`} focusable="false">
						<use href={`${href}#${symbol}`} />
					</svg>
				</div>
			</div>

			<div className="c-empty-state-title">
				<span className="text-truncate-inline">
					<span className="text-truncate">{title}</span>
				</span>
			</div>

			{description && <div className="c-empty-state-text">{description}</div>}

			{actionLabel && (
				<div className="c-empty-state-footer">
					<button className={`btn btn-primary${small ? ' btn-sm' : ''}`} onClick={onAction} type="button">
						{actionLabel}
					</button>
				</div>
			)}
		</div>
	);
}
