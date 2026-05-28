import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getArticlesByCategory } from "@/lib/queries";
import { siteConfig } from "@/lib/site-config";
import { ArticleCard } from "@/components/article/ArticleCard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const cat = siteConfig.categories.find((c) => c.key === category);
  if (!cat) return { title: "Category Not Found" };
  return {
    title: `${cat.label} - ${siteConfig.title}`,
    description: cat.description,
    alternates: {
      canonical: `${siteConfig.url}/${category}`,
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const cat = siteConfig.categories.find((c) => c.key === category);
  if (!cat) notFound();

  const { articles, total } = await getArticlesByCategory(category, 1, PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="category-page">
      <section className="category-banner">
        <h1>{cat.label}</h1>
        <p>{cat.description}</p>
        <span className="article-count">{total} articles</span>
      </section>
      <section className="article-grid">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </section>

      {totalPages > 1 && (
        <nav className="pagination">
          <span className="pagination-info">
            Page 1 of {totalPages}
          </span>
          <Link href={`/${category}/page/2`} className="pagination-btn">
            Next →
          </Link>
        </nav>
      )}
    </div>
  );
}
