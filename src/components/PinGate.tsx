import { useState, type FormEvent } from "react";
import { type PinAccessLevel } from "../lib/teamScope";
import { submitPin } from "../lib/pinAuth";

interface PinGateProps {
  pinConfigured: boolean;
  onUnlock: (accessLevel: PinAccessLevel) => void;
}

export default function PinGate({ pinConfigured, onUnlock }: PinGateProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!pinConfigured) {
    return (
      <div className="mt-6 border-t border-slate-200 dark:border-gray-800 pt-5">
        <p role="alert" className="text-xs text-amber-600 dark:text-amber-400 text-center">
          Temporary PIN access is unavailable because <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">TEAM_PIN</code> and <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">GOD_PIN</code> are not configured in Vercel.
        </p>
      </div>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const enteredPin = pin.trim();
    if (!enteredPin || submitting) return;

    setSubmitting(true);
    try {
      const result = await submitPin(enteredPin);
      setError("");
      setPin("");
      onUnlock(result.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wrong PIN. Try again.");
      setPin("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 border-t border-slate-200 dark:border-gray-800 pt-5 text-left">
      <p className="text-xs text-slate-500 dark:text-gray-400 mb-3 text-center">
        Temporary access: enter team or admin PIN
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          value={pin}
          onChange={(event) => {
            setPin(event.target.value);
            setError("");
          }}
          placeholder="PIN"
          autoFocus
          disabled={submitting}
          className={`w-full rounded-lg border ${error ? "border-red-400 dark:border-red-600" : "border-slate-300 dark:border-gray-600"} bg-slate-50 dark:bg-gray-800 px-4 py-2.5 text-center text-lg tracking-widest text-slate-900 dark:text-white outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all disabled:opacity-60`}
        />
        {error && (
          <p role="alert" className="text-xs text-red-500 text-center">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white dark:text-mushi-bg hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Mushi booting..." : "Enter with PIN"}
        </button>
      </form>
    </div>
  );
}
