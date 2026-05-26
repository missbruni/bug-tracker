import { type ReactNode } from "react"
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import LoginScreen from "./LoginScreen";

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const {
    loading,
    session,
    authError,
    allowedEmailDomain,
    signInWithMicrosoft,
    signInWithEmail,
  } = useAuth();

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

  if (session) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-950">
        <div className="text-sm text-slate-500 dark:text-gray-500">
          Warming up Mushi...
        </div>
      </div>
    );
  }

  return (
    <LoginScreen
      onMicrosoftSignIn={signInWithMicrosoft}
      onEmailSignIn={signInWithEmail}
      error={authError}
      allowedEmailDomain={allowedEmailDomain}
    />
  );
}
