import {execSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

import {exportCollectionZip, exportStyleBookZip, exportTemplateZip} from '../src/model/zip';
import {hashFiles, readCheckout, sha256} from './lib/assets';

import type {ReleaseAsset, ReleaseManifest} from '../src/model/types';

/**
 * Records a release: the manifest of every exportable asset with its hash
 * (`releases/<version>.json`, committed, so the site can list what changed
 * between versions) and the zips Liferay imports (`release/`, attached to
 * the GitHub release by the workflow).
 *
 *   npx vite-node scripts/release.ts [--version 1.2.0] [--root <checkout>] [--out release] [--manifests releases]
 *
 * `--root` reads another checkout (a worktree at an older tag) so past
 * releases can be recorded after the fact.
 */

function argument(name: string, fallback: string): string {
	const index = process.argv.indexOf(`--${name}`);

	return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function git(root: string, command: string): string {
	try {
		return execSync(`git ${command}`, {cwd: root, stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
	}
	catch {
		return '';
	}
}

function slug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const root = resolve(argument('root', repoRoot));
const out = resolve(argument('out', join(repoRoot, 'release')));
const manifestsDir = resolve(argument('manifests', join(repoRoot, 'releases')));

const packageJSON = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = argument('version', packageJSON.version).replace(/^v/, '');

const remote = git(root, 'remote get-url origin');
const repository = remote.match(/github\.com[/:]([^/]+\/[^/.]+)/)?.[1];

const checkout = readCheckout(root);

const assets: ReleaseAsset[] = [];
const downloads: {file: string; name: string}[] = [];

mkdirSync(out, {recursive: true});
mkdirSync(manifestsDir, {recursive: true});

async function write(file: string, blob: Blob): Promise<void> {
	writeFileSync(join(out, file), Buffer.from(await blob.arrayBuffer()));
}

for (const {collection, files, fragmentFiles} of checkout.collections) {
	assets.push({hash: hashFiles(files.files), key: collection.key, name: collection.name, path: files.path, type: 'fragment-set'});

	for (const fragment of collection.fragments) {
		const own = fragmentFiles[fragment.key];
		const perFile: Record<string, string> = {};

		for (const [name, content] of Object.entries(own.files)) {
			perFile[name] = sha256(content);
		}

		assets.push({files: perFile, hash: hashFiles(own.files), key: fragment.key, name: fragment.name, parent: collection.key, path: own.path, type: 'fragment'});
	}

	const file = `${collection.key}-fragments-${version}.zip`;

	await write(file, await exportCollectionZip(collection));
	downloads.push({file, name: `${collection.name} (fragment set)`});
}

for (const {files, template} of checkout.templates) {
	const perFile: Record<string, string> = {};

	for (const [name, content] of Object.entries(files.files)) {
		perFile[name] = sha256(content);
	}

	assets.push({files: perFile, hash: hashFiles(files.files), key: template.id.replace(/^builtin-/, ''), name: template.name, path: files.path, type: 'page-template'});

	const file = `${slug(template.name)}-page-template-${version}.zip`;

	await write(file, await exportTemplateZip(template));
	downloads.push({file, name: `${template.name} (page template)`});
}

for (const {files, styleBook} of checkout.styleBooks) {
	const perFile: Record<string, string> = {};

	for (const [name, content] of Object.entries(files.files)) {
		perFile[name] = sha256(content);
	}

	assets.push({files: perFile, hash: hashFiles(files.files), key: styleBook.key.replace(/^builtin-/, ''), name: styleBook.name, path: files.path, type: 'style-book'});

	const theme = checkout.themes.find((candidate) => candidate.key === styleBook.themeKey) ?? null;
	const file = `${slug(styleBook.name)}-style-book-${version}.zip`;

	await write(file, await exportStyleBookZip(styleBook, theme));
	downloads.push({file, name: `${styleBook.name} (style book)`});
}

const manifest: ReleaseManifest = {
	assets,
	// The commit is only known when the tree is clean: a release recorded with pending changes gets it from the tag workflow.
	commit: git(root, 'status --porcelain') ? undefined : git(root, 'rev-parse HEAD') || undefined,
	date: new Date().toISOString(),
	downloads,
	repository,
	version,
};

const manifestPath = join(manifestsDir, `${version}.json`);

if (existsSync(manifestPath)) {
	const previous = JSON.parse(readFileSync(manifestPath, 'utf8'));

	// Keep the original date when re-recording a release, so the manifest stays stable across runs.
	manifest.date = previous.date ?? manifest.date;
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');
writeFileSync(join(out, 'release.json'), JSON.stringify(manifest, null, '\t') + '\n');

console.log(`Release ${version}: ${assets.filter((asset) => asset.type === 'fragment-set').length} fragment set(s), ${assets.filter((asset) => asset.type === 'fragment').length} fragment(s), ${checkout.templates.length} page template(s), ${checkout.styleBooks.length} style book(s)`);
console.log(`Manifest: ${manifestPath}`);
console.log(`Zips: ${out}`);
