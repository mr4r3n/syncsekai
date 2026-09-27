/**
 * Country name in interface language from ISO code.
 *
 * Backend stores name in Spanish (from its ISO table); rendering
 * code with `Intl.DisplayNames` gives name in active language without
 * maintaining another table. If code is invalid, original value is returned.
 */
export function regionName(code: string | undefined | null, locale: string, fallback = '', style: 'long' | 'short' = 'long'): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return fallback;
  try {
    const name = new Intl.DisplayNames([locale], { type: 'region', style }).of(code.toUpperCase());
    // Non-existent code (XX) returned as-is: not a name.
    return name && name !== code.toUpperCase() ? name : fallback;
  } catch {
    return fallback;
  }
}
