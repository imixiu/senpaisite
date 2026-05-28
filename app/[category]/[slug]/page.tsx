export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getArticle, getRelatedArticles } from "@/lib/queries";
import { siteConfig } from "@/lib/site-config";
import { ArticleHeader } from "@/components/article/ArticleHeader";
import { ArticleBody } from "@/components/article/ArticleBody";
import { ArticleToc } from "@/components/article/ArticleToc";
import { RelatedArticles } from "@/components/article/RelatedArticles";
import { Breadcrumb, BreadcrumbJsonLd } from "@/components/article/Breadcrumb";

interface ArticlePageProps {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { category, slug } = await params;
  const article = await getArticle(category, slug);
  if (!article) return { title: "Article Not Found" };
  return {
    title: `${article.title} - ${siteConfig.title}`,
    description: article.description,
    alternates: {
      canonical: `${siteConfig.url}/${category}/${slug}`,
    },
    openGraph: {
      title: article.title,
      description: article.description,
      images: article.img ? [article.img] : [],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { category, slug } = await params;
  const article = await getArticle(category, slug);
  if (!article) notFound();

  const relatedArticles = await getRelatedArticles(article.type, article.id);
  const categoryLabel = siteConfig.categories.find(c => c.key === category)?.label || category;
  
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: categoryLabel, href: `/${category}` },
    { label: article.title },
  ];

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description || "",
    image: article.img || undefined,
    author: article.author
      ? { "@type": "Person", name: article.author }
      : { "@type": "Organization", name: siteConfig.title },
    datePublished: article.publishDate || undefined,
    dateModified: article.updatedAt || article.publishDate || undefined,
    publisher: {
      "@type": "Organization",
      name: siteConfig.title,
      logo: { "@type": "ImageObject", url: `${siteConfig.url}/favicon.ico` },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteConfig.url}/${category}/${slug}`,
    },
  };

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} siteUrl={siteConfig.url} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <div className="article-layout">
        <div className="article-main">
          <Breadcrumb items={breadcrumbItems} />
          <article className="article-container">
            <ArticleHeader article={article} />
            <ArticleBody body={article.body} />
            <div className="author-section-card">
              <div className="author-avatar">
                {article.author ? article.author.charAt(0).toUpperCase() : "?"}
              </div>
              <div className="author-info">
                <h3>{article.author || `${siteConfig.name} Team`}</h3>
                <p>Contributing writer at {siteConfig.title}.</p>
              </div>
            </div>
          </article>
        </div>
        <aside className="article-sidebar">
          <ArticleToc body={article.body} />
          <RelatedArticles articles={relatedArticles} />
        </aside>
      </div>
    </>
  );
}
