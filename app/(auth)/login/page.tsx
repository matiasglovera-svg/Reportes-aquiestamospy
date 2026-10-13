'use client';

import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useState } from 'react';
import { Logo, Ondas } from '@/components/marca';
import { Boton, Destellos, Tarjeta } from '@/components/ui';

export default function Login() {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user, password }) });
      if (r.ok) {
        // Solo se vuelve a rutas internas de la app.
        const next = new URLSearchParams(window.location.search).get('next');
        window.location.href = next && /^\/(?!\/)/.test(next) ? next : '/resumen';
        return;
      }
      setError(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? 'No se pudo iniciar sesión.');
    } catch {
      setError('No se pudo conectar. Revisá tu conexión.');
    }
    setEnviando(false);
  };

  const campo = 'h-11 w-full rounded-xl border border-border bg-surface px-3 text-base text-text placeholder:text-muted';
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <Ondas className="pointer-events-none absolute inset-x-0 bottom-0 h-[38vh] w-full" />
      <Destellos className="pointer-events-none absolute right-[8%] top-[10%] h-24 w-36 opacity-80" />
      <Tarjeta className="relative w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-1 text-center">
          <Logo alto={72} />
          <h1 className="font-display text-2xl font-extrabold">Reportes</h1>
          <p className="text-sm text-muted">Ingresá con tu usuario y contraseña.</p>
        </div>
        <form onSubmit={entrar} className="space-y-4">
          <label className="block text-sm font-medium">
            Usuario
            <input className={`${campo} mt-1`} name="user" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={user} onChange={(e) => setUser(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Contraseña
            <span className="relative mt-1 block">
              <input className={`${campo} pr-11`} name="password" type={ver ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={ver} className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text">
                {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-alerta-soft px-3 py-2 text-sm text-alerta">
              {error}
            </p>
          )}
          <Boton type="submit" disabled={enviando} className="h-11 w-full text-base">
            <LogIn className="h-4 w-4" /> {enviando ? 'Ingresando…' : 'Ingresar'}
          </Boton>
        </form>
      </Tarjeta>
    </main>
  );
}
