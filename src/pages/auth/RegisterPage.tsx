import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { User, Mail, Lock, Phone, MapPin, Shield, ArrowRight } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { getErrorMsg } from '../../lib/utils';
import Input from '../../components/ui/Input';
import { authApi } from '../../lib/api';

const schema = z
  .object({
    nombre_completo: z
      .string()
      .trim()
      .min(3, 'El nombre completo debe tener al menos 3 caracteres'),
    cedula: z
      .string()
      .trim()
      .regex(/^\d{10}$/, 'La cédula ecuatoriana debe tener exactamente 10 dígitos numéricos'),
    correo: z
      .string()
      .trim()
      .email('Ingresa un correo electrónico válido'),
    telefono: z
      .string()
      .trim()
      .min(7, 'El teléfono debe tener entre 7 y 15 dígitos')
      .max(15, 'El teléfono no puede superar los 15 dígitos'),
    direccion: z
      .string()
      .trim()
      .min(3, 'Ingresa una dirección domiciliaria válida'),
    nombre_usuario: z
      .string()
      .trim()
      .min(3, 'El usuario debe tener al menos 3 caracteres')
      .max(30, 'El usuario no puede superar 30 caracteres')
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Solo letras, números, puntos o guiones'),
    contrasena: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmar_contrasena: z
      .string()
      .min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.contrasena === data.confirmar_contrasena, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmar_contrasena'],
  });

type FormValues = z.infer<typeof schema>;

/* Ring spinner para botón de carga */
const Ring = ({ color = '#E11428', size = 18 }: { color?: string; size?: number }) => (
  <svg
    style={{ animation: 'gm-spin .8s linear infinite', flexShrink: 0 }}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke={color === '#E11428' ? 'rgba(225,20,40,0.2)' : 'rgba(0,0,0,0.12)'}
      strokeWidth="3"
    />
    <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export default function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setSubmitting(true);
      try {
        await authApi.register({
          nombre_completo: values.nombre_completo,
          nombre_usuario: values.nombre_usuario,
          correo: values.correo,
          contrasena: values.contrasena,
          cedula: values.cedula,
          telefono: values.telefono,
          direccion: values.direccion,
          ciudad: 'Quito',
        });

        toast.success(
          '¡Cuenta creada exitosamente! Ahora puedes iniciar sesión con tus credenciales.',
          'Registro exitoso'
        );
        navigate('/login', { replace: true });
      } catch (err) {
        toast.error(
          isAxiosError(err) ? getErrorMsg(err) : (err as Error).message,
          'Error en el registro'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [navigate, toast]
  );

  return (
    <main className="login-layout">
      <header className="login-header">
        <Link to="/login" className="login-brand">
          <img src="/brand/open-motor-logo.png" width="32" height="32" alt="" />
          OpenMotors
        </Link>
        <Link to="/login" className="login-outline">
          Iniciar sesión
        </Link>
      </header>

      <section className="login-content" aria-labelledby="register-title">
        <div className="login-form" style={{ width: 'min(100%, 480px)' }}>
          <h1 id="register-title">
            Crear
            <br />
            cuenta
          </h1>
          <p>Regístrate en OpenMotors para acceder a tu historial vehicular y servicios.</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Nombre completo *"
                type="text"
                autoComplete="name"
                placeholder="Ej. Juan Pérez"
                prefix={<User size={16} />}
                error={errors.nombre_completo?.message}
                {...register('nombre_completo')}
              />
              <Input
                label="Cédula *"
                type="text"
                autoComplete="off"
                placeholder="10 dígitos"
                prefix={<Shield size={16} />}
                error={errors.cedula?.message}
                {...register('cedula')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Correo electrónico *"
                type="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                prefix={<Mail size={16} />}
                error={errors.correo?.message}
                {...register('correo')}
              />
              <Input
                label="Teléfono *"
                type="tel"
                autoComplete="tel"
                placeholder="0987654321"
                prefix={<Phone size={16} />}
                error={errors.telefono?.message}
                {...register('telefono')}
              />
            </div>

            <div>
              <Input
                label="Dirección de casa *"
                type="text"
                autoComplete="street-address"
                placeholder="Av. Principal y Secundaria"
                prefix={<MapPin size={16} />}
                error={errors.direccion?.message}
                {...register('direccion')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Usuario (login) *"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                placeholder="juanp"
                prefix={<User size={16} />}
                error={errors.nombre_usuario?.message}
                {...register('nombre_usuario')}
              />
              <Input
                label="Contraseña *"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                prefix={<Lock size={16} />}
                error={errors.contrasena?.message}
                {...register('contrasena')}
              />
            </div>

            <div>
              <Input
                label="Confirmar contraseña *"
                type="password"
                autoComplete="new-password"
                placeholder="Repite tu contraseña"
                prefix={<Lock size={16} />}
                error={errors.confirmar_contrasena?.message}
                {...register('confirmar_contrasena')}
              />
            </div>

            <button className="login-submit" type="submit" disabled={submitting}>
              {submitting ? 'Creando cuenta…' : 'Registrarme'}
              {submitting ? <Ring color="#fff" /> : <ArrowRight size={20} aria-hidden="true" />}
            </button>

            <p className="text-xs text-center dark:text-white/50 text-slate-500 pt-2">
              ¿Ya tienes una cuenta?{' '}
              <Link to="/login" className="font-semibold text-gm-red hover:underline">
                Inicia sesión aquí
              </Link>
            </p>
          </form>
        </div>
      </section>

      <div className="login-gallery" role="region" aria-label="Visor interactivo del auto en 3D">
        <div className="login-viewport">
          <iframe
            title="Vehículo de carreras en 3D"
            src="https://sketchfab.com/models/be09fdee3b7b4c598189ec00402c0b23/embed?ui_theme=dark&autostart=1&autospin=0.25&ui_controls=0&ui_infos=0&ui_stop=0&ui_inspector=0&ui_watermark=0&ui_ar=0&ui_help=0&ui_settings=0&ui_vr=0&ui_fullscreen=0&ui_annotations=0&transparent=1&preload=1&camera=0&ui_hint=0&ui_general_controls=0"
            allow="autoplay"
          />
        </div>
      </div>
    </main>
  );
}
