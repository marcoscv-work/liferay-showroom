import {directive, escapeHTML} from '../freemarker';

import type {Context} from '../freemarker';

/**
 * Stand-ins for the objects Liferay injects into fragment templates. They
 * cover what fragments typically touch (`languageUtil`, `themeDisplay`,
 * `[@liferay_ui["message"] /]`, `[@clay["icon"] /]`) and warn about the rest.
 */

export interface LiferayContextOptions {
	imagesPath: string;
	layoutMode: 'view' | 'edit';
	locale: string;
	namespace: string;
}

export function humanize(key: string): string {
	if (!key) {
		return '';
	}

	const text = key.replace(/[-_]+/g, ' ').trim();

	return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatMessage(key: string, args: any[]): string {
	const list = Array.isArray(args) ? args : args === undefined ? [] : [args];

	let index = 0;

	let text = key.replace(/\{(\d+)\}/g, (_, n) => String(list[Number(n)] ?? ''));

	if (text === key) {
		text = key
			.split('-')
			.map((word) => (word === 'x' && index < list.length ? String(list[index++]) : word))
			.join(' ');
	}

	return humanize(text);
}

export function clayIcon(symbol: string, imagesPath: string, cssClass = ''): string {
	return `<svg class="lexicon-icon lexicon-icon-${escapeHTML(symbol)} ${escapeHTML(cssClass)}" focusable="false" role="presentation"><use href="${imagesPath}/clay/icons.svg#${escapeHTML(symbol)}"></use></svg>`;
}

export function buildLiferayContext(options: LiferayContextOptions): Record<string, any> {
	const {imagesPath, layoutMode, locale, namespace} = options;

	const languageId = locale;

	const themeDisplay = {
		getCDNBaseURL: () => '',
		getCompanyId: () => 0,
		getLanguageId: () => languageId,
		getLayout: () => ({getFriendlyURL: () => '/', getName: () => 'Page', getTitle: () => 'Page', isTypeContent: () => true}),
		getLocale: () => locale,
		getPathContext: () => '',
		getPathFriendlyURLPublic: () => '/web',
		getPathImage: () => '/image',
		getPathMain: () => '/c',
		getPathThemeImages: () => imagesPath,
		getPathThemeRoot: () => imagesPath.replace(/\/images$/, ''),
		getPlid: () => 0,
		getPortalURL: () => '',
		getScopeGroup: () => ({getName: () => 'Guest', getGroupKey: () => 'Guest'}),
		getScopeGroupId: () => 0,
		getSiteGroupId: () => 0,
		getTimeZone: () => ({getID: () => Intl.DateTimeFormat().resolvedOptions().timeZone}),
		getURLCurrent: () => '/',
		getUser: () => ({getFullName: () => 'Storybook User', getFirstName: () => 'Storybook', getScreenName: () => 'storybook', isDefaultUser: () => true}),
		getUserId: () => 0,
		isSignedIn: () => false,
		isStateMaximized: () => false,
	};

	const languageUtil = {
		format: (_locale: string, key: string, args: any) => formatMessage(String(key), args),
		get: (_locale: string, key: string, defaultValue?: string) => (defaultValue === undefined ? humanize(String(key)) : defaultValue),
		isAvailableLocale: () => true,
	};

	const message = directive((params) => {
		const key = String(params.key ?? '');

		if (params.arguments !== undefined) {
			return formatMessage(key, params.arguments);
		}

		return humanize(key);
	});

	const icon = directive((params) => {
		const cssClass = params.className ?? params.cssClass ?? params['class'] ?? params.elementClasses ?? '';

		return clayIcon(String(params.symbol ?? ''), imagesPath, cssClass ? String(cssClass) : '');
	});

	const warnDirective = (name: string) =>
		directive((_params, renderBody, context: Context) => {
			context.warn(`Taglib ${name} is not available outside Liferay; only its body was rendered`);

			return renderBody();
		});

	const taglibProxy = (prefix: string, known: Record<string, any> = {}) =>
		new Proxy(known, {
			get: (target, key) => {
				if (typeof key !== 'string') {
					return undefined;
				}

				if (key in target) {
					return target[key];
				}

				return warnDirective(`@${prefix}["${key}"]`);
			},
			has: () => true,
		});

	return {
		clay: taglibProxy('clay', {icon}),
		configuration: {},
		fragmentElementId: `fragment-${namespace}`,
		fragmentEntryLinkNamespace: namespace,
		getterUtil: {
			getBoolean: (value: any, defaultValue = false) => (value === undefined || value === null ? defaultValue : value === true || value === 'true'),
			getInteger: (value: any, defaultValue = 0) => (Number.isNaN(Number(value)) || value === '' || value === undefined ? defaultValue : Math.trunc(Number(value))),
			getString: (value: any, defaultValue = '') => (value === undefined || value === null ? defaultValue : String(value)),
		},
		htmlUtil: {
			escape: (value: any) => escapeHTML(String(value ?? '')),
			escapeAttribute: (value: any) => escapeHTML(String(value ?? '')),
			escapeJS: (value: any) => JSON.stringify(String(value ?? '')).slice(1, -1),
			stripHtml: (value: any) => String(value ?? '').replace(/<[^>]*>/g, ''),
			unescape: (value: any) => String(value ?? ''),
		},
		languageId,
		languageUtil,
		layoutMode,
		liferay_aui: taglibProxy('liferay_aui'),
		liferay_frontend: taglibProxy('liferay_frontend'),
		liferay_portlet: taglibProxy('liferay_portlet'),
		liferay_theme: taglibProxy('liferay_theme'),
		liferay_ui: taglibProxy('liferay_ui', {message}),
		liferay_util: taglibProxy('liferay_util'),
		locale,
		portalUtil: {
			getCurrentURL: () => '/',
			getPortalURL: () => '',
			getSiteDefaultLocale: () => locale,
		},
		stringUtil: {
			equals: (a: any, b: any) => String(a) === String(b),
			lowerCase: (value: any) => String(value ?? '').toLowerCase(),
			randomId: () => Math.random().toString(36).slice(2, 10),
			randomString: () => Math.random().toString(36).slice(2, 10),
			replace: (value: any, from: any, to: any) => String(value ?? '').split(String(from)).join(String(to)),
			split: (value: any, separator: any = ',') => String(value ?? '').split(String(separator)),
			upperCase: (value: any) => String(value ?? '').toUpperCase(),
		},
		themeDisplay,
		validator: {
			isBlank: (value: any) => value === undefined || value === null || String(value).trim() === '',
			isNotNull: (value: any) => value !== undefined && value !== null && String(value) !== '',
			isNull: (value: any) => value === undefined || value === null || String(value) === '',
			isNumber: (value: any) => value !== '' && !Number.isNaN(Number(value)),
			isUrl: (value: any) => /^https?:\/\//.test(String(value ?? '')),
		},
	};
}
