export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAuthorBySlug, getArticlesByAuthor } from "@/lib/queries";
import { siteConfig } from "@/lib/site-config";
import { ArticleCard } from "@/components/article/ArticleCard";

interface AuthorPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) return { title: "Author Not Found" };
  return {
    title: `${author.name} | ${siteConfig.shortTitle}`,
    description: author.description || `Articles by ${author.name}`,
  };
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  const articles = await getArticlesByAuthor(author.name);

  return (
    <div className="author-detail-page">
      <section className="author-profile">
        <div className="author-avatar-large">
          {author.img ? (
            <img src={author.img} alt={author.name} width={120} height={120} />
          ) : (
            <span>{author.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <h1>{author.name}</h1>
        {author.description && <p className="author-bio">{author.description}</p>}
        <span className="article-count">{articles.length} articles published</span>
      </section>
      <section className="author-articles">
        <h2>Articles by {author.name}</h2>
        <div className="article-grid">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>
    </div>
  );
}
