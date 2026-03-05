// hooks/useAuth.ts
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export interface AuthUser {
  cpf: string;
  nome: string;
  role: "employee" | "admin";
  email?: string;
  departamento?: string;
}

export interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isEmployee: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
  redirectBasedOnRole: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError(null);

      try {
        if (firebaseUser) {
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("uid", "==", firebaseUser.uid));
          const snapshot = await getDocs(q);

          if (snapshot.empty) {
            setError("Usuário não encontrado. Verifique se o campo 'uid' foi adicionado ao documento no Firestore.");
            setUser(null);
            setLoading(false);
            return;
          }

          const userDoc = snapshot.docs[0];
          const cpf = userDoc.id;
          const userData = userDoc.data();

          if (!userData.role) {
            setError("Usuário sem role definida. Entre em contato com o administrador.");
            setUser(null);
            setLoading(false);
            return;
          }

          setUser({
            cpf,
            nome: userData.nome,
            role: userData.role,
            email: userData.email,
            departamento: userData.departamento,
          });
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Erro ao carregar usuário:", err);
        setError("Erro ao carregar dados do usuário.");
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // ====== LOGOUT ======
  const logout = async (): Promise<void> => {
    try {
      await auth.signOut();
      await fetch("/api/auth/session", { method: "DELETE" });
      setUser(null);
      setError(null);
      router.push("/login");
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
      setError("Erro ao fazer logout.");
    }
  };

  // ====== REDIRECIONAR BASEADO NA ROLE ======
  const redirectBasedOnRole = (): void => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role === "employee") router.push("/ponto");
    else if (user.role === "admin") router.push("/admin-dashboard");
    else router.push("/login");
  };

  return {
    user,
    loading,
    error,
    isEmployee: user?.role === "employee",
    isAdmin: user?.role === "admin",
    logout,
    redirectBasedOnRole,
  };
};