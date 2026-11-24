import { VEHICLE_TYPES } from '../../lib/constants';
/* ─────────────────────────────────────────────
   OpenMotors — Carros Page  (Redesign Premium)
   ───────────────────────────────────────────── */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Car, Gauge, User, Calendar, Zap, Shield, SlidersHorizontal, ClipboardList, ImageIcon } from 'lucide-react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import gsap from 'gsap';
import { carrosApi, usuariosApi } from '../../lib/api';
import { comprimirImagen, imagenCarro } from '../../lib/fotos';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { getErrorMsg } from '../../lib/utils';
import type { Carro, Usuario } from '../../types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';

/* Tipos de carro disponibles en el taller. */
const TIPOS = VEHICLE_TYPES;

/* Marcas comunes en Ecuador (datalist, no restringe texto libre) */
const MARCAS_EC = ['Chevrolet', 'Toyota', 'Kia', 'Hyundai', 'Suzuki', 'Nissan', 'Ford', 'Renault', 'Mazda', 'Volkswagen', 'Honda'];

/* Color accent por tipo */
const TIPO_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  'Sedán': { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', dot: '#3B82F6' },
  'Coupé': { color: '#FF3B47', bg: 'rgba(255,59,71,0.12)', dot: '#FF3B47' },
  Pickup: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', dot: '#F59E0B' },
  SUV: { color: '#00E676', bg: 'rgba(0,230,118,0.12)', dot: '#00E676' },
  Van: { color: '#00C9FF', bg: 'rgba(0,201,255,0.12)', dot: '#00C9FF' },
  Otro: { color: '#8A8A9E', bg: 'rgba(138,138,158,0.12)', dot: '#8A8A9E' },
};
const getTipoConfig = (tipo: string) =>
  TIPO_CONFIG[tipo] ?? TIPO_CONFIG['Otro'];

const schema = z.object({
  placa: z.string().min(6, 'Mínimo 6 caracteres').transform((v) => v.toUpperCase()),
  anio: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  marca: z.string().min(2),
  modelo: z.string().min(1),
  nombre_vehiculo: z.string().optional(),
  tipo_vehiculo: z.string().min(1, 'Selecciona el tipo'),
  kilometraje: z.coerce.number().int().nonnegative(),
  id_usuario: z.coerce.number().positive('Selecciona un propietario'),
  /* La foto NO va en el formulario: se maneja aparte (imageFile) para no
     arrastrar valores viejos/vacíos al PUT y dañar otros carros. */
});
type Form = z.infer<typeof schema>;


/* ─── Skeleton Card ─── */
function SkeletonCard() {
  return (
    <div className="carro-card-skeleton">
      <div className="carro-card-sk-header">
        <div className="sk-pill" />
        <div className="sk-actions" />
      </div>
      <div className="carro-card-sk-body">
        <div className="sk-title" />
        <div className="sk-sub" />
      </div>
      <div className="carro-card-sk-stats">
        {[1, 2, 3, 4].map((i) => <div key={i} className="sk-stat" />)}
      </div>
      <div className="carro-card-sk-footer" />
    </div>
  );
}

/* ─── Carro Card Premium ─── */
function CarroCard({
  carro, ownerName, onEdit, onDelete, canManage = false, canDelete = false,
}: {
  carro: Carro; ownerName: string; index?: number;
  onEdit: (m: Carro) => void; onDelete: (m: Carro) => void;
  canManage?: boolean; canDelete?: boolean;
}) {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const tc = getTipoConfig(carro.tipo_vehiculo);

  /* Mouse parallax glow */
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !glowRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    glowRef.current.style.background =
      `radial-gradient(circle at ${x}% ${y}%, ${tc.color}18 0%, transparent 60%)`;
  };

  const handleEnter = () => {
    gsap.to(cardRef.current, { y: -6, scale: 1.018, duration: 0.35, ease: 'power2.out' });
    gsap.to(glowRef.current, { opacity: 1, duration: 0.3 });
  };
  const handleLeave = () => {
    gsap.to(cardRef.current, { y: 0, scale: 1, duration: 0.45, ease: 'power3.out' });
    gsap.to(glowRef.current, { opacity: 0, duration: 0.4 });
    if (glowRef.current) glowRef.current.style.background = 'none';
  };

  const km = (carro.kilometraje ?? 0).toLocaleString('es-CO');
  const anioActual = new Date().getFullYear();
  const antiguedad = carro.anio ? anioActual - carro.anio : 0;

  return (
    <div
      ref={cardRef}
      className="carro-card card-enter"
      style={{ '--tc': tc.color, '--tc-bg': tc.bg, cursor: 'pointer' } as React.CSSProperties}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onMouseMove={handleMove}
      onClick={() => navigate(`/carros/${carro.id_vehiculo}`)}
    >
      {/* Glow layer */}
      <div ref={glowRef} className="carro-card-glow" />

      {/* Top accent bar */}
      <div className="carro-card-accent" style={{ background: `linear-gradient(90deg, ${tc.color}, transparent)` }} />

      {/* Header */}
      <div className="carro-card-header">
        {/* Tipo badge */}
        <div className="carro-tipo-badge" style={{ background: tc.bg, borderColor: `${tc.color}35` }}>
          <span className="carro-tipo-dot" style={{ background: tc.color }} />
          <span style={{ color: tc.color }}>{carro.tipo_vehiculo}</span>
        </div>

        {/* Acciones — solo para admin/mecánico */}
        {canManage && (
          <div className="carro-card-actions">
            <button onClick={e => { e.stopPropagation(); onEdit(carro); }} className="carro-action-btn" title="Editar">
              <Pencil size={12} />
            </button>
            {canDelete && (<button onClick={e => { e.stopPropagation(); onDelete(carro); }} className="carro-action-btn danger" title="Eliminar">
              <Trash2 size={12} />
            </button>)}
          </div>
        )}
      </div>

      {/* Photo + Plate + Main info */}
      <div className="carro-card-body">
        {imagenCarro(carro) ? (
          <div style={{ width: '100%', height: 110, borderRadius: 10, overflow: 'hidden', marginBottom: 10, border: `1px solid ${tc.color}20` }}>
            <img src={imagenCarro(carro)!} alt={`${carro.marca} ${carro.modelo}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ) : null}
        <div className="carro-plate-wrap">
          <span className="plate-tag">{carro.placa}</span>
        </div>
        <h3 className="carro-name">
          {carro.marca} <span className="carro-modelo">{carro.modelo}</span>
        </h3>
        {carro.nombre_vehiculo && (
          <p className="carro-alias">
            <span className="carro-alias-quote">"</span>{carro.nombre_vehiculo}<span className="carro-alias-quote">"</span>
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="carro-stats">
        <div className="carro-stat-item">
          <div className="carro-stat-icon" style={{ background: tc.bg }}>
            <Gauge size={13} style={{ color: tc.color }} />
          </div>
          <div>
            <p className="carro-stat-val">{carro.modelo}</p>
            <p className="carro-stat-lbl">Modelo</p>
          </div>
        </div>

        <div className="carro-stat-divider" />

        <div className="carro-stat-item">
          <div className="carro-stat-icon" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Zap size={13} className="dark:text-white/40 text-slate-900/40" />
          </div>
          <div>
            <p className="carro-stat-val">{km}</p>
            <p className="carro-stat-lbl">km</p>
          </div>
        </div>

        <div className="carro-stat-divider" />

        <div className="carro-stat-item">
          <div className="carro-stat-icon" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Calendar size={13} className="dark:text-white/40 text-slate-900/40" />
          </div>
          <div>
            <p className="carro-stat-val">{carro.anio}</p>
            <p className="carro-stat-lbl">{antiguedad === 0 ? 'nuevo' : `${antiguedad}a`}</p>
          </div>
        </div>
      </div>

      {/* Footer owner + diagnostic */}
      <div className="carro-card-footer">
        <div className="carro-owner">
          <div className="carro-owner-avatar">
            <User size={9} />
          </div>
          <span className="carro-owner-name">{ownerName}</span>
        </div>
        <Link
          to={`/diagnostico?carro_id=${carro.id_vehiculo}`}
          title="Ver / crear diagnóstico"
          onClick={e => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'rgba(59,130,246,0.7)', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#3B82F6'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(59,130,246,0.7)'}
        >
          <ClipboardList size={11} /> Diagnóstico
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════ MAIN PAGE ═══════════════ */
export default function CarrosPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { user: me, isAdmin, isMecanico, isCliente } = useAuth();

  /** Admin y mecánico tienen acceso completo (crear/editar/eliminar, ver todo) */
  const canManage = isAdmin || (isMecanico && (me?.permisos?.includes("recepcion") ?? false));

  const [carros, setCarros] = useState<Carro[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Carro | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Carro | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema) as Resolver<Form>,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (isCliente && !isMecanico && !canManage && me) {
        // Cliente: solo sus propios carros, sin llamar a la lista completa
        const { data } = await carrosApi.byUser(me.id_usuario);
        setCarros(data as Carro[]);
        setUsuarios([me as unknown as Usuario]);
      } else {
        // Admin / Mecánico: todas los carros y todos los propietarios
        const [m, u] = await Promise.allSettled([carrosApi.list(), usuariosApi.list()]);
        if (m.status === 'fulfilled') setCarros(m.value.data as Carro[]);
        if (u.status === 'fulfilled') setUsuarios(u.value.data as Usuario[]);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [isCliente, canManage, me]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (loading) return;
    const ctx = gsap.context(() => {
      const headers = gsap.utils.toArray<HTMLElement>('.mp-header-el');
      const cards = gsap.utils.toArray<HTMLElement>('.card-enter');
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      if (headers.length) tl.fromTo(headers, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.06 });
      if (cards.length) tl.fromTo(cards, { y: 40, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, stagger: 0.08, duration: 0.65, clearProps: 'transform' }, '-=0.3');
    }, pageRef);
    return () => ctx.revert();
  }, [loading]);

  const openCreate = () => {
    setEditTarget(null);
    setImageFile(null); setImagePreview(null);
    reset({ id_usuario: 0 });
    setModalOpen(true);
  };

  const openEdit = (m: Carro) => {
    setEditTarget(m);
    setImageFile(null); setImagePreview(null);
    reset({
      placa: m.placa, anio: m.anio, marca: m.marca, modelo: m.modelo,
      nombre_vehiculo: m.nombre_vehiculo ?? '', tipo_vehiculo: m.tipo_vehiculo,
      kilometraje: m.kilometraje, id_usuario: m.id_usuario,
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: Form) => {
    setSaving(true);
    /* Capturamos el id del carro editado UNA sola vez: así una foto SIEMPRE
       se guarda en el carro correcta, sin importar re-renders o cambios de estado. */
    const carroIdEditada = editTarget?.id_vehiculo ?? null;
    try {
      /* Foto comprimida en el dispositivo (instantáneo, sin servidor) */
      let fotoBase64: string | null = null;
      if (imageFile) {
        try { fotoBase64 = await comprimirImagen(imageFile); } catch { /* se guarda sin foto */ }
      }
      if (carroIdEditada != null) {
        /* data NUNCA incluye ruta_imagen_vehiculo (no está en el schema) →
           editar km/marca/etc. jamás toca la foto de esta ni de otro carro. */
        await carrosApi.update(carroIdEditada, data);
        if (fotoBase64) {
          try { await carrosApi.update(carroIdEditada, { ruta_imagen_vehiculo: fotoBase64 }); }
          catch { toast.error('Datos guardados, pero la foto no (actualiza el backend a columna TEXT).'); }
        }
        toast.success('Vehículo actualizado');
      } else {
        const { data: nueva } = await carrosApi.create(data);
        const creada = nueva as Carro;
        if (fotoBase64 && creada?.id_vehiculo) {
          try { await carrosApi.update(creada.id_vehiculo, { ruta_imagen_vehiculo: fotoBase64 }); }
          catch { toast.error('Vehículo creado, pero la foto no se guardó (actualiza el backend a columna TEXT).'); }
        }
        toast.success('Vehículo registrado');
      }
      setModalOpen(false);
      setImageFile(null); setImagePreview(null);
      fetchData();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); setUploadMsg(null); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await carrosApi.remove(deleteTarget.id_vehiculo);
      toast.success('Vehículo eliminado');
      setDeleteTarget(null);
      fetchData();
    } catch (err) { toast.error(getErrorMsg(err)); }
  };

  const ownerName = (id: number) =>
    usuarios.find((u) => u.id_usuario === id)?.nombre_completo ?? '—';

  const filtered = carros.filter((m) => {
    const q = search.toLowerCase();
    const owner = ownerName(m.id_usuario).toLowerCase();
    const matchQ =
      m.placa.toLowerCase().includes(q) ||
      m.marca.toLowerCase().includes(q) ||
      m.modelo.toLowerCase().includes(q) ||
      owner.includes(q);
    const matchTipo = filterTipo === '' || m.tipo_vehiculo === filterTipo;
    return matchQ && matchTipo;
  });

  /* Stats summary */
  const tiposUnicos = [...new Set(carros.map((m) => m.tipo_vehiculo))];

  return (
    <div ref={pageRef} className="mp-root">

      {/* ─── Page Header ─── */}
      <div className="mp-header mp-header-el">
        <div className="mp-header-left">
          <div className="mp-breadcrumb">
            <Shield size={10} className="mp-bc-icon" />
            <span>{canManage ? 'Inventario' : 'Mi cuenta'}</span>
            <span className="mp-bc-sep">›</span>
            <span className="mp-bc-active">{canManage ? 'Vehículos' : 'Mis vehículos'}</span>
          </div>
          <h1 className="mp-title">
            {canManage
              ? <>Flota de <span className="mp-title-accent">Vehículos</span></>
              : <>Mis <span className="mp-title-accent">Vehículos</span></>
            }
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto mt-3 sm:mt-0">
          {canManage && <Button icon={<Plus size={14} />} onClick={openCreate}>Nuevo vehículo</Button>}
        </div>
      </div>

      {/* ─── KPI Strip ─── */}
      <div className="mp-kpi-strip mp-header-el">
        <div className="mp-kpi">
          <span className="mp-kpi-num">{carros.length}</span>
          <span className="mp-kpi-lbl">Vehículos totales</span>
        </div>
        <div className="mp-kpi-sep" />
        <div className="mp-kpi">
          <span className="mp-kpi-num">{tiposUnicos.length}</span>
          <span className="mp-kpi-lbl">Tipos diferentes</span>
        </div>


        <div className="mp-kpi-sep" />
        <div className="mp-kpi">
          <span className="mp-kpi-num">{usuarios.length}</span>
          <span className="mp-kpi-lbl">Propietarios</span>
        </div>
      </div>

      {/* ─── Search + Filters ─── */}
      <div className="mp-controls mp-header-el">
        <div className="search-d">
          <Search size={14} />
          <input
            className="gm-input-d mp-search-input"
            placeholder="Buscar por placa, marca, modelo, dueño o cc..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mp-filters">
          <SlidersHorizontal size={12} className="mp-filter-icon" />
          <button
            className={`filter-chip ${filterTipo === '' ? 'active' : ''}`}
            onClick={() => setFilterTipo('')}
          >
            Todos
          </button>
          {TIPOS.map((t) => (
            <button
              key={t}
              className={`filter-chip ${filterTipo === t ? 'active' : ''}`}
              onClick={() => setFilterTipo(filterTipo === t ? '' : t)}
              style={filterTipo === t
                ? { '--chip-color': getTipoConfig(t).color } as React.CSSProperties
                : {}}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Grid ─── */}
      <div className="mp-grid">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.length === 0
            ? (
              <div className="mp-empty">
                <div className="mp-empty-icon">
                  <Car size={32} />
                </div>
                <p className="mp-empty-title">Sin vehículos registrados</p>
                <p className="mp-empty-sub">
                  {search || filterTipo ? 'Intenta con otro filtro' : 'Agrega el primer vehículo de la flota'}
                </p>
                {canManage && !search && !filterTipo && (
                  <button onClick={openCreate} className="mp-empty-cta">
                    <Plus size={14} /> Registrar primer vehículo
                  </button>
                )}
              </div>
            )
            : filtered.map((m, i) => (
              <CarroCard
                key={m.id_vehiculo}
                carro={m}
                ownerName={ownerName(m.id_usuario)}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                index={i}
                canManage={canManage}
                canDelete={isAdmin}
              />
            ))
        }
      </div>

      {/* ─── Modal crear/editar ─── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Editar vehículo' : 'Registrar nuevo vehículo'}
        size="lg"
        footer={
          <>
            {uploadMsg && (
              <span style={{ fontSize: 12, color: '#3B82F6', fontWeight: 600, marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(59,130,246,0.3)', borderTopColor: '#3B82F6', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                {uploadMsg}
              </span>
            )}
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button form="carro-form" type="submit" loading={saving}>
              {editTarget ? 'Guardar cambios' : 'Registrar vehículo'}
            </Button>
          </>
        }
      >
        <form id="carro-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

          {/* Aviso de privacidad — solo al crear, no al editar */}
          {!editTarget && (
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.18)',
              borderLeft: '3px solid #3B82F6',
              borderRadius: 9, padding: '11px 14px',
            }}>
              <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>🔒</span>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.52)', margin: 0, lineHeight: 1.65 }}>
                <strong style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Aviso de privacidad:</strong>{' '}
                Los datos que ingreses (placa, marca, modelo, kilometraje y propietario) serán visibles para el
                administrador y el personal autorizado del taller, conforme a la{' '}
                <a
                  href="/privacidad"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#3B82F6', textDecoration: 'none', fontWeight: 600 }}
                >
                  política de privacidad
                </a>.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input label="Placa" placeholder="ABC-1234" error={errors.placa?.message} {...register('placa')} />
            <Input label="Año" type="number" placeholder={String(new Date().getFullYear())} error={errors.anio?.message} {...register('anio')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Marca" placeholder="Honda" list="marcas-ec" error={errors.marca?.message} {...register('marca')} />
            <Input label="Modelo" placeholder="Corolla" error={errors.modelo?.message} {...register('modelo')} />
          </div>
          <datalist id="marcas-ec">
            {MARCAS_EC.map((m) => <option key={m} value={m} />)}
          </datalist>
          <Input label='Nombre del vehículo (opcional)' placeholder='"La Bestia"' {...register('nombre_vehiculo')} />

          {/* Foto del carro */}
          <div>
            <label className="text-sm font-medium dark:text-white/70 text-slate-900/70 block mb-1.5">
              Foto del vehículo <span className="dark:text-white/25 text-slate-900/25 text-xs font-normal">(opcional)</span>
            </label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => imgInput.current?.click()}
              onKeyDown={e => e.key === 'Enter' && imgInput.current?.click()}
              className="relative border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all duration-200 focus:outline-none"
              style={{
                borderColor: imagePreview || (editTarget && imagenCarro(editTarget)) ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              {imagePreview || (editTarget && imagenCarro(editTarget)) ? (
                <div className="relative">
                  <img
                    src={imagePreview ?? (editTarget ? imagenCarro(editTarget) ?? '' : '')}
                    alt="Preview"
                    className="w-full h-40 object-cover block"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200"
                    style={{ background: 'rgba(0,0,0,0.55)' }}>
                    <p className="dark:text-white text-slate-900 text-xs font-bold tracking-wider uppercase">Cambiar foto</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <ImageIcon size={28} className="dark:text-white/40 text-slate-900/40" />
                  <p className="text-[12px] font-semibold dark:text-white/55 text-slate-900/55">Toca para subir foto</p>
                  <p className="text-[10px] dark:text-white/40 text-slate-900/40">JPG · PNG · WebP · máx 10 MB</p>
                </div>
              )}
              <input
                ref={imgInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setImageFile(f);
                  const reader = new FileReader();
                  reader.onload = () => setImagePreview(reader.result as string);
                  reader.readAsDataURL(f);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium dark:text-white/70 text-slate-900/70 block mb-1.5">Tipo de vehículo</label>
              <select className="gm-input-d" {...register('tipo_vehiculo')}>
                <option value="">Seleccionar</option>
                {(editTarget && !TIPOS.includes(editTarget.tipo_vehiculo) ? [...TIPOS, editTarget.tipo_vehiculo] : TIPOS).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.tipo_vehiculo && <p className="text-xs text-gm-red mt-1">{errors.tipo_vehiculo.message}</p>}
            </div>
            <Input label="Kilometraje" type="number" placeholder="0" error={errors.kilometraje?.message} {...register('kilometraje')} />
          </div>
          <div>
            <label className="text-sm font-medium dark:text-white/70 text-slate-900/70 block mb-1.5">Propietario</label>
            {canManage ? (
              /* Admin / Mecánico — elige cualquier propietario */
              <>
                <select className="gm-input-d" {...register('id_usuario')}>
                  <option value="0">Seleccionar propietario</option>
                  {[...usuarios]
                    .sort((a, b) => {
                      const aAdmin = a.correo === 'OpenMotors2026@gmail.com';
                      const bAdmin = b.correo === 'OpenMotors2026@gmail.com';
                      if (aAdmin && !bAdmin) return 1;
                      if (!aAdmin && bAdmin) return -1;
                      return (a.nombre_completo ?? '').localeCompare(b.nombre_completo ?? '');
                    })
                    .map((u) => (
                      <option key={u.id_usuario} value={u.id_usuario}>
                        {u.nombre_completo} — {u.correo}
                      </option>
                    ))}
                </select>
                {errors.id_usuario && <p className="text-xs text-gm-red mt-1">{errors.id_usuario.message}</p>}
              </>
            ) : (
              /* Cliente — siempre es él mismo */
              <>
                <input type="hidden" value={me?.id_usuario ?? 0} {...register('id_usuario')} />
                <div className="gm-input-d flex items-center gap-2 dark:text-white/50 text-slate-900/50 cursor-not-allowed select-none"
                  style={{ opacity: 0.7 }}>
                  <User size={13} />
                  <span>{me?.nombre_completo} (tu cuenta)</span>
                </div>
              </>
            )}
          </div>
        </form>
      </Modal>

      {/* ─── Modal confirmar eliminar ─── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar vehículo"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete}>Eliminar</Button>
          </>
        }
      >
        <p className="text-sm dark:text-white/60 text-slate-900/60">
          ¿Eliminar el vehículo{' '}
          <span className="plate-tag">{deleteTarget?.placa}</span>
          {' '}·{' '}<strong className="dark:text-white/85 text-slate-900/85">{deleteTarget?.marca} {deleteTarget?.modelo}</strong>?
          <br />
          <span className="dark:text-white/35 text-slate-900/35 text-xs mt-2 block">Se perderán todos sus registros de servicio.</span>
        </p>
      </Modal>
    </div>
  );
}
