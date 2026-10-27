const button = fragmentElement.querySelector('.panel-header');
const panel = fragmentElement.querySelector('.panel-collapse');

function setPanelHidden(hidden) {
	if (hidden) {
		panel.setAttribute('inert', '');
	}
	else {
		panel.removeAttribute('inert');
	}
}

function main() {
	if (layoutMode !== 'edit') {
		panel.style.maxHeight = 'fit-content';

		button.addEventListener('click', () => {
			panel.classList.add('collapsed');

			button.classList.toggle('collapsed');

			const isExpanded = !button.classList.contains('collapsed');

			button.setAttribute('aria-expanded', isExpanded);

			setPanelHidden(!isExpanded);

			if (isExpanded) {
				panel.style.maxHeight = panel.scrollHeight + 'px';

				panel.addEventListener(
					'transitionend',
					() => {
						panel.style.maxHeight = 'fit-content';
					},
					{once: true}
				);
			}
			else {
				panel.style.maxHeight = panel.scrollHeight + 'px';

				requestAnimationFrame(() => {
					panel.style.maxHeight = '0';
				});
			}
		});
	}
}

main();
