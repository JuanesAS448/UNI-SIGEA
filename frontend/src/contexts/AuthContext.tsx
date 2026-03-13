import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { apiClient } from "@/lib/api";

interface User {
  id: number;
  email: string;
  role: string;
}

interface AuthContextType {
  session: User | null;
  role: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // verificar sesión al cargar la app
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    apiClient
      .get<User>("/auth/me/")
      .then((user) => {
        setSession(user);
        setRole(user.role);
      })
      .catch(() => {
        localStorage.removeItem("token");
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (username: string, password: string): Promise<string | null> => {
    try {
      const data = await apiClient.post<{
        access: string;
        user: User;
      }>("/auth/login/", {
        username,
        password,
      });

      localStorage.setItem("token", data.access);

      setSession(data.user);
      setRole(data.user.role);

      return null;
    } catch (error: any) {
      return "Credenciales incorrectas";
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<string | null> => {
    try {
      await apiClient.post("/auth/register/", {
        email,
        password,
        full_name: fullName,
      });

      return null;
    } catch (error: any) {
      return "Error al registrar usuario";
    }
  };

  const signOut = async () => {
    localStorage.removeItem("token");
    setSession(null);
    setRole(null);
  };

  const value: AuthContextType = {
    session,
    role,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
