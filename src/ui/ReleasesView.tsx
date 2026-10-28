import {compareURL, diffReleases, downloadURL, historyURL, sortReleases} from '../model/releases';
import {useStore} from '../store';
import {Icon} from './Icon';
import {Markdown} from './Markdown';

import type {AssetChange} from '../model/releases';
import type {ReleaseAsset, ReleaseManifest} from '../model/types';

const TYPE_LABELS: Record<ReleaseAsset['type'], string> = {
	'fragment': 'Fragment',
	'fragment-set': 'Fragment set',
	'page-template': 'Page template',
	'style-book': 'Style book',
};

const TYPE_ICONS: Record<ReleaseAsset['type'], string> = {
	'fragment': 'code',
	'fragment-set': 'folder',
	'page-template': 'page',
	'style-book': 'color-picker',
};

/**
 * Every release, newest first: the hand-written notes, the zips attached to
 * the GitHub release, and the generated list of assets that changed since
 * the previous release.
 */
export function ReleasesView() {
	const {state} = useStore();

	const releases = sortReleases(state.releases);

	return (
		<section aria-label="Releases" className="showroom-docs-view">
			<article className="showroom-docs-view__page">
				<div className="showroom-docs">
					<div className="showroom-docs__prose">
						<h1>Releases</h1>
						<p>
							Every release is a tag of the repository and a GitHub release with the zips Liferay imports. The list of changes is computed from the content of each asset, so it is exact about which fragments, templates and style
							books changed, and the notes say why.
						</p>
					</div>
					{!releases.length && <p className="text-secondary">No releases yet. Run <span className="showroom-mono">npm run release</span> to record the first one.</p>}
					{releases.map((release, index) => (
						<Release key={release.version} manifest={release} previous={releases[index + 1] ?? null} />
					))}
				</div>
			</article>
		</section>
	);
}

function Release({manifest, previous}: {manifest: ReleaseManifest; previous: ReleaseManifest | null}) {
	const diff = diffReleases(manifest, previous);
	const compare = compareURL(manifest, previous);

	const fragmentSets = manifest.assets.filter((asset) => asset.type === 'fragment-set');
	const fragments = manifest.assets.filter((asset) => asset.type === 'fragment');
	const templates = manifest.assets.filter((asset) => asset.type === 'page-template');
	const styleBooks = manifest.assets.filter((asset) => asset.type === 'style-book');

	return (
		<section className="showroom-release">
			<header className="showroom-release__header">
				<h2 className="showroom-release__version">
					{manifest.version}
					{!previous && <span className="label label-secondary ml-2">first release</span>}
				</h2>
				<span className="text-secondary small">
					{manifest.date.slice(0, 10)}
					{manifest.commit && (
						<>
							{' · '}
							<span className="showroom-mono">{manifest.commit.slice(0, 7)}</span>
						</>
					)}
				</span>
			</header>

			<p className="showroom-release__contents text-secondary small">
				{fragmentSets.length} fragment set{fragmentSets.length === 1 ? '' : 's'} with {fragments.length} fragment{fragments.length === 1 ? '' : 's'}, {templates.length} page template{templates.length === 1 ? '' : 's'}, {styleBooks.length} style book
				{styleBooks.length === 1 ? '' : 's'}.
			</p>

			{manifest.downloads && manifest.downloads.length > 0 && (
				<ul className="showroom-release__downloads list-unstyled">
					{manifest.downloads.map((download) => {
						const url = downloadURL(manifest, download.file);

						return (
							<li key={download.file}>
								{url ? (
									<a className="btn btn-secondary btn-sm" href={url} rel="noreferrer" target="_blank">
										<Icon className="mr-1" symbol="download" />
										{download.name}
									</a>
								) : (
									<span className="btn btn-secondary btn-sm disabled">{download.name}</span>
								)}
							</li>
						);
					})}
				</ul>
			)}

			{manifest.notes && (
				<div className="showroom-release__notes">
					<Markdown markdown={manifest.notes} />
				</div>
			)}

			<h3 className="showroom-release__subtitle">
				Changes
				{previous && (
					<span className="text-secondary small font-weight-normal ml-2">
						since {previous.version}
						{compare && (
							<>
								{' · '}
								<a href={compare} rel="noreferrer" target="_blank">
									compare on GitHub
								</a>
							</>
						)}
					</span>
				)}
			</h3>

			{!previous && <p className="text-secondary small">Everything is new in the first release.</p>}

			{previous && !diff.changes.length && <p className="text-secondary small">No asset changed. Documentation or tooling only.</p>}

			{previous && diff.changes.length > 0 && (
				<>
					<p className="small">
						<span className="label label-success mr-1">{diff.counts.added} added</span>
						<span className="label label-info mr-1">{diff.counts.changed} changed</span>
						<span className="label label-danger">{diff.counts.removed} removed</span>
					</p>
					<table className="table table-sm showroom-release__table">
						<thead>
							<tr>
								<th scope="col">Asset</th>
								<th scope="col">Change</th>
								<th scope="col">What</th>
							</tr>
						</thead>
						<tbody>
							{diff.changes.map((change) => (
								<ChangeRow change={change} key={`${change.asset.type}-${change.asset.parent ?? ''}-${change.asset.key}`} manifest={manifest} />
							))}
						</tbody>
					</table>
				</>
			)}
		</section>
	);
}

function ChangeRow({change, manifest}: {change: AssetChange; manifest: ReleaseManifest}) {
	const {dispatch, state} = useStore();
	const {asset} = change;
	const history = change.kind === 'removed' ? null : historyURL(manifest, asset);

	const select = () => {
		if (asset.type === 'fragment' && asset.parent) {
			dispatch({selection: {collectionKey: asset.parent, fragmentKey: asset.key, kind: 'fragment'}, type: 'select'});
		}
		else if (asset.type === 'page-template') {
			const template = state.templates.find((candidate) => candidate.id === asset.key || candidate.id === `builtin-${asset.key}`);

			if (template) {
				dispatch({selection: {id: template.id, kind: 'template'}, type: 'select'});
			}
		}
	};

	const selectable = change.kind !== 'removed' && ((asset.type === 'fragment' && state.collections.some((collection) => collection.key === asset.parent)) || asset.type === 'page-template');

	return (
		<tr>
			<td>
				<Icon className="mr-2 text-secondary" symbol={TYPE_ICONS[asset.type]} />
				{selectable ? (
					<button className="btn btn-unstyled showroom-embed__link" onClick={select} type="button">
						{asset.name}
					</button>
				) : (
					asset.name
				)}
				<span className="text-secondary small ml-2">{TYPE_LABELS[asset.type]}</span>
			</td>
			<td>
				<span className={`label label-${change.kind === 'added' ? 'success' : change.kind === 'changed' ? 'info' : 'danger'}`}>{change.kind}</span>
			</td>
			<td>
				{change.kind === 'changed' && change.files.length > 0 && <span className="showroom-mono">{change.files.join(', ')}</span>}
				{change.kind === 'changed' && !change.files.length && <span className="text-secondary">content</span>}
				{history && (
					<a className="ml-2 small" href={history} rel="noreferrer" target="_blank">
						history
					</a>
				)}
			</td>
		</tr>
	);
}
