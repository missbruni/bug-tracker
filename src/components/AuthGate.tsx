import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { type PinAccessLevel } from "../lib/teamScope";
import { cachePinRole, fetchPinSession, logoutPinSession } from "../lib/pinAuth";
import LoginScreen from "./LoginScreen";

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinConfigured, setPinConfigured] = useState(true);
  const [pinChecking, setPinChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const refreshPinSession = async () => {
      setPinChecking(true);
      try {
        const session = await fetchPinSession();
        if (cancelled) return;
        setPinUnlocked(session.authenticated);
        setPinConfigured(session.configured);
        cachePinRole(session.authenticated ? session.role : null);
      } catch {
        if (cancelled) return;
        setPinUnlocked(false);
        setPinConfigured(false);
        cachePinRole(null);
      } finally {
        if (!cancelled) setPinChecking(false);
      }
    };

    void refreshPinSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handlePinLock = () => {
      void logoutPinSession();
      cachePinRole(null);
      setPinUnlocked(false);
      setPinChecking(false);
    };

    window.addEventListener("pin-lock", handlePinLock);
    return () => window.removeEventListener("pin-lock", handlePinLock);
  }, []);

  const {
    loading,
    session,
    authError,
    allowedEmailDomain,
    clearAuthError,
  } = useAuth();

  const handlePinUnlock = (accessLevel: PinAccessLevel) => {
    cachePinRole(accessLevel);
    window.dispatchEvent(
      new CustomEvent("pin-unlocked", { detail: { role: accessLevel } }),
    );
    clearAuthError();
    setPinUnlocked(true);
    setPinChecking(false);
  };

  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-950">
        <div className="max-w-md rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-6 text-center">
          <h2 className="text-lg font-bold text-red-800 dark:text-red-400 mb-2">
            Supabase not configured
          </h2>
          <p className="text-sm text-red-700 dark:text-red-300">
            Create a <code className="bg-red-100 dark:bg-red-900/50 px-1 rounded">.env</code> file with:
          </p>
          <pre className="mt-3 rounded-md bg-red-100 dark:bg-red-900/40 p-3 text-left text-xs text-red-800 dark:text-red-300">{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}</pre>
        </div>
      </div>
    );
  }

  if (pinUnlocked || session) {
    return <>{children}</>;
  }

  if (loading || pinChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-950">
        <div className="text-sm text-slate-500 dark:text-gray-500">
          Checking authentication...
        </div>
      </div>
    );
  }

  return (
    <LoginScreen
      onPinUnlock={handlePinUnlock}
      pinConfigured={pinConfigured}
      error={authError}
      allowedEmailDomain={allowedEmailDomain}
    />
  );
}
