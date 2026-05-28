// Phase 1: Generate 500 unique article outlines via LLM
// Uses stderr for logging (unbuffered in non-TTY)
const fs = require('fs');
const https = require('https');

function loadEnv(f) {
  const e = {};
  for (const l of fs.readFileSync(f,'utf8').split('\n')) {
    const m = l.match(/^([^#=]+)=(.*)/);
    if (m) e[m[1].trim()] = m[2].trim();
  }
  return e;
}

const hermesEnv = loadEnv('/root/.hermes/profiles/new-site-worker/.env');
const DASHSCOPE_KEY = hermesEnv.DASHSCOPE_API_KEY;
const log = (msg) => process.stderr.write(msg + '\n');

const CATEGORIES = [
  { key: 'anime-reviews', count: 90, desc: 'anime series and film reviews — covering animation quality, story arcs, character development, studio track records, rewatch value, and comparisons to source material' },
  { key: 'manga-guides', count: 85, desc: 'manga reading guides — reading orders, publisher comparisons, volume guides, genre recommendations, digital vs physical, and deep dives into specific series' },
  { key: 'character-analysis', count: 80, desc: 'anime character analysis — psychological breakdowns, character arc studies, villain motivations, protagonist growth, relationship dynamics, and cultural impact' },
  { key: 'otaku-culture', count: 85, desc: 'otaku and Japanese pop culture — convention coverage, merchandise trends, anime tourism, streaming wars, industry economics, and global fandom evolution' },
  { key: 'seasonal-anime', count: 80, desc: 'seasonal anime coverage — cour previews, watchlists, ongoing series tracking, studio spotlights, and hidden gems from each season' },
  { key: 'cosplay-fan', count: 80, desc: 'cosplay, fan art, and fan community — costume construction tips, convention cosplay photography, fan art techniques, community events, and creative showcases' },
];

function callQwen(messages, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'qwen-plus',
      messages,
      max_tokens: 4096,
      temperature: 0.8,
    });
    const req = https.request('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DASHSCOPE_KEY }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(json.error.message));
          else resolve(json.choices[0].message.content);
        } catch (e) { reject(new Error('Parse error: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout after ' + timeoutMs + 'ms')); });
    req.write(body);
    req.end();
  });
}

async function generateBatch(category, batchNum, batchSize, existingSlugs) {
  const systemPrompt = `You are an expert content strategist for SenpaiSite, an anime and manga website.
Generate exactly ${batchSize} unique article ideas for the "${category.key}" category (${category.desc}).

Each article must have:
1. "title": A specific, compelling title with concrete details (anime names, numbers, scenarios)
2. "slug": URL-friendly (lowercase, hyphens only, no special chars, max 60 chars)
3. "prompt": A detailed writing brief (2-3 sentences) with exact angle, target reader, subtopics, and references to include

Rules:
- No duplicate topics
- No generic "ultimate guide" angles
- Include variety: how-to, comparison, ranking, myth-busting, deep dive, beginner vs expert, case study
- Reference SPECIFIC anime/manga series, studios (MAPPA, Wit Studio, Bones, etc.), and real events
- Each slug must be unique

Output ONLY a valid JSON array. No markdown fences, no extra text.
Format: [{"title":"...","slug":"...","prompt":"..."}, ...]`;

  const userPrompt = `Generate ${batchSize} article ideas for "${category.key}" batch ${batchNum}. Focus on fresh, specific topics. Avoid: ${[...existingSlugs].slice(-10).join(', ') || 'none yet'}.`;

  const response = await callQwen([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]);

  let cleaned = response.trim();
  cleaned = cleaned.replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
  
  const ideas = JSON.parse(cleaned);
  if (!Array.isArray(ideas)) throw new Error('Not an array');
  return ideas;
}

async function main() {
  const BATCH_SIZE = 10;
  const allIdeas = [];
  const existingSlugs = new Set();
  
  log('=== Generating 500 Article Outlines ===');
  log('DashScope key length: ' + DASHSCOPE_KEY?.length);
  
  for (const cat of CATEGORIES) {
    const numBatches = Math.ceil(cat.count / BATCH_SIZE);
    log('\n📂 ' + cat.key + ': ' + cat.count + ' articles in ' + numBatches + ' batches');
    
    for (let b = 1; b <= numBatches; b++) {
      const size = b === numBatches ? cat.count - (b - 1) * BATCH_SIZE : BATCH_SIZE;
      log('  Batch ' + b + '/' + numBatches + ' (' + size + ' ideas) ...');
      
      let ideas = [];
      for (let retry = 0; retry < 3; retry++) {
        try {
          ideas = await generateBatch(cat, b, size, existingSlugs);
          log('  Got ' + ideas.length + ' ideas');
          break;
        } catch (e) {
          log('  Retry ' + (retry+1) + ': ' + e.message);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      
      for (const idea of ideas) {
        if (!idea.slug) idea.slug = idea.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);
        if (existingSlugs.has(idea.slug)) {
          idea.slug = idea.slug + '-' + Math.random().toString(36).substring(2, 6);
        }
        idea.type = cat.key;
        existingSlugs.add(idea.slug);
        allIdeas.push(idea);
      }
      
      log('  Total so far: ' + allIdeas.length);
      
      if (b < numBatches) await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  const outPath = '/root/vercel-projects/senpaisite/article_ideas.json';
  fs.writeFileSync(outPath, JSON.stringify(allIdeas, null, 2));
  log('\n✅ Saved ' + allIdeas.length + ' outlines to ' + outPath);
  
  const byType = {};
  for (const idea of allIdeas) byType[idea.type] = (byType[idea.type] || 0) + 1;
  log('\nBreakdown:');
  for (const [type, count] of Object.entries(byType)) log('  ' + type + ': ' + count);
}

main().catch(e => { log('Fatal: ' + e.message + '\n' + e.stack); process.exit(1); });
