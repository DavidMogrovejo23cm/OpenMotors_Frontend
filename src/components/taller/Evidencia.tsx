import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { subirEvidencia } from '../../lib/tallerApi';
import { getErrorMsg } from '../../lib/utils';
import Button from '../ui/Button';

export function Foto({ label, value, onChange, endpoint, disabled = false }: { label: string; value?: string; onChange: (value: string) => void; endpoint: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <label className="block space-y-2 text-sm">{label}
    {value && <img className="h-24 w-40 rounded-lg object-cover border" src={value} alt={label} />}
    <input type="file" accept="image/*" disabled={busy || disabled} className="block w-full text-xs" onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      setBusy(true); setError('');
      try { onChange(await subirEvidencia(file, endpoint)); } catch (err) { setError(getErrorMsg(err)); } finally { setBusy(false); }
      e.target.value = '';
    }} />
    {busy && <span role="status">Subiendo imagen…</span>}{error && <span className="text-red-500 block" role="alert">{error}</span>}
  </label>;
}
export function Firma({ value, onChange, disabled = false }: { value?: string; onChange: (value: string) => void; disabled?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null), drawing = useRef(false), signed = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const point = (e: PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return [(e.clientX-r.left)*360/r.width, (e.clientY-r.top)*110/r.height]; };
  return <div className="space-y-2"><p className="text-sm font-semibold">Firma del cliente</p>
    <canvas ref={canvas} width={360} height={110} aria-label="Dibuja la firma con el dedo o el ratón" className="border rounded-lg bg-white max-w-full touch-none"
      onPointerDown={e => { if (disabled || busy) return; drawing.current=true; e.currentTarget.setPointerCapture(e.pointerId); const ctx=canvas.current!.getContext('2d')!; ctx.beginPath(); const [x,y]=point(e); ctx.moveTo(x,y); }}
      onPointerMove={e => { if (!drawing.current) return; const ctx=canvas.current!.getContext('2d')!; ctx.lineWidth=2; ctx.strokeStyle='#111827'; const [x,y]=point(e); ctx.lineTo(x,y); ctx.stroke(); signed.current=true; }}
      onPointerUp={() => { drawing.current=false; }} onPointerCancel={() => { drawing.current=false; }} />
    <div className="flex gap-2"><Button type="button" variant="secondary" disabled={busy || disabled} onClick={() => { canvas.current?.getContext('2d')?.clearRect(0,0,360,110); signed.current=false; onChange(''); }}>Limpiar</Button>
    <Button type="button" disabled={busy || disabled} loading={busy} onClick={async () => {
      if (!signed.current) { setError('Dibuja la firma antes de guardarla'); return; }
      setBusy(true); setError('');
      try { const blob=await new Promise<Blob|null>(resolve => canvas.current!.toBlob(resolve,'image/png')); if (!blob) throw new Error('No se pudo guardar la firma'); onChange(await subirEvidencia(new File([blob],'firma.png',{type:'image/png'}), '/recepciones/fotos?tipo=firma')); }
      catch(err) { setError(getErrorMsg(err)); } finally { setBusy(false); }
    }}>Guardar firma</Button></div>
    {value && <p className="text-sm text-emerald-600">Firma guardada</p>}{error && <p role="alert" className="text-red-500">{error}</p>}
  </div>;
}
