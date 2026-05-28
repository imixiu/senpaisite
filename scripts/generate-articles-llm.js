// Phase 2+3: Generate articles via LLM with quality scoring
// Simple sequential pool with stderr logging
const fs = require('fs');
const https = require('https');

function loadEnv(f){const e={};for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^([^#=]+)=(.*)/);if(m)e[m[1].trim()]=m[2].trim();}return e;}
const localEnv = loadEnv('/root/vercel-projects/senpaisite/.env.local');
const hermesEnv = loadEnv('/root/.hermes/profiles/new-site-worker/.env');
const { neon } = require('@neondatabase/serverless');
const sql = neon(localEnv.DATABASE_URL);
const DASHSCOPE_KEY = hermesEnv.DASHSCOPE_API_KEY;
const log = m => process.stderr.write(m + '\n');

const AUTHORS = ['yuki-tanaka','marcus-reeves','aiko-yamamoto','liam-chen','sakura-williams','hiro-nakamura','emma-rodriguez','kenji-park','meilin-foster','team'];
const SCORE_THRESHOLD = 80;
const MAX_RETRIES = 2;
const CONCURRENCY = 8;

const FORBIDDEN = ['In conclusion','Comprehensive guide','Ultimate guide','Delve into','Navigating the world','Unveil the secrets',"In today's fast-paced",'Look no further',"Whether you're a beginner",'Dive deep into','Tapestry','Testament to','Embark on a journey'];

function scoreArticle(html) {
  let score = 90;
  const text = html.replace(/<[^>]+>/g, '');
  if (FORBIDDEN.some(f => html.toLowerCase().includes(f.toLowerCase()))) score -= 15;
  if (text.length < 3000) score -= 10;
  const h2=(html.match(/<h2/g)||[]).length, h3=(html.match(/<h3/g)||[]).length, p=(html.match(/<p/g)||[]).length;
  const ul=(html.match(/<ul|<ol/g)||[]).length, tbl=(html.match(/<table/g)||[]).length, bq=(html.match(/<blockquote/g)||[]).length;
  if (!(h2>=4 && h3>=2 && p>=10 && ul>=1 && (tbl>=1||bq>=1))) score -= 10;
  const nums=(text.match(/\b\d+\.?\d*\s*(?:%|episodes?|chapters?|volumes?|seasons?|studios?|weeks?|days?|months?|years?|hours?|minutes?|ratings?|scores?)/gi)||[]).length;
  if (nums < 3) score -= 10;
  return Math.max(0, score);
}

function callQwen(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model:'qwen-plus', messages, max_tokens:4096, temperature:0.7 });
    const req = https.request('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+DASHSCOPE_KEY}
    }, res => {
      let data=''; res.on('data',c=>data+=c); res.on('end',()=>{
        try { const j=JSON.parse(data); if(j.error) reject(new Error(j.error.message)); else resolve(j.choices[0].message.content); }
        catch(e) { reject(new Error('Parse: '+data.substring(0,150))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(180000, ()=>{req.destroy(); reject(new Error('Timeout'));});
    req.write(body); req.end();
  });
}

const sysPrompt = `You are an expert anime and manga writer for SenpaiSite.com. Write comprehensive articles in HTML format.
Requirements: 1500-2500 words, HTML tags (h2,h3,p,ul,ol,li,strong,em,table,blockquote), specific anime/studio/character references, data points, expert quotes.
Start directly with content. No markdown fences. No title repetition.
FORBIDDEN: In conclusion, Comprehensive guide, Ultimate guide, Delve into, Navigating the world, Unveil the secrets, Tapestry, Testament to, Embark on a journey.`;

async function genArticle(idea) {
  const html = await callQwen([
    {role:'system', content: sysPrompt},
    {role:'user', content: `Title: ${idea.title}\nCategory: ${idea.type}\nBrief: ${idea.prompt}\n\nWrite the full article HTML body.`}
  ]);
  return html.trim().replace(/^```html?\s*/i,'').replace(/\s*```$/,'');
}

async function processOne(idea, idx) {
  const author = AUTHORS[idx % AUTHORS.length];
  let html = null, score = 0;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      html = await genArticle(idea);
      score = scoreArticle(html);
      if (score >= SCORE_THRESHOLD) break;
      html = null;
    } catch(e) { html = null; }
  }
  
  if (!html) return { ok: false, slug: idea.slug, reason: 'gen-failed' };
  
  const daysBack = Math.floor(Math.random() * 180);
  const pubDate = new Date(Date.now() - daysBack * 86400000);
  const url = '/' + idea.type + '/' + idea.slug;
  
  try {
    await sql`INSERT INTO articles (site,type,short_title,language,published_time,modified_time,author,img,title,description,url,body,tag,is_online)
      VALUES ('senpaisite',${idea.type},${idea.slug},'en',${pubDate.toISOString()},${pubDate.toISOString()},${author},'',${''.concat(idea.title)},${idea.title.substring(0,150)},${url},${html},${idea.type},'Y')
      ON CONFLICT DO NOTHING`;
    return { ok: true, slug: idea.slug, score };
  } catch(e) {
    return { ok: false, slug: idea.slug, reason: 'db: '+e.message.substring(0,100) };
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
        log(`[${done}/${tasks.length}] ${result.ok?'✅':'❌'} ${result.slug}${result.ok?' score='+result.score:''}${!result.ok?' '+result.reason:''} | W:${written} F:${failed}`);
      }
    }
  }
  
  const workers = [];
  for (let i = 0; i < poolSize; i++) workers.push(worker());
  await Promise.all(workers);
  return { written, failed };
}

async function main() {
  const ideas = JSON.parse(fs.readFileSync('/root/vercel-projects/senpaisite/article_ideas.json','utf8'));
  const existing = await sql`SELECT short_title FROM articles WHERE site='senpaisite'`;
  const existingSet = new Set(existing.map(r => r.short_title));
  const tasks = ideas.filter(a => !existingSet.has(a.slug));
  
  log('=== Article Generation ===');
  log('Outlines: ' + ideas.length + ' | In DB: ' + existingSet.size + ' | To gen: ' + tasks.length);
  log('Concurrency: ' + CONCURRENCY);
  
  const start = Date.now();
  const { written, failed } = await workerPool(tasks, CONCURRENCY, processOne);
  const elapsed = ((Date.now() - start) / 60000).toFixed(1);
  
  log('\n=== Complete ===');
  log('Written: ' + written + ' | Failed: ' + failed + ' | Time: ' + elapsed + ' min');
  log('Pass rate: ' + (written+failed>0 ? Math.round(written/(written+failed)*100) : 0) + '%');
}

main().catch(e => { log('Fatal: '+e.message+'\n'+e.stack); process.exit(1); });
