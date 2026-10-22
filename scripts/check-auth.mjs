import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { testModules } from './test-support.mjs';
const modules = await testModules();
try {
  const { authDestination } = await modules.load('lib/auth-path');
  for (const input of [null, '//evil.example', 'https://evil.example', '/\\evil.example', '/auth/signout', '/%2f%2fevil.example']) assert.equal(authDestination(input), '/');
  assert.equal(authDestination('/auth/reset'), '/auth/reset');
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_only';
  const { default: AuthForm } = await modules.load('components/auth-form');
  for (const lang of ['ru', 'en', 'kk']) {
    const html = renderToStaticMarkup(createElement(AuthForm, { lang }));
    assert.ok(html.includes('type="email"') && html.includes('type="password"'));
    assert.ok(!html.includes('ChatGPT') && !html.includes('undefined'));
    const reset = renderToStaticMarkup(createElement(AuthForm, { lang, reset: true }));
    assert.ok(reset.includes('name="confirm"') && reset.includes('minLength="8"'));
  }
  console.log('Auth checks passed: safe callback destinations and form rendering in EN/RU/KK.');
} finally { await modules.close(); }
