/**
 * Turns the media a collection still loads from the design system host into
 * fragment set resources: every `<assetsURL>/<file>` found in a fragment's
 * HTML, CSS or configuration is downloaded once into
 * `<collectionDir>/resources/` and the reference becomes `[resources:<file>]`,
 * which is what Liferay resolves when the set is imported.
 *
 * Vite appends a content hash to every asset name (`hero-media-TxN2RXRd.png`);
 * the resource keeps the readable part (`hero-media.png`) unless two assets
 * would collide, in which case the hashed name is kept.
 */
import {existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const FRAGMENT_FILES = ['index.html', 'index.css', 'configuration.json'];

const VITE_HASH = /-[A-Za-z0-9_-]{8}(\.[a-z0-9]+)$/i;

export function resourceName(file, taken = new Map()) {
	const plain = file.replace(VITE_HASH, '$1');

	const owner = taken.get(plain);

	if (owner === undefined || owner === file) {
		taken.set(plain, file);

		return plain;
	}

	taken.set(file, file);

	return file;
}

export async function localizeMedia(collectionDir, assetsURL, {fetchFile = defaultFetch, log = console.log} = {}) {
	const base = assetsURL.replace(/\/$/, '');
	const pattern = new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([A-Za-z0-9._-]+)`, 'g');

	const resourcesDir = join(collectionDir, 'resources');

	const taken = new Map();
	const names = new Map();
	const downloads = new Map();

	const fragmentDirs = readdirSync(collectionDir).filter((dir) => dir !== 'resources' && statSync(join(collectionDir, dir)).isDirectory());

	for (const fragmentDir of fragmentDirs) {
		for (const fileName of FRAGMENT_FILES) {
			const path = join(collectionDir, fragmentDir, fileName);

			if (!existsSync(path)) {
				continue;
			}

			const text = readFileSync(path, 'utf8');

			if (!pattern.test(text)) {
				pattern.lastIndex = 0;

				continue;
			}

			pattern.lastIndex = 0;

			const replaced = text.replace(pattern, (match, file) => {
				if (!names.has(file)) {
					names.set(file, resourceName(file, taken));
				}

				const name = names.get(file);

				if (!downloads.has(file)) {
					downloads.set(file, `${base}/${file}`);
				}

				return `[resources:${name}]`;
			});

			writeFileSync(path, replaced);
		}
	}

	if (!downloads.size) {
		return [];
	}

	mkdirSync(resourcesDir, {recursive: true});

	const written = [];

	for (const [file, url] of downloads) {
		const name = names.get(file);
		const target = join(resourcesDir, name);

		writeFileSync(target, await fetchFile(url));
		written.push(name);

		log(`resources/${name} <- ${url}`);
	}

	return written.sort();
}

async function defaultFetch(url) {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`${url}: HTTP ${response.status}`);
	}

	return Buffer.from(await response.arrayBuffer());
}
