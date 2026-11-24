import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import XLSX from 'xlsx-js-style';
import { BarChart2, Calendar, Clock, Download, Edit3, Plus, Users } from 'lucide-react';
import {
  personalApi,
  type AsistenciaPersonalAPI,
  type AsistenciaResp,
  type HorarioTrabajoAPI,
  type PersonalPerfilItem,
  type ReporteDesempenoResp,
} from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { fmtDate, fmtMoney, getErrorMsg } from '../../lib/utils';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

type DiaEditable = {
  dia_semana: number;
  es_laborable: boolean;
  hora_entrada: string;
  hora_salida: string;
  minutos_descanso: number;
  turno: string;
};

const semanaDefault = (): DiaEditable[] =>
  DIAS_SEMANA.map((_, idx) => ({
    dia_semana: idx,
    es_laborable: idx < 5,
    hora_entrada: idx < 5 ? '08:00' : '00:00',
    hora_salida: idx < 5 ? '17:00' : '00:00',
    minutos_descanso: idx < 5 ? 60 : 0,
    turno: 'DIURNO',
  }));

export default function PersonalPage() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'horarios' | 'asistencia' | 'desempeno' | 'fichas'>(
    isAdmin ? 'asistencia' : 'horarios',
  );

  const [personal, setPersonal] = useState<PersonalPerfilItem[]>([]);
  const [horarios, setHorarios] = useState<HorarioTrabajoAPI[]>([]);
  const [asistencia, setAsistencia] = useState<AsistenciaResp | null>(null);
  const [desempeno, setDesempeno] = useState<ReporteDesempenoResp | null>(null);
  const [loading, setLoading] = useState(true);

  const hoy = new Date().toISOString().slice(0, 10);
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [fechaInicio, setFechaInicio] = useState(inicioMes);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [empleadoFiltro, setEmpleadoFiltro] = useState<string>('');

  /* Modal Horario */
  const [horarioEmpId, setHorarioEmpId] = useState<number>(0);
  const [semanaForm, setSemanaForm] = useState<DiaEditable[]>(semanaDefault());
  const [savingHorario, setSavingHorario] = useState(false);

  /* Modal Asistencia */
  const [asistModal, setAsistModal] = useState(false);
  const [asistEditTarget, setAsistEditTarget] = useState<AsistenciaPersonalAPI | null>(null);
  const [savingAsist, setSavingAsist] = useState(false);
  const [asistForm, setAsistForm] = useState({
    id_usuario: 0,
    fecha: hoy,
    turno: 'UNICO',
    estado: 'PRESENTE' as 'PRESENTE' | 'TARDANZA' | 'FALTA' | 'PERMISO' | 'DESCANSO',
    hora_entrada: '08:00',
    hora_salida: '17:00',
    minutos_descanso: 60,
    observaciones: '',
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const empId = empleadoFiltro ? Number(empleadoFiltro) : undefined;
      const [perRes, horRes, asiRes, desRes] = await Promise.all([
        isAdmin ? personalApi.perfiles() : Promise.resolve({ data: [] as PersonalPerfilItem[] }),
        personalApi.horarios(isAdmin ? empId : user?.id_usuario),
        personalApi.asistencia({
          fecha_inicio: fechaInicio || undefined,
          fecha_fin: fechaFin || undefined,
          id_usuario: isAdmin ? empId : user?.id_usuario,
        }),
        isAdmin
          ? personalApi.desempeno({
              fecha_inicio: fechaInicio || undefined,
              fecha_fin: fechaFin || undefined,
              id_mecanico: empId,
            })
          : Promise.resolve({ data: null }),
      ]);
      setPersonal(perRes.data);
      setHorarios(horRes.data);
      setAsistencia(asiRes.data);
      setDesempeno(desRes.data);
    } catch (err) {
      toast.error(getErrorMsg(err) || 'Error al cargar datos de personal');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.id_usuario, empleadoFiltro, fechaInicio, fechaFin, toast]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const abrirEditorHorario = (idUsuario: number) => {
    const actuales = horarios.filter(h => h.id_usuario === idUsuario);
    const base = semanaDefault().map(def => {
      const ex = actuales.find(h => h.dia_semana === def.dia_semana);
      return ex
        ? {
            dia_semana: ex.dia_semana,
            es_laborable: ex.es_laborable,
            hora_entrada: ex.hora_entrada,
            hora_salida: ex.hora_salida,
            minutos_descanso: ex.minutos_descanso,
            turno: ex.turno,
          }
        : def;
    });
    setHorarioEmpId(idUsuario);
    setSemanaForm(base);
  };

  const guardarHorario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horarioEmpId || savingHorario) return;
    setSavingHorario(true);
    try {
      await personalApi.guardarHorarios(horarioEmpId, semanaForm);
      toast.success('Horario semanal guardado');
      setHorarioEmpId(0);
      void cargar();
    } catch (err) {
      toast.error(getErrorMsg(err) || 'No se pudo guardar el horario');
    } finally {
      setSavingHorario(false);
    }
  };

  const abrirNuevaAsistencia = () => {
    const firstEmp = personal[0]?.id_usuario ?? 0;
    setAsistEditTarget(null);
    setAsistForm({
      id_usuario: Number(empleadoFiltro || firstEmp),
      fecha: hoy,
      turno: 'UNICO',
      estado: 'PRESENTE',
      hora_entrada: '08:00',
      hora_salida: '17:00',
      minutos_descanso: 60,
      observaciones: '',
    });
    setAsistModal(true);
  };

  const abrirEditarAsistencia = (a: AsistenciaPersonalAPI) => {
    setAsistEditTarget(a);
    setAsistForm({
      id_usuario: a.id_usuario,
      fecha: a.fecha,
      turno: a.turno,
      estado: a.estado,
      hora_entrada: a.hora_entrada ?? '08:00',
      hora_salida: a.hora_salida ?? '17:00',
      minutos_descanso: a.minutos_descanso,
      observaciones: a.observaciones ?? '',
    });
    setAsistModal(true);
  };

  const guardarAsistencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingAsist) return;
    setSavingAsist(true);
    try {
      if (asistEditTarget) {
        await personalApi.actualizarAsistencia(asistEditTarget.id_asistencia, {
          estado: asistForm.estado,
          hora_entrada: asistForm.hora_entrada,
          hora_salida: asistForm.hora_salida,
          minutos_descanso: Number(asistForm.minutos_descanso),
          observaciones: asistForm.observaciones || undefined,
        });
        toast.success('Registro de asistencia actualizado');
      } else {
        await personalApi.registrarAsistencia({
          id_usuario: Number(asistForm.id_usuario),
          fecha: asistForm.fecha,
          turno: asistForm.turno,
          estado: asistForm.estado,
          hora_entrada: asistForm.hora_entrada,
          hora_salida: asistForm.hora_salida,
          minutos_descanso: Number(asistForm.minutos_descanso),
          observaciones: asistForm.observaciones || undefined,
        });
        toast.success('Asistencia registrada');
      }
      setAsistModal(false);
      void cargar();
    } catch (err) {
      toast.error(getErrorMsg(err) || 'Error al guardar asistencia');
    } finally {
      setSavingAsist(false);
    }
  };

  const exportarDesempenoExcel = () => {
    if (!desempeno?.mecanicos.length) {
      toast.error('No hay datos de desempeño para exportar');
      return;
    }
    const filas = desempeno.mecanicos.map(m => ({
      Mecánico: m.nombre_mecanico,
      'Órdenes asignadas': m.ordenes_asignadas,
      'Órdenes completadas': m.ordenes_completadas,
      'Tasa finalización (%)': m.tasa_finalizacion,
      'Cumplimiento plazos (%)': m.cumplimiento_plazos_pct ?? 'N/A',
      'Horas en taller': m.horas_taller,
      'Horas asistencia': m.horas_asistencia,
      Diagnósticos: m.diagnosticos_realizados,
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Desempeño');
    XLSX.writeFile(wb, `desempeno_mecanicos_${fechaInicio || 'inicio'}_${fechaFin || hoy}.xlsx`);
    toast.success('Reporte de desempeño exportado');
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <div>
          <p className="text-[10px] tracking-[0.35em] uppercase text-gm-red font-black mb-1 flex items-center gap-1.5">
            <Users size={11} /> Recursos Humanos · Taller
          </p>
          <h1 className="text-2xl font-black">Personal, horarios y asistencia</h1>
          <p className="text-sm opacity-60">
            {isAdmin ? 'Turnos, control de asistencia diaria, fichas laborales y desempeño' : 'Consulta tus horarios y asistencia registrada'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { k: 'asistencia', label: 'Asistencia', icon: Clock, adminOnly: false },
              { k: 'horarios', label: 'Horarios', icon: Calendar, adminOnly: false },
              { k: 'desempeno', label: 'Desempeño', icon: BarChart2, adminOnly: true },
              { k: 'fichas', label: 'Fichas laborales', icon: Users, adminOnly: true },
            ] as const
          )
            .filter(item => !item.adminOnly || isAdmin)
            .map(item => (
              <button
                key={item.k}
                type="button"
                onClick={() => setTab(item.k)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                  tab === item.k ? 'bg-gm-red text-white' : 'gm-card-d opacity-75 hover:opacity-100'
                }`}
              >
                <item.icon size={13} /> {item.label}
              </button>
            ))}
        </div>
      </div>

      {/* Filtros comunes */}
      <div className="gm-card-d rounded-2xl p-4 flex flex-wrap items-end gap-3">
        {(tab === 'asistencia' || tab === 'desempeno') && (
          <>
            <label className="text-xs font-semibold">
              <span className="block mb-1 opacity-70">Desde</span>
              <input type="date" className="gm-input-d" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </label>
            <label className="text-xs font-semibold">
              <span className="block mb-1 opacity-70">Hasta</span>
              <input type="date" className="gm-input-d" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            </label>
          </>
        )}
        {isAdmin && (
          <label className="text-xs font-semibold">
            <span className="block mb-1 opacity-70">Empleado</span>
            <select className="gm-select-d" value={empleadoFiltro} onChange={e => setEmpleadoFiltro(e.target.value)}>
              <option value="">Todo el personal</option>
              {personal.map(p => (
                <option key={p.id_usuario} value={p.id_usuario}>{p.nombre_completo}</option>
              ))}
            </select>
          </label>
        )}
        {isAdmin && tab === 'asistencia' && (
          <Button onClick={abrirNuevaAsistencia} icon={<Plus size={14} />}>
            Registrar asistencia
          </Button>
        )}
        {isAdmin && tab === 'desempeno' && (
          <Button variant="secondary" onClick={exportarDesempenoExcel} icon={<Download size={14} />}>
            Exportar Excel
          </Button>
        )}
      </div>

      {loading ? (
        <p role="status" className="opacity-60">Cargando información de personal…</p>
      ) : tab === 'horarios' ? (
        <div className="space-y-4">
          {isAdmin && (
            <div className="gm-card-d rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">Configurar horario semanal de un trabajador:</p>
              <div className="flex flex-wrap gap-2">
                {personal.map(p => (
                  <Button key={p.id_usuario} size="sm" variant="secondary" onClick={() => abrirEditorHorario(p.id_usuario)}>
                    <Edit3 size={12} /> {p.nombre_completo.split(' ').slice(0, 2).join(' ')}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="gm-card-d rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="gm-table-d">
                <thead>
                  <tr><th>Empleado</th><th>Día</th><th>Estado</th><th>Entrada</th><th>Salida</th><th>Descanso</th><th>Turno</th></tr>
                </thead>
                <tbody>
                  {horarios.map(h => (
                    <tr key={`${h.id_usuario}-${h.dia_semana}`}>
                      <td className="font-bold">{h.nombre_empleado ?? `Empleado #${h.id_usuario}`}</td>
                      <td>{DIAS_SEMANA[h.dia_semana] ?? h.dia_semana}</td>
                      <td>{h.es_laborable ? <span className="text-emerald-400 font-bold">Laborable</span> : <span className="opacity-50">Descanso</span>}</td>
                      <td>{h.es_laborable ? h.hora_entrada : '—'}</td>
                      <td>{h.es_laborable ? h.hora_salida : '—'}</td>
                      <td>{h.es_laborable ? `${h.minutos_descanso} min` : '—'}</td>
                      <td>{h.turno}</td>
                    </tr>
                  ))}
                  {!horarios.length && (
                    <tr><td colSpan={7} className="text-center py-8 opacity-50">No hay horarios configurados aún.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : tab === 'asistencia' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="gm-card-d rounded-xl p-4"><p className="text-xs opacity-60">Total horas período</p><p className="text-2xl font-black text-emerald-400">{asistencia?.resumen.total_horas_trabajadas ?? 0} h</p></div>
            <div className="gm-card-d rounded-xl p-4"><p className="text-xs opacity-60">Presentes</p><p className="text-2xl font-black text-blue-400">{asistencia?.resumen.conteo_estados?.PRESENTE ?? 0}</p></div>
            <div className="gm-card-d rounded-xl p-4"><p className="text-xs opacity-60">Tardanzas</p><p className="text-2xl font-black text-amber-400">{asistencia?.resumen.conteo_estados?.TARDANZA ?? 0}</p></div>
            <div className="gm-card-d rounded-xl p-4"><p className="text-xs opacity-60">Faltas / Permisos</p><p className="text-2xl font-black text-rose-400">{(asistencia?.resumen.conteo_estados?.FALTA ?? 0) + (asistencia?.resumen.conteo_estados?.PERMISO ?? 0)}</p></div>
          </div>

          <div className="gm-card-d rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="gm-table-d">
                <thead>
                  <tr><th>Fecha</th><th>Empleado</th><th>Turno</th><th>Estado</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Observaciones</th>{isAdmin && <th></th>}</tr>
                </thead>
                <tbody>
                  {asistencia?.items.map(a => (
                    <tr key={a.id_asistencia}>
                      <td className="text-xs">{fmtDate(a.fecha)}</td>
                      <td className="font-bold">{a.nombre_empleado ?? `#${a.id_usuario}`}</td>
                      <td>{a.turno}</td>
                      <td><span className="font-bold text-xs">{a.estado}</span></td>
                      <td>{a.hora_entrada ?? '—'}</td>
                      <td>{a.hora_salida ?? '—'}</td>
                      <td className="font-black text-emerald-400">{a.horas_trabajadas} h</td>
                      <td className="text-xs opacity-70">{a.observaciones ?? '—'}</td>
                      {isAdmin && (
                        <td>
                          <Button size="sm" variant="secondary" onClick={() => abrirEditarAsistencia(a)}>Editar</Button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!asistencia?.items.length && (
                    <tr><td colSpan={isAdmin ? 9 : 8} className="text-center py-8 opacity-50">No hay registros de asistencia en este rango.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : tab === 'desempeno' && isAdmin ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="gm-card-d rounded-xl p-4"><p className="text-xs opacity-60">Asignadas</p><p className="text-2xl font-black">{desempeno?.resumen.ordenes_asignadas ?? 0}</p></div>
            <div className="gm-card-d rounded-xl p-4"><p className="text-xs opacity-60">Completadas</p><p className="text-2xl font-black text-emerald-400">{desempeno?.resumen.ordenes_completadas ?? 0}</p></div>
            <div className="gm-card-d rounded-xl p-4"><p className="text-xs opacity-60">Horas taller</p><p className="text-2xl font-black text-blue-400">{desempeno?.resumen.horas_taller ?? 0} h</p></div>
            <div className="gm-card-d rounded-xl p-4"><p className="text-xs opacity-60">Horas asistencia</p><p className="text-2xl font-black text-purple-400">{desempeno?.resumen.horas_asistencia ?? 0} h</p></div>
            <div className="gm-card-d rounded-xl p-4"><p className="text-xs opacity-60">Diagnósticos</p><p className="text-2xl font-black text-amber-400">{desempeno?.resumen.diagnosticos_realizados ?? 0}</p></div>
          </div>

          <div className="gm-card-d rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="gm-table-d">
                <thead>
                  <tr><th>Mecánico</th><th>Asignadas</th><th>Completadas</th><th>En proceso</th><th>Tasa fin.</th><th>Cumplimiento plazo</th><th>Horas taller</th><th>Horas asist.</th><th>Diagnósticos</th></tr>
                </thead>
                <tbody>
                  {desempeno?.mecanicos.map(m => (
                    <tr key={m.id_mecanico}>
                      <td><Link to={`/perfiles/${m.id_mecanico}`} className="font-bold text-gm-red">{m.nombre_mecanico}</Link></td>
                      <td>{m.ordenes_asignadas}</td>
                      <td className="text-emerald-400 font-bold">{m.ordenes_completadas}</td>
                      <td>{m.ordenes_en_proceso}</td>
                      <td>{m.tasa_finalizacion}%</td>
                      <td>{m.cumplimiento_plazos_pct != null ? `${m.cumplimiento_plazos_pct}%` : '—'}</td>
                      <td className="font-bold">{m.horas_taller} h</td>
                      <td>{m.horas_asistencia} h</td>
                      <td>{m.diagnosticos_realizados}</td>
                    </tr>
                  ))}
                  {!desempeno?.mecanicos.length && (
                    <tr><td colSpan={9} className="text-center py-8 opacity-50">No hay actividad de mecánicos en este período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {personal.map(p => (
            <div key={p.id_usuario} className="gm-card-d rounded-2xl p-5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base">{p.nombre_completo}</h3>
                  <p className="text-xs opacity-60">{p.roles.join(' · ')}</p>
                </div>
                <Link to={`/perfiles/${p.id_usuario}`} className="text-xs font-bold text-gm-red hover:underline">
                  Ver ficha →
                </Link>
              </div>
              <div className="text-xs space-y-1 pt-2 border-t border-white/[0.06]">
                <p><strong>Cargo:</strong> {p.perfil_laboral?.cargo ?? 'Sin configurar'}</p>
                <p><strong>Especialidad:</strong> {p.perfil_laboral?.especialidad ?? '—'}</p>
                <p><strong>Modalidad pago:</strong> {p.perfil_laboral?.modalidad_pago ?? 'POR_TRABAJO'}</p>
                <p><strong>Tarifa / Salario:</strong> {fmtMoney(p.perfil_laboral?.tarifa_hora ?? 0)}/h · {fmtMoney(p.perfil_laboral?.salario_base ?? 0)} base</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Editor de Horario */}
      <Modal open={horarioEmpId > 0} onClose={() => setHorarioEmpId(0)} title="Configurar horario semanal" size="lg">
        <form onSubmit={guardarHorario} className="space-y-3">
          {semanaForm.map((d, idx) => (
            <div key={d.dia_semana} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center border-b border-white/[0.06] pb-2">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={d.es_laborable}
                  onChange={e => setSemanaForm(prev => prev.map((x, i) => i === idx ? { ...x, es_laborable: e.target.checked } : x))}
                />
                {DIAS_SEMANA[d.dia_semana]}
              </label>
              <input
                type="time"
                disabled={!d.es_laborable}
                className="gm-input-d"
                value={d.hora_entrada}
                onChange={e => setSemanaForm(prev => prev.map((x, i) => i === idx ? { ...x, hora_entrada: e.target.value } : x))}
              />
              <input
                type="time"
                disabled={!d.es_laborable}
                className="gm-input-d"
                value={d.hora_salida}
                onChange={e => setSemanaForm(prev => prev.map((x, i) => i === idx ? { ...x, hora_salida: e.target.value } : x))}
              />
              <input
                type="number"
                disabled={!d.es_laborable}
                min={0}
                className="gm-input-d"
                placeholder="Descanso min"
                value={d.minutos_descanso}
                onChange={e => setSemanaForm(prev => prev.map((x, i) => i === idx ? { ...x, minutos_descanso: Number(e.target.value) } : x))}
              />
              <input
                type="text"
                disabled={!d.es_laborable}
                className="gm-input-d"
                value={d.turno}
                onChange={e => setSemanaForm(prev => prev.map((x, i) => i === idx ? { ...x, turno: e.target.value } : x))}
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setHorarioEmpId(0)}>Cancelar</Button>
            <Button type="submit" loading={savingHorario}>Guardar horario</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Asistencia */}
      <Modal
        open={asistModal}
        onClose={() => setAsistModal(false)}
        title={asistEditTarget ? 'Corregir registro de asistencia' : 'Registrar asistencia diaria'}
        size="sm"
      >
        <form onSubmit={guardarAsistencia} className="space-y-3">
          {!asistEditTarget && (
            <>
              <label className="block text-sm">
                Mecánico / Empleado *
                <select
                  required
                  className="gm-select-d w-full mt-1"
                  value={asistForm.id_usuario}
                  onChange={e => setAsistForm(f => ({ ...f, id_usuario: Number(e.target.value) }))}
                >
                  <option value={0}>Seleccionar…</option>
                  {personal.map(p => <option key={p.id_usuario} value={p.id_usuario}>{p.nombre_completo}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  Fecha *
                  <input type="date" required className="gm-input-d w-full mt-1" value={asistForm.fecha} onChange={e => setAsistForm(f => ({ ...f, fecha: e.target.value }))} />
                </label>
                <label className="block text-sm">
                  Turno
                  <input type="text" required className="gm-input-d w-full mt-1" value={asistForm.turno} onChange={e => setAsistForm(f => ({ ...f, turno: e.target.value }))} />
                </label>
              </div>
            </>
          )}

          <label className="block text-sm">
            Estado *
            <select
              className="gm-select-d w-full mt-1"
              value={asistForm.estado}
              onChange={e => setAsistForm(f => ({ ...f, estado: e.target.value as typeof f.estado }))}
            >
              <option value="PRESENTE">Presente</option>
              <option value="TARDANZA">Tardanza</option>
              <option value="FALTA">Falta</option>
              <option value="PERMISO">Permiso</option>
              <option value="DESCANSO">Descanso</option>
            </select>
          </label>

          {(asistForm.estado === 'PRESENTE' || asistForm.estado === 'TARDANZA') && (
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-xs">
                Entrada
                <input type="time" className="gm-input-d w-full mt-1" value={asistForm.hora_entrada} onChange={e => setAsistForm(f => ({ ...f, hora_entrada: e.target.value }))} />
              </label>
              <label className="block text-xs">
                Salida
                <input type="time" className="gm-input-d w-full mt-1" value={asistForm.hora_salida} onChange={e => setAsistForm(f => ({ ...f, hora_salida: e.target.value }))} />
              </label>
              <label className="block text-xs">
                Descanso (m)
                <input type="number" min={0} className="gm-input-d w-full mt-1" value={asistForm.minutos_descanso} onChange={e => setAsistForm(f => ({ ...f, minutos_descanso: Number(e.target.value) }))} />
              </label>
            </div>
          )}

          <label className="block text-sm">
            Observaciones
            <input type="text" className="gm-input-d w-full mt-1" value={asistForm.observaciones} onChange={e => setAsistForm(f => ({ ...f, observaciones: e.target.value }))} />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAsistModal(false)}>Cancelar</Button>
            <Button type="submit" loading={savingAsist}>Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
