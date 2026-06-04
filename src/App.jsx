import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { setToken } from './lib/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    // Restore existing session on launch
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
      setSession(session ?? null);
    });

    // Keep session in sync
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setToken(session.access_token);
      else setToken(null);
      setSession(session ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  function handleLogin(newSession) {
    setToken(newSession.access_token);
    setSession(newSession);
  }

  function handleSignOut() {
    supabase.auth.signOut();
    setToken(null);
    setSession(null);
  }

  // Still checking for existing session
  if (session === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAFAF8]">
        <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-[#C9A96E] animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard session={session} onSignOut={handleSignOut} />;
}
