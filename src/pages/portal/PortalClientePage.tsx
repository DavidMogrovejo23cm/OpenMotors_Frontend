/* ─────────────────────────────────────────────
   GMotors — Portal del Cliente
   Vista personalizada: mis motos, historial,
   y seguimiento de mantenimiento
   ───────────────────────────────────────────── */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Car, ChevronRight } from 'lucide-react';
import { motosApi, registrosApi } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';
import { useAuth } from '../../contexts/AuthContext';
import type { Moto, RegistroDetalle } from '../../types';
import { fmtDate, fmtMoney, toIsoStr } from '../../lib/utils';


function oilThreshold(cc: number) { return cc >= 300 ? 5000 : 1000; }

const URGENCY_CFG = {
  overdue: { label: 'Vencido',      color: '#EF4444', bg: 'rgba(239,68,68,0.10)' },
  due:     { label: 'Urgente',      color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  soon:    { label: 'Próximo',      color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
  ok:      { label: 'Al día',       color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
  unknown: { label: 'Sin historial',color: '#6B7280', bg: 'rgba(107,114,128,0.10)' },
};

function getUrgency(kmSince: number | null, thr: number) {
  if (kmSince === null) return 'unknown';
  if (kmSince >= thr)       return 'overdue';
  if (kmSince >= thr * 0.8) return 'due';
  if (kmSince >= thr * 0.6) return 'soon';
  return 'ok';
}

export default function PortalClientePage() {
  const { user } = useAuth();
  const [motos,    setMotos]    = useState<Moto[]>([]);
  const [registros,setRegistros]= useState<RegistroDetalle[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filterPlaca, setFilterPlaca] = useState('');
  const load = useCallback(async () => {
    const uid = user?.id_usuario;
    if (uid == null) { setLoading(false); return; }
    const [mr, rr] = await Promise.allSettled([
      motosApi.byUser(uid), registrosApi.byClient(uid),
    ]);
    const allMotos:    Moto[]            = mr.status === 'fulfilled' ? mr.value.data : [];
    const allRegistros:RegistroDetalle[] = rr.status === 'fulfilled' ? rr.value.data : [];
    const myMotos    = allMotos.filter(m => m.id_usuario === uid);
    const myPlacas   = new Set(myMotos.map(m => m.placa));
    const myRegistros= allRegistros.filter(r => myPlacas.has(r.placa))
                                   .sort((a,b) => toIsoStr(b.fecha).localeCompare(toIsoStr(a.fecha)));

    setMotos(myMotos);
    setRegistros(myRegistros);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /* Refresco en tiempo real: el cliente ve nuevos servicios/km sin recargar */
  usePolling(load, { intervalMs: 25_000 });

  /* Alertas de aceite por moto */
  const oilAlerts = useMemo(() => motos.map(m => {
    const oilRecs = registros
      .filter(r => r.placa === m.placa &&
        ['aceite','cambio de aceite'].some(k => r.tipo_servicio?.toLowerCase().includes(k)))
      .filter(r => r.kilometraje != null)
      .sort((a,b) => (b.kilometraje ?? 0) - (a.kilometraje ?? 0));
    const lastKm = oilRecs[0]?.kilometraje ?? null;
    const thr    = oilThreshold(m.cilindraje);
    const kmSince = lastKm != null ? m.kilometraje - lastKm : null;
    return { moto: m, kmSince, thr, urgency: getUrgency(kmSince, thr) };
  }), [motos, registros]);

  const gastoTotal = registros.reduce((s, r) => s + (r.costo_total ?? 0), 0);

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="skeleton-d h-24 rounded-2xl" />)}
    </div>
  );

  const filtered = filterPlaca
    ? registros.filter(r => r.placa.toLowerCase().includes(filterPlaca.toLowerCase()))
    : registros;

  return (
    <div className="space-y-6 pb-8">

      {/* ── Hero del cliente ── */}
      <div className="gm-card-d rounded-3xl p-6 relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #17171E 0%, rgba(225,20,40,0.06) 100%)' }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(225,20,40,0.08) 0%, transparent 70%)' }} />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black shrink-0"
               style={{ background: 'rgba(225,20,40,0.12)', border: '2px solid rgba(225,20,40,0.25)', color: '#E11428' }}>
            {user?.nombre_completo?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1">
            <p className="text-[11px] dark:text-white/30 text-slate-900/30 font-bold uppercase tracking-widest">Mi portal</p>
            <h1 className="text-2xl font-black dark:text-white text-slate-900 leading-tight">
              {user?.nombre_completo ?? 'Mi cuenta'}
            </h1>
            <p className="dark:text-white/35 text-slate-900/35 text-sm mt-0.5">{user?.correo}</p>
          </div>
          {/* KPIs rápidos */}
          <div className="flex items-center gap-0 bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {[
              { label: 'Vehículos',    value: motos.length,      color: '#3B82F6' },
              { label: 'Servicios',value: registros.length,  color: '#E11428' },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} className="flex items-center">
                <div className="flex flex-col items-center gap-0.5 px-5 py-3">
                  <span className="text-xl font-black" style={{ color }}>{value}</span>
                  <span className="text-[9px] font-bold dark:text-white/30 text-slate-900/30 uppercase tracking-wider">{label}</span>
                </div>
                {i < arr.length - 1 && <div className="w-px h-8 bg-white/[0.07]" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mis motos ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black dark:text-white/80 text-slate-900/80">Mis vehículos</h2>
          <Link to="/motos" className="text-[11px] text-gm-red font-bold hover:text-gm-red-lt flex items-center gap-1">
            Administrar <ChevronRight size={11} />
          </Link>
        </div>
        {motos.length === 0 ? (
          <div className="gm-card-d rounded-2xl py-10 text-center">
            <Car size={28} className="mx-auto mb-2 dark:text-white/15 text-slate-900/15" />
            <p className="dark:text-white/30 text-slate-900/30 text-sm">Sin vehículos registrados</p>
            <Link to="/motos" className="mt-3 inline-flex text-gm-red text-sm font-bold">
              Registrar vehículo →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {motos.map(m => {
              const alert = oilAlerts.find(a => a.moto.id_vehiculo === m.id_vehiculo);
              const cfg   = URGENCY_CFG[alert?.urgency ?? 'ok'];
              const pct   = alert?.kmSince != null
                ? Math.min(Math.round((alert.kmSince / alert.thr) * 100), 100) : 0;
              return (
                <div key={m.id_vehiculo} className="gm-card-d rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="plate-tag">{m.placa}</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="dark:text-white/85 text-slate-900/85 font-black text-sm">{m.marca} {m.modelo}</p>
                  <p className="dark:text-white/35 text-slate-900/35 text-xs mt-0.5">{m.anio} · {m.tipo_vehiculo}</p>
                  <p className="dark:text-white/50 text-slate-900/50 text-xs mt-1">
                    {(m.kilometraje ?? 0).toLocaleString()} km totales
                  </p>
                  {/* Barra aceite */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] dark:text-white/30 text-slate-900/30 mb-1">
                      <span>Próximo cambio de aceite</span>
                      {alert?.urgency === 'unknown'
                        ? <span style={{ color: cfg.color }}>—</span>
                        : <span style={{ color: cfg.color }}>{pct}%</span>}
                    </div>
                    {alert?.urgency === 'unknown' ? (
                      <p className="text-[10px]" style={{ color: '#6B7280' }}>
                        Sin historial de aceite — el mecánico lo registrará en el próximo servicio
                      </p>
                    ) : (
                      <div className="prog-bar">
                        <div className="prog-bar-fill" style={{
                          width: `${pct}%`, background: cfg.color, boxShadow: `0 0 6px ${cfg.color}50`,
                        }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

        <div className="gm-card-d rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] tracking-[0.28em] uppercase dark:text-white/28 text-slate-900/28 font-bold">
                Historial · {registros.length} servicios
              </p>
              <p className="text-xs dark:text-white/30 text-slate-900/30 mt-0.5">
                Total gastado: <span className="dark:text-white/60 text-slate-900/60 font-bold">{fmtMoney(gastoTotal)}</span>
              </p>
            </div>
            <input
              className="gm-input-d text-xs"
              style={{ width: 200 }}
              placeholder="Filtrar por placa…"
              value={filterPlaca}
              onChange={e => setFilterPlaca(e.target.value)}
            />
          </div>
          {filtered.length === 0 ? (
            <div className="py-12 text-center dark:text-white/25 text-slate-900/25 text-sm">Sin registros</div>
          ) : (
            <div className="overflow-x-auto dark-scroll">
              <table className="gm-table-d" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Fecha</th><th>Placa</th><th>Servicio</th>
                    <th className="text-right">Costo</th><th>Estado</th><th>Factura</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id_registro}>
                      <td className="dark:text-white/45 text-slate-900/45 text-xs whitespace-nowrap">{fmtDate(r.fecha)}</td>
                      <td><span className="plate-tag">{r.placa}</span></td>
                      <td className="dark:text-white/65 text-slate-900/65 text-sm">{r.tipo_servicio ?? '—'}</td>
                      <td className="text-right text-emerald-400 font-bold text-sm whitespace-nowrap">{fmtMoney(r.costo_total)}</td>
                      <td>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{
                                background: r.estado >= 3 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                                color:      r.estado >= 3 ? '#10B981' : '#F59E0B',
                              }}>
                          {['Pendiente','En proceso','Completado','Entregado','Facturado'][r.estado] ?? '—'}
                        </span>
                      </td>
                      <td>
                        {r.id_factura > 0 && (
                          <Link to={`/invoice/${r.id_registro}`}
                                className="text-gm-red text-xs font-bold hover:text-gm-red-lt whitespace-nowrap">
                            Ver →
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>


    </div>
  );
}
