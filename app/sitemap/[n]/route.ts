import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SITE } from '@/lib/db';
import { siteConfig } from '@/lib/site-config';

const SITE_URL = siteConfig.url;
const ARTICLES_PER_SITEMAP = 50000;

export const revalidate = 3600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ n: string }> }
) {
  const resolvedParams = await params;
  // Parse sitemap1.xml, sitemap2.xml, etc.
  const match = resolvedParams.n.match(/^sitemap(\d+)\.xml$/);
  if (!match) {
    return new NextResponse('Invalid sitemap file', { status: 404 });
  }
  const pageNum = parseInt(match[1]);

  if (isNaN(pageNum) || pageNum < 1) {
    return new NextResponse('Invalid sitemap number', { status: 400 });
  }

  const offset = (pageNum - 1) * ARTICLES_PER_SITEMAP;

  const rows = await query(
    `SELECT type, short_title, published_time
     FROM articles
     WHERE site = $1 AND is_online = 'Y'
     ORDER BY published_time DESC
     LIMIT $2 OFFSET $3`,
    [SITE, ARTICLES_PER_SITEMAP, offset]
  );

  if (rows.length === 0) {
    return new NextResponse('No articles found', { status: 404 });
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const row of rows) {
    const lastMod = row.published_time
      ? new Date(row.published_time).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    xml += `<url>\n<loc>${SITE_URL}/${row.type}/${row.short_title}</loc>\n<lastmod>${lastMod}</lastmod>\n<priority>0.9</priority>\n</url>\n`;
  }

  xml += `</urlset>\n`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  });
}
