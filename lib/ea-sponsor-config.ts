/**
 * EA Sponsor Delegation Configuration
 *
 * Maps Executive Assistants to the SLT members they support.
 * Used to enable EAs to view and manage (limited actions) 360 surveys
 * on behalf of their assigned SLT.
 */

export interface EASponsorMapping {
  /** EA's email address (case-insensitive matching) */
  eaEmail: string;
  /** SLT's email address (case-insensitive matching) */
  sltEmail: string;
  /** Display name for the SLT (used in tab label: "{name}'s 360s") */
  sltDisplayName: string;
}

/**
 * Hardcoded EA-to-SLT mappings
 * To add a new mapping, add an entry to this array
 */
export const EA_SPONSOR_MAPPINGS: EASponsorMapping[] = [
  {
    eaEmail: 'alina.grijalva@sonance.com',
    sltEmail: 'jasons@sonance.com',
    sltDisplayName: 'Jason',
  },
  // Add future mappings here:
  // {
  //   eaEmail: 'another.ea@sonance.com',
  //   sltEmail: 'another.slt@sonance.com',
  //   sltDisplayName: 'Another SLT',
  // },
];

/**
 * Get the SLT mapping for an EA user
 * @param eaEmail - The EA's email address
 * @returns The mapping if found, null otherwise
 */
export function getEASponsorMapping(eaEmail: string | null | undefined): EASponsorMapping | null {
  if (!eaEmail) return null;
  const emailLower = eaEmail.toLowerCase();
  return EA_SPONSOR_MAPPINGS.find(
    mapping => mapping.eaEmail.toLowerCase() === emailLower
  ) || null;
}

/**
 * Check if a user is an EA with delegation privileges
 * @param email - User's email address
 * @returns true if user is a configured EA
 */
export function isEAWithDelegation(email: string | null | undefined): boolean {
  return getEASponsorMapping(email) !== null;
}
