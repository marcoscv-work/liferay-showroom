/**
 * A small FreeMarker interpreter that covers the subset Liferay fragments use:
 * interpolations, if/elseif/else, list (with loop variable built-ins), assign,
 * local, global, macro/nested, switch/case, attempt/recover, noparse, compress,
 * user directives (`[@liferay_ui["message"] key="x" /]`) and the most common
 * built-ins (`?has_content`, `?string`, `?size`, `?replace`...).
 *
 * Both the square-bracket (`[#if]`) and angle-bracket (`<#if>`) syntaxes are
 * accepted in the same template.
 *
 * Unknown directives and failures never throw at render time: they are
 * reported through `RenderResult.warnings` so the UI can show them.
 */

export type FMValue = any;

export type FMScope = Record<string, FMValue>;

export interface RenderResult {
	output: string;
	warnings: string[];
}

export interface DirectiveFunction {
	(params: Record<string, FMValue>, renderBody: (loopVars?: FMValue[]) => string, context: Context): string;
	__directive: true;
}

export function directive(fn: (params: Record<string, FMValue>, renderBody: (loopVars?: FMValue[]) => string, context: Context) => string): DirectiveFunction {
	const wrapped = fn as DirectiveFunction;

	wrapped.__directive = true;

	return wrapped;
}

/* ------------------------------------------------------------------------ */
/* Template tokenizer                                                        */
/* ------------------------------------------------------------------------ */

type Token =
	| {type: 'text'; value: string}
	| {type: 'interpolation'; expr: string}
	| {type: 'directive'; name: string; params: string; selfClosing: boolean}
	| {type: 'directiveEnd'; name: string}
	| {type: 'user'; expr: string; params: string; selfClosing: boolean}
	| {type: 'userEnd'; expr: string};

function findTagEnd(src: string, from: number, close: string): number {
	let depth = 0;
	let quote: string | null = null;

	for (let i = from; i < src.length; i++) {
		const ch = src[i];

		if (quote) {
			if (ch === '\\') {
				i++;
			}
			else if (ch === quote) {
				quote = null;
			}

			continue;
		}

		if (ch === '"' || ch === "'") {
			quote = ch;
		}
		else if (ch === '(' || ch === '[' || ch === '{') {
			depth++;
		}
		else if (ch === ')' || ch === '}') {
			depth--;
		}
		else if (ch === ']') {
			if (close === ']' && depth === 0) {
				return i;
			}

			depth--;
		}
		else if (ch === close && depth <= 0) {
			return i;
		}
	}

	return -1;
}

function findInterpolationEnd(src: string, from: number): number {
	let depth = 0;
	let quote: string | null = null;

	for (let i = from; i < src.length; i++) {
		const ch = src[i];

		if (quote) {
			if (ch === '\\') {
				i++;
			}
			else if (ch === quote) {
				quote = null;
			}

			continue;
		}

		if (ch === '"' || ch === "'") {
			quote = ch;
		}
		else if (ch === '{') {
			depth++;
		}
		else if (ch === '}') {
			if (depth === 0) {
				return i;
			}

			depth--;
		}
	}

	return -1;
}

const DIRECTIVE_NAME = /^([a-zA-Z_][a-zA-Z0-9_]*)/;

export function tokenize(src: string): Token[] {
	const tokens: Token[] = [];

	let text = '';
	let i = 0;

	const flush = () => {
		if (text) {
			tokens.push({type: 'text', value: text});
			text = '';
		}
	};

	while (i < src.length) {
		const ch = src[i];
		const next = src[i + 1];
		const next2 = src[i + 2];

		if (ch === '$' && next === '{') {
			const end = findInterpolationEnd(src, i + 2);

			if (end === -1) {
				text += ch;
				i++;
				continue;
			}

			flush();
			tokens.push({type: 'interpolation', expr: src.slice(i + 2, end)});
			i = end + 1;
			continue;
		}

		const square = ch === '[';
		const angle = ch === '<';

		if ((square || angle) && (next === '#' || next === '@' || (next === '/' && (next2 === '#' || next2 === '@')))) {
			const close = square ? ']' : '>';
			const isEnd = next === '/';
			const kind = isEnd ? next2 : next;
			const bodyStart = i + (isEnd ? 3 : 2);

			if (!isEnd && kind === '#' && src.startsWith('--', bodyStart)) {
				const commentEnd = src.indexOf(`--${close}`, bodyStart + 2);

				if (commentEnd === -1) {
					text += ch;
					i++;
					continue;
				}

				flush();
				i = commentEnd + 3;
				continue;
			}

			const end = findTagEnd(src, bodyStart, close);

			if (end === -1) {
				text += ch;
				i++;
				continue;
			}

			let body = src.slice(bodyStart, end).trim();
			let selfClosing = false;

			if (body.endsWith('/')) {
				selfClosing = true;
				body = body.slice(0, -1).trim();
			}

			if (kind === '#') {
				const match = DIRECTIVE_NAME.exec(body);

				if (!match) {
					text += ch;
					i++;
					continue;
				}

				const name = match[1];
				const params = body.slice(name.length).trim();

				if (!isEnd && name === 'noparse') {
					const closeTag = square ? '[/#noparse]' : '</#noparse>';
					const noparseEnd = src.indexOf(closeTag, end + 1);

					flush();

					if (noparseEnd === -1) {
						tokens.push({type: 'text', value: src.slice(end + 1)});
						i = src.length;
					}
					else {
						tokens.push({type: 'text', value: src.slice(end + 1, noparseEnd)});
						i = noparseEnd + closeTag.length;
					}

					continue;
				}

				flush();

				if (isEnd) {
					tokens.push({type: 'directiveEnd', name});
				}
				else {
					tokens.push({type: 'directive', name, params, selfClosing});
				}
			}
			else {
				flush();

				const {expr, params} = splitUserDirective(body);

				if (isEnd) {
					tokens.push({type: 'userEnd', expr});
				}
				else {
					tokens.push({type: 'user', expr, params, selfClosing});
				}
			}

			i = end + 1;
			continue;
		}

		text += ch;
		i++;
	}

	flush();

	return tokens;
}

function splitUserDirective(body: string): {expr: string; params: string} {
	let depth = 0;
	let quote: string | null = null;

	for (let i = 0; i < body.length; i++) {
		const ch = body[i];

		if (quote) {
			if (ch === '\\') {
				i++;
			}
			else if (ch === quote) {
				quote = null;
			}

			continue;
		}

		if (ch === '"' || ch === "'") {
			quote = ch;
		}
		else if (ch === '(' || ch === '[') {
			depth++;
		}
		else if (ch === ')' || ch === ']') {
			depth--;
		}
		else if (/\s/.test(ch) && depth === 0) {
			return {expr: body.slice(0, i), params: body.slice(i).trim()};
		}
	}

	return {expr: body, params: ''};
}

/* ------------------------------------------------------------------------ */
/* Template AST                                                              */
/* ------------------------------------------------------------------------ */

type Node =
	| {type: 'text'; value: string}
	| {type: 'interpolation'; expr: Expr}
	| {type: 'if'; branches: {condition: Expr | null; body: Node[]}[]}
	| {type: 'list'; seq: Expr; key?: string; item?: string; body: Node[]; elseBody: Node[]}
	| {type: 'items'; key?: string; item?: string; body: Node[]}
	| {type: 'sep'; body: Node[]}
	| {type: 'assign'; scope: 'assign' | 'local' | 'global'; assignments: {name: string; expr: Expr | null; op: string}[]; captureName?: string; body?: Node[]}
	| {type: 'macro'; name: string; params: {name: string; defaultValue: Expr | null; catchAll: boolean}[]; body: Node[]; isFunction: boolean}
	| {type: 'return'; expr: Expr | null}
	| {type: 'nested'; args: Expr[]}
	| {type: 'switch'; expr: Expr; cases: {expr: Expr | null; body: Node[]}[]}
	| {type: 'break'}
	| {type: 'attempt'; body: Node[]; recover: Node[]}
	| {type: 'compress'; body: Node[]}
	| {type: 'user'; expr: Expr; params: {name: string; expr: Expr}[]; positional: Expr[]; body: Node[]; loopVars: string[]}
	| {type: 'ignored'; name: string};

class TemplateParser {
	private pos = 0;

	constructor(private tokens: Token[], private warnings: string[]) {}

	parse(): Node[] {
		const nodes = this.parseUntil(() => false);

		return nodes;
	}

	private peek(): Token | undefined {
		return this.tokens[this.pos];
	}

	private parseUntil(stop: (token: Token) => boolean): Node[] {
		const nodes: Node[] = [];

		while (this.pos < this.tokens.length) {
			const token = this.tokens[this.pos];

			if (stop(token)) {
				break;
			}

			this.pos++;

			const node = this.parseToken(token);

			if (node) {
				nodes.push(node);
			}
		}

		return nodes;
	}

	private expectEnd(name: string): void {
		const token = this.peek();

		if (token && token.type === 'directiveEnd' && token.name === name) {
			this.pos++;
		}
		else {
			this.warnings.push(`Missing [/#${name}]`);
		}
	}

	private parseToken(token: Token): Node | null {
		switch (token.type) {
			case 'text':
				return {type: 'text', value: token.value};
			case 'interpolation':
				return {type: 'interpolation', expr: parseExpression(token.expr, this.warnings)};
			case 'directiveEnd':
				this.warnings.push(`Unexpected [/#${token.name}]`);

				return null;
			case 'userEnd':
				this.warnings.push(`Unexpected [/@${token.expr}]`);

				return null;
			case 'user':
				return this.parseUser(token);
			case 'directive':
				return this.parseDirective(token);
		}
	}

	private parseUser(token: Extract<Token, {type: 'user'}>): Node {
		const expr = parseExpression(token.expr, this.warnings);
		const {named, positional, loopVars} = parseUserParams(token.params, this.warnings);

		let body: Node[] = [];

		if (!token.selfClosing) {
			body = this.parseUntil((t) => t.type === 'userEnd');

			const end = this.peek();

			if (end && end.type === 'userEnd') {
				this.pos++;
			}
		}

		return {type: 'user', expr, params: named, positional, body, loopVars};
	}

	private parseDirective(token: Extract<Token, {type: 'directive'}>): Node | null {
		const {name, params} = token;

		switch (name) {
			case 'if': {
				const branches: {condition: Expr | null; body: Node[]}[] = [];

				let condition: Expr | null = parseExpression(params, this.warnings);

				while (true) {
					const body = this.parseUntil(
						(t) => (t.type === 'directive' && (t.name === 'elseif' || t.name === 'else')) || (t.type === 'directiveEnd' && t.name === 'if')
					);

					branches.push({condition, body});

					const next = this.peek();

					if (next && next.type === 'directive' && next.name === 'elseif') {
						this.pos++;
						condition = parseExpression(next.params, this.warnings);
						continue;
					}

					if (next && next.type === 'directive' && next.name === 'else') {
						this.pos++;
						condition = null;
						continue;
					}

					break;
				}

				this.expectEnd('if');

				return {type: 'if', branches};
			}
			case 'list': {
				const match = /^(.*?)(?:\s+as\s+([a-zA-Z_][\w]*)(?:\s*,\s*([a-zA-Z_][\w]*))?)?$/s.exec(params);
				const seq = parseExpression(match ? match[1] : params, this.warnings);
				const key = match && match[3] ? match[2] : undefined;
				const item = match && match[3] ? match[3] : match && match[2] ? match[2] : undefined;

				const body = this.parseUntil(
					(t) => (t.type === 'directive' && t.name === 'else') || (t.type === 'directiveEnd' && t.name === 'list')
				);

				let elseBody: Node[] = [];

				const next = this.peek();

				if (next && next.type === 'directive' && next.name === 'else') {
					this.pos++;
					elseBody = this.parseUntil((t) => t.type === 'directiveEnd' && t.name === 'list');
				}

				this.expectEnd('list');

				return {type: 'list', seq, key, item, body, elseBody};
			}
			case 'items': {
				const match = /^as\s+([a-zA-Z_][\w]*)(?:\s*,\s*([a-zA-Z_][\w]*))?$/.exec(params);
				const body = this.parseUntil((t) => t.type === 'directiveEnd' && t.name === 'items');

				this.expectEnd('items');

				return {
					type: 'items',
					key: match && match[2] ? match[1] : undefined,
					item: match && match[2] ? match[2] : match ? match[1] : undefined,
					body,
				};
			}
			case 'sep': {
				if (token.selfClosing) {
					return {type: 'sep', body: []};
				}

				const body = this.parseUntil((t) => t.type === 'directiveEnd' && t.name === 'sep');

				this.expectEnd('sep');

				return {type: 'sep', body};
			}
			case 'assign':
			case 'local':
			case 'global': {
				const assignments = parseAssignments(params, this.warnings);

				if (assignments.length === 1 && assignments[0].expr === null && !token.selfClosing) {
					const body = this.parseUntil((t) => t.type === 'directiveEnd' && t.name === name);

					this.expectEnd(name);

					return {type: 'assign', scope: name, assignments: [], captureName: assignments[0].name, body};
				}

				return {type: 'assign', scope: name, assignments};
			}
			case 'macro':
			case 'function': {
				const {name: macroName, params: macroParams} = parseMacroSignature(params, this.warnings);
				const body = this.parseUntil((t) => t.type === 'directiveEnd' && t.name === name);

				this.expectEnd(name);

				return {type: 'macro', name: macroName, params: macroParams, body, isFunction: name === 'function'};
			}
			case 'return':
				return {type: 'return', expr: params ? parseExpression(params, this.warnings) : null};
			case 'nested':
				return {type: 'nested', args: params ? splitTopLevel(params, ',').map((p) => parseExpression(p, this.warnings)) : []};
			case 'switch': {
				const expr = parseExpression(params, this.warnings);
				const cases: {expr: Expr | null; body: Node[]}[] = [];

				this.parseUntil((t) => t.type === 'directive' && (t.name === 'case' || t.name === 'default') || (t.type === 'directiveEnd' && t.name === 'switch'));

				while (true) {
					const next = this.peek();

					if (!next || next.type !== 'directive' || (next.name !== 'case' && next.name !== 'default')) {
						break;
					}

					this.pos++;

					const caseExpr = next.name === 'case' ? parseExpression(next.params, this.warnings) : null;

					const body = this.parseUntil(
						(t) => (t.type === 'directive' && (t.name === 'case' || t.name === 'default')) || (t.type === 'directiveEnd' && t.name === 'switch')
					);

					cases.push({expr: caseExpr, body});
				}

				this.expectEnd('switch');

				return {type: 'switch', expr, cases};
			}
			case 'break':
				return {type: 'break'};
			case 'attempt': {
				const body = this.parseUntil((t) => (t.type === 'directive' && t.name === 'recover') || (t.type === 'directiveEnd' && t.name === 'attempt'));

				let recover: Node[] = [];

				const next = this.peek();

				if (next && next.type === 'directive' && next.name === 'recover') {
					this.pos++;
					recover = this.parseUntil((t) => t.type === 'directiveEnd' && t.name === 'attempt');
				}

				this.expectEnd('attempt');

				return {type: 'attempt', body, recover};
			}
			case 'compress': {
				const body = this.parseUntil((t) => t.type === 'directiveEnd' && t.name === 'compress');

				this.expectEnd('compress');

				return {type: 'compress', body};
			}
			case 'ftl':
			case 'setting':
			case 'import':
			case 'include':
			case 'escape':
			case 'noescape':
			case 'stop':
			case 'flush':
			case 'lt':
			case 'rt':
			case 't':
			case 'nt':
			case 'autoesc':
			case 'noautoesc':
			case 'outputformat':
			case 'visit':
			case 'recurse':
			case 'fallback':
				if (name === 'escape' || name === 'noescape' || name === 'autoesc' || name === 'noautoesc' || name === 'outputformat') {
					const body = this.parseUntil((t) => t.type === 'directiveEnd' && t.name === name);

					this.expectEnd(name);

					return {type: 'compress', body} as Node;
				}

				if (name === 'import' || name === 'include') {
					this.warnings.push(`[#${name} ${params}] is not supported outside Liferay and was ignored`);
				}

				return {type: 'ignored', name};
			default:
				this.warnings.push(`Unknown directive [#${name}] was ignored`);

				if (!token.selfClosing) {
					const body = this.parseUntil((t) => t.type === 'directiveEnd' && t.name === name);

					if (this.peek()?.type === 'directiveEnd') {
						this.pos++;
					}

					return {type: 'compress', body};
				}

				return {type: 'ignored', name};
		}
	}
}

function parseAssignments(params: string, warnings: string[]): {name: string; expr: Expr | null; op: string}[] {
	const result: {name: string; expr: Expr | null; op: string}[] = [];

	const parts = splitAssignments(params);

	for (const part of parts) {
		const match = /^([a-zA-Z_][\w]*)\s*(\+=|-=|\*=|\/=|%=|=|\+\+|--)?\s*(.*)$/s.exec(part.trim());

		if (!match) {
			warnings.push(`Cannot parse assignment "${part}"`);
			continue;
		}

		const [, name, op, rest] = match;

		if (!op) {
			result.push({name, expr: null, op: '='});
		}
		else if (op === '++' || op === '--') {
			result.push({name, expr: parseExpression(`${name} ${op[0]} 1`, warnings), op: '='});
		}
		else {
			result.push({name, expr: parseExpression(rest, warnings), op});
		}
	}

	return result;
}

function splitAssignments(params: string): string[] {
	const parts: string[] = [];

	let depth = 0;
	let quote: string | null = null;
	let current = '';
	let lastWasAssignmentValue = false;

	for (let i = 0; i < params.length; i++) {
		const ch = params[i];

		if (quote) {
			current += ch;

			if (ch === '\\') {
				current += params[++i] ?? '';
			}
			else if (ch === quote) {
				quote = null;
			}

			continue;
		}

		if (ch === '"' || ch === "'") {
			quote = ch;
		}
		else if ('([{'.includes(ch)) {
			depth++;
		}
		else if (')]}'.includes(ch)) {
			depth--;
		}
		else if (ch === ',' && depth === 0) {
			parts.push(current);
			current = '';
			lastWasAssignmentValue = false;
			continue;
		}
		else if (/\s/.test(ch) && depth === 0 && lastWasAssignmentValue) {
			const rest = params.slice(i + 1);

			if (/^\s*[a-zA-Z_][\w]*\s*(=|\+=|-=|\*=|\/=|%=)/.test(rest) && !/^\s*(in|as|gt|gte|lt|lte)\b/.test(rest)) {
				parts.push(current);
				current = '';
				lastWasAssignmentValue = false;
				continue;
			}
		}

		if (ch === '=' && depth === 0) {
			lastWasAssignmentValue = true;
		}

		current += ch;
	}

	if (current.trim()) {
		parts.push(current);
	}

	return parts;
}

function parseMacroSignature(params: string, warnings: string[]): {name: string; params: {name: string; defaultValue: Expr | null; catchAll: boolean}[]} {
	const match = /^([a-zA-Z_][\w]*)\s*(.*)$/s.exec(params.trim());

	if (!match) {
		warnings.push(`Cannot parse macro "${params}"`);

		return {name: '', params: []};
	}

	let rest = match[2].trim();

	if (rest.startsWith('(') && rest.endsWith(')')) {
		rest = rest.slice(1, -1);
	}

	const result: {name: string; defaultValue: Expr | null; catchAll: boolean}[] = [];

	for (const part of splitAssignments(rest)) {
		const trimmed = part.trim();

		if (!trimmed) {
			continue;
		}

		const paramMatch = /^([a-zA-Z_][\w]*)(\.\.\.)?\s*(?:=\s*(.*))?$/s.exec(trimmed);

		if (!paramMatch) {
			warnings.push(`Cannot parse macro parameter "${trimmed}"`);
			continue;
		}

		result.push({
			name: paramMatch[1],
			catchAll: Boolean(paramMatch[2]),
			defaultValue: paramMatch[3] ? parseExpression(paramMatch[3], warnings) : null,
		});
	}

	return {name: match[1], params: result};
}

function parseUserParams(params: string, warnings: string[]): {named: {name: string; expr: Expr}[]; positional: Expr[]; loopVars: string[]} {
	let loopVars: string[] = [];
	let body = params;

	const semicolon = findTopLevel(body, ';');

	if (semicolon !== -1) {
		loopVars = body
			.slice(semicolon + 1)
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		body = body.slice(0, semicolon);
	}

	const named: {name: string; expr: Expr}[] = [];
	const positional: Expr[] = [];

	for (const part of splitAssignments(body)) {
		const trimmed = part.trim();

		if (!trimmed) {
			continue;
		}

		const match = /^([a-zA-Z_][\w\-]*)\s*=\s*(.*)$/s.exec(trimmed);

		if (match && !/^(==)/.test(trimmed.slice(match[1].length).trim())) {
			named.push({name: match[1], expr: parseExpression(match[2], warnings)});
		}
		else {
			positional.push(parseExpression(trimmed, warnings));
		}
	}

	return {named, positional, loopVars};
}

function findTopLevel(src: string, needle: string): number {
	let depth = 0;
	let quote: string | null = null;

	for (let i = 0; i < src.length; i++) {
		const ch = src[i];

		if (quote) {
			if (ch === '\\') {
				i++;
			}
			else if (ch === quote) {
				quote = null;
			}

			continue;
		}

		if (ch === '"' || ch === "'") {
			quote = ch;
		}
		else if ('([{'.includes(ch)) {
			depth++;
		}
		else if (')]}'.includes(ch)) {
			depth--;
		}
		else if (ch === needle && depth === 0) {
			return i;
		}
	}

	return -1;
}

function splitTopLevel(src: string, separator: string): string[] {
	const parts: string[] = [];

	let rest = src;

	while (true) {
		const index = findTopLevel(rest, separator);

		if (index === -1) {
			if (rest.trim()) {
				parts.push(rest.trim());
			}

			break;
		}

		parts.push(rest.slice(0, index).trim());
		rest = rest.slice(index + 1);
	}

	return parts;
}

/* ------------------------------------------------------------------------ */
/* Expressions                                                               */
/* ------------------------------------------------------------------------ */

type Expr =
	| {type: 'literal'; value: FMValue}
	| {type: 'identifier'; name: string}
	| {type: 'special'; name: string}
	| {type: 'list'; items: Expr[]}
	| {type: 'range'; from: Expr; to: Expr; inclusive: boolean; length: boolean}
	| {type: 'hash'; entries: {key: Expr; value: Expr}[]}
	| {type: 'dot'; target: Expr; name: string}
	| {type: 'index'; target: Expr; index: Expr}
	| {type: 'call'; target: Expr; args: Expr[]; named: {name: string; expr: Expr}[]}
	| {type: 'builtin'; target: Expr; name: string; args: Expr[] | null}
	| {type: 'exists'; target: Expr}
	| {type: 'default'; target: Expr; fallback: Expr | null}
	| {type: 'unary'; op: string; operand: Expr}
	| {type: 'binary'; op: string; left: Expr; right: Expr}
	| {type: 'interpolatedString'; parts: (string | Expr)[]}
	| {type: 'invalid'};

type ExprToken =
	| {type: 'number'; value: number}
	| {type: 'string'; value: string; raw: boolean}
	| {type: 'identifier'; value: string}
	| {type: 'op'; value: string}
	| {type: 'eof'};

const OPERATORS = ['..<', '..!', '..*', '...', '??', '==', '!=', '<=', '>=', '&&', '||', '->', '..', '+', '-', '*', '/', '%', '!', '<', '>', '=', '(', ')', '[', ']', '{', '}', ',', ':', '.', '?', ';'];

function tokenizeExpression(src: string, warnings: string[]): ExprToken[] {
	const tokens: ExprToken[] = [];

	let i = 0;

	while (i < src.length) {
		const ch = src[i];

		if (/\s/.test(ch)) {
			i++;
			continue;
		}

		if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? '') && !/[a-zA-Z_)\]]/.test(src[i - 1] ?? ''))) {
			const match = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?|^[0-9]+/.exec(src.slice(i));

			if (match && !(match[0].includes('.') && src.slice(i + match[0].length - 1).startsWith('..'))) {
				tokens.push({type: 'number', value: Number(match[0])});
				i += match[0].length;
				continue;
			}

			const intMatch = /^[0-9]+/.exec(src.slice(i));

			if (intMatch) {
				tokens.push({type: 'number', value: Number(intMatch[0])});
				i += intMatch[0].length;
				continue;
			}
		}

		if (ch === '"' || ch === "'" || ((ch === 'r' || ch === 'R') && (src[i + 1] === '"' || src[i + 1] === "'"))) {
			const raw = ch === 'r' || ch === 'R';

			if (raw) {
				i++;
			}

			const quote = src[i];

			let value = '';

			i++;

			while (i < src.length && src[i] !== quote) {
				if (src[i] === '\\' && !raw) {
					const esc = src[i + 1];

					const map: Record<string, string> = {n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', l: '<', g: '>', a: '&', '{': '{', '}': '}', '\\': '\\', '"': '"', "'": "'", '$': '$', '#': '#'};

					if (esc === 'x') {
						const hex = /^[0-9a-fA-F]{1,4}/.exec(src.slice(i + 2));

						if (hex) {
							value += String.fromCharCode(parseInt(hex[0], 16));
							i += 2 + hex[0].length;
							continue;
						}
					}

					value += map[esc] ?? esc;
					i += 2;
					continue;
				}

				value += src[i];
				i++;
			}

			i++;

			tokens.push({type: 'string', value, raw});
			continue;
		}

		if (/[a-zA-Z_@]/.test(ch)) {
			const match = /^[a-zA-Z_@][\w@]*/.exec(src.slice(i));

			tokens.push({type: 'identifier', value: match![0]});
			i += match![0].length;
			continue;
		}

		if (ch === '\\') {
			const match = /^\\(lt|lte|gt|gte|l|g)\b/.exec(src.slice(i));

			if (match) {
				const map: Record<string, string> = {lt: '<', lte: '<=', gt: '>', gte: '>=', l: '<', g: '>'};

				tokens.push({type: 'op', value: map[match[1]]});
				i += match[0].length;
				continue;
			}
		}

		if (ch === '&' && src[i + 1] === 'l' && src.slice(i).startsWith('&lt;')) {
			tokens.push({type: 'op', value: '<'});
			i += 4;
			continue;
		}

		if (ch === '&' && src.slice(i).startsWith('&gt;')) {
			tokens.push({type: 'op', value: '>'});
			i += 4;
			continue;
		}

		const op = OPERATORS.find((candidate) => src.startsWith(candidate, i));

		if (op) {
			tokens.push({type: 'op', value: op});
			i += op.length;
			continue;
		}

		warnings.push(`Unexpected character "${ch}" in expression "${src}"`);
		i++;
	}

	tokens.push({type: 'eof'});

	return tokens;
}

const KEYWORD_OPERATORS: Record<string, string> = {gt: '>', gte: '>=', lt: '<', lte: '<='};

class ExpressionParser {
	private pos = 0;

	constructor(private tokens: ExprToken[], private warnings: string[], private src: string) {}

	parse(): Expr {
		const expr = this.parseOr();

		if (this.peek().type !== 'eof') {
			this.warnings.push(`Unexpected token after expression "${this.src}"`);
		}

		return expr;
	}

	private peek(): ExprToken {
		return this.tokens[this.pos];
	}

	private next(): ExprToken {
		return this.tokens[this.pos++];
	}

	private isOp(value: string): boolean {
		const token = this.peek();

		return token.type === 'op' && token.value === value;
	}

	private isKeyword(value: string): boolean {
		const token = this.peek();

		return token.type === 'identifier' && token.value === value;
	}

	private parseOr(): Expr {
		let left = this.parseAnd();

		while (this.isOp('||')) {
			this.next();
			left = {type: 'binary', op: '||', left, right: this.parseAnd()};
		}

		return left;
	}

	private parseAnd(): Expr {
		let left = this.parseEquality();

		while (this.isOp('&&')) {
			this.next();
			left = {type: 'binary', op: '&&', left, right: this.parseEquality()};
		}

		return left;
	}

	private parseEquality(): Expr {
		let left = this.parseComparison();

		while (this.isOp('==') || this.isOp('!=') || this.isOp('=')) {
			const op = (this.next() as {value: string}).value === '!=' ? '!=' : '==';

			left = {type: 'binary', op, left, right: this.parseComparison()};
		}

		return left;
	}

	private parseComparison(): Expr {
		let left = this.parseRange();

		while (true) {
			const token = this.peek();

			let op: string | null = null;

			if (token.type === 'op' && ['<', '>', '<=', '>='].includes(token.value)) {
				op = token.value;
			}
			else if (token.type === 'identifier' && KEYWORD_OPERATORS[token.value]) {
				op = KEYWORD_OPERATORS[token.value];
			}

			if (!op) {
				break;
			}

			this.next();
			left = {type: 'binary', op, left, right: this.parseRange()};
		}

		return left;
	}

	private parseAdditive(): Expr {
		let left = this.parseMultiplicative();

		while (this.isOp('+') || this.isOp('-')) {
			const op = (this.next() as {value: string}).value;

			left = {type: 'binary', op, left, right: this.parseMultiplicative()};
		}

		return left;
	}

	private parseMultiplicative(): Expr {
		let left = this.parseUnary();

		while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
			const op = (this.next() as {value: string}).value;

			left = {type: 'binary', op, left, right: this.parseUnary()};
		}

		return left;
	}

	private parseUnary(): Expr {
		if (this.isOp('!')) {
			this.next();

			return {type: 'unary', op: '!', operand: this.parseUnary()};
		}

		if (this.isOp('-')) {
			this.next();

			return {type: 'unary', op: '-', operand: this.parseUnary()};
		}

		if (this.isOp('+')) {
			this.next();

			return this.parseUnary();
		}

		return this.parsePostfix();
	}

	private parseRange(): Expr {
		const left = this.parseAdditive();

		if (this.isOp('..') || this.isOp('..<') || this.isOp('..!') || this.isOp('..*')) {
			const op = (this.next() as {value: string}).value;

			const token = this.peek();

			if (token.type === 'eof' || (token.type === 'op' && [']', ')', ','].includes(token.value))) {
				return {type: 'range', from: left, to: {type: 'literal', value: Number.MAX_SAFE_INTEGER}, inclusive: true, length: false};
			}

			const right = this.parseAdditive();

			return {type: 'range', from: left, to: right, inclusive: op === '..', length: op === '..*'};
		}

		return left;
	}

	private parsePostfix(): Expr {
		let expr = this.parsePrimary();

		while (true) {
			const token = this.peek();

			if (token.type !== 'op') {
				break;
			}

			if (token.value === '.') {
				this.next();

				const name = this.next();

				if (name.type === 'identifier') {
					expr = {type: 'dot', target: expr, name: name.value};
				}
				else if (name.type === 'op' && name.value === '*') {
					expr = {type: 'dot', target: expr, name: '*'};
				}
				else {
					this.warnings.push(`Expected a name after "." in "${this.src}"`);
				}

				continue;
			}

			if (token.value === '[') {
				this.next();

				const index = this.parseOr();

				if (this.isOp(']')) {
					this.next();
				}
				else {
					this.warnings.push(`Missing "]" in "${this.src}"`);
				}

				expr = {type: 'index', target: expr, index};
				continue;
			}

			if (token.value === '(') {
				this.next();

				const {args, named} = this.parseArguments(')');

				expr = {type: 'call', target: expr, args, named};
				continue;
			}

			if (token.value === '?') {
				this.next();

				const name = this.next();

				if (name.type !== 'identifier') {
					this.warnings.push(`Expected a built-in name after "?" in "${this.src}"`);
					continue;
				}

				let args: Expr[] | null = null;

				if (this.isOp('(')) {
					this.next();
					args = this.parseArguments(')').args;
				}

				expr = {type: 'builtin', target: expr, name: name.value, args};
				continue;
			}

			if (token.value === '??') {
				this.next();
				expr = {type: 'exists', target: expr};
				continue;
			}

			if (token.value === '!') {
				const nextToken = this.tokens[this.pos + 1];

				const startsOperand =
					nextToken &&
					(nextToken.type === 'number' ||
						nextToken.type === 'string' ||
						(nextToken.type === 'identifier' && !KEYWORD_OPERATORS[nextToken.value]) ||
						(nextToken.type === 'op' && ['(', '[', '{', '-', '.'].includes(nextToken.value)));

				this.next();

				if (startsOperand) {
					expr = {type: 'default', target: expr, fallback: this.parseDefaultOperand()};
				}
				else {
					expr = {type: 'default', target: expr, fallback: null};
				}

				continue;
			}

			break;
		}

		return expr;
	}

	private parseDefaultOperand(): Expr {
		return this.parseAdditive();
	}

	private parseArguments(close: string): {args: Expr[]; named: {name: string; expr: Expr}[]} {
		const args: Expr[] = [];
		const named: {name: string; expr: Expr}[] = [];

		while (!this.isOp(close) && this.peek().type !== 'eof') {
			const token = this.peek();
			const nextToken = this.tokens[this.pos + 1];

			if (token.type === 'identifier' && nextToken && nextToken.type === 'op' && nextToken.value === '=') {
				this.next();
				this.next();
				named.push({name: token.value, expr: this.parseOr()});
			}
			else {
				args.push(this.parseOr());
			}

			if (this.isOp(',')) {
				this.next();
			}
			else {
				break;
			}
		}

		if (this.isOp(close)) {
			this.next();
		}
		else {
			this.warnings.push(`Missing "${close}" in "${this.src}"`);
		}

		return {args, named};
	}

	private parsePrimary(): Expr {
		const token = this.next();

		switch (token.type) {
			case 'number':
				return {type: 'literal', value: token.value};
			case 'string':
				if (!token.raw && token.value.includes('${')) {
					return {type: 'interpolatedString', parts: parseInterpolatedString(token.value, this.warnings)};
				}

				return {type: 'literal', value: token.value};
			case 'identifier':
				if (token.value === 'true') {
					return {type: 'literal', value: true};
				}

				if (token.value === 'false') {
					return {type: 'literal', value: false};
				}

				if (token.value === 'as' || token.value === 'in' || token.value === 'using') {
					this.warnings.push(`Unexpected keyword "${token.value}" in "${this.src}"`);

					return {type: 'invalid'};
				}

				return {type: 'identifier', name: token.value};
			case 'op':
				if (token.value === '(') {
					const expr = this.parseOr();

					if (this.isOp(')')) {
						this.next();
					}
					else {
						this.warnings.push(`Missing ")" in "${this.src}"`);
					}

					return expr;
				}

				if (token.value === '[') {
					const items: Expr[] = [];

					while (!this.isOp(']') && this.peek().type !== 'eof') {
						items.push(this.parseOr());

						if (this.isOp(',')) {
							this.next();
						}
						else {
							break;
						}
					}

					if (this.isOp(']')) {
						this.next();
					}
					else {
						this.warnings.push(`Missing "]" in "${this.src}"`);
					}

					return {type: 'list', items};
				}

				if (token.value === '{') {
					const entries: {key: Expr; value: Expr}[] = [];

					while (!this.isOp('}') && this.peek().type !== 'eof') {
						const key = this.parseOr();

						if (this.isOp(':')) {
							this.next();
						}

						const value = this.parseOr();

						entries.push({key, value});

						if (this.isOp(',')) {
							this.next();
						}
						else {
							break;
						}
					}

					if (this.isOp('}')) {
						this.next();
					}
					else {
						this.warnings.push(`Missing "}" in "${this.src}"`);
					}

					return {type: 'hash', entries};
				}

				if (token.value === '.') {
					const name = this.next();

					if (name.type === 'identifier') {
						return {type: 'special', name: name.value};
					}
				}

				this.warnings.push(`Unexpected "${token.value}" in "${this.src}"`);

				return {type: 'invalid'};
			case 'eof':
				this.warnings.push(`Unexpected end of expression "${this.src}"`);

				return {type: 'invalid'};
		}
	}
}

function parseInterpolatedString(value: string, warnings: string[]): (string | Expr)[] {
	const parts: (string | Expr)[] = [];

	let text = '';
	let i = 0;

	while (i < value.length) {
		if (value[i] === '$' && value[i + 1] === '{') {
			const end = findInterpolationEnd(value, i + 2);

			if (end !== -1) {
				if (text) {
					parts.push(text);
					text = '';
				}

				parts.push(parseExpression(value.slice(i + 2, end), warnings));
				i = end + 1;
				continue;
			}
		}

		text += value[i];
		i++;
	}

	if (text) {
		parts.push(text);
	}

	return parts;
}

const expressionCache = new Map<string, Expr>();

export function parseExpression(src: string, warnings: string[]): Expr {
	const trimmed = src.trim();

	const cached = expressionCache.get(trimmed);

	if (cached) {
		return cached;
	}

	if (!trimmed) {
		warnings.push('Empty expression');

		return {type: 'invalid'};
	}

	const localWarnings: string[] = [];

	const expr = new ExpressionParser(tokenizeExpression(trimmed, localWarnings), localWarnings, trimmed).parse();

	if (localWarnings.length === 0) {
		expressionCache.set(trimmed, expr);
	}
	else {
		warnings.push(...localWarnings);
	}

	return expr;
}

/* ------------------------------------------------------------------------ */
/* Runtime                                                                   */
/* ------------------------------------------------------------------------ */

class BreakSignal {
	output = '';
}

class ReturnSignal {
	output = '';

	constructor(public value: FMValue) {}
}

class TemplateError extends Error {}

interface LoopState {
	index: number;
	hasNext: boolean;
}

interface Macro {
	__macro: true;
	node: Extract<Node, {type: 'macro'}>;
	scope: Scope;
}

class Scope {
	vars: FMScope = {};
	loops: Record<string, LoopState> = {};

	constructor(public parent: Scope | null) {}

	lookup(name: string): {found: boolean; value: FMValue} {
		let scope: Scope | null = this;

		while (scope) {
			if (Object.prototype.hasOwnProperty.call(scope.vars, name)) {
				return {found: true, value: scope.vars[name]};
			}

			scope = scope.parent;
		}

		return {found: false, value: undefined};
	}

	loop(name: string): LoopState | null {
		let scope: Scope | null = this;

		while (scope) {
			if (Object.prototype.hasOwnProperty.call(scope.loops, name)) {
				return scope.loops[name];
			}

			if (Object.prototype.hasOwnProperty.call(scope.vars, name)) {
				return null;
			}

			scope = scope.parent;
		}

		return null;
	}
}

export class Context {
	readonly warnings: string[] = [];

	readonly globals: Scope;

	constructor(model: FMScope) {
		this.globals = new Scope(null);
		this.globals.vars = {...model};
	}

	warn(message: string): void {
		if (!this.warnings.includes(message)) {
			this.warnings.push(message);
		}
	}
}

interface Frame {
	scope: Scope;
	macroScope: Scope | null;
	nestedBody: ((loopVars?: FMValue[]) => string) | null;
}

function isHash(value: FMValue): boolean {
	return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function isSequence(value: FMValue): boolean {
	return Array.isArray(value);
}

function isMissing(value: FMValue): boolean {
	return value === undefined || value === null;
}

function toText(value: FMValue, context: Context, source: string): string {
	if (isMissing(value)) {
		context.warn(`"${source}" is null or missing`);

		return '';
	}

	if (typeof value === 'string') {
		return value;
	}

	if (typeof value === 'number') {
		return formatNumber(value);
	}

	if (typeof value === 'boolean') {
		return value ? 'true' : 'false';
	}

	if (value instanceof Date) {
		return value.toLocaleString();
	}

	if (typeof value === 'function') {
		context.warn(`"${source}" is a method, not a value`);

		return '';
	}

	if (Array.isArray(value)) {
		context.warn(`"${source}" is a sequence, cannot be printed`);

		return value.map((v) => toText(v, context, source)).join(', ');
	}

	if (typeof value === 'object') {
		if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
			return String(value);
		}

		context.warn(`"${source}" is a hash, cannot be printed`);

		return '';
	}

	return String(value);
}

function formatNumber(value: number): string {
	if (Number.isInteger(value)) {
		return String(value);
	}

	return String(Math.round(value * 1000000) / 1000000);
}

function truthy(value: FMValue, context: Context, source: string): boolean {
	if (typeof value === 'boolean') {
		return value;
	}

	if (isMissing(value)) {
		context.warn(`"${source}" is null or missing, treated as false`);

		return false;
	}

	context.warn(`"${source}" is not a boolean, treated as ${Boolean(value) ? 'true' : 'false'}`);

	return Boolean(value);
}

function exprSource(expr: Expr): string {
	switch (expr.type) {
		case 'identifier':
			return expr.name;
		case 'special':
			return `.${expr.name}`;
		case 'dot':
			return `${exprSource(expr.target)}.${expr.name}`;
		case 'index':
			return `${exprSource(expr.target)}[${exprSource(expr.index)}]`;
		case 'literal':
			return typeof expr.value === 'string' ? `"${expr.value}"` : String(expr.value);
		case 'builtin':
			return `${exprSource(expr.target)}?${expr.name}`;
		case 'call':
			return `${exprSource(expr.target)}(...)`;
		case 'binary':
			return `${exprSource(expr.left)} ${expr.op} ${exprSource(expr.right)}`;
		case 'unary':
			return `${expr.op}${exprSource(expr.operand)}`;
		case 'default':
			return `${exprSource(expr.target)}!`;
		case 'exists':
			return `${exprSource(expr.target)}??`;
		default:
			return expr.type;
	}
}

const HTML_ESCAPES: Record<string, string> = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};

export function escapeHTML(value: string): string {
	return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

function toNumber(value: FMValue, context: Context, source: string): number {
	if (typeof value === 'number') {
		return value;
	}

	if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
		return Number(value);
	}

	if (typeof value === 'boolean') {
		return value ? 1 : 0;
	}

	context.warn(`"${source}" is not a number`);

	return 0;
}

function sameValue(left: FMValue, right: FMValue): boolean {
	if (typeof left === 'number' || typeof right === 'number') {
		const l = typeof left === 'string' && left.trim() !== '' && !Number.isNaN(Number(left)) ? Number(left) : left;
		const r = typeof right === 'string' && right.trim() !== '' && !Number.isNaN(Number(right)) ? Number(right) : right;

		return l === r;
	}

	return left === right;
}

export class Renderer {
	private frames: Frame[] = [];

	constructor(private context: Context) {}

	private get frame(): Frame {
		return this.frames[this.frames.length - 1];
	}

	render(nodes: Node[]): string {
		this.frames.push({scope: new Scope(this.context.globals), macroScope: null, nestedBody: null});

		try {
			return this.renderNodes(nodes);
		}
		finally {
			this.frames.pop();
		}
	}

	private renderNodes(nodes: Node[]): string {
		let out = '';

		try {
			for (const node of nodes) {
				out += this.renderNode(node);
			}
		}
		catch (error) {
			if (error instanceof BreakSignal || error instanceof ReturnSignal) {
				error.output = out + error.output;
			}

			throw error;
		}

		return out;
	}

	private withScope<T>(fn: (scope: Scope) => T): T {
		const frame = this.frame;
		const previous = frame.scope;

		frame.scope = new Scope(previous);

		try {
			return fn(frame.scope);
		}
		finally {
			frame.scope = previous;
		}
	}

	private renderNode(node: Node): string {
		const context = this.context;

		switch (node.type) {
			case 'text':
				return node.value;
			case 'interpolation': {
				const value = this.evaluate(node.expr);

				return toText(value, context, exprSource(node.expr));
			}
			case 'if': {
				for (const branch of node.branches) {
					if (branch.condition === null || truthy(this.evaluate(branch.condition), context, exprSource(branch.condition))) {
						return this.renderNodes(branch.body);
					}
				}

				return '';
			}
			case 'list':
				return this.renderList(node);
			case 'items':
				return this.renderItems(node);
			case 'sep': {
				const loop = this.frame.scope.loop('__current__');

				if (loop && loop.hasNext) {
					return this.renderNodes(node.body);
				}

				return '';
			}
			case 'assign': {
				if (node.captureName) {
					const value = this.renderNodes(node.body ?? []);

					this.assign(node.scope, node.captureName, value);

					return '';
				}

				for (const assignment of node.assignments) {
					const value = assignment.expr ? this.evaluate(assignment.expr) : undefined;

					if (assignment.op === '=') {
						this.assign(node.scope, assignment.name, value);
					}
					else {
						const current = this.frame.scope.lookup(assignment.name).value;

						const op = assignment.op[0];

						let result: FMValue;

						if (op === '+' && (typeof current === 'string' || typeof value === 'string')) {
							result = toText(current, context, assignment.name) + toText(value, context, assignment.name);
						}
						else {
							const l = toNumber(current, context, assignment.name);
							const r = toNumber(value, context, assignment.name);

							result = op === '+' ? l + r : op === '-' ? l - r : op === '*' ? l * r : op === '/' ? l / r : l % r;
						}

						this.assign(node.scope, assignment.name, result);
					}
				}

				return '';
			}
			case 'macro': {
				const macro: Macro = {__macro: true, node, scope: this.frame.scope};

				this.frame.scope.vars[node.name] = macro;
				this.context.globals.vars[node.name] = macro;

				return '';
			}
			case 'return':
				throw new ReturnSignal(node.expr ? this.evaluate(node.expr) : undefined);
			case 'nested': {
				const nestedBody = this.frame.nestedBody;

				if (!nestedBody) {
					return '';
				}

				return nestedBody(node.args.map((arg) => this.evaluate(arg)));
			}
			case 'switch': {
				const value = this.evaluate(node.expr);

				let matched = false;

				let out = '';

				try {
					for (const branch of node.cases) {
						if (!matched) {
							if (branch.expr === null) {
								matched = true;
							}
							else if (sameValue(value, this.evaluate(branch.expr))) {
								matched = true;
							}
						}

						if (matched) {
							out += this.renderNodes(branch.body);
						}
					}
				}
				catch (error) {
					if (!(error instanceof BreakSignal)) {
						throw error;
					}

					out += error.output;
				}

				return out;
			}
			case 'break':
				throw new BreakSignal();
			case 'attempt': {
				try {
					return this.renderNodes(node.body);
				}
				catch (error) {
					if (error instanceof BreakSignal || error instanceof ReturnSignal) {
						throw error;
					}

					return this.renderNodes(node.recover);
				}
			}
			case 'compress':
				return this.renderNodes(node.body);
			case 'user':
				return this.renderUser(node);
			case 'ignored':
				return '';
		}
	}

	private assign(kind: 'assign' | 'local' | 'global', name: string, value: FMValue): void {
		if (kind === 'global') {
			this.context.globals.vars[name] = value;

			return;
		}

		if (kind === 'local' && this.frame.macroScope) {
			this.frame.macroScope.vars[name] = value;

			return;
		}

		let scope: Scope | null = this.frame.scope;

		while (scope && scope.parent) {
			if (Object.prototype.hasOwnProperty.call(scope.vars, name)) {
				scope.vars[name] = value;

				return;
			}

			scope = scope.parent;
		}

		const target = this.frame.macroScope ?? this.frames[0].scope;

		target.vars[name] = value;
	}

	private iterate(value: FMValue, source: string): {keys: FMValue[] | null; items: FMValue[]} {
		if (Array.isArray(value)) {
			return {keys: null, items: value};
		}

		if (isHash(value)) {
			const keys = Object.keys(value);

			return {keys, items: keys.map((key) => value[key])};
		}

		if (isMissing(value)) {
			this.context.warn(`"${source}" is null or missing, cannot list it`);

			return {keys: null, items: []};
		}

		this.context.warn(`"${source}" is not a sequence or hash, cannot list it`);

		return {keys: null, items: []};
	}

	private renderList(node: Extract<Node, {type: 'list'}>): string {
		const {keys, items} = this.iterate(this.evaluate(node.seq), exprSource(node.seq));

		if (items.length === 0) {
			return this.renderNodes(node.elseBody);
		}

		if (!node.item) {
			return this.withScope((scope) => {
				scope.vars.__items__ = items;
				scope.vars.__keys__ = keys;

				return this.renderNodes(node.body);
			});
		}

		return this.loop(items, keys, node.key, node.item, node.body);
	}

	private renderItems(node: Extract<Node, {type: 'items'}>): string {
		const items = this.frame.scope.lookup('__items__').value ?? [];
		const keys = this.frame.scope.lookup('__keys__').value ?? null;

		return this.loop(items, keys, node.key, node.item ?? 'item', node.body);
	}

	private loop(items: FMValue[], keys: FMValue[] | null, keyName: string | undefined, itemName: string, body: Node[]): string {
		let out = '';

		try {
			for (let i = 0; i < items.length; i++) {
				out += this.withScope((scope) => {
					const state: LoopState = {index: i, hasNext: i < items.length - 1};

					scope.vars[itemName] = items[i];
					scope.loops[itemName] = state;
					scope.loops.__current__ = state;
					scope.vars[`${itemName}_index`] = i;
					scope.vars[`${itemName}_has_next`] = state.hasNext;

					if (keyName && keys) {
						scope.vars[keyName] = keys[i];
						scope.loops[keyName] = state;
					}

					return this.renderNodes(body);
				});
			}
		}
		catch (error) {
			if (!(error instanceof BreakSignal)) {
				throw error;
			}

			out += error.output;
		}

		return out;
	}

	private renderUser(node: Extract<Node, {type: 'user'}>): string {
		const target = this.evaluate(node.expr);
		const source = exprSource(node.expr);

		const params: Record<string, FMValue> = {};

		for (const param of node.params) {
			params[param.name] = this.evaluate(param.expr);
		}

		const positional = node.positional.map((arg) => this.evaluate(arg));

		const renderBody = (loopVars: FMValue[] = []) =>
			this.withScope((scope) => {
				node.loopVars.forEach((name, index) => {
					scope.vars[name] = loopVars[index];
				});

				return this.renderNodes(node.body);
			});

		if (target && (target as Macro).__macro) {
			return this.callMacro(target as Macro, positional, params, renderBody);
		}

		if (typeof target === 'function' && (target as DirectiveFunction).__directive) {
			try {
				return (target as DirectiveFunction)(params, renderBody, this.context);
			}
			catch (error) {
				this.context.warn(`Directive @${source} failed: ${(error as Error).message}`);

				return '';
			}
		}

		if (typeof target === 'function') {
			try {
				const result = target(...positional, params);

				return isMissing(result) ? '' : toText(result, this.context, source);
			}
			catch (error) {
				this.context.warn(`Directive @${source} failed: ${(error as Error).message}`);

				return '';
			}
		}

		this.context.warn(`Unknown user directive @${source}; its body was rendered as-is`);

		return renderBody();
	}

	private callMacro(macro: Macro, positional: FMValue[], named: Record<string, FMValue>, renderBody: (loopVars?: FMValue[]) => string): string {
		const macroScope = new Scope(macro.scope);

		macro.node.params.forEach((param, index) => {
			if (param.catchAll) {
				macroScope.vars[param.name] = positional.length > index ? positional.slice(index) : named;

				return;
			}

			if (Object.prototype.hasOwnProperty.call(named, param.name)) {
				macroScope.vars[param.name] = named[param.name];
			}
			else if (index < positional.length) {
				macroScope.vars[param.name] = positional[index];
			}
			else if (param.defaultValue) {
				const previousFrame = this.frames.push({scope: macroScope, macroScope, nestedBody: renderBody});

				try {
					macroScope.vars[param.name] = this.evaluate(param.defaultValue);
				}
				finally {
					this.frames.length = previousFrame - 1;
				}
			}
			else {
				this.context.warn(`Macro ${macro.node.name} is missing parameter "${param.name}"`);
			}
		});

		this.frames.push({scope: macroScope, macroScope, nestedBody: renderBody});

		try {
			return this.renderNodes(macro.node.body);
		}
		catch (error) {
			if (error instanceof ReturnSignal) {
				return error.output;
			}

			throw error;
		}
		finally {
			this.frames.pop();
		}
	}

	callFunction(macro: Macro, positional: FMValue[], named: Record<string, FMValue>): FMValue {
		const macroScope = new Scope(macro.scope);

		macro.node.params.forEach((param, index) => {
			if (Object.prototype.hasOwnProperty.call(named, param.name)) {
				macroScope.vars[param.name] = named[param.name];
			}
			else if (index < positional.length) {
				macroScope.vars[param.name] = positional[index];
			}
			else if (param.defaultValue) {
				this.frames.push({scope: macroScope, macroScope, nestedBody: null});

				try {
					macroScope.vars[param.name] = this.evaluate(param.defaultValue);
				}
				finally {
					this.frames.pop();
				}
			}
		});

		this.frames.push({scope: macroScope, macroScope, nestedBody: null});

		try {
			this.renderNodes(macro.node.body);

			return undefined;
		}
		catch (error) {
			if (error instanceof ReturnSignal) {
				return error.value;
			}

			throw error;
		}
		finally {
			this.frames.pop();
		}
	}

	/* -------------------------------------------------------------------- */
	/* Expressions                                                           */
	/* -------------------------------------------------------------------- */

	evaluate(expr: Expr): FMValue {
		const context = this.context;

		switch (expr.type) {
			case 'literal':
				return expr.value;
			case 'invalid':
				return undefined;
			case 'identifier': {
				const result = this.frame.scope.lookup(expr.name);

				if (!result.found && this.frame.macroScope) {
					const macroResult = this.frame.macroScope.lookup(expr.name);

					if (macroResult.found) {
						return macroResult.value;
					}
				}

				return result.value;
			}
			case 'special':
				return this.special(expr.name);
			case 'list':
				return expr.items.map((item) => this.evaluate(item));
			case 'range': {
				const from = toNumber(this.evaluate(expr.from), context, exprSource(expr.from));
				const to = toNumber(this.evaluate(expr.to), context, exprSource(expr.to));

				return makeRange(from, to, expr.inclusive, expr.length);
			}
			case 'hash': {
				const hash: Record<string, FMValue> = {};

				for (const entry of expr.entries) {
					hash[toText(this.evaluate(entry.key), context, exprSource(entry.key))] = this.evaluate(entry.value);
				}

				return hash;
			}
			case 'dot': {
				const target = this.evaluate(expr.target);

				return this.member(target, expr.name, exprSource(expr.target));
			}
			case 'index': {
				const target = this.evaluate(expr.target);
				const index = this.evaluate(expr.index);

				if (isMissing(target)) {
					return undefined;
				}

				if (Array.isArray(target) || typeof target === 'string') {
					if (typeof index === 'number') {
						return target[index];
					}

					if (Array.isArray(index)) {
						return (target as any).slice(index[0], index[index.length - 1] + 1);
					}
				}

				return this.member(target, toText(index, context, exprSource(expr.index)), exprSource(expr.target));
			}
			case 'call': {
				const target = this.evaluate(expr.target);
				const args = expr.args.map((arg) => this.evaluate(arg));

				const named: Record<string, FMValue> = {};

				for (const param of expr.named) {
					named[param.name] = this.evaluate(param.expr);
				}

				if (target && (target as Macro).__macro) {
					return this.callFunction(target as Macro, args, named);
				}

				if (typeof target === 'function') {
					try {
						let thisArg: FMValue = undefined;

						if (expr.target.type === 'dot') {
							thisArg = this.evaluate(expr.target.target);
						}

						return target.apply(thisArg, args);
					}
					catch (error) {
						context.warn(`${exprSource(expr.target)}() failed: ${(error as Error).message}`);

						return undefined;
					}
				}

				if (!isMissing(target)) {
					context.warn(`"${exprSource(expr.target)}" is not a method`);
				}
				else {
					context.warn(`"${exprSource(expr.target)}" is null or missing, cannot call it`);
				}

				return undefined;
			}
			case 'builtin':
				return this.builtin(expr);
			case 'exists':
				return !isMissing(this.evaluate(expr.target));
			case 'default': {
				const value = this.evaluate(expr.target);

				if (!isMissing(value)) {
					return value;
				}

				return expr.fallback ? this.evaluate(expr.fallback) : '';
			}
			case 'unary': {
				const value = this.evaluate(expr.operand);

				if (expr.op === '!') {
					return !truthy(value, context, exprSource(expr.operand));
				}

				return -toNumber(value, context, exprSource(expr.operand));
			}
			case 'binary':
				return this.binary(expr);
			case 'interpolatedString':
				return expr.parts.map((part) => (typeof part === 'string' ? part : toText(this.evaluate(part), context, exprSource(part)))).join('');
		}
	}

	private special(name: string): FMValue {
		switch (name) {
			case 'now':
				return new Date();
			case 'locale':
				return this.context.globals.vars.locale ?? 'en_US';
			case 'lang':
				return String(this.context.globals.vars.locale ?? 'en').split('_')[0];
			case 'vars':
			case 'globals':
			case 'main':
			case 'data_model':
				return new Proxy(
					{},
					{
						get: (_, key) => (typeof key === 'string' ? this.frame.scope.lookup(key).value : undefined),
						has: (_, key) => typeof key === 'string' && this.frame.scope.lookup(key).found,
					}
				);
			case 'output_format':
				return 'HTML';
			default:
				this.context.warn(`Special variable .${name} is not supported`);

				return undefined;
		}
	}

	private member(target: FMValue, name: string, source: string): FMValue {
		if (isMissing(target)) {
			return undefined;
		}

		if (typeof target === 'object' || typeof target === 'function') {
			if (name in target) {
				const value = target[name];

				if (typeof value === 'function' && !(value as DirectiveFunction).__directive && !(value as Macro).__macro) {
					return value.bind(target);
				}

				return value;
			}

			const getter = `get${name.charAt(0).toUpperCase()}${name.slice(1)}`;

			if (typeof target[getter] === 'function') {
				return target[getter]();
			}

			const booleanGetter = `is${name.charAt(0).toUpperCase()}${name.slice(1)}`;

			if (typeof target[booleanGetter] === 'function') {
				return target[booleanGetter]();
			}

			return undefined;
		}

		if (typeof target === 'string' && name === 'length') {
			return target.length;
		}

		this.context.warn(`"${source}" is not a hash, cannot read "${name}"`);

		return undefined;
	}

	private binary(expr: Extract<Expr, {type: 'binary'}>): FMValue {
		const context = this.context;
		const {op} = expr;

		if (op === '&&') {
			return truthy(this.evaluate(expr.left), context, exprSource(expr.left)) && truthy(this.evaluate(expr.right), context, exprSource(expr.right));
		}

		if (op === '||') {
			return truthy(this.evaluate(expr.left), context, exprSource(expr.left)) || truthy(this.evaluate(expr.right), context, exprSource(expr.right));
		}

		const left = this.evaluate(expr.left);
		const right = this.evaluate(expr.right);

		switch (op) {
			case '==':
				return sameValue(left, right);
			case '!=':
				return !sameValue(left, right);
			case '+':
				if (typeof left === 'string' || typeof right === 'string') {
					return toText(left, context, exprSource(expr.left)) + toText(right, context, exprSource(expr.right));
				}

				if (Array.isArray(left) && Array.isArray(right)) {
					return [...left, ...right];
				}

				if (isHash(left) && isHash(right)) {
					return {...left, ...right};
				}

				return toNumber(left, context, exprSource(expr.left)) + toNumber(right, context, exprSource(expr.right));
			case '-':
				return toNumber(left, context, exprSource(expr.left)) - toNumber(right, context, exprSource(expr.right));
			case '*':
				return toNumber(left, context, exprSource(expr.left)) * toNumber(right, context, exprSource(expr.right));
			case '/':
				return toNumber(left, context, exprSource(expr.left)) / toNumber(right, context, exprSource(expr.right));
			case '%':
				return toNumber(left, context, exprSource(expr.left)) % toNumber(right, context, exprSource(expr.right));
			case '<':
				return this.compare(left, right, expr) < 0;
			case '>':
				return this.compare(left, right, expr) > 0;
			case '<=':
				return this.compare(left, right, expr) <= 0;
			case '>=':
				return this.compare(left, right, expr) >= 0;
		}

		return undefined;
	}

	private compare(left: FMValue, right: FMValue, expr: Extract<Expr, {type: 'binary'}>): number {
		if (typeof left === 'string' && typeof right === 'string') {
			return left < right ? -1 : left > right ? 1 : 0;
		}

		if (left instanceof Date && right instanceof Date) {
			return left.getTime() - right.getTime();
		}

		return toNumber(left, this.context, exprSource(expr.left)) - toNumber(right, this.context, exprSource(expr.right));
	}

	private builtin(expr: Extract<Expr, {type: 'builtin'}>): FMValue {
		const context = this.context;
		const {name} = expr;
		const source = exprSource(expr.target);

		if (expr.target.type === 'identifier') {
			const loop = this.frame.scope.loop(expr.target.name);

			if (loop) {
				switch (name) {
					case 'index':
						return loop.index;
					case 'counter':
						return loop.index + 1;
					case 'has_next':
						return loop.hasNext;
					case 'is_first':
						return loop.index === 0;
					case 'is_last':
						return !loop.hasNext;
					case 'is_odd_item':
						return loop.index % 2 === 0;
					case 'is_even_item':
						return loop.index % 2 === 1;
					case 'item_parity':
						return loop.index % 2 === 0 ? 'odd' : 'even';
					case 'item_cycle': {
						const values = (expr.args ?? []).map((arg) => this.evaluate(arg));

						return values[loop.index % values.length];
					}
				}
			}
		}

		if (name === 'exists' || name === 'if_exists') {
			return !isMissing(this.evaluate(expr.target));
		}

		if (name === 'default') {
			const value = this.evaluate(expr.target);

			if (!isMissing(value)) {
				return value;
			}

			for (const arg of expr.args ?? []) {
				const fallback = this.evaluate(arg);

				if (!isMissing(fallback)) {
					return fallback;
				}
			}

			return undefined;
		}

		if (name === 'has_content') {
			const value = this.evaluate(expr.target);

			if (isMissing(value)) {
				return false;
			}

			if (typeof value === 'string') {
				return value.length > 0;
			}

			if (Array.isArray(value)) {
				return value.length > 0;
			}

			if (isHash(value)) {
				return Object.keys(value).length > 0;
			}

			return true;
		}

		const value = this.evaluate(expr.target);
		const args = (expr.args ?? []).map((arg) => this.evaluate(arg));

		const str = () => toText(value, context, source);
		const num = () => toNumber(value, context, source);
		const seq = (): FMValue[] => (Array.isArray(value) ? value : isHash(value) ? Object.values(value) : []);

		switch (name) {
			case 'string':
				if (typeof value === 'boolean') {
					if (args.length === 2) {
						return value ? args[0] : args[1];
					}

					if (args.length === 1 && typeof args[0] === 'string' && args[0].includes(',')) {
						const [yes, no] = args[0].split(',');

						return value ? yes : no;
					}

					return value ? 'true' : 'false';
				}

				if (typeof value === 'number' && args.length === 1 && typeof args[0] === 'string') {
					return formatNumberPattern(value, args[0]);
				}

				return str();
			case 'c':
				if (typeof value === 'number') {
					return String(value);
				}

				return str();
			case 'number':
				return typeof value === 'number' ? value : Number(str());
			case 'boolean':
				return typeof value === 'boolean' ? value : str() === 'true';
			case 'int':
				return Math.trunc(num());
			case 'round':
				return Math.round(num());
			case 'floor':
				return Math.floor(num());
			case 'ceiling':
				return Math.ceil(num());
			case 'abs':
				return Math.abs(num());
			case 'is_infinite':
				return !Number.isFinite(num());
			case 'is_nan':
				return Number.isNaN(num());
			case 'size':
				return Array.isArray(value) ? value.length : isHash(value) ? Object.keys(value).length : typeof value === 'string' ? value.length : 0;
			case 'length':
				return str().length;
			case 'upper_case':
				return str().toUpperCase();
			case 'lower_case':
				return str().toLowerCase();
			case 'cap_first': {
				const s = str();

				return s.charAt(0).toUpperCase() + s.slice(1);
			}
			case 'uncap_first': {
				const s = str();

				return s.charAt(0).toLowerCase() + s.slice(1);
			}
			case 'capitalize':
				return str().replace(/\b\w/g, (ch) => ch.toUpperCase());
			case 'trim':
				return str().trim();
			case 'html':
			case 'xhtml':
			case 'xml':
			case 'esc':
				return escapeHTML(str());
			case 'no_esc':
				return value;
			case 'js_string':
			case 'json_string':
				return JSON.stringify(str()).slice(1, -1);
			case 'url':
			case 'url_path':
				return encodeURIComponent(str());
			case 'replace': {
				const [needle, replacement, flags = ''] = args;

				if (String(flags).includes('r')) {
					return str().replace(new RegExp(String(needle), String(flags).includes('f') ? (String(flags).includes('i') ? 'i' : '') : String(flags).includes('i') ? 'gi' : 'g'), String(replacement));
				}

				if (String(flags).includes('f')) {
					return str().replace(String(needle), String(replacement));
				}

				return str().split(String(needle)).join(String(replacement));
			}
			case 'contains':
				return str().includes(String(args[0]));
			case 'index_of':
				return str().indexOf(String(args[0]), args[1]);
			case 'last_index_of':
				return str().lastIndexOf(String(args[0]));
			case 'starts_with':
				return str().startsWith(String(args[0]));
			case 'ends_with':
				return str().endsWith(String(args[0]));
			case 'split':
				return String(args[1] ?? '').includes('r') ? str().split(new RegExp(String(args[0]))) : str().split(String(args[0]));
			case 'join':
				return seq().map((item) => toText(item, context, source)).join(String(args[0] ?? ''));
			case 'keep_before': {
				const s = str();
				const index = s.indexOf(String(args[0]));

				return index === -1 ? s : s.slice(0, index);
			}
			case 'keep_after': {
				const s = str();
				const index = s.indexOf(String(args[0]));

				return index === -1 ? '' : s.slice(index + String(args[0]).length);
			}
			case 'keep_before_last': {
				const s = str();
				const index = s.lastIndexOf(String(args[0]));

				return index === -1 ? s : s.slice(0, index);
			}
			case 'keep_after_last': {
				const s = str();
				const index = s.lastIndexOf(String(args[0]));

				return index === -1 ? '' : s.slice(index + String(args[0]).length);
			}
			case 'remove_beginning': {
				const s = str();

				return s.startsWith(String(args[0])) ? s.slice(String(args[0]).length) : s;
			}
			case 'remove_ending': {
				const s = str();

				return s.endsWith(String(args[0])) ? s.slice(0, -String(args[0]).length) : s;
			}
			case 'ensure_starts_with': {
				const s = str();

				return s.startsWith(String(args[0])) ? s : String(args[1] ?? args[0]) + s;
			}
			case 'ensure_ends_with': {
				const s = str();

				return s.endsWith(String(args[0])) ? s : s + String(args[0]);
			}
			case 'left_pad':
				return str().padStart(Number(args[0]), String(args[1] ?? ' '));
			case 'right_pad':
				return str().padEnd(Number(args[0]), String(args[1] ?? ' '));
			case 'substring':
				return str().substring(Number(args[0]), args[1] === undefined ? undefined : Number(args[1]));
			case 'truncate':
			case 'truncate_c':
			case 'truncate_w': {
				const s = str();
				const length = Number(args[0]);

				return s.length <= length ? s : `${s.slice(0, Math.max(0, length - 3))}...`;
			}
			case 'matches': {
				const regex = new RegExp(String(args[0]), String(args[1] ?? '').includes('i') ? 'gi' : 'g');
				const s = str();
				const result: any = [...s.matchAll(regex)].map((match) => Object.assign([...match], {groups: [...match]}));

				result.toString = () => (regex.test(s) ? 'true' : 'false');
				result.valueOf = () => new RegExp(String(args[0])).test(s);

				return result;
			}
			case 'groups':
				return Array.isArray(value) ? value : [];
			case 'word_list':
				return str().split(/\s+/).filter(Boolean);
			case 'then':
				return truthy(value, context, source) ? args[0] : args[1];
			case 'switch': {
				for (let i = 0; i + 1 < args.length; i += 2) {
					if (sameValue(value, args[i])) {
						return args[i + 1];
					}
				}

				return args.length % 2 === 1 ? args[args.length - 1] : undefined;
			}
			case 'is_string':
				return typeof value === 'string';
			case 'is_number':
				return typeof value === 'number';
			case 'is_boolean':
				return typeof value === 'boolean';
			case 'is_hash':
			case 'is_hash_ex':
				return isHash(value);
			case 'is_sequence':
			case 'is_collection':
			case 'is_collection_ex':
			case 'is_enumerable':
			case 'is_indexable':
				return isSequence(value);
			case 'is_date':
			case 'is_date_like':
				return value instanceof Date;
			case 'is_method':
				return typeof value === 'function';
			case 'is_macro':
				return Boolean(value && (value as Macro).__macro);
			case 'keys':
				return isHash(value) ? Object.keys(value) : [];
			case 'values':
				return isHash(value) ? Object.values(value) : [];
			case 'first':
				return seq()[0];
			case 'last': {
				const items = seq();

				return items[items.length - 1];
			}
			case 'seq_contains':
				return seq().some((item) => sameValue(item, args[0]));
			case 'seq_index_of':
				return seq().findIndex((item) => sameValue(item, args[0]));
			case 'seq_last_index_of': {
				const items = seq();

				for (let i = items.length - 1; i >= 0; i--) {
					if (sameValue(items[i], args[0])) {
						return i;
					}
				}

				return -1;
			}
			case 'sort':
				return [...seq()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
			case 'sort_by': {
				const key = Array.isArray(args[0]) ? args[0] : [args[0]];

				const read = (item: FMValue) => key.reduce((acc: FMValue, k: string) => (isMissing(acc) ? acc : acc[k]), item);

				return [...seq()].sort((a, b) => (read(a) < read(b) ? -1 : read(a) > read(b) ? 1 : 0));
			}
			case 'reverse':
				return [...seq()].reverse();
			case 'chunk': {
				const size = Number(args[0]);
				const items = seq();
				const chunks: FMValue[][] = [];

				for (let i = 0; i < items.length; i += size) {
					const chunk = items.slice(i, i + size);

					if (args[1] !== undefined) {
						while (chunk.length < size) {
							chunk.push(args[1]);
						}
					}

					chunks.push(chunk);
				}

				return chunks;
			}
			case 'min':
				return Math.min(...seq().map((item) => Number(item)));
			case 'max':
				return Math.max(...seq().map((item) => Number(item)));
			case 'map':
			case 'filter':
			case 'take_while':
			case 'drop_while': {
				const fn = args[0];

				if (typeof fn !== 'function') {
					context.warn(`?${name} needs a lambda or function, which is not supported`);

					return seq();
				}

				if (name === 'map') {
					return seq().map((item) => fn(item));
				}

				return seq().filter((item) => Boolean(fn(item)));
			}
			case 'date':
			case 'time':
			case 'datetime':
			case 'iso':
			case 'iso_utc':
			case 'iso_local':
				if (value instanceof Date) {
					return name === 'date' ? value.toLocaleDateString() : name === 'time' ? value.toLocaleTimeString() : value.toISOString();
				}

				return value;
			case 'long':
				return value instanceof Date ? value.getTime() : Math.trunc(num());
			case 'eval':
			case 'interpret':
				context.warn(`?${name} is not supported`);

				return value;
			case 'namespace':
				return {};
			case 'api':
				return value;
			case 'has_api':
				return false;
			case 'markup_string':
				return value;
			case 'with_args':
			case 'with_args_last':
				return value;
			default:
				context.warn(`Unknown built-in ?${name}`);

				return value;
		}
	}
}

function formatNumberPattern(value: number, pattern: string): string {
	if (pattern === 'computer' || pattern === 'c') {
		return String(value);
	}

	if (pattern === 'number') {
		return value.toLocaleString();
	}

	if (pattern === 'percent') {
		return `${Math.round(value * 100)}%`;
	}

	if (pattern === 'currency') {
		return value.toFixed(2);
	}

	const match = /^0+(?:\.(0+))?$/.exec(pattern);

	if (match) {
		const decimals = match[1] ? match[1].length : 0;

		return value.toFixed(decimals).padStart(pattern.replace(/\..*/, '').length, '0');
	}

	const decimalMatch = /\.(0+)/.exec(pattern);

	if (decimalMatch) {
		return value.toFixed(decimalMatch[1].length);
	}

	return formatNumber(value);
}

function makeRange(from: number, to: number, inclusive: boolean, length: boolean): number[] {
	const result: number[] = [];

	if (length) {
		for (let i = 0; i < to; i++) {
			result.push(from + i);
		}

		return result;
	}

	if (to === Number.MAX_SAFE_INTEGER) {
		return result;
	}

	if (from <= to) {
		for (let i = from; inclusive ? i <= to : i < to; i++) {
			result.push(i);
		}
	}
	else {
		for (let i = from; inclusive ? i >= to : i > to; i--) {
			result.push(i);
		}
	}

	return result;
}

/* ------------------------------------------------------------------------ */
/* Public API                                                                */
/* ------------------------------------------------------------------------ */

const templateCache = new Map<string, {nodes: Node[]; warnings: string[]}>();

export function compile(template: string): {nodes: Node[]; warnings: string[]} {
	const cached = templateCache.get(template);

	if (cached) {
		return cached;
	}

	const warnings: string[] = [];
	const nodes = new TemplateParser(tokenize(template), warnings).parse();

	const compiled = {nodes, warnings};

	if (templateCache.size > 500) {
		templateCache.clear();
	}

	templateCache.set(template, compiled);

	return compiled;
}

export function render(template: string, model: FMScope): RenderResult {
	const compiled = compile(template);
	const context = new Context(model);

	let output = '';

	try {
		output = new Renderer(context).render(compiled.nodes);
	}
	catch (error) {
		if (error instanceof TemplateError) {
			context.warn(error.message);
		}
		else if (error instanceof BreakSignal) {
			output = error.output;
			context.warn('[#break] outside of a loop or switch');
		}
		else if (error instanceof ReturnSignal) {
			output = error.output;
		}
		else {
			context.warn(`Template error: ${(error as Error).message}`);
		}
	}

	return {output, warnings: [...compiled.warnings, ...context.warnings]};
}
