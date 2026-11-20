import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

const source = readFileSync(new URL('../src/edagent/api.ts', import.meta.url), 'utf8')
  .replace('import.meta.env.VITE_EDAGENT_API_URL', "'https://test.invalid'");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function client(fetch) {
  const context = {
    exports: {}, AbortController, URLSearchParams, fetch,
    setTimeout: (fn) => setTimeout(fn, 10), clearTimeout,
  };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

test('deadline covers a stalled response body after headers arrive', async () => {
  const { api } = client(async (_url, { signal }) => ({
    ok: true,
    json: () => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }),
  }));
  await assert.rejects(api.models({ provider: 'gemini', model: 'gemini-3.1-flash-lite' }), { code: 'timeout' });
});

test('a model check can be cancelled before headers arrive', async () => {
  const { api } = client((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const controller = new AbortController();
  const request = api.models({ provider: 'gemini', model: 'auto' }, controller.signal);
  controller.abort();
  await assert.rejects(request, { code: 'timeout' });
});

test('row search keeps column/value out of URLs and sends no provider key', async () => {
  const { api } = client(async (url, init) => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.has('column'), false);
    assert.equal(parsed.searchParams.has('value'), false);
    assert.equal(parsed.searchParams.get('offset'), '100');
    assert.equal(init.method, 'POST');
    assert.deepEqual(JSON.parse(init.body), { column: 'Name & ID', value: 'A+B #1', match: 'eq' });
    assert.equal(init.headers['X-LLM-Api-Key'], undefined);
    return { ok: true, json: async () => ({ total: 1, rows_searched: 109, rows: [] }) };
  });
  const result = await api.rows('session', 100, 50, { column: 'Name & ID', value: 'A+B #1', match: 'eq' });
  assert.equal(result.rows_searched, 109);
});

test('Gemini presets and the requested default render without discovery', () => {
  const require = createRequire(import.meta.url);
  const chatSource = readFileSync(new URL('../src/edagent/Chat.tsx', import.meta.url), 'utf8');
  const chatCode = ts.transpileModule(chatSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const context = { exports: {}, require: (name) => {
    if (name === './api' || name === './ResultView') return {};
    if (name === '../components/ui') return Object.fromEntries(
      ['Badge', 'Callout', 'Disclosure', 'ErrorNote'].map((name) => [name, ({ children }) => React.createElement('div', null, children)]),
    );
    return require(name);
  } };
  vm.runInNewContext(chatCode, context);
  const html = renderToStaticMarkup(React.createElement(context.exports.Chat, {
    session: { results: [], overview: { kinds: {}, column_info: [] } },
    health: { ai: { server_configured: true, byok_allowed: false,
      providers: [{ id: 'gemini', label: 'Google Gemini', server_configured: true }] } },
    onResultsChange() {},
  }));
  assert.match(html, /value="gemini-3.1-flash-lite" selected=""/);
  assert.match(html, /value="gemini-3.5-flash-lite"/);
  assert.match(html, /value="gemini-3-flash-preview"/);
});
