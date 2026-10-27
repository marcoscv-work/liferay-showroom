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
function summary(editable: EditableInfo): string {
	const {defaultValue, type} = editable;

	if (type === 'image' || type === 'background-image') {
		const src = defaultValue.src ?? '';

		return src.startsWith('data:') ? 'Embedded image' : src.split('/').pop() ?? '';
	}

	const text = (defaultValue.text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

	return text.length > 70 ? `${text.slice(0, 70)}…` : text;
}

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

					const update = (patch: Partial<EditableValue>) => onChange(editable.id, {...value, ...patch});

					return (
						<tr key={editable.id}>
							<th className="storybook-table__name" scope="row">
								<span className="storybook-mono">{editable.id}</span>
								<span className="d-block mt-1">
									<span className="label label-secondary">{editable.type}</span>
								</span>
								{summary(editable) && (
									<span className="d-block text-secondary small font-weight-normal storybook-editable__default" title={summary(editable)}>
										{summary(editable)}
									</span>
								)}
							</th>
							<td>
								{(editable.type === 'image' || editable.type === 'background-image') && (
									<div className="storybook-stack">
										<input className="form-control form-control-sm" onChange={(event) => update({src: event.target.value})} placeholder={editable.defaultValue.src?.startsWith('data:') ? 'Image URL (embedded placeholder by default)' : editable.defaultValue.src || 'Image URL'} type="text" value={value.src ?? ''} />
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
										{editable.type === 'image' && <input className="form-control form-control-sm" onChange={(event) => update({alt: event.target.value})} placeholder={editable.defaultValue.alt || 'Alternative text'} type="text" value={value.alt ?? ''} />}
										{editable.type === 'image' && <input className="form-control form-control-sm" onChange={(event) => update({href: event.target.value})} placeholder="Link URL (optional)" type="text" value={value.href ?? ''} />}
									</div>
								)}

								{(editable.type === 'link' || editable.type === 'action') && (
									<div className="storybook-stack">
										<input className="form-control form-control-sm" onChange={(event) => update({text: event.target.value})} placeholder={editable.defaultValue.text || 'Link text'} type="text" value={value.text ?? ''} />
										<input className="form-control form-control-sm" onChange={(event) => update({href: event.target.value})} placeholder={editable.defaultValue.href || 'https://'} type="text" value={value.href ?? ''} />
										<Toggle checked={value.target === '_blank'} label="Open in a new tab" onChange={(checked) => update({target: checked ? '_blank' : undefined})} />
									</div>
								)}

								{(editable.type === 'rich-text' || editable.type === 'html') && (
									<textarea className="form-control form-control-sm" onChange={(event) => update({text: event.target.value})} placeholder={editable.defaultValue.text || 'HTML content'} rows={3} value={value.text ?? ''} />
								)}

								{(editable.type === 'text' || editable.type === 'date-time') && <input className="form-control form-control-sm" onChange={(event) => update({text: event.target.value})} placeholder={editable.defaultValue.text || 'Text'} type="text" value={value.text ?? ''} />}

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
