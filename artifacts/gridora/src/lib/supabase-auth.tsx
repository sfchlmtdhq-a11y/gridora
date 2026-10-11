import { createClient, type Session, type User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  signOut: (options?: { redirectUrl?: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setIsLoaded(true);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoaded(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => supabase?.auth.getSession().then(({ data }) => data.session?.access_token ?? null) ?? null);
    return () => setAuthTokenGetter(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    isLoaded,
    isSignedIn: Boolean(session?.user),
    user: session?.user ?? null,
    session,
    async signIn(email, password) {
      if (!supabase) return { error: "Supabase Auth is not configured." };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    async signUp(email, password, fullName) {
      if (!supabase) return { error: "Supabase Auth is not configured." };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      return error
        ? { error: error.message }
        : { needsEmailConfirmation: !data.session };
    },
    async signOut(options) {
      await supabase?.auth.signOut();
      if (options?.redirectUrl) window.location.assign(options.redirectUrl);
    },
  }), [isLoaded, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside SupabaseAuthProvider");
  return value;
}

export function useAuthClient() {
  const { signOut } = useAuth();
  return { signOut };
}
