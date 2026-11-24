import test from 'node:test';
import assert from 'node:assert/strict';
import { cobrosDeOrdenes, ESTADO_REGISTRO, canAccessModulo } from '../src/lib/utils.ts';

test('solo existen los cuatro estados de trabajo', () => {
  assert.deepEqual(Object.keys(ESTADO_REGISTRO), ['0', '1', '2', '3']);
});
test('los ingresos proceden de abonos y su fecha, no del estado de trabajo', () => {
  const orden = { id_registro: 1, estado: 1, estado_pago: 'PARCIAL', costo_total: 100, monto_pagado: 30, fecha: '2026-01-01', pagos: [{ id_pago: 1, monto: 30, fecha: '2026-11-17', metodo: 'EFECTIVO' }] };
  const cobros = cobrosDeOrdenes([orden, { id_registro: 2, estado: 3, costo_total: 200, monto_pagado: 0 }]);
  assert.equal(cobros.length, 1);
  assert.equal(cobros[0].costo_total, 30);
  assert.equal(cobros[0].fecha, '2026-11-17');
  assert.equal(orden.costo_total, 100);
});
test('dos pagos completan el total una sola vez', () => {
  const cobros = cobrosDeOrdenes([{ costo_total: 100, monto_pagado: 100, pagos: [{ monto: 30, fecha: '2026-11-01' }, { monto: 70, fecha: '2026-11-17' }] }]);
  assert.equal(cobros.reduce((sum, r) => sum + r.costo_total, 0), 100);
});
test('un cobro histórico no inventa movimientos ni suma su total pendiente', () => {
  const cobros = cobrosDeOrdenes([{ costo_total: 100, monto_pagado: 40, fecha: '2026-01-01', fecha_facturado: '2026-02-01' }]);
  assert.equal(cobros[0].costo_total, 40);
  assert.equal(cobros[0].fecha, '2026-02-01');
});

test('el mecánico conserva sus módulos técnicos y no obtiene finanzas con autorizaciones extra', () => {
  assert.equal(canAccessModulo([], 'registros', false, true), true);
  assert.equal(canAccessModulo([], 'inventario', false, true), true);
  assert.equal(canAccessModulo([], 'proveedores', false, true), false);
  assert.equal(canAccessModulo(['inventario_entradas'], 'proveedores', false, true), true);
  assert.equal(canAccessModulo(['recepcion', 'inventario_entradas', 'inventario_consumos'], 'contabilidad', false, true), false);
  assert.equal(canAccessModulo([], 'contabilidad', true, false), true);
  assert.equal(canAccessModulo(['inventario_entradas'], 'inventario', false, false), false);
});
