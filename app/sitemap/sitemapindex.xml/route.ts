import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SITE } from '@/lib/db';
import { siteConfig } from '@/lib/site-config';

const SITE_URL = siteConfig.url;
const ARTICLES_PER_SITEMAP = 5000;

export const revalidate = 3600;

export async function GET() {
  const countResult = await query(
    `SELECT COUNT(*) as total FROM articles WHERE site = $1 AND is_online = 'Y'`,
    [SITE]
  );
  const totalArticles = parseInt(countResult[0].total);
  const numSitemaps = Math.max(1, Math.ceil(totalArticles / ARTICLES_PER_SITEMAP));

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (let i = 1; i <= numSitemaps; i++) {
    xml += `<sitemap>\n<loc>${SITE_URL}/sitemap/sitemap${i}.xml</loc>\n<lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n</sitemap>\n`;
  }

  xml += `</sitemapindex>\n`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  });
}
