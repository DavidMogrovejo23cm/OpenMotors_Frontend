/* ─────────────────────────────────────────────
   OpenMotors — Diagnóstico de Carro (Mecánico)
   Registro clínico al ingreso de cada vehículo
   ───────────────────────────────────────────── */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ClipboardList, Search, Car, CheckCircle, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, Gauge, Save, Clock, User,
  Cog, Link2, Shield, Circle, ArrowUpDown, Droplets, Zap, type LucideIcon,
} from 'lucide-react';
import { carrosApi, diagnosticosApi, usuariosApi, registrosApi } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { nivelDiagnostico, getErrorMsg } from '../../lib/utils';
import { useTheme } from '../../lib/theme';
import type { Carro, Usuario, DiagnosticoCarro, DetalleDiagnostico, RegistroDetalle } from '../../types';

/* ─── Partes a evaluar ─── */
const PARTES: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'MOTOR',         label: 'Motor',                Icon: Cog        },
  { key: 'TRANSMISION',   label: 'Transmisión / Cadena', Icon: Link2      },
  { key: 'FRENOS',        label: 'Sistema de Frenos',    Icon: Shield     },
  { key: 'LLANTAS',       label: 'Llantas',              Icon: Circle     },
  { key: 'SUSPENSION',    label: 'Suspensión',           Icon: ArrowUpDown},
  { key: 'ELECTRICO',     label: 'Sistema Eléctrico',    Icon: Zap        },
  { key: 'CARROCERIA',    label: 'Carrocería',           Icon: Car       },
  { key: 'REFRIGERACION', label: 'Refrigeración',        Icon: Droplets   },
];

const ESTADO_CONFIG = {
  1: { label: 'Bueno',   color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
  2: { label: 'Regular', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
  3: { label: 'Malo',    color: '#E11428', bg: 'rgba(225,20,40,0.12)',   border: 'rgba(225,20,40,0.25)'  },
} as const;

const EstadoIcon = ({ estado }: { estado: 1 | 2 | 3 }) => {
  if (estado === 1) return <CheckCircle size={14} color="#10B981" />;
  if (estado === 2) return <AlertTriangle size={14} color="#F59E0B" />;
  return <XCircle size={14} color="#E11428" />;
};

/* ─── Card de historial de diagnóstico ─── */
function DiagnosticoCard({ d, carros, usuarios }: { d: DiagnosticoCarro; carros: Carro[]; usuarios: Usuario[] }) {
  const [theme] = useTheme();
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const carro = carros.find(m => m.id_vehiculo === d.id_vehiculo);
  const mec  = usuarios.find(u => u.id_usuario === d.id_mecanico);

  const worst = d.detalles.reduce((a, b) => Math.max(a, nivelDiagnostico(b.estado)), 1) as 1 | 2 | 3;
  const ec = ESTADO_CONFIG[worst];

  return (
    <div style={{ background: isDark ? '#111117' : '#FFFFFF', border: `1px solid ${ec.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <div
        style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ width: 42, height: 42, borderRadius: 10, background: ec.bg, border: `1px solid ${ec.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Car size={18} color={ec.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: isDark ? '#EBEBEB' : '#15151B', fontWeight: 700, fontSize: 14, margin: 0 }}>
            {carro ? `${carro.marca} ${carro.modelo}` : `Vehículo #${d.id_vehiculo}`}
            <span style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(21,21,27,0.42)', fontSize: 12, fontWeight: 500, marginLeft: 8 }}>
              {carro?.placa}
            </span>
          </p>
          <div style={{ display: 'flex', gap: 14, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(21,21,27,0.42)' }}>
              <Clock size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
              {d.fecha ? new Date(d.fecha).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            </span>
            <span style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(21,21,27,0.42)' }}>
              <Gauge size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
              {d.kilometraje_ingreso?.toLocaleString()} km
            </span>
            <span style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(21,21,27,0.42)' }}>
              <User size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
              {mec?.nombre_completo ?? `Mec. #${d.id_mecanico}`}
            </span>
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: ec.color, background: ec.bg, border: `1px solid ${ec.border}`, borderRadius: 99, padding: '3px 10px', whiteSpace: 'nowrap' }}>
          {ec.label}
        </span>
        {open ? <ChevronUp size={14} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(21,21,27,0.42)'} /> : <ChevronDown size={14} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(21,21,27,0.42)'} />}
      </div>

      {open && (
        <div style={{ padding: '0 18px 16px', borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #E4E7EC' }}>

          {/* Foto del carro + datos */}
          {(carro?.ruta_imagen_vehiculo && carro.ruta_imagen_vehiculo !== 'Desconocido') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0', padding: '10px 12px', background: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderRadius: 10, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#E4E7EC'}` }}>
              <img
                src={carro.ruta_imagen_vehiculo}
                alt={`${carro.marca} ${carro.modelo}`}
                style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E4E7EC'}` }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <p style={{ color: isDark ? '#EBEBEB' : '#15151B', fontWeight: 800, fontSize: 14, margin: 0 }}>{carro.marca} {carro.modelo}</p>
                <p style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(21,21,27,0.5)', fontSize: 11, margin: '2px 0 0' }}>{carro.placa} · {carro.anio}</p>
                {d.kilometraje_ingreso && (
                  <p style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(21,21,27,0.4)', fontSize: 11, margin: '2px 0 0' }}>
                    Ingresó con {d.kilometraje_ingreso.toLocaleString('es-EC')} km
                  </p>
                )}
              </div>
            </div>
          )}

          <p className="text-sm">Orden #{d.id_registro ?? 'Sin vinculación histórica'} · Origen: {d.origen_diagnostico ?? 'Sin registrar'}</p>
          {(d.escaner_utilizado || d.codigos_dtc || d.descripcion_escaner) && <div className="text-sm space-y-1">
            <p>Escáner: {d.escaner_utilizado || 'No especificado'} · DTC: {d.codigos_dtc || 'Sin códigos registrados'}</p>
            <p>{d.descripcion_escaner}</p>
          </div>}
          {d.observaciones_generales && (
            <p style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(21,21,27,0.6)', margin: '12px 0', lineHeight: 1.6 }}>
              {d.observaciones_generales}
            </p>
          )}
          <div className="gm-respgrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 12 }}>
            {d.detalles.map(det => {
              const estado = nivelDiagnostico(det.estado);
              const pc = ESTADO_CONFIG[estado];
              const part = PARTES.find(p => p.key === det.parte);
              return (
                <div key={det.parte} style={{ background: pc.bg, border: `1px solid ${pc.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {(() => { const Icon = part?.Icon ?? Cog; return <Icon size={15} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(21,21,27,0.6)'} style={{ flexShrink: 0, marginTop: 1 }} />; })()}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#EBEBEB' : '#15151B' }}>{part?.label ?? det.parte}</span>
                      <EstadoIcon estado={estado} />
                    </div>
                    <span style={{ fontSize: 10, color: pc.color, fontWeight: 700 }}>{det.estado === "CRITICO" ? "Crítico" : pc.label}</span>
                    {det.observacion && (
                      <p style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(21,21,27,0.6)', margin: '4px 0 0', lineHeight: 1.4 }}>{det.observacion}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function DiagnosticoPage() {
  const [theme]     = useTheme();
  const isDark      = theme === 'dark';
  const { user }    = useAuth();
  const toast       = useToast();
  const [params]    = useSearchParams();
  const preselected = useRef(params.get('carro_id'));

  const [carros,    setCarros]    = useState<Carro[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [historial,setHistorial]= useState<DiagnosticoCarro[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  /* Resultado del último diagnóstico guardado (resumen + confirmación de correo) */
  const [resultado, setResultado] = useState<{
    carroLabel: string; placa: string; correo: string;
    malos: { label: string; obs: string }[];
    regulares: { label: string; obs: string }[];
  } | null>(null);

  /* Búsqueda de carro para diagnosticar */
  const [busqueda,    setBusqueda]    = useState('');
  const [carroSel,     setCarroSel]     = useState<Carro | null>(null);
  const [kmIngreso,   setKmIngreso]   = useState('');
  const [obsGen,      setObsGen]      = useState('');
  const [ordenes, setOrdenes] = useState<RegistroDetalle[]>([]);
  const [ordenId, setOrdenId] = useState('');
  const [origen, setOrigen] = useState('CRITERIO_TECNICO');
  const [escaner, setEscaner] = useState('');
  const [dtc, setDtc] = useState('');
  const [lectura, setLectura] = useState('');
  const ordenesVehiculo = ordenes.filter(o => o.id_vehiculo === carroSel?.id_vehiculo && o.estado < 2);
  useEffect(() => { setOrdenId(''); }, [carroSel?.id_vehiculo]);
  const [plantilla, setPlantilla] = useState(PARTES);
  useEffect(() => {
    let active = true;
    diagnosticosApi.plantilla().then(({ data }) => {
      if (active && Array.isArray(data) && data.length) {
        setPlantilla(data.map(({ sistema, nombre }) => ({
          key: sistema,
          label: nombre,
          Icon: PARTES.find(p => p.key === sistema)?.Icon ?? ClipboardList,
        })));
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const [detalles,    setDetalles]    = useState<Record<string, { estado: 1|2|3; obs: string }>>(() =>
    Object.fromEntries(PARTES.map(p => [p.key, { estado: 1, obs: '' }]))
  );

  const load = useCallback(async () => {
    const [m, u, h, orders] = await Promise.allSettled([
      carrosApi.list(),
      usuariosApi.list(),
      user ? diagnosticosApi.byMecanico(user.id_usuario) : Promise.reject(),
      registrosApi.list(),
    ]);
    if (m.status === 'fulfilled') {
      const lista = m.value.data as Carro[];
      setCarros(lista);
      if (preselected.current) {
        const found = lista.find(mo => mo.id_vehiculo === parseInt(preselected.current!));
        if (found) { setCarroSel(found); setKmIngreso(String(found.kilometraje)); setBusqueda(`${found.marca} ${found.modelo}`); preselected.current = null; }
      }
    }
    if (orders.status === 'fulfilled') setOrdenes(orders.value.data as RegistroDetalle[]);
    if (u.status === 'fulfilled') setUsuarios(u.value.data as Usuario[]);
    if (h.status === 'fulfilled') setHistorial(h.value.data as DiagnosticoCarro[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /* Refresco en tiempo real del historial de diagnósticos */
  usePolling(load, { intervalMs: 30_000 });

  const carrosFiltradas = carros.filter(m => {
    const q = busqueda.toLowerCase();
    return (
      m.placa.toLowerCase().includes(q) ||
      m.marca.toLowerCase().includes(q) ||
      m.modelo.toLowerCase().includes(q)
    );
  }).slice(0, 8);

  const setEstado = (parte: string, estado: 1 | 2 | 3) =>
    setDetalles(prev => ({ ...prev, [parte]: { ...prev[parte], estado } }));

  const setObs = (parte: string, obs: string) =>
    setDetalles(prev => ({ ...prev, [parte]: { ...prev[parte], obs } }));

  const handleGuardar = async () => {
    if (!carroSel || !user) return;
    if (!ordenId) { toast.error('Selecciona la orden de trabajo correspondiente'); return; }
    if (!obsGen.trim()) { toast.error('Describe los hallazgos del diagnóstico'); return; }
    const km = Number(kmIngreso);
    if (!Number.isInteger(km) || km < 0) { toast.error('Ingresa el kilometraje de ingreso', 'Error'); return; }

    const estados = { 1: "BUENO", 2: "REGULAR", 3: "MALO" } as const;
    const detList: DetalleDiagnostico[] = plantilla.map(p => ({
      parte:       p.key,
      sistema:     p.key,
      estado:      estados[detalles[p.key]?.estado ?? 1],
      observacion: detalles[p.key]?.obs || null,
    }));

    const diagnostico = {
      id_vehiculo:                  carroSel.id_vehiculo,
      id_mecanico:              user.id_usuario,
      id_registro: Number(ordenId),
      origen_diagnostico: origen,
      escaner_utilizado: escaner.trim() || null,
      codigos_dtc: dtc.trim() || null,
      descripcion_escaner: lectura.trim() || null,
      kilometraje_ingreso:      km,
      observaciones_generales:  obsGen || null,
      detalles:                 detList,
    };

    setSaving(true);
    try {
      const { data } = await diagnosticosApi.create(diagnostico as unknown as Record<string, unknown>);
      setHistorial(prev => [data as DiagnosticoCarro, ...prev]);
      load(); // sincroniza con la verdad del servidor (evita duplicados/estados viejos)
      toast.success('Diagnóstico registrado', 'Diagnóstico');
      /* Resumen + confirmación de correo (el backend envía el reporte al dueño) */
      const owner = usuarios.find(u => u.id_usuario === carroSel.id_usuario);
      setResultado({
        carroLabel: `${carroSel.marca} ${carroSel.modelo}`,
        placa:     carroSel.placa,
        correo:    owner?.correo ?? '',
        malos:     plantilla.filter(p => detalles[p.key]?.estado === 3).map(p => ({ label: p.label, obs: detalles[p.key].obs })),
        regulares: plantilla.filter(p => detalles[p.key]?.estado === 2).map(p => ({ label: p.label, obs: detalles[p.key].obs })),
      });
      // Reset form
      setCarroSel(null);
      setBusqueda('');
      setKmIngreso('');
      setObsGen(''); setOrdenId(''); setOrigen('CRITERIO_TECNICO'); setEscaner(''); setDtc(''); setLectura('');
      setDetalles(Object.fromEntries(PARTES.map(p => [p.key, { estado: 1, obs: '' }])));
    } catch (err) {
      toast.error(getErrorMsg(err), 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const card: React.CSSProperties = {
    background: isDark ? '#111117' : '#FFFFFF', border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E4E7EC', borderRadius: 16, padding: '20px 22px',
  };

  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(21,21,27,0.42)', marginBottom: 6, display: 'block',
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* ── Encabezado ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList size={20} color="#3B82F6" />
          </div>
          <div>
            <h1 style={{ color: isDark ? '#EBEBEB' : '#15151B', fontWeight: 800, fontSize: 22, margin: 0, letterSpacing: '-0.03em' }}>
              Diagnóstico de Vehículo
            </h1>
            <p style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(21,21,27,0.6)', fontSize: 12.5, margin: 0 }}>
              Registro clínico al ingreso — historial de cada vehículo
            </p>
          </div>
        </div>
      </div>

      {/* ── Resultado del último diagnóstico + confirmación de correo ── */}
      {resultado && (() => {
        const critico = resultado.malos.length > 0;
        const acento  = critico ? '#E11428' : (resultado.regulares.length > 0 ? '#F59E0B' : '#10B981');
        const bg      = critico ? 'rgba(225,20,40,0.08)' : (resultado.regulares.length > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)');
        return (
          <div style={{ ...card, marginBottom: 24, borderColor: `${acento}40`, background: bg }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${acento}20`, border: `1px solid ${acento}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {critico ? <XCircle size={18} color={acento} /> : (resultado.regulares.length > 0 ? <AlertTriangle size={18} color={acento} /> : <CheckCircle size={18} color={acento} />)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: isDark ? '#EBEBEB' : '#15151B', fontWeight: 800, fontSize: 15, margin: '0 0 2px' }}>
                  Diagnóstico guardado — {resultado.carroLabel} <span style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(21,21,27,0.42)', fontWeight: 600 }}>{resultado.placa}</span>
                </p>
                <p style={{ color: acento, fontWeight: 700, fontSize: 12.5, margin: '0 0 10px' }}>
                  {critico
                    ? `${resultado.malos.length} componente(s) en estado CRÍTICO${resultado.regulares.length ? ` y ${resultado.regulares.length} a vigilar` : ''}`
                    : (resultado.regulares.length > 0 ? `${resultado.regulares.length} componente(s) a vigilar — nada crítico` : 'Todos los componentes en buen estado ✓')}
                </p>

                {(resultado.malos.length > 0 || resultado.regulares.length > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {resultado.malos.map(m => (
                      <span key={m.label} style={{ fontSize: 11, fontWeight: 700, color: '#E11428', background: 'rgba(225,20,40,0.12)', border: '1px solid rgba(225,20,40,0.25)', borderRadius: 8, padding: '3px 9px' }}>
                        {m.label}: Malo{m.obs ? ` · ${m.obs}` : ''}
                      </span>
                    ))}
                    {resultado.regulares.map(r => (
                      <span key={r.label} style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '3px 9px' }}>
                        {r.label}: Regular{r.obs ? ` · ${r.obs}` : ''}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <CheckCircle size={13} color="#10B981" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                    {resultado.correo
                      ? <>Diagnóstico guardado. Correo de contacto del cliente: <b>{resultado.correo}</b></>
                      : 'El diagnóstico quedó guardado en la orden del vehículo.'}
                  </span>
                </div>
              </div>
              <button onClick={() => setResultado(null)}
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', flexShrink: 0 }}>
                Nuevo diagnóstico
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Formulario nuevo diagnóstico ── */}
      <div style={{ ...card, marginBottom: 24 }}>
        <p style={{ color: isDark ? '#EBEBEB' : '#15151B', fontWeight: 700, fontSize: 15, margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardList size={15} color="#3B82F6" /> Nuevo diagnóstico
        </p>

        {/* Búsqueda de carro */}
        {!carroSel ? (
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Buscar vehículo (placa, marca o modelo)</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(21,21,27,0.35)' }} />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Ej. ABC-1234, Toyota, Corolla…"
                style={{ width: '100%', paddingLeft: 36, paddingRight: 12, height: 42, borderRadius: 10, background: isDark ? '#1A1A22' : '#FFFFFF', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #D1D5DB', color: isDark ? '#EBEBEB' : '#15151B', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {busqueda.length >= 2 && (
              <div style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E4E7EC', background: isDark ? undefined : '#FFFFFF' }}>
                {carrosFiltradas.length === 0 ? (
                  <div style={{ padding: '12px 14px', color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(21,21,27,0.42)', fontSize: 13 }}>Sin resultados</div>
                ) : carrosFiltradas.map(m => {
                  const owner = usuarios.find(u => u.id_usuario === m.id_usuario);
                  return (
                    <div key={m.id_vehiculo} onClick={() => { setCarroSel(m); setKmIngreso(String(m.kilometraje)); setBusqueda(''); }}
                      style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #E4E7EC', background: isDark ? '#16161E' : '#FFFFFF' }}
                      onMouseEnter={e => (e.currentTarget.style.background = isDark ? '#1E1E2A' : '#F0F1F3')}
                      onMouseLeave={e => (e.currentTarget.style.background = isDark ? '#16161E' : '#FFFFFF')}
                    >
                      {m.ruta_imagen_vehiculo && m.ruta_imagen_vehiculo !== 'Desconocido' ? (
                        <img src={m.ruta_imagen_vehiculo} alt={m.placa} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Car size={16} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(21,21,27,0.3)'} />
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <p style={{ color: isDark ? '#EBEBEB' : '#15151B', fontSize: 13, fontWeight: 700, margin: 0 }}>{m.marca} {m.modelo}</p>
                        <p style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(21,21,27,0.5)', fontSize: 11, margin: 0 }}>
                          {m.placa} · {m.kilometraje.toLocaleString()} km
                          {owner ? ` · ${owner.nombre_completo}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Carro seleccionado */
          <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
            {carroSel.ruta_imagen_vehiculo && carroSel.ruta_imagen_vehiculo !== 'Desconocido' ? (
              <img src={carroSel.ruta_imagen_vehiculo} alt={carroSel.placa} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Car size={22} color="#3B82F6" />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <p style={{ color: isDark ? '#EBEBEB' : '#15151B', fontSize: 14, fontWeight: 800, margin: 0 }}>{carroSel.marca} {carroSel.modelo}</p>
              <p style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(21,21,27,0.5)', fontSize: 12, margin: 0 }}>
                {carroSel.placa} · {carroSel.tipo_vehiculo}
              </p>
            </div>
            <button onClick={() => setCarroSel(null)}
              style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(21,21,27,0.42)', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E4E7EC', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>
              Cambiar
            </button>
          </div>
        )}

        {carroSel && <div className="space-y-3 mb-5">
          <label style={lbl}>Orden de trabajo
            <select className="gm-input-d block w-full" value={ordenId} onChange={e => setOrdenId(e.target.value)}>
              <option value="">Selecciona la orden de este ingreso</option>
              {ordenesVehiculo.map(o => <option key={o.id_registro} value={o.id_registro}>Orden #{o.id_registro} · {o.descripcion || 'Ingreso al taller'}</option>)}
            </select>
          </label>
          <p className="text-sm">Completa las cuatro fotos y la firma en la recepción antes de diagnosticar. {ordenId ? <Link to={`/ordenes/${ordenId}`}>Abrir recepción de la orden</Link> : <Link to="/registros">Consultar o crear una orden</Link>}</p>
          <label style={lbl}>Origen del diagnóstico
            <select className="gm-input-d block w-full" value={origen} onChange={e => setOrigen(e.target.value)}>
              <option value="CRITERIO_TECNICO">Criterio técnico del mecánico</option><option value="ESCANER">Resultados del escáner</option><option value="AMBOS">Criterio técnico y escáner</option>
            </select>
          </label>
          {origen !== 'CRITERIO_TECNICO' && <>
            <label style={lbl}>Escáner utilizado<input className="gm-input-d block w-full" value={escaner} onChange={e => setEscaner(e.target.value)} /></label>
            <label style={lbl}>Códigos de falla DTC<input className="gm-input-d block w-full" value={dtc} onChange={e => setDtc(e.target.value)} /></label>
            <label style={lbl}>Resultados del escáner y su interpretación<textarea className="gm-input-d block w-full" value={lectura} onChange={e => setLectura(e.target.value)} placeholder="Describe la lectura; si no hay códigos, indícalo aquí." /></label>
          </>}
        </div>}

        {/* Kilometraje de ingreso */}
        <div className="gm-respgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 18 }}>
          <div>
            <label style={lbl}>Kilometraje de ingreso *</label>
            <div style={{ position: 'relative' }}>
              <Gauge size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(21,21,27,0.35)' }} />
              <input
                type="number" min="0" value={kmIngreso} onChange={e => setKmIngreso(e.target.value)}
                placeholder="Ej. 12500"
                style={{ width: '100%', paddingLeft: 32, height: 42, borderRadius: 10, background: isDark ? '#1A1A22' : '#FFFFFF', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #D1D5DB', color: isDark ? '#EBEBEB' : '#15151B', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div>
            <label style={lbl}>Observaciones generales</label>
            <input
              value={obsGen} onChange={e => setObsGen(e.target.value)}
              placeholder="Descripción del problema o notas del cliente…"
              style={{ width: '100%', height: 42, borderRadius: 10, padding: '0 12px', background: isDark ? '#1A1A22' : '#FFFFFF', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #D1D5DB', color: isDark ? '#EBEBEB' : '#15151B', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Tabla de partes */}
        <div>
          <label style={{ ...lbl, marginBottom: 12 }}>Estado de cada componente</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plantilla.map(parte => {
              const det = detalles[parte.key] ?? { estado: 1, obs: "" };
              const ec  = ESTADO_CONFIG[det.estado];
              return (
                <div key={parte.key} style={{ background: isDark ? '#16161E' : '#F8F9FB', borderRadius: 12, border: `1px solid ${ec.border}`, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <parte.Icon size={16} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(21,21,27,0.45)'} style={{ flexShrink: 0 }} />
                    <span style={{ color: isDark ? '#EBEBEB' : '#15151B', fontSize: 13, fontWeight: 700, flex: 1, minWidth: 120 }}>{parte.label}</span>
                    {/* Botones de estado */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {([1, 2, 3] as const).map(est => {
                        const ecc = ESTADO_CONFIG[est];
                        const active = det.estado === est;
                        return (
                          <button key={est} onClick={() => setEstado(parte.key, est)}
                            style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8, border: `1px solid ${active ? ecc.color : (isDark ? 'rgba(255,255,255,0.1)' : '#E4E7EC')}`, background: active ? ecc.bg : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'), color: active ? ecc.color : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(21,21,27,0.5)'), cursor: 'pointer', transition: 'all 150ms' }}>
                            {ecc.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Nota de la parte */}
                    <input
                      value={det.obs} onChange={e => setObs(parte.key, e.target.value)}
                      placeholder="Nota (opcional)"
                      style={{ flex: 2, minWidth: 160, height: 34, borderRadius: 8, padding: '0 10px', background: isDark ? '#1A1A22' : '#FFFFFF', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #D1D5DB', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(21,21,27,0.7)', fontSize: 12, outline: 'none' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={handleGuardar} disabled={!carroSel || !ordenId || !obsGen.trim() || saving}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#fff', background: (!carroSel || saving) ? 'rgba(59,130,246,0.4)' : '#3B82F6', border: 'none', borderRadius: 10, padding: '10px 22px', cursor: (!carroSel || saving) ? 'not-allowed' : 'pointer' }}>
            <Save size={14} /> {saving ? 'Guardando…' : 'Registrar diagnóstico'}
          </button>
        </div>
      </div>

      {/* ── Historial de diagnósticos ── */}
      <div style={card}>
        <p style={{ color: isDark ? '#EBEBEB' : '#15151B', fontWeight: 700, fontSize: 15, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardList size={15} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(21,21,27,0.35)'} /> Historial de diagnósticos
          <span style={{ marginLeft: 4, fontSize: 11, color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(21,21,27,0.42)', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 99, padding: '2px 8px', fontWeight: 600 }}>
            {historial.length}
          </span>
        </p>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3B82F6', animation: 'spin .8s linear infinite' }} />
          </div>
        ) : historial.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(21,21,27,0.42)', fontSize: 13 }}>
            No hay diagnósticos registrados aún.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {historial.map(d => (
              <DiagnosticoCard key={d.id_diagnostico} d={d} carros={carros} usuarios={usuarios} />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
