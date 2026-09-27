/**
 * Chooses between singular and plural inside a translation.
 *
 * A dictionary value can provide both forms separated by " | ":
 *
 *     "visitas": "{n} visita | {n} visitas"
 *
 * Without this, the only recourse was writing "1 users"—as previously seen—or
 * inventing "user(s)". Form is determined by number, not template author,
 * and in English it cannot be bypassed.
 *
 * Opt-in: strings without delimiter pass through unchanged, keeping existing
 * strings intact.
 *
 * Two forms, as required by Spanish and English. Languages with more
 * categories (ru, pl, ar) require `Intl.PluralRules`; right place to integrate
 * it is this function alone.
 */
export function choosePluralForm(valor: string, n: unknown): string {
  const forms = valor.split(' | ');
  if (forms.length !== 2) return valor;

  const num = Number(n);
  // A non-numeric `n` cannot decide: defaults to plural, which is
  // the neutral form of the two.
  return Number.isFinite(num) && Math.abs(num) === 1 ? forms[0] : forms[1];
}
