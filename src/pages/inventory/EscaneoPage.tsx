import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { kardexApi, type Movimiento } from '../../lib/tallerApi';
import { registrosApi } from '../../lib/api';
import type { Producto, RegistroDetalle } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { getErrorMsg, fmtDate } from '../../lib/utils';
import Button from '../../components/ui/Button';
import BarcodeCamera from '../../components/inventory/BarcodeCamera';
import { Camera } from 'lucide-react';
export default function EscaneoPage() {
  const { user, isAdmin } = useAuth(), toast = useToast(), [params] = useSearchParams();
  const entrada = isAdmin || !!user?.permisos?.includes('inventario_entradas'), salida = isAdmin || !!user?.permisos?.includes('inventario_consumos');
  const [tipo, setTipo] = useState(params.get('tipo') === 'salida' && salida ? 'salida' : params.get('tipo') === 'devolucion' && isAdmin ? 'devolucion' : entrada ? 'entrada' : 'salida'), [codigo, setCodigo] = useState(''), [producto, setProducto] = useState<Producto | null>(null), [cantidad, setCantidad] = useState(1), [orden, setOrden] = useState(params.get('orden') ?? ''), [motivo, setMotivo] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]), [ordenes, setOrdenes] = useState<RegistroDetalle[]>([]), [filtro, setFiltro] = useState('');
  const [unknownCode, setUnknownCode] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const requestLock = useRef(false);
  const key = useRef(crypto.randomUUID());
  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!busy && !producto && !cameraOpen) codeInput.current?.focus(); }, [busy, producto, cameraOpen]);
  const load = useCallback(async () => { try { const [regs, movs] = await Promise.all([registrosApi.list(), (entrada || salida) ? kardexApi.movimientos() : Promise.resolve({ data: [] })]); setOrdenes(regs.data); setMovimientos(movs.data); } catch (e) { setError(getErrorMsg(e)); } }, [entrada, salida]);
  useEffect(() => { load(); }, [load]);
  const buscar = async (scannedCode = codigo) => { if (requestLock.current) return; const code = scannedCode.trim(); if (!code) return; requestLock.current = true; setBusy(true); setError(''); setUnknownCode(''); setProducto(null); try { const result = (await kardexApi.buscar(code)).data; if (!result.encontrado || !result.producto) { setUnknownCode(code); setError('Código desconocido. Registra primero el producto en Inventario.'); return; } setProducto(result.producto); key.current = crypto.randomUUID(); } catch (e) { setError(getErrorMsg(e)); } finally { requestLock.current = false; setBusy(false); } };
  const cambiarTipo = (next: string) => {
    if (requestLock.current) return;
    setCameraOpen(false); setTipo(next); setCodigo(''); setProducto(null);
    setCantidad(1); setMotivo(''); setUnknownCode(''); setError('');
    key.current = crypto.randomUUID();
  };
  const esSalida = tipo === 'salida';
  const accion = esSalida ? 'salida' : tipo === 'devolucion' ? 'devolución' : 'entrada';
  return <div className="space-y-5"><Link to="/inventario">← Inventario</Link><h1 className="text-2xl font-bold">Escaneo y movimientos</h1><p className="text-sm opacity-60">Elige entrada para sumar productos o salida para descontarlos. Escanea la etiqueta e indica cuántas unidades vas a mover.</p>
    <nav className="grid gap-3 sm:grid-cols-2" aria-label="Tipo de movimiento de inventario">
      {entrada && <button type="button" disabled={busy || cameraOpen} aria-pressed={tipo === 'entrada'} onClick={() => cambiarTipo('entrada')} className={`rounded-xl border p-4 text-left ${tipo === 'entrada' ? 'border-emerald-500 bg-emerald-500/10' : 'gm-card-d'}`}><strong className="block">Entrada: agregar al inventario</strong><span className="text-sm">Recibir productos y sumar unidades a las existencias.</span></button>}
      {salida && <button type="button" disabled={busy || cameraOpen} aria-pressed={tipo === 'salida'} onClick={() => cambiarTipo('salida')} className={`rounded-xl border p-4 text-left ${tipo === 'salida' ? 'border-orange-500 bg-orange-500/10' : 'gm-card-d'}`}><strong className="block">Salida: sacar del inventario</strong><span className="text-sm">Descontar productos para una orden de trabajo.</span></button>}
    </nav>
    {isAdmin && <button type="button" disabled={busy || cameraOpen} aria-pressed={tipo === 'devolucion'} className="text-sm underline" onClick={() => cambiarTipo('devolucion')}>Devolución: devolver a inventario productos de una orden</button>}
    <h2 className="text-lg font-bold">{tipo === 'salida' ? 'Registrar salida de productos' : tipo === 'devolucion' ? 'Registrar devolución de productos' : 'Registrar entrada de productos'}</h2>
    <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); void buscar(); }}><label>Código<input ref={codeInput} autoFocus required disabled={busy || cameraOpen} autoComplete="off" spellCheck={false} className="gm-input-d block" value={codigo} onChange={e => { setCodigo(e.target.value); setUnknownCode(''); setProducto(null); }} /></label><Button type="submit" loading={busy} disabled={cameraOpen}>Buscar producto</Button><Button type="button" variant="secondary" icon={<Camera size={16} />} disabled={busy || cameraOpen} onClick={() => { setProducto(null); setUnknownCode(''); setError(''); setCameraOpen(true); }}>Escanear {accion} con teléfono</Button></form>
    {cameraOpen && <BarcodeCamera onClose={() => setCameraOpen(false)} onRead={code => { setCameraOpen(false); setCodigo(code); void buscar(code); }} />}
    {error && <p role="alert" className="text-red-500">{error}</p>}
    {unknownCode && entrada && tipo === 'entrada' && <Link className="inline-block underline" to={`/inventario?codigo=${encodeURIComponent(unknownCode)}`}>Registrar un producto con esta etiqueta</Link>}
    {producto && <div className="gm-card-d rounded-xl p-5 space-y-4"><h2 className="text-xl font-bold">{producto.nombre}</h2><p>Existencias: <strong>{producto.stock}</strong> · Reservadas: {producto.stock_reservado ?? 0} · Disponibles: {producto.stock_disponible ?? producto.stock} · Código de barras: {producto.codigo_barras || 'Sin registrar'} · Código propio: {producto.codigo_personal}</p>
      {(entrada || salida) ? <form className="space-y-3" onSubmit={async e => { e.preventDefault(); if (requestLock.current) return; requestLock.current = true; setBusy(true); setError(''); try { await kardexApi.mover(tipo !== 'salida', { codigo_barras: codigo.trim(), cantidad, id_registro: tipo !== 'entrada' ? Number(orden) : undefined, origen: tipo === 'devolucion' ? 'DEVOLUCION_TALLER' : undefined, motivo, id_operacion: key.current }); setProducto(null); setCodigo(''); toast.success(`${esSalida ? 'Salida' : tipo === 'devolucion' ? 'Devolución' : 'Entrada'} registrada: ${esSalida ? '−' : '+'}${cantidad} unidad(es) de ${producto.nombre}`); setCantidad(1); setMotivo(''); key.current = crypto.randomUUID(); await load(); } catch (err) { setError(getErrorMsg(err)); } finally { requestLock.current = false; setBusy(false); } }}>
        <fieldset disabled={busy} className="space-y-3">
        {tipo !== 'entrada' && <label className="block">Orden de trabajo<select required className="gm-input-d block w-full" value={orden} onChange={e => { setOrden(e.target.value); key.current = crypto.randomUUID(); }}><option value="">Selecciona una orden</option>{ordenes.filter(r => r.estado !== 3).map(r => <option key={r.id_registro} value={r.id_registro}>#{r.id_registro} · {r.placa} · {r.nombre_cliente}</option>)}</select></label>}
        <label className="block">Cantidad<input className="gm-input-d block" type="number" required min={1} step={1} value={cantidad} onChange={e => { setCantidad(Number(e.target.value)); key.current = crypto.randomUUID(); }} /></label><label className="block">Motivo<input className="gm-input-d block w-full" required maxLength={500} value={motivo} onChange={e => { setMotivo(e.target.value); key.current = crypto.randomUUID(); }} /></label>
        <p className="text-sm font-semibold">Existencias actuales: {producto.stock} → Después de confirmar: {producto.stock + (esSalida ? -cantidad : cantidad)}</p>
        <p className="text-sm">Confirma {tipo === 'salida' ? 'la salida' : 'el ingreso'} de <strong>{cantidad}</strong> unidad(es) de <strong>{producto.nombre}</strong>{tipo !== 'entrada' ? ` para la orden #${orden}` : ''}.</p><Button type="submit" loading={busy}>Confirmar {accion}: {esSalida ? 'descontar' : 'sumar'} {cantidad} unidad(es)</Button></fieldset>
      </form> : <p>Solo consulta. El administrador puede autorizar entradas o consumo de repuestos desde Perfiles.</p>}
    </div>}
    {(entrada || salida) && <section className="space-y-3"><h2 className="text-lg font-bold">Últimos 200 movimientos</h2><label>Filtrar<input className="gm-input-d block" value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Producto, tipo, usuario u orden" /></label><div className="gm-card-d rounded-xl overflow-x-auto"><table className="gm-table-d"><thead><tr><th>Fecha</th><th>Producto</th><th>Movimiento</th><th>Cantidad</th><th>Antes → después</th><th>Orden / responsable</th><th>Motivo</th></tr></thead><tbody>{movimientos.filter(m => [m.producto_nombre, m.tipo_movimiento, m.nombre_usuario, m.id_registro].join(' ').toLowerCase().includes(filtro.toLowerCase())).map(m => <tr key={m.id_movimiento}><td>{fmtDate(m.fecha)}</td><td>{m.producto_nombre}</td><td>{m.tipo_movimiento}</td><td>{m.cantidad}</td><td>{m.stock_anterior} → {m.stock_nuevo}</td><td>{m.id_registro ?? '—'} · {m.nombre_usuario ?? '—'}</td><td>{m.motivo}</td></tr>)}{!movimientos.length && <tr><td colSpan={7}>No hay movimientos registrados.</td></tr>}</tbody></table></div></section>}
  </div>;
}
