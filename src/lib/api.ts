import type { Usuario } from '../types';
/* ─────────────────────────────────────────────
   OpenMotors — Capa de acceso a API
   Axios + interceptores de JWT
   ───────────────────────────────────────────── */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

/* Base URL del backend.
   - En el APK (Capacitor) la WebView corre en https://localhost, por lo que
     una ruta relativa '/api' apuntaría al propio dispositivo y fallaría.
     Por eso el fallback es la URL ABSOLUTA del backend en Render.
   - En Vercel se puede sobreescribir con VITE_API_URL si hiciera falta. */
const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? '/api' : 'https://backend-openmotors.onrender.com/api');

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 65_000,   // Render free tier puede tardar ~50s en despertar
  headers: { 'Content-Type': 'application/json' },
});

/* ── Request interceptor: adjunta JWT (excepto endpoints públicos) ── */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('gm_token');
    const url   = config.url ?? '';
    // No enviar token en auth endpoints — un JWT expirado haría que Spring
    // Security rechace el login antes de llegar al permitAll()
    const isPublic =
      url === '/usuarios/login' ||
      url.includes('/recuperacion');
    if (token && !isPublic && config.headers) {
      if (typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (err) => Promise.reject(err)
);

/* ── Decodifica el "exp" de un JWT (segundos epoch). null si no se puede leer ── */
function jwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(
      decodeURIComponent(
        atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
    );
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

/** true si el token está vencido (con 10s de margen). Si no tiene exp legible, se asume válido. */
export function tokenVencido(token: string | null): boolean {
  if (!token) return true;
  const exp = jwtExp(token);
  if (exp == null) return false; // no se pudo leer → no asumir vencido
  return Date.now() >= exp * 1000 - 10_000;
}

/* ── Response interceptor: manejo global de errores ──
   LÓGICA DE LOGOUT:
   Solo cierra sesión si el token está REALMENTE vencido (verificado por exp).
   Un 401 de un upload o endpoint protegido NO cierra sesión si el token
   aún es válido — podría ser un error de permisos, multipart mal formado, etc.
   ──────────────────────────────────────────────────────────────────────────── */
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const url = err.config?.url ?? '';

    const isAuthPublico =
      url.includes('/usuarios/login') ||
      url.includes('/usuarios/recuperacion');

    if (err.response?.status === 401 && !isAuthPublico) {
      // Cualquier 401 en endpoint protegido = token inválido → logout inmediato.
      // Cubre tokens expirados Y tokens de otro backend (firma incorrecta).
      localStorage.removeItem('gm_token');
      localStorage.removeItem('gm_user');
      window.dispatchEvent(new Event('gm:unauthorized'));
    }
    return Promise.reject(err);
  }
);

/* ── Endpoints de autenticación ── */
export interface UsuarioRegisterPayload {
  nombre_completo: string;
  nombre_usuario: string;
  correo: string;
  contrasena: string;
  cedula?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
}

export const authApi = {
  login: (identificador: string, contrasena: string) =>
    api.post('/usuarios/login', {
      ...(identificador.includes('@') ? { correo: identificador } : { nombre_usuario: identificador }),
      contrasena,
    }),
  logout: () => api.post('/usuarios/logout'),
  register: (data: UsuarioRegisterPayload) =>
    api.post<{ mensaje: string; usuario: Usuario }>('/usuarios/registro', data),
  recover:  (correo: string) =>
    api.post('/usuarios/recuperacion/solicitar', { correo }),
  resetPassword: (token: string, nueva_contrasena: string) =>
    api.post('/usuarios/recuperacion/restablecer', { token, nueva_contrasena }),
};

/* ── Usuarios ── */
export const usuariosApi = {
  permisos: (id: number) => api.get<{ permisos: string[] }>(`/usuarios/${id}/permisos`),
  guardarPermisos: (id: number, permisos: string[]) => api.put(`/usuarios/${id}/permisos`, { permisos }),
  createClient: (data: {
    nombre_completo: string;
    nombre_usuario: string;
    correo: string;
    contrasena_temporal?: string;
    telefono?: string;
    cedula?: string;
    direccion?: string;
    ciudad?: string;
  }) => api.post<{ usuario: Usuario; credencialTemporal: { nombreUsuario: string; contrasena: string } }>(
    '/usuarios/clientes', data,
  ),
  list:    ()             => api.get('/usuarios'),
  get:     (id: number)  => api.get(`/usuarios/${id}`),
  update:  (id: number, data: Record<string, unknown>) => api.put(`/usuarios/${id}`, data),
  cambiarEstado: (id: number, activo: boolean) => api.patch(`/usuarios/${id}/estado`, { activo }),
  restablecerClave: (id: number, nueva_contrasena?: string) =>
    api.post<{ mensaje: string; usuario: Usuario; contrasenaTemporal: string }>(
      `/usuarios/${id}/restablecer-clave`,
      nueva_contrasena ? { nueva_contrasena } : {},
    ),
  remove:  (id: number)  => api.delete(`/usuarios/${id}`),
  upload:  (form: FormData) => {
    const token = localStorage.getItem('gm_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${BASE_URL}/usuarios/upload`, { method: 'POST', headers, body: form })
      .then(res => res.json()).then(data => ({ data }));
  },
  usarReferido: (id: number, codigo: string) =>
    api.post(`/usuarios/${id}/usar-referido`, { codigo }),
};

/* ── Carros ── */
export const carrosApi = {
  list:      ()            => api.get('/vehiculos'),
  get:       (id: number)  => api.get(`/vehiculos/${id}`),
  byUser:    (uid: number) => api.get(`/vehiculos/usuario/${uid}`),
  create:    (data: Record<string, unknown>) => api.post('/vehiculos', data),
  update:    (id: number, data: Record<string, unknown>) => api.put(`/vehiculos/${id}`, data),
  remove:    (id: number)  => api.delete(`/vehiculos/${id}`),
  upload: (form: FormData) => {
    const token = localStorage.getItem('gm_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${BASE_URL}/vehiculos/upload`, { method: 'POST', headers, body: form })
      .then(res => res.json()).then(data => ({ data }));
  },
};

/* ── Registros ── */
export interface ReporteTrabajosResp {
  filtros: {
    fecha_inicio: string | null;
    fecha_fin: string | null;
    estado: number | null;
    id_encargado: number | null;
    id_tipo: number | null;
  };
  resumen: {
    total_ordenes: number;
    total_facturado: number;
    total_cobrado: number;
    total_pendiente: number;
    horas_trabajadas_totales: number;
    conteo_por_estado: {
      pendiente: number;
      en_proceso: number;
      finalizada: number;
      entregada: number;
    };
  };
  items: Array<import('../types').RegistroDetalle & { horas_trabajadas: number }>;
}

export const registrosApi = {
  pagar: (id: number, monto: number, metodo: string, referencia?: string, idOperacion?: string) =>
    api.post(`/registros/${id}/pagos`, { monto_recibido: monto, metodo_pago: metodo, numero_referencia: referencia, id_operacion: idOperacion }),
  list:    ()            => api.get('/registros'),
  summary: ()            => api.get('/registros/resumen'),
  reporteTrabajos: (params?: {
    fecha_inicio?: string;
    fecha_fin?: string;
    estado?: number;
    id_encargado?: number;
    id_tipo?: number;
  }) => api.get<ReporteTrabajosResp>('/registros/reportes/trabajos', { params }),
  actualizarEstimacion: (id: number, data: { fecha_entrega_estimada?: string | null; horas_estimadas?: number | null }) =>
    api.patch(`/registros/${id}/estimacion`, data),
  get:     (id: number)  => api.get(`/registros/${id}`),
  byClient:(id: number)  => api.get(`/registros/cliente/${id}`),
  byMechanic:(id: number)=> api.get(`/registros/encargado/${id}`),
  create:  (data: Record<string, unknown>) => api.post('/registros', data),
  update:  (id: number, data: Record<string, unknown>) => api.put(`/registros/${id}/factura`, data),
  estado:  (id: number, estado: number, extra: Record<string, unknown> = {}) =>
    api.patch(`/registros/${id}/estado`, { estado, ...extra }),
  remove:  (id: number)  => api.delete(`/registros/${id}`),
  /** Detalles de la factura asociada a un registro (mano de obra + repuestos). */
  detalles: (idFactura: number) => api.get(`/registros/${idFactura}/detalles-factura`),
};

/* ── Productos ── */
export const productosApi = {
  list:   ()            => api.get('/productos'),
  get:    (id: number)  => api.get(`/productos/${id}`),
  create: (data: Record<string, unknown>) => api.post('/productos', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/productos/${id}`, data),
  remove: (id: number)  => api.delete(`/productos/${id}`),
  upload: (form: FormData) => {
    const token = localStorage.getItem('gm_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${BASE_URL}/productos/upload`, { method: 'POST', headers, body: form })
      .then(async (res) => {
         if (!res.ok) throw new Error('Upload falló con status: ' + res.status);
         return res.json();
      }).then(data => ({ data }));
  },
  ventaDirecta: (data: Record<string, unknown>) =>
    api.post('/productos/venta-directa', data),
  enviarComprobante: (data: Record<string, unknown>) =>
    api.post('/productos/venta-comprobante', data),
};

/* ── Categorías ── */
export const categoriasApi = {
  list:   ()            => api.get('/categorias'),
  create: (data: Record<string, unknown>) => api.post('/categorias', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/categorias/${id}`, data),
  remove: (id: number)  => api.delete(`/categorias/${id}`),
};

/* ── Roles ── */
export const rolesApi = {
  list:   () => api.get('/rol'),
  assign: (id_usuario: number, id_rol: number) =>
    api.post('/usuario_rol/asignar', { id_usuario, id_rol }),
  revoke: (id_usuario: number, id_rol: number) =>
    api.put('/usuario_rol/revocar', { id_usuario, id_rol }),
  cambiarCategoria: (id_usuario: number, id_rol_actual: number, id_rol_nuevo: number) =>
    api.put('/usuario_rol/cambiar-categoria', { id_usuario, id_rol_actual, id_rol_nuevo }),
};

/* ── Tipos de servicio ── */
export const tiposApi = {
  list:   ()            => api.get('/tipos'),
  get:    (id: number)  => api.get(`/tipos/${id}`),
  create: (data: Record<string, unknown>) => api.post('/tipos', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/tipos/${id}`, data),
  remove: (id: number)  => api.delete(`/tipos/${id}`),
};

/* ── Facturas ── */
export const facturasApi = {
  list:   ()            => api.get('/facturas'),
  get:    (id: number)  => api.get(`/facturas/${id}`),
  create: (data: Record<string, unknown>) => api.post('/facturas', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/facturas/${id}`, data),
};

/* ── Detalles de factura ── */
export const detallesFacturaApi = {
  byFactura: (id: number) => api.get(`/detalles-factura/factura/${id}`),
  create:    (data: Record<string, unknown>) => api.post('/detalles-factura', data),
  remove:    (id: number) => api.delete(`/detalles-factura/${id}`),
};

/* ── Rutas GPS ── */
export const rutasApi = {
  list:   ()            => api.get('/rutas'),
  get:    (id: number)  => api.get(`/rutas/${id}`),
  create: (data: Record<string, unknown>) => api.post('/rutas', data),
  remove: (id: number)  => api.delete(`/rutas/${id}`),
};

/* ── Diagnósticos mecánicos ── */
export const diagnosticosApi = {
  plantilla: () => api.get<{ sistema: string; nombre: string; partes_sugeridas: string[] }[]>('/diagnosticos/plantilla-8-sistemas'),
  create:     (data: Record<string, unknown>) => api.post('/diagnosticos', data),
  byCarro:     (idCarro: number)     => api.get(`/diagnosticos/vehiculo/${idCarro}`),
  byMecanico: (idMecanico: number) => api.get(`/diagnosticos/mecanico/${idMecanico}`),
  get:        (id: number)         => api.get(`/diagnosticos/${id}`),
};

/* ── Alertas y estado de mantenimiento ── */
export const alertasApi = {
  estadoCarro: (idCarro: number) => api.get(`/alertas/vehiculo/${idCarro}`),
  verificar:  (idCarro: number) => api.post(`/alertas/verificar/${idCarro}`, {}),
};

/* ── Mantenimientos realmente realizados (compartido entre usuarios) ── */
export const mantenimientosApi = {
  byCarro:   (idCarro: number) => api.get(`/mantenimientos/vehiculo/${idCarro}`),
  registrar:(data: { id_vehiculo: number; tipo: string; km_servicio: number }) =>
    api.post('/mantenimientos', { id_vehiculo: data.id_vehiculo, tipo: data.tipo, kmServicio: data.km_servicio }),
  borrar:   (idCarro: number, tipo: string) => api.delete(`/mantenimientos/vehiculo/${idCarro}/${tipo}`),
};

/* ── Combustible (galones) — en la nube ── */
export const combustibleApi = {
  list:   ()            => api.get('/combustible'),
  byCarro: (idCarro: number) => api.get(`/combustible/vehiculo/${idCarro}`),
  create: (data: Record<string, unknown>) => api.post('/combustible', data),
  remove: (id: number)  => api.delete(`/combustible/${id}`),
  precios: () => api.get('/combustible/precios'),
  updatePrecio: (tipo: string, precio: number) =>
    api.put(`/combustible/precios/${encodeURIComponent(tipo)}`, { precio }),
};

/* ── Pagos de empleados + gastos generales ── */
export interface PagoEmpleadoAPI {
  id_pago:      number;
  id_empleado:  number;   // 0 = gasto general (compra de inventario, etc.)
  fecha:        string;   // yyyy-MM-dd
  concepto:     string;
  categoria?:   string;
  monto:        number;
  notas?:       string;
}

export const pagosEmpleadoApi = {
  listByEmployee: (idEmpleado: number)  => api.get<PagoEmpleadoAPI[]>(`/pagos-empleado/${idEmpleado}`),
  listAll:        (params?: { fecha_inicio?: string; fecha_fin?: string; categoria?: string; id_empleado?: number }) =>
    api.get<PagoEmpleadoAPI[]>('/pagos-empleado', { params }),
  create:         (data: Omit<PagoEmpleadoAPI, 'id_pago'>) => api.post<PagoEmpleadoAPI>('/pagos-empleado', data),
  remove:         (id: number)          => api.delete(`/pagos-empleado/${id}`),
};

/* ── Gestión Financiera y Caja (RF-33, RF-36, RF-37, RF-38) ── */
export interface CategoriaMovimientoAPI {
  id_categoria: number;
  nombre: string;
  tipo: 'INGRESO' | 'EGRESO' | 'AMBOS';
  descripcion?: string | null;
  es_personal: boolean;
  activa: boolean;
}

export interface DeudaClienteOrden {
  id_registro: number;
  fecha: string;
  placa: string;
  marca_vehiculo: string;
  modelo_vehiculo: string;
  tipo_servicio: string;
  estado: number;
  estado_pago: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
  costo_total: number;
  monto_pagado: number;
  saldo_pendiente: number;
  pagos: { id_pago: number; monto: number; fecha: string; metodo: string }[];
}

export interface DeudaClienteItem {
  id_cliente: number;
  nombre_cliente: string;
  cedula?: string | null;
  telefono?: string | null;
  correo?: string | null;
  total_facturado: number;
  total_abonado: number;
  saldo_total_pendiente: number;
  cantidad_ordenes: number;
  ordenes: DeudaClienteOrden[];
}

export interface DeudasResp {
  total_clientes_con_deuda: number;
  total_cartera_pendiente: number;
  clientes: DeudaClienteItem[];
}

export interface MovimientoCajaAPI {
  id_movimiento: number;
  fecha: string;
  tipo: 'APERTURA' | 'INGRESO' | 'RETIRO' | 'CIERRE';
  monto: number;
  motivo: string;
  referencia?: string | null;
  id_registro?: number | null;
  id_usuario?: number | null;
  saldo_anterior: number;
  saldo_resultante: number;
  observaciones?: string | null;
}

export interface CierreCajaAPI {
  id_cierre: number;
  fecha_apertura: string;
  fecha_cierre?: string | null;
  monto_inicial: number;
  total_ingresos: number;
  total_retiros: number;
  saldo_esperado: number;
  monto_fisico_contado?: number | null;
  diferencia?: number | null;
  estado: 'ABIERTA' | 'CERRADA';
  observaciones?: string | null;
}

export interface ResumenCajaResp {
  saldo_actual: number;
  caja_abierta: boolean;
  sesion_actual: CierreCajaAPI | null;
  ingresos_hoy: number;
  retiros_hoy: number;
}

export const finanzasApi = {
  categorias: (tipo?: string) => api.get<CategoriaMovimientoAPI[]>('/finanzas/categorias', { params: tipo ? { tipo } : undefined }),
  crearCategoria: (data: { nombre: string; tipo: string; descripcion?: string; es_personal?: boolean }) =>
    api.post<CategoriaMovimientoAPI>('/finanzas/categorias', data),
  deudas: (params?: { id_cliente?: number; q?: string }) => api.get<DeudasResp>('/finanzas/deudas', { params }),
  resumenPeriodo: (params?: { fecha_inicio?: string; fecha_fin?: string }) =>
    api.get('/finanzas/resumen-periodo', { params }),
};

export const cajaApi = {
  resumen: () => api.get<ResumenCajaResp>('/caja/resumen'),
  movimientos: (params?: { fecha_inicio?: string; fecha_fin?: string; tipo?: string }) =>
    api.get<MovimientoCajaAPI[]>('/caja/movimientos', { params }),
  cierres: () => api.get<CierreCajaAPI[]>('/caja/cierres'),
  abrir: (monto_inicial: number, observaciones?: string) =>
    api.post<CierreCajaAPI>('/caja/apertura', { monto_inicial, observaciones }),
  registrarMovimiento: (data: { tipo: 'INGRESO' | 'RETIRO'; monto: number; motivo: string; referencia?: string; observaciones?: string }) =>
    api.post<MovimientoCajaAPI>('/caja/movimientos', data),
  cerrar: (monto_fisico_contado: number, observaciones?: string) =>
    api.post<CierreCajaAPI>('/caja/cierre', { monto_fisico_contado, observaciones }),
};

/* ── Gestión de Personal, Horarios, Asistencia y Desempeño (RF-40, RF-41, RF-42, RF-58) ── */
export interface PerfilLaboralAPI {
  id_perfil: number;
  id_usuario: number;
  cargo: string;
  especialidad?: string | null;
  fecha_ingreso?: string | null;
  tipo_contrato?: string | null;
  modalidad_pago: 'HORA' | 'DIA' | 'SUELDO' | 'POR_TRABAJO' | 'COMISION';
  tarifa_hora: number;
  salario_base: number;
  contacto_emergencia?: string | null;
  observaciones?: string | null;
  actualizado_en?: string | null;
}

export interface PersonalPerfilItem {
  id_usuario: number;
  nombre_completo: string;
  nombre_usuario: string;
  correo: string;
  telefono?: string | null;
  cedula?: string | null;
  activo: boolean;
  roles: string[];
  perfil_laboral: PerfilLaboralAPI | null;
}

export interface HorarioTrabajoAPI {
  id_horario?: number;
  id_usuario: number;
  nombre_empleado?: string | null;
  dia_semana: number;
  es_laborable: boolean;
  hora_entrada: string;
  hora_salida: string;
  minutos_descanso: number;
  turno: string;
}

export interface AsistenciaPersonalAPI {
  id_asistencia: number;
  id_usuario: number;
  nombre_empleado?: string | null;
  fecha: string;
  turno: string;
  estado: 'PRESENTE' | 'TARDANZA' | 'FALTA' | 'PERMISO' | 'DESCANSO';
  hora_entrada?: string | null;
  hora_salida?: string | null;
  minutos_descanso: number;
  horas_trabajadas: number;
  observaciones?: string | null;
}

export interface AsistenciaResp {
  resumen: {
    total_registros: number;
    total_horas_trabajadas: number;
    conteo_estados: Record<string, number>;
    por_empleado: Array<{
      id_usuario: number;
      nombre_empleado: string;
      horas_trabajadas: number;
      dias_presentes: number;
      tardanzas: number;
      faltas: number;
      permisos: number;
    }>;
  };
  items: AsistenciaPersonalAPI[];
}

export interface DesempenoMecanicoItem {
  id_mecanico: number;
  nombre_mecanico: string;
  ordenes_asignadas: number;
  ordenes_completadas: number;
  ordenes_en_proceso: number;
  ordenes_pendientes: number;
  tasa_finalizacion: number;
  cumplimiento_plazos_pct: number | null;
  horas_taller: number;
  horas_asistencia: number;
  diagnosticos_realizados: number;
  trabajos_registrados: number;
  detalle_actividades: Array<{
    id_bitacora: number;
    id_registro: number;
    fecha?: string | null;
    horas_trabajadas: number;
    descripcion_trabajo: string;
  }>;
}

export interface ReporteDesempenoResp {
  filtros: { fecha_inicio: string | null; fecha_fin: string | null; id_mecanico: number | null };
  resumen: {
    ordenes_asignadas: number;
    ordenes_completadas: number;
    horas_taller: number;
    horas_asistencia: number;
    diagnosticos_realizados: number;
  };
  mecanicos: DesempenoMecanicoItem[];
}

export const personalApi = {
  perfiles: () => api.get<PersonalPerfilItem[]>('/personal/perfiles'),
  perfil: (idUsuario: number) => api.get<{ id_usuario: number; nombre_completo: string; perfil_laboral: PerfilLaboralAPI | null }>(`/personal/${idUsuario}/perfil-laboral`),
  guardarPerfil: (idUsuario: number, data: Partial<PerfilLaboralAPI>) =>
    api.put<PerfilLaboralAPI>(`/personal/${idUsuario}/perfil-laboral`, data),
  horarios: (idUsuario?: number) =>
    api.get<HorarioTrabajoAPI[]>('/personal/horarios', { params: idUsuario ? { id_usuario: idUsuario } : undefined }),
  guardarHorarios: (idUsuario: number, horarios: Array<Omit<HorarioTrabajoAPI, 'id_horario' | 'id_usuario' | 'nombre_empleado'>>) =>
    api.put<HorarioTrabajoAPI[]>(`/personal/horarios/${idUsuario}`, { horarios }),
  asistencia: (params?: { fecha_inicio?: string; fecha_fin?: string; id_usuario?: number }) =>
    api.get<AsistenciaResp>('/personal/asistencia', { params }),
  registrarAsistencia: (data: {
    id_usuario: number;
    fecha?: string;
    turno?: string;
    estado: 'PRESENTE' | 'TARDANZA' | 'FALTA' | 'PERMISO' | 'DESCANSO';
    hora_entrada?: string;
    hora_salida?: string;
    minutos_descanso?: number;
    horas_trabajadas?: number;
    observaciones?: string;
  }) => api.post<AsistenciaPersonalAPI>('/personal/asistencia', data),
  actualizarAsistencia: (id: number, data: Partial<AsistenciaPersonalAPI>) =>
    api.put<AsistenciaPersonalAPI>(`/personal/asistencia/${id}`, data),
  desempeno: (params?: { fecha_inicio?: string; fecha_fin?: string; id_mecanico?: number }) =>
    api.get<ReporteDesempenoResp>('/personal/reportes/desempeno', { params }),
};

/* ── Contactos de proveedores — en la nube ── */
export const proveedorContactosApi = {
  list:   ()            => api.get('/proveedores-contactos'),
  guardar:(codigo: string, data: Record<string, unknown>) =>
    api.put(`/proveedores-contactos/${encodeURIComponent(codigo)}`, data),
  borrar: (codigo: string) =>
    api.delete(`/proveedores-contactos/${encodeURIComponent(codigo)}`),
};

/* ── Parámetros de Mantenimiento (Intervalos configurables) ── */
export const mantenimientoParametrosApi = {
  list:   () => api.get('/mantenimiento-parametros'),
  update: (id: number, intervaloKm: number) => 
    api.put(`/mantenimiento-parametros/${id}`, { intervaloKm }),
};

/* ── Health check (keep-alive para Render) ──────────────────────────────────
   GET /tipos es un endpoint liviano con CORS. El actuator (/actuator/health)
   está fuera del filtro CORS de Spring Security → CORS error en el navegador.
   ──────────────────────────────────────────────────────────────────────────── */
export const healthApi = {
  /** /health es público (sin auth) → no provoca 401 aunque el token esté vencido. */
  check: () => api.get('/health'),
  /** Ping con timeout largo — despierta Render si estaba dormido. */
  wake:  () => api.get('/health', { timeout: 65_000 }),
};

export const ofertaApi = {
  /** Envía una campaña de email a todos los usuarios de los roles indicados.
   *  roles: 2=CLIENTE, 3=MECANICO, 1=ADMIN — se pueden combinar. */
  enviar: (asunto: string, mensaje: string, roles: number[] = [2]) =>
    api.post('/ofertas/enviar', { asunto, mensaje, roles }),
  /** Envía a una lista explícita de correos (p.ej. filtrados por cilindraje). */
  enviarAEmails: (asunto: string, mensaje: string, correos: string[]) =>
    api.post('/ofertas/enviar-emails', { asunto, mensaje, correos }),
};

export interface AuditoriaOperacion {
  id_auditoria: number;
  fecha: string;
  id_usuario: number | null;
  accion: string;
  entidad: string;
  id_referencia: number | null;
  detalle: string;
  datos: Record<string, unknown> | null;
}

export const sistemaApi = {
  auditoria: (params?: { entidad?: string; accion?: string; id_usuario?: number; limit?: number }) =>
    api.get<AuditoriaOperacion[]>('/sistema/auditoria', { params }),
};

/* ── Upload con retry: despierta backend si está dormido y reintenta ─────────
   Render free duerme tras 15 min. Primera petición tarda 30-50s.
   Estrategia: ping → upload con timeout 90s → reintenta 2 veces si falla.
   ──────────────────────────────────────────────────────────────────────────── */
export async function uploadWithRetry(
  endpoint: '/vehiculos/upload' | '/usuarios/upload' | '/productos/upload',
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt === 1) onProgress?.('Despertando servidor…');
      else onProgress?.(`Reintentando (${attempt}/3)…`);

      // Ping al backend en attempt 1 para despertarlo
      if (attempt === 1) {
        try { await healthApi.wake(); } catch { /* puede fallar la primera vez */ }
      }

      onProgress?.('Subiendo imagen…');
      const token = localStorage.getItem('gm_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: fd
      });
      if (!res.ok) {
        throw new Error(`Upload falló con status: ${res.status}`);
      }
      const data = await res.json();
      return data.url;

    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 3_000));
    }
  }
  throw new Error('Upload falló después de 3 intentos');
}

