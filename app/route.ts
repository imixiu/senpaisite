import { INDEX_HTML } from "../lib/index-html";
import { neon } from "@neondatabase/serverless";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatType(type: string) {
  return type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAuthor(author: string | null) {
  if (!author) return "";
  return author.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET() {
  let html = INDEX_HTML;

  try {
    const dbUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").replace("-pooler", "");
    if (dbUrl) {
      const sql = neon(dbUrl);
      const rows = await sql(
        "SELECT type, short_title, title, author, img FROM articles WHERE site='senpaisite' AND is_online='Y' ORDER BY published_time DESC LIMIT 6"
      );

      const cards = (rows as any[]).map((r) => {
        const url = `/${r.type}/${r.short_title}`;
        const title = escapeHtml(r.title);
        const tag = formatType(r.type);
        const author = formatAuthor(r.author);
        const imgTag = r.img ? `<img src="${escapeHtml(r.img)}" alt="${title}" loading="lazy" style="width:100%;height:160px;object-fit:cover;border-radius:8px;margin-bottom:.75rem">` : "";
        return `<a href="${url}" class="article-card" style="text-decoration:none;color:inherit;display:block">${imgTag}<span class="tag">${tag}</span><h3>${title}</h3><div class="meta">${author ? "By " + author : ""}</div></a>`;
      }).join("\n    ");

      html = html.replace("{{LATEST_ARTICLES}}", cards);
    }
  } catch (e) {
    console.error("Failed to load latest articles:", e);
    html = html.replace("{{LATEST_ARTICLES}}", "<p>Articles loading...</p>");
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
