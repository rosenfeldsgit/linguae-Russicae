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
    if (/\.(css|js|woff2)$/.test(file)) response.setHeader('Cache-Control', 'public, max-age=600');
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
      const entrance = page.locator(({
        '/': '.practice-main', '/test/': '#setup', '/feed/': '.filters',
        '/theory/': '#catalog', '/versions/': '.release-list'
      })[route]);
      await page.emulateMedia({reducedMotion: 'no-preference'});
      assert.equal(await entrance.evaluate(el => getComputedStyle(el).animationName), 'section-rise');
      await entrance.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
      assert.equal(await entrance.evaluate(el => getComputedStyle(el).transform), 'none');
      await page.emulateMedia({reducedMotion: 'reduce'});
      assert.equal(await entrance.evaluate(el => getComputedStyle(el).animationName), 'none');
      assert.equal(await page.locator('.poster-hero h1').evaluate(el => getComputedStyle(el).animationName), 'none');
      await page.emulateMedia({reducedMotion: 'no-preference'});
      if (route !== '/versions/') {
        await page.setViewportSize({width: 911, height: 850});
        const toggle = page.getByRole('button', {name: 'Меню разделов'});
        await toggle.click();
        assert.equal(await page.locator('#section-nav a:visible').count(), 4);
        const currentSection = page.locator('#section-nav a[aria-current=page]');
        assert.equal(await currentSection.count(), 1);
        assert(await currentSection.isVisible());
        assert(await currentSection.evaluate(el => getComputedStyle(el).backgroundColor !==
          getComputedStyle(el.parentElement.querySelector('a:not([aria-current])')).backgroundColor));
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
            window.scrollTo({left: 0, behavior: 'instant'});
            const heading = document.querySelector('.poster-hero h1').getBoundingClientRect();
            return {overflow: document.documentElement.scrollWidth > innerWidth + 1,
              wide: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1).slice(0, 8).map(el => el.tagName + '.' + el.className + '(' + el.clientWidth + '/' + el.scrollWidth + ')'),
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
    assert.deepEqual(await page.locator('#sections button').allTextContents(),
      ['Все подряд', '1', '5', '9', '10', '11', '12', '13', '14', '15', 'Ударение', 'Пунктуация']);
    const historyTab = page.context().waitForEvent('page');
    await page.getByRole('link', {name: /История изменений/}).click();
    const history = await historyTab;
    await history.waitForURL(base + '/versions/');
    await history.locator('.release-list').waitFor();
    assert.equal(page.url(), base + '/');
    assert.equal(await page.locator('dialog').count(), 0);
    await history.close();
    if (process.env.SCREENSHOT_PATH) await page.screenshot({path: process.env.SCREENSHOT_PATH});
    await page.setViewportSize({width: 1280, height: 900});
    await page.goto(base);
    const motion = await page.evaluate(async () => {
      const panel = document.querySelector('.practice-main');
      await Promise.all(panel.getAnimations().map(animation => animation.finished));
      document.querySelector('#sections button[data-section="9"]').click();
      const switched = panel.getAnimations().length;
      document.querySelector('#sections button[data-section="10"]').click();
      const rapidSwitch = panel.getAnimations().length;
      await Promise.all(panel.getAnimations().map(animation => animation.finished));
      document.querySelector('#skip').click();
      return {switched, rapidSwitch, nextCard: panel.getAnimations().length};
    });
    assert.deepEqual(motion, {switched: 1, rapidSwitch: 1, nextCard: 0});
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.locator('#sections button[data-section="9"]').click();
    assert.equal(await page.locator('.practice-main').evaluate(el => el.getAnimations().length), 0);
    await page.emulateMedia({reducedMotion: 'no-preference'});
    const section = page.locator('#section-nav a[href="test/"]');
    await section.focus();
    assert.equal(await page.locator('link[rel=prefetch]').count(), 1);
    assert.equal(await page.locator('link[rel=prefetch]').getAttribute('href'), base + '/test/');
    await section.blur();
    await section.focus();
    assert.equal(await page.locator('link[rel=prefetch]').count(), 1);
    await page.locator('#options button, #word button').first().waitFor();
    await page.locator('#options button, #word button').first().click();
    if (await page.locator('#check-answer').isVisible()) await page.locator('#check-answer').click();
    await page.waitForFunction(() => Number(document.querySelector('#correct').textContent) + Number(document.querySelector('#wrong').textContent) === 1);
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('.woff2'))));
    assert(!await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('.ttf'))));

    await page.goto(base + '/feed/');
    assert.equal(await page.evaluate(() => performance.getEntriesByType('resource')
      .find(entry => entry.name.endsWith('/styles.css?v=cleanup1')).transferSize), 0,
      'Shared stylesheet is reused from the browser cache');
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
    await page.evaluate(() => { Math.random = () => 0.035; });
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

    await page.locator('#restart').click();
    const ready = page.getByRole('button', {name: 'Начать вариант — Демоверсия ЕГЭ 2027'});
    const variantUrl = '**/test/ready-variants/fipi-2027-demo.json';
    await page.route(variantUrl, route => route.fulfill({status: 503}), {times: 1});
    await ready.click();
    await page.waitForFunction(() => document.querySelector('#ready-variant-error').textContent.includes('Попробуйте'));
    await ready.click();
    await page.locator('#session').waitFor();
    assert.equal(await page.locator('#task-nav button').count(), 27);
    assert.equal(await page.locator('#ready-variants').isVisible(), false);
    await page.locator('#answer').fill('эти');
    await page.getByRole('button', {name: 'Задание 27', exact: true}).click();
    assert(await page.locator('#passage').isVisible());
    await page.locator('#passage button').click();
    assert(await page.locator('#question').isVisible());
    const essay = 'Первый абзац.\n\nВторой абзац.';
    await page.getByRole('textbox', {name: 'Сочинение'}).fill(essay);
    await page.getByRole('button', {name: 'Задание 1, ответ записан', exact: true}).click();
    assert.equal(await page.locator('#answer').inputValue(), 'эти');
    await page.getByRole('button', {name: 'Задание 27, ответ записан', exact: true}).click();
    assert.equal(await page.locator('#essay').inputValue(), essay);
    await page.locator('#finish').click();
    await page.locator('#confirm-finish').click();
    assert.match(await page.locator('#result-summary').textContent(), /1 из 28/);
    assert.equal(await page.locator('#essay-submission').textContent(), essay);
    assert.match(await page.locator('#essay-criteria').getAttribute('href'), /^https:\/\/fipi\.ru\//);
    await page.locator('#restart').click();
    assert(await ready.evaluate(button => button === document.activeElement));

    for (const [year, random, variant, keyPage] of [[2027, 0.035, 3, 327], [2026, 0.49, 1, 342]]) {
      await page.goto(base + '/test/?task=27');
      await page.evaluate(value => { Math.random = () => value; }, random);
      await page.locator('#task-picker input[value="23"]').check();
      await page.locator('#start').click();
      await page.locator('#task-nav button').last().waitFor();
      const shared = await page.locator('#passage .passage').textContent();
      assert.doesNotMatch(shared, /Напишите сочинение/);
      assert.match(await page.locator('#source').textContent(), new RegExp(`Дощинского ${year}`));
      await page.getByRole('button', {name: 'Задание 27', exact: true}).click();
      assert.equal(await page.locator('#passage .passage').textContent(), shared);
      assert(await page.locator('#essay-draft-download').isDisabled());
      assert.equal(await page.locator('#essay-info').isVisible(), false);
      await page.getByRole('textbox', {name: 'Сочинение'}).fill(essay);
      const draft = page.waitForEvent('download');
      await page.locator('#essay-draft-download').click();
      assert.equal((await draft).suggestedFilename(), `sochinenie-${year}-variant-${variant}.docx`);
      await page.locator('#finish').click();
      await page.locator('#confirm-finish').click();
      assert.equal(await page.locator('#essay-submission').textContent(), essay);
      assert.equal(await page.locator('#essay-author-position').isVisible(), false);
      await page.locator('#essay-info summary').click();
      assert((await page.locator('#essay-author-position').textContent()).length > 50);
      assert.match(await page.locator('#essay-key').textContent(), new RegExp(String(keyPage)));
      assert.match(await page.locator('#essay-key').getAttribute('href'), /^https:\/\/www\.nobr\.ru\//);
      const result = page.waitForEvent('download');
      await page.locator('#essay-result-download').click();
      const downloaded = await result;
      assert.equal(downloaded.suggestedFilename(), `sochinenie-${year}-variant-${variant}.docx`);
      const docx = await fs.readFile(await downloaded.path());
      assert.equal(docx.readUInt32LE(0), 0x04034b50);
      assert(docx.includes(Buffer.from('Первый абзац.</w:t></w:r></w:p>')));
      assert(docx.includes(Buffer.from('Второй абзац.</w:t></w:r></w:p>')));
      assert(!docx.includes(Buffer.from(await page.locator('#essay-author-position').textContent())));
    }

    await page.goto(base + '/feed/');
    await page.locator('#search-id').fill('1899');
    await page.locator('#search').evaluate(form => form.requestSubmit());
    await page.getByRole('textbox', {name: 'Сочинение'}).fill(essay);
    assert.match(await page.locator('#feed h2').textContent(), /Задание 27 · #1899/);
    await page.locator('#search').evaluate(form => form.requestSubmit());
    await page.getByRole('textbox', {name: 'Сочинение'}).waitFor();
    assert.equal(await page.getByRole('textbox', {name: 'Сочинение'}).inputValue(), essay);

    await page.evaluate(() => localStorage.setItem('rusa-lingvo-theme', 'system'));
    await page.emulateMedia({colorScheme: 'dark'});
    await page.goto(base + '/test/');
    const theme = page.getByRole('button', {name: 'Тема: Светлая'});
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    const sun = await theme.locator('svg path').getAttribute('d');
    assert(sun);
    assert.equal(await theme.textContent(), '');
    const press = page.locator('#clear-all');
    const box = await press.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForFunction(() => getComputedStyle(document.getElementById('clear-all')).scale === '0.98');
    await page.mouse.up();
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.mouse.down();
    assert.equal(await press.evaluate(button => getComputedStyle(button).scale), 'none');
    await page.mouse.up();
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await theme.press('Enter');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    const moon = await page.getByRole('button', {name: 'Тема: Тёмная'}).locator('svg path').getAttribute('d');
    assert(moon && moon !== sun);
    await page.goto(base + '/feed/');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.locator('#search-id').fill('1972');
    await page.locator('#search').evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => document.querySelector('#feed h2')?.textContent.endsWith('#1972'));
    assert.match(await page.locator('#feed .source').textContent(), /СтатГрад.*17\.09\.2026.*РЯ2610101/);
    await page.emulateMedia({colorScheme: 'light'});
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.getByRole('button', {name: 'Тема: Тёмная'}).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.getByRole('button', {name: 'Тема: Светлая'}).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');

    await page.goto(base + '/test/');
    await page.getByRole('button', {name: 'Для печати — СтатГрад · 17.09.2026 · РЯ2610102'}).click();
    const print = page.getByRole('dialog', {name: 'Материалы для печати'});
    const preview = page.frameLocator('#print-page');
    await preview.getByRole('heading', {name: 'СтатГрад · 17.09.2026 · РЯ2610102'}).waitFor();
    assert.equal(await preview.locator('.question-number').count(), 27);
    assert.equal(await preview.locator('.passage').count(), 2);
    assert.doesNotMatch(await preview.locator('main').innerText(), /Позиция автора по ключу|95876/);
    assert.equal(await print.getByRole('combobox').count(), 0);
    assert.equal(await print.getByRole('button', {name: 'Скачать HTML'}).count(), 0);
    assert.equal(await preview.locator('.answer-row').count(), 0);
    await print.getByRole('button', {name: 'Закрыть материалы для печати'}).click();

    await page.getByRole('button', {name: 'Бланки ответов для печати'}).click();
    await preview.getByRole('heading', {name: 'Бланк ответов № 1'}).waitFor();
    assert.equal(await preview.locator('.question-number').count(), 0);
    assert.equal(await preview.locator('.answer-row').count(), 26);
    assert.equal(await preview.locator('.essay-line').count(), 60);
    const printableHtml = await page.locator('#print-page').getAttribute('srcdoc');
    assert.match(printableHtml, /@page \{ size: A4/);
    await page.locator('#print-page').evaluate(frame => {
      frame.contentWindow.print = () => { frame.dataset.printed = 'true'; };
    });
    await print.getByRole('button', {name: 'Печать / PDF'}).click();
    assert.equal(await page.locator('#print-page').getAttribute('data-printed'), 'true');
    await print.getByRole('button', {name: 'Закрыть материалы для печати'}).click();
    assert.equal(await page.locator('#session').isVisible(), false, 'Print preview must not start the clock');

    await page.goto(base + '/?task=27');
    const demoCardAnswer = page.getByRole('button', {name: 'Родина даёт силы пережить трудности'});
    await page.locator('#options button').first().waitFor();
    for (let i = 0; i < 2 && !await demoCardAnswer.isVisible(); i++) {
      assert.match(await page.locator('#card-source').textContent(), /СтатГрад.*17\.09\.2026/);
      await page.locator('#skip').click();
    }
    await page.locator('#options .option').filter({hasNotText: 'Родина даёт силы пережить трудности'}).first().click();
    await page.waitForFunction(() => {
      const correct = document.querySelector('#options .right');
      const incorrect = document.querySelector('#options .wrong');
      return correct && incorrect &&
        getComputedStyle(correct).backgroundColor === 'rgb(99, 237, 145)' &&
        getComputedStyle(incorrect).backgroundColor === 'rgb(255, 138, 123)';
    });
    await page.getByRole('button', {name: 'Пояснение к ответу'}).click();
    assert.match(await page.locator('.rule-note').innerText(), /Второй пример конкретизирует первый/);
    assert.doesNotMatch(await page.locator('.rule-note').innerText(), /ФИПИ|демоверсия/i);

    await page.goto(base + '/theory/#task-11');
    assert(await page.locator('#task-11').isVisible());
    assert.equal(await page.locator('.chapters article').evaluateAll(chapters => chapters.filter(chapter => {
      const practice = chapter.querySelector('.practice-link');
      const sources = [...chapter.querySelectorAll('h3')].find(heading => heading.textContent === 'Источники');
      return practice && sources && (practice.compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING);
    }).length), 27);

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
