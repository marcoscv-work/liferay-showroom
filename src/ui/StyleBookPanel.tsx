import {useState} from 'react';

import {humanize} from '../model/liferayContext';
import {effectiveTokenValue} from '../model/tokens';
import {DEFAULT_STYLE_BOOK_KEY, useCurrentStyleBook, useCurrentTheme, useStore} from '../store';
import {Icon} from './Icon';

import type {FrontendToken} from '../model/types';

/**
 * Shows the theme's frontend tokens grouped like Liferay's style book editor,
 * with the current style book values as editable "props".
 */
export function StyleBookPanel() {
	const {dispatch} = useStore();
	const theme = useCurrentTheme();
	const styleBook = useCurrentStyleBook();
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState<string>('');

	if (!theme) {
		return <p className="text-secondary">No theme loaded.</p>;
	}

	const normalizedQuery = query.trim().toLowerCase();

	const categories = theme.categories.filter((candidate) => !category || candidate.name === category);

	const changed = Object.keys(styleBook.values).filter((name) => theme.tokens[name]).length;

	return (
		<div>
			<div className="storybook-stylebook__header">
				<div className="d-flex align-items-center flex-wrap">
					{styleBook.key !== DEFAULT_STYLE_BOOK_KEY ? (
						<input aria-label="Style book name" className="form-control form-control-sm storybook-stylebook__name mr-2" onChange={(event) => dispatch({key: styleBook.key, name: event.target.value, type: 'renameStyleBook'})} type="text" value={styleBook.name} />
					) : (
						<strong className="mr-2">{styleBook.name}</strong>
					)}
					<span className="text-secondary mr-2">on {theme.name}</span>
					<span className={`label ${changed ? 'label-info' : 'label-secondary'}`}>{changed ? `${changed} token${changed === 1 ? '' : 's'} overridden` : 'theme defaults'}</span>
				</div>

				<div className="d-flex">
					<select aria-label="Token category" className="form-control form-control-sm mr-2" onChange={(event) => setCategory(event.target.value)} value={category}>
						<option value="">All categories</option>
						{theme.categories.map((candidate) => (
							<option key={candidate.name} value={candidate.name}>
								{humanize(candidate.label)}
							</option>
						))}
					</select>
					<div className="input-group input-group-sm">
						<div className="input-group-item">
							<input aria-label="Filter tokens" className="form-control" onChange={(event) => setQuery(event.target.value)} placeholder="Filter tokens…" type="search" value={query} />
						</div>
						<span className="input-group-item input-group-item-shrink input-group-append">
							<span className="input-group-text">
								<Icon symbol="search" />
							</span>
						</span>
					</div>
				</div>
			</div>

			{categories.map((currentCategory) => (
				<section className="storybook-stylebook__category" key={currentCategory.name}>
					<h3 className="sheet-subtitle">{humanize(currentCategory.label)}</h3>

					{currentCategory.sets.map((set) => {
						const tokens = set.tokens.filter((token) => !normalizedQuery || token.name.toLowerCase().includes(normalizedQuery) || token.label.toLowerCase().includes(normalizedQuery) || token.cssVariable.includes(normalizedQuery));

						if (!tokens.length) {
							return null;
						}

						return (
							<div className="mb-3" key={set.name}>
								<h4 className="storybook-stylebook__set-title">{humanize(set.label)}</h4>

								<table className="table table-autofit table-sm storybook-table">
									<thead>
										<tr>
											<th className="table-cell-expand-smaller" scope="col">
												Token
											</th>
											<th className="table-cell-expand" scope="col">
												Value
											</th>
											<th className="table-cell-expand-smallest" scope="col">
												Default
											</th>
										</tr>
									</thead>
									<tbody>
										{tokens.map((token) => (
											<TokenRow key={token.name} onChange={(value) => dispatch({name: token.name, type: 'setTokenValue', value})} token={token} value={styleBook.values[token.name]} />
										))}
									</tbody>
								</table>
							</div>
						);
					})}
				</section>
			))}
		</div>
	);
}

function TokenRow({onChange, token, value}: {onChange: (value: string | null) => void; token: FrontendToken; value: string | undefined}) {
	const theme = useCurrentTheme();
	const styleBook = useCurrentStyleBook();
	const current = value ?? token.defaultValue;
	const effective = theme ? effectiveTokenValue(theme, styleBook, token.name) : current;
	const overridden = value !== undefined;

	const referencedToken = theme?.tokens[current];

	const colorTokens = theme ? Object.values(theme.tokens).filter((candidate) => candidate.editorType === 'ColorPicker' && candidate.name !== token.name) : [];

	return (
		<tr className={overridden ? 'storybook-table__row--changed' : undefined}>
			<th className="storybook-table__name" scope="row">
				<span className="storybook-mono">{token.name}</span>
				<span className="d-block text-secondary small font-weight-normal">{humanize(token.label)}</span>
				<span className="d-block text-secondary small font-weight-normal">--{token.cssVariable}</span>
			</th>
			<td>
				{token.editorType === 'ColorPicker' ? (
					<div className="storybook-color">
						<span className="storybook-swatch" style={{background: effective}} title={effective} />
						<input aria-label={`${humanize(token.label)} color`} className="storybook-color__input" onChange={(event) => onChange(event.target.value)} type="color" value={/^#[0-9a-f]{6}$/i.test(current) ? current : '#000000'} />
						<select aria-label={`${humanize(token.label)} token reference`} className="form-control form-control-sm" onChange={(event) => onChange(event.target.value || null)} value={referencedToken ? current : ''}>
							<option value="">Custom</option>
							{colorTokens.map((candidate) => (
								<option key={candidate.name} value={candidate.name}>
									{humanize(candidate.label)}
								</option>
							))}
						</select>
						<input aria-label={`${humanize(token.label)} value`} className="form-control form-control-sm storybook-color__text" onChange={(event) => onChange(event.target.value)} type="text" value={current} />
					</div>
				) : token.editorType === 'Select' && token.validValues ? (
					<select className="form-control form-control-sm" onChange={(event) => onChange(event.target.value)} value={current}>
						{token.validValues.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				) : (
					<input className="form-control form-control-sm" onChange={(event) => onChange(event.target.value)} type="text" value={current} />
				)}
				{overridden && (
					<button className="btn btn-unstyled btn-sm text-primary mt-1" onClick={() => onChange(null)} type="button">
						<Icon className="mr-1" symbol="reset" />
						Reset
					</button>
				)}
			</td>
			<td className="text-secondary">
				<span className="storybook-mono">{token.defaultValue}</span>
			</td>
		</tr>
	);
}
