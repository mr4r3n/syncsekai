/**
 * Undoes the HTML escaping some sources put on titles. The Jellyfin Webhook
 * plugin fills its template with Handlebars, which escapes by default: a series
 * called `"Kanteishi"` arrives as `&quot;Kanteishi&quot;` and "JoJo's" as
 * "JoJo&#x27;s", and then matches neither the trackers nor the other servers.
 * Only the entities Handlebars writes; one pass, so `&amp;quot;` becomes `&quot;`.
 */
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#x27': "'",
  '#39': "'",
  '#x60': '`',
  '#x3d': '=',
  '#x2f': '/',
};

export const decodeHtmlEntities = (text: string): string =>
  text.replace(/&(amp|lt|gt|quot|#x27|#39|#x60|#x3d|#x2f);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
