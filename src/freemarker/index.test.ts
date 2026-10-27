import {describe, expect, it} from 'vitest';

import {directive, render} from './index';

const model = () => ({
	configuration: {
		buttonSize: 'nm',
		buttonType: 'primary',
		headingLevel: 'h2',
		numberOfTabs: 3,
		separatorColor: {color: 'primary', cssClass: 'primary', rgbValue: '#0b5fff'},
		type: 'link',
	},
	fragmentEntryLinkNamespace: 'ns1',
	languageUtil: {
		format: (_locale: string, key: string, args: string[]) => `${key}:${args.join(',')}`,
		get: (_locale: string, key: string) => key.toUpperCase(),
	},
	liferay_ui: {
		message: directive((params) => `[${params.key}]`),
	},
	locale: 'en_US',
});

describe('freemarker', () => {
	it('renders interpolations and if/else', () => {
		const template = `[#if configuration.type == "action"]<button>[#else]<a class="btn btn-\${configuration.buttonSize} btn-\${configuration.buttonType}">[/#if]`;

		expect(render(template, model()).output).toBe('<a class="btn btn-nm btn-primary">');
	});

	it('supports angle bracket syntax with comparisons inside parentheses', () => {
		const template = `<#if (configuration.numberOfTabs > 2)>many<#else>few</#if>`;

		expect(render(template, model()).output).toBe('many');
	});

	it('renders list over a range with arithmetic', () => {
		const template = `[#list 0..configuration.numberOfTabs-1 as i]<li id="tab\${i+1}-\${fragmentEntryLinkNamespace}">\${i}</li>[/#list]`;

		expect(render(template, model()).output).toBe('<li id="tab1-ns1">0</li><li id="tab2-ns1">1</li><li id="tab3-ns1">2</li>');
	});

	it('supports loop built-ins and assign inside loops', () => {
		const template = `[#list ["a","b"] as item][#assign index = "\${item?index}" /][#if item?is_last]last[/#if]\${index}\${item?counter}[#sep],[/#list]`;

		expect(render(template, model()).output).toBe('01,last12');
	});

	it('supports ?has_content on nested hashes and the ! default operator', () => {
		const template = `[#if configuration.separatorColor.color?has_content]border-\${configuration.separatorColor.color}[/#if] \${configuration.missing!"fallback"} \${(configuration.deep.missing)!}`;

		expect(render(template, model()).output).toBe('border-primary fallback ');
	});

	it('calls Java-like methods and user directives', () => {
		const template = `\${languageUtil.get(locale, "hello")} \${languageUtil.format(locale, 'current-x', ['selection'])} [@liferay_ui["message"] key="go" /]`;

		expect(render(template, model()).output).toBe('HELLO current-x:selection [go]');
	});

	it('renders dynamic tag names', () => {
		const template = `<\${configuration.headingLevel} class="x">T</\${configuration.headingLevel}>`;

		expect(render(template, model()).output).toBe('<h2 class="x">T</h2>');
	});

	it('supports macros with nested content', () => {
		const template = `[#macro box title]<div class="box"><h3>\${title}</h3>[#nested /]</div>[/#macro][@box title="Hi"]body[/@box]`;

		expect(render(template, model()).output).toBe('<div class="box"><h3>Hi</h3>body</div>');
	});

	it('supports string built-ins', () => {
		const template = `\${"Hello World"?lower_case?replace(" ", "-")} \${"abc"?upper_case} \${"a,b"?split(",")?size} \${true?string("yes", "no")} \${"  x "?trim}`;

		expect(render(template, model()).output).toBe('hello-world ABC 2 yes x');
	});

	it('supports switch/case', () => {
		const template = `[#switch configuration.buttonType][#case "primary"]P[#break][#case "secondary"]S[#break][#default]D[/#switch]`;

		expect(render(template, model()).output).toBe('P');
	});

	it('reports missing values instead of throwing', () => {
		const result = render(`\${configuration.nope.deeper}`, model());

		expect(result.output).toBe('');
		expect(result.warnings.length).toBeGreaterThan(0);
	});

	it('ignores comments and keeps noparse', () => {
		const template = `a[#-- hidden --]b[#noparse]\${raw}[/#noparse]`;

		expect(render(template, model()).output).toBe('ab${raw}');
	});

	it('supports hash literals, keys and nested loops', () => {
		const template = `[#assign h = {"a": 1, "b": 2}][#list h?keys as k]\${k}=\${h[k]};[/#list][#list h as k, v]\${k}\${v}[/#list]`;

		expect(render(template, model()).output).toBe('a=1;b=2;a1b2');
	});

	it('supports string interpolation inside string literals', () => {
		const template = `[#assign index = "0\${1+1}" /]\${index}`;

		expect(render(template, model()).output).toBe('02');
	});
});
