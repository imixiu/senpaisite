import Link from "next/link";
import { ArticlePreview } from "@/lib/types";

interface RelatedArticlesProps {
  articles: ArticlePreview[];
}

export function RelatedArticles({ articles }: RelatedArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <div className="related-articles">
      <h3>Related Articles</h3>
      {articles.map((article) => (
        <Link
          key={article.id}
          href={`/${article.type}/${article.slug}`}
          className="related-item"
        >
          {article.img && (
            <img src={article.img} alt={article.title} loading="lazy" width={80} height={45} />
          )}
          <p>{article.title}</p>
        </Link>
      ))}
    </div>
  );
}
