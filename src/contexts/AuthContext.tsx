import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User } from "@supabase/supabase-js";
import { supabase, UserProfile } from "../lib/supabase";

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  profileError: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: "employee" | "employer",
    companyId?: string,
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isBypassAuth = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";
  const devEmail = import.meta.env.VITE_DEV_EMAIL as string | undefined;
  const devPassword = import.meta.env.VITE_DEV_PASSWORD as string | undefined;

  useEffect(() => {
    if (isBypassAuth) {
      (async () => {
        if (devEmail && devPassword) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: devEmail,
            password: devPassword,
          });

          if (error || !data.user) {
            setProfile(null);
            setUser(null);
            setProfileError(
              error?.message || "Impossible de se connecter au compte démo",
            );
            setLoading(false);
            return;
          }

          setUser(data.user);
          await loadProfile(data.user);
          return;
        }

        setUser({
          id: "dev-user",
          email: "demo@local",
          user_metadata: { full_name: "Demo", role: "employer" },
        } as unknown as User);
        setProfile({
          id: "dev-user",
          email: "demo@local",
          full_name: "Demo",
          role: "employer",
          company_id: null,
          created_at: new Date().toISOString(),
        });
        setProfileError(
          "Mode démo sans authentification. Les actions backend (création, upload) sont désactivées.",
        );
        setLoading(false);
      })();
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile(currentUser: User) {
    try {
      setProfileError(null);
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", currentUser.id)
          .maybeSingle();

        if (error) {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
            continue;
          }
          throw error;
        }

        if (!data) {
          console.log("Profil introuvable, tentative de création...");
          const meta = (currentUser.user_metadata ?? {}) as {
            full_name?: string;
            role?: "employee" | "employer";
            company_id?: string | null;
          };

          const { error: insertError } = await supabase
            .from("user_profiles")
            .upsert(
              {
                id: currentUser.id,
                email: currentUser.email || "unknown@local",
                full_name: meta.full_name || currentUser.email || "Utilisateur",
                role: meta.role || "employee",
                company_id: meta.company_id || null,
              },
              { onConflict: "id", ignoreDuplicates: true },
            );

          if (insertError) {
            console.error(
              "Erreur création profil via loadProfile:",
              insertError,
            );
            if (attempt < maxAttempts) {
              await new Promise((resolve) =>
                setTimeout(resolve, 400 * attempt),
              );
              continue;
            }
            throw insertError;
          }

          console.log("Profil créé avec succès via loadProfile");
          continue;
        }

        setProfile(data);
        return;
      }

      setProfile(null);
    } catch (error) {
      setProfile(null);
      setProfileError(error instanceof Error ? error.message : "Erreur profil");
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string,
    role: "employee" | "employer",
    companyId?: string,
  ) {
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
            company_id: companyId || null,
            status: role === "employee" ? "pending" : "active",
          },
        },
      });

      if (authError) throw authError;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = {
    user,
    profile,
    profileError,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
