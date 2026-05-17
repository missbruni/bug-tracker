import { LogIn } from "lucide-react";
import PinGate from "./PinGate";
import { type PinAccessLevel } from "../lib/teamScope";

interface LoginScreenProps {
  onPinUnlock: (accessLevel: PinAccessLevel) => void;
  pinConfigured: boolean;
  error: string | null;
  allowedEmailDomain: string;
}

export default function LoginScreen({
  onPinUnlock,
  pinConfigured,
  error,
  allowedEmailDomain,
}: LoginScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-lg">
        <h1
          className="text-lg font-bold text-slate-900 dark:text-gray-100 mb-1"
          style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 14 }}
        >
          Mushi
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-4">
          Sign in with your company Microsoft account to continue.
        </p>
        <p className="mt-2 text-xs text-slate-400 dark:text-gray-500">
          Allowed domain: <span className="font-semibold">@{allowedEmailDomain}</span>
        </p>

        <button
          type="button"
          disabled
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-400 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed transition-colors cursor-not-allowed"
        >
          <LogIn size={16} />
          Sign in with Microsoft (Coming Soon)
        </button>

        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Microsoft login is temporarily disabled while tenant approval is pending.
        </p>

        {error && (
          <p role="alert" className="mt-3 text-xs text-red-500">
            {error}
          </p>
        )}

        <PinGate pinConfigured={pinConfigured} onUnlock={onPinUnlock} />
      </div>
    </div>
  );
}
