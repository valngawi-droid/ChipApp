/**
 * Presentation-layer helpers for ChipApp's end-to-end encryption surface.
 *
 * NOTE: real E2EE requires the Signal double-ratchet with native key storage
 * (libsignal / expo-secure-store). These helpers only derive the *displayed*
 * artefacts — the 60-digit safety number and key fingerprints — so the UI can
 * render the security screens deterministically without shipping a fake
 * cipher that might be mistaken for actual protection.
 */

/** FNV-1a — small, fast, dependency-free, deterministic across platforms. */
const fnv1a = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

/** Stable 64-char hex fingerprint for an identity string. */
export const identityFingerprint = (identity: string): string => {
  let out = '';
  for (let block = 0; block < 8; block += 1) {
    out += fnv1a(`${identity}:${block}`).toString(16).padStart(8, '0');
  }
  return out;
};

/**
 * The 60-digit safety number WhatsApp shows under "Verify security code",
 * rendered as 12 groups of 5 digits.
 */
export const safetyNumber = (localIdentity: string, remoteIdentity: string): string[] => {
  const pair = [localIdentity, remoteIdentity].sort().join('|');
  const groups: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    groups.push(String(fnv1a(`${pair}#${i}`) % 100000).padStart(5, '0'));
  }
  return groups;
};

/** Short session id for the linked-devices list. */
export const shortSessionId = (seed: string) => identityFingerprint(seed).slice(0, 12).toUpperCase();
