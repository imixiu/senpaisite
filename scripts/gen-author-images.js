// Generate author headshots via Qwen image API + upload to Vercel Blob
const fs = require('fs');

// Load env manually
function loadEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

const localEnv = loadEnv('/root/vercel-projects/senpaisite/.env.local');
const hermesEnv = loadEnv('/root/.hermes/profiles/new-site-worker/.env');

process.env.DATABASE_URL = localEnv.DATABASE_URL;
process.env.BLOB_READ_WRITE_TOKEN = localEnv.BLOB_READ_WRITE_TOKEN;
const DASHSCOPE_KEY = hermesEnv.DASHSCOPE_API_KEY;

console.log('DB URL length:', process.env.DATABASE_URL?.length);
console.log('Blob token length:', process.env.BLOB_READ_WRITE_TOKEN?.length);
console.log('DashScope key length:', DASHSCOPE_KEY?.length);

const { neon } = require('@neondatabase/serverless');
const { put } = require('@vercel/blob');
const https = require('https');

const SITE = 'senpaisite';
const sql = neon(process.env.DATABASE_URL);

const AUTHORS = [
  { slug: 'yuki-tanaka', name: 'Yuki Tanaka', prompt: 'Professional headshot portrait of a young Japanese woman anime critic, short black hair, warm smile, studio lighting, clean white background' },
  { slug: 'marcus-reeves', name: 'Marcus Reeves', prompt: 'Professional headshot portrait of a Black man in his 30s, manga historian, glasses, friendly expression, studio lighting, clean background' },
  { slug: 'aiko-yamamoto', name: 'Aiko Yamamoto', prompt: 'Professional headshot portrait of a Japanese woman psychologist, long dark hair, thoughtful expression, studio lighting, clean background' },
  { slug: 'liam-chen', name: 'Liam Chen', prompt: 'Professional headshot portrait of a young Asian-American man journalist, casual stylish look, confident smile, studio lighting, clean background' },
  { slug: 'sakura-williams', name: 'Sakura Williams', prompt: 'Professional headshot portrait of a mixed-race woman with pink-tinted hair highlights, cheerful anime fan, studio lighting, clean background' },
  { slug: 'hiro-nakamura', name: 'Hiro Nakamura', prompt: 'Professional headshot portrait of a Japanese man in his late 20s, cosplay expert, creative artistic look, studio lighting, clean background' },
  { slug: 'emma-rodriguez', name: 'Emma Rodriguez', prompt: 'Professional headshot portrait of a Latina woman film critic, dark wavy hair, elegant professional look, studio lighting, clean background' },
  { slug: 'kenji-park', name: 'Kenji Park', prompt: 'Professional headshot portrait of a Korean-American man, light novel specialist, intellectual look with glasses, studio lighting, clean background' },
  { slug: 'meilin-foster', name: 'Mei-Lin Foster', prompt: 'Professional headshot portrait of a young Asian woman community reporter, bright friendly smile, casual professional style, studio lighting, clean background' },
  { slug: 'team', name: 'SenpaiSite Team', prompt: 'Professional anime-style group illustration of diverse anime fans together, colorful vibrant team logo style, purple and pink theme, clean design' },
];

function generateImage(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'qwen-image-plus',
      input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
      parameters: { size: '1024*1024' }
    });
    const req = https.request('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DASHSCOPE_KEY }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const imgUrl = json?.output?.choices?.[0]?.message?.content?.[0]?.image;
          if (imgUrl) resolve(imgUrl);
          else reject(new Error('No image URL: ' + JSON.stringify(json).substring(0, 200)));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Generating ' + AUTHORS.length + ' author headshots...\n');
  
  for (let i = 0; i < AUTHORS.length; i++) {
    const a = AUTHORS[i];
    process.stdout.write('[' + (i+1) + '/' + AUTHORS.length + '] ' + a.name + ' ... ');
    
    try {
      const ossUrl = await generateImage(a.prompt);
      process.stdout.write('img OK, ');
      
      const imgRes = await fetch(ossUrl);
      const imgBuf = Buffer.from(await imgRes.arrayBuffer());
      
      const blob = await put('authors/' + SITE + '/' + a.slug + '.png', imgBuf, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true,
        contentType: 'image/png'
      });
      
      await sql`UPDATE authors SET img = ${blob.url} WHERE site = 'senpaisite' AND slug = ${a.slug}`;
      console.log('blob OK');
    } catch (e) {
      console.log('FAIL: ' + e.message);
    }
    
    if (i < AUTHORS.length - 1) await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\nDone!');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
