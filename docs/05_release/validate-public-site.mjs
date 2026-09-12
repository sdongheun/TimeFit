import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootUrl = new URL('./public-site/', import.meta.url);
const root = fileURLToPath(rootUrl);
const expected = new Set([
  '_headers',
  '_redirects',
  'robots.txt',
  'assets/styles.css',
  'privacy/index.html',
  'terms/index.html',
  'support/index.html',
]);

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else result.push(path);
  }
  return result;
}

const actualPaths = (await files(root)).map(path => relative(root, path)).sort();
const actual = new Set(actualPaths);
for (const path of expected) if (!actual.has(path)) throw new Error(`missing_public_file:${path}`);
for (const path of actual) if (!expected.has(path)) throw new Error(`unexpected_public_file:${path}`);

const pages = ['privacy/index.html', 'terms/index.html', 'support/index.html'];
const banned = [/\[확정 필요/u, /\[확인 필요/u, /내부 편집 메모/u, /example\.(?:com|org|invalid)/u, /EXPO_PUBLIC_/u, /SUPABASE_SERVICE_ROLE/u, /<script\b/iu];
for (const path of pages) {
  const html = await readFile(new URL(path, rootUrl), 'utf8');
  for (const pattern of banned) if (pattern.test(html)) throw new Error(`banned_public_content:${path}:${pattern}`);
  for (const required of ['lang="ko"', 'name="viewport"', '<title>', 'href="mailto:sdongheun@gmail.com"', '개인정보 처리방침', '이용약관', '지원']) {
    if (!html.includes(required)) throw new Error(`missing_page_contract:${path}:${required}`);
  }
  if ((html.match(/<h1>/g) ?? []).length !== 1) throw new Error(`invalid_h1:${path}`);
}

const headers = await readFile(new URL('_headers', rootUrl), 'utf8');
for (const required of ['Content-Security-Policy', 'Referrer-Policy', 'X-Content-Type-Options', 'Permissions-Policy']) {
  if (!headers.includes(required)) throw new Error(`missing_header:${required}`);
}

console.log(JSON.stringify({ ok: true, publicFiles: actualPaths, pages, version: '1.0' }, null, 2));
