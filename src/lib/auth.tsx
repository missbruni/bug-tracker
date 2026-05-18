import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import { AuthContext, type AuthContextValue } from "./auth-context";
import { queryClient } from "./queryClient";

const DEFAULT_ALLOWED_EMAIL_DOMAIN = "theaccessgroup.com";
const configuredAllowedEmailDomain = (
  import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN as string | undefined
)
  ?.trim()
  .toLowerCase();

const allowedEmailDomain =
  configuredAllowedEmailDomain || DEFAULT_ALLOWED_EMAIL_DOMAIN;

const OAUTH_SEARCH_PARAMS = ["code", "state", "error", "error_description"];

function getOAuthRedirectTo(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

function clearOAuthParamsFromUrl() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const hasOAuthParams = OAUTH_SEARCH_PARAMS.some((param) =>
    url.searchParams.has(param),
  );

  if (!hasOAuthParams) return;

  OAUTH_SEARCH_PARAMS.forEach((param) => url.searchParams.delete(param));
  const nextSearch = url.searchParams.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
  window.history.replaceState({}, document.title, nextUrl);
}

function isAllowedEmail(email?: string | null): boolean {
  if (!allowedEmailDomain) return true;

  return (email || "")
    .trim()
    .toLowerCase()
    .endsWith(`@${allowedEmailDomain}`);
}

function getForbiddenDomainMessage(email?: string | null): string {
  if (!email) {
    return `Sign in with your @${allowedEmailDomain} account.`;
  }

  return `Only @${allowedEmailDomain} accounts can access this app. You signed in as ${email}.`;
}

async function validateSessionDomain(session: Session | null): Promise<{
  session: Session | null;
  error: string | null;
}> {
  if (!session) {
    return { session: null, error: null };
  }

  if (isAllowedEmail(session.user.email)) {
    clearOAuthParamsFromUrl();
    return { session, error: null };
  }

  await supabase?.auth.signOut();
  queryClient.clear();
  return {
    session: null,
    error: getForbiddenDomainMessage(session.user.email),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!supabase) {
      setLoading(false);
      return;
    }

    const sb = supabase;

    const initialize = async () => {
      const { data, error } = await sb.auth.getSession();
      if (!active) return;

      if (error) {
        setAuthError(error.message);
        setLoading(false);
        return;
      }

      const validated = await validateSessionDomain(data.session);
      if (!active) return;

      setSession(validated.session);
      setAuthError(validated.error);
      setLoading(false);
    };

    void initialize();

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, nextSession) => {
      void (async () => {
        const validated = await validateSessionDomain(nextSession);
        if (!active) return;

        setSession(validated.session);

        if (validated.error) {
          setAuthError(validated.error);
          return;
        }

        if (nextSession) {
          setAuthError(null);
        }
      })();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithMicrosoft = async () => {
    if (!supabase) {
      setAuthError(
        "Supabase credentials are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setAuthError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: getOAuthRedirectTo(),
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setAuthError(error.message);
    }
  };

  const signOut = async () => {
    if (!supabase) return;

    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
      return;
    }

    setSession(null);
    queryClient.clear();
  };

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    authError,
    allowedEmailDomain,
    signInWithMicrosoft,
    signOut,
    clearAuthError: () => setAuthError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
