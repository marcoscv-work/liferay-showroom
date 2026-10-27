import type {FrontendToken, FrontendTokenCategory, StyleBook, Theme} from './types';

/**
 * Parses a Liferay theme `frontend-token-definition.json`.
 */
export function parseTokenDefinition(json: any): {categories: FrontendTokenCategory[]; tokens: Record<string, FrontendToken>} {
	const categories: FrontendTokenCategory[] = [];
	const tokens: Record<string, FrontendToken> = {};

	for (const category of json?.frontendTokenCategories ?? []) {
		const sets = [];

		for (const set of category.frontendTokenSets ?? []) {
			const setTokens: FrontendToken[] = [];

			for (const token of set.frontendTokens ?? []) {
				const mapping = (token.mappings ?? []).find((m: any) => m.type === 'cssVariable');

				if (!mapping || !token.name) {
					continue;
				}

				const editorType = token.editorType === 'ColorPicker' ? 'ColorPicker' : token.editorType === 'Length' ? 'Length' : token.validValues ? 'Select' : 'Text';

				const parsed: FrontendToken = {
					cssVariable: mapping.value,
					defaultValue: token.defaultValue === undefined ? '' : String(token.defaultValue),
					editorType,
					label: token.label ?? token.name,
					name: token.name,
					validValues: token.validValues,
				};

				setTokens.push(parsed);
				tokens[token.name] = parsed;
			}

			sets.push({label: set.label ?? set.name ?? '', name: set.name ?? '', tokens: setTokens});
		}

		categories.push({label: category.label ?? category.name ?? '', name: category.name ?? '', sets});
	}

	return {categories, tokens};
}

/**
 * Converts a style book's token values into the `:root {}` rule Liferay
 * injects in the page head.
 */
export function buildTokenCSS(theme: Theme | null, values: Record<string, string>): string {
	if (!theme) {
		return '';
	}

	const declarations: string[] = [];

	for (const token of Object.values(theme.tokens)) {
		const override = values[token.name];
		const value = override === undefined || override === null || override === '' ? token.defaultValue : override;

		if (value === undefined || value === null || value === '') {
			continue;
		}

		declarations.push(`--${token.cssVariable}: ${resolveTokenReference(value, theme)};`);
	}

	if (!declarations.length) {
		return '';
	}

	return `:root {\n\t${declarations.join('\n\t')}\n}`;
}

/**
 * A token value can reference another token by name (e.g. `brandColor1`).
 * Liferay resolves those references to `var(--brand-color-1)`.
 */
export function resolveTokenReference(value: string, theme: Theme | null): string {
	if (theme && theme.tokens[value]) {
		return `var(--${theme.tokens[value].cssVariable})`;
	}

	return value;
}

export function effectiveTokenValue(theme: Theme, styleBook: StyleBook | null, name: string, depth = 0): string {
	const value = styleBook && styleBook.values[name] !== undefined ? styleBook.values[name] : theme.tokens[name]?.defaultValue ?? '';

	if (depth < 10 && value !== name && theme.tokens[value]) {
		return effectiveTokenValue(theme, styleBook, value, depth + 1);
	}

	return value;
}

/**
 * Parses the two style book formats Liferay produces: the export zip
 * (`style-book.json` + `frontend-tokens-values.json`) and the site
 * initializer layout, whose `style-book.json` carries
 * `frontendTokensValues` inline.
 */
export function parseStyleBookValues(styleBookJSON: any, tokenValuesJSON: any): Record<string, string> {
	const source = tokenValuesJSON ?? styleBookJSON?.frontendTokensValues ?? {};

	const values: Record<string, string> = {};

	for (const [name, entry] of Object.entries<any>(source)) {
		if (entry && typeof entry === 'object' && 'value' in entry) {
			values[name] = String(entry.value);
		}
		else if (typeof entry === 'string' || typeof entry === 'number') {
			values[name] = String(entry);
		}
	}

	return values;
}

export function serializeStyleBook(styleBook: StyleBook, theme: Theme | null): {styleBookJSON: any; tokenValuesJSON: any} {
	const tokenValuesJSON: Record<string, any> = {};

	for (const [name, value] of Object.entries(styleBook.values)) {
		tokenValuesJSON[name] = {
			cssVariableMapping: theme?.tokens[name]?.cssVariable ?? name,
			value,
		};
	}

	return {
		styleBookJSON: {
			frontendTokensValuesPath: 'frontend-tokens-values.json',
			name: styleBook.name,
			themeId: theme ? `${theme.key}_WAR_${theme.key}theme` : undefined,
		},
		tokenValuesJSON,
	};
}
