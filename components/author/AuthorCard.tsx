import Link from "next/link";
import { Author } from "@/lib/types";

interface AuthorCardProps {
  author: Author;
}

export function AuthorCard({ author }: AuthorCardProps) {
  return (
    <Link href={`/author/${author.slug}`} className="author-card">
      <div className="author-avatar">
        {author.img ? (
          <img src={author.img} alt={author.name} width={80} height={80} />
        ) : (
          <span>{author.name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <h3>{author.name}</h3>
      {author.description && <p>{author.description}</p>}
    </Link>
  );
}
