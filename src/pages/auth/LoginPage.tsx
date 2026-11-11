import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { getErrorMsg } from '../../lib/utils';
import Input from '../../components/ui/Input';
import { healthApi } from '../../lib/api';




const schema = z.object({
  correo:     z.string().email('Correo no válido'),
  contrasena: z.string().min(1, 'Ingresa tu contraseña'),
});
type Form = z.infer<typeof schema>;

/* ─── Ring spinner ─── */
const Ring = ({ color = '#E11428', size = 18 }: { color?: string; size?: number }) => (
  <svg style={{ animation: 'gm-spin .8s linear infinite', flexShrink: 0 }}
    width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={color === '#E11428' ? 'rgba(225,20,40,0.2)' : 'rgba(0,0,0,0.12)'} strokeWidth="3"/>
    <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════ */
export default function LoginPage() {
  const { login, loading, user, token } = useAuth();
  const navigate     = useNavigate();
  const toast        = useToast();
  const [params]     = useSearchParams();
  const [loginLoading, setLoginLoading] = useState(false);

  /* Navegación reactiva — se dispara cuando hay sesión válida en el contexto */
  useEffect(() => {
    if (user && token) navigate('/dashboard', { replace: true });
  }, [user, token, navigate]);

  /* Verificación email */
  useEffect(() => {
    if (params.get('verified') === '1')
      toast.success('¡Correo verificado! Ahora puedes iniciar sesión.', 'Email confirmado');
  }, []);

  /* Wake-up ping — despierta el backend Render al cargar la página de login.
     El backend duerme tras 15 min de inactividad (plan gratuito).
     Un 401 de respuesta es OK — el servidor ya está activo. */
  useEffect(() => {
    healthApi.check().catch(() => {});
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const [slowConn, setSlowConn] = useState(false);

  const onSubmit = useCallback(async ({ correo, contrasena }: Form) => {
    setLoginLoading(true);
    setSlowConn(false);
    const slowTimer = setTimeout(() => setSlowConn(true), 5_000);

    const tryLogin = async () => login(correo, contrasena);

    try {
      await tryLogin();
    } catch (err) {
      if (!import.meta.env.DEV && isAxiosError(err) && !err.response) {
        // Sin respuesta HTTP → backend dormido (Render free tier).
        // Mandamos otro ping de wake-up y esperamos a que arranque.
        setSlowConn(true);
        healthApi.check().catch(() => {});
        await new Promise(r => setTimeout(r, 32_000)); // ~30s arranque Render
        try {
          await tryLogin(); // segundo intento automático
        } catch (retryErr) {
          toast.error(getErrorMsg(retryErr), 'Error de acceso');
        }
      } else {
        toast.error(isAxiosError(err) ? getErrorMsg(err) : (err as Error).message, 'Error de acceso');
      }
    } finally {
      clearTimeout(slowTimer);
      setSlowConn(false);
      setLoginLoading(false);
    }
  }, [login, toast]);

  const isLoading = loading || loginLoading;

  return (
    <main className="login-layout">
      <div className="login-showcase">
        <iframe
          className="login-car-viewer"
          title="Auto de Fórmula 1 en 3D"
          allow="autoplay; fullscreen"
          src="https://sketchfab.com/models/2cf03d35a845401c8024ad6111ed36e4/embed?ui_theme=light&autostart=1&autospin=0.25&ui_controls=0&ui_infos=0&ui_hint=0&ui_stop=0&ui_inspector=0&ui_watermark=0&ui_watermark_link=0&ui_ar=0&ui_help=0&ui_settings=0&ui_vr=0&ui_fullscreen=0&ui_annotations=0&transparent=1&preload=1&camera=0"
        />
      </div>
      <section className="login-content">
        <div className="login-form">
          <Link to="/login" className="login-brand" aria-label="Open Motors">
            <img src="/brand/open-motor-logo.png" width="64" height="64" alt="Open Motors" />
          </Link>
          <h1>Iniciar sesión</h1>
          <p>Ingresa a tu cuenta de Open Motors.</p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Input label="Correo electrónico" type="email" autoComplete="username"
              placeholder="tu@correo.com" prefix={<Mail size={16} />}
              error={errors.correo?.message} {...register('correo')} />
            <Input label="Contraseña" type="password" autoComplete="current-password"
              placeholder="Tu contraseña" prefix={<Lock size={16} />}
              error={errors.contrasena?.message} {...register('contrasena')} />
            <Link className="login-recover" to="/recuperar">¿Olvidaste tu contraseña?</Link>
            <button className="login-submit" disabled={isLoading}>
              {isLoading ? <Ring color="#fff" /> : <ArrowRight size={17} />}
              {isLoading ? (slowConn ? 'Conectando con el servidor…' : 'Ingresando…') : 'Ingresar'}
            </button>
          </form>
          <p className="login-register">¿Todavía no tienes cuenta? <Link to="/registro">Crear cuenta</Link></p>
        </div>
      </section>
    </main>
  );
}

