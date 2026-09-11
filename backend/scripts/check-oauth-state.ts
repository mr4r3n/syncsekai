/**
 * Comprobación del atado del state de OAuth al navegador que lo inició.
 *
 *     npx ts-node -T scripts/check-oauth-state.ts
 *
 * Ejercita los métodos REALES `createOAuthState` y `consumeOAuthState` de
 * AuthService, con un Prisma de mentira en memoria. No toca la base ni la red.
 *
 * Sin el secreto de la transacción, un callback válido presentado en otro
 * navegador crearía allí la sesión de quien inició el flujo.
 */
import assert from 'node:assert/strict';
import { AuthService } from '../src/modules/auth/auth.service';

/** Prisma mínimo: solo la tabla de un solo uso que usa el state. */
function prismaFalso() {
  const filas = new Map<string, string>();
  return {
    systemSetting: {
      create: async ({ data }: any) => {
        filas.set(data.key, data.value);
        return data;
      },
      deleteMany: async ({ where }: any) => {
        if (typeof where.key === 'object') return { count: 0 }; // limpieza por antigüedad
        const actual = filas.get(where.key);
        if (actual !== undefined && actual === where.value) {
          filas.delete(where.key);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    _filas: filas,
  };
}

function servicio() {
  // Se instancia sin pasar por el constructor: estos dos métodos solo usan
  // configService y prisma, y construir el AuthService entero arrastraría media
  // aplicación a una comprobación que no la necesita.
  const svc: any = Object.create(AuthService.prototype);
  svc.configService = { get: (k: string) => (k === 'OAUTH_STATE_SECRET' ? 'secreto-de-prueba-solo-para-esta-comprobacion' : '') };
  svc.prisma = prismaFalso();
  return svc;
}

async function rechaza(fn: () => Promise<unknown>, mensaje: string) {
  let fallo = false;
  try {
    await fn();
  } catch {
    fallo = true;
  }
  assert.equal(fallo, true, mensaje);
}

async function main() {
  // 1. El camino bueno: mismo navegador, mismo secreto.
  {
    const svc = servicio();
    const { state, txSecret } = await svc.createOAuthState({
      returnTo: '/connections',
      provider: 'google',
      intent: 'login',
    });
    const r = await svc.consumeOAuthState(state, 'google', txSecret);
    assert.equal(r.intent, 'login');
    assert.equal(r.returnTo, '/connections');
  }

  // 2. LO QUE SE ARREGLA: state válido, otro navegador.
  {
    const svc = servicio();
    const { state } = await svc.createOAuthState({
      returnTo: '/connections',
      provider: 'google',
      intent: 'login',
    });
    await rechaza(
      () => svc.consumeOAuthState(state, 'google', ''),
      'un callback sin la cookie de la transaccion debe rechazarse',
    );
    await rechaza(
      () => svc.consumeOAuthState(state, 'google', 'f'.repeat(64)),
      'un callback con otro secreto debe rechazarse',
    );
  }

  // 3. Y ese rechazo NO puede gastar el state: si lo gastara, bastaria con
  //    presentar el callback en otro sitio para dejar sin efecto el inicio de
  //    sesion legitimo. Es la razon de comprobar el navegador ANTES de consumir.
  {
    const svc = servicio();
    const { state, txSecret } = await svc.createOAuthState({
      returnTo: '/connections',
      provider: 'discord',
      intent: 'login',
    });
    await rechaza(() => svc.consumeOAuthState(state, 'discord', ''), 'sin cookie, rechazado');
    const r = await svc.consumeOAuthState(state, 'discord', txSecret);
    assert.equal(r.intent, 'login', 'el navegador legitimo sigue pudiendo usar su state');
  }

  // 4. Un solo uso, incluso con el secreto correcto.
  {
    const svc = servicio();
    const { state, txSecret } = await svc.createOAuthState({
      returnTo: '/connections',
      provider: 'google',
      intent: 'login',
    });
    await svc.consumeOAuthState(state, 'google', txSecret);
    await rechaza(
      () => svc.consumeOAuthState(state, 'google', txSecret),
      'un state ya usado no puede volver a valer',
    );
  }

  // 5. Las comprobaciones que ya existian siguen en pie.
  {
    const svc = servicio();
    const { state, txSecret } = await svc.createOAuthState({
      returnTo: '/connections',
      provider: 'google',
      intent: 'login',
    });
    await rechaza(
      () => svc.consumeOAuthState(state, 'discord', txSecret),
      'un state de Google no vale para el callback de Discord',
    );

    const roto = Buffer.from(
      JSON.stringify({
        data: JSON.stringify({
          returnTo: '/connections',
          userId: '',
          provider: 'google',
          intent: 'login',
          ts: Date.now(),
          nonce: 'a'.repeat(64),
          txHash: 'b'.repeat(64),
        }),
        sig: 'c'.repeat(64),
      }),
    ).toString('base64url');
    await rechaza(
      () => svc.consumeOAuthState(roto, 'google', txSecret),
      'una firma inventada debe rechazarse',
    );
  }

  // 6. Vinculacion: el userId sigue viajando firmado, atado al mismo navegador.
  {
    const svc = servicio();
    const { state, txSecret } = await svc.createOAuthState({
      returnTo: '/settings/security',
      userId: 'usuario-123',
      provider: 'discord',
      intent: 'link',
    });
    await rechaza(
      () => svc.consumeOAuthState(state, 'discord', 'f'.repeat(64)),
      'vincular desde otro navegador debe rechazarse',
    );
    const r = await svc.consumeOAuthState(state, 'discord', txSecret);
    assert.equal(r.intent, 'link');
    assert.equal(r.userId, 'usuario-123');
  }

  console.log('atado del state de OAuth al navegador: OK');
}

main().catch((e) => {
  console.error('FALLO:', e?.message || e);
  process.exit(1);
});
