/* ─────────────────────────────────────────────
   OpenMotors — Modal Component
   Static, centered, full-screen portal backdrop,
   background scroll freeze.
   ───────────────────────────────────────────── */

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { cn } from '../../lib/utils';
import { useTheme } from '../../lib/theme';

interface ModalProps {
  open:         boolean;
  onClose:      () => void;
  title?:       string;
  description?: string;
  children:     ReactNode;
  size?:        'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  footer?:      ReactNode;
  portal?:      boolean;
}

const sizes: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  footer,
  portal = true,
}: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef    = useRef<HTMLDivElement>(null);
  const [theme]     = useTheme();
  const isDark      = theme === 'dark';

  useEffect(() => {
    if (!open) return;

    // 1. Bloquear scroll del fondo (body y contenedor principal)
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.classList.add('modal-open');

    const mainEl = document.querySelector('main');
    const prevMainOverflow = mainEl ? mainEl.style.overflow : '';
    if (mainEl) {
      mainEl.style.overflow = 'hidden';
    }

    // 2. Animación estática limpia y sutil
    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    if (backdrop && panel) {
      gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.16, overwrite: true });
      gsap.fromTo(panel,
        { opacity: 0, scale: 0.98 },
        { opacity: 1, scale: 1, duration: 0.18, ease: 'power2.out', overwrite: true },
      );
    }

    // 3. Prevenir scroll de touch/wheel sobre el backdrop
    const handleTouchMove = (e: TouchEvent) => {
      if (backdropRef.current && !panelRef.current?.contains(e.target as Node)) {
        e.preventDefault();
      }
    };
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.body.classList.remove('modal-open');
      if (mainEl) {
        mainEl.style.overflow = prevMainOverflow;
      }
      window.removeEventListener('touchmove', handleTouchMove);
      if (backdrop) gsap.killTweensOf(backdrop);
      if (panel) gsap.killTweensOf(panel);
    };
  }, [open]);

  const handleClose = () => {
    if (!backdropRef.current || !panelRef.current) { onClose(); return; }
    gsap.to(panelRef.current,    { opacity: 0, scale: 0.98, duration: 0.12, overwrite: true });
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.15, overwrite: true, onComplete: onClose });
  };

  if (!open) return null;

  const dialog = (
    <div
      ref={backdropRef}
      className="fixed inset-0 flex items-center justify-center p-4 z-[9999] select-none"
      style={{
        background: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.42)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={(e) => e.target === backdropRef.current && handleClose()}
      onWheel={(e) => {
        if (e.target === backdropRef.current) e.preventDefault();
      }}
      onKeyDown={(e) => { if (e.key === "Escape") handleClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={cn('relative w-full rounded-2xl flex flex-col max-h-[90vh] shadow-2xl select-text overflow-hidden', sizes[size] ?? 'max-w-md')}
        style={{
          background: isDark ? '#13141B' : '#FFFFFF',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E5E7EB',
          boxShadow: isDark
            ? '0 25px 60px -15px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)'
            : '0 20px 35px -10px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Header con título perfectamente centrado */}
        {title && (
          <div
            className="relative px-6 py-4 flex items-center justify-center flex-none"
            style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #F1F3F5' }}
          >
            <div className="text-center px-8">
              <h2
                id="modal-title"
                className="font-serif text-base sm:text-[17px] font-bold text-center tracking-tight"
                style={{ color: isDark ? 'rgba(255,255,255,0.95)' : '#15151B' }}
              >
                {title}
              </h2>
              {description && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-normal">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              aria-label="Cerrar modal"
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 dark-scroll">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="px-6 py-3.5 flex items-center justify-center sm:justify-end gap-2.5 flex-none bg-slate-50/50 dark:bg-white/[0.02]"
            style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #F1F3F5' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return portal ? createPortal(dialog, document.body) : dialog;
}
