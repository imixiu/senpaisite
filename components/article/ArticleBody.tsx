interface ArticleBodyProps {
  body: string;
}

function addHeadingIds(html: string): string {
  return html.replace(/<h2([^>]*)>(.*?)<\/h2>/gi, (_match, attrs, content) => {
    const text = content.replace(/<[^>]+>/g, "").trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `<h2${attrs} id="${id}">${content}</h2>`;
  });
}

export function ArticleBody({ body }: ArticleBodyProps) {
  return (
    <div
      className="article-content"
      dangerouslySetInnerHTML={{ __html: addHeadingIds(body) }}
    />
  );
}
