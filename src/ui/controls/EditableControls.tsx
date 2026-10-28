import {useEffect, useRef, useState} from 'react';

import {Toggle} from '../Icon';
import {ArgRow, ArgsTable} from './ConfigurationControls';

import type {EditableInfo, EditableValue} from '../../model/fragmentRenderer';

export interface EditableControlsProps {
	editables: EditableInfo[];
	/** The editable clicked in the preview: its row scrolls into view and lights up. */
	focused?: {id: string; nonce: number} | null;
	onChange: (id: string, value: EditableValue | null) => void;
	values: Record<string, EditableValue>;
}

/**
 * Controls for the `data-lfr-editable-*` fields a fragment exposes. They map
 * one to one to the `fragmentFields` of a page definition. Each field shows
 * the fragment's current content until it is overridden.
 */
export function EditableControls({editables, focused = null, onChange, values}: EditableControlsProps) {
	const rows = useRef(new Map<string, HTMLTableRowElement>());
	const [highlighted, setHighlighted] = useState<string | null>(null);

	useEffect(() => {
		if (!focused) {
			return;
		}

		const row = rows.current.get(focused.id);

		if (!row) {
			return;
		}

		row.scrollIntoView({behavior: 'smooth', block: 'center'});
		setHighlighted(focused.id);

		const timer = window.setTimeout(() => setHighlighted((current) => (current === focused.id ? null : current)), 1800);

		return () => window.clearTimeout(timer);
	}, [focused]);

	if (!editables.length) {
		return <p className="text-secondary">This fragment has no editable fields.</p>;
	}

	return (
		<ArgsTable nameHeading="Editable" valueHeading="Content">
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

					const overridden = Boolean(values[editable.id]);

					return (
						<ArgRow
							description={(editable.type === 'image' || editable.type === 'background-image') && embedded && !value.src ? 'Embedded placeholder image' : undefined}
							highlighted={highlighted === editable.id}
							key={editable.id}
							name={editable.id}
							rowRef={(element) => {
								if (element) {
									rows.current.set(editable.id, element);
								}
								else {
									rows.current.delete(editable.id);
								}
							}}
							tag={editable.type}
						>
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

							{(editable.type === 'rich-text' || editable.type === 'html') && <textarea className="form-control form-control-sm" onChange={(event) => update({text: event.target.value})} placeholder="HTML content" rows={3} value={shown.text} />}

							{(editable.type === 'text' || editable.type === 'date-time') && <input className="form-control form-control-sm" onChange={(event) => update({text: event.target.value})} placeholder="Text" type="text" value={shown.text} />}

							{overridden && (
								<button className="btn btn-unstyled btn-sm text-primary mt-1" onClick={() => onChange(editable.id, null)} type="button">
									Reset
								</button>
							)}
						</ArgRow>
					);
				})}
			</tbody>
		</ArgsTable>
	);
}
