import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
} from "react";
import { apiClient } from "@/lib/api";

export type RolDocumental = "admin" | "revisor" | "postulante";

export interface SessionUser {
  id: number;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  rol: RolDocumental;
  postulante_id: number | null;
}

interface AuthContextType {
  session: SessionUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

function mapMePayload(data: Record<string, unknown>): SessionUser {
  return {
    id: data.id as number,
    email: (data.email as string) ?? "",
    username: data.username as string | undefined,
    first_name: data.first_name as string | undefined,
    last_name: data.last_name as string | undefined,
    rol: (data.rol as RolDocumental) ?? "postulante",
    postulante_id: (data.postulante_id as number | null) ?? null,
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    apiClient
      .get<Record<string, unknown>>("/auth/me/")
      .then((data) => {
        setSession(mapMePayload(data));
      })
      .catch(() => {
        localStorage.removeItem("token");
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const data = await apiClient.post<Record<string, unknown>>("/auth/login/", {
        email,
        password,
      });

      localStorage.setItem("token", data.access as string);

      setSession(mapMePayload(data));

      return null;
    } catch {
      return "Credenciales incorrectas";
    }
  }, []);

  /**
   * Registro: el backend devuelve JWT en la misma respuesta (no hace falta un segundo login).
   */
  const signUp = useCallback(async (email: string, password: string, fullName: string): Promise<string | null> => {
    try {
      const data = await apiClient.post<Record<string, unknown>>("/auth/register/", {
        email,
        password,
        full_name: fullName,
      });

      const access = data.access as string | undefined;
      if (!access) {
        return "El servidor no devolvió sesión. Intente iniciar sesión manualmente.";
      }

      localStorage.setItem("token", access);
      setSession(mapMePayload(data));
      return null;
    } catch {
      return "No se pudo registrar. Verifique el correo (único) y los datos.";
    }
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<string | null> => {
    try {
      await apiClient.post("/auth/change-password/", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      return null;
    } catch {
      return "No se pudo cambiar la contraseña. Revise la contraseña actual.";
    }
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem("token");
    setSession(null);
  }, []);

  const value: AuthContextType = {
    session,
    loading,
    signIn,
    signUp,
    changePassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
