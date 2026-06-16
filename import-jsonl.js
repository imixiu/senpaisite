const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const AUTHORS = ['Marcus Reeves', 'Yuki Tanaka', 'Kenji Park', 'Liam Chen', 'Sakura Williams', 'Aiko Yamamoto', 'Hiro Nakamura', 'Emma Rodriguez', 'Mei-Lin Foster'];
const TYPE_MAP = { 'Characters': 'character-analysis', 'Anime Reviews': 'anime-reviews', 'Otaku Culture': 'otaku-culture' };

function randDate() {
  const s = new Date('2026-03-01').getTime(), e = new Date('2026-06-09').getTime();
  return new Date(s + Math.random() * (e - s)).toISOString();
}

async function main() {
  const raw = JSON.parse(fs.readFileSync('/tmp/senpaisite-clean.json', 'utf8'));
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let inserted = 0, skipped = 0;
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    const t = TYPE_MAP[a.type] || a.type;
    const url = '/' + t + '/' + a.slug;
    const author = AUTHORS[i % AUTHORS.length];
    const dt = randDate();
    const r = await client.query(
      'INSERT INTO articles (site,type,short_title,language,published_time,modified_time,author,img,title,description,url,body,tag,is_online) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (url) DO NOTHING RETURNING id',
      ['senpaisite', t, a.slug, 'en', dt, dt, author, a.image, a.title, a.description, url, a.htmlbody, t, 'Y']
    );
    if (r.rows.length) inserted++; else skipped++;
    if ((i + 1) % 50 === 0) process.stdout.write(`${i + 1}/${raw.length} inserted:${inserted} skipped:${skipped}\n`);
  }
  console.log(`Done. inserted:${inserted} skipped:${skipped}`);
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
