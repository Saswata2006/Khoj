export const siteConfig = {
  name: "Khoj",
  tagline: "Find it. Sell it. Reclaim it.",
  description:
    "A campus-exclusive marketplace and lost & found platform for verified college students. Buy and sell second-hand items, post lost & found belongings, and connect safely within your campus community.",
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
  campusExclusive: true,
} as const;

export type SiteConfig = typeof siteConfig;
