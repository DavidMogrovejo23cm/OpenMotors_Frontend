/* ─────────────────────────────────────────────
   OpenMotors — Auth Context
   JWT + Firebase Auth (redirect, no popup)
   ───────────────────────────────────────────── */

import {
  createContext, useContext, useState,
  useEffect, useCallback, type ReactNode,
} from 'react';
import { authApi, tokenVencido } from '../lib/api';
import {
  ACTIVITY_KEY,
  EXPIRED_REASON_KEY,
  INACTIVITY_TIMEOUT_MS,
  getLastActivity,
  isInactiveExpired,
  recordActivity,
} from '../lib/inactivity';
import type { Usuario } from '../types';
import {
  firebaseEnabled,
  firebaseSignOut,
  type FirebaseUser,
} from '../lib/firebase';

interface AuthState {
  user:    Usuario | null;
  token:   string  | null;
  loading: boolean;
}

export type RoleName = 'ADMIN' | 'MECANICO' | 'CLIENTE';

interface AuthCtx extends AuthState {
  login:              (correo: string, contrasena: string) => Promise<void>;
  /** Procesa un FirebaseUser de Google y crea/inicia sesión en el backend. */
  processGoogleUser?: (fbUser: FirebaseUser) => Promise<void>;
  logout:             (reason?: 'manual' | 'inactivity') => void;
  isAdmin:    boolean;
  isMecanico: boolean;
  isCliente:  boolean;
  hasRole: (...roles: RoleName[]) => boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

const TOKEN_KEY = 'gm_token';
const USER_KEY  = 'gm_user';
const PERMISSION_REFRESH_MS = 60_000;

/* Extrae token + usuario de cualquier estructura de respuesta del backend */
function extractAuth(data: Record<string, unknown>) {
  const { token: backendToken, jwt, accessToken, usuario, user: nestedUser, ...profile } = data;
  const token = (backendToken ?? jwt ?? accessToken) as string | undefined;
  const user = (usuario ?? nestedUser ?? (profile.id_usuario ?? profile.id ? profile : undefined)) as Usuario | undefined;
  return { token, user };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user:    JSON.parse(localStorage.getItem(USER_KEY)  ?? 'null'),
    token:   localStorage.getItem(TOKEN_KEY),
    loading: false,
  });

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('gm:unauthorized', handler);
    return () => window.removeEventListener('gm:unauthorized', handler);
  }, []);

  /**
   * Al montar, refrescar los roles del usuario desde el backend.
   * IMPORTANTE: usa fetch nativo (NO axios) para evitar que el interceptor
   * de axios dispare un logout si el token está expirado.
   * Un 401/403/404 simplemente se ignora → el usuario sigue con roles guardados.
   * El logout solo ocurre si el usuario hace una acción real (API call con axios).
   */
  useEffect(() => {
    const token   = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    if (!token || !userStr) return;

    let stored: { id_usuario?: number } | null;
    try { stored = JSON.parse(userStr); } catch { return; }
    if (!stored?.id_usuario) return;

    const API = (import.meta.env.VITE_API_URL as string | undefined)
      ?? 'https://backend-openmotors.onrender.com/api';

    // Guard de cancelación: si el usuario hace logout o inicia sesión con OTRA
    // cuenta antes de que llegue esta respuesta, no pisar el estado con datos viejos.
    let cancelled = false;
    const idEsperado = stored.id_usuario;

    fetch(`${API}/usuarios/${stored.id_usuario}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async res => {
        if (cancelled) return; // respuesta tardía: el contexto ya cambió
        // Si el usuario ya no existe en BD (fue borrado) → cerrar sesión automáticamente
        if (res.status === 404 || res.status === 401) {
          if (res.status === 401 && !tokenVencido(token)) {
            const errBody = await res.clone().json().catch(() => null) as { detail?: string } | null;
            const detail = (errBody?.detail ?? '').toLowerCase();
            const revoked = detail.includes('suspendida') || detail.includes('invalidada') || detail.includes('cerrada');
            if (!revoked) return;
          }
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem(ACTIVITY_KEY);
          setState({ user: null, token: null, loading: false });
          window.location.replace('/login');
          return;
        }
        if (!res.ok) return; // servidor dormido / error temporal → mantener datos guardados
        const data = await res.json() as Record<string, unknown>;
        // Solo aplicar si la sesión vigente sigue siendo la misma cuenta
        const tokenVigente = localStorage.getItem(TOKEN_KEY);
        if (!tokenVigente || tokenVigente !== token) return;
        if (data?.id_usuario === idEsperado) {
          delete data.contrasena; // nunca guardar hash en localStorage
          localStorage.setItem(USER_KEY, JSON.stringify(data));
          setState(s => ({ ...s, user: data as unknown as Usuario }));
        }
      })
      .catch(() => {}); // red caída o backend dormido → mantener datos guardados

    return () => { cancelled = true; };
  }, []); // solo al montar

  useEffect(() => {
    let cancelled = false;
    let lastRefresh = 0;

    const refresh = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastRefresh < PERMISSION_REFRESH_MS) return;
      lastRefresh = now;
      const token = localStorage.getItem(TOKEN_KEY);
      const userStr = localStorage.getItem(USER_KEY);
      if (!token || !userStr) return;
      let stored: { id_usuario?: number } | null;
      try { stored = JSON.parse(userStr) as { id_usuario?: number }; } catch { return; }
      if (!stored?.id_usuario) return;

      const API = (import.meta.env.VITE_API_URL as string | undefined)
        ?? 'https://backend-openmotors.onrender.com/api';
      try {
        const res = await fetch(`${API}/usuarios/${stored.id_usuario}?_=${Date.now()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
          },
        });
        if (cancelled) return;
        if (res.status === 404 || res.status === 401) {
          if (res.status === 401 && !tokenVencido(token)) {
            const errBody = await res.clone().json().catch(() => null) as { detail?: string } | null;
            const detail = (errBody?.detail ?? '').toLowerCase();
            const revoked = detail.includes('suspendida') || detail.includes('invalidada') || detail.includes('cerrada');
            if (!revoked) return;
          }
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem(ACTIVITY_KEY);
          setState({ user: null, token: null, loading: false });
          window.location.replace('/login');
          return;
        }
        if (!res.ok) return;
        const data = await res.json() as Record<string, unknown>;
        if (data?.id_usuario !== stored.id_usuario) return;
        delete data.contrasena;
        localStorage.setItem(USER_KEY, JSON.stringify(data));
        setState(s => ({ ...s, user: data as unknown as Usuario }));
      } catch {
        /* sin red: se conserva sesion actual */
      }
    };

    const onFocus = () => refresh(true);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(true); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(() => refresh(false), PERMISSION_REFRESH_MS);
    refresh(true);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, []);

  /* ── Login con email + contraseña (backend directo, sin Firebase) ── */
  const login = useCallback(async (correo: string, contrasena: string) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const { data } = await authApi.login(correo, contrasena);
      const { token, user } = extractAuth(data);
      if (!token || !user) throw new Error('Respuesta del servidor inválida. Intenta nuevamente.');
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY,  JSON.stringify(user));
      recordActivity(localStorage);
      setState({ user, token, loading: false });
    } catch (err) {
      setState((s) => ({ ...s, loading: false }));
      throw err;
    }
  }, []);

  const processGoogleUser = undefined;

  const logout = useCallback((reason: 'manual' | 'inactivity' = 'manual') => {
    const tokenActual = localStorage.getItem(TOKEN_KEY);
    if (tokenActual) {
      authApi.logout().catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    if (reason === 'inactivity') {
      sessionStorage.setItem(EXPIRED_REASON_KEY, 'inactivity');
    }
    setState({ user: null, token: null, loading: false });
    window.location.replace(reason === 'inactivity' ? '/login?expired=1' : '/login');
    if (firebaseEnabled) firebaseSignOut().catch(() => {});
  }, []);

  /* ── Control de expiración por inactividad (30 minutos sin interacción) ── */
  useEffect(() => {
    if (!state.token) return;
    if (getLastActivity(localStorage) === null) {
      recordActivity(localStorage);
    }

    let lastWrite = Date.now();
    const touch = () => {
      const now = Date.now();
      if (now - lastWrite >= 5_000) {
        lastWrite = now;
        recordActivity(localStorage, now);
      }
    };

    const checkExpiry = () => {
      if (!localStorage.getItem(TOKEN_KEY)) return;
      const last = getLastActivity(localStorage);
      if (isInactiveExpired(last, Date.now(), INACTIVITY_TIMEOUT_MS)) {
        logout('inactivity');
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach(ev => window.addEventListener(ev, touch, { passive: true }));
    const onVis = () => { if (document.visibilityState === 'visible') checkExpiry(); };
    document.addEventListener('visibilitychange', onVis);
    const timer = window.setInterval(checkExpiry, 15_000);

    return () => {
      events.forEach(ev => window.removeEventListener(ev, touch));
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(timer);
    };
  }, [state.token, logout]);

  type StoredRole = { estado?: number; nombre?: string; rol?: { nombre?: string } };
  const storedRoles = (state.user?.roles ?? []) as unknown[];
  const roleNames = new Set<string>(
    storedRoles
      .filter((r): r is string | StoredRole =>
        typeof r === 'string' || (typeof r === 'object' && r !== null))
      .filter(r => typeof r === 'string' || r.estado === 1 || r.estado === undefined)
      .map(r => typeof r === 'string' ? r : (r.rol?.nombre ?? r.nombre ?? ''))
      .filter((n) => typeof n === 'string' && n.trim().length > 0)
      .map((n) => String(n).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
  );

  const hasRole    = (...roles: RoleName[]) => roles.some((r) => roleNames.has(r));
  const isAdmin    = roleNames.has('ADMIN');
  const isMecanico = roleNames.has('MECANICO');
  const isCliente  = roleNames.has('CLIENTE');

  return (
    <AuthContext.Provider value={{
      ...state, login, processGoogleUser, logout,
      isAdmin, isMecanico, isCliente, hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
