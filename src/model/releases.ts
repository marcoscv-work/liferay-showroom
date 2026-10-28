import type {ReleaseAsset, ReleaseManifest} from './types';

/**
 * What changed between two release manifests, asset by asset. The manifests
 * only carry hashes, so this is exact about which assets and files changed
 * and says nothing about how; the repository history has the diff.
 */

export interface AssetChange {
	asset: ReleaseAsset;
	/** Files whose hash differs (`index.html`, `index.css`, ...). Empty for added and removed assets. */
	files: string[];
	kind: 'added' | 'changed' | 'removed';
	previous?: ReleaseAsset;
}

export interface ReleaseDiff {
	changes: AssetChange[];
	counts: Record<AssetChange['kind'], number>;
}

function assetId(asset: ReleaseAsset): string {
	return `${asset.type}:${asset.parent ?? ''}:${asset.key}`;
}

export function compareVersions(a: string, b: string): number {
	const pa = a.replace(/^v/, '').split(/[.-]/);
	const pb = b.replace(/^v/, '').split(/[.-]/);

	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const na = Number(pa[i] ?? 0);
		const nb = Number(pb[i] ?? 0);

		if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) {
			return na - nb;
		}

		const sa = pa[i] ?? '';
		const sb = pb[i] ?? '';

		if (sa !== sb) {
			return sa < sb ? -1 : 1;
		}
	}

	return 0;
}

/** Newest first. */
export function sortReleases(releases: ReleaseManifest[]): ReleaseManifest[] {
	return [...releases].sort((a, b) => compareVersions(b.version, a.version));
}

export function diffReleases(current: ReleaseManifest, previous: ReleaseManifest | null): ReleaseDiff {
	const before = new Map((previous?.assets ?? []).map((asset) => [assetId(asset), asset]));
	const changes: AssetChange[] = [];

	for (const asset of current.assets) {
		const old = before.get(assetId(asset));

		if (!old) {
			changes.push({asset, files: [], kind: 'added'});
		}
		else if (old.hash !== asset.hash) {
			const files = Object.keys({...old.files, ...asset.files}).filter((file) => old.files?.[file] !== asset.files?.[file]);

			changes.push({asset, files, kind: 'changed', previous: old});
		}

		before.delete(assetId(asset));
	}

	for (const old of before.values()) {
		changes.push({asset: old, files: [], kind: 'removed'});
	}

	const order: Record<AssetChange['kind'], number> = {added: 0, changed: 1, removed: 2};

	changes.sort((a, b) => order[a.kind] - order[b.kind] || a.asset.type.localeCompare(b.asset.type) || a.asset.name.localeCompare(b.asset.name));

	return {
		changes,
		counts: {
			added: changes.filter((change) => change.kind === 'added').length,
			changed: changes.filter((change) => change.kind === 'changed').length,
			removed: changes.filter((change) => change.kind === 'removed').length,
		},
	};
}

export function historyURL(manifest: ReleaseManifest, asset: ReleaseAsset): string | null {
	if (!manifest.repository || !asset.path) {
		return null;
	}

	return `https://github.com/${manifest.repository}/commits/v${manifest.version}/${asset.path}`;
}

export function compareURL(manifest: ReleaseManifest, previous: ReleaseManifest | null): string | null {
	if (!manifest.repository || !previous) {
		return null;
	}

	return `https://github.com/${manifest.repository}/compare/v${previous.version}...v${manifest.version}`;
}

export function downloadURL(manifest: ReleaseManifest, file: string): string | null {
	if (!manifest.repository) {
		return null;
	}

	return `https://github.com/${manifest.repository}/releases/download/v${manifest.version}/${file}`;
}
