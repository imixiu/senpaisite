import Link from "next/link";
import { ArticlePreview } from "@/lib/types";

interface ArticleCardProps {
  article: ArticlePreview;
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Link
      href={`/${article.type}/${article.slug}`}
      className="article-card"
    >
      <article>
        {article.img ? (
          <img
            src={article.img}
            alt={article.title}
            className="card-img"
            loading="lazy"
            width={400}
            height={225}
          />
        ) : (
          <div className="card-img-placeholder" />
        )}
        <div className="card-body">
          <span className="card-category">{article.type}</span>
          <h3>{article.title}</h3>
          <p>{article.description}</p>
          <div className="card-meta">
            {article.author && <span className="card-author">{article.author}</span>}
            {article.publishDate && <time>{article.publishDate}</time>}
          </div>
        </div>
      </article>
    </Link>
  );
}
