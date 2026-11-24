import { api } from './api';
import type { RegistroDetalle, Producto } from '../types';
export interface Recepcion {
  id_recepcion: number; completa: boolean; faltantes: string[]; kilometraje: number; nivel_combustible: string;
  danos_previos?: string; observaciones?: string; firma_cliente?: string;
  foto_frente?: string; foto_posterior?: string; foto_lateral_izq?: string; foto_lateral_der?: string;
}
export interface ItemPresupuesto { id_item: number; descripcion: string; tipo_item: string; cantidad: number; precio_unitario: number; subtotal: number; estado_aprobacion: string; id_producto?: number }
export interface Presupuesto { id_presupuesto: number; numero_presupuesto: string; estado: string; total_presupuestado: number; total_aprobado: number; observaciones?: string; items: ItemPresupuesto[] }
export interface Diagnostico { id_diagnostico: number; fecha: string; origen_diagnostico: string; observaciones_generales?: string; escaner_utilizado?: string; codigos_dtc?: string; descripcion_escaner?: string; fotos_problemas?: string[] | string; detalles?: { parte: string; estado: string; observacion?: string }[] }
export interface Reserva { id_reserva: number; id_producto: number; cantidad: number; estado: string; producto_nombre?: string; nombre_producto?: string }
export interface Bitacora { id_bitacora: number; fecha: string; descripcion_trabajo: string; horas_trabajadas: number; fotos_evidencia?: string }
export interface Dano { id_dano: number; descripcion: string; costo_estimado: number; estado: string; fotos_evidencia?: string }
export interface Control { id_control: number; paso_inspeccion: boolean; fecha: string; observaciones?: string; motivo_devolucion?: string }
export interface Flujo { registro: RegistroDetalle & { flujo_integrado?: boolean }; recepcion: Recepcion | null; diagnosticos: Diagnostico[]; presupuestos: Presupuesto[]; reservas: Reserva[]; bitacoras: Bitacora[]; danos: Dano[]; controles: Control[]; entrega: { persona_recibe: string; fecha_entrega: string; firma_cliente_entrega?: string } | null }
export const tallerApi = {
  flujo: (id: number) => api.get<Flujo>(`/registros/${id}/flujo`),
  recepcion: (data: unknown) => api.post('/recepciones', data),
  actualizarRecepcion: (id: number, data: unknown) => api.put(`/recepciones/${id}`, data),
  diagnostico: (data: unknown) => api.post('/diagnosticos', data),
  presupuesto: (data: unknown) => api.post('/presupuestos', data),
  enviar: (id: number) => api.post(`/presupuestos/${id}/enviar`),
  decidir: (id: number, data: unknown) => api.post(`/presupuestos/${id}/decision`, data),
  asignar: (id: number, mecanico: number) => api.post(`/reservas/asignar-mecanico/${id}`, { id_mecanico: mecanico }),
  reservar: (id: number) => api.post(`/reservas/presupuesto/${id}`),
  retirar: (id: number) => api.post(`/reservas/${id}/retirar`),
  liberar: (id: number) => api.post(`/reservas/${id}/liberar`, { motivo: 'Ajuste autorizado por el administrador' }),
  bitacora: (data: unknown) => api.post('/reparaciones/bitacora', data),
  dano: (data: unknown) => api.post('/reparaciones/danos-adicionales', data),
  decidirDano: (id: number, aprobado: boolean) => api.post(`/reparaciones/danos-adicionales/${id}/decision`, { aprobado }),
  calidad: (data: unknown) => api.post('/reparaciones/control-calidad', data),
  prepararCobro: (data: unknown) => api.post('/notas-venta/preparar', data),
  entregar: (data: unknown) => api.post('/entregas', data),
};
export interface Herramienta { id_herramienta: number; codigo: string; nombre: string; marca?: string; numero_serie?: string; estado: string; ubicacion?: string; fecha_adquisicion?: string; observaciones?: string }
export const herramientasApi = {
  list: () => api.get<Herramienta[]>('/herramientas'),
  create: (data: unknown) => api.post('/herramientas', data),
  update: (id: number, data: unknown) => api.put(`/herramientas/${id}`, data),
};
export interface Movimiento { id_movimiento: number; fecha: string; tipo_movimiento: string; producto_nombre: string; cantidad: number; stock_anterior: number; stock_nuevo: number; id_registro?: number; motivo?: string; nombre_usuario?: string }
export const kardexApi = {
  buscar: (codigo: string) => api.get<{ encontrado: boolean; producto?: Producto }>(`/kardex/escanear/${encodeURIComponent(codigo)}`),
  mover: (entrada: boolean, data: unknown) => api.post(`/kardex/${entrada ? 'entrada' : 'salida'}`, data),
  movimientos: () => api.get<Movimiento[]>('/kardex/movimientos?limit=200'),
};
export async function subirEvidencia(file: File, endpoint: string) {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona una imagen');
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen debe pesar máximo 5 MB');
  const data = new FormData(); data.append('archivo', file);
  const result = await api.post<{ url: string }>(endpoint, data, { headers: { 'Content-Type': 'multipart/form-data' } });
  if (!result.data.url) throw new Error('No se recibió la imagen guardada');
  return result.data.url.startsWith('/') ? new URL(result.data.url, new URL(api.defaults.baseURL ?? '/api', window.location.origin)).href : result.data.url;
}
