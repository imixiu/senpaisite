
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const articles = [
  {
    short_title: "what-does-ecchi-mean-in-anime",
    title: "What Does Ecchi Mean in Anime? A Cultural Guide",
    description: "Ecchi means sexual humor in anime, not explicit content. Learn how Japan's rating system draws the line between ecchi, hentai, and mainstream anime.",
    type: "otaku-culture",
    author: "Liam Chen",
    body_file: "/tmp/senpai_article_1.html"
  },
  {
    short_title: "what-is-futanari-in-anime",
    title: "What Is Futanari in Anime? Definition & Cultural Context",
    description: "Futanari means dual form in Japanese. Discover its origins in Edo-period art and how it became an R-18 classification in modern anime and manga.",
    type: "otaku-culture",
    author: "Sakura Williams",
    body_file: "/tmp/senpai_article_2.html"
  },
  {
    short_title: "what-does-hentai-mean-in-anime",
    title: "What Does Hentai Mean in Anime? Understanding Japanese Animation Ratings",
    description: "Hentai means transformation in Japanese. Understand Japan's adult content ratings, censorship laws, and why Western usage misses the point.",
    type: "otaku-culture",
    author: "Kenji Park",
    body_file: "/tmp/senpai_article_3.html"
  },
  {
    short_title: "yaoi-vs-yuri-vs-ecchi",
    title: "Yaoi vs Yuri vs Ecchi: Anime Genre Differences Explained",
    description: "Yaoi, yuri, and ecchi describe different things in anime. Learn how Japanese classification separates demographics, content types, and ratings.",
    type: "otaku-culture",
    author: "Mei-Lin Foster",
    body_file: "/tmp/senpai_article_4.html"
  },
  {
    short_title: "what-is-seinen-anime",
    title: "What Is Seinen Anime? Understanding Demographics vs Genres",
    description: "Seinen targets young adult men in Japan, but it's a demographic tag, not a genre. Learn how seinen magazines shape anime storytelling and tone.",
    type: "otaku-culture",
    author: "Hiro Nakamura",
    body_file: "/tmp/senpai_article_5.html"
  }
];

(async () => {
  const sql = "INSERT INTO articles (site, short_title, title, body, description, type, language, author, is_online, published_time, modified_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING id, short_title";
  const ids = [];
  for (const a of articles) {
    const body = fs.readFileSync(a.body_file, 'utf-8').trim();
    try {
      const r = await pool.query(sql, ['senpaisite', a.short_title, a.title, body, a.description, a.type, 'en', a.author, 'Y']);
      ids.push({ id: r.rows[0].id, slug: r.rows[0].short_title, title: a.title });
      console.log('OK: ' + r.rows[0].id + ' ' + a.short_title);
    } catch(e) {
      console.error('FAIL: ' + a.short_title + ': ' + e.message);
    }
  }
  console.log('Published ' + ids.length + '/5 articles');
  pool.end();
})();
