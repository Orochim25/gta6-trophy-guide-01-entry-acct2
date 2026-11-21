import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '/home/hatch/workspace/xe-sdk/node_modules/playwright-core/index.mjs';

const app = new URL('./app/index.html', import.meta.url).href;
const { trophies } = JSON.parse(await readFile(new URL('./app/data/trophies.json', import.meta.url)));
const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
const pageErrors = [];
const watch = page => {
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));
};
watch(page);
page.setDefaultTimeout(6000); // Shared verification VM can respond slowly under load.
const el = selector => page.locator(selector);
const tab = name => el(`nav [data-tab="${name}"]`).click();
const pick = id => el(`[data-pick="${id}"]`);
const box = id => el(`[data-earned="${id}"]`);
const rows = el('.trophy-row');
const query = el('#query');
const kind = el('#kind');
const progress = el('#earned-filter');
const current = () => el('[data-pick][aria-current=true]').getAttribute('data-pick');

async function check(label, run) {
  try {
    await run();
    console.log(`PASS ${label}`);
  } catch (error) {
    console.error(`FAIL ${label}: ${error.message}`);
    process.exitCode = 1;
  }
}

try {
  await check('Load Tracker (landing) and render all 55 trophies', async () => {
    await page.goto(app);
    await el('#tracker .trophy-row').first().waitFor();
    await tab('tracker');
    await el('#match-count').getByText('55 / 55 trophies').waitFor();
    assert.equal(await rows.count(), 55);
  });
  for (const name of ['roadmap', 'missables', 'sources', 'tracker']) {
    await check(`Click ${name} tab`, async () => {
      await tab(name);
      assert.ok(await el(`#${name}`).isVisible());
      assert.equal(await el(`nav [data-tab="${name}"]`).getAttribute('aria-current'), 'page');
      assert.equal(await el('.views > section:visible').count(), 1);
    });
  }
  for (const filter of ['story', 'missable', 'collectibles', 'activities', 'online', 'all']) {
    await check(`Kind filter: ${filter}${filter === 'online' ? ' and empty state' : ''}`, async () => {
      await kind.click();
      await kind.selectOption(filter);
      const expected = trophies.filter(trophy => filter === 'all' || trophy.kind === filter ||
        (filter === 'collectibles' && trophy.id === 28)).map(trophy => String(trophy.id));
      assert.deepEqual(await el('[data-pick]').evaluateAll(items => items.map(item => item.dataset.pick)), expected);
      if (filter === 'online') assert.equal(await el('#trophy-list .empty').textContent(), 'There are no online trophies.');
    });
  }
  await check('Search for the meditation trophy and clear the query', async () => {
    await query.click();
    try {
      await query.pressSequentially('meditate');
      assert.ok((await rows.count()) > 0 && (await rows.count()) < 55);
      assert.ok(await pick(28).isVisible());
      assert.match(await pick(28).textContent(), /meditate/i);
    } finally {
      await query.fill('');
    }
    assert.equal(await rows.count(), 55);
  });
  await check('Spoiler shield hides the story title until earned and updates the ring', async () => {
    const hidden = trophies.find(trophy => trophy.hidden && trophy.kind === 'story');
    const shield = el('#spoilers');
    await pick(hidden.id).click();
    const title = el('#trophy-detail h3');
    assert.ok(await shield.isChecked());
    assert.match(await title.textContent(), /Hidden story trophy/);
    await shield.click();
    assert.equal(await title.textContent(), hidden.name);
    await shield.click();
    assert.match(await title.textContent(), /Hidden story trophy/);
    await el(`#trophy-detail [data-mark="${hidden.id}"]`).click();
    assert.ok(await box(hidden.id).isChecked());
    assert.equal(await title.textContent(), hidden.name);
    assert.equal(await el('#progress .dial').getAttribute('aria-label'), '2% complete');
    await el(`#trophy-detail [data-mark="${hidden.id}"]`).click();
    assert.match(await title.textContent(), /Hidden story trophy/);
  });
  for (const crew of ['jason', 'lucia', 'all']) {
    await check(`Crew filter: ${crew}`, async () => {
      const button = el(`[data-crew="${crew}"]`);
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await rows.count(), trophies.filter(trophy =>
        crew === 'all' || ['both', 'either', crew].includes(trophy.protagonist)).length);
    });
  }
  for (const [minutes, stops] of [[30, 1], [60, 2], [120, 4]]) {
    await check(`Run planner: ${minutes} min`, async () => {
      const button = el(`[data-minutes="${minutes}"]`);
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await el('#plan [data-open]').count(), stops);
    });
  }
  await check('Keyboard j / k move selection, x toggles earned, / opens Tracker and focuses search', async () => {
    await pick(2).click();
    await page.keyboard.press('j');
    assert.equal(await current(), '3');
    await page.keyboard.press('k');
    assert.equal(await current(), '2');
    await page.keyboard.press('x');
    assert.ok(await box(2).isChecked());
    await page.keyboard.press('x');
    assert.ok(!(await box(2).isChecked()));
    await tab('roadmap');
    await page.keyboard.press('/');
    assert.ok(await el('#tracker').isVisible());
    assert.ok(await query.evaluate(input => input === document.activeElement));
  });
  await check('Click Import JSON; trophy #2 is earned and the ring moves from 0% to 2%', async () => {
    assert.equal(await el('#progress .dial').getAttribute('aria-label'), '0% complete');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), el('#import').click()]);
    await chooser.setFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from('{"earned":[2]}') });
    await el('#notice').getByText('Imported 1 earned trophies.').waitFor();
    await tab('tracker');
    assert.ok(await box(2).isChecked());
    assert.equal(await el('#progress .dial').getAttribute('aria-label'), '2% complete');
    assert.equal(await el('#progress .dial circle').last().getAttribute('stroke-dasharray'), `${100 / 55} 100`);
  });
  await check('Progress filters: earned, not earned, all', async () => {
    for (const [filter, count] of [['earned', 1], ['open', 54], ['all', 55]]) {
      await progress.click();
      await progress.selectOption(filter);
      assert.equal(await rows.count(), count);
    }
  });
  await check('Export JSON downloads the current earned state', async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), el('#export').click()]);
    assert.equal(download.suggestedFilename(), 'vice-route-55-progress.json');
    const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(exported.version, 1);
    assert.deepEqual(exported.earned, [2]);
  });
  await check('Click Copy link; hash restores earned state on reload and in a fresh context', async () => {
    await box(3).click();
    assert.ok(await box(3).isChecked());
    await el('#share').click();
    await el('#notice').getByText(/Progress link copied|Select and copy this progress link/).waitFor();
    const hash = await page.evaluate(() => location.hash);
    assert.match(hash, /^#run=/);
    assert.deepEqual(JSON.parse(decodeURIComponent(hash.slice(5))).earned, [2, 3]);
    if (await el('#share-fallback').isVisible()) assert.equal(await el('#share-fallback').inputValue(), app + hash);
    await page.reload();
    await box(3).waitFor();
    assert.ok(await box(3).isChecked());
    const fresh = await browser.newPage();
    watch(fresh);
    try {
      await fresh.goto(app + hash);
      const shared = fresh.locator('[data-earned="3"]');
      await shared.waitFor({ timeout: 4000 });
      assert.ok(await shared.isChecked());
      assert.ok(await fresh.locator('[data-earned="2"]').isChecked());
    } finally {
      await fresh.close();
    }
  });
  await check('Guide citations, source disagreements, and Clear filters', async () => {
    await pick(28).click();
    const citation = el('#trophy-detail .cite').first();
    const source = await citation.getAttribute('data-source');
    await citation.click();
    assert.ok(await el(`#source-${source}`).evaluate(target => target === document.activeElement));
    await el('[data-disputes]').click();
    assert.ok(await el('#disagreements').evaluate(target => target === document.activeElement));
    await tab('tracker');
    await kind.selectOption('online');
    await el('#reset-filters').click();
    assert.equal(await rows.count(), 55);
  });
  await check('Roadmap completion checklist and links, run planner link, and print button', async () => {
    await tab('roadmap');
    await el('#roadmap summary').click();
    assert.ok(await el('#roadmap .check-grid').isVisible());
    await el('#roadmap [data-tab="missables"]').click();
    assert.ok(await el('#missables .warning').isVisible());
    await el('#missables [data-mark]').click();
    assert.equal(await el('#missables [data-mark]').getAttribute('aria-pressed'), 'true');
    await tab('roadmap');
    await el('#roadmap [data-open="1"]').click();
    assert.equal(await current(), '1');
    const stop = el('#plan [data-open]').first();
    const id = await stop.getAttribute('data-open');
    await stop.click();
    assert.equal(await current(), id);
    await page.evaluate(() => { window.print = () => { window.printCalled = true; }; });
    await el('#print').click();
    assert.ok(await page.evaluate(() => window.printCalled));
    await page.emulateMedia({ media: 'print' });
    assert.ok(await el('#print-sheet').isVisible());
    assert.equal(await el('#print-sheet li').count(), 55);
  });
  await check(`Browser errors: ${consoleErrors.length} console, ${pageErrors.length} page`, () => {
    assert.deepEqual({ consoleErrors, pageErrors }, { consoleErrors: [], pageErrors: [] });
  });
  console.log('Browser verification run finished.');
} finally {
  await browser.close();
}
