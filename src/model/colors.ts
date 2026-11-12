/**
 * Colours as text: reading the ones a stylesheet or a design tokens file
 * declares, and telling how well two of them contrast. Plain functions, so
 * the import dialog can show a site's palette without asking a model for it.
 */

export interface RGB {
	a: number;
	b: number;
	g: number;
	r: number;
}

const NAMED: Record<string, string> = {
	black: '#000000',
	blue: '#0000ff',
	gray: '#808080',
	green: '#008000',
	grey: '#808080',
	navy: '#000080',
	orange: '#ffa500',
	purple: '#800080',
	red: '#ff0000',
	silver: '#c0c0c0',
	teal: '#008080',
	white: '#ffffff',
	yellow: '#ffff00',
};

function channel(text: string, scale: number): number {
	const number = parseFloat(text);

	return Math.min(255, Math.max(0, Math.round(text.trim().endsWith('%') ? (number / 100) * 255 : number * scale)));
}

function alpha(text: string | undefined): number {
	if (text === undefined) {
		return 1;
	}

	const number = parseFloat(text);

	return Math.min(1, Math.max(0, text.trim().endsWith('%') ? number / 100 : number));
}

function hslToRGB(h: number, s: number, l: number): [number, number, number] {
	const k = (n: number) => (n + h / 30) % 12;
	const amount = s * Math.min(l, 1 - l);
	const f = (n: number) => l - amount * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

	return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** A CSS colour as channels, or `null` for anything that is not one (a gradient, a variable, a keyword). */
export function parseColor(value: string): RGB | null {
	const text = value.trim().toLowerCase();
	const hex = (NAMED[text] ?? text).match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);

	if (hex) {
		let digits = hex[1];

		if (digits.length <= 4) {
			digits = digits
				.split('')
				.map((digit) => digit + digit)
				.join('');
		}

		return {a: digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1, b: parseInt(digits.slice(4, 6), 16), g: parseInt(digits.slice(2, 4), 16), r: parseInt(digits.slice(0, 2), 16)};
	}

	const rgb = text.match(/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);

	if (rgb) {
		return {a: alpha(rgb[4]), b: channel(rgb[3], 1), g: channel(rgb[2], 1), r: channel(rgb[1], 1)};
	}

	const hsl = text.match(/^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);

	if (hsl) {
		const [r, g, b] = hslToRGB(((parseFloat(hsl[1]) % 360) + 360) % 360, parseFloat(hsl[2]) / 100, parseFloat(hsl[3]) / 100);

		return {a: alpha(hsl[4]), b, g, r};
	}

	return null;
}

/** `#rrggbb`, or `#rrggbbaa` for a colour that is not opaque. */
export function toHex(color: RGB): string {
	const pair = (number: number) => Math.round(number).toString(16).padStart(2, '0');

	return `#${pair(color.r)}${pair(color.g)}${pair(color.b)}${color.a < 1 ? pair(color.a * 255) : ''}`;
}

/** A colour in the one spelling the showroom compares by, or `null` when the text is not a colour. */
export function normalizeColor(value: string): string | null {
	const color = parseColor(value);

	return color ? toHex(color) : null;
}

function luminance(color: RGB): number {
	const linear = (value: number) => {
		const scaled = value / 255;

		return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
	};

	return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

/** The WCAG contrast ratio of two colours, from 1 to 21, or `null` when either is not a colour. Transparency is ignored. */
export function contrastRatio(first: string, second: string): number | null {
	const a = parseColor(first);
	const b = parseColor(second);

	if (!a || !b) {
		return null;
	}

	const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);

	return (lighter + 0.05) / (darker + 0.05);
}

/** A colour found in a source, with what the source calls it and how much it uses it. */
export interface ExtractedColor {
	hex: string;

	/** The custom property or the token path it is declared as, when it has one. */
	name: string | null;
	uses: number;
}

const LITERAL = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|(?:rgb|hsl)a?\([^()]*\)/gi;

/** How many unnamed colours to keep: past the ones a stylesheet uses most, the rest is noise. */
const UNNAMED_LIMIT = 16;

/**
 * The colours of a stylesheet: the ones it declares as custom properties,
 * in order, then the literals it uses most. A property that points at
 * another (`var(--brand)`) takes that one's colour.
 */
export function extractColorsFromCSS(css: string): ExtractedColor[] {
	const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
	const declared = new Map<string, string>();

	for (const match of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) {
		if (!declared.has(match[1])) {
			declared.set(match[1], match[2].trim());
		}
	}

	const resolve = (value: string, depth = 0): string | null => {
		const reference = value.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);

		if (!reference) {
			return normalizeColor(value);
		}

		const target = declared.get(reference[1]);

		return depth < 8 && target ? resolve(target, depth + 1) : reference[2] ? resolve(reference[2].trim(), depth + 1) : null;
	};

	const uses = new Map<string, number>();

	for (const literal of text.match(LITERAL) ?? []) {
		const hex = normalizeColor(literal);

		if (hex) {
			uses.set(hex, (uses.get(hex) ?? 0) + 1);
		}
	}

	const colors: ExtractedColor[] = [];
	const named = new Set<string>();

	for (const [name, value] of declared) {
		const hex = resolve(value);

		if (hex) {
			colors.push({hex, name, uses: uses.get(hex) ?? 0});
			named.add(hex);
		}
	}

	const unnamed = [...uses.entries()]
		.filter(([hex]) => !named.has(hex))
		.sort((a, b) => b[1] - a[1])
		.slice(0, UNNAMED_LIMIT)
		.map(([hex, count]) => ({hex, name: null, uses: count}));

	return [...colors, ...unnamed];
}

function figmaColor(value: any): string | null {
	if (value && typeof value === 'object' && ['r', 'g', 'b'].every((key) => typeof value[key] === 'number' && value[key] >= 0 && value[key] <= 1)) {
		return toHex({a: typeof value.a === 'number' ? value.a : 1, b: value.b * 255, g: value.g * 255, r: value.r * 255});
	}

	return null;
}

/**
 * The colours of a design tokens file: the W3C format (`$value`), Style
 * Dictionary (`value`) and the exports of Figma variables, whose colours
 * are channels from 0 to 1. A token that refers to another (`{brand.500}`)
 * takes that one's colour.
 */
export function extractColorsFromTokens(json: unknown): ExtractedColor[] {
	const found = new Map<string, unknown>();

	const walk = (node: unknown, path: string[]) => {
		if (!node || typeof node !== 'object') {
			return;
		}

		if (Array.isArray(node)) {
			node.forEach((item, index) => walk(item, typeof (item as any)?.name === 'string' ? [...path, (item as any).name] : [...path, String(index)]));

			return;
		}

		const record = node as Record<string, unknown>;
		const value = record.$value ?? record.value ?? record.resolvedValue;

		if (value !== undefined && (typeof value === 'string' || figmaColor(value))) {
			found.set(path.join('.'), value);

			return;
		}

		for (const [key, child] of Object.entries(record)) {
			if (!key.startsWith('$') && key !== 'name') {
				walk(child, [...path, key]);
			}
		}
	};

	walk(json, []);

	const resolve = (value: unknown, depth = 0): string | null => {
		if (typeof value !== 'string') {
			return figmaColor(value);
		}

		const reference = value.match(/^\{([^}]+)\}$/);

		return reference ? (depth < 8 && found.has(reference[1]) ? resolve(found.get(reference[1]), depth + 1) : null) : normalizeColor(value);
	};

	const colors: ExtractedColor[] = [];

	for (const [path, value] of found) {
		const hex = resolve(value);

		if (hex) {
			colors.push({hex, name: path.replace(/[./\s]+/g, '-'), uses: 0});
		}
	}

	return colors;
}

/** The colours of a pasted or chosen text, whichever of the two it is. */
export function extractColors(text: string): ExtractedColor[] {
	const trimmed = text.trim();

	if (/^[[{]/.test(trimmed)) {
		try {
			return extractColorsFromTokens(JSON.parse(trimmed));
		}
		catch {
			// Not JSON: read it as a stylesheet.
		}
	}

	return extractColorsFromCSS(trimmed);
}

/** A label for a colour from what its source calls it: `--brand-purple-600` reads "Brand purple 600". */
export function colorLabel(color: ExtractedColor): string {
	const words = (color.name ?? '')
		.replace(/^--/, '')
		.replace(/([a-z])([A-Z0-9])/g, '$1 $2')
		.split(/[-_.\s]+/)
		.filter((word) => word && !/^(color|colour|clr)$/i.test(word));

	if (!words.length) {
		return color.hex;
	}

	const label = words.join(' ').toLowerCase();

	return label.charAt(0).toUpperCase() + label.slice(1);
}
