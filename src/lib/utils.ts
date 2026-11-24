import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina clases de Tailwind sin conflictos */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normaliza cualquier fecha del backend a string "yyyy-MM-dd".
 * El backend puede enviar: "2026-06-08" (string) o [2026,6,8] (array de Java LocalDate).
 * Después del fix jackson (write-dates-as-timestamps=false) siempre llega string.
 */
export function toIsoStr(fecha: unknown): string {
  if (!fecha) return '';
  if (Array.isArray(fecha)) {
    const [y, m, d] = fecha as number[];
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return String(fecha).slice(0, 10);
}

/** Formatea fecha ISO → "12 may 2025" — acepta string o array Java */
export function fmtDate(iso: unknown): string {
  const s = toIsoStr(iso);
  if (!s) return '—';
  // Añade T00:00:00 para evitar off-by-one de zona horaria
  return new Date(s + 'T00:00:00').toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** Formatea número como moneda */
export function fmtMoney(n: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2,
  }).format(n);
}

/** Capitaliza primera letra */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Obtiene iniciales de nombre completo */
export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Mapa estado de registro → texto + color */
export const ESTADO_REGISTRO: Record<number, { label: string; color: string }> = {
  0: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700' },
  1: { label: 'En proceso', color: 'bg-blue-100 text-blue-700' },
  2: { label: 'Finalizada', color: 'bg-green-100 text-green-700' },
  3: { label: 'Entregada', color: 'bg-purple-100 text-purple-700' },
};

export function canAccessModulo(
  permisos: readonly string[] | undefined | null,
  mod: string,
  isAdmin: boolean,
  isMecanico: boolean,
): boolean {
  if (isAdmin) return true;
  if (!isMecanico) return false;
  if (mod === 'proveedores') return permisos?.includes('inventario_entradas') ?? false;
  return ['carros', 'registros', 'diagnostico', 'alertas', 'inventario', 'clientes'].includes(mod);
}

/** Extrae teléfono del campo descripcion (formato: "CEDULA: xxx | TELEFONO: xxx") */
export function extractPhone(descripcion: string | undefined | null): string | null {
  if (!descripcion) return null;
  const match = descripcion.match(/TELEFONO:\s*([^\s|]+)/i);
  return match && match[1] !== 'N/A' ? match[1] : null;
}

/** Extrae cédula del campo descripcion */
export function extractCedula(descripcion: string | undefined | null): string | null {
  if (!descripcion) return null;
  const match = descripcion.match(/CEDULA:\s*(\d+)/i);
  return match ? match[1] : null;
}

/** Número de orden/comprobante ÚNICO y estable, basado en id_registro.
   Fuente de verdad para web, impresión, email y APK: formato ORD-000NNN. */
export function ordenNumero(idRegistro: number): string {
  return `ORD-${String(idRegistro).padStart(6, '0')}`;
}

/** Genera el siguiente código secuencial de producto (formato COD-001) */
export function nextProductCode(existingCodes: string[]): string {
  const nums = existingCodes
    .filter((c) => /^COD-\d+$/i.test(c))
    .map((c) => parseInt(c.replace(/^COD-/i, ''), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `COD-${String(max + 1).padStart(3, '0')}`;
}

/** Debounce simple */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms = 300) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Mensajes amigables para errores de Firebase Auth */
const FIREBASE_MSGS: Record<string, string> = {
  'auth/unauthorized-domain': 'Este dominio no está autorizado. Usa openmotor.vercel.app',
  'auth/popup-blocked': 'El navegador bloqueó el popup de Google. Permite popups e intenta de nuevo.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de completar.',
  'auth/cancelled-popup-request': 'Solo puede haber una ventana de Google abierta a la vez.',
  'auth/user-not-found': 'No existe cuenta con ese correo.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
  'auth/invalid-email': 'Correo electrónico no válido.',
  'auth/too-many-requests': 'Demasiados intentos fallidos. Espera unos minutos.',
  'auth/network-request-failed': 'Sin conexión de red. Verifica tu internet.',
  'auth/internal-error': 'Error interno de autenticación. Intenta de nuevo.',
  'auth/invalid-credential': 'Credenciales inválidas. Intenta de nuevo.',
};

/** Extrae mensaje de error de Axios o Firebase */
export function getErrorMsg(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as {
      response?: { status?: number; data?: { message?: string } };
      message?: string;
      code?: string;
    };

    /* Errores de Firebase (tienen code pero no response) */
    if (e.code && e.code.startsWith('auth/')) {
      return FIREBASE_MSGS[e.code] ?? e.message ?? `Error Google: ${e.code}`;
    }

    /* Sin respuesta HTTP → problema de red o CORS */
    if (!e.response) {
      return e.message?.includes('verificado')
        ? e.message
        : '';
    }

    const status = e.response.status;

    if (status === 502 || status === 503 || status === 504) {
      return 'El servidor está iniciando (plan gratuito). Espera unos segundos e intenta de nuevo.';
    }
    if (status === 401) {
      return 'Correo o contraseña incorrectos.';
    }
    if (status === 409 || status === 400) {
      const data = e.response?.data as { message?: string; mensaje?: string; error?: string } | string | undefined;
      const backendMsg =
        typeof data === 'string'
          ? data
          : data?.mensaje || data?.error || data?.message;
      if (backendMsg) return backendMsg;
      if (status === 409) return 'Este correo o usuario ya está registrado. Inicia sesión o recupera tu contraseña.';
      return 'Datos de formulario incompletos o incorrectos.';
    }
    if (status === 403) {
      const data = e.response?.data as { message?: string; mensaje?: string; error?: string; detail?: string } | string | undefined;
      const backendMsg =
        typeof data === 'string'
          ? data
          : data?.mensaje || data?.error || data?.detail || data?.message;
      return backendMsg || 'No tienes permiso para realizar esta acción.';
    }
    if (status === 404) {
      return 'Recurso no encontrado.';
    }
    if (status && status >= 500) {
      return 'Error interno del servidor. Por favor intenta más tarde.';
    }

    const d = e.response?.data as { message?: string; mensaje?: string; error?: string } | undefined;
    return d?.mensaje ?? d?.message ?? d?.error ?? e.message ?? 'Error inesperado';
  }
  if (typeof err === 'string') return err;
  return 'Error inesperado';
}

export function nivelDiagnostico(estado: string | number): 1 | 2 | 3 {
  if (estado === 'BUENO' || estado === 1) return 1;
  if (estado === 'REGULAR' || estado === 2) return 2;
  return 3;
}


/** Movimientos cobrados por fecha de pago, incluyendo abonos. */
export function cobrosDeOrdenes(registros: import('../types').RegistroDetalle[]) {
  return registros.flatMap(r => {
    if (r.pagos?.length) return r.pagos.map(p => ({ ...r, fecha: p.fecha, costo_total: p.monto, monto_pagado: p.monto }));
    // Importes históricos conservados por la migración, sin inventar movimientos.
    if ((r.monto_pagado ?? 0) > 0) return [{ ...r, fecha: r.fecha_facturado ?? r.fecha, costo_total: r.monto_pagado!, monto_pagado: r.monto_pagado }];
    return [];
  });
}

export const ORDEN_LABELS = ['Pendiente', 'En proceso', 'Finalizada', 'Entregada'];
export const ORDEN_COLORS: Record<number, string> = { 0: '#F59E0B', 1: '#3B82F6', 2: '#10B981', 3: '#8B5CF6' };
