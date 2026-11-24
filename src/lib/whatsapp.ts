/* ─────────────────────────────────────────────
   OpenMotors — Mensajería Manual por WhatsApp
   (RF-52 / HU-63 modalidad manual definida por el taller)
   ───────────────────────────────────────────── */

import { ESTADO_REGISTRO, fmtDate, fmtMoney } from './utils.ts';

export interface OrderWhatsappInfo {
  id_registro: number;
  placa: string;
  nombre_cliente?: string;
  cliente_telefono?: string | null;
  marca_vehiculo?: string;
  modelo_vehiculo?: string;
  estado: number;
  fecha_entrega_estimada?: string | null;
  costo_total?: number;
  saldo_pendiente?: number;
}

/** Normaliza teléfonos locales de Ecuador (09XXXXXXXX -> 5939XXXXXXXX) o conserva prefijo internacional. */
export function formatPhoneForWhatsapp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 9) return null;
  if (digits.startsWith('593') && digits.length >= 11) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '593' + digits.slice(1);
  if (digits.length === 9 && digits.startsWith('9')) return '593' + digits;
  return digits.length >= 10 ? digits : null;
}

export function buildOrderStatusMessage(order: OrderWhatsappInfo): string {
  const cliente = (order.nombre_cliente || 'estimado cliente').trim();
  const vehiculo = [order.marca_vehiculo, order.modelo_vehiculo].filter(Boolean).join(' ').trim();
  const estLabel = ESTADO_REGISTRO[order.estado]?.label ?? 'En revisión';
  const saldo = Number(order.saldo_pendiente ?? order.costo_total ?? 0);

  const partes = [
    `Hola ${cliente}, te saludamos de *OpenMotors*.`,
    `Tu vehículo${vehiculo ? ` ${vehiculo}` : ''} con placa *${order.placa}* (Orden #${order.id_registro}) se encuentra en estado: *${estLabel}*.`,
  ];

  if (order.fecha_entrega_estimada && order.estado < 2) {
    partes.push(`Entrega estimada: ${fmtDate(order.fecha_entrega_estimada)}.`);
  }
  if (order.estado === 2 && saldo > 0) {
    partes.push(`El trabajo ha finalizado. Saldo pendiente por cancelar: ${fmtMoney(saldo)}.`);
  } else if (order.estado === 2 && saldo <= 0) {
    partes.push('Tu vehículo ya está listo para ser retirado.');
  }
  partes.push('Puedes revisar el detalle completo ingresando con tu usuario al portal de OpenMotors.');
  return partes.join(' ');
}

export function buildOrderWhatsappUrl(
  order: OrderWhatsappInfo,
  fallbackPhone?: string | null,
): string | null {
  const phone = formatPhoneForWhatsapp(order.cliente_telefono ?? fallbackPhone);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildOrderStatusMessage(order))}`;
}
