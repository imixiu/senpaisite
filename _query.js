const { Pool } = require('pg');
const fs = require('fs');
const envContent = fs.readFileSync('/data/vercel-projects/cookingcultures/.env.local', 'utf8');
const match = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!match) { console.log('NO URL'); process.exit(1); }
const url = match[1].trim();
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
pool.query("SELECT COUNT(*) as count FROM articles WHERE site = 'dailyclosetmix'")
  .then(r => { console.log(JSON.stringify(r.rows)); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
