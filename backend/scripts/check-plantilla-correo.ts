/**
 * Comprobación de la plantilla de correo.
 *
 *     npx ts-node -T scripts/check-plantilla-correo.ts
 *     npx ts-node -T scripts/check-plantilla-correo.ts --ver   (deja los HTML en /tmp)
 *
 * Un correo no se puede probar como se prueba una página: no hay consola, no hay
 * error, y quien lo recibe no avisa de que le llegó roto. Lo que se comprueba
 * aquí es lo que rompería un correo de forma silenciosa.
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { plantillaCorreo, escapar } from '../src/common/email/plantilla-correo';

const enlace = 'https://syncsekai.com/activate/abc123';

const conBoton = plantillaCorreo({
  frontendUrl: 'https://syncsekai.com',
  titulo: 'Activa tu cuenta',
  parrafos: [`Hola <strong>${escapar('<script>x</script>')}</strong>, ya casi está.`],
  boton: { texto: 'Activar cuenta', url: enlace },
  nota: 'El enlace caduca en 24 horas.',
});

const conCodigo = plantillaCorreo({
  titulo: 'Tu código de acceso',
  parrafos: ['Escribe este código para continuar:'],
  codigo: '482913',
  nota: 'Caduca en 10 minutos.',
});

const peligroso = plantillaCorreo({
  titulo: 'Confirma que quieres eliminar tu cuenta',
  parrafos: ['Esto no se puede deshacer.'],
  boton: { texto: 'Confirmar eliminación', url: enlace, peligro: true },
});

// El nombre de usuario acaba dentro del HTML del correo.
assert.ok(
  !conBoton.includes('<script>'),
  'el nombre de usuario llega al correo sin escapar: un <script> ahí es HTML inyectado en la bandeja de quien lo reciba',
);
assert.ok(conBoton.includes('&lt;script&gt;'), 'el escapado no ha dejado el texto visible');

// Con las imágenes bloqueadas —que es como llega casi siempre— el correo tiene
// que seguir diciendo de quién es y qué hay que hacer.
const sinImagenes = conBoton.replace(/<img[^>]*>/g, '');
assert.ok(sinImagenes.includes('SyncSekai'), 'sin imágenes el correo no dice de quién es');
assert.ok(sinImagenes.includes('Activa tu cuenta'), 'sin imágenes se pierde el titular');

// Si el cliente despinta el botón, el enlace en texto es lo único que queda.
const veces = conBoton.split(enlace).length - 1;
assert.ok(veces >= 2, `el enlace sale ${veces} vez: sin la copia en texto, un botón despintado deja el correo inservible`);

// Outlook usa el motor de Word: ni flex, ni grid, ni hoja de estilos.
for (const [nombre, html] of Object.entries({ conBoton, conCodigo, peligroso })) {
  assert.ok(!/<style[\s>]/i.test(html), `${nombre}: lleva <style>, y hay clientes que lo tiran entero`);
  assert.ok(!/display:\s*(flex|grid)/i.test(html), `${nombre}: usa flex o grid, que Outlook no aplica`);
  assert.ok(html.startsWith('<!doctype html>'), `${nombre}: sin doctype hay clientes que se inventan el modo`);
  // Sin estas dos, Gmail y Outlook en modo oscuro invierten un correo que ya
  // es oscuro y lo dejan gris sobre gris.
  assert.ok(/name="color-scheme" content="dark"/.test(html), `${nombre}: falta la meta color-scheme`);
  assert.ok(
    /name="supported-color-schemes" content="dark"/.test(html),
    `${nombre}: falta la meta supported-color-schemes`,
  );
}

assert.ok(conCodigo.includes('482913'), 'el código no aparece');
assert.ok(peligroso.includes('#BE123C'), 'el botón destructivo no sale en rojo');

if (process.argv.includes('--ver')) {
  const destino = os.tmpdir();
  for (const [nombre, html] of Object.entries({ conBoton, conCodigo, peligroso })) {
    const fichero = path.join(destino, `correo-${nombre}.html`);
    fs.writeFileSync(fichero, html, 'utf8');
    console.log(fichero);
  }
}

console.log('plantilla de correo: OK (escapado, sin imágenes, sin botón, 3 formas)');
