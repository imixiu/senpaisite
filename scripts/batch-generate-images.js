// Batch generate article cover images via Qwen qwen-image-plus + upload to Vercel Blob
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

function loadEnv(f) {
  const e = {};
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = l.match(/^([^#=]+)=(.*)/);
    if (m) e[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return e;
}

const localEnv = loadEnv('/root/vercel-projects/senpaisite/.env.local');
const hermesEnv = loadEnv('/root/.hermes/profiles/new-site-worker/.env');
const DASHSCOPE_KEY = hermesEnv.DASHSCOPE_API_KEY;
const BLOB_TOKEN = localEnv.BLOB_READ_WRITE_TOKEN;

// Read VERCEL_TOKEN from .bashrc (background processes don't inherit it)
let VERCEL_AUTH_TOKEN = process.env.VERCEL_TOKEN || '';
if (!VERCEL_AUTH_TOKEN) {
  try {
    const bashrc = fs.readFileSync('/root/.bashrc', 'utf8');
    const m = bashrc.match(/export VERCEL_TOKEN="?([^"\n]+)"?/);
    if (m) VERCEL_AUTH_TOKEN = m[1];
  } catch {}
}
const { neon } = require('@neondatabase/serverless');
const sql = neon(localEnv.DATABASE_URL);
const log = m => process.stderr.write(m + '\n');
const CONCURRENCY = 5;

const TOPIC_PROMPTS = {
  'anime-reviews': 'anime screenshot, vibrant cel-shaded animation, dynamic scene, cinematic composition, professional editorial illustration',
  'anime reviews': 'anime screenshot, vibrant cel-shaded animation, dynamic scene, cinematic composition, professional editorial illustration',
  'manga-guides': 'manga art, black and white ink illustration, detailed pen work, dramatic panel composition, Japanese comic art',
  'manga guides': 'manga art, black and white ink illustration, detailed pen work, dramatic panel composition, Japanese comic art',
  'character-analysis': 'anime character portrait, expressive face, detailed illustration, emotional moment, vibrant colors, professional character art',
  'characters': 'anime character portrait, expressive face, detailed illustration, emotional moment, vibrant colors, professional character art',
  'otaku-culture': 'Japanese pop culture scene, anime merchandise, convention atmosphere, colorful fandom display, editorial photography style',
  'otaku culture': 'Japanese pop culture scene, anime merchandise, convention atmosphere, colorful fandom display, editorial photography style',
  'seasonal-anime': 'seasonal anime key visual, vibrant poster art, dynamic composition, Japanese animation studio quality, editorial illustration',
  'cosplay-fan': 'anime cosplay photography, detailed costume, creative fan art, convention setting, professional cosplay portrait',
  'power-scaling': 'epic anime battle scene, power energy aura, dynamic action pose, vibrant energy blasts, cinematic wide angle, professional editorial illustration',
  'lore': 'dark mysterious anime landscape, ancient ruins, mystical atmosphere, detailed world-building scene, cinematic lighting, professional editorial illustration',
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 60000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout')); });
  });
}

function callQwenImage(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'qwen-image-plus',
      input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
      parameters: { size: '1024*576' }
    });
    const req = https.request('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DASHSCOPE_KEY }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.code || j.message) return reject(new Error('API: ' + (j.message || j.code)));
          const imgUrl = j.output?.choices?.[0]?.message?.content?.[0]?.image;
          if (!imgUrl) return reject(new Error('No image URL'));
          resolve(imgUrl);
        } catch (e) { reject(new Error('Parse: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(180000, () => { req.destroy(); reject(new Error('Image gen timeout')); });
    req.write(body);
    req.end();
  });
}

function blobUpload(localPath, pathname) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(localPath);
    const options = {
      method: 'PUT',
      hostname: 'blob.vercel-storage.com',
      path: '/' + pathname,
      headers: {
        'Authorization': 'Bearer ' + BLOB_TOKEN,
        'Content-Type': 'image/png',
        'Content-Length': fileBuffer.length,
        'x-content-type': 'image/png',
        'x-cache-control-max-age': '31536000',
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const j = JSON.parse(data);
            resolve(j.url || ('https://9bwbxubcyu3vbaiq.public.blob.vercel-storage.com/' + pathname));
          } catch (e) { resolve('https://9bwbxubcyu3vbaiq.public.blob.vercel-storage.com/' + pathname); }
        } else { reject(new Error('Blob HTTP ' + res.statusCode + ': ' + data.substring(0, 100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Blob upload timeout')); });
    req.write(fileBuffer);
    req.end();
  });
}

async function processOne(article, idx) {
  const { id, short_title, type } = article;
  const typePrompt = TOPIC_PROMPTS[type] || TOPIC_PROMPTS[(type||'').toLowerCase()] || 'anime illustration, professional editorial art';
  const titleWords = short_title.replace(/-/g, ' ').substring(0, 80);
  const prompt = `Professional blog cover image for: "${titleWords}". ${typePrompt}. Clean, modern, no text overlay.`;

  let ossUrl, finalUrl;
  try {
    ossUrl = await callQwenImage(prompt);
  } catch (e) {
    // retry once
    try { ossUrl = await callQwenImage(prompt); } catch (e2) {
      return { ok: false, id, title: short_title, reason: 'gen: ' + e2.message.substring(0, 100) };
    }
  }

  if (BLOB_TOKEN) {
    try {
      const tmpPath = `/tmp/senpai-${crypto.randomUUID()}.png`;
      const buf = await fetchUrl(ossUrl);
      fs.writeFileSync(tmpPath, buf);
      finalUrl = await blobUpload(tmpPath, `covers/senpaisite/${short_title}.png`);
      fs.unlinkSync(tmpPath);
    } catch (e) {
      log(`  [${id}] Blob failed, using OSS: ${e.message.substring(0, 80)}`);
      finalUrl = ossUrl;
    }
  } else {
    finalUrl = ossUrl;
  }

  try {
    await sql`UPDATE articles SET img = ${finalUrl} WHERE id = ${id}`;
    return { ok: true, id, title: short_title };
  } catch (e) {
    return { ok: false, id, title: short_title, reason: 'db: ' + e.message.substring(0, 100) };
  }
}

// Simple worker pool
async function workerPool(tasks, poolSize, fn) {
  let nextIdx = 0, written = 0, failed = 0;
  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      const result = await fn(tasks[idx], idx);
      if (result.ok) written++; else failed++;
      const done = written + failed;
      if (done % 10 === 0 || done === 1 || done === tasks.length) {
        log(`[${done}/${tasks.length}] ${result.ok ? '✅' : '❌'} ${result.title}${!result.ok ? ' ' + result.reason : ''} | W:${written} F:${failed}`);
      }
    }
  }
  const workers = [];
  for (let i = 0; i < poolSize; i++) workers.push(worker());
  await Promise.all(workers);
  return { written, failed };
}

async function main() {
  const articles = await sql`SELECT id, short_title, type FROM articles WHERE site='senpaisite' AND (img IS NULL OR img='') ORDER BY id`;
  log('=== Cover Image Generation ===');
  log('Articles without images: ' + articles.length);
  log('Concurrency: ' + CONCURRENCY);
  log('Blob: ' + (BLOB_TOKEN ? 'YES' : 'NO'));

  const start = Date.now();
  const { written, failed } = await workerPool(articles, CONCURRENCY, processOne);
  const elapsed = ((Date.now() - start) / 60000).toFixed(1);

  log('\n=== Complete ===');
  log('Written: ' + written + ' | Failed: ' + failed + ' | Time: ' + elapsed + ' min');
}

main().catch(e => { log('Fatal: ' + e.message + '\n' + e.stack); process.exit(1); });
