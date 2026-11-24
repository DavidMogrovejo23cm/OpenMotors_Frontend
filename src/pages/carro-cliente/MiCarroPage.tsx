import { VEHICLE_TYPES } from '../../lib/constants';
/* ─────────────────────────────────────────────
   OpenMotors — Mi Carro (vista cliente)
   Muestra los carros del cliente o formulario para registrar la primera.
   Incluye sección para completar datos personales (cédula / teléfono).
   ───────────────────────────────────────────── */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Car, Camera, Plus, User, Phone, CreditCard,
  CheckCircle, Pencil, X, Save,
  Gauge, Activity,
} from 'lucide-react';
import { carrosApi, usuariosApi, mantenimientosApi } from '../../lib/api';
import { usePolling } from '../../hooks/usePolling';
import { comprimirImagen, imagenCarro } from '../../lib/fotos';
import { esNativo, tomarFotoNativa } from '../../lib/camara';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../components/ui/Toast';
import { getErrorMsg } from '../../lib/utils';
import Input from '../../components/ui/Input';
import type { Carro } from '../../types';
import { EstadoCarroLive } from '../../components/mantenimiento/EstadoMantenimiento';
import { calcularEstadoLocal } from '../../lib/mantenimiento';

/* ─── Tipos de carro usados en Ecuador (igual que CarrosPage) ─── */
const TIPOS = VEHICLE_TYPES;

const TIPO_COLOR: Record<string, string> = {
  Calle: '#3B82F6', Deportiva: '#FF3B47', Trabajo: '#F59E0B',
  Todoterreno: '#00E676', Touring: '#00C9FF', Otro: '#8A8A9E',
};

/* ─── Schema formulario carro ─── */
const carroSchema = z.object({
  placa:       z.string().min(6, 'Mínimo 6 caracteres').transform(v => v.toUpperCase()),
  anio:        z.coerce.number().int().min(1980, 'Año desde 1980').max(new Date().getFullYear() + 1, 'Año inválido'),
  marca:       z.string().min(2, 'Ingresa la marca'),
  modelo:      z.string().min(1, 'Ingresa el modelo'),
  nombre_vehiculo: z.string().optional(),
  tipo_vehiculo:   z.string().min(1, 'Selecciona el tipo'),
  kilometraje: z.coerce.number().int().nonnegative('Ingresa los kilómetros'),
});
type CarroForm = z.infer<typeof carroSchema>;

/* ─── Schema perfil personal ─── */
const perfilSchema = z.object({
  nombre_completo: z.string().min(3, 'Nombre completo requerido').max(100),
  cedula:    z.string().min(8, 'Cédula/ID mínimo 8 dígitos').max(20),
  telefono:  z.string().min(7, 'Teléfono mínimo 7 dígitos').max(15),
  direccion: z.string().max(300).optional().or(z.literal('')),
});
type PerfilForm = z.infer<typeof perfilSchema>;

/* ══════════════════════════════════════════════════════════════ */
export default function MiCarroPage() {
  const { user }   = useAuth();
  const toast      = useToast();
  const [theme]    = useTheme();
  const isDark     = theme === 'dark';

  const [carros,        setCarros]       = useState<Carro[]>([]);
  const [loadingCarros, setLoadingCarros] = useState(true);
  const [addingCarro,   setAddingCarro]  = useState(false);
  const [savingCarro,   setSavingCarro]  = useState(false);

  const [photoFile,    setPhotoFile]   = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  /* Cuando la foto viene de la cámara nativa ya es un dataURL comprimido. */
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [savingPhotoId, setSavingPhotoId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingPerfil, setEditingPerfil] = useState(false);
  const [savingPerfil,  setSavingPerfil]  = useState(false);
  /* Override local de los datos personales recién guardados.
     El AuthContext no expone setUser, así que tras guardar el perfil el
     `user.descripcion` en memoria queda viejo y `perfilOk` seguiría en false,
     trabando el registro del carro. Con este override la UI refleja al
     instante la cédula/teléfono recién guardados sin recargar la página. */
  const [perfilLocal, setPerfilLocal] = useState<{ cedula: string; telefono: string; direccion: string } | null>(null);

  /* Actualización de km */
  const [kmCarro,       setKmCarro]       = useState<Record<number, string>>({});
  const [savingKm,     setSavingKm]     = useState<number | null>(null);
  const [uploadMsg,    setUploadMsg]    = useState<string | null>(null);
  const [serviciosMap, setServiciosMap] = useState<Record<number, Record<string, number>>>({});

  const desc = user?.descripcion ?? '';
  const parsedCedula   = user?.cedula || desc.match(/CEDULA:\s*([^\s|]+)/)?.[1]?.replace('N/A', '') || '';
  const parsedTelefono = user?.telefono || desc.match(/TELEFONO:\s*([^\s|]+)/)?.[1]?.replace('N/A', '') || '';
  const parsedDireccion = user?.direccion || '';
  const nombreCompleto = user?.nombre_completo || '';

  const cedula    = (perfilLocal?.cedula    ?? parsedCedula)   || null;
  const telefono  = (perfilLocal?.telefono  ?? parsedTelefono) || null;
  const direccion = (perfilLocal?.direccion ?? parsedDireccion) || null;

  const perfilOk = !!cedula && !!telefono && !!nombreCompleto;

  const {
    register: regCarro,
    handleSubmit: handleCarro,
    reset: resetCarro,
    formState: { errors: errCarro },
  } = useForm<CarroForm>({ resolver: zodResolver(carroSchema) as Resolver<CarroForm> });

  const {
    register: regPerfil,
    handleSubmit: handlePerfil,
    formState: { errors: errPerfil },
  } = useForm<PerfilForm>({
    resolver: zodResolver(perfilSchema),
    defaultValues: { nombre_completo: nombreCompleto, cedula: cedula || '', telefono: telefono || '', direccion: direccion || '' }
  });

  const cargarCarros = useCallback(async (silent = false) => {
    if (!user?.id_usuario) return;
    if (!silent) setLoadingCarros(true);
    try {
      const { data } = await carrosApi.byUser(user.id_usuario);
      const lista = Array.isArray(data) ? data as Carro[] : [];
      setCarros(lista);
      setKmCarro(prev => {
        const next = { ...prev };
        lista.forEach(m => {
          if (next[m.id_vehiculo] === undefined) next[m.id_vehiculo] = String(m.kilometraje);
        });
        return next;
      });
      const res = await Promise.allSettled(lista.map(m => mantenimientosApi.byCarro(m.id_vehiculo)));
      const map: Record<number, Record<string, number>> = {};
      res.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const sm: Record<string, number> = {};
          (r.value.data as { tipo: string; kmServicio: number }[]).forEach(x => {
            sm[x.tipo] = Math.max(sm[x.tipo] ?? 0, x.kmServicio);
          });
          map[lista[i].id_vehiculo] = sm;
        }
      });
      setServiciosMap(map);
    } catch { setCarros([]); }
    finally { if (!silent) setLoadingCarros(false); }
  }, [user?.id_usuario]);

  useEffect(() => { cargarCarros(false); }, [cargarCarros]);
  usePolling(() => cargarCarros(true), { intervalMs: 30_000 });

  const actualizarKm = async (carro: Carro) => {
    const km = parseInt(kmCarro[carro.id_vehiculo] ?? '');
    if (isNaN(km) || km < 0) { toast.error('Ingresa un kilómetro válido', 'Error'); return; }
    setSavingKm(carro.id_vehiculo);
    try {
      await carrosApi.update(carro.id_vehiculo, { kilometraje: km });
      setCarros(prev => prev.map(m => m.id_vehiculo === carro.id_vehiculo ? { ...m, kilometraje: km } : m));
      toast.success('Kilometraje actualizado · Recalculando mantenimiento…', 'Mis vehículos');
    } catch (err) {
      toast.error(getErrorMsg(err), 'Error');
    } finally {
      setSavingKm(null);
    }
  };

  const onSelectPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoDataUrl(null);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const onPickPhotoNative = async () => {
    try {
      const dataUrl = await tomarFotoNativa('preguntar');
      setPhotoDataUrl(dataUrl);
      setPhotoFile(null);
      setPhotoPreview(dataUrl);
    } catch (err) {
      const msg = getErrorMsg(err);
      if (!/cancel/i.test(msg)) toast.error('No se pudo abrir la cámara. Revisa los permisos.', 'Foto');
    }
  };

  const cambiarFotoCarro = async (carro: Carro, file: File) => {
    setSavingPhotoId(carro.id_vehiculo);
    try {
      const base64 = await comprimirImagen(file);
      await carrosApi.update(carro.id_vehiculo, { ruta_imagen_vehiculo: base64 });
      setCarros(prev => prev.map(m => m.id_vehiculo === carro.id_vehiculo ? { ...m, ruta_imagen_vehiculo: base64 } : m));
      toast.success('Foto actualizada', 'Mis vehículos');
    } catch {
      toast.error('No se pudo guardar la foto.', 'Foto');
    } finally {
      setSavingPhotoId(null);
    }
  };

  const handleCancelCarro = () => {
    setAddingCarro(false);
    resetCarro();
    setPhotoFile(null);
    setPhotoDataUrl(null);
    setPhotoPreview(null);
  };

  const onSaveCarro = async (data: CarroForm) => {
    if (!user?.id_usuario) return;
    setSavingCarro(true);
    try {
      let fotoBase64: string | null = photoDataUrl;
      if (!fotoBase64 && photoFile) {
        try { fotoBase64 = await comprimirImagen(photoFile); } catch { /* usa la imagen original */ }
      }
      const { data: nuevoCarro } = await carrosApi.create({
        ...data,
        id_usuario: user.id_usuario,
      });
      const creada = nuevoCarro as Carro;
      if (fotoBase64 && creada?.id_vehiculo) {
        try {
          await carrosApi.update(creada.id_vehiculo, { ruta_imagen_vehiculo: fotoBase64 });
          creada.ruta_imagen_vehiculo = fotoBase64;
        } catch {
          toast.error('El vehículo se creó, pero la foto no se guardó.', 'Foto');
        }
      }
      setCarros(prev => [...prev, creada]);
      resetCarro();
      setAddingCarro(false);
      setPhotoFile(null);
      setPhotoDataUrl(null);
      setPhotoPreview(null);
      toast.success('¡Vehículo registrado correctamente!', 'Mis vehículos');
    } catch (err) {
      toast.error(getErrorMsg(err), 'Error al guardar');
    } finally {
      setSavingCarro(false);
      setUploadMsg(null);
    }
  };

  const onSavePerfil = async (data: PerfilForm) => {
    if (!user?.id_usuario) return;
    setSavingPerfil(true);
    try {
      const payload: Record<string, string> = {
        nombre_completo: data.nombre_completo.trim(),
        cedula:    data.cedula.trim(),
        telefono:  data.telefono.trim(),
        descripcion: `CEDULA: ${data.cedula.trim()} | TELEFONO: ${data.telefono.trim()}`,
      };
      if (data.direccion && data.direccion.trim()) {
        payload.direccion = data.direccion.trim();
      }
      await usuariosApi.update(user.id_usuario, payload);
      const descStr = `CEDULA: ${data.cedula.trim()} | TELEFONO: ${data.telefono.trim()}`;
      toast.success('Datos personales guardados ✓', 'Perfil');
      setEditingPerfil(false);
      setPerfilLocal({ cedula: data.cedula.trim(), telefono: data.telefono.trim(), direccion: data.direccion ?? '' });
      // Actualizar localStorage para que perfilOk sea true sin recargar
      const storedUser = JSON.parse(localStorage.getItem('gm_user') ?? '{}');
      storedUser.descripcion    = descStr;
      storedUser.nombre_completo = data.nombre_completo.trim();
      storedUser.cedula          = data.cedula.trim();
      storedUser.telefono        = data.telefono.trim();
      if (data.direccion && data.direccion.trim()) storedUser.direccion = data.direccion.trim();
      localStorage.setItem('gm_user', JSON.stringify(storedUser));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        toast.error('Sesión inválida o usuario eliminado. Por favor inicia sesión nuevamente.', 'Error de sesión');
        localStorage.removeItem('gm_token');
        localStorage.removeItem('gm_user');
        window.dispatchEvent(new Event('gm:unauthorized'));
      } else {
        toast.error(getErrorMsg(err), 'Error al actualizar');
      }
    } finally {
      setSavingPerfil(false);
    }
  };

  const card: React.CSSProperties = {
    background: isDark ? '#111117' : '#FFFFFF',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#E4E7EC'}`,
    borderRadius: 16,
    padding: '20px 22px',
  };

  const label: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(21,21,27,0.42)',
    marginBottom: 6, display: 'block',
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg,rgba(225,20,40,0.2),rgba(120,0,20,0.3))',
            border: '1px solid rgba(225,20,40,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Car size={20} color="#E11428" />
          </div>
          <div>
            <h1 style={{ color: isDark ? '#EBEBEB' : '#15151B', fontWeight: 800, fontSize: 22, margin: 0, letterSpacing: '-0.03em' }}>
              Mis vehículos
            </h1>
            <p style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(21,21,27,0.6)', fontSize: 12.5, margin: 0 }}>
              Gestiona tu vehículo y datos de perfil
            </p>
          </div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editingPerfil ? 18 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <User size={16} color={perfilOk ? '#10B981' : '#F59E0B'} />
            <span style={{ color: isDark ? '#EBEBEB' : '#15151B', fontWeight: 700, fontSize: 14 }}>Datos personales</span>
            {perfilOk
              ? <span style={{ fontSize: 10, color: '#10B981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>Completo</span>
              : <span style={{ fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>Incompleto</span>}
          </div>
          {!editingPerfil && (
            <button
              onClick={() => setEditingPerfil(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(21,21,27,0.6)',
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E4E7EC'}`,
                borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
              }}
            >
              <Pencil size={12} /> Editar
            </button>
          )}
        </div>

        {!editingPerfil && (
          <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={13} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
              <span style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                Nombre: <span style={{ color: nombreCompleto ? (isDark ? '#EBEBEB' : '#15151B') : '#F59E0B', fontWeight: 600 }}>{nombreCompleto || 'No registrado'}</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCard size={13} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
              <span style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                Cédula: <span style={{ color: cedula ? (isDark ? '#EBEBEB' : '#15151B') : '#F59E0B', fontWeight: 600 }}>{cedula ?? 'No registrada'}</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Phone size={13} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
              <span style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                Teléfono: <span style={{ color: telefono ? (isDark ? '#EBEBEB' : '#15151B') : '#F59E0B', fontWeight: 600 }}>{telefono ?? 'No registrado'}</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                Dirección: <span style={{ color: direccion ? (isDark ? '#EBEBEB' : '#15151B') : '#F59E0B', fontWeight: 600 }}>{direccion ?? 'No registrada'}</span>
              </span>
            </div>
          </div>
        )}

        {editingPerfil && (
          <form onSubmit={handlePerfil(onSavePerfil)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px' }}>
                <Input
                  label="Nombres completos *"
                  type="text"
                  placeholder="Juan Pérez"
                  prefix={<User size={14} />}
                  error={errPerfil.nombre_completo?.message}
                  {...regPerfil('nombre_completo')}
                />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <Input
                  label="Cédula / ID *"
                  type="text"
                  placeholder="1234567890"
                  prefix={<CreditCard size={14} />}
                  error={errPerfil.cedula?.message}
                  {...regPerfil('cedula')}
                />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <Input
                  label="Teléfono / WhatsApp *"
                  type="tel"
                  placeholder="0987 654 321"
                  prefix={<Phone size={14} />}
                  error={errPerfil.telefono?.message}
                  {...regPerfil('telefono')}
                />
              </div>
            </div>
            <div style={{ flex: '1 1 100%' }}>
              <Input
                label="Dirección de casa (opcional)"
                placeholder="Av. Principal y Secundaria"
                error={errPerfil.direccion?.message}
                {...regPerfil('direccion')}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditingPerfil(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E4E7EC'}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
                <X size={12} /> Cancelar
              </button>
              <button type="submit" disabled={savingPerfil}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#fff', background: '#E11428', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: savingPerfil ? 'not-allowed' : 'pointer', opacity: savingPerfil ? 0.6 : 1 }}>
                <Save size={12} /> {savingPerfil ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>

      {loadingCarros ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <svg style={{ animation: 'spin .8s linear infinite' }} width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="rgba(225,20,40,0.2)" strokeWidth="3"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="#E11428" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </div>
      ) : carros.length === 0 && !addingCarro ? (
        <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(225,20,40,0.07)',
            border: '1px solid rgba(225,20,40,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Car size={32} color="rgba(225,20,40,0.5)" />
          </div>
          <p style={{ color: isDark ? '#EBEBEB' : '#15151B', fontWeight: 700, fontSize: 17, margin: '0 0 6px' }}>
            Aún no tienes vehículos registrados
          </p>
          <p style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)', fontSize: 13, margin: '0 0 24px', lineHeight: 1.6 }}>
            Solicita al taller que registre tu vehículo para consultar su historial.
          </p>
          
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {carros.map(carro => {
            const color   = TIPO_COLOR[carro.tipo_vehiculo ?? 'Otro'] ?? '#8A8A9E';
            const estLocal = calcularEstadoLocal(carro.cilindraje, carro.kilometraje, serviciosMap[carro.id_vehiculo] ?? {});
            const hasVenc = estLocal.some(s => s.estado === 'VENCIDO');
            const hasPrx  = estLocal.some(s => s.estado === 'PROXIMO');
            return (
              <div key={carro.id_vehiculo} style={{ ...card, borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
                  <label style={{ position: 'relative', flexShrink: 0, cursor: 'pointer', display: 'block', width: 56, height: 56 }}
                         title="Cambiar foto de tu vehículo">
                    {imagenCarro(carro) ? (
                      <img src={imagenCarro(carro)!} alt={`${carro.marca} ${carro.modelo}`} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', border: `1px solid ${color}30`, display: 'block' }} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Car size={24} color={color} />
                      </div>
                    )}
                    <span style={{ position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: '50%', background: savingPhotoId === carro.id_vehiculo ? 'rgba(225,20,40,0.5)' : '#E11428', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #16161E' }}>
                      <Camera size={10} color="#fff" />
                    </span>
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                           disabled={savingPhotoId === carro.id_vehiculo}
                           onChange={e => { const f = e.target.files?.[0]; if (f) cambiarFotoCarro(carro, f); e.target.value = ''; }} />
                  </label>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: isDark ? '#EBEBEB' : '#15151B', fontWeight: 800, fontSize: 16, margin: '0 0 2px', letterSpacing: '-0.02em' }}>
                      {carro.marca} {carro.modelo}
                      {carro.nombre_vehiculo && <span style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)', fontWeight: 500, fontSize: 13 }}> — {carro.nombre_vehiculo}</span>}
                    </p>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)' }}>Placa: <b style={{ color: isDark ? '#EBEBEB' : '#15151B' }}>{carro.placa}</b></span>
                      <span style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)' }}>Año: <b style={{ color: isDark ? '#EBEBEB' : '#15151B' }}>{carro.anio}</b></span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color, padding: '3px 10px', background: `${color}15`, border: `1px solid ${color}25`, borderRadius: 99 }}>{carro.tipo_vehiculo}</span>
                    {hasVenc && <span style={{ fontSize: 10, color: '#E11428', background: 'rgba(225,20,40,0.1)', border: '1px solid rgba(225,20,40,0.2)', borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>Mantenimiento vencido</span>}
                    {!hasVenc && hasPrx && <span style={{ fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>Próximo mantenimiento</span>}
                    {!hasVenc && !hasPrx && <span style={{ fontSize: 10, color: '#10B981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}><CheckCircle size={9} style={{ verticalAlign: 'middle', marginRight: 3 }} />Todo en orden</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderRadius: 10, border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #E4E7EC', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <Gauge size={14} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(21,21,27,0.45)'} />
                    <span style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(21,21,27,0.6)', flexShrink: 0 }}>Odómetro:</span>
                    <input
                      type="number" min="0"
                      value={kmCarro[carro.id_vehiculo] ?? ''}
                      onChange={e => setKmCarro(prev => ({ ...prev, [carro.id_vehiculo]: e.target.value }))}
                      style={{ flex: 1, height: 34, borderRadius: 8, padding: '0 10px', background: isDark ? '#1A1A22' : '#FFFFFF', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E4E7EC', color: isDark ? '#EBEBEB' : '#15151B', fontSize: 13, outline: 'none', minWidth: 0 }}
                    />
                    <span style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(21,21,27,0.45)', flexShrink: 0 }}>km</span>
                  </div>
                  <button
                    onClick={() => actualizarKm(carro)}
                    disabled={savingKm === carro.id_vehiculo}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#fff', background: savingKm === carro.id_vehiculo ? 'rgba(225,20,40,0.4)' : '#E11428', border: 'none', borderRadius: 8, padding: '9px 14px', cursor: savingKm === carro.id_vehiculo ? 'not-allowed' : 'pointer', width: '100%' }}>
                    <Save size={14} /> {savingKm === carro.id_vehiculo ? 'Guardando…' : 'Actualizar Odómetro'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Activity size={13} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.35)' }}>Estado de mantenimiento</span>
                </div>
                <EstadoCarroLive carro={carro} />
              </div>
            );
          })}

          
        </div>
      )}

      {addingCarro && (
        <div style={{ ...card, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Plus size={16} color="#E11428" />
              <span style={{ color: isDark ? '#EBEBEB' : '#15151B', fontWeight: 700, fontSize: 15 }}>Registrar vehículo</span>
            </div>
            <button onClick={handleCancelCarro}
              style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E4E7EC', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)' }}>
              <X size={14} />
            </button>
          </div>

          <form onSubmit={handleCarro(onSaveCarro)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!perfilOk && (
              <button
                type="button"
                onClick={() => { setEditingPerfil(true); setAddingCarro(false); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* WebView antiguo */ } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.28)',
                  borderRadius: 12, padding: '11px 14px', cursor: 'pointer', width: '100%',
                }}
              >
                <CreditCard size={16} color="#F59E0B" style={{ flexShrink: 0 }} />
                <p style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)', fontSize: 13, lineHeight: 1.5, margin: 0, paddingRight: 30 }}>
                  Completa primero tus datos personales (cédula, nombres, teléfono y dirección). Toca aquí para llenarlos.
                </p>
              </button>
            )}

            <div>
              <label style={label}>
                Foto de tu vehículo <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
              </label>
              {(() => {
                const boxStyle = {
                  border: `1px dashed ${photoPreview ? 'rgba(225,20,40,0.35)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 12, cursor: 'pointer', overflow: 'hidden',
                  background: 'rgba(255,255,255,0.02)', transition: 'border-color 180ms',
                  minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
                } as const;
                const inner = photoPreview ? (
                  <img src={photoPreview} alt="preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 20 }}>
                    <Camera size={22} color="rgba(255,255,255,0.2)" />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
                      {esNativo() ? 'Toca para tomar o elegir una foto' : 'Toca para subir una foto'}
                    </span>
                  </div>
                );
                // APK nativo → cámara/galería de Capacitor. Web → <label> + <input file>.
                return esNativo() ? (
                  <div role="button" onClick={onPickPhotoNative} style={boxStyle}>{inner}</div>
                ) : (
                  <label htmlFor="carro-photo-input" style={boxStyle}>{inner}</label>
                );
              })()}
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoDataUrl(null); setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <X size={10} /> Quitar foto
                </button>
              )}
              <input ref={fileInputRef} id="carro-photo-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={onSelectPhoto} />
            </div>

            {/* Fila 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              <Input label="Marca" type="text" placeholder="Ej. Toyota, Chevrolet…" error={errCarro.marca?.message} {...regCarro('marca')} />
              <Input label="Modelo" type="text" placeholder="Ej. Corolla, Onix…" error={errCarro.modelo?.message} {...regCarro('modelo')} />
            </div>
            {/* Fila 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12 }}>
              <Input label="Placa" type="text" placeholder="ABC-1234" error={errCarro.placa?.message} {...regCarro('placa')} />
              <Input label="Año" type="number" placeholder={String(new Date().getFullYear())} error={errCarro.anio?.message} {...regCarro('anio')} />
              <Input label="Nombre (apodo)" type="text" placeholder="Opcional" error={errCarro.nombre_vehiculo?.message} {...regCarro('nombre_vehiculo')} />
            </div>
            {/* Fila 3 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12 }}>
              <Input label="Kilometraje" type="number" placeholder="0" error={errCarro.kilometraje?.message} {...regCarro('kilometraje')} />
              {/* Tipo de carro */}
              <div>
                <label style={label}>Tipo de vehículo</label>
                <select
                  {...regCarro('tipo_vehiculo')}
                  style={{
                    width: '100%', height: 42, borderRadius: 10, padding: '0 12px',
                    background: isDark ? '#1A1A22' : '#FFFFFF', border: `1px solid ${errCarro.tipo_vehiculo ? '#E11428' : (isDark ? 'rgba(255,255,255,0.1)' : '#E4E7EC')}`,
                    color: isDark ? '#EBEBEB' : '#15151B', fontSize: 13, outline: 'none',
                  }}
                >
                  <option value="">Selecciona…</option>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errCarro.tipo_vehiculo && <p style={{ color: '#E11428', fontSize: 11, marginTop: 4 }}>{errCarro.tipo_vehiculo.message}</p>}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={handleCancelCarro}
                style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '9px 18px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" disabled={savingCarro}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#fff', background: savingCarro ? 'rgba(225,20,40,0.4)' : '#E11428', border: 'none', borderRadius: 10, padding: '9px 22px', cursor: savingCarro ? 'not-allowed' : 'pointer' }}>
                <Save size={14} /> {savingCarro ? (uploadMsg ?? 'Guardando…') : 'Guardar vehículo'}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
