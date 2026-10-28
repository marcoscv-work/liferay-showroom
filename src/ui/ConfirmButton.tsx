import {useEffect, useState} from 'react';

import type {ReactNode} from 'react';

/**
 * A destructive action that asks for a second click instead of a modal
 * dialog, so it works everywhere (including embedded browsers).
 */
export function ConfirmButton({
	children,
	className = 'btn btn-secondary btn-sm',
	confirmLabel = 'Confirm?',
	disabled,
	onConfirm,
	title,
}: {
	children: ReactNode;
	className?: string;
	confirmLabel?: ReactNode;
	disabled?: boolean;
	onConfirm: () => void;
	title?: string;
}) {
	const [armed, setArmed] = useState(false);

	useEffect(() => {
		if (!armed) {
			return;
		}

		const timeout = setTimeout(() => setArmed(false), 3000);

		return () => clearTimeout(timeout);
	}, [armed]);

	return (
		<button
			className={`${className}${armed ? ' showroom-armed' : ''}`}
			disabled={disabled}
			onClick={() => {
				if (armed) {
					setArmed(false);
					onConfirm();
				}
				else {
					setArmed(true);
				}
			}}
			title={armed ? 'Click again to confirm' : title}
			type="button"
		>
			{armed ? confirmLabel : children}
		</button>
	);
}
