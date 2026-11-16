'use strict';
// npm install --no-save --package-lock=false playwright@1.57.0
// npx playwright install chromium && node tests/browser.js
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const types = {'.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) throw new Error('Invalid path');
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    response.end(await fs.readFile(file));
  } catch {response.writeHead(404); response.end();}
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({headless: true, ...(process.env.BROWSER_EXECUTABLE ? {executablePath: process.env.BROWSER_EXECUTABLE} : {})});
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of ['/', '/test/', '/feed/', '/theory/', '/versions/']) {
      await page.goto(base + route);
      await page.evaluate(() => document.fonts.ready);
      if (route !== '/versions/') {
        await page.setViewportSize({width: 911, height: 850});
        const toggle = page.getByRole('button', {name: 'Меню разделов'});
        await toggle.click();
        assert.equal(await page.locator('#section-nav a:visible').count(), 3);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#section-nav').isVisible(), false);
        assert(await toggle.evaluate(el => el === document.activeElement));
        await page.setViewportSize({width: 1280, height: 900});
        await page.locator('#section-nav').waitFor();
        assert.equal(await page.locator('#section-nav a:visible').count(), 4);
      }
      for (const width of [320, 360, 390, 520, 680, 681, 768, 900, 911, 1000, 1024, 1200, 1440, 1920]) {
        await page.setViewportSize({width, height: 900});
        for (const size of ['100%', '200%']) {
          const layout = await page.evaluate(async size => {
            document.documentElement.style.fontSize = size;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const heading = document.querySelector('.poster-hero h1').getBoundingClientRect();
            return {overflow: document.documentElement.scrollWidth > innerWidth + 1,
              wide: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => el.tagName + '.' + el.className),
              overlap: [...document.querySelectorAll('.poster-hero .mode-nav a, .nav-toggle')].some(link => {
                const rect = link.getBoundingClientRect();
                return Math.min(heading.right, rect.right) - Math.max(heading.left, rect.left) > 1 &&
                  Math.min(heading.bottom, rect.bottom) - Math.max(heading.top, rect.top) > 1;
              })};
          }, size);
          assert.equal(layout.overlap, false, route + ' heading overlap at ' + width + '/' + size);
          assert.equal(layout.overflow, false, route + ' horizontal overflow at ' + width + '/' + size + ': ' + layout.wide.join(', '));
        }
      }
    }
    await page.setViewportSize({width: 911, height: 850});
    await page.goto(base);
    assert((await page.locator('h1').innerText()).includes('РУСА ЛИНГВО'));
    if (process.env.SCREENSHOT_PATH) await page.screenshot({path: process.env.SCREENSHOT_PATH});
    await page.setViewportSize({width: 1280, height: 900});
    await page.goto(base);
    await page.locator('#options button, #word button').first().waitFor();
    await page.locator('#options button, #word button').first().click();
    if (await page.locator('#check-answer').isVisible()) await page.locator('#check-answer').click();
    await page.waitForFunction(() => Number(document.querySelector('#correct').textContent) + Number(document.querySelector('#wrong').textContent) === 1);
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('.woff2'))));
    assert(!await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('.ttf'))));

    await page.goto(base + '/feed/');
    await page.waitForFunction(() => document.querySelector('#feed').children.length >= 8);
    const headings = page.locator('#feed h2');
    const firstBatch = await headings.allTextContents();
    await page.locator('#more').evaluate(button => button.click());
    await page.waitForFunction(count => document.querySelectorAll('#feed h2').length > count, firstBatch.length);
    const loaded = await headings.allTextContents();
    assert.deepEqual(loaded.slice(0, firstBatch.length), firstBatch);
    assert.equal(new Set(loaded).size, loaded.length);
    const answer = await page.evaluate(async () => {
      const summary = window.EGE_EXERCISES.bank.find(q => String(q.displayId) === document.querySelector('#feed h2').textContent.split('#').pop());
      return (await window.EGE_EXAM_LOADER.load(summary)).answers[0];
    });
    await page.locator('#feed input').first().fill(answer);
    await page.locator('#feed form').first().evaluate(form => form.requestSubmit());
    await page.locator('#feed [data-result="correct"]').first().waitFor();
    await page.locator('#search-id').fill('992');
    await page.locator('#search').evaluate(form => form.requestSubmit());
    const explanation = page.locator('#feed .answer-review');
    await page.waitForFunction(() => document.querySelector('#feed h2')?.textContent.endsWith('#992'));
    assert.equal(await explanation.isVisible(), false, 'No explanation before checking');
    await page.locator('#feed input').fill('24');
    await page.locator('#feed form').evaluate(form => form.requestSubmit());
    assert((await explanation.locator('.review-answer').innerText()).includes('24'));
    assert((await explanation.innerText()).includes('прИнятый'));
    assert(await explanation.locator('.explanation-sources a').count());
    await page.locator('#feed input').fill('2');
    assert.equal(await explanation.isVisible(), false, 'Hide explanation while editing');
    await page.locator('#feed form').evaluate(form => form.requestSubmit());
    assert((await explanation.locator('.review-answer').innerText()).includes('24'));
    assert((await explanation.innerText()).includes('прИнятый'));

    await page.goto(base + '/test/');
    // Force one known lazy variant for a deterministic review in the real UI.
    await page.evaluate(() => {
      const bank = window.EGE_EXERCISES.bank;
      const question = bank.find(q => q.id === 'doshchinsky-2027-v3-q11');
      bank.splice(0, bank.length, question);
    });
    await page.locator('#clear-all').click();
    await page.locator('#task-picker input[value="11"]').check();
    await page.locator('#start').click();
    await page.waitForFunction(() => !document.querySelector('#session').hidden);
    assert((await page.locator('#question').innerText()).length > 10);
    await page.locator('#answer').fill('125');
    await page.locator('#finish').click();
    await page.locator('#confirm-finish').click();
    await page.locator('#result-rows .rule-toggle').click();
    assert((await page.locator('.review-explanation').innerText()).includes('Ковшик'));
    assert(await page.locator('.review-explanation .explanation-sources a').count());
    const rendered = await page.evaluate(() => {
      const node = document.createElement('div');
      window.EGE_EXERCISES.renderExplanation(node, {explanation: '<img src=x onerror=alert(1)>', explanationSources: [
        {title: 'bad', url: 'javascript:alert(1)'}, {title: 'bad', url: 'https://u:p@example.test'},
        {title: '<script>', url: 'https://gramota.ru/'}, {title: 'bad', url: '//example.test'}]});
      return {links: node.querySelectorAll('a').length, images: node.querySelectorAll('img').length, text: node.textContent};
    });
    assert.equal(rendered.links, 1);
    assert.equal(rendered.images, 0);
    assert(rendered.text.includes('<img'));
    await page.goto(base + '/theory/#task-11');
    assert(await page.locator('#task-11').isVisible());

    await page.goto(base + '/edit/');
    await page.waitForFunction(() => document.querySelector('#editor').contentEditable === 'true');
    await page.evaluate(() => {
      const editor = document.querySelector('#editor');
      editor.focus();
      const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/html', '<p onclick="window.compromised=1">SANITIZER-MARKER <strong>Текст</strong><a href="javascript:alert(1)">Ссылка</a><img src=x onerror="window.compromised=1"><script>window.compromised=1</script><iframe srcdoc="bad"></iframe><svg onload="window.compromised=1"></svg></p>');
      editor.dispatchEvent(new ClipboardEvent('paste', {clipboardData, bubbles: true, cancelable: true}));
    });
    const inspect = () => page.evaluate(() => {
      const editor = document.querySelector('#editor');
      return {text: editor.textContent, unsafe: Boolean(editor.querySelector('script,img,iframe,svg,[onclick],[onerror],a[href^="javascript:"]')), compromised: Boolean(window.compromised), stored: localStorage.getItem('russian-theory-editor-v1')};
    });
    let state = await inspect();
    assert(state.text.includes('SANITIZER-MARKER'));
    assert.equal(state.unsafe, false);
    assert.equal(state.compromised, false);
    assert(state.stored.includes('SANITIZER-MARKER'));
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#editor').contentEditable === 'true');
    state = await inspect();
    assert(state.text.includes('SANITIZER-MARKER'));
    assert.equal(state.unsafe, false);
    const download = page.waitForEvent('download');
    await page.locator('#download').click();
    const exported = JSON.parse(await fs.readFile(await (await download).path(), 'utf8'));
    assert(exported.chapters[0].editedHTML.includes('SANITIZER-MARKER'));
    assert(!/<script|<iframe|<img|onclick=|javascript:/i.test(exported.chapters[0].editedHTML));
    assert.deepEqual(errors, []);
    console.log('Browser: responsive mastheads (14 widths, 2 text sizes, 5 pages), brand, feed/exam explanations and safe source links; card, WOFF2, theory and editor flows OK');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
