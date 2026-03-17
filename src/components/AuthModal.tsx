import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Play } from 'lucide-react';

const BASE_URL: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  '';

export function AuthModal() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin 
        ? { email, password } 
        : { username, email, password };

      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      login(data.user, data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* Premium Glassmorphism Container */}
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-2xl px-8 py-10 relative">
        
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[80px]" />
        
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/30 mb-4">
            <Play className="h-8 w-8 text-white fill-white ml-1" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Vault</h2>
          <p className="text-white/50 text-sm">Your Isolated Music Sanctuary</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex w-full mb-8 rounded-lg bg-black/40 p-1 backdrop-blur-md">
          <button
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-all duration-300 ${
              isLogin 
                ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' 
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-all duration-300 ${
              !isLogin 
                ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' 
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70 uppercase tracking-wider ml-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/30 focus:border-cyan-500/50 focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all duration-300"
                placeholder="audiophile99"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-white/70 uppercase tracking-wider ml-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/30 focus:border-cyan-500/50 focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all duration-300"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-white/70 uppercase tracking-wider ml-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-white/30 focus:border-cyan-500/50 focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all duration-300"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 px-4 py-3 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 rounded-xl bg-cyan-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition-all hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading 
              ? 'Authenticating...' 
              : isLogin ? 'Sign In' : 'Create Account'
            }
          </button>
        </form>
      </div>
    </div>
  );
}
