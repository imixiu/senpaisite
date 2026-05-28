import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 301 redirect old ?page=N query params to static /page/N URLs
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const pageParam = searchParams.get("page");

  if (pageParam) {
    const page = parseInt(pageParam, 10);
    if (isNaN(page) || page <= 1) {
      // ?page=0 or ?page=1 → redirect to clean /{category}
      const url = request.nextUrl.clone();
      url.searchParams.delete("page");
      return NextResponse.redirect(url, 301);
    }
    if (page > 1) {
      // ?page=N → redirect to /{category}/page/N
      const url = request.nextUrl.clone();
      url.searchParams.delete("page");
      url.pathname = `${pathname}/page/${page}`;
      return NextResponse.redirect(url, 301);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Match all top-level routes except static assets and API
  matcher: ["/((?!api|_next|favicon|sitemap|robots|public|assets).*)"],
};
