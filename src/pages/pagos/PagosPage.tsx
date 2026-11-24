import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { finanzasApi, registrosApi, type DeudaClienteItem, type DeudaClienteOrden } from '../../lib/api';
import { ESTADO_REGISTRO, fmtMoney, fmtDate, getErrorMsg } from '../../lib/utils';
import { useToast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import type { RegistroDetalle } from '../../types';

const PAGO_LABEL = { PENDIENTE: 'Pendiente', PARCIAL: 'Parcial', PAGADO: 'Pagado' };
export default function PagosPage() {
  const toast = useToast();
  const [vista, setVista] = useState<'ordenes' | 'deudas'>('ordenes');
  const [registros, setRegistros] = useState<RegistroDetalle[]>([]);
  const [deudasClientes, setDeudasClientes] = useState<DeudaClienteItem[]>([]);
  const [carteraPendiente, setCarteraPendiente] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [pagoFiltro, setPagoFiltro] = useState('TODOS');
  const [trabajoFiltro, setTrabajoFiltro] = useState('TODOS');
  const [target, setTarget] = useState<{
    id_registro: number;
    placa: string;
    costo_total: number;
    saldo_pendiente?: number;
    pagos?: { id_pago: number; monto: number; fecha: string; metodo: string }[];
  } | null>(null);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('EFECTIVO');
  const [referencia, setReferencia] = useState('');
  const [saving, setSaving] = useState(false);
  const [idOperacion, setIdOperacion] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [regRes, deuRes] = await Promise.all([
        registrosApi.list(),
        finanzasApi.deudas().catch(() => ({ data: { total_cartera_pendiente: 0, clientes: [] } })),
      ]);
      setRegistros(regRes.data);
      setDeudasClientes(deuRes.data.clientes ?? []);
      setCarteraPendiente(deuRes.data.total_cartera_pendiente ?? 0);
    } catch (err) { setError(getErrorMsg(err)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const filtered = useMemo(() => registros.filter(r =>
    (pagoFiltro === 'TODOS' || r.estado_pago === pagoFiltro) &&
    (trabajoFiltro === 'TODOS' || r.estado === Number(trabajoFiltro)) &&
    `${r.placa} ${r.nombre_cliente} ${r.tipo_servicio}`.toLowerCase().includes(search.toLowerCase().trim())
  ), [registros, pagoFiltro, trabajoFiltro, search]);

  const deudasFiltradas = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return deudasClientes;
    return deudasClientes.filter(c =>
      `${c.nombre_cliente} ${c.cedula ?? ''} ${c.ordenes.map(o => o.placa).join(' ')}`.toLowerCase().includes(q)
    );
  }, [deudasClientes, search]);

  const cobrado = registros.reduce((s, r) => s + (r.monto_pagado ?? 0), 0);
  const pendiente = registros.reduce((s, r) => s + (r.saldo_pendiente ?? r.costo_total), 0);

  const abrirModalPago = (ord: RegistroDetalle | DeudaClienteOrden) => {
    setTarget(ord);
    setMonto(String(ord.saldo_pendiente ?? ord.costo_total));
    setMetodo('EFECTIVO');
    setReferencia('');
    setIdOperacion(crypto.randomUUID());
  };

  const pagar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || saving) return;
    setSaving(true);
    try {
      await registrosApi.pagar(target.id_registro, Number(monto), metodo, referencia || undefined, idOperacion);
      setTarget(null);
      toast.success('Pago registrado');
      await cargar();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  return <div className="space-y-6 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Pagos y cuentas por cobrar</h1>
      <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={() => setVista('ordenes')}
          className={`px-3.5 py-2 text-xs font-bold ${vista === 'ordenes' ? 'bg-gm-red text-white' : 'opacity-65'}`}
        >
          Por órdenes
        </button>
        <button
          type="button"
          onClick={() => setVista('deudas')}
          className={`px-3.5 py-2 text-xs font-bold ${vista === 'deudas' ? 'bg-gm-red text-white' : 'opacity-65'}`}
        >
          Deudas por cliente ({deudasClientes.length})
        </button>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-3">
      <div className="gm-card-d rounded-xl p-5">Total cobrado <strong className="block text-xl text-emerald-400">{fmtMoney(cobrado)}</strong></div>
      <div className="gm-card-d rounded-xl p-5">Saldo pendiente global <strong className="block text-xl text-amber-400">{fmtMoney(vista === 'deudas' ? carteraPendiente : pendiente)}</strong></div>
      <div className="gm-card-d rounded-xl p-5">Clientes con saldo <strong className="block text-xl">{deudasClientes.length}</strong></div>
    </div>

    <div className="flex flex-wrap gap-3">
      <label>Buscar<input className="gm-input-d block" value={search} onChange={e => setSearch(e.target.value)} placeholder="Placa, cliente o cédula" /></label>
      {vista === 'ordenes' && (
        <>
          <label>Pago<select className="gm-input-d block" value={pagoFiltro} onChange={e => setPagoFiltro(e.target.value)}>
            <option value="TODOS">Todos</option>{Object.entries(PAGO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
          <label>Trabajo<select className="gm-input-d block" value={trabajoFiltro} onChange={e => setTrabajoFiltro(e.target.value)}>
            <option value="TODOS">Todos</option>{Object.entries(ESTADO_REGISTRO).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select></label>
        </>
      )}
    </div>

    {error && <div role="alert">{error} <Button onClick={cargar}>Reintentar</Button></div>}

    {loading ? <p role="status">Cargando pagos…</p> : vista === 'deudas' ? (
      <div className="space-y-4">
        {!deudasFiltradas.length ? (
          <div className="gm-card-d rounded-xl p-8 text-center opacity-70">
            No existen saldos pendientes registrados para la consulta actual.
          </div>
        ) : deudasFiltradas.map(cli => (
          <div key={cli.id_cliente} className="gm-card-d rounded-xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
              <div>
                <h2 className="text-lg font-bold">{cli.nombre_cliente}</h2>
                <p className="text-xs opacity-60">
                  {cli.cedula ? `CI: ${cli.cedula} · ` : ''}{cli.telefono ? `Tel: ${cli.telefono} · ` : ''}{cli.cantidad_ordenes} orden(es) pendiente(s)
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-60">Saldo total adeudado</p>
                <p className="text-xl font-black text-amber-400">{fmtMoney(cli.saldo_total_pendiente)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="gm-table-d">
                <thead>
                  <tr><th>Orden</th><th>Fecha</th><th>Vehículo</th><th>Servicio</th><th>Total</th><th>Abonado</th><th>Saldo</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  {cli.ordenes.map(o => (
                    <tr key={o.id_registro}>
                      <td><Link to={`/ordenes/${o.id_registro}`} className="font-bold text-gm-red">#{o.id_registro}</Link></td>
                      <td className="text-xs">{fmtDate(o.fecha)}</td>
                      <td>{o.placa} · {o.marca_vehiculo}</td>
                      <td>{o.tipo_servicio}</td>
                      <td>{fmtMoney(o.costo_total)}</td>
                      <td>{fmtMoney(o.monto_pagado)}</td>
                      <td className="font-bold text-amber-400">{fmtMoney(o.saldo_pendiente)}</td>
                      <td>
                        <Button size="sm" onClick={() => abrirModalPago(o)}>Registrar abono</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="gm-card-d rounded-xl overflow-x-auto">
        <table className="gm-table-d"><thead><tr><th>Orden / cliente</th><th>Trabajo</th><th>Pago</th><th>Total</th><th>Cobrado</th><th>Saldo</th><th>Acción</th></tr></thead>
          <tbody>{filtered.map(r => <tr key={r.id_registro}>
            <td>#{r.id_registro} · {r.placa}<small className="block">{r.nombre_cliente}</small>{r.revision_estado && <small className="block text-amber-500">Estado histórico por revisar</small>}</td>
            <td>{ESTADO_REGISTRO[r.estado]?.label}</td><td>{PAGO_LABEL[r.estado_pago ?? 'PENDIENTE']}</td>
            <td>{fmtMoney(r.costo_total)}</td><td>{fmtMoney(r.monto_pagado ?? 0)}</td><td>{fmtMoney(r.saldo_pendiente ?? r.costo_total)}</td>
            <td><div className="flex flex-wrap gap-2"><Link to={`/invoice/${r.id_registro}`}>Comprobante</Link>
              {(r.saldo_pendiente ?? r.costo_total) > 0 && <Button onClick={() => abrirModalPago(r)}>Registrar pago</Button>}
            </div></td>
          </tr>)}{!filtered.length && <tr><td colSpan={7}>No hay órdenes para estos filtros.</td></tr>}</tbody>
        </table>
      </div>
    )}

    <Modal open={!!target} onClose={() => { if (!saving) setTarget(null); }} title="Registrar pago">
      <form onSubmit={pagar} className="space-y-4">
        <p>{target?.placa} · Saldo: {fmtMoney(target?.saldo_pendiente ?? target?.costo_total ?? 0)}</p>
        <label className="block">Monto<input className="gm-input-d block w-full" required type="number" min="0.01" step="0.01" max={target?.saldo_pendiente ?? target?.costo_total} value={monto} onChange={e => setMonto(e.target.value)} /></label>
        <label className="block">Método<select className="gm-input-d block w-full" value={metodo} onChange={e => setMetodo(e.target.value)}><option>EFECTIVO</option><option>TRANSFERENCIA</option><option>TARJETA</option></select></label>
        <label className="block">Referencia<input className="gm-input-d block w-full" maxLength={100} value={referencia} onChange={e => setReferencia(e.target.value)} /></label>
        <p className="text-sm">El pago se registra sin cambiar el estado del trabajo.</p>
        <Button type="submit" loading={saving}>Confirmar pago</Button>
      </form>
      {!!target?.pagos?.length && <div className="mt-4"><h2>Pagos anteriores</h2>{target.pagos.map(p => <p key={p.id_pago}>{fmtDate(p.fecha)} · {p.metodo} · {fmtMoney(p.monto)}</p>)}</div>}
    </Modal>
  </div>;
}
