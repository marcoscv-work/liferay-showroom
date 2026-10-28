import {describe, expect, it} from 'vitest';

import {compareVersions, diffReleases, downloadURL, historyURL, sortReleases} from './releases';

import type {ReleaseManifest} from './types';

const v1: ReleaseManifest = {
	assets: [
		{hash: 'set1', key: 'ds', name: 'DS', path: 'collections/ds', type: 'fragment-set'},
		{files: {'index.css': 'c1', 'index.html': 'h1'}, hash: 'b1', key: 'button', name: 'Button', parent: 'ds', path: 'collections/ds/button', type: 'fragment'},
		{files: {'index.css': 'c1', 'index.html': 'h1'}, hash: 'l1', key: 'label', name: 'Label', parent: 'ds', path: 'collections/ds/label', type: 'fragment'},
		{hash: 's1', key: 'light', name: 'Light', path: 'style-books/light', type: 'style-book'},
	],
	date: '2026-10-01T00:00:00.000Z',
	repository: 'owner/repo',
	version: '1.0.0',
};

const v2: ReleaseManifest = {
	...v1,
	assets: [
		{hash: 'set2', key: 'ds', name: 'DS', path: 'collections/ds', type: 'fragment-set'},
		{files: {'index.css': 'c2', 'index.html': 'h1'}, hash: 'b2', key: 'button', name: 'Button', parent: 'ds', path: 'collections/ds/button', type: 'fragment'},
		{files: {'index.css': 'c1', 'index.html': 'h1'}, hash: 'l1', key: 'label', name: 'Label', parent: 'ds', path: 'collections/ds/label', type: 'fragment'},
		{files: {'page-definition.json': 'p1'}, hash: 't1', key: 'home', name: 'Home', path: 'templates/home', type: 'page-template'},
	],
	date: '2026-10-28T00:00:00.000Z',
	version: '1.1.0',
};

describe('release manifests', () => {
	it('lists added, changed and removed assets with the files that changed', () => {
		const diff = diffReleases(v2, v1);

		expect(diff.counts).toEqual({added: 1, changed: 2, removed: 1});
		expect(diff.changes.map((change) => `${change.kind}:${change.asset.type}:${change.asset.key}`)).toEqual(['added:page-template:home', 'changed:fragment:button', 'changed:fragment-set:ds', 'removed:style-book:light']);
		expect(diff.changes.find((change) => change.asset.key === 'button')?.files).toEqual(['index.css']);
	});

	it('treats the first release as all new', () => {
		expect(diffReleases(v1, null).counts).toEqual({added: 4, changed: 0, removed: 0});
	});

	it('orders versions numerically, newest first', () => {
		expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
		expect(sortReleases([v1, v2, {...v1, version: '1.2.0'}]).map((release) => release.version)).toEqual(['1.2.0', '1.1.0', '1.0.0']);
	});

	it('links to the repository history and the release downloads', () => {
		expect(historyURL(v2, v2.assets[1])).toBe('https://github.com/owner/repo/commits/v1.1.0/collections/ds/button');
		expect(downloadURL(v2, 'ds-fragments-1.1.0.zip')).toBe('https://github.com/owner/repo/releases/download/v1.1.0/ds-fragments-1.1.0.zip');
		expect(historyURL({...v2, repository: undefined}, v2.assets[1])).toBeNull();
	});
});
