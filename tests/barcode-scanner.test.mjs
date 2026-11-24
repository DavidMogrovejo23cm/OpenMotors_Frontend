import test from 'node:test';
import assert from 'node:assert/strict';
import { startBarcodeScanner, barcodeCameraError } from '../src/lib/barcodeScanner.ts';

const flush = () => new Promise(resolve => setImmediate(resolve));
function setup({ results = [{ rawValue: '  0012345678905  ' }], formats = ['ean_13', 'code_128', 'qr_code'], acquire, detect, play } = {}) {
  let stopped = 0, pauses = 0, constraints, selected, mediaCalls = 0;
  const queue = new Map(); let next = 1;
  const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  const video = { srcObject: null, readyState: 4, play: play ?? (async () => {}), pause: () => pauses++ };
  class Detector {
    static async getSupportedFormats() { return formats; }
    constructor(options) { selected = options.formats; }
    async detect() { return detect ? detect() : results; }
  }
  const env = { secureContext: true, Detector,
    getUserMedia: async c => { constraints = c; mediaCalls++; return acquire ? acquire() : stream; },
    schedule: cb => { const id = next++; queue.set(id, cb); return id; }, cancel: id => queue.delete(id),
  };
  return { env, stream, video, queue, stopped: () => stopped, pauses: () => pauses, constraints: () => constraints, selected: () => selected, mediaCalls: () => mediaCalls };
}

test('lee una etiqueta, conserva ceros y apaga la cámara antes de entregar el código', async () => {
  const f = setup(), codes = [];
  const reader = startBarcodeScanner(f.video, code => { assert.equal(f.stopped(), 1); codes.push(code); }, assert.fail, f.env);
  await reader.ready; await flush();
  assert.deepEqual(codes, ['0012345678905']);
  assert.deepEqual(f.selected(), ['ean_13', 'code_128']);
  assert.equal(f.constraints().audio, false);
  assert.equal(f.constraints().video.facingMode.ideal, 'environment');
  assert.equal(f.video.srcObject, null);
  assert.equal(f.queue.size, 0);
  reader.stop(); assert.equal(f.stopped(), 1);
});

test('no altera ni convierte códigos alfanuméricos Code 128', async () => {
  const f = setup({ results: [{ rawValue: 'REP-0007-A' }] }), codes = [];
  await startBarcodeScanner(f.video, code => codes.push(code), assert.fail, f.env).ready;
  await flush(); assert.deepEqual(codes, ['REP-0007-A']);
});

test('cuadros vacíos continúan leyendo; detener cancela el siguiente cuadro', async () => {
  const f = setup({ results: [{ rawValue: '  ' }] });
  const reader = startBarcodeScanner(f.video, assert.fail, assert.fail, f.env);
  await reader.ready; await flush();
  assert.equal(f.queue.size, 1); assert.equal(f.stopped(), 0);
  reader.stop(); assert.equal(f.queue.size, 0); assert.equal(f.stopped(), 1);
});

test('cerrar mientras se solicita permiso libera el flujo que llega tarde', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = setup({ acquire: () => pending });
  const reader = startBarcodeScanner(f.video, assert.fail, assert.fail, f.env);
  await flush(); reader.stop(); release(f.stream);
  await reader.ready; assert.equal(f.stopped(), 1); assert.equal(f.video.srcObject, null);
});

test('cerrar durante una detección impide callbacks y lecturas posteriores', async () => {
  let release;
  const f = setup({ detect: () => new Promise(resolve => { release = resolve; }) });
  const reader = startBarcodeScanner(f.video, assert.fail, assert.fail, f.env);
  await reader.ready; reader.stop(); release([{ rawValue: '123' }]); await flush();
  assert.equal(f.queue.size, 0); assert.equal(f.stopped(), 1);
});

for (const [reason, override, message] of [
  ['HTTP sin seguridad', { secureContext: false }, /HTTPS/],
  ['navegador no compatible', { Detector: undefined }, /no admite/],
  ['sin API de cámara', { getUserMedia: undefined }, /no admite/],
]) {
  test(`muestra un error útil sin abrir cámara: ${reason}`, async () => {
    const f = setup();
    await assert.rejects(startBarcodeScanner(f.video, assert.fail, assert.fail, { ...f.env, ...override }).ready, message);
    assert.equal(f.mediaCalls(), 0);
  });
}

test('rechaza dispositivos que solo leen QR sin abrir la cámara', async () => {
  const f = setup({ formats: ['qr_code'] });
  await assert.rejects(startBarcodeScanner(f.video, assert.fail, assert.fail, f.env).ready, /formatos/);
  assert.equal(f.mediaCalls(), 0);
});

test('fallo al reproducir video libera la cámara', async () => {
  const f = setup({ play: async () => { throw new Error('Video bloqueado'); } });
  await assert.rejects(startBarcodeScanner(f.video, assert.fail, assert.fail, f.env).ready, /Video bloqueado/);
  assert.equal(f.stopped(), 1); assert.equal(f.video.srcObject, null);
});

test('error del detector informa el fallo y detiene el stream', async () => {
  const f = setup({ detect: async () => { throw new Error('Fallo de lectura'); } }), errors = [];
  await startBarcodeScanner(f.video, assert.fail, e => errors.push(e.message), f.env).ready;
  await flush(); assert.deepEqual(errors, ['Fallo de lectura']); assert.equal(f.stopped(), 1);
});

test('permisos denegados no dejan recursos y ofrecen instrucciones', async () => {
  const e = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
  const f = setup({ acquire: async () => { throw e; } });
  await assert.rejects(startBarcodeScanner(f.video, assert.fail, assert.fail, f.env).ready, /denied/);
  assert.match(barcodeCameraError(e), /Permite el acceso/); assert.equal(f.video.srcObject, null);
  assert.match(barcodeCameraError({ name: 'NotReadableError' }), /ocupada/);
  assert.match(barcodeCameraError({ name: 'NotFoundError' }), /No se encontró/);
});
