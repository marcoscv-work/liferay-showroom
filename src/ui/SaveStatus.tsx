import {isModifiedBuiltin, useStore} from '../store';
import {Icon} from './Icon';

import type {PageTemplate} from '../model/types';

/**
 * Where a template's edits stand. There is nothing to save: every change is
 * kept in this browser as it is made, so this says so, and offers to bring
 * back the shipped version of a built-in template the visitor changed.
 */
export function TemplateSaveStatus({template}: {template: PageTemplate}) {
	const {dispatch, state} = useStore();

	return (
		<span className="showroom-save-status">
			<span className="showroom-save-status__text" title="Every change is saved in this browser as you make it. Export the template to take it to Liferay.">
				<Icon className="mr-1" symbol="check-circle" />
				Saved in this browser
			</span>
			{isModifiedBuiltin(template, state.builtinTemplates) && (
				<button className="btn btn-link btn-sm" onClick={() => dispatch({id: template.id, type: 'resetTemplate'})} title="Discard your changes to this built-in template. Undo brings them back." type="button">
					<Icon className="mr-1" symbol="reset" />
					Restore original
				</button>
			)}
		</span>
	);
}
