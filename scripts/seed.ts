import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import path from "path";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Create .env.local with DATABASE_URL.");
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  // Ensure tables exist
  await sql`CREATE TABLE IF NOT EXISTS articles (
    id BIGSERIAL PRIMARY KEY,
    site VARCHAR NOT NULL,
    type VARCHAR,
    short_title VARCHAR NOT NULL,
    language VARCHAR,
    published_time TIMESTAMP,
    modified_time TIMESTAMP,
    author VARCHAR,
    img VARCHAR,
    title VARCHAR,
    description TEXT,
    url VARCHAR,
    body TEXT,
    tag VARCHAR,
    is_online VARCHAR NOT NULL DEFAULT 'Y',
    UNIQUE(site, short_title)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS authors (
    id BIGSERIAL PRIMARY KEY,
    site VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    slug VARCHAR NOT NULL,
    img VARCHAR,
    description TEXT,
    language VARCHAR,
    UNIQUE(site, slug)
  )`;

  await sql`CREATE INDEX IF NOT EXISTS idx_articles_site_type ON articles(site, type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_articles_site_short_title ON articles(site, short_title)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_authors_site_slug ON authors(site, slug)`;

  // Load seed data
  const dataPath = path.join(__dirname, "seed-data.json");
  const data = JSON.parse(readFileSync(dataPath, "utf-8"));
  const siteName = data.site || "{{SITE_NAME}}";

  // Seed authors
  if (data.authors && data.authors.length > 0) {
    for (const author of data.authors) {
      await sql`
        INSERT INTO authors (site, name, slug, img, description, language)
        VALUES (${siteName}, ${author.name}, ${author.slug}, ${author.img || null}, ${author.description || null}, ${author.language || "en"})
        ON CONFLICT (site, slug) DO UPDATE SET
          name = EXCLUDED.name,
          img = EXCLUDED.img,
          description = EXCLUDED.description,
          language = EXCLUDED.language
      `;
      console.log(`  Author: ${author.name} (${author.slug})`);
    }
    console.log(`Seeded ${data.authors.length} authors.`);
  }

  // Seed articles
  if (data.articles && data.articles.length > 0) {
    for (const article of data.articles) {
      await sql`
        INSERT INTO articles (site, type, short_title, title, description, body, author, img, published_time, modified_time, language, tag, is_online)
        VALUES (
          ${siteName},
          ${article.type || null},
          ${article.short_title},
          ${article.title},
          ${article.description || null},
          ${article.body || null},
          ${article.author || null},
          ${article.img || null},
          ${article.published_time || new Date().toISOString()},
          ${new Date().toISOString()},
          ${article.language || "en"},
          ${article.tag || null},
          ${article.is_online || "Y"}
        )
        ON CONFLICT (site, short_title) DO UPDATE SET
          type = EXCLUDED.type,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          body = EXCLUDED.body,
          author = EXCLUDED.author,
          img = EXCLUDED.img,
          published_time = EXCLUDED.published_time,
          modified_time = EXCLUDED.modified_time,
          tag = EXCLUDED.tag,
          is_online = EXCLUDED.is_online
      `;
      console.log(`  Article: ${article.title} [${article.type}]`);
    }
    console.log(`Seeded ${data.articles.length} articles.`);
  }

  console.log("Done!");
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
