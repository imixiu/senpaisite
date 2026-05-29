import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getArticlesByCategory } from "@/lib/queries";
import { siteConfig } from "@/lib/site-config";
import { ArticleCard } from "@/components/article/ArticleCard";
import { CategoryJsonLd } from "@/components/article/CategoryJsonLd";

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
    title: `${cat.label} | ${siteConfig.shortTitle}`,
    description: cat.description,
    alternates: {
      canonical: `${siteConfig.url}/${category}`,
    },
    openGraph: {
      title: `${cat.label} | ${siteConfig.shortTitle}`,
      description: cat.description,
      url: `${siteConfig.url}/${category}`,
      images: siteConfig.ogImage ? [siteConfig.ogImage] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${cat.label} | ${siteConfig.shortTitle}`,
      description: cat.description,
      images: siteConfig.ogImage ? [siteConfig.ogImage] : [],
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
      <CategoryJsonLd
        siteUrl={siteConfig.url}
        categoryKey={category}
        categoryLabel={cat.label}
        categoryDescription={cat.description}
        articles={articles}
        totalArticles={total}
        currentPage={1}
        totalPages={totalPages}
      />
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
