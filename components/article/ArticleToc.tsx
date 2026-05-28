interface ArticleTocProps {
  body: string;
}

export function ArticleToc({ body }: ArticleTocProps) {
  const headingRegex = /<h2[^>]*>(.*?)<\/h2>/gi;
  const headings: { text: string; id: string }[] = [];
  let match;
  while ((match = headingRegex.exec(body)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    headings.push({ text, id });
  }

  if (headings.length === 0) return null;

  return (
    <div className="table-of-contents">
      <h3>Table of Contents</h3>
      <ul className="toc-list">
        {headings.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`}>{h.text}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
