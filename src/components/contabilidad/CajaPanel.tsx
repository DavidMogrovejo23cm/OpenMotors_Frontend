import { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Lock, Unlock, Wallet, RefreshCw } from 'lucide-react';
import {
  cajaApi,
  type CierreCajaAPI,
  type MovimientoCajaAPI,
  type ResumenCajaResp,
} from '../../lib/api';
import { fmtDate, fmtMoney, getErrorMsg } from '../../lib/utils';
import { useToast } from '../ui/Toast';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

export default function CajaPanel() {
  const toast = useToast();
  const [resumen, setResumen] = useState<ResumenCajaResp | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCajaAPI[]>([]);
  const [cierres, setCierres] = useState<CierreCajaAPI[]>([]);
  const [loading, setLoading] = useState(true);

  const [tipoFiltro, setTipoFiltro] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const [openModal, setOpenModal] = useState<'apertura' | 'movimiento' | 'cierre' | null>(null);
  const [saving, setSaving] = useState(false);

  const [montoInicial, setMontoInicial] = useState('0');
  const [obsApertura, setObsApertura] = useState('');

  const [movTipo, setMovTipo] = useState<'INGRESO' | 'RETIRO'>('INGRESO');
  const [movMonto, setMovMonto] = useState('');
  const [movMotivo, setMovMotivo] = useState('');
  const [movRef, setMovRef] = useState('');

  const [montoFisico, setMontoFisico] = useState('');
  const [obsCierre, setObsCierre] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [resR, movR, cieR] = await Promise.all([
        cajaApi.resumen(),
        cajaApi.movimientos({
          fecha_inicio: fechaInicio || undefined,
          fecha_fin: fechaFin || undefined,
          tipo: tipoFiltro || undefined,
        }),
        cajaApi.cierres(),
      ]);
      setResumen(resR.data);
      setMovimientos(movR.data);
      setCierres(cieR.data);
    } catch (err) {
      toast.error(getErrorMsg(err) || 'Error al cargar caja');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, tipoFiltro, toast]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const handleAbrir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await cajaApi.abrir(Number(montoInicial || 0), obsApertura || undefined);
      toast.success('Caja abierta correctamente');
      setOpenModal(null);
      setMontoInicial('0');
      setObsApertura('');
      void cargar();
    } catch (err) {
      toast.error(getErrorMsg(err) || 'No se pudo abrir caja');
    } finally {
      setSaving(false);
    }
  };

  const handleMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const montoNum = Number(movMonto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      toast.error('Ingresa un monto mayor a cero');
      return;
    }
    if (movMotivo.trim().length < 3) {
      toast.error('El motivo es obligatorio (mínimo 3 caracteres)');
      return;
    }
    setSaving(true);
    try {
      await cajaApi.registrarMovimiento({
        tipo: movTipo,
        monto: montoNum,
        motivo: movMotivo.trim(),
        referencia: movRef.trim() || undefined,
      });
      toast.success(movTipo === 'INGRESO' ? 'Ingreso a caja registrado' : 'Retiro de caja registrado');
      setOpenModal(null);
      setMovMonto('');
      setMovMotivo('');
      setMovRef('');
      void cargar();
    } catch (err) {
      toast.error(getErrorMsg(err) || 'No se pudo registrar el movimiento');
    } finally {
      setSaving(false);
    }
  };

  const handleCerrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const { data } = await cajaApi.cerrar(Number(montoFisico || 0), obsCierre || undefined);
      toast.success(`Arqueo registrado (Diferencia: ${fmtMoney(data.diferencia ?? 0)})`);
      setOpenModal(null);
      setMontoFisico('');
      setObsCierre('');
      void cargar();
    } catch (err) {
      toast.error(getErrorMsg(err) || 'Error al cerrar caja');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPIs de Caja */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="gm-card-d rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold opacity-60">Saldo en caja</span>
            <Wallet size={16} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 tabular-nums">
            {fmtMoney(resumen?.saldo_actual ?? 0)}
          </p>
          <p className="text-[11px] opacity-55 mt-1">
            Estado: <strong>{resumen?.caja_abierta ? 'Abierta' : 'Cerrada'}</strong>
          </p>
        </div>

        <div className="gm-card-d rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold opacity-60">Ingresos hoy</span>
            <ArrowUpRight size={16} className="text-blue-400" />
          </div>
          <p className="text-2xl font-black text-blue-400 tabular-nums">
            {fmtMoney(resumen?.ingresos_hoy ?? 0)}
          </p>
        </div>

        <div className="gm-card-d rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold opacity-60">Retiros hoy</span>
            <ArrowDownRight size={16} className="text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400 tabular-nums">
            {fmtMoney(resumen?.retiros_hoy ?? 0)}
          </p>
        </div>

        <div className="gm-card-d rounded-2xl p-5 flex flex-col justify-center gap-2">
          {!resumen?.caja_abierta ? (
            <Button onClick={() => setOpenModal('apertura')} icon={<Unlock size={14} />}>
              Abrir caja
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => { setMontoFisico(String(resumen.saldo_actual)); setOpenModal('cierre'); }} icon={<Lock size={14} />}>
              Cerrar / Arqueo
            </Button>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={() => { setMovTipo('INGRESO'); setOpenModal('movimiento'); }}
            >
              + Ingreso
            </Button>
            <Button
              size="sm"
              variant="danger"
              className="flex-1"
              onClick={() => { setMovTipo('RETIRO'); setOpenModal('movimiento'); }}
            >
              - Retiro
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros de movimientos de caja */}
      <div className="gm-card-d rounded-2xl p-4 flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold">
          <span className="block mb-1 opacity-70">Desde</span>
          <input type="date" className="gm-input-d" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
        </label>
        <label className="text-xs font-semibold">
          <span className="block mb-1 opacity-70">Hasta</span>
          <input type="date" className="gm-input-d" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
        </label>
        <label className="text-xs font-semibold">
          <span className="block mb-1 opacity-70">Tipo</span>
          <select className="gm-select-d" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}>
            <option value="">Todos</option>
            <option value="APERTURA">Apertura</option>
            <option value="INGRESO">Ingreso</option>
            <option value="RETIRO">Retiro</option>
            <option value="CIERRE">Cierre / Arqueo</option>
          </select>
        </label>
        <Button variant="secondary" size="sm" onClick={() => void cargar()} icon={<RefreshCw size={13} />}>
          Actualizar
        </Button>
      </div>

      {/* Historial de movimientos de caja */}
      <div className="gm-card-d rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-bold">Movimientos auditados de caja</h3>
          <span className="text-xs opacity-50">{movimientos.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="gm-table-d">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Motivo</th>
                <th>Ref.</th>
                <th className="text-right">Monto</th>
                <th className="text-right">Saldo resultante</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-6 opacity-50">Cargando movimientos…</td></tr>
              ) : !movimientos.length ? (
                <tr><td colSpan={6} className="text-center py-8 opacity-50">No hay movimientos de caja registrados.</td></tr>
              ) : movimientos.map(m => (
                <tr key={m.id_movimiento}>
                  <td className="text-xs whitespace-nowrap">{fmtDate(m.fecha)} {m.fecha.slice(11, 16)}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      m.tipo === 'INGRESO' || m.tipo === 'APERTURA'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : m.tipo === 'RETIRO'
                          ? 'bg-rose-500/15 text-rose-400'
                          : 'bg-blue-500/15 text-blue-400'
                    }`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className="text-sm">{m.motivo}</td>
                  <td className="text-xs opacity-65">{m.referencia ?? '—'}</td>
                  <td className={`text-right font-bold tabular-nums ${m.tipo === 'RETIRO' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {m.tipo === 'RETIRO' ? '-' : '+'}{fmtMoney(m.monto)}
                  </td>
                  <td className="text-right font-black tabular-nums">{fmtMoney(m.saldo_resultante)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de cierres / arqueos */}
      {cierres.length > 0 && (
        <div className="gm-card-d rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold">Historial de aperturas y arqueos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="gm-table-d">
              <thead>
                <tr>
                  <th>Apertura</th><th>Cierre</th><th>Inicial</th><th>Ingresos</th><th>Retiros</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {cierres.map(c => (
                  <tr key={c.id_cierre}>
                    <td className="text-xs">{fmtDate(c.fecha_apertura)}</td>
                    <td className="text-xs">{c.fecha_cierre ? fmtDate(c.fecha_cierre) : '—'}</td>
                    <td>{fmtMoney(c.monto_inicial)}</td>
                    <td className="text-emerald-400">{fmtMoney(c.total_ingresos)}</td>
                    <td className="text-rose-400">{fmtMoney(c.total_retiros)}</td>
                    <td className="font-bold">{fmtMoney(c.saldo_esperado)}</td>
                    <td>{c.monto_fisico_contado != null ? fmtMoney(c.monto_fisico_contado) : '—'}</td>
                    <td className={c.diferencia != null && c.diferencia < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {c.diferencia != null ? fmtMoney(c.diferencia) : '—'}
                    </td>
                    <td>{c.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Abrir Caja */}
      <Modal open={openModal === 'apertura'} onClose={() => setOpenModal(null)} title="Apertura de caja" size="sm">
        <form onSubmit={handleAbrir} className="space-y-4">
          <label className="block text-sm">
            Monto inicial de efectivo ($)
            <input type="number" min={0} step="0.01" required className="gm-input-d w-full mt-1" value={montoInicial} onChange={e => setMontoInicial(e.target.value)} />
          </label>
          <label className="block text-sm">
            Observaciones (opcional)
            <input type="text" className="gm-input-d w-full mt-1" value={obsApertura} onChange={e => setObsApertura(e.target.value)} placeholder="Ej. Turno mañana" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpenModal(null)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Confirmar apertura</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Movimiento (Ingreso / Retiro) */}
      <Modal
        open={openModal === 'movimiento'}
        onClose={() => setOpenModal(null)}
        title={movTipo === 'INGRESO' ? 'Registrar ingreso a caja' : 'Registrar retiro de efectivo'}
        size="sm"
      >
        <form onSubmit={handleMovimiento} className="space-y-4">
          <label className="block text-sm">
            Tipo de movimiento
            <select className="gm-select-d w-full mt-1" value={movTipo} onChange={e => setMovTipo(e.target.value as 'INGRESO' | 'RETIRO')}>
              <option value="INGRESO">Ingreso de efectivo</option>
              <option value="RETIRO">Retiro de efectivo</option>
            </select>
          </label>
          <label className="block text-sm">
            Monto ($) *
            <input type="number" min="0.01" step="0.01" required className="gm-input-d w-full mt-1" value={movMonto} onChange={e => setMovMonto(e.target.value)} />
          </label>
          <label className="block text-sm">
            Motivo obligatorio *
            <input type="text" required minLength={3} className="gm-input-d w-full mt-1" value={movMotivo} onChange={e => setMovMotivo(e.target.value)} placeholder="Ej. Compra menor de insumos / Fondo de cambio" />
          </label>
          <label className="block text-sm">
            Referencia / Comprobante (opcional)
            <input type="text" className="gm-input-d w-full mt-1" value={movRef} onChange={e => setMovRef(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpenModal(null)}>Cancelar</Button>
            <Button type="submit" variant={movTipo === 'RETIRO' ? 'danger' : 'primary'} loading={saving}>
              Confirmar {movTipo === 'INGRESO' ? 'ingreso' : 'retiro'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Cierre / Arqueo */}
      <Modal open={openModal === 'cierre'} onClose={() => setOpenModal(null)} title="Arqueo y cierre de caja" size="sm">
        <form onSubmit={handleCerrar} className="space-y-4">
          <p className="text-sm opacity-75">
            Saldo esperado en sistema: <strong>{fmtMoney(resumen?.saldo_actual ?? 0)}</strong>
          </p>
          <label className="block text-sm">
            Efectivo físico contado ($) *
            <input type="number" min="0" step="0.01" required className="gm-input-d w-full mt-1" value={montoFisico} onChange={e => setMontoFisico(e.target.value)} />
          </label>
          {montoFisico !== '' && (
            <p className="text-xs font-bold">
              Diferencia estimada: {fmtMoney(Number(montoFisico || 0) - (resumen?.saldo_actual ?? 0))}
            </p>
          )}
          <label className="block text-sm">
            Observaciones de cierre
            <input type="text" className="gm-input-d w-full mt-1" value={obsCierre} onChange={e => setObsCierre(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpenModal(null)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Cerrar caja</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
