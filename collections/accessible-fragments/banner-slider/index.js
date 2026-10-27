const INTERVAL = 5000;
const MOVE_LEFT = 'move-left';
const MOVE_RIGHT = 'move-right';

const editMode = layoutMode === 'edit';
const reducedMotion =
	!!window.matchMedia &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const carousel = fragmentElement.querySelector('.carousel');
const carouselInner = fragmentElement.querySelector('.carousel-inner');
const indicators = [].slice.call(
	fragmentElement.querySelectorAll('.carousel-item-button')
);
const items = [].slice.call(fragmentElement.querySelectorAll('.carousel-item'));
const nextItemIndexKey = `${fragmentEntryLinkNamespace}-next-item-index`;
const toggleButton = fragmentElement.querySelector('.carousel-toggle-button');
const toggleButtonIconStart = fragmentElement.querySelector(
	'.carousel-toggle-icon-start'
);
const toggleButtonIconStop = fragmentElement.querySelector(
	'.carousel-toggle-icon-stop'
);
const toggleButtonText = fragmentElement.querySelector('.carousel-toggle-text');

let intervalId = null;
let moving = false;
let stoppedByUser = false;

function activateIndicator(activeItem, nextItem, movement) {
	if (movement) {
		activeItem.classList.add(movement);
		nextItem.classList.add(movement);
	}

	const activeIndicator = getActiveIndicator();
	const nextIndicator = indicators[getNextItemIndex()];

	activeIndicator.classList.remove('active');
	activeIndicator.setAttribute('aria-current', 'false');

	nextIndicator.classList.add('active');
	nextIndicator.setAttribute('aria-current', 'true');
}

function activateItem(activeItem, nextItem, movement) {
	activeItem.classList.remove('active');
	nextItem.classList.add('active');

	if (movement) {
		activeItem.classList.remove(movement);
		nextItem.classList.remove(movement);
	}

	setItemHidden(activeItem, true);
	setItemHidden(nextItem, false);
}

function getActiveIndicator() {
	return fragmentElement.querySelector('.carousel-item-button.active');
}

function getNextItemIndex() {
	return window[nextItemIndexKey] || 0;
}

function isPlaying() {
	return intervalId !== null;
}

function move(movement, index = null) {
	if (moving) {
		return;
	}

	moving = true;

	const activeItem = fragmentElement.querySelector('.carousel-item.active');
	const indexActiveItem = items.indexOf(activeItem);

	setNextItemIndex(index);

	if (index === null) {
		setNextItemIndex(
			indexActiveItem >= items.length - 1 ? 0 : indexActiveItem + 1
		);
	}

	const nextItem = items[getNextItemIndex()];

	activateIndicator(activeItem, nextItem, movement);

	setTimeout(function () {
		activateItem(activeItem, nextItem, movement);

		moving = false;
	}, 600);
}

function setItemHidden(item, hidden) {
	if (editMode) {
		return;
	}

	if (hidden) {
		item.setAttribute('aria-hidden', 'true');
		item.setAttribute('inert', '');
	}
	else {
		item.removeAttribute('aria-hidden');
		item.removeAttribute('inert');
	}
}

function setNextItemIndex(index) {
	window[nextItemIndexKey] = index;
}

function startCarousel() {
	if (editMode || isPlaying()) {
		return;
	}

	intervalId = setInterval(function () {
		if (document.contains(items[0])) {
			move(MOVE_RIGHT);
		}
		else {
			stopCarousel();
		}
	}, INTERVAL);

	carouselInner.setAttribute('aria-live', 'off');

	toggleButton.classList.add('playing');
	toggleButton.classList.remove('stopped');
	toggleButtonIconStart.classList.add('d-none');
	toggleButtonIconStop.classList.remove('d-none');

	toggleButtonText.textContent = toggleButton.dataset.labelPause;
}

function stopCarousel() {
	if (!isPlaying()) {
		return;
	}

	clearInterval(intervalId);

	intervalId = null;

	carouselInner.setAttribute('aria-live', 'polite');

	toggleButton.classList.remove('playing');
	toggleButton.classList.add('stopped');
	toggleButtonIconStart.classList.remove('d-none');
	toggleButtonIconStop.classList.add('d-none');

	toggleButtonText.textContent = toggleButton.dataset.labelPlay;
}

function pauseWhileInteracting() {
	stopCarousel();
}

function resumeAfterInteracting() {
	if (!stoppedByUser && !reducedMotion && !carousel.matches(':hover')) {
		startCarousel();
	}
}

(function () {
	if (getNextItemIndex() < items.length) {
		const activeItem = fragmentElement.querySelector(
			'.carousel-item.active'
		);
		const nextItem = items[getNextItemIndex()];

		activateIndicator(activeItem, nextItem);
		activateItem(activeItem, nextItem);
	}

	if (!reducedMotion) {
		startCarousel();
	}

	toggleButton.addEventListener('click', () => {
		if (isPlaying()) {
			stoppedByUser = true;

			stopCarousel();
		}
		else {
			stoppedByUser = false;

			startCarousel();
		}
	});

	indicators.forEach(function (indicator, index) {
		indicator.addEventListener('click', function () {
			const indexActiveIndicator =
				indicators.indexOf(getActiveIndicator());

			if (index !== indexActiveIndicator) {
				stoppedByUser = true;

				stopCarousel();

				if (index < indexActiveIndicator) {
					move(MOVE_LEFT, index);
				}
				else {
					move(MOVE_RIGHT, index);
				}
			}
		});
	});

	carousel.addEventListener('mouseenter', pauseWhileInteracting);
	carousel.addEventListener('mouseleave', resumeAfterInteracting);
	carousel.addEventListener('focusin', pauseWhileInteracting);
	carousel.addEventListener('focusout', (event) => {
		if (!carousel.contains(event.relatedTarget)) {
			resumeAfterInteracting();
		}
	});
})();
