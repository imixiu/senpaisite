import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `About Us — ${siteConfig.shortTitle || siteConfig.title}`,
  description: `Learn about ${siteConfig.shortTitle || siteConfig.title}.`,
};

export default function AboutPage() {
  return (
    <div className="static-page">
      <div className="static-page-inner">
        <h1>About {siteConfig.shortTitle || siteConfig.title}</h1>
        <section>
          <h2>Our Mission</h2>
          <p>{siteConfig.shortTitle || siteConfig.title} is dedicated to providing expert content and guides. We help readers make informed decisions with reliable, well-researched information.</p>
        </section>
        <section>
          <h2>What We Do</h2>
          <p>We publish in-depth articles, reviews, and guides covering every aspect of our niche. Each piece is written by experienced contributors.</p>
        </section>
        <section>
          <h2>Our Team</h2>
          <p>Our contributors include industry experts, experienced reviewers, and specialists sharing their expertise.</p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>Have questions? Visit our <a href="/contact">Contact page</a>.</p>
        </section>
      </div>
    </div>
  );
}
