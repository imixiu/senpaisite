// Phase 2+3: Generate articles via LLM with quality scoring (v2)
// - Randomized style/tone/structure per article
// - Banned fabricated data, banned repetitive openings
// - Randomized max_tokens for length variation
// - Cross-check: detect repetitive opening patterns every 10 articles
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
const SCORE_THRESHOLD = 70;
const MAX_RETRIES = 3;
const CONCURRENCY = 8;

// ─── Banned phrases ───
const FORBIDDEN_PHRASES = [
  'In conclusion','Comprehensive guide','Ultimate guide','Delve into',
  'Navigating the world','Unveil the secrets',"In today's fast-paced",
  'Look no further',"Whether you're a beginner",'Dive deep into',
  'Tapestry','Testament to','Embark on a journey',
  // AI-slop additions
  'It is worth noting','It\'s important to note','Let\'s explore',
  'In this article','This article will','We will explore',
  'the world of','the realm of','the landscape of',
  'a testament to','a tapestry of','rich tapestry',
];

// ─── Banned opening patterns ───
const BANNED_OPENINGS = [
  /^when\s/i, /^since\s/i, /^at\s+(the|its|this)/i,
  /^in\s+(the\s+)?world\s/i, /^in\s+(the\s+)?realm/i,
  /^from\s+(the\s+)?(moment|very\s+beginning)/i,
  /^for\s+(many|most|decades|years)\s/i,
  /^there\s+(is|are|has\s+been|have\s+been)\s/i,
  /^it\s+(is|was|has\s+been)\s/i,
];

// ─── Style pools for randomization ───
const TONES = [
  'analytical and data-driven, like a film studies journal',
  'conversational and opinionated, like a passionate fan blogging to friends',
  'critical and sharp-tongued, like a review columnist who pulls no punches',
  'enthusiastic and excitable, like someone who just finished watching and needs to talk about it',
  'measured and scholarly, like a pop-culture essayist writing for The Atlantic',
  'humorous and self-deprecating, like a comedian who happens to love anime',
  'nostalgic and reflective, like someone revisiting childhood favorites with adult eyes',
  'skeptical and probing, like an investigative journalist covering the industry',
];

const OPENING_STYLES = [
  'Start with a bold, provocative claim that challenges conventional opinion about the topic.',
  'Open with a specific scene description — put the reader in a moment, like a cold open in a TV show.',
  'Begin with a direct question that the reader probably has but never articulated.',
  'Open with a short, punchy one-sentence paragraph that states something unexpected, then elaborate.',
  'Start by describing a common misconception, then immediately refute it.',
  'Open with a brief anecdote about a personal viewing experience — first time, rewatch, or marathon.',
  'Begin with a comparison that seems absurd at first but makes sense by the end of the paragraph.',
  'Start mid-argument, as if continuing a conversation the reader walked into.',
  'Open with a quote (real or paraphrased) from a creator, critic, or character, then unpack it.',
  'Begin by describing the reaction — fan backlash, studio response, critical consensus — then explain what triggered it.',
];

const STRUCTURE_STYLES = [
  'Structure the article as a chronological walkthrough: how the topic evolved over time.',
  'Use a problem-solution framework: identify the issue, explore why it exists, propose what works.',
  'Write it as a comparison piece: constantly contrast two approaches, studios, eras, or philosophies.',
  'Organize by themes rather than chronology — group ideas conceptually, not temporally.',
  'Build toward a thesis: start with observations, layer evidence, arrive at a conclusion the reader discovers with you.',
  'Use a debunking structure: state the popular take, then systematically dismantle it with evidence.',
  'Write it as a guided tour: walk the reader through specific episodes, chapters, or scenes as evidence.',
];

// ─── Random helpers ───
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ─── Build per-article system prompt ───
function buildSystemPrompt() {
  const tone = pick(TONES);
  const opening = pick(OPENING_STYLES);
  const structure = pick(STRUCTURE_STYLES);
  return `You are a writer for SenpaiSite.com, an anime and manga publication. Your voice is ${tone}.

Writing rules:
- ${opening}
- ${structure}
- Vary your paragraph length. Mix short punchy paragraphs with longer analytical ones.
- Use first person occasionally ("I think", "I remember watching") to sound human.
- Include your subjective opinion. Say "this works because" or "this falls flat because", not "it can be argued that".
- Reference specific episodes by number, specific scenes by description, specific character moments.
- Word count: let the topic determine length. A focused analysis might be 800 words. A broad comparison might be 2000. Don't pad.
- Output HTML only (h2, h3, p, ul, ol, li, strong, em, blockquote, table, thead, tbody, tr, th, td). No markdown fences. No title repetition.

STRICTLY FORBIDDEN:
- Never fabricate statistics, survey numbers, test results, or event details. If you don't have a real data point, say "critics noted" or "fans observed" instead of inventing "87% of viewers" or "a 2024 study at University X".
- Never start with: "When...", "Since...", "At the...", "In the world of...", "For many...", "There is/are...", "It is/was..."
- Never use: ${FORBIDDEN_PHRASES.slice(0, 8).join(', ')}
- Never write a generic intro paragraph that could fit any article. The first paragraph must be specifically about THIS topic.`;
}

// ─── Build per-article user prompt ───
function buildUserPrompt(idea) {
  const lengthHint = pick([
    'Keep this focused and concise — around 800-1200 words.',
    'Aim for a medium-length piece, roughly 1200-1600 words.',
    'This deserves depth — write 1500-2000 words.',
    'Let the topic breathe. Write as much or as little as it needs.',
  ]);
  return `Title: ${idea.title}
Category: ${idea.type}

Writing brief: ${idea.prompt}

${lengthHint}

Remember: write like a real person who cares about this topic, not like an encyclopedia entry.`;
}

// ─── Quality scoring (v2) ───
function scoreArticle(html) {
  let score = 85;
  const text = html.replace(/<[^>]+>/g, '').trim();

  // 1. Forbidden phrases: -20
  if (FORBIDDEN_PHRASES.some(f => text.toLowerCase().includes(f.toLowerCase()))) score -= 20;

  // 2. Too short (< 2000 chars ≈ < 350 words): -15
  if (text.length < 2000) score -= 15;

  // 3. Banned opening pattern: -20
  const firstParagraph = text.split('\n\n')[0] || text.substring(0, 200);
  if (BANNED_OPENINGS.some(re => re.test(firstParagraph.trim()))) score -= 20;

  // 4. Generic intro check — if first paragraph is very short or starts with "This article": -15
  if (/^this\s+article/i.test(firstParagraph.trim())) score -= 15;

  // 5. No structural variety (only <p> tags, no lists/blockquotes/tables): -10
  const h2 = (html.match(/<h2/g) || []).length;
  const ul = (html.match(/<ul|<ol/g) || []).length;
  const bq = (html.match(/<blockquote/g) || []).length;
  const tbl = (html.match(/<table/g) || []).length;
  if (h2 < 2) score -= 10;
  if (ul === 0 && bq === 0 && tbl === 0) score -= 10;

  // 6. Repetitive sentence openings — check first 10 sentences
  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 10).slice(0, 15);
  const starters = sentences.map(s => s.trim().split(/\s+/)[0].toLowerCase());
  const uniqueStarters = new Set(starters);
  if (uniqueStarters.size < starters.length * 0.5) score -= 15; // >50% start with same word

  // 7. Suspected fabricated stats — overly specific invented numbers: -15
  const fakeStatPatterns = [
    /\b\d{1,3}(,\d{3})*\s*(?:participants|respondents|survey|test subjects)/i,
    /\ba\s+20\d{2}\s+(?:study|research|survey|poll)\s+(?:by|from|at)\s+/i,
    /\b\d{1,3}\s*%\s+of\s+(?:viewers|fans|respondents|participants|audiences)/i,
  ];
  if (fakeStatPatterns.some(p => p.test(text))) score -= 15;

  // 8. Bonus: first-person voice (+5)
  if (/\b(I\s+(think|felt|remember|watched|noticed|would\s+argue)|my\s+(take|opinion|experience|view))\b/i.test(text)) score += 5;

  return Math.max(0, Math.min(100, score));
}

// ─── Qwen API call with configurable max_tokens ───
function callQwen(messages, maxTokens) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: 'qwen-plus', messages, max_tokens: maxTokens, temperature: 0.85 });
    const req = https.request('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DASHSCOPE_KEY }
    }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => {
        try { const j = JSON.parse(data); if (j.error) reject(new Error(j.error.message)); else resolve(j.choices[0].message.content); }
        catch (e) { reject(new Error('Parse: ' + data.substring(0, 150))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(180000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body); req.end();
  });
}

// ─── Generate one article ───
async function genArticle(idea) {
  const sysPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(idea);
  const maxTokens = randInt(2500, 6000);
  const html = await callQwen([
    { role: 'system', content: sysPrompt },
    { role: 'user', content: userPrompt }
  ], maxTokens);
  return { html: html.trim().replace(/^```html?\s*/i, '').replace(/\s*```$/, ''), maxTokens };
}

// ─── Cross-check: detect repetitive openings ───
const recentOpenings = [];
function checkOpeningDiversity(opening) {
  recentOpenings.push(opening.substring(0, 60).toLowerCase());
  if (recentOpenings.length < 5) return true;
  // Keep last 10
  while (recentOpenings.length > 10) recentOpenings.shift();
  // Check if >40% start with the same word
  const firstWords = recentOpenings.map(o => o.split(/\s+/)[0]);
  const counts = {};
  firstWords.forEach(w => counts[w] = (counts[w] || 0) + 1);
  const maxCount = Math.max(...Object.values(counts));
  return maxCount <= recentOpenings.length * 0.4;
}

// ─── Process one article ───
async function processOne(idea, idx) {
  const author = AUTHORS[idx % AUTHORS.length];
  let html = null, score = 0;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await genArticle(idea);
      html = result.html;
      score = scoreArticle(html);

      // Cross-check opening diversity
      const textContent = html.replace(/<[^>]+>/g, '').trim();
      const firstPara = textContent.split('\n\n')[0] || textContent.substring(0, 200);
      if (score >= SCORE_THRESHOLD && !checkOpeningDiversity(firstPara)) {
        log(`  ⚠️ Opening too similar, retrying (${attempt + 1}/${MAX_RETRIES})`);
        score -= 10;
      }

      if (score >= SCORE_THRESHOLD) break;
      html = null;
    } catch (e) { html = null; }
  }

  if (!html) return { ok: false, slug: idea.slug, reason: 'gen-failed' };

  const daysBack = Math.floor(Math.random() * 180);
  const pubDate = new Date(Date.now() - daysBack * 86400000);
  const url = '/' + idea.type + '/' + idea.slug;

  try {
    // Generate description from body text instead of title
    const descText = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const description = descText.substring(0, 155) + (descText.length > 155 ? '...' : '');
    await sql`INSERT INTO articles (site,type,short_title,language,published_time,modified_time,author,img,title,description,url,body,tag,is_online)
      VALUES ('senpaisite',${idea.type},${idea.slug},'en',${pubDate.toISOString()},${pubDate.toISOString()},${author},'',${''.concat(idea.title)},${description},${url},${html},${idea.type},'Y')
      ON CONFLICT (site, short_title) DO UPDATE SET body = EXCLUDED.body, published_time = EXCLUDED.published_time, modified_time = EXCLUDED.modified_time, author = EXCLUDED.author, is_online = 'Y', type = EXCLUDED.type, title = EXCLUDED.title, description = EXCLUDED.description, url = EXCLUDED.url, tag = EXCLUDED.tag`;
    return { ok: true, slug: idea.slug, score };
  } catch (e) {
    return { ok: false, slug: idea.slug, reason: 'db: ' + e.message.substring(0, 100) };
  }
}

// ─── Worker pool ───
async function workerPool(tasks, poolSize, fn) {
  let nextIdx = 0, written = 0, failed = 0;

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      const result = await fn(tasks[idx], idx);
      if (result.ok) written++; else failed++;
      const done = written + failed;
      if (done % 10 === 0 || done === 1 || done === tasks.length) {
        log(`[${done}/${tasks.length}] ${result.ok ? '✅' : '❌'} ${result.slug}${result.ok ? ' score=' + result.score : ''}${!result.ok ? ' ' + result.reason : ''} | W:${written} F:${failed}`);
      }
    }
  }

  const workers = [];
  for (let i = 0; i < poolSize; i++) workers.push(worker());
  await Promise.all(workers);
  return { written, failed };
}

// ─── Main ───
async function main() {
  const ideas = JSON.parse(fs.readFileSync('/root/vercel-projects/senpaisite/article_ideas.json', 'utf8'));

  // In replacement mode: regenerate all 500 articles
  log('=== Article Generation v2 (Replacement Mode) ===');
  log('Total outlines: ' + ideas.length);
  log('Replacing all existing articles');
  log('Concurrency: ' + CONCURRENCY);
  log('Score threshold: ' + SCORE_THRESHOLD);
  log('max_tokens range: 2500-6000');

  // Clear old articles
  const delResult = await sql`DELETE FROM articles WHERE site = 'senpaisite'`;
  log('Cleared existing articles from DB');

  // Shuffle ideas to avoid category clustering
  const shuffled = [...ideas].sort(() => Math.random() - 0.5);

  const start = Date.now();
  const { written, failed } = await workerPool(shuffled, CONCURRENCY, processOne);
  const elapsed = ((Date.now() - start) / 60000).toFixed(1);

  log('\n=== Complete ===');
  log('Written: ' + written + ' | Failed: ' + failed + ' | Time: ' + elapsed + ' min');
  log('Pass rate: ' + (written + failed > 0 ? Math.round(written / (written + failed) * 100) : 0) + '%');

  // Final stats
  const avgScore = await sql`SELECT count(*) as cnt FROM articles WHERE site='senpaisite' AND is_online='Y'`;
  log('Articles in DB: ' + (avgScore[0]?.cnt || 0));
}

main().catch(e => { log('Fatal: ' + e.message + '\n' + e.stack); process.exit(1); });
