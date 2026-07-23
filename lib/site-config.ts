export const siteConfig = {
  name: "senpaisite",
  title: "SenpaiSite — Your Ultimate Anime & Manga Guide",
  shortTitle: "SenpaiSite",
  description: "In-depth anime reviews, manga guides, character analysis, and otaku culture coverage for passionate fans.",
  tagline: "Where Every Fan Finds Their Next Obsession",
  url: "https://senpaisite.com",
  ogImage: "", // Will be set after uploading to Vercel Blob
  colors: {
    primary: "#7c3aed",
    primaryDark: "#6d28d9",
    secondary: "#ec4899",
    accent: "#f59e0b",
  },
  categories: [
    { key: "anime-reviews", label: "Anime Reviews", description: "Honest, detailed reviews of the latest and greatest anime series and films" },
    { key: "manga-guides", label: "Manga Guides", description: "Reading orders, recommendations, and deep dives into manga masterpieces" },
    { key: "character-analysis", label: "Character Analysis", description: "Psychological breakdowns and character studies of iconic anime personalities" },
    { key: "otaku-culture", label: "Otaku Culture", description: "Exploring the world of anime fandom, conventions, merchandise, and Japanese pop culture" },
    { key: "seasonal-anime", label: "Seasonal Anime", description: "Seasonal previews, watchlists, and ongoing coverage of currently airing anime" },
    { key: "cosplay-fan", label: "Cosplay & Fan Art", description: "Cosplay tips, fan art showcases, and creative community highlights" },
    { key: "power-scaling", label: "Power Scaling", description: "In-depth power analyses, tier rankings, and battle comparisons across anime and manga" },
    { key: "lore", label: "Lore & Worldbuilding", description: "Deep dives into anime and manga lore, world histories, and mythological references" },
  ] as { key: string; label: string; description: string }[],
};
