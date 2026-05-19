import { LogIn } from "lucide-react";

interface LoginScreenProps {
  onMicrosoftSignIn: () => Promise<void>;
  error: string | null;
  allowedEmailDomain: string;
}

export default function LoginScreen({
  onMicrosoftSignIn,
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
          onClick={() => void onMicrosoftSignIn()}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-colors bg-blue-500 text-white dark:text-mushi-bg hover:bg-blue-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:focus-visible:ring-blue-500/30"
        >
          <LogIn size={16} />
          Sign in with Microsoft
        </button>

        {error && (
          <p role="alert" className="mt-3 text-xs text-red-500">
            {error}
          </p>
        )}

        <div className="mt-6 border-t border-slate-200 dark:border-gray-800 pt-5">
          <p className="text-xs text-slate-500 dark:text-gray-400 text-center">
            Please use your Microsoft account to login.
          </p>
        </div>
      </div>
    </div>
  );
}
