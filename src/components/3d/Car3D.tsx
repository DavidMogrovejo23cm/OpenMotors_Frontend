import { Car } from 'lucide-react';

export default function Car3D({ className = '' }: { className?: string }) {
  return (
    <div className={className} role="img" aria-label="OpenMotors — Carro"
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse, #361218, #060608 70%)' }}>
      <Car size={240} strokeWidth={1} color="#E11428" style={{ maxWidth: '80%', filter: 'drop-shadow(0 16px 24px rgba(225,20,40,0.3))' }} />
    </div>
  );
}
