export const dynamic = "force-dynamic";

import { getAllAuthors } from "@/lib/queries";
import { siteConfig } from "@/lib/site-config";
import { AuthorCard } from "@/components/author/AuthorCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `Our Authors | ${siteConfig.shortTitle}`,
  description: `Meet the expert authors behind ${siteConfig.title}.`,
};

export default async function AuthorsPage() {
  const authors = await getAllAuthors();

  return (
    <div className="authors-page">
      <section className="authors-banner">
        <h1>Our Expert Authors</h1>
        <p>Meet the professionals behind our content.</p>
      </section>
      <section className="authors-grid">
        {authors.map((author) => (
          <AuthorCard key={author.id} author={author} />
        ))}
      </section>
    </div>
  );
}
