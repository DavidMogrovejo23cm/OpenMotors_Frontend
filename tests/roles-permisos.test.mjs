import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessModulo } from '../src/lib/utils.ts';

test('RF-03: Administrador tiene acceso total a todos los módulos', () => {
  assert.equal(canAccessModulo([], 'contabilidad', true, false), true);
  assert.equal(canAccessModulo([], 'proveedores', true, false), true);
  assert.equal(canAccessModulo([], 'inventario', true, false), true);
  assert.equal(canAccessModulo([], 'registros', true, false), true);
  assert.equal(canAccessModulo([], 'clientes', true, false), true);
});

test('RF-03: Mecánico sin permisos adicionales tiene restringido acceso a compras y proveedores', () => {
  // Módulos base permitidos para mecánico
  assert.equal(canAccessModulo([], 'registros', false, true), true);
  assert.equal(canAccessModulo([], 'diagnostico', false, true), true);
  assert.equal(canAccessModulo([], 'alertas', false, true), true);

  // Módulos restringidos sin permiso especial
  assert.equal(canAccessModulo([], 'proveedores', false, true), false);
  assert.equal(canAccessModulo([], 'contabilidad', false, true), false);
});

test('RF-03: Concesión de permiso inventario_entradas habilita proveedores al mecánico', () => {
  assert.equal(canAccessModulo(['inventario_entradas'], 'proveedores', false, true), true);
  // Pero aún no puede ver contabilidad (módulo financiero exclusivo de administrador)
  assert.equal(canAccessModulo(['inventario_entradas'], 'contabilidad', false, true), false);
});

test('RF-03: Cliente no tiene acceso a módulos operativos del taller', () => {
  assert.equal(canAccessModulo([], 'registros', false, false), false);
  assert.equal(canAccessModulo([], 'inventario', false, false), false);
  assert.equal(canAccessModulo([], 'proveedores', false, false), false);
  assert.equal(canAccessModulo([], 'contabilidad', false, false), false);
  assert.equal(canAccessModulo([], 'clientes', false, false), false);
});
