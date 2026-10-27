/*
 * Plain JavaScript for the interactive parts of the Liferay Sites Design
 * System: accordions, tabs, logo marquees, dismissible banners, progress
 * values and card spotlights. It runs with the fragment's `fragmentElement`
 * in scope and only touches that fragment.
 */

/* Reveal on scroll ------------------------------------------------------- */

(function () {
	var pending = Array.prototype.slice.call(fragmentElement.querySelectorAll('[data-reveal]'));
	var bars = Array.prototype.slice.call(fragmentElement.querySelectorAll('.lsds-stat-bar'));

	function reveal(element) {
		if (element.hasAttribute('data-reveal')) {
			element.setAttribute('data-reveal-state', 'in');
		}
		else {
			element.setAttribute('data-revealed', 'true');
		}
	}

	var targets = pending.concat(bars);

	if (!targets.length) {
		return;
	}

	var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (reduced || typeof IntersectionObserver === 'undefined' || layoutMode === 'edit') {
		targets.forEach(reveal);

		return;
	}

	var observer = new IntersectionObserver(function (entries) {
		entries.forEach(function (entry) {
			if (entry.isIntersecting) {
				reveal(entry.target);
				observer.unobserve(entry.target);
			}
		});
	}, {rootMargin: '0px 0px -10% 0px', threshold: 0.1});

	targets.forEach(function (target) {
		observer.observe(target);
	});
})();

/* Accordion -------------------------------------------------------------- */

fragmentElement.querySelectorAll('.lsds-acc-root').forEach(function (accordion) {
	var multiple = accordion.getAttribute('data-multiple') === 'true';

	function setOpen(item, open) {
		var control = item.querySelector('.lsds-acc-control');
		var panel = item.querySelector('.lsds-acc-panel');
		var chevron = item.querySelector('.lsds-acc-chevron');

		if (!control || !panel) {
			return;
		}

		if (open) {
			item.setAttribute('data-active', 'true');
			control.setAttribute('data-active', 'true');
			control.setAttribute('aria-expanded', 'true');
			panel.removeAttribute('inert');
			panel.setAttribute('aria-hidden', 'false');
			panel.style.display = '';
			panel.style.height = '';
			panel.style.overflow = '';
			panel.style.opacity = '1';

			var content = panel.querySelector('.lsds-acc-content');

			if (content) {
				content.style.display = '';
			}

			if (chevron) {
				chevron.setAttribute('data-rotate', 'true');
			}
		}
		else {
			item.removeAttribute('data-active');
			control.removeAttribute('data-active');
			control.setAttribute('aria-expanded', 'false');
			panel.setAttribute('inert', '');
			panel.setAttribute('aria-hidden', 'true');
			panel.style.display = 'none';
			panel.style.height = '0px';
			panel.style.overflow = 'hidden';
			panel.style.opacity = '0';

			if (chevron) {
				chevron.removeAttribute('data-rotate');
			}
		}
	}

	accordion.querySelectorAll('.lsds-acc-item').forEach(function (item) {
		var control = item.querySelector('.lsds-acc-control');

		if (!control) {
			return;
		}

		control.addEventListener('click', function () {
			var open = control.getAttribute('aria-expanded') === 'true';

			if (!multiple && !open) {
				accordion.querySelectorAll('.lsds-acc-item').forEach(function (other) {
					if (other !== item) {
						setOpen(other, false);
					}
				});
			}

			setOpen(item, !open);
		});
	});
});

/* Tabs ------------------------------------------------------------------- */

fragmentElement.querySelectorAll('.lsds-tabs-root').forEach(function (tabs) {
	var list = tabs.querySelector('.lsds-tabs-list');
	var tabButtons = Array.prototype.slice.call(tabs.querySelectorAll('[role="tab"]'));
	var panels = Array.prototype.slice.call(tabs.querySelectorAll('[role="tabpanel"]'));

	function positionPill(tab) {
		if (!list) {
			return;
		}

		var listRect = list.getBoundingClientRect();
		var rect = tab.getBoundingClientRect();

		list.style.setProperty('--sds-pill-x', rect.left - listRect.left + list.scrollLeft + 'px');
		list.style.setProperty('--sds-pill-w', rect.width + 'px');
		list.style.setProperty('--sds-pill-opacity', '1');
	}

	function activate(tab) {
		tabButtons.forEach(function (other) {
			var active = other === tab;

			other.setAttribute('aria-selected', active ? 'true' : 'false');
			other.setAttribute('tabindex', active ? '0' : '-1');

			if (active) {
				other.setAttribute('data-active', 'true');
			}
			else {
				other.removeAttribute('data-active');
			}
		});

		panels.forEach(function (panel) {
			var active = panel.getAttribute('aria-labelledby') === tab.id || panel.id === tab.getAttribute('aria-controls');

			panel.style.display = active ? '' : 'none';
		});

		positionPill(tab);
	}

	tabButtons.forEach(function (tab, index) {
		tab.addEventListener('click', function () {
			activate(tab);
		});

		tab.addEventListener('keydown', function (event) {
			var next = null;

			if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
				next = tabButtons[(index + 1) % tabButtons.length];
			}
			else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
				next = tabButtons[(index - 1 + tabButtons.length) % tabButtons.length];
			}
			else if (event.key === 'Home') {
				next = tabButtons[0];
			}
			else if (event.key === 'End') {
				next = tabButtons[tabButtons.length - 1];
			}

			if (next) {
				event.preventDefault();
				next.focus();
				activate(next);
			}
		});
	});

	var initial = tabButtons.filter(function (tab) {
		return tab.getAttribute('aria-selected') === 'true';
	})[0];

	if (initial) {
		activate(initial);
	}

	window.addEventListener('resize', function () {
		var current = tabButtons.filter(function (tab) {
			return tab.getAttribute('aria-selected') === 'true';
		})[0];

		if (current) {
			positionPill(current);
		}
	});
});

/* Marquee ---------------------------------------------------------------- */

fragmentElement.querySelectorAll('.lsds-marquee-root').forEach(function (marquee) {
	var track = marquee.querySelector('.lsds-marquee-track');
	var tracks = marquee.querySelector('.lsds-marquee-tracks');
	var control = marquee.querySelector('.lsds-marquee-control');

	function measure() {
		if (!track) {
			return;
		}

		var gap = parseFloat(getComputedStyle(marquee).getPropertyValue('--sds-marquee-gap')) || 60;
		var distance = track.getBoundingClientRect().width + gap;

		marquee.style.setProperty('--sds-marquee-distance', distance + 'px');
		marquee.style.setProperty('--sds-marquee-duration', Math.max(8, distance / 60) + 's');
	}

	measure();
	window.addEventListener('resize', measure);

	if (document.fonts && document.fonts.ready) {
		document.fonts.ready.then(measure);
	}

	if (control && tracks) {
		control.addEventListener('click', function () {
			var paused = control.getAttribute('aria-pressed') === 'true';

			control.setAttribute('aria-pressed', paused ? 'false' : 'true');
			tracks.setAttribute('data-moving', paused ? 'true' : 'false');
		});
	}

	if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches && tracks) {
		tracks.setAttribute('data-moving', 'false');
	}
});

/* Banner ----------------------------------------------------------------- */

fragmentElement.querySelectorAll('.lsds-banner').forEach(function (banner) {
	var close = banner.querySelector('.lsds-banner-close');

	if (close) {
		close.addEventListener('click', function () {
			banner.remove();
		});
	}
});

/* Progress --------------------------------------------------------------- */

fragmentElement.querySelectorAll('.lsds-progress').forEach(function (progress) {
	var fill = progress.querySelector('[role="progressbar"]');
	var text = progress.querySelector('.lsds-progress-value');
	var value = typeof configuration !== 'undefined' && configuration.value !== undefined ? Number(configuration.value) : NaN;

	if (fill && !isNaN(value)) {
		var clamped = Math.max(0, Math.min(100, value));

		fill.style.setProperty('--progress-section-size', clamped + '%');
		fill.setAttribute('aria-valuenow', String(clamped));
		fill.setAttribute('aria-valuetext', clamped + '%');

		if (text) {
			text.textContent = clamped + '%';
		}

		progress.setAttribute('data-state', clamped >= 100 ? 'complete' : 'loading');
	}
});

/* Card spotlight --------------------------------------------------------- */

fragmentElement.querySelectorAll('.lsds-card-root[data-interactive]').forEach(function (card) {
	card.addEventListener('pointermove', function (event) {
		var rect = card.getBoundingClientRect();

		card.style.setProperty('--sds-spot-x', event.clientX - rect.left + 'px');
		card.style.setProperty('--sds-spot-y', event.clientY - rect.top + 'px');
	});
});
