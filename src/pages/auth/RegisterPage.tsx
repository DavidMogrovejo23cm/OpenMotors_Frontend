import { Link } from 'react-router-dom';

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6 py-12">
      <h1>Solicita tu cuenta</h1>
      <p className="text-[var(--om-muted)]">
        El personal de Open Motors registra tu cuenta y te entrega la contraseña temporal.
      </p>
      <Link to="/login" className="self-start font-medium text-[var(--om-link)]">
        Volver al inicio de sesión
      </Link>
    </main>
  );
}
