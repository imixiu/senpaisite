const { Client } = require('pg');
const { put } = require('@vercel/blob');
const https = require('https');
const http = require('http');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const QWEN_KEY = 'sk-b11580cc1fec4c2a814a8a97e3dfd7d1';

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

async function qwenImage(title) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'qwen-image-plus',
      input: { messages: [{ role: 'user', content: [{ text: `Professional blog cover image for: "${title}". Anime/manga theme, editorial style, no text overlay.` }] }] },
      parameters: { size: '1024*576' }
    });
    const req = https.request({
      hostname: 'dashscope.aliyuncs.com',
      path: '/api/v1/services/aigc/multimodal-generation/generation',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${QWEN_KEY}`, 'Content-Type': 'application/json' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d).output?.choices?.[0]?.message?.content?.[0]?.image || null); }
        catch { resolve(null); }
      });
    });
    req.write(body);
    req.end();
  });
}

async function uploadToBlob(srcUrl, slug) {
  const tmp = `/tmp/img-${slug}.jpg`;
  for (let i = 0; i < 3; i++) {
    try {
      await download(srcUrl, tmp);
      break;
    } catch(e) {
      if (i === 2) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  const data = fs.readFileSync(tmp);
  const ext = srcUrl.includes('.png') ? 'png' : 'jpg';
  const r = await put(`covers/senpaisite/${slug}.${ext}`, data, { access: 'public', token: BLOB_TOKEN, contentType: `image/${ext}` });
  try { fs.unlinkSync(tmp); } catch {}
  return r.url;
}

async function main() {
  const articles = JSON.parse(fs.readFileSync('/tmp/no-img-articles.json'));
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let done = 0, failed = 0;
  for (const a of articles) {
    try {
      let srcUrl = a.img; // alicdn url or null
      if (!srcUrl) {
        srcUrl = await qwenImage(a.title || a.short_title);
        if (!srcUrl) { failed++; continue; }
      }
      const fileSlug = String(a.id);
      const blobUrl = await uploadToBlob(srcUrl, fileSlug);
      await client.query('UPDATE articles SET img=$1 WHERE id=$2', [blobUrl, a.id]);
      done++;
      if (done % 10 === 0) process.stderr.write(`${done}/${articles.length} done, ${failed} failed\n`);
    } catch(e) {
      process.stdout.write(`FAIL ${a.short_title}: ${e.message}\n`);
      failed++;
    }
  }
  process.stderr.write(`Done: ${done} updated, ${failed} failed\n`);
  await client.end();
}
main();
