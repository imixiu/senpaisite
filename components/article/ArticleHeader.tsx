import { Article } from "@/lib/types";

interface ArticleHeaderProps {
  article: Article;
}

export function ArticleHeader({ article }: ArticleHeaderProps) {
  const formatDisplayDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  };

  return (
    <div className="article-header">
      <h1>{article.title}</h1>
      <div className="article-meta">
        {article.publishDate && (
          <time className="date">{formatDisplayDate(article.publishDate)}</time>
        )}
        {article.author && <span className="author">By {article.author}</span>}
      </div>
      {article.img && (
        <img src={article.img} alt={article.title} className="article-hero-img" width={800} height={450} />
      )}
    </div>
  );
}
