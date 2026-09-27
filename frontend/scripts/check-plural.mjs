/**
 * Comprobación de la regla de plural de las traducciones.
 *
 *     node --experimental-strip-types scripts/check-plural.mjs
 *
 * Es la única pieza no trivial del traductor: decide qué forma se le enseña al
 * usuario. Si se rompe, el síntoma es un «1 users» que nadie mira dos veces.
 */
import assert from 'node:assert/strict';
import { choosePluralForm } from '../src/i18n/plural.ts';

const ES = '{n} visita | {n} visitas';
const EN = '{n} user | {n} users';

// Lo que motivó todo esto.
assert.equal(choosePluralForm(EN, 1), '{n} user');
assert.equal(choosePluralForm(EN, 5), '{n} users');
assert.equal(choosePluralForm(ES, 1), '{n} visita');
assert.equal(choosePluralForm(ES, 0), '{n} visitas', 'cero es plural en es/en');
assert.equal(choosePluralForm(ES, 2), '{n} visitas');

// -1 elemento no existe, pero si llega, la forma correcta es la singular.
assert.equal(choosePluralForm(ES, -1), '{n} visita');

// Sin separador no se toca nada: es lo que hace que las cadenas que ya había
// sigan saliendo igual.
assert.equal(choosePluralForm('Sin avatar todavía', 1), 'Sin avatar todavía');
assert.equal(choosePluralForm('Página {page} de {total}', 3), 'Página {page} de {total}');

// Un `n` que no sirve para decidir no puede colar el singular por accidente.
assert.equal(choosePluralForm(ES, undefined), '{n} visitas');
assert.equal(choosePluralForm(ES, null), '{n} visitas');
assert.equal(choosePluralForm(ES, 'muchas'), '{n} visitas');
assert.equal(choosePluralForm(ES, NaN), '{n} visitas');

// Un número en texto sí sirve: `t` recibe `string | number`.
assert.equal(choosePluralForm(ES, '1'), '{n} visita');

// Tres formas no son dos: se deja la cadena entera antes que elegir a ciegas.
const TRES = 'a | b | c';
assert.equal(choosePluralForm(TRES, 1), TRES);

console.log('regla de plural: OK');
