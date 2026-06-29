self.__MIDDLEWARE_MATCHERS = [
  {
    "regexp": "^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/((?!api|_next|favicon|sitemap|robots|public|assets).*))(\\\\.json)?[\\/#\\?]?$",
    "originalSource": "/((?!api|_next|favicon|sitemap|robots|public|assets).*)"
  }
];self.__MIDDLEWARE_MATCHERS_CB && self.__MIDDLEWARE_MATCHERS_CB()