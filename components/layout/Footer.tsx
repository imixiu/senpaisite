import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-brand">
          <span className="footer-logo">{siteConfig.title}</span>
          <p>{siteConfig.description}</p>
        </div>
        <nav className="footer-nav">
          <h4>Categories</h4>
          <ul>
            {siteConfig.categories.map((cat) => (
              <li key={cat.key}>
                <Link href={`/${cat.key}`}>{cat.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav className="footer-nav">
          <h4>Site</h4>
          <ul>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/author">Authors</Link></li>
          </ul>
        </nav>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} {siteConfig.title}. All rights reserved.</p>
      </div>
    </footer>
  );
}
