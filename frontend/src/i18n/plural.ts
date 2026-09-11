/**
 * Elige entre singular y plural dentro de una traducción.
 *
 * Un valor del diccionario puede traer las dos formas separadas por « | »:
 *
 *     "visitas": "{n} visita | {n} visitas"
 *
 * Sin esto, la única salida era escribir «1 users» —que es lo que se veía— o
 * inventarse un «usuario(s)». La forma la decide el número, no quien escribe la
 * plantilla, y en inglés no hay manera de esquivarlo.
 *
 * Es opt-in: una cadena sin el separador sale tal cual, así que las que ya
 * existían no cambian.
 *
 * Dos formas, que es lo que piden español e inglés. Idiomas con más
 * categorías (ru, pl, ar) necesitarían `Intl.PluralRules`; el sitio donde
 * meterlo es esta función y nada más.
 */
export function elegirFormaPlural(valor: string, n: unknown): string {
  const formas = valor.split(' | ');
  if (formas.length !== 2) return valor;

  const num = Number(n);
  // Un `n` que no es número no puede decidir: se queda el plural, que es la
  // forma neutra de las dos.
  return Number.isFinite(num) && Math.abs(num) === 1 ? formas[0] : formas[1];
}
