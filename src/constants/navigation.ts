export interface NavItem {
  title: string;
  href: string;
  disabled?: boolean;
  external?: boolean;
  badge?: string;
  description?: string;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  {
    title: "Marketplace",
    href: "#marketplace",
    badge: "Coming Soon",
    description: "Buy and sell second-hand textbooks, electronics, cycles, and student essentials.",
  },
  {
    title: "Lost & Found",
    href: "#lost-and-found",
    badge: "Coming Soon",
    description: "Report misplaced belongings and submit verified ownership claims.",
  },
  {
    title: "How It Works",
    href: "#how-it-works",
    description: "Simple four-step process for verified campus exchanges.",
  },
  {
    title: "Campus Security",
    href: "#security",
    description: "Strict college-email verification and anti-scam moderation.",
  },
];

export const FOOTER_NAV_SECTIONS = [
  {
    title: "Platform",
    links: [
      { title: "Marketplace", href: "#marketplace", disabled: true },
      { title: "Lost & Found", href: "#lost-and-found", disabled: true },
      { title: "Campus Verification", href: "#security", disabled: false },
      { title: "How It Works", href: "#how-it-works", disabled: false },
    ],
  },
  {
    title: "Categories",
    links: [
      { title: "Books & Study Material", href: "#marketplace", disabled: true },
      { title: "Electronics & Gadgets", href: "#marketplace", disabled: true },
      { title: "Cycles & Commute", href: "#marketplace", disabled: true },
      { title: "Stationery & Tools", href: "#marketplace", disabled: true },
    ],
  },
  {
    title: "Community & Trust",
    links: [
      { title: "Campus Guidelines", href: "#guidelines", disabled: true },
      { title: "Ownership Claims Guide", href: "#claims", disabled: true },
      { title: "Safety Tips", href: "#safety", disabled: true },
      { title: "System Health Status", href: "/api/health", disabled: false },
    ],
  },
];
