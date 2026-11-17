const ENTRY_LENGTH = 3;
const FIRST_DIGIT = /^[1-8]$/;
const DIGIT = /^\d$/;

export interface KeypadResult {
  /** Digits typed so far; '' after a completed entry. */
  entry: string;
  /** Set when the entry reached three digits. */
  page?: number;
}

/**
 * Applies one key to a partial page-number entry. Pure.
 * The first digit must be 1-8 (valid pages are 100-899); other keys are ignored.
 */
export function pressKey(entry: string, key: string): KeypadResult {
  if (!DIGIT.test(key)) return { entry };
  if (entry === '' && !FIRST_DIGIT.test(key)) return { entry };

  const next = entry + key;
  if (next.length === ENTRY_LENGTH) return { entry: '', page: Number(next) };
  return { entry: next };
}

/** Header display of a partial entry, e.g. '30' -> 'P30-'. */
export function formatEntry(entry: string): string {
  return `P${entry.padEnd(ENTRY_LENGTH, '-')}`;
}
