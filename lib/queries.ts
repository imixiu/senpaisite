import { query } from "./db";
import { tairGet } from "./tair";
import { SITE } from "./db";
import { Article, ArticlePreview, Author } from "./types";

function formatDate(date: unknown): string | null {
  if (!date) return null;
  if (date instanceof Date) return date.toISOString().split("T")[0];
  return String(date).split("T")[0];
}

function mapPreview(row: any): ArticlePreview {
  return {
    id: row.id,
    slug: row.short_title,
    site: row.site,
    type: row.type,
    title: row.title,
    description: row.description,
    img: row.img,
    author: row.author,
    publishDate: formatDate(row.published_time),
    tag: row.tag ?? null,
    isOnline: row.is_online ?? "Y",
  };
}

export async function getAllArticles(): Promise<ArticlePreview[]> {
  const rows = await query(
    `SELECT id, short_title, site, type, title, description, img, author, published_time, tag, is_online
     FROM articles WHERE site = $1 AND is_online = 'Y' ORDER BY published_time DESC`,
    [SITE]
  );
  return rows.map(mapPreview);
}

export async function getArticlesByType(type: string, page = 1, pageSize = 24): Promise<{ articles: ArticlePreview[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const [rows, countRows] = await Promise.all([
    query(
      `SELECT id, short_title, site, type, title, description, img, author, published_time, tag, is_online
       FROM articles WHERE site = $1 AND type = $2 AND is_online = 'Y'
       ORDER BY published_time DESC LIMIT $3 OFFSET $4`,
      [SITE, type, pageSize, offset]
    ),
    query(
      `SELECT COUNT(*) as count FROM articles WHERE site = $1 AND type = $2 AND is_online = 'Y'`,
      [SITE, type]
    ),
  ]);
  const total = parseInt((countRows[0] as any).count, 10);
  return { articles: rows.map(mapPreview), total };
}

export async function getArticle(type: string, slug: string): Promise<Article | null> {
  const key = `senpaisite:article:${type}:${slug}`;
  const cached = await tairGet(key);
  if (cached) return cached;

  const rows = await query(
    `SELECT a.*, au.img as author_img FROM articles a
     LEFT JOIN authors au ON au.site = a.site AND (au.name = a.author OR au.slug = a.author)
     WHERE a.site = $1 AND a.type = $2 AND a.short_title = $3 AND a.is_online = 'Y' LIMIT 1`,
    [SITE, type, slug]
  );
  if (rows.length === 0) return null;
  const row = rows[0] as any;
  const article = {
    id: row.id,
    slug: row.short_title,
    site: row.site,
    type: row.type,
    title: row.title,
    description: row.description,
    img: row.img,
    author: row.author,
    authorImg: row.author_img,
    publishDate: formatDate(row.published_time),
    body: row.body,
    url: row.url,
    language: row.language,
    updatedAt: row.modified_time ? formatDate(row.modified_time) ?? undefined : undefined,
    tag: row.tag ?? null,
    isOnline: row.is_online ?? "Y",
  };

  return article;
}

export async function getFeaturedArticle(): Promise<ArticlePreview | null> {
  const rows = await query(
    `SELECT id, short_title, site, type, title, description, img, author, published_time, tag, is_online
     FROM articles WHERE site = $1 AND img IS NOT NULL AND is_online = 'Y'
     ORDER BY published_time DESC LIMIT 1`,
    [SITE]
  );
  if (rows.length === 0) return null;
  return mapPreview(rows[0]);
}

export async function getRelatedArticles(type: string, excludeId: number): Promise<ArticlePreview[]> {
  const rows = await query(
    `SELECT id, short_title, site, type, title, description, img, author, published_time, tag, is_online
     FROM articles WHERE site = $1 AND type = $2 AND id != $3 AND is_online = 'Y'
     ORDER BY published_time DESC LIMIT 3`,
    [SITE, type, excludeId]
  );
  return rows.map(mapPreview);
}

export async function getAllAuthors(): Promise<Author[]> {
  const rows = await query(
    `SELECT * FROM authors WHERE site = $1 ORDER BY id`,
    [SITE]
  );
  return rows as Author[];
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  const rows = await query(
    `SELECT * FROM authors WHERE site = $1 AND slug = $2 LIMIT 1`,
    [SITE, slug]
  );
  if (rows.length === 0) return null;
  return rows[0] as Author;
}

export async function getArticlesByAuthor(authorName: string): Promise<ArticlePreview[]> {
  // Match by name OR slug (articles.author may store either)
  const rows = await query(
    `SELECT id, short_title, site, type, title, description, img, author, published_time, tag, is_online
     FROM articles WHERE site = $1 AND (author = $2 OR author = $3) AND is_online = 'Y'
     ORDER BY published_time DESC`,
    [SITE, authorName, authorName.toLowerCase().replace(/\s+/g, '-')]
  );
  return rows.map(mapPreview);
}

export async function getArticleCount(): Promise<number> {
  const rows = await query(
    `SELECT COUNT(*) as count FROM articles WHERE site = $1 AND is_online = 'Y'`,
    [SITE]
  );
  return parseInt((rows[0] as any).count, 10);
}

export async function getCategoryCount(): Promise<number> {
  const rows = await query(
    `SELECT COUNT(DISTINCT type) as count FROM articles WHERE site = $1 AND is_online = 'Y'`,
    [SITE]
  );
  return parseInt((rows[0] as any).count, 10);
}

export async function getAuthorCount(): Promise<number> {
  const rows = await query(
    `SELECT COUNT(*) as count FROM authors WHERE site = $1`,
    [SITE]
  );
  return parseInt((rows[0] as any).count, 10);
}
