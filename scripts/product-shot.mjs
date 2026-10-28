/**
 * The product shot of the landing's hero: the Showroom itself at 1440×900,
 * device scale 2, on a fragment's Docs tab. Needs the dev server running.
 *
 *   PLAYWRIGHT_MODULE=<path to playwright> PLAYWRIGHT_CHANNEL=chrome node scripts/product-shot.mjs [http://localhost:5178]
 */
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = (process.argv[2] || 'http://localhost:5178').replace(/\/$/, '');
const out = join(new URL('..', import.meta.url).pathname, 'public', 'images');

mkdirSync(out, {recursive: true});

const browser = await chromium.launch({channel: process.env.PLAYWRIGHT_CHANNEL || undefined, executablePath: process.env.PLAYWRIGHT_EXECUTABLE || undefined});
const page = await browser.newPage({colorScheme: 'dark', deviceScaleFactor: 2, viewport: {height: 900, width: 1440}});

await page.addInitScript(() => {
	try {
		localStorage.setItem('liferay-showroom:editor-scheme', 'dark');
		localStorage.removeItem('liferay-showroom:v1');
	}
	catch (error) {}
});

await page.goto(`${base}/?path=/fragment/liferay-sites-ds/lsds-hero`, {waitUntil: 'networkidle'});
await page.waitForSelector('.showroom-canvas__frame');
await page.locator('.showroom-toolbar select').nth(1).selectOption('builtin-lsds-dark');
await page.locator('[role="tab"]', {hasText: 'Docs'}).click();
await page.waitForTimeout(2500);
await page.screenshot({path: join(out, 'product-shot.png'), type: 'png'});

await browser.close();

console.log(`${out}/product-shot.png`);
