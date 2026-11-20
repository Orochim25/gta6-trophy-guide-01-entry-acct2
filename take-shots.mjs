import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '/home/hatch/workspace/xe-sdk/node_modules/playwright-core/index.mjs';

const shots = JSON.parse(await readFile(new URL('./shots.json', import.meta.url)));
const output = new URL('./screenshots/', import.meta.url);
const views = {
  '1-roadmap.jpg': 'roadmap',
  '2-tracker.jpg': 'tracker',
  '3-missables.jpg': 'missables',
  '4-sources.jpg': 'sources',
};
assert.deepEqual(shots.map(shot => shot.file), Object.keys(views));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox', '--allow-file-access-from-files'],
});

try {
  for (const { file, path, viewport } of shots) {
    assert.equal(path, '/');
    const view = views[file];
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    page.setDefaultTimeout(5000);
    try {
      await page.goto(new URL('./app/index.html', import.meta.url).href);
      await page.locator('#roadmap .route').waitFor();
      if (view !== 'roadmap') await page.locator(`nav [data-tab="${view}"]`).click();
      assert.ok(await page.locator(`#${view}`).isVisible());
      if (view === 'tracker') {
        await page.locator('[data-earned="2"]').click();
        assert.ok(await page.locator('[data-earned="2"]').isChecked());
        await page.locator('[data-pick="28"]').click();
        assert.ok(await page.locator('#trophy-detail ol .cite').first().isVisible());
      }
      for (const selector of ['#trophy-list', 'html', 'body']) {
        await page.locator(selector).evaluate(element => { element.scrollTop = 0; });
      }
      const destination = fileURLToPath(new URL(file, output));
      let saved = false;
      for (const quality of [80, 70, 60]) {
        const jpeg = await page.screenshot({ type: 'jpeg', quality, animations: 'disabled' });
        if (jpeg.length > 256 * 1024) continue;
        await writeFile(destination, jpeg);
        const { streams: [{ width, height }] } = JSON.parse(execFileSync('ffprobe', [
          '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', destination,
        ], { encoding: 'utf8' }));
        assert.equal(width, viewport.width);
        assert.equal(height, viewport.height);
        assert.ok(Math.max(width, height) <= 1280 && Math.min(width, height) >= 480);
        const { size } = await stat(destination);
        console.log(`${file}: ${size} bytes, ${width}×${height}, JPEG quality ${quality}`);
        saved = true;
        break;
      }
      assert.ok(saved, `${file} exceeds 256 KiB even at quality 60`);
    } finally {
      await page.close();
    }
  }
  assert.deepEqual((await readdir(output)).sort(), Object.keys(views).sort());
} finally {
  await browser.close();
}
