import {useEffect, useRef, useState} from 'react';

/**
 * Turns every `title` in the shell into a styled tooltip, without touching the
 * components that set them. On first hover or focus an element's `title` moves
 * to `data-tooltip` (so the browser's own tooltip never shows); an element with
 * no accessible name keeps the text as its `aria-label`. The tooltip follows
 * the WAI tooltip pattern: shown on hover and on keyboard focus, referenced by
 * `aria-describedby` while visible, dismissed with Escape, and it stays open
 * while the pointer moves onto it.
 */

const SELECTOR = '[title], [data-tooltip]';
const TOOLTIP_ID = 'showroom-tooltip';
const SHOW_DELAY = 350;
const HIDE_DELAY = 120;

interface Shown {
	placement: 'top' | 'bottom';
	text: string;
	x: number;
	y: number;
}

function adopt(element: HTMLElement): string | null {
	const title = element.getAttribute('title');

	if (title !== null) {
		element.removeAttribute('title');

		if (title.trim()) {
			element.setAttribute('data-tooltip', title);

			const named = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.textContent?.trim();

			if (!named) {
				element.setAttribute('aria-label', title);
			}
		}
	}

	return element.getAttribute('data-tooltip');
}

function anchorOf(target: EventTarget | null): HTMLElement | null {
	const element = target instanceof Element ? target : null;
	const anchor = element?.closest<HTMLElement>(SELECTOR) ?? null;

	if (!anchor || anchor.tagName === 'IFRAME' || !anchor.closest('.showroom, .showroom-loading')) {
		return null;
	}

	return anchor;
}

export function TooltipLayer() {
	const [shown, setShown] = useState<Shown | null>(null);
	const anchor = useRef<HTMLElement | null>(null);
	const showTimer = useRef<number>();
	const hideTimer = useRef<number>();
	const tooltip = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const clearTimers = () => {
			window.clearTimeout(showTimer.current);
			window.clearTimeout(hideTimer.current);
		};

		const hide = () => {
			clearTimers();

			if (anchor.current?.getAttribute('aria-describedby') === TOOLTIP_ID) {
				anchor.current.removeAttribute('aria-describedby');
			}

			anchor.current = null;
			setShown(null);
		};

		const show = (element: HTMLElement, delay: number) => {
			const text = adopt(element);

			if (!text) {
				return;
			}

			clearTimers();

			showTimer.current = window.setTimeout(() => {
				if (!element.isConnected) {
					return;
				}

				const rect = element.getBoundingClientRect();
				const placement = rect.top > 48 ? 'top' : 'bottom';

				anchor.current = element;

				if (!element.getAttribute('aria-describedby')) {
					element.setAttribute('aria-describedby', TOOLTIP_ID);
				}

				setShown({placement, text, x: rect.left + rect.width / 2, y: placement === 'top' ? rect.top : rect.bottom});
			}, delay);
		};

		const onPointerOver = (event: PointerEvent) => {
			if (tooltip.current?.contains(event.target as Node)) {
				window.clearTimeout(hideTimer.current);

				return;
			}

			const element = anchorOf(event.target);

			if (!element) {
				return;
			}

			if (element === anchor.current) {
				window.clearTimeout(hideTimer.current);

				return;
			}

			show(element, anchor.current ? 0 : SHOW_DELAY);
		};

		const onPointerOut = (event: PointerEvent) => {
			const to = event.relatedTarget as Node | null;

			if (to && (anchor.current?.contains(to) || tooltip.current?.contains(to))) {
				return;
			}

			window.clearTimeout(showTimer.current);
			hideTimer.current = window.setTimeout(hide, HIDE_DELAY);
		};

		const onFocusIn = (event: FocusEvent) => {
			const element = anchorOf(event.target);

			if (element && (event.target as HTMLElement).matches?.(':focus-visible')) {
				show(element, 0);
			}
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && anchor.current) {
				hide();
			}
		};

		document.addEventListener('pointerover', onPointerOver, true);
		document.addEventListener('pointerout', onPointerOut, true);
		document.addEventListener('pointerdown', hide, true);
		document.addEventListener('focusin', onFocusIn, true);
		document.addEventListener('focusout', hide, true);
		document.addEventListener('keydown', onKeyDown, true);
		window.addEventListener('scroll', hide, true);
		window.addEventListener('blur', hide);

		return () => {
			clearTimers();
			document.removeEventListener('pointerover', onPointerOver, true);
			document.removeEventListener('pointerout', onPointerOut, true);
			document.removeEventListener('pointerdown', hide, true);
			document.removeEventListener('focusin', onFocusIn, true);
			document.removeEventListener('focusout', hide, true);
			document.removeEventListener('keydown', onKeyDown, true);
			window.removeEventListener('scroll', hide, true);
			window.removeEventListener('blur', hide);
		};
	}, []);

	/* Keep the bubble inside the window once its size is known */
	const [offset, setOffset] = useState(0);

	useEffect(() => {
		const element = tooltip.current;

		if (!element || !shown) {
			setOffset(0);

			return;
		}

		const rect = element.getBoundingClientRect();
		const margin = 8;

		if (rect.left < margin) {
			setOffset(margin - rect.left);
		}
		else if (rect.right > window.innerWidth - margin) {
			setOffset(window.innerWidth - margin - rect.right);
		}
		else {
			setOffset(0);
		}
	}, [shown]);

	return (
		<div
			className={`showroom-tooltip showroom-tooltip--${shown?.placement ?? 'top'}${shown ? ' showroom-tooltip--shown' : ''}`}
			id={TOOLTIP_ID}
			ref={tooltip}
			role="tooltip"
			style={shown ? {left: `${shown.x}px`, top: `${shown.y}px`, transform: `translate(calc(-50% + ${offset}px), ${shown.placement === 'top' ? 'calc(-100% - 8px)' : '8px'})`} : undefined}
		>
			{shown?.text}
		</div>
	);
}
