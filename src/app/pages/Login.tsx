import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Loader2, Phone } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { clearSupabaseBrowserStorageOnly } from '@/lib/clearSupabaseLocalStorage';

/** Sesión viva en cookies Next (tras handoff); localStorage `sb-*` del portal suele estar vacío. */
function hasServerSession(res: Response): boolean {
  if (res.status === 401) return false;
  return res.ok || res.status === 404;
}

function sameOriginHref(candidate: string): string | null {
  try {
    const u = new URL(candidate, window.location.origin);
    if (u.origin === window.location.origin) return u.href;
  } catch {
    /* noop */
  }
  return null;
}

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Comprueba cookies SSR antes de mostrar el formulario. */
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const res = await fetch('/api/agents/me', { credentials: 'include', cache: 'no-store' });
        if (cancelled) return;
        if (!hasServerSession(res)) {
          setBootstrapping(false);
          return;
        }
        const postLoginRedirect = searchParams.get('postLoginRedirect');
        if (postLoginRedirect) {
          const href = sameOriginHref(postLoginRedirect);
          if (href) {
            window.location.replace(href);
            return;
          }
        }
        navigate('/dashboard', { replace: true });
      } catch {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: signError } = await supabase.auth.signInWithPassword({ email, password });

      if (signError) {
        setError(signError.message);
        return;
      }

      const session = data.session;
      if (!session) {
        setError('No se obtuvo sesión. Revisa el usuario en Supabase Auth.');
        return;
      }

      const postLoginRedirect = searchParams.get('postLoginRedirect');

      /** Origen donde vive Next (`/api/token`, cookies SSR). Mismo host en despliegue único; distinto si legacy. */
      let handoffOrigin: string;
      if (postLoginRedirect) {
        try {
          handoffOrigin = new URL(postLoginRedirect).origin;
        } catch {
          setError('La URL de retorno no es válida.');
          return;
        }
      } else {
        handoffOrigin = window.location.origin;
      }

      let handoffRes: Response;
      try {
        handoffRes = await fetch(`${handoffOrigin}/api/auth/handoff`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        });
      } catch (handoffErr) {
        const originPortal = typeof window !== 'undefined' ? window.location.origin : '';
        const msg =
          handoffErr instanceof Error && handoffErr.message === 'Failed to fetch'
            ? `No se pudo contactar con Next (handoff). Suele ser CORS: en Vercel, en AUTH_HANDOFF_ALLOWED_ORIGIN incluye el origin del portal (${originPortal}).`
            : handoffErr instanceof Error
              ? handoffErr.message
              : 'Error de red al enlazar sesión con Next.';
        setError(msg);
        return;
      }

      if (!handoffRes.ok) {
        const j = (await handoffRes.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? `No se pudo enlazar la sesión con la app Next (HTTP ${handoffRes.status}).`);
        return;
      }

      /** Cookies de Next ya tienen la sesión; limpiar solo el almacenamiento local del portal (sin revocar tokens en Supabase). */
      clearSupabaseBrowserStorageOnly();

      if (postLoginRedirect) {
        window.location.href = postLoginRedirect;
        return;
      }

      navigate('/dashboard');
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(
        m === 'Failed to fetch'
          ? 'No se pudo conectar con Supabase. Revisa VITE_SUPABASE_URL en el build de Vercel y que el proyecto Supabase esté activo.'
          : m
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" aria-hidden />
          <p className="text-sm">Comprobando sesión…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Phone className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-semibold text-white">AI Contact Experience</span>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white mb-6">Gestiona tus llamadas con inteligencia artificial</h1>
            <p className="text-lg text-slate-300">
              Plataforma integral para centros de llamadas que optimiza la experiencia del cliente con tecnología avanzada
              de comunicación.
            </p>
          </div>
        </div>

        <div className="text-sm text-slate-400">© 2026 AI Contact Experience. Todos los derechos reservados.</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md p-8">
          <div className="mb-8">
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Phone className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold">AI Contact Experience</span>
            </div>

            <h2 className="text-2xl font-semibold mb-2">Iniciar Sesión</h2>
            <p className="text-muted-foreground">Ingresa tus credenciales (Supabase Auth)</p>
          </div>

          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <Button type="button" variant="link" className="px-0 font-normal text-sm">
                  ¿Olvidaste tu contraseña?
                </Button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            ¿No tienes una cuenta?{' '}
            <Button type="button" variant="link" className="px-1 font-normal">
              Solicitar acceso
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
