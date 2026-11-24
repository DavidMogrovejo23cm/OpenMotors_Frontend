import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPhoneForWhatsapp,
  buildOrderStatusMessage,
  buildOrderWhatsappUrl,
} from '../src/lib/whatsapp.ts';

test('RF-52 manual: formatea números de Ecuador correctamente para WhatsApp', () => {
  assert.equal(formatPhoneForWhatsapp('0991234567'), '593991234567');
  assert.equal(formatPhoneForWhatsapp('+593 99-123-4567'), '593991234567');
  assert.equal(formatPhoneForWhatsapp('991234567'), '593991234567');
  assert.equal(formatPhoneForWhatsapp('12345'), null);
  assert.equal(formatPhoneForWhatsapp(null), null);
});

test('RF-52 manual: construye mensaje claro y URL válida para el estado de la orden', () => {
  const url = buildOrderWhatsappUrl({
    id_registro: 15,
    placa: 'ABC-1234',
    nombre_cliente: 'Carlos Pérez',
    cliente_telefono: '0987654321',
    marca_vehiculo: 'Kia',
    modelo_vehiculo: 'Sportage',
    estado: 2,
    costo_total: 120,
    saldo_pendiente: 40,
  });

  assert.ok(url);
  assert.ok(url.startsWith('https://wa.me/593987654321?text='));
  const msg = buildOrderStatusMessage({
    id_registro: 15,
    placa: 'ABC-1234',
    nombre_cliente: 'Carlos Pérez',
    estado: 2,
    saldo_pendiente: 40,
  });
  assert.ok(msg.includes('ABC-1234'));
  assert.ok(msg.includes('Finalizada'));
  assert.ok(msg.includes('$40.00') || msg.includes('40,00'));
});
