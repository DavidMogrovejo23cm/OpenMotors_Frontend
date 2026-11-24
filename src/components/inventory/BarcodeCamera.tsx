import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { barcodeCameraError, startBarcodeScanner } from '../../lib/barcodeScanner';
import Button from '../ui/Button';

/** Se monta solo cuando el usuario pulsa Escanear; al cerrar se apaga la cámara. */
export default function BarcodeCamera({ onRead, onClose }: { onRead: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onRead, onClose });
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { callbacks.current = { onRead, onClose }; }, [onRead, onClose]);
  useEffect(() => {
    if (!video.current) return;
    let active = true;
    const scanner = startBarcodeScanner(video.current, code => {
      if (active) callbacks.current.onRead(code);
    }, e => { if (active) setError(barcodeCameraError(e)); });
    scanner.ready.then(() => { if (active) setReady(true); }).catch(e => { if (active) setError(barcodeCameraError(e)); });
    const closeHidden = () => { if (document.hidden) { scanner.stop(); callbacks.current.onClose(); } };
    document.addEventListener('visibilitychange', closeHidden);
    return () => { active = false; document.removeEventListener('visibilitychange', closeHidden); scanner.stop(); };
  }, [attempt]);
  return <section className="rounded-xl border p-4 space-y-3" aria-label="Escáner de código de barras">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold flex items-center gap-2"><Camera size={18} /> Cámara del teléfono</h2><Button type="button" variant="secondary" onClick={onClose}>Cerrar cámara</Button></div>
    <video ref={video} muted playsInline autoPlay className="w-full max-h-64 rounded-lg bg-black object-contain" aria-label="Vista de la cámara para leer la etiqueta" />
    {error ? <><p role="alert" className="text-red-500">{error}</p><Button type="button" variant="secondary" onClick={() => { setError(''); setReady(false); setAttempt(n => n + 1); }}>Reintentar cámara</Button></> : <p role="status" className="text-sm">{ready ? 'Apunta al código de barras de un solo producto. Mantén la etiqueta completa, enfocada y bien iluminada.' : 'Solicitando acceso a la cámara…'}</p>}
    <p className="text-xs opacity-70">EAN, UPC y Code 128/39, según el teléfono. La cámara se cierra al leer un código. Leer la etiqueta no cambia las existencias.</p>
  </section>;
}
