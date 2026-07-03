// 번들 HTML(자기추출형)에서 실제 페이지/에셋을 추출
import fs from 'node:fs';
import zlib from 'node:zlib';

const src = fs.readFileSync('docs/reports/TimeFit 와이어프레임 (standalone).html', 'utf-8');
const grab = (type) => {
  const re = new RegExp(`<script type="__bundler/${type}">([\\s\\S]*?)</script>`);
  const m = src.match(re);
  return m ? m[1].trim() : null;
};

const manifest = JSON.parse(grab('manifest') || '{}');
let template = JSON.parse(grab('template') || '""');

console.log('manifest 에셋 수:', Object.keys(manifest).length);
fs.mkdirSync('tmp_wireframe', { recursive: true });

for (const [uuid, entry] of Object.entries(manifest)) {
  let bytes = Buffer.from(entry.data, 'base64');
  if (entry.compressed) bytes = zlib.gunzipSync(bytes);
  const mime = entry.mimeType || entry.type || 'unknown';
  const ext = mime.includes('html') ? 'html' : mime.includes('css') ? 'css' : mime.includes('javascript') ? 'js' : mime.includes('svg') ? 'svg' : mime.includes('png') ? 'png' : 'bin';
  const fname = `tmp_wireframe/${uuid.slice(0, 8)}.${ext}`;
  fs.writeFileSync(fname, bytes);
  console.log(` ${fname}  ${mime}  ${bytes.length}b`);
}

// template 자체가 페이지 HTML일 수 있음
if (typeof template === 'string' && template.length > 100) {
  fs.writeFileSync('tmp_wireframe/template.html', template);
  console.log(' tmp_wireframe/template.html', template.length + 'b');
}
