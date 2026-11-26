import { getEnv } from "./env";

/**
 * Campus configuration.
 * Configurable defaults that do not assume or invent specific institution details.
 */
export const campusConfig = {
  institutionName: process.env.NEXT_PUBLIC_CAMPUS_NAME || "Campus Community",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@campus.edu",

  // Configurable list of hostel blocks/residences
  hostelBlocks: [
    "Block A",
    "Block B",
    "Block C",
    "Block D",
    "Hostel 1",
    "Hostel 2",
    "Hostel 3",
    "Girls Hostel",
    "Boys Hostel",
    "Faculty Quarters",
    "Day Scholar",
  ],

  // Verification requirements
  verification: {
    requireCollegeEmail: true,
    requireHostelBlock: false,
  },

  /**
   * Helper to check if an email domain matches allowed campus domains.
   */
  isEmailDomainAllowed(email: string): boolean {
    if (!email || !email.includes("@")) return false;
    const domain = email.split("@")[1]?.toLowerCase().trim();
    if (!domain) return false;

    const env = getEnv();
    const allowed = env.ALLOWED_EMAIL_DOMAINS;
    if (!allowed || allowed.length === 0) {
      // In development or if not configured, allow any domain or institutional email
      return true;
    }
    return allowed.some((allowedDomain) => domain === allowedDomain.toLowerCase().trim());
  },
};

export type CampusConfig = typeof campusConfig;
