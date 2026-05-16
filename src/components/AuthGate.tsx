import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import LoginScreen from "./LoginScreen";

const TEAM_PIN = (import.meta.env.VITE_TEAM_PIN as string | undefined)?.trim();
const GOD_PIN = (import.meta.env.VITE_GOD_PIN as string | undefined)?.trim();
const PIN_SESSION_KEY = "bug-tracker-auth";
const PIN_ROLE_SESSION_KEY = "bug-tracker-auth-role";
type PinAccessLevel = "team" | "god";

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [pinUnlocked, setPinUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    const role = sessionStorage.getItem(PIN_ROLE_SESSION_KEY);
    return (
      sessionStorage.getItem(PIN_SESSION_KEY) === "true" ||
      role === "team" ||
      role === "god"
    );
  });

  useEffect(() => {
    const handlePinLock = () => {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(PIN_SESSION_KEY);
        sessionStorage.removeItem(PIN_ROLE_SESSION_KEY);
      }
      setPinUnlocked(false);
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
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PIN_SESSION_KEY, "true");
      sessionStorage.setItem(PIN_ROLE_SESSION_KEY, accessLevel);
    }
    clearAuthError();
    setPinUnlocked(true);
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

  if (loading) {
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
      teamPin={TEAM_PIN}
      godPin={GOD_PIN}
      onPinUnlock={handlePinUnlock}
      error={authError}
      allowedEmailDomain={allowedEmailDomain}
    />
  );
}
