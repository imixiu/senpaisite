import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getArticlesByCategory } from "@/lib/queries";
import { siteConfig } from "@/lib/site-config";
import { ArticleCard } from "@/components/article/ArticleCard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

interface PagedCategoryProps {
  params: Promise<{ category: string; pageNum: string }>;
}

export async function generateMetadata({ params }: PagedCategoryProps): Promise<Metadata> {
  const { category, pageNum } = await params;
  const page = parseInt(pageNum, 10) || 0;

  // Page 1 should redirect to /{category}
  if (page <= 1) {
    return { title: "Redirecting..." };
  }

  const cat = siteConfig.categories.find((c) => c.key === category);
  if (!cat) return { title: "Category Not Found" };

  const { total } = await getArticlesByCategory(category, page, PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (page > totalPages) return { title: "Page Not Found" };

  return {
    title: `${cat.label} — Page ${page} | ${siteConfig.shortTitle}`,
    description: `Page ${page} of ${cat.label} articles - ${cat.description}`,
    alternates: {
      canonical: `${siteConfig.url}/${category}/page/${page}`,
    },
  };
}

export default async function PagedCategoryPage({ params }: PagedCategoryProps) {
  const { category, pageNum } = await params;
  const page = parseInt(pageNum, 10) || 0;

  // Page 1 redirects to /{category}
  if (page <= 1) {
    redirect(`/${category}`);
  }

  const cat = siteConfig.categories.find((c) => c.key === category);
  if (!cat) notFound();

  const { articles, total } = await getArticlesByCategory(category, page, PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (page > totalPages) notFound();

  return (
    <div className="category-page">
      <section className="category-banner">
        <h1>{cat.label} — Page {page}</h1>
        <p>{cat.description}</p>
        <span className="article-count">
          Page {page} of {totalPages} · {total} articles
        </span>
      </section>
      <section className="article-grid">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </section>

      {totalPages > 1 && (
        <nav className="pagination">
          {page > 2 ? (
            <Link href={`/${category}/page/${page - 1}`} className="pagination-btn">
              ← Prev
            </Link>
          ) : page === 2 ? (
            <Link href={`/${category}`} className="pagination-btn">
              ← Prev
            </Link>
          ) : null}
          <span className="pagination-info">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/${category}/page/${page + 1}`} className="pagination-btn">
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
