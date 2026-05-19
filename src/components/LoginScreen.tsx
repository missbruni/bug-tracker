import { LogIn } from "lucide-react";
import PinGate from "./PinGate";
import { type PinAccessLevel } from "../lib/teamScope";

interface LoginScreenProps {
  onMicrosoftSignIn: () => Promise<void>;
  onPinUnlock: (accessLevel: PinAccessLevel) => void;
  microsoftLoginEnabled: boolean;
  pinConfigured: boolean;
  error: string | null;
  allowedEmailDomain: string;
}

export default function LoginScreen({
  onMicrosoftSignIn,
  onPinUnlock,
  microsoftLoginEnabled,
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
          disabled={!microsoftLoginEnabled}
          aria-disabled={!microsoftLoginEnabled}
          onClick={() => {
            if (!microsoftLoginEnabled) return;
            void onMicrosoftSignIn();
          }}
          className={`mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-colors ${
            microsoftLoginEnabled
              ? "bg-blue-500 text-white dark:text-mushi-bg hover:bg-blue-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:focus-visible:ring-blue-500/30"
              : "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:cursor-not-allowed"
          }`}
        >
          <LogIn size={16} />
          Sign in with Microsoft
        </button>

        {microsoftLoginEnabled ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Temporary PIN access is available for approved admin/team users while Microsoft approval is pending.
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Microsoft login is temporarily disabled while tenant approval is pending.
          </p>
        )}

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
