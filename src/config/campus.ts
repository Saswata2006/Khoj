/**
 * Platform configuration for Khoj — public community marketplace and lost &
 * found. No college-domain restrictions. Any valid email can register.
 */
export const campusConfig = {
  platformName: process.env.NEXT_PUBLIC_CAMPUS_NAME || "Community",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@khoj.app",

  // Optional list of residential areas / hostel blocks shown in the UI.
  // These are suggestions only; users can enter their own location.
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

  // Platform is open to all — no email domain restrictions.
  verification: {
    requireCollegeEmail: false,
    requireHostelBlock: false,
  },
};

export type CampusConfig = typeof campusConfig;
