import Link from "next/link";

interface Article {
  id: number;
  slug: string;
  title: string;
  description?: string | null;
  img?: string | null;
  publishDate?: string | null;
  type: string;
}

interface CategoryJsonLdProps {
  siteUrl: string;
  categoryKey: string;
  categoryLabel: string;
  categoryDescription: string;
  articles: Article[];
  totalArticles: number;
  currentPage: number;
  totalPages: number;
}

export function CategoryJsonLd({
  siteUrl,
  categoryKey,
  categoryLabel,
  categoryDescription,
  articles,
  totalArticles,
  currentPage,
  totalPages,
}: CategoryJsonLdProps) {
  const categoryUrl = currentPage === 1 ? `${siteUrl}/${categoryKey}` : `${siteUrl}/${categoryKey}/page/${currentPage}`;

  // CollectionPage schema
  const collectionPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: currentPage === 1 ? categoryLabel : `${categoryLabel} — Page ${currentPage}`,
    description: categoryDescription,
    url: categoryUrl,
    isPartOf: {
      "@type": "WebSite",
      url: siteUrl,
    },
  };

  // ItemList schema (max 50 items per schema.org recommendation)
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${categoryLabel} Articles`,
    numberOfItems: totalArticles,
    url: categoryUrl,
    itemListElement: articles.slice(0, 50).map((article, index) => {
      const articleUrl = `${siteUrl}/${article.type}/${article.slug}`;
      const item: Record<string, unknown> = {
        "@type": "ListItem",
        position: (currentPage - 1) * articles.length + index + 1,
        item: {
          "@type": "Article",
          "@id": articleUrl,
          headline: article.title,
          description: article.description || "",
          url: articleUrl,
          ...(article.img ? { image: article.img } : {}),
          ...(article.publishDate ? { datePublished: article.publishDate } : {}),
        },
      };
      return item;
    }),
  };

  // BreadcrumbList schema
  const breadcrumbItems = [
    { label: "Home", href: "/", position: 1 },
    { label: categoryLabel, href: `/${categoryKey}`, position: 2 },
  ];

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item) => ({
      "@type": "ListItem",
      position: item.position,
      name: item.label,
      item: `${siteUrl}${item.href}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Visible breadcrumb navigation */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <ol className="breadcrumb-list">
          <li className="breadcrumb-item">
            <Link href="/">Home</Link>
          </li>
          <li className="breadcrumb-item">
            <span className="breadcrumb-current">{categoryLabel}</span>
          </li>
        </ol>
      </nav>
    </>
  );
}
