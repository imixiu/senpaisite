// Fix article title (50-60 chars) and description (150-160 chars) via LLM
const fs = require('fs');
const https = require('https');

function loadEnv(f){const e={};for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^([^#=]+)=(.*)/);if(m)e[m[1].trim()]=m[2].trim().replace(/^"(.*)"$/,'$1');}return e;}
const localEnv = loadEnv('/root/vercel-projects/senpaisite/.env.local');
const hermesEnv = loadEnv('/root/.hermes/profiles/new-site-worker/.env');
const { neon } = require('@neondatabase/serverless');
const sql = neon(localEnv.DATABASE_URL);
const DASHSCOPE_KEY = hermesEnv.DASHSCOPE_API_KEY;
const log = m => process.stderr.write(m + '\n');
const CONCURRENCY = 10;

function callQwen(messages, maxTokens = 256) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: 'qwen-plus', messages, max_tokens: maxTokens, temperature: 0.5 });
    const req = https.request('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DASHSCOPE_KEY }
    }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => {
        try { const j = JSON.parse(data); if (j.error) reject(new Error(j.error.message)); else resolve(j.choices[0].message.content); }
        catch (e) { reject(new Error('Parse: ' + data.substring(0, 150))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body); req.end();
  });
}

async function fixOne(article) {
  const { id, body_text, original_title } = article;
  
  // Extract first ~500 chars of article content for context
  const contentPreview = (body_text || '').replace(/<[^>]+>/g, '').trim().substring(0, 500);
  
  const prompt = `Based on this article content, generate:
1. An SEO title tag (50-60 characters exactly, including spaces). Must be compelling, include the main keyword, and work as a standalone Google search result title. Do NOT use quotes around anime/manga names — just write them plainly.
2. A meta description (150-160 characters exactly, including spaces). Must summarize the article's key point, include a call to action or value proposition, and entice clicks.

Article topic: ${original_title}
Article content preview: ${contentPreview}

Output ONLY a JSON object with two keys, no other text:
{"title": "...", "description": "..."}`;

  const result = await callQwen([{ role: 'user', content: prompt }]);
  
  try {
    const cleaned = result.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    const title = parsed.title || '';
    const description = parsed.description || '';
    
    // Validate lengths
    if (title.length < 45 || title.length > 65) {
      log(`  [${id}] Title length ${title.length}: "${title}"`);
    }
    if (description.length < 140 || description.length > 165) {
      log(`  [${id}] Desc length ${description.length}: "${description}"`);
    }
    
    return { id, title, description, tlen: title.length, dlen: description.length };
  } catch (e) {
    log(`  [${id}] Parse error: ${e.message} | Raw: ${result.substring(0, 100)}`);
    return null;
  }
}

async function workerPool(tasks, poolSize, fn) {
  let nextIdx = 0, ok = 0, fail = 0;
  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      const result = await fn(tasks[idx]);
      if (result) {
        try {
          await sql`UPDATE articles SET title = ${result.title}, description = ${result.description} WHERE id = ${result.id}`;
          ok++;
        } catch (e) {
          fail++;
          log(`  [${result.id}] DB error: ${e.message.substring(0, 80)}`);
          continue;
        }
      } else {
        fail++;
        continue;
      }
      const done = ok + fail;
      if (done % 50 === 0 || done === tasks.length) {
        log(`[${done}/${tasks.length}] OK=${ok} FAIL=${fail}`);
      }
    }
  }
  const workers = [];
  for (let i = 0; i < poolSize; i++) workers.push(worker());
  await Promise.all(workers);
  return { ok, fail };
}

async function main() {
  const articles = await sql`SELECT id, body as body_text, title as original_title FROM articles WHERE site='senpaisite' AND is_online='Y' ORDER BY id`;
  
  log('=== Fix Title & Description ===');
  log('Articles: ' + articles.length);
  log('Target: title 50-60 chars, description 150-160 chars');
  
  const start = Date.now();
  const { ok, fail } = await workerPool(articles, CONCURRENCY, fixOne);
  const elapsed = ((Date.now() - start) / 1000).toFixed(0);
  
  log('\n=== Complete ===');
  log('Updated: ' + ok + ' | Failed: ' + fail + ' | Time: ' + elapsed + 's');
  
  // Stats
  const stats = await sql`SELECT 
    round(avg(length(title)))::int as avg_t, min(length(title))::int as min_t, max(length(title))::int as max_t,
    round(avg(length(description)))::int as avg_d, min(length(description))::int as min_d, max(length(description))::int as max_d
  FROM articles WHERE site='senpaisite' AND is_online='Y'`;
  log('Title avg/min/max: ' + stats[0].avg_t + '/' + stats[0].min_t + '/' + stats[0].max_t);
  log('Desc avg/min/max: ' + stats[0].avg_d + '/' + stats[0].min_d + '/' + stats[0].max_d);
}

main().catch(e => { log('Fatal: ' + e.message); process.exit(1); });
