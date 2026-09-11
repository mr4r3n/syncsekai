/**
 * Comprobación de que la copia de seguridad cubre todo el esquema.
 *
 *     npx ts-node -T scripts/check-backup-cobertura.ts
 *
 * Un modelo nuevo que no se añade a `backup.service.ts` deja de guardarse sin
 * ningún error. Este script compara los modelos de `schema.prisma` con lo que
 * el servicio lee y escribe. Si añades un modelo, inclúyelo en la copia o
 * ponlo en SIN_COPIA_A_PROPOSITO con el motivo.
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Modelos que NO se guardan a propósito. El motivo es parte de la lista. */
const SIN_COPIA_A_PROPOSITO: Record<string, string> = {
  Session: 'Sesiones abiertas. Restaurarlas revalidaría sesiones ajenas al momento de la copia.',
};

const raiz = path.resolve(__dirname, '..');
const esquema = fs.readFileSync(path.join(raiz, 'prisma', 'schema.prisma'), 'utf8');
const servicio = fs.readFileSync(
  path.join(raiz, 'src', 'modules', 'admin', 'backup.service.ts'),
  'utf8',
);

const modelos = [...esquema.matchAll(/^model\s+([A-Za-z]+)\s*\{/gm)].map((m) => m[1]);
assert.ok(modelos.length > 10, 'no se han leído los modelos del esquema');

const enMinuscula = (m: string) => m[0].toLowerCase() + m.slice(1);
const seGuarda = new Set([...servicio.matchAll(/prisma\.([a-zA-Z]+)\.findMany/g)].map((m) => m[1]));
const seRestaura = new Set(
  [...servicio.matchAll(/prisma\.([a-zA-Z]+)\.(?:upsert|createMany|create)\b/g)].map((m) => m[1]),
);

const faltanEnCopia: string[] = [];
const faltanEnRestauracion: string[] = [];

for (const modelo of modelos) {
  const clave = enMinuscula(modelo);
  if (SIN_COPIA_A_PROPOSITO[modelo]) continue;
  if (!seGuarda.has(clave)) faltanEnCopia.push(modelo);
  else if (!seRestaura.has(clave)) faltanEnRestauracion.push(modelo);
}

assert.deepEqual(
  faltanEnCopia,
  [],
  `estos modelos no se guardan en la copia: ${faltanEnCopia.join(', ')}.\n` +
    'Añádelos a backup.service.ts, o a SIN_COPIA_A_PROPOSITO en este fichero con su motivo.',
);

assert.deepEqual(
  faltanEnRestauracion,
  [],
  `estos modelos se guardan pero no se restauran: ${faltanEnRestauracion.join(', ')}.\n` +
    'Una copia que guarda algo y no lo devuelve es peor que no guardarlo: no avisa.',
);

console.log(
  `cobertura de la copia de seguridad: OK (${modelos.length} modelos, ` +
    `${Object.keys(SIN_COPIA_A_PROPOSITO).length} excluido a propósito)`,
);
