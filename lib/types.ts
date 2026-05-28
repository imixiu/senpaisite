export interface Article {
  id: number;
  slug: string;
  site: string;
  type: string;
  title: string;
  description: string;
  img: string | null;
  author: string | null;
  publishDate: string | null;
  body: string;
  url: string | null;
  language: string | null;
  updatedAt?: string;
  tag: string | null;
  isOnline: string;
}

export interface ArticlePreview {
  id: number;
  slug: string;
  site: string;
  type: string;
  title: string;
  description: string;
  img: string | null;
  author: string | null;
  publishDate: string | null;
  tag: string | null;
  isOnline: string;
}

export interface Author {
  id: number;
  site: string;
  name: string;
  slug: string;
  img: string | null;
  description: string | null;
  language: string | null;
}
