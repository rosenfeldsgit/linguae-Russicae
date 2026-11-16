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
    await page.goto(base);
    await page.locator('#options button, #word button').first().waitFor();
    await page.locator('#options button, #word button').first().click();
    await page.waitForFunction(() => Number(document.querySelector('#correct').textContent) + Number(document.querySelector('#wrong').textContent) === 1);
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('.woff2'))));
    assert(!await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('.ttf'))));

    await page.goto(base + '/feed/');
    await page.waitForFunction(() => document.querySelector('#feed').children.length >= 8);
    const answer = await page.evaluate(async () => {
      const summary = window.EGE_EXERCISES.bank.filter(q => /^doshchinsky-202[67]-v\d+-q\d+$/.test(q.id)).sort((a, b) => a.displayId - b.displayId)[0];
      return (await window.EGE_EXAM_LOADER.load(summary)).answers[0];
    });
    await page.locator('#feed input').first().fill(answer);
    await page.locator('#feed form').first().evaluate(form => form.requestSubmit());
    await page.locator('#feed [data-result="correct"]').first().waitFor();
    await page.goto(base + '/test/');
    await page.locator('#start').click();
    await page.waitForFunction(() => !document.querySelector('#session').hidden);
    assert((await page.locator('#question').innerText()).length > 10);
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
    console.log('Browser: card answer, WOFF2, feed scoring, exam start, theory, sanitized paste, draft restore and export OK');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
