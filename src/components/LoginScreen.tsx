import React from "react";
import { LogIn, Mail } from "lucide-react";

const isLocalDb = import.meta.env.MODE === "localdb";

interface LoginScreenProps {
  onMicrosoftSignIn: () => Promise<void>;
  onEmailSignIn?: (email: string, password: string) => Promise<void>;
  error: string | null;
  allowedEmailDomain: string;
}

export default function LoginScreen({
  onMicrosoftSignIn,
  onEmailSignIn,
  error,
  allowedEmailDomain,
}: LoginScreenProps) {
  const [email, setEmail] = React.useState(`dev@${allowedEmailDomain}`);
  const [password, setPassword] = React.useState("password123");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-lg">
        <h1
          className="text-lg font-bold text-slate-900 dark:text-gray-100 mb-1"
          style={{ fontFamily: "'Press Start 2P', 'Courier New', monospace", fontSize: 14 }}
        >
          Mushi
        </h1>

        {isLocalDb && onEmailSignIn ? (
          <>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-4">
              Local development — sign in with email
            </p>
            <form
              className="mt-4 space-y-3 text-left"
              onSubmit={(e) => {
                e.preventDefault();
                void onEmailSignIn(email, password);
              }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/30"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/30"
              />
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-colors bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-500/30"
              >
                <Mail size={16} />
                Dev Login
              </button>
            </form>
            <p className="mt-3 text-[10px] text-slate-400 dark:text-gray-600">
              First login auto-creates the user. Any email/password works.
            </p>
          </>
        ) : (
          <>
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

            <div className="mt-6 border-t border-slate-200 dark:border-gray-800 pt-5">
              <p className="text-xs text-slate-500 dark:text-gray-400 text-center">
                Please use your Microsoft account to login.
              </p>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 text-xs text-red-500">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
