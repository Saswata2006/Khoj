export const siteConfig = {
  name: "Khoj",
  tagline: "Find it. Sell it. Reclaim it.",
  description:
    "A community marketplace to buy and sell pre-owned items, report lost belongings, and reconnect people with what matters.",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  githubUrl: "https://github.com/Saswata2006/Khoj",
  navItems: [
    { label: "Marketplace", href: "#marketplace", badge: "Coming Soon" },
    { label: "Lost & Found", href: "#lost-and-found", badge: "Coming Soon" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Features", href: "#features" },
  ],
  links: {
    github: "https://github.com/Saswata2006/Khoj",
  },
  campusExclusive: false,
} as const;

export type SiteConfig = typeof siteConfig;
