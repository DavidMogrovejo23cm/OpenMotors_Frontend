/* ─────────────────────────────────────────────
   OpenMotors — Tipos globales de TypeScript
   ───────────────────────────────────────────── */

export interface Usuario {
  permisos?:       string[];
  id_usuario:      number;
  nombre_completo: string;
  nombre_usuario:  string;
  correo:          string;
  pais:            string;
  ciudad:          string;
  descripcion:     string;
  ruta_imagen:     string | null;
  roles:           UsuarioRol[] | null;
  telefono?:       string | null;
  cedula?:         string | null;
  direccion?:      string | null;
  puntosBonus?:    number | null;
  codigoReferido?: string | null;
  activo?:         boolean;
}

export interface AuthResponse {
  token:     string;
  usuario:   Usuario;
}

export interface Rol {
  id_rol: number;
  nombre: string;
}

export interface UsuarioRol {
  idUsuario:          number;
  idRol:              number;
  estado:             number;   // 1 activo, 0 inactivo
  fechaCreacion:      string;
  fechaModificacion:  string | null;
  rol?:               { id_rol: number; nombre: string };
}

export interface Carro {
  id_vehiculo:           number;
  placa:             string;
  anio:              number;
  marca:             string;
  modelo:            string;
  nombre_vehiculo:       string | null;
  tipo_vehiculo:         string;
  kilometraje:       number;
  cilindraje:        number;
  id_usuario:        number;
  ruta_imagen_vehiculo: string | null;
}

export interface Categoria {
  id_categoria: number;
  nombre:       string;
  descripcion:  string;
}

export interface Producto {
  codigo_barras?: string;
  stock_minimo?: number;
  stock_reservado?: number;
  stock_disponible?: number;
  id_producto:         number;
  codigo_proveedor:    string;
  codigo_distribuidor?: string | null;
  codigo_personal:     string;
  nombre:              string;
  descripcion:         string;
  costo:               number;
  pvp:                 number;
  stock:               number;
  fecha_registro:      string;
  fecha_modificacion:  string;
  id_categoria:        number;
  ruta_imagenproductos:string | null;
}

export interface Tipo {
  id_tipo:                  number;
  nombre:                   string;
  descripcion:              string;
  concepto_manual:          string | null;
  concepto_cantidad:        number | null;
  concepto_precio_unitario: number | null;
}

export interface Factura {
  id_factura:   number;
  fecha_emision:string;
  fecha?:       string;
  id_usuario:   number;
  costo_total:  number;
  cliente_nombre?: string | null;
  cliente_cedula?: string | null;
  cliente_telefono?: string | null;
  cliente_correo?: string | null;
  cliente_direccion?: string | null;
  cliente_tipo?: string | null;
  origen_venta?: string | null;
}

export interface DetalleFactura {
  id_detalle?:        number;
  idDetalleFactura?:  number;
  cantidad:           number;
  id_factura?:        number;
  id_producto?:       number | null;
  idProducto?:        number | null;
  precioUnitario?:    number | null;
  subtotal:           number;
  descripcion:        string | null;
}

export interface Registro {
  id_registro:  number;
  fecha:        string;
  observaciones:string;
  estado:       number;   // 0 pendiente, 1 en proceso, 2 finalizada, 3 entregada
  id_factura:   number;
  id_encargado: number;
  id_cliente:   number;
  id_tipo:      number;
  id_vehiculo:      number;
  kilometraje:  number | null;
}

export interface RegistroDetalle {
  id_registro:      number;
  id_vehiculo?:         number;
  id_cliente?:      number;
  id_encargado?:    number;
  nombre_cliente:   string;
  cliente_cedula?:  string | null;
  cliente_telefono?: string | null;
  cliente_correo?:  string | null;
  cliente_direccion?: string | null;
  nombre_encargado?: string;
  marca_vehiculo:       string;
  modelo_vehiculo:      string;
  placa:            string;
  ruta_imagen_vehiculo: string | null;
  fecha:            string;
  fecha_entrega_estimada?: string | null;
  horas_estimadas?: number | null;
  fecha_completado?: string | null;
  fecha_entregado?: string | null;
  fecha_facturado?: string | null;
  descripcion:      string;
  tipo_servicio:    string;
  costo_total:      number;
  id_factura:       number;
  estado:           number;
  estado_pago?: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
  monto_pagado?: number;
  saldo_pendiente?: number;
  revision_estado?: boolean;
  flujo_integrado?: boolean;
  estado_legacy?: number | null;
  pagos?: { id_pago: number; monto: number; fecha: string; metodo: string }[];
  kilometraje:      number | null;
  observaciones?:   string | null;
  detalles?:        DetalleFactura[];
}

export interface Ruta {
  id_ruta:          number;
  id_usuario:       number;
  nombre_ruta:      string;
  descripcion:      string | null;
  origen_lat:       number;
  origen_lng:       number;
  destino_lat:      number;
  destino_lng:      number;
  distancia_km:     number | null;
  duracion_minutos: number | null;
}

/* ─── Gamificación ─── */
export interface PuntosResumen {
  total_ganados:   number;
  total_canjeados: number;
  disponibles:     number;
  nivel:           string;
}

export interface HistorialPuntos {
  fecha:       string;
  descripcion: string;
  puntos:      number;
  tipo:        'ganado' | 'canjeado';
}

/* ─── Combustible ─── */
export interface CargaCombustible {
  id:          number;
  id_vehiculo:     number;
  placa:       string;
  fecha:       string;
  litros:      number;
  costo_total: number;
  km_actual:   number;
  km_anterior: number;
  marca_aceite?: string;
  notas?:      string;
}

/* ─── Alertas Mantenimiento ─── */
export interface CarroAlerta {
  carro:             Carro;
  ownerName:        string;
  lastOilKm:        number | null;
  lastOilDate:      string | null;
  kmSinceOil:       number | null;
  threshold:        number;
  urgency:          'ok' | 'soon' | 'due' | 'overdue';
  pct:              number;
}

/* ─── Diagnóstico mecánico ─── */
export interface DetalleDiagnostico {
  id_detalle?:  number;
  parte:        string;   // MOTOR | TRANSMISION | FRENOS | LLANTAS | SUSPENSION | ELECTRICO | CARROCERIA | REFRIGERACION
  estado:       "BUENO" | "REGULAR" | "MALO" | "CRITICO" | 1 | 2 | 3;
  sistema?:     string;
  observacion?: string | null;
}

export interface DiagnosticoCarro {
  id_registro?: number | null;
  id_recepcion?: number | null;
  origen_diagnostico?: string;
  escaner_utilizado?: string | null;
  codigos_dtc?: string | null;
  descripcion_escaner?: string | null;
  id_diagnostico?:         number;
  id_vehiculo:                 number;
  id_mecanico:             number;
  fecha?:                  string;
  kilometraje_ingreso:     number;
  observaciones_generales?: string | null;
  detalles:                DetalleDiagnostico[];
}

/* ─── Estado de mantenimiento (calculado por el backend) ─── */
export interface EstadoMantenimiento {
  tipo:                string;
  descripcion:         string;
  intervaloKm:         number;
  kmActual:            number;
  proximoCambioKm:     number;
  kmRestante:          number;
  porcentajeDesgaste:  number;
  estado:              'OK' | 'PROXIMO' | 'VENCIDO';
}

/* ─── API generic wrapper ─── */
export interface ApiError {
  message: string;
  status:  number;
}

export type EstadoRegistro = 0 | 1 | 2 | 3 | 4;
