import { canAccessModulo } from '../../lib/utils';
/* ─────────────────────────────────────────────
   OPENMOTORS — App Layout Premium
   Logo · Nav · Hamburger mobile · Dropdown
   ───────────────────────────────────────────── */

import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
// AnimatePresence kept for mobile drawer only — main content uses plain motion.div to avoid scroll freeze
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, ChevronDown, Menu, X, KeyRound, Download } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { initials, getErrorMsg, cn } from '../../lib/utils';
import { NotificationBell, NotificationPanel } from '../ui/NotificationCenter';
import { useNotifications } from '../../hooks/useNotifications';
import { healthApi, usuariosApi, authApi } from '../../lib/api';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ErrorBoundary from '../ui/ErrorBoundary';
import { isNativeApp } from '../../lib/platform';
import MobileTabBar from '../mobile/MobileTabBar';
import MobileMore from '../mobile/MobileMore';
import { useTheme } from '../../lib/theme';
import Sidebar from './Sidebar';
import { whatsappCitaLink } from '../../lib/constants';

export default function AppLayout() {
  const { user, isAdmin, isMecanico, isCliente, logout } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();
  const lastNonClientRoute = useRef("/dashboard");
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (location.pathname !== "/clientes") {
      lastNonClientRoute.current = location.pathname + location.search + location.hash;
    }
  }, [location.pathname, location.search, location.hash]);

  /* Resetear scroll del contenido al cambiar de módulo/ruta */
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);
  const toast      = useToast();
  const { unread } = useNotifications();
  const [theme] = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /* Cambiar/crear contraseña */
  const [pwOpen,    setPwOpen]    = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pw1,       setPw1]       = useState('');
  const [pw2,       setPw2]       = useState('');
  const [pwSaving,  setPwSaving]  = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState<{
    prompt: () => Promise<void>;
    userChoice: Promise<unknown>;
  } | null>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> });
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const resetPw = () => { setPwCurrent(''); setPw1(''); setPw2(''); };

  const guardarPassword = async () => {
    if (pw1.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    if (pw1 !== pw2)    { toast.error('Las contraseñas no coinciden'); return; }
    if (!user?.id_usuario || !user.correo) { toast.error('Sesión no válida'); return; }
    setPwSaving(true);
    try {
      if (pwCurrent.trim()) {
        try { await authApi.login(user.correo, pwCurrent.trim()); }
        catch { toast.error('La contraseña actual es incorrecta'); setPwSaving(false); return; }
      }
      await usuariosApi.update(user.id_usuario, { contrasena: pw1 });
      toast.success('Contraseña actualizada · ya puedes entrar con tu correo y nueva contraseña', 'Listo');
      setPwOpen(false); resetPw(); setOpen(false);
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setPwSaving(false); }
  };
  const [notifOpen, setNotifOpen]       = useState(false);
  const notifRef                        = useRef<HTMLDivElement>(null);
  const [open, setOpen]                 = useState(false);
  const menuRef                         = useRef<HTMLDivElement>(null);
  // El consentimiento legal se captura en el registro (checkbox obligatorio).
  // No se vuelve a pedir en cada login. Los enlaces a /privacidad y /terminos
  // están en el pie de Login y Registro.
  const [mobileMenuOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen]         = useState(false);
  const moreRef                         = useRef<HTMLDivElement>(null);

  const roleLabel = isAdmin ? 'Administrador' : isMecanico ? 'Mecánico' : isCliente ? 'Cliente' : 'Sin rol';
  const roleColor = isAdmin ? '#E11428' : isMecanico ? '#3B82F6' : isCliente ? '#10B981' : '#8B8FA8';
  const isDark    = theme === 'dark';

  /* Permisos de módulos (mecánicos): null = sin restricción, array = lista permitida */
  const puede = (mod: string) => canAccessModulo(user?.permisos, mod, isAdmin, isMecanico);

  /* Vista de cliente: cualquiera que NO sea admin ni mecánico (incluye usuarios
     SIN rol asignado). Garantiza que nunca vean módulos internos del taller. */
  const verCliente = !isAdmin && !isMecanico;

  /* Navegación principal — limpia. Diagnóstico y Metodología viven DENTRO de Carros.
     Combustible y Alertas van en el menú "Más" para no saturar la barra. */
  const NAV = [
    { label: 'Dashboard',    to: '/dashboard'    },
    ...(puede('registros')   && (isAdmin || isMecanico) ? [{ label: 'Registros',   to: '/registros'   }] : []),
    ...(puede('carros')       && (isAdmin || isMecanico) ? [{ label: 'Vehículos',       to: '/carros'       }] : []),
    ...(puede('inventario')  && (isAdmin || isMecanico) ? [{ label: 'Inventario',  to: '/inventario'  }] : []),
    ...(puede('proveedores') && (isAdmin || isMecanico) ? [{ label: 'Proveedores', to: '/proveedores' }] : []),
    ...(puede('clientes')    && (isAdmin || isMecanico) ? [{ label: 'Clientes',    to: '/clientes'    }] : []),
    ...(isAdmin                                         ? [{ label: 'Pagos',       to: '/pagos'       }] : []),
    ...(verCliente                                      ? [{ label: 'Mis vehículos',     to: '/mi-carro'     }] : []),
    ...(verCliente                                      ? [{ label: 'Mi Portal',   to: '/portal'      }] : []),
  ];

  /* Menú "Más" — secundarios, no saturan la barra principal */
  const NAV_MORE = [
    ...(isAdmin || isMecanico ? [{ label: 'Herramientas', to: '/herramientas' }] : []),
    ...(isAdmin || isMecanico ? [{ label: 'Personal',     to: '/personal'     }] : []),
    ...(isAdmin                                         ? [{ label: 'Contabilidad', to: '/contabilidad'  }] : []),
    ...(isAdmin                                         ? [{ label: 'Perfiles',     to: '/perfiles'      }] : []),
  ];

  const handleLogout = () => { setMobileOpen(false); logout(); navigate('/login'); };

  /* Cerrar dropdown de avatar al hacer clic fuera */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* Cerrar menú móvil y "Más" al cambiar de ruta */
  useEffect(() => { setMobileOpen(false); setMoreOpen(false); }, [location.pathname]);

  /* Cerrar dropdown "Más" al hacer clic fuera */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* Bloquear scroll del body cuando el drawer está abierto */
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  /**
   * Keep-alive: evitar que el backend de Render (free tier) se duerma.
   * Hace un ping inmediato al montar (despierta el servidor si estaba dormido)
   * y luego cada 4 minutos (Render duerme tras 15 min de inactividad).
   */
  useEffect(() => {
    const ping = () => healthApi.check().catch(() => {}); // silencioso
    ping(); // ping inmediato al abrir la app
    const id = setInterval(ping, 4 * 60 * 1000); // cada 4 minutos
    return () => clearInterval(id);
  }, []);

  return (
    <div className="gm-app-bg flex flex-col h-screen h-[100dvh] overflow-hidden">

      {/* ══ MENÚ "MÁS" PREMIUM — solo APK ══ */}
      {isNativeApp && (
        <MobileMore
          open={mobileMenuOpen}
          onClose={() => setMobileOpen(false)}
          items={[...NAV, ...NAV_MORE]}
          nombre={user?.nombre_completo ?? 'Usuario'}
          roleLabel={roleLabel}
          roleColor={roleColor}
          onChangePassword={() => { setPwOpen(true); setMobileOpen(false); }}
          onLogout={handleLogout}
        />
      )}

      {/* ══ MOBILE DRAWER (web) ════════════════════════════════════════════ */}
      <AnimatePresence>
        {!isNativeApp && mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-[60] md:hidden"
              style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="fixed inset-y-0 left-0 w-72 z-[70] md:hidden flex flex-col"
              style={{
                background: isDark ? 'linear-gradient(180deg,#15151C 0%,#111115 100%)' : '#FFFFFF',
                borderRight: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E4E7EC',
                boxShadow: isDark ? '10px 0 50px rgba(0,0,0,0.65)' : '10px 0 50px rgba(0,0,0,0.12)',
              }}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0"
                   style={{ borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E4E7EC' }}>
                <Link to="/dashboard" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                  <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 bg-white p-0.5"
                       style={{ boxShadow: '0 0 0 1.5px rgba(225,20,40,0.4)' }}>
                    <img src="/brand/open-motor-logo.png" alt="OpenMotors" className="w-full h-full object-contain" />
                  </div>
                  <span className="font-black leading-none text-xl"
                        style={{ color: isDark ? '#fff' : '#16161A' }}>
                    Open <span style={{ color: '#E11428' }}>Motors</span>
                  </span>
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E4E7EC' }}
                  aria-label="Cerrar menú"
                >
                  <X size={15} style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(21,21,27,0.6)' }} />
                </button>
              </div>

              {/* User info strip */}
              <div className="px-3 pt-3 shrink-0">
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                     style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #E4E7EC' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-black shrink-0"
                       style={{ background: `${roleColor}22`, color: roleColor, border: `1.5px solid ${roleColor}35` }}>
                    {initials(user?.nombre_completo ?? 'U')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black truncate leading-tight" style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(21,21,27,0.9)' }}>{user?.nombre_completo}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] mt-0.5" style={{ color: roleColor }}>{roleLabel}</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                        style={{ boxShadow: '0 0 6px rgba(52,211,153,0.9)' }} />
                </div>
              </div>

              {/* Nav links */}
              <nav className="flex-1 px-3 py-3 overflow-y-auto dark-scroll">
                <p className="px-3 mb-2 text-[9px] font-black tracking-[0.3em] uppercase" style={{ color: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(21,21,27,0.3)' }}>Navegación</p>
                <div className="space-y-0.5">
                  {[...NAV, ...NAV_MORE].map(({ label, to }) => {
                    const active = location.pathname === to || location.pathname.startsWith(to + '/');
                    return (
                      <Link
                        key={to}
                        to={to}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all relative"
                        style={active ? {
                          background: 'rgba(225,20,40,0.12)',
                          color: isDark ? '#fff' : '#E11428',
                          border: '1px solid rgba(225,20,40,0.22)',
                        } : {
                          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(21,21,27,0.6)',
                          border: '1px solid transparent',
                        }}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                                style={{ background: '#E11428', boxShadow: '0 0 8px rgba(225,20,40,0.8)' }} />
                        )}
                        {label}
                        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                                         style={{ background: '#E11428' }} />}
                      </Link>
                    );
                  })}
                </div>
              </nav>

              {/* Logout */}
              <div className="px-3 pb-5 border-t pt-3 shrink-0" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#E4E7EC' }}>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                  style={{ color: 'rgba(248,113,113,0.8)', border: '1px solid transparent' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)';
                    (e.currentTarget as HTMLElement).style.color = 'rgb(248,113,113)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.15)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = '';
                    (e.currentTarget as HTMLElement).style.color = 'rgba(248,113,113,0.8)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                  }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20 shrink-0">
                    <LogOut size={14} className="text-red-400" />
                  </div>
                  Cerrar sesión
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ══ TOPBAR ══════════════════════════════════════════════════ */}
      <header
        className="gm-topbar sticky top-0 z-50 flex-none bg-white/95 dark:bg-[#0c0f17]/95 border-b border-slate-200/80 dark:border-slate-800/80"
        style={{ 
          backdropFilter: 'blur(16px)', 
          WebkitBackdropFilter: 'blur(16px)',
          paddingTop: isNativeApp ? 'env(safe-area-inset-top, 34px)' : undefined
        }}
      >
        <div className="flex items-center justify-between gap-4 px-4 lg:px-6 h-[52px]">

          {/* Left: Mobile Toggle & Brand */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — solo mobile */}
            <button
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu size={18} />
            </button>

            {/* Brand Logo & Name */}
            <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0 group">
              <div className="w-7 h-7 rounded-lg overflow-hidden bg-white shrink-0 border border-slate-200/90 dark:border-slate-700/80 p-0.5 shadow-xs">
                <img src="/brand/open-motor-logo.png" alt="OpenMotors" className="w-full h-full object-contain" />
              </div>
              <span className="font-bold text-[15px] tracking-tight text-slate-900 dark:text-white leading-none">
                Open<span className="text-[#D62828]">Motors</span>
              </span>
            </Link>
          </div>

          {/* Right: Actions & User */}
          <div className="flex items-center gap-2 shrink-0">
            {/* PWA Install */}
            {deferredPrompt && (
              <button
                onClick={() => {
                  deferredPrompt.prompt();
                  deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#D62828] text-white hover:bg-[#b81d1d] transition-colors shadow-xs"
                title="Instalar OpenMotors"
              >
                <Download size={13} />
                <span>Instalar</span>
              </button>
            )}

            {/* Menú "Más" secundario */}
            {NAV_MORE.length > 0 && (
              <div className="relative hidden md:block" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen(v => !v)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    moreOpen
                      ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60"
                  )}
                >
                  <span>Más</span>
                  <ChevronDown size={12} className={cn("transition-transform duration-150", moreOpen && "rotate-180")} />
                </button>
                {moreOpen && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-44 rounded-xl overflow-hidden z-[60] py-1 bg-white dark:bg-[#16161E] border border-slate-200 dark:border-slate-800 shadow-lg"
                  >
                    {NAV_MORE.map(({ label, to }) => {
                      const active = location.pathname === to || location.pathname.startsWith(to + '/');
                      return (
                        <Link
                          key={to}
                          to={to}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "block px-3 py-2 text-[12px] font-medium transition-colors",
                            active
                              ? "bg-red-50 text-[#D62828] dark:bg-red-950/30 dark:text-red-400 font-semibold"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
                          )}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Bell de notificaciones */}
            <div className="relative" ref={notifRef}>
              <NotificationBell onClick={() => setNotifOpen(v => !v)} unread={unread} />
              <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>

            {/* Divisor vertical sutil */}
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-0.5 hidden sm:block" />

            {/* Avatar con dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 p-0.5 rounded-full hover:ring-2 hover:ring-slate-200 dark:hover:ring-slate-700 transition-all cursor-pointer"
                aria-label="Menú de usuario"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs">
                  {initials(user?.nombre_completo ?? 'U')}
                </div>
              </button>

              {open && (
                <div
                  className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden z-50 bg-white dark:bg-[#16161E] border border-slate-200 dark:border-slate-800 shadow-xl"
                >
                  {/* Info usuario */}
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
                      {user?.nombre_completo}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {user?.correo}
                    </p>
                    <div className="mt-1.5">
                      <span className="inline-block text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {roleLabel}
                      </span>
                    </div>
                  </div>

                  {/* Acciones de cuenta */}
                  <div className="p-1 space-y-0.5">
                    <button
                      onClick={() => { setPwOpen(true); setOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <KeyRound size={14} className="text-slate-400" />
                      Cambiar contraseña
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <LogOut size={14} className="text-red-500" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ══ CUERPO PRINCIPAL CON SIDEBAR LATERAL ══ */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Sidebar Lateral en Desktop */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* ══ CONTENIDO DE CADA PÁGINA ════════════════════════════════ */}
        <main ref={mainRef} className="gallery-content flex-1 min-w-0 overflow-y-auto h-full">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
            className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full"
            style={{ paddingBottom: isNativeApp ? 120 : undefined }}
          >
            {/* Boundary por página: si una pantalla falla, el menú sigue vivo
                y al navegar a otra ruta (resetKey) se recupera sola. */}
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet context={lastNonClientRoute.current} />
            </ErrorBoundary>
          </motion.div>
        </main>
      </div>

      {/* ══ BARRA DE TABS INFERIOR — solo en el APK ══ */}
      {isNativeApp && <MobileTabBar onMore={() => setMobileOpen(true)} />}

      {/* ══ BOTÓN FLOTANTE WHATSAPP — solo en web ══ */}
      {!isNativeApp && (
        <a
          href={whatsappCitaLink('Hola! Quiero agendar una cita en OpenMotors 🚗')}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed z-50 flex items-center justify-center rounded-full shadow-2xl transition-transform hover:scale-110 active:scale-95"
          style={{
            bottom: 24,
            right: 20,
            width: 52,
            height: 52,
            background: '#25D366',
            boxShadow: '0 4px 24px rgba(37,211,102,0.45)',
          }}
          title="Agendar cita por WhatsApp"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}

      {/* ══ MODAL: crear / cambiar contraseña ══ */}
      <Modal
        open={pwOpen}
        onClose={() => { setPwOpen(false); resetPw(); }}
        title="Crear o cambiar contraseña"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setPwOpen(false); resetPw(); }}>Cancelar</Button>
            <Button onClick={guardarPassword} loading={pwSaving} disabled={!pw1 || !pw2}>
              <KeyRound size={14} /> Guardar contraseña
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-[12px] dark:text-white/45 text-slate-900/45 leading-relaxed">
            Cuenta: <strong className="dark:text-white/70 text-slate-900/70">{user?.correo}</strong>
          </p>
          <div>
            <label className="text-xs font-semibold dark:text-white/50 text-slate-900/50 uppercase tracking-wider block mb-1.5">
              Contraseña actual
              <span className="normal-case font-normal ml-1 dark:text-white/25 text-slate-900/25">(déjala vacía si es la primera vez)</span>
            </label>
            <input type="password" className="gm-input-d w-full" placeholder="Contraseña actual (opcional)"
                   value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <label className="text-xs font-semibold dark:text-white/50 text-slate-900/50 uppercase tracking-wider block mb-1.5">Nueva contraseña</label>
            <input type="password" className="gm-input-d w-full" placeholder="Mínimo 6 caracteres"
                   value={pw1} onChange={e => setPw1(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className="text-xs font-semibold dark:text-white/50 text-slate-900/50 uppercase tracking-wider block mb-1.5">Repetir contraseña</label>
            <input type="password" className="gm-input-d w-full" placeholder="Vuelve a escribirla"
                   value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" />
          </div>
          {pw1 && pw2 && pw1 !== pw2 && <p className="text-xs text-red-400">Las contraseñas no coinciden</p>}
        </div>
      </Modal>
    </div>
  );
}
