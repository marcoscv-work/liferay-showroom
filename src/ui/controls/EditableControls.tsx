import {Toggle} from '../Icon';

import type {EditableInfo, EditableValue} from '../../model/fragmentRenderer';

export interface EditableControlsProps {
	editables: EditableInfo[];
	onChange: (id: string, value: EditableValue | null) => void;
	values: Record<string, EditableValue>;
}

/**
 * Controls for the `data-lfr-editable-*` fields a fragment exposes. They map
 * one to one to the `fragmentFields` of a page definition.
 */
export function EditableControls({editables, onChange, values}: EditableControlsProps) {
	if (!editables.length) {
		return <p className="text-secondary">This fragment has no editable fields.</p>;
	}

	return (
		<table className="table table-autofit table-sm storybook-table">
			<thead>
				<tr>
					<th className="table-cell-expand-smaller" scope="col">
						Editable
					</th>
					<th className="table-cell-expand" scope="col">
						Value
					</th>
				</tr>
			</thead>
			<tbody>
				{editables.map((editable) => {
					const value = values[editable.id] ?? {};
					const defaults = editable.defaultValue;

					const embedded = (defaults.src ?? '').startsWith('data:');

					const shown = {
						alt: value.alt ?? defaults.alt ?? '',
						href: value.href ?? defaults.href ?? '',
						src: value.src ?? (embedded ? '' : defaults.src ?? ''),
						target: value.target ?? defaults.target,
						text: value.text ?? defaults.text ?? '',
					};

					const update = (patch: Partial<EditableValue>) => onChange(editable.id, {...value, ...patch});

					return (
						<tr key={editable.id}>
							<th className="storybook-table__name" scope="row">
								<span className="storybook-mono">{editable.id}</span>
								<span className="d-block mt-1">
									<span className="label label-secondary">{editable.type}</span>
								</span>
								{(editable.type === 'image' || editable.type === 'background-image') && embedded && !value.src && (
									<span className="d-block text-secondary small font-weight-normal storybook-editable__default">Embedded placeholder image</span>
								)}
							</th>
							<td>
								{(editable.type === 'image' || editable.type === 'background-image') && (
									<div className="storybook-stack">
										<input className="form-control form-control-sm" onChange={(event) => update({src: event.target.value})} placeholder="Image URL" type="text" value={shown.src} />
										<input
											accept="image/*"
											aria-label={`Upload image for ${editable.id}`}
											className="form-control form-control-sm"
											onChange={(event) => {
												const file = event.target.files?.[0];

												if (!file) {
													return;
												}

												const reader = new FileReader();

												reader.onload = () => update({src: String(reader.result)});
												reader.readAsDataURL(file);
											}}
											type="file"
										/>
										{editable.type === 'image' && <input className="form-control form-control-sm" onChange={(event) => update({alt: event.target.value})} placeholder="Alternative text" type="text" value={shown.alt} />}
										{editable.type === 'image' && <input className="form-control form-control-sm" onChange={(event) => update({href: event.target.value})} placeholder="Link URL (optional)" type="text" value={value.href ?? ''} />}
									</div>
								)}

								{(editable.type === 'link' || editable.type === 'action') && (
									<div className="storybook-stack">
										<input className="form-control form-control-sm" onChange={(event) => update({text: event.target.value})} placeholder="Link text" type="text" value={shown.text} />
										<input className="form-control form-control-sm" onChange={(event) => update({href: event.target.value})} placeholder="https://" type="text" value={shown.href} />
										<Toggle checked={shown.target === '_blank'} label="Open in a new tab" onChange={(checked) => update({target: checked ? '_blank' : undefined})} />
									</div>
								)}

								{(editable.type === 'rich-text' || editable.type === 'html') && (
									<textarea className="form-control form-control-sm" onChange={(event) => update({text: event.target.value})} placeholder="HTML content" rows={3} value={shown.text} />
								)}

								{(editable.type === 'text' || editable.type === 'date-time') && <input className="form-control form-control-sm" onChange={(event) => update({text: event.target.value})} placeholder="Text" type="text" value={shown.text} />}

								{values[editable.id] && (
									<button className="btn btn-unstyled btn-sm text-primary mt-1" onClick={() => onChange(editable.id, null)} type="button">
										Reset
									</button>
								)}
							</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}
