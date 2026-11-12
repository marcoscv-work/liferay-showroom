import './empty-state.css';

const IMAGES = {
	empty: 'empty_state.svg',
	search: 'search_state.svg',
	success: 'success_state.svg',
};

export interface EmptyStateProps {
	actionLabel?: string;
	description?: string;
	onAction?: () => void;
	small?: boolean;
	title: string;
	variant?: keyof typeof IMAGES;
}

/**
 * The Clay empty state, as the portal's React apps render it. The
 * illustration comes from the theme, through `Liferay.ThemeDisplay`.
 */
export default function EmptyState({actionLabel, description, onAction, small = false, title, variant = 'empty'}: EmptyStateProps) {
	const imagesPath = (window as any).Liferay?.ThemeDisplay?.getPathThemeImages?.() ?? '';

	return (
		<div className={`c-empty-state c-empty-state-animation empty-state${small ? ' c-empty-state-sm' : ''}`}>
			<div className="c-empty-state-image">
				<div className="c-empty-state-aspect-ratio">
					<img alt="" className="aspect-ratio-item aspect-ratio-item-fluid" src={`${imagesPath}/states/${IMAGES[variant] ?? IMAGES.empty}`} />
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
