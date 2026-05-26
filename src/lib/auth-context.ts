import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authError: string | null;
  allowedEmailDomain: string;
  allowedEmailDomains: string[];
  signInWithMicrosoft: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
