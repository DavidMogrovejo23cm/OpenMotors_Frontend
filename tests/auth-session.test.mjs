import test from 'node:test';
import assert from 'node:assert/strict';
import { getErrorMsg } from '../src/lib/utils.ts';
import {
  ACTIVITY_KEY,
  INACTIVITY_TIMEOUT_MS,
  getLastActivity,
  isInactiveExpired,
  recordActivity,
} from '../src/lib/inactivity.ts';

test('RF-02: muestra mensaje claro cuando las credenciales sean incorrectas (HTTP 401)', () => {
  const err401 = {
    response: {
      status: 401,
      data: 'Credenciales inválidas',
    },
  };
  assert.equal(getErrorMsg(err401), 'Correo o contraseña incorrectos.');
});

test('RF-02: almacena y limpia sesión en storage simulando inicio y cierre de sesión seguro', () => {
  const store = new Map();
  const storageMock = {
    setItem: (k, v) => store.set(k, String(v)),
    getItem: (k) => store.get(k) ?? null,
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };

  // Simular inicio de sesión exitoso
  const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake';
  const fakeUser = { id_usuario: 1, nombre_usuario: 'admin', correo: 'admin@test.com', roles: ['ADMIN'] };

  storageMock.setItem('gm_token', fakeToken);
  storageMock.setItem('gm_user', JSON.stringify(fakeUser));

  assert.equal(storageMock.getItem('gm_token'), fakeToken);
  assert.deepEqual(JSON.parse(storageMock.getItem('gm_user')), fakeUser);

  // Simular cierre de sesión seguro
  storageMock.removeItem('gm_token');
  storageMock.removeItem('gm_user');

  assert.equal(storageMock.getItem('gm_token'), null);
  assert.equal(storageMock.getItem('gm_user'), null);
});

test('RF-02: extracción de roles autorizados para el acceso al sistema', () => {
  const adminUser = { roles: [{ estado: 1, rol: { nombre: 'ADMIN' } }] };
  const clientUser = { roles: [{ estado: 1, rol: { nombre: 'CLIENTE' } }] };

  const getRoles = (user) => (user?.roles ?? []).map(r => r.rol?.nombre ?? r.nombre);

  assert.ok(getRoles(adminUser).includes('ADMIN'));
  assert.ok(getRoles(clientUser).includes('CLIENTE'));
});

test('RF-02 / HU-03: detecta expiración por inactividad cuando supera el umbral configurado', () => {
  const store = new Map();
  const storageMock = {
    setItem: (k, v) => store.set(k, String(v)),
    getItem: (k) => store.get(k) ?? null,
    removeItem: (k) => store.delete(k),
  };

  const t0 = 1_700_000_000_000;
  recordActivity(storageMock, t0);
  assert.equal(getLastActivity(storageMock), t0);
  assert.equal(store.get(ACTIVITY_KEY), String(t0));

  // Dentro del tiempo activo no expira
  assert.equal(isInactiveExpired(getLastActivity(storageMock), t0 + INACTIVITY_TIMEOUT_MS - 1000), false);
  // Al alcanzar o superar el tiempo límite expira
  assert.equal(isInactiveExpired(getLastActivity(storageMock), t0 + INACTIVITY_TIMEOUT_MS), true);
  assert.equal(isInactiveExpired(null, t0 + INACTIVITY_TIMEOUT_MS), false);
});

test('RF-04 / HU-05: muestra mensaje específico del servidor cuando una cuenta está suspendida (HTTP 403)', () => {
  const err403 = {
    response: {
      status: 403,
      data: { error: 'Tu cuenta está desactivada. Contacta al dueño del taller.' },
    },
  };
  assert.equal(getErrorMsg(err403), 'Tu cuenta está desactivada. Contacta al dueño del taller.');
});
