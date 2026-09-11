/**
 * Comprobación de que la URL de portada lleva siempre la pista del título.
 *
 *     npx ts-node -T scripts/check-portadas.ts
 *
 * `/api/covers` resuelve en cadena: AniList, mapeo externo de Kitsu y, por
 * último, búsqueda por título en Kitsu. El último paso necesita el título y es
 * el único que funciona cuando AniList no responde. Sin la pista, la portada
 * cae al marcador sin ningún error.
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { urlPortadaAnilist } from '../src/modules/covers/covers.service';

const url = urlPortadaAnilist(50040, 'Super no Ura de Yani Suu Futari');
assert.ok(url.includes('title='), 'la URL sale sin la pista del título');
assert.ok(
  url.includes('Super%20no%20Ura'),
  `el título no está codificado para la URL: ${url}`,
);
assert.equal(
  urlPortadaAnilist(50040),
  '/api/covers/al_50040',
  'sin título no debe colgar un title= vacío, que no sirve de pista y rompe la caché',
);

// Busca URLs de portada construidas a mano fuera del ayudante.
const raiz = path.resolve(__dirname, '..', 'src', 'modules');
const aMano: string[] = [];

function recorrer(dir: string) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      recorrer(completo);
      continue;
    }
    if (!entrada.name.endsWith('.ts')) continue;
    // El propio servicio de portadas y su controlador sí manejan la forma cruda.
    if (completo.includes(`covers${path.sep}`)) continue;

    const texto = fs.readFileSync(completo, 'utf8');
    for (const linea of texto.split('\n')) {
      // `al_` construido a mano y sin pista en la misma línea.
      if (/\/api\/covers\/al_/.test(linea) && !/title=/.test(linea)) {
        aMano.push(`${path.relative(raiz, completo)}: ${linea.trim()}`);
      }
    }
  }
}

recorrer(raiz);

assert.deepEqual(
  aMano,
  [],
  'estas líneas montan la URL de portada a mano y sin la pista del título:\n' +
    aMano.map((l) => `  ${l}`).join('\n') +
    '\nUsa urlPortadaAnilist(id, titulo) de covers.service.ts.',
);

console.log('portadas: OK (la pista del título viaja y no queda ninguna URL a mano)');
