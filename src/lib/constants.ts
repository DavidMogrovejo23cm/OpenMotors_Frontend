/* ─────────────────────────────────────────────
   OPEN MOTORS — Datos del taller automotriz (única fuente de verdad)
   Alineado con https://openmotor.vercel.app/
   ───────────────────────────────────────────── */

export const WORKSHOP_CONTACT = {
  /** Nombre comercial (display) */
  nombre:        'Open Motors',
  /** Razón social (para comprobantes) */
  razonSocial:   'OPEN MOTORS TALLER AUTOMOTRIZ',
  subtitulo:     'Taller Especializado en Servicio Automotriz',
  direccion:     'Manuel Arturo Cisneros',
  ciudad:        'Cuenca',
  provincia:     'Azuay',
  pais:          'Ecuador',
  /** Ciudad completa para encabezados */
  ciudadCompleta:'Cuenca - Azuay - Ecuador',
  telefono:      '+593 989 836 251',
  /** Solo dígitos, formato internacional (para enlaces wa.me) */
  whatsapp:      '593989836251',
  /** Número que RECIBE las solicitudes de cita por WhatsApp (número principal del taller). */
  whatsappCitas: '593989836251',
  /** Número de soporte de la app */
  whatsappSoporte: '593989836251',
  /** Teléfono de soporte formateado para display */
  telefonoSoporte: '0989 836 251',
  /** Correo general de contacto */
  email:         'info@openmotor.com',
  emailFacturacion: 'info@openmotor.com',
  emailPrivacidad:  'info@openmotor.com',
  emailLegal:       'info@openmotor.com',
  web:           'openmotor.vercel.app',
  webUrl:        'https://openmotor.vercel.app',
  facebookUrl:   'https://www.facebook.com/share/1auYhp2uDr/',
  horario:       'Lun–Sáb 8:00–18:00',
} as const;

/** Enlace directo a WhatsApp con mensaje opcional */
export function whatsappLink(mensaje = ''): string {
  const base = `https://wa.me/${WORKSHOP_CONTACT.whatsapp}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

/** Enlace de WhatsApp para AGENDAR CITA */
export function whatsappCitaLink(mensaje = ''): string {
  const base = `https://wa.me/${WORKSHOP_CONTACT.whatsappCitas}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
