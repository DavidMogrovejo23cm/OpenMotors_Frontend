/* ─────────────────────────────────────────────────────────────
   GMotors — Register Page v5
   Minimalista: negro · blanco · rojo — sin mezcla de colores
   Emil Kowalski: spring hover, stagger, custom checkbox
   ───────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Lock, Phone, ArrowRight, Shield, Check } from 'lucide-react';
import { authApi, healthApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { getErrorMsg } from '../../lib/utils';
import Input from '../../components/ui/Input';

const schema = z.object({
  nombre_completo: z.string().min(3, 'Mínimo 3 caracteres'),
  correo:          z.string().email('Correo no válido'),
  telefono:        z.string().min(7, 'Ingresa un teléfono válido'),
  contrasena:      z.string().min(6, 'Mínimo 6 caracteres'),
  confirmar:       z.string().min(1, 'Confirma tu contraseña'),
  terms:           z.boolean().refine(v => v === true, { message: 'Debes aceptar los términos' }),
}).refine(d => d.contrasena === d.confirmar, {
  message: 'Las contraseñas no coinciden', path: ['confirmar'],
});
type Form = z.infer<typeof schema>;

/* ─── Logo ─── */
function Logo({ size = 42 }: { size?: number }) {
  const [ok, setOk] = useState(true);
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: 'linear-gradient(135deg,#E11428,#8B0010)',
      boxShadow: '0 0 0 1px rgba(225,20,40,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', flexShrink: 0,
    }}>
      {ok
        ? <img src="/brand/open-motor-logo.png" alt="" onError={() => setOk(false)} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
        : <span style={{ fontSize: size * 0.5, lineHeight:1 }}>🦍</span>}
    </div>
  );
}

/* ─── Google icon SVG ─── */
function PasswordStrength({ value }: { value: string }) {
  const s = !value ? 0 : value.length < 6 ? 1 : value.length < 8 ? 2 : /[A-Z]/.test(value) && /[0-9]/.test(value) ? 4 : 3;
  const colors = ['', '#E11428', '#E8850A', '#F0B429', '#22C55E'];
  const labels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
  if (!value) return null;
  return (
    <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', gap: 3, flex: 1 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 99,
            background: i <= s ? colors[s] : 'rgba(24,27,35,0.07)',
            transition: 'background 250ms',
          }}/>
        ))}
      </div>
      <span style={{ fontSize: 10, color: colors[s], fontWeight: 700, minWidth: 44 }}>{labels[s]}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════ */
export default function RegisterPage() {
  const navigate = useNavigate();
  const toast    = useToast();
  const { login, user, token } = useAuth();
  const [loading,       setLoading]       = useState(false);
  const [entered,       setEntered]       = useState(false);
  const [termsChecked,  setTermsChecked]  = useState(false);
  const [passValue,     setPassValue]     = useState('');

  /* Navegación reactiva — igual que en LoginPage */
  useEffect(() => {
    if (user && token) navigate('/dashboard', { replace: true });
  }, [user, token, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, []);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { terms: false },
  });

  const watchedPass = watch('contrasena', '');
  useEffect(() => { setPassValue(watchedPass); }, [watchedPass]);

  const [slowConn, setSlowConn] = useState(false);

  const onSubmit = async (data: Form) => {
    setLoading(true);
    setSlowConn(false);
    const slowTimer = setTimeout(() => setSlowConn(true), 5_000);

    const doRegister = () => authApi.register({
      nombre_completo: data.nombre_completo,
      nombre_usuario:  data.correo.split('@')[0],
      correo:          data.correo,
      contrasena:      data.contrasena,
      pais:            'Ecuador',
      ciudad:          'Ecuador',
      descripcion:     `CEDULA: N/A | TELEFONO: ${data.telefono}`,
      ruta_imagen:     null,
    });

    try {
      // Intento de registro — si hay error de red, wake-up + retry automático
      try {
        await doRegister();
      } catch (registerErr) {
        const hasResponse = !!(registerErr as { response?: unknown })?.response;
        if (!hasResponse) {
          // Backend dormido → despertar y reintentar
          setSlowConn(true);
          healthApi.check().catch(() => {});
          await new Promise(r => setTimeout(r, 32_000));
          await doRegister(); // segundo intento (lanza si falla de nuevo)
        } else {
          throw registerErr; // error real del backend (409 duplicado, etc.)
        }
      }

      /* ── Auto-login inmediato tras registrar ──────────────────────────────
         Evita que el usuario tenga que volver a escribir sus credenciales.
         Si falla (caso muy raro), redirigir al login con un mensaje de éxito.
         ──────────────────────────────────────────────────────────────────── */
      try {
        await login(data.correo, data.contrasena);
        // useEffect([user, token]) navega a /dashboard automáticamente
      } catch {
        toast.success('¡Cuenta creada! Ahora inicia sesión.', '¡Listo!');
        navigate('/login');
      }
    } catch (err) {
      toast.error(getErrorMsg(err), 'Error al registrar');
    } finally {
      clearTimeout(slowTimer);
      setSlowConn(false);
      setLoading(false);
    }
  };

  /**
   * Google Sign-In — popup (COOP: same-origin-allow-popups en vercel.json).
   * Si el popup tiene éxito → processGoogleUser() inmediatamente.
   * Si el popup está bloqueado → signInWithRedirect (fallback móvil).
   */
  const enter = (delay: number): React.CSSProperties => ({
    opacity:   entered ? 1 : 0,
    transform: entered ? 'none' : 'translateY(14px)',
    transition: `opacity 0.45s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms,
                 transform 0.45s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
  });

  const isBusy = loading;

  return (
    <div style={{
      minHeight: '100vh', overflowX: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '32px 16px 48px',
      fontFamily: "'Inter', system-ui, sans-serif",
      background: '#FFFFFF',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* ─── Header ─── */}
        <div style={{ marginBottom: 24, ...enter(0) }}>
          {/* Marca centrada, impactante */}
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:22 }}>
            <Logo size={56}/>
            <div>
              <p style={{ fontFamily:"'Dancing Script', cursive", fontWeight:700, fontSize:28, margin:0, lineHeight:1, color:'#EBEBEB' }}>
                Open Motors
              </p>
              <p style={{ color:'rgba(24,27,35,0.28)', fontSize:11, margin:'4px 0 0', fontWeight:500, letterSpacing:'0.1em', textTransform:'uppercase' }}>
                Gestión de talleres · Ecuador
              </p>
            </div>
          </div>
          <h1 style={{
            fontFamily: 'inherit',
            fontSize: 'clamp(36px,5.5vw,54px)',
            lineHeight: 0.9, letterSpacing: '0.01em',
            margin: '0 0 10px', color: '#181B23',
          }}>
            Crea tu <span style={{ color: '#E11428' }}>cuenta.</span>
          </h1>
          <p style={{ color: 'rgba(24,27,35,0.35)', fontSize: 13.5, margin: 0, lineHeight: 1.65 }}>
            Únete al sistema de gestión para talleres automotrices en Ecuador.
          </p>
        </div>

        {/* ─── Card formulario ─── */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid rgba(24,27,35,0.07)',
          borderRadius: 16,
          padding: '24px 22px 20px',
          ...enter(60),
        }}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display:'flex', flexDirection:'column', gap:12 }}>

            <div style={enter(80)}>
              <Input label="Nombre completo" type="text" placeholder="Ej. Carlos Andrade"
                prefix={<User size={14}/>} error={errors.nombre_completo?.message}
                autoComplete="name" {...register('nombre_completo')}/>
            </div>

            <div style={enter(105)}>
              <Input label="Correo electrónico" type="email" placeholder="tu@correo.com"
                prefix={<Mail size={14}/>} error={errors.correo?.message}
                autoComplete="email" {...register('correo')}/>
            </div>

            <div style={enter(130)}>
              <Input label="Teléfono / WhatsApp" type="tel" placeholder="0987 654 321"
                prefix={<Phone size={14}/>} error={errors.telefono?.message}
                autoComplete="tel" {...register('telefono')}/>
            </div>

            <div style={enter(155)}>
              <Input label="Contraseña" type="password" placeholder="Mínimo 6 caracteres"
                prefix={<Lock size={14}/>} error={errors.contrasena?.message}
                autoComplete="new-password" {...register('contrasena')}/>
              <PasswordStrength value={passValue}/>
            </div>

            <div style={enter(180)}>
              <Input label="Confirmar contraseña" type="password" placeholder="Repite tu contraseña"
                prefix={<Lock size={14}/>} error={errors.confirmar?.message}
                autoComplete="new-password" {...register('confirmar')}/>
            </div>

            {/* Checkbox custom */}
            <div style={{ marginTop: 4, ...enter(205) }}>
              <label
                style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer' }}
                onClick={() => { const n = !termsChecked; setTermsChecked(n); setValue('terms', n, { shouldValidate: true }); }}
              >
                <div style={{
                  width:18, height:18, borderRadius:5, flexShrink:0, marginTop:1,
                  background: termsChecked ? '#E11428' : 'transparent',
                  border: `1.5px solid ${termsChecked ? '#E11428' : 'rgba(24,27,35,0.14)'}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all 180ms cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                  {termsChecked && <Check size={11} style={{ color:'#fff', strokeWidth:3 }}/>}
                </div>
                <span style={{ fontSize:12, color:'rgba(24,27,35,0.45)', lineHeight:1.65 }}>
                  He leído y acepto la{' '}
                  <Link to="/privacidad" target="_blank" rel="noopener" style={{ color:'#EBEBEB', fontWeight:700, textDecoration:'none' }} onClick={e => e.stopPropagation()}>
                    Política de Privacidad
                  </Link>
                  {' '}y los{' '}
                  <Link to="/terminos" target="_blank" rel="noopener" style={{ color:'#EBEBEB', fontWeight:700, textDecoration:'none' }} onClick={e => e.stopPropagation()}>
                    Términos de Uso
                  </Link>.
                </span>
              </label>
              <input type="checkbox" style={{ display:'none' }} {...register('terms')}/>
              {errors.terms && <p style={{ color:'#E11428', fontSize:11.5, marginTop:5, paddingLeft:28 }}>{errors.terms.message}</p>}
            </div>

            {/* Botón submit */}
            <div style={{ marginTop: 8, ...enter(230) }}>
              <button
                type="submit"
                disabled={isBusy}
                style={{
                  width:'100%', height:50, borderRadius:10,
                  background: isBusy ? 'rgba(225,20,40,0.4)' : '#E11428',
                  color:'#fff', fontWeight:700, fontSize:15, letterSpacing:'-0.01em',
                  border:'none', cursor:isBusy?'not-allowed':'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  boxShadow: isBusy ? 'none' : '0 0 0 1px rgba(225,20,40,0.3)',
                  transition:'all 160ms cubic-bezier(0.34,1.56,0.64,1)',
                }}
                onMouseEnter={e => {
                  if (!isBusy) {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = '#FF1F37';
                    el.style.transform  = 'translateY(-1px)';
                    el.style.boxShadow  = '0 4px 20px rgba(225,20,40,0.5)';
                  }
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = isBusy ? 'rgba(225,20,40,0.4)' : '#E11428';
                  el.style.transform  = '';
                  el.style.boxShadow  = isBusy ? 'none' : '0 0 0 1px rgba(225,20,40,0.3)';
                }}
                onMouseDown={e => { if (!isBusy) (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
                onMouseUp={e =>   { if (!isBusy) (e.currentTarget as HTMLElement).style.transform = ''; }}
              >
                {loading ? (
                  <>
                    <svg style={{ animation:'spin 0.8s linear infinite', flexShrink:0 }} width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="rgba(24,27,35,0.2)" strokeWidth="3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    {slowConn ? 'Despertando servidor…' : 'Creando cuenta…'}
                  </>
                ) : (
                  <>Crear cuenta <ArrowRight size={15}/></>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* Link login */}
        <p style={{ textAlign:'center', marginTop:18, fontSize:13, color:'rgba(24,27,35,0.28)', ...enter(320) }}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={{ color:'#EBEBEB', fontWeight:700, textDecoration:'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#EBEBEB'; }}>
            Iniciar sesión
          </Link>
        </p>

        <div style={{ textAlign:'center', marginTop:14, ...enter(340) }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
            <Shield size={9} color="rgba(24,27,35,0.12)"/>
            <span style={{ fontSize:10, color:'rgba(24,27,35,0.15)' }}>SSL · LOPDP Ecuador · © 2025 Open Motors</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
