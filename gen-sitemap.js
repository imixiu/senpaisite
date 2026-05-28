const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const [,, SITE_NAME, SITE_DIR, DOMAIN] = process.argv;
const DB = process.env.DATABASE_URL;
if (!DB) { console.error("DATABASE_URL not set"); process.exit(1); }
const sql = neon(DB);
const today = new Date().toISOString().slice(0, 10);
const outDir = `/root/vercel-projects/${SITE_DIR}/public/sitemap`;

async function main() {
  const [articles, authors] = await Promise.all([
    sql`SELECT type, short_title FROM articles WHERE site=${SITE_NAME} AND is_online = 'Y' ORDER BY id`,
    sql`SELECT slug FROM authors WHERE site=${SITE_NAME} ORDER BY id`,
  ]);

  const urls = [`https://${DOMAIN}/`, `https://${DOMAIN}/author/team`];
  for (const a of authors) if (a.slug !== 'team') urls.push(`https://${DOMAIN}/author/${a.slug}`);
  const types = [...new Set(articles.filter(a => a.type).map(a => a.type))];
  for (const t of types) urls.push(`https://${DOMAIN}/${t}`);
  for (const a of articles) {
    const t = a.type || 'articles';
    // URL-encode the slug to handle spaces and special chars
    const encodedSlug = encodeURIComponent(a.short_title);
    urls.push(`https://${DOMAIN}/${t}/${encodedSlug}`);
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const chunks = [];
  for (let i = 0; i < urls.length; i += 5000) chunks.push(urls.slice(i, i + 5000));

  for (let i = 0; i < chunks.length; i++) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
      chunks[i].map(u => `<url>\n<loc>${u}</loc>\n<lastmod>${today}</lastmod>\n<changefreq>weekly</changefreq>\n</url>`).join('\n') +
      `\n</urlset>`;
    fs.writeFileSync(path.join(outDir, `sitemap${i + 1}.xml`), xml);
  }

  const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    chunks.map((_, i) => `<sitemap>\n<loc>https://${DOMAIN}/sitemap/sitemap${i + 1}.xml</loc>\n<lastmod>${today}</lastmod>\n</sitemap>`).join('\n') +
    `\n</sitemapindex>`;
  fs.writeFileSync(path.join(outDir, 'sitemapindex.xml'), index);

  console.log(`Total URLs: ${urls.length}, Files: ${chunks.length}`);
}
main().catch(console.error);
