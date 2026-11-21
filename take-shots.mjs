import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '/home/hatch/workspace/xe-sdk/node_modules/playwright-core/index.mjs';

const shots = JSON.parse(await readFile(new URL('./shots.json', import.meta.url)));
const output = new URL('./screenshots/', import.meta.url);
const views = {
  '1-tracker.jpg': 'tracker',
  '2-missables.jpg': 'missables',
  '3-sources.jpg': 'sources',
  '4-journal.jpg': 'journal',
};
assert.deepEqual(shots.map(shot => shot.file), Object.keys(views));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox', '--allow-file-access-from-files'],
});

try {
  let totalBytes = 0;
  for (const { file, path, viewport } of shots) {
    assert.equal(path, '/');
    const view = views[file];
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    page.setDefaultTimeout(8000);
    try {
      await page.goto(new URL('./app/index.html', import.meta.url).href);
      await page.locator('#tracker .trophy-row').first().waitFor();
      if (view !== 'tracker') await page.locator(`nav [data-tab="${view}"]`).click();
      assert.ok(await page.locator(`#${view}`).isVisible());
      if (view === 'tracker') {
        // Demo progress: 6 earned (11%) so the top bar shows a real ring and counts.
        for (const id of [2, 3, 4, 8, 16, 35]) {
          await page.locator(`[data-earned="${id}"]`).click();
          assert.ok(await page.locator(`[data-earned="${id}"]`).isChecked());
        }
        await page.locator('[data-pick="1"]').click();
        assert.ok(await page.locator('#trophy-detail ol .cite').first().isVisible());
        await page.locator('#trophy-list').evaluate(element => { element.scrollTop = 0; });
      }
      await page.evaluate(() => window.scrollTo(0, 0));
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
        assert.ok(size > 10 * 1024, `${file} is too small to be a non-blank screenshot`);
        console.log(`${file}: ${size} bytes, ${width}×${height}, JPEG quality ${quality}`);
        totalBytes += size;
        console.log(`Running screenshot total: ${totalBytes} bytes`);
        saved = true;
        break;
      }
      assert.ok(saved, `${file} exceeds 256 KiB even at quality 60`);
    } finally {
      await page.close();
    }
  }
  console.log(`Screenshot capture finished: ${totalBytes} bytes across 4 screenshots.`);
  assert.deepEqual((await readdir(output)).sort(), Object.keys(views).sort());
} finally {
  await browser.close();
}
