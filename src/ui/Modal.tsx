import {useEffect, useId, useRef} from 'react';

import {Icon} from './Icon';

import type {ReactNode} from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog: it takes the focus, keeps Tab inside, closes on Escape and
 * on a click outside, and gives the focus back to what opened it.
 */
export function Modal({children, className = '', icon, onClose, title}: {children: ReactNode; className?: string; icon?: ReactNode; onClose: () => void; title: string}) {
	const titleId = useId();
	const dialog = useRef<HTMLDivElement>(null);
	const close = useRef(onClose);

	close.current = onClose;

	useEffect(() => {
		const opener = document.activeElement as HTMLElement | null;

		dialog.current?.focus();

		return () => opener?.focus?.();
	}, []);

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === 'Escape') {
			event.stopPropagation();
			close.current();

			return;
		}

		if (event.key !== 'Tab' || !dialog.current) {
			return;
		}

		const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.offsetParent !== null);

		if (!focusable.length) {
			event.preventDefault();

			return;
		}

		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement;

		if (event.shiftKey && (active === first || active === dialog.current)) {
			event.preventDefault();
			last.focus();
		}
		else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	};

	return (
		<div
			className="showroom-modal__backdrop"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) {
					onClose();
				}
			}}
		>
			<div aria-labelledby={titleId} aria-modal="true" className={`showroom-modal ${className}`.trim()} onKeyDown={onKeyDown} ref={dialog} role="dialog" tabIndex={-1}>
				<header className="showroom-modal__header">
					<h2 className="showroom-modal__title" id={titleId}>
						{icon}
						{title}
					</h2>
					<button aria-label="Close" className="btn btn-unstyled btn-sm btn-monospaced" onClick={onClose} title="Close" type="button">
						<Icon symbol="times" />
					</button>
				</header>
				{children}
			</div>
		</div>
	);
}
