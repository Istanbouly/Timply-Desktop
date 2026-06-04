import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Calendar, Users, BarChart3, Clock, AlertCircle } from 'lucide-react';

const BUSINESS_ROLES = ['timply_client', 'timply_staff'];

const features = [
  { icon: Calendar,  text: 'Manage all your spa bookings in one place' },
  { icon: Users,     text: 'Organize your team and their schedules' },
  { icon: BarChart3, text: 'Track revenue and business growth' },
  { icon: Clock,     text: 'Accept bookings 24/7, automatically' },
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInErr) {
        setError('Invalid email or password.');
        return;
      }

      const role = data.user?.app_metadata?.role;

      if (!BUSINESS_ROLES.includes(role)) {
        await supabase.auth.signOut();
        setError('This app is for spa business accounts only. Customer accounts cannot sign in here.');
        return;
      }

      onLogin(data.session);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">

      {/* Left panel — spa image + features */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/spa-lobby-top.jpg)' }}
        />
        <div className="absolute inset-0 bg-stone-950/65" />

        {/* Logo */}
        <div className="relative z-10">
          <img src="/timply-logo-white.svg" alt="Timply" className="h-8 w-auto" />
        </div>

        {/* Headline + features */}
        <div className="relative z-10">
          <h1 className="font-playfair text-3xl font-bold text-white mb-3 leading-snug">
            Your business,<br />fully in control.
          </h1>
          <p className="text-white/60 text-sm mb-10 leading-relaxed">
            Everything you need to run your bookings, team, and clients — right from your desktop.
          </p>
          <ul className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-[#C9A96E]" />
                </div>
                <span className="text-sm text-white/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/30 text-xs">© {new Date().getFullYear()} Timply. All rights reserved.</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-[#FAFAF8] p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <img src="/timply-logo.svg" alt="Timply" className="h-7 w-auto mx-auto" />
          </div>

          <div className="mb-8">
            <h2 className="font-playfair text-2xl font-bold text-stone-900">Welcome back</h2>
            <p className="text-sm text-stone-500 mt-1">Sign in to your business portal</p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm bg-white text-stone-800 placeholder:text-stone-400 outline-none transition focus:border-[#C9A96E] focus:ring-2 focus:ring-[#C9A96E]/10"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 border border-stone-200 rounded-lg text-sm bg-white text-stone-800 placeholder:text-stone-400 outline-none transition focus:border-[#C9A96E] focus:ring-2 focus:ring-[#C9A96E]/10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-stone-400 hover:text-stone-600 transition-colors"
                    style={{ WebkitAppRegion: 'no-drag' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-stone-900 hover:bg-stone-800 text-white transition-colors disabled:opacity-50 mt-1"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>

            </form>
          </div>

          <p className="text-center text-xs text-stone-400 mt-6">
            Powered by <span className="text-stone-500 font-medium">Timply</span>
          </p>
        </div>
      </div>

    </div>
  );
}
