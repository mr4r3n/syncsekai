/**
 * Validation of the URLs an administrator configures for the site footer.
 *
 * These strings end up in the `href` of a link that everyone who opens the
 * landing page sees, including people without an account. A `javascript:`
 * there is not a broken link: it is script execution served by us, on our
 * domain, with the session of whoever clicks. `data:` allows the same through
 * another door, and `//othersite.com` looks like an internal path and is not.
 *
 * That is why this is a list of what is accepted, not of what is forbidden: a
 * blocklist always lags behind the next scheme someone invents, and browsers
 * tolerate things a naive block lets through.
 */

/** Maximum length. No legitimate footer URL is anywhere near this long. */
const MAX = 500;

/**
 * Any whitespace or control character.
 *
 * It is the classic way to sneak a forbidden scheme past a filter that only
 * looks at the prefix: a line break in the middle of `javascript:` hides it
 * from the check and the browser still interprets it.
 */
const WHITESPACE_OR_CONTROL = /[\s\u0000-\u001F\u007F]/;

/**
 * Normalizes and validates an external link URL.
 * Returns the cleaned URL, or null if it is not acceptable.
 *
 * Only `https://` passes. `http://` is left out on purpose: these are links we
 * publish, and sending people to plain text is indefensible; if a friendly
 * site has no TLS, it does not get linked.
 */
export function normalizeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const cleaned = value.trim();
  if (!cleaned || cleaned.length > MAX) return null;
  if (WHITESPACE_OR_CONTROL.test(cleaned)) return null;

  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    // Without a scheme there is no absolute URL: rejects relative paths and `//host`.
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (!url.hostname || !url.hostname.includes('.')) return null;

  // Embedded credentials: `https://user:password@site.com`. They are never needed
  // here and serve to disguise the real target from whoever looks at the link.
  if (url.username || url.password) return null;

  return url.toString();
}

/**
 * Normalizes and validates an email address for the contact link.
 * It is stored already as `mailto:`, which is how it will be used.
 */
export function normalizeExternalEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const cleaned = value.trim().replace(/^mailto:/i, '');
  if (!cleaned || cleaned.length > MAX) return null;
  if (WHITESPACE_OR_CONTROL.test(cleaned)) return null;

  // Deliberately strict: this is an address an administrator types into a
  // form, not a sign-up field that has to accept oddities.
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(cleaned)) return null;

  return `mailto:${cleaned}`;
}

/**
 * Validates either of the two forms, which is what `SiteLink.url` stores.
 */
export function normalizeLinkTarget(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().toLowerCase().startsWith('mailto:')) {
    return normalizeExternalEmail(value);
  }
  return normalizeExternalUrl(value);
}

/**
 * Text an administrator writes and that is shown as is (name and
 * description). React already escapes the content when rendering, so all
 * that is needed here is to cap the length and strip control characters, so
 * that a 10,000-character name does not break the footer layout.
 */
export function normalizeLinkText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;

  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!cleaned) return null;

  return cleaned.slice(0, max);
}
