import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

import {describe, expect, it} from 'vitest';

import {allFields, defaultRawValue, parseConfiguration} from './configuration';
import {renderFragment} from './fragmentRenderer';

/**
 * Every bundled fragment must render through the FreeMarker interpreter
 * without parse errors or unknown directives. Missing-value warnings are
 * allowed (they come from Liferay-only data such as mapped content).
 */

const root = new URL('../../collections/', import.meta.url).pathname;

const BLOCKING = [/Unknown directive/, /Unknown built-in/, /Unexpected/, /Missing/, /Cannot parse/, /Template error/];

describe('bundled collections', () => {
	for (const collectionDir of readdirSync(root)) {
		const collectionPath = join(root, collectionDir);

		let fragmentDirs: string[] = [];

		try {
			fragmentDirs = readdirSync(collectionPath).filter((dir) => dir !== 'resources' && !dir.includes('.'));
		}
		catch {
			continue;
		}

		it(`${collectionDir} ships every resource its fragments reference`, () => {
			const missing = new Set<string>();

			for (const fragmentDir of fragmentDirs) {
				for (const name of ['index.html', 'index.css', 'configuration.json']) {
					let text = '';

					try {
						text = readFileSync(join(collectionPath, fragmentDir, name), 'utf8');
					}
					catch {
						continue;
					}

					for (const match of text.matchAll(/\[resources:([^\]]+)\]/g)) {
						if (!existsSync(join(collectionPath, 'resources', match[1].trim()))) {
							missing.add(match[1]);
						}
					}
				}
			}

			expect([...missing]).toEqual([]);
		});

		for (const fragmentDir of fragmentDirs) {
			const fragmentPath = join(collectionPath, fragmentDir);

			const read = (name: string) => {
				try {
					return readFileSync(join(fragmentPath, name), 'utf8');
				}
				catch {
					return '';
				}
			};

			it(`${collectionDir}/${fragmentDir} renders`, () => {
				const fragment = {
					collectionKey: collectionDir,
					configuration: read('configuration.json'),
					css: read('index.css'),
					html: read('index.html'),
					icon: '',
					js: read('index.js'),
					key: fragmentDir,
					name: fragmentDir,
					thumbnail: '',
					type: 'component',
				};

				const {configuration} = parseConfiguration(fragment.configuration);
				const raw: Record<string, any> = {};

				for (const field of allFields(configuration)) {
					raw[field.name] = defaultRawValue(field);
				}

				const result = renderFragment(fragment, {collection: null, configuration: raw, imagesPath: '/images', namespace: 'test', theme: null});

				const blocking = result.warnings.filter((warning) => BLOCKING.some((pattern) => pattern.test(warning)));

				expect(blocking, result.warnings.join('\n')).toEqual([]);
				expect(result.html.trim().length).toBeGreaterThan(0);
			});
		}
	}
});
