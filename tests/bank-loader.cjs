'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('test/bank-loader.js', 'utf8');
const summary = {id: 'q1', file: 'doshchinsky-2027/v3.json'};
const data = {questions: [{id: 'q1', passageKey: 'first'}, {id: 'q2'}], passages: {first: {text: 'Общий текст'}}};
function setup(fetch) {
  const timers = new Set();
  const context = {window: {}, URL, AbortController, document: {currentScript: {src: 'https://example.test/site/test/bank-loader.js'}},
    fetch, setTimeout(fn, delay) {assert.equal(delay, 15000); timers.add(fn); return fn;}, clearTimeout(fn) {timers.delete(fn);}};
  vm.runInNewContext(source, context);
  return {load: context.window.EGE_EXAM_LOADER.load, timers};
}
(async () => {
  let calls = 0;
  const good = setup(async (url, options) => {
    calls++;
    assert.equal(String(url), 'https://example.test/site/test/doshchinsky-2027/v3.json');
    assert.equal(options.signal.aborted, false);
    return {ok: true, json: async () => data};
  });
  const [first, second] = await Promise.all([good.load(summary), good.load({...summary, id: 'q2'})]);
  assert.equal(calls, 1);
  assert.equal(first.passage, 'Общий текст');
  assert.equal(second.passage, '');
  assert.equal(good.timers.size, 0);
  await assert.rejects(good.load({...summary, id: 'missing'}), /не найдено/);
  for (const file of ['https://evil.test/v3.json', '//evil.test/v3.json', '../content.js', 'doshchinsky-2027/v2.json', 'doshchinsky-2026/v37.json', undefined]) {
    await assert.rejects(good.load({...summary, file}), /путь/);
  }
  assert.equal(calls, 1, 'invalid paths must never reach fetch');
  const inline = {prompt: 'Своё задание'};
  assert.equal(await good.load(inline), inline);
  for (const failure of ['http', 'json', 'network', 'timeout']) {
    let attempt = 0;
    const retry = setup(async (_url, {signal}) => {
      if (++attempt > 1) return {ok: true, json: async () => data};
      if (failure === 'timeout') return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
      if (failure === 'network') throw new Error('offline');
      return {ok: failure !== 'http', json: async () => {throw new Error('invalid JSON');}};
    });
    const pending = assert.rejects(retry.load(summary));
    if (failure === 'timeout') for (const fire of retry.timers) fire();
    await pending;
    assert.equal(retry.timers.size, 0);
    assert.equal((await retry.load(summary)).id, 'q1');
    assert.equal(attempt, 2, failure + ' must be retryable');
  }
  console.log('Loader: shared requests, timeout, retries, indexed lookup and bounded same-origin paths OK');
})().catch(error => {console.error(error); process.exitCode = 1;});
