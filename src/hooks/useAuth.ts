import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Cookies from 'js-cookie';

export interface AuthUser {
  cpf: string;
  nome: string;
  role: 'employee' | 'admin';
  email?: string;
  departamento?: string;
}

export interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isEmployee: boolean;
  isAdmin: boolean;
  logout: () => void;
  redirectBasedOnRole: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const loadUserData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = Cookies.get("firebaseToken");
      const cpf = Cookies.get("cpf");

      if (!token || !cpf) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Buscar dados do usuário no Firestore
      const userDoc = await getDoc(doc(db, "users", cpf));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Verificar se o campo role existe
        if (!userData.role) {
          setError("Usuário não possui role definida. Entre em contato com o administrador.");
          setLoading(false);
          return;
        }

        const authUser: AuthUser = {
          cpf: cpf,
          nome: userData.nome,
          role: userData.role,
          email: userData.email,
          departamento: userData.departamento
        };

        setUser(authUser);
      } else {
        setError("Usuário não encontrado no sistema.");
        setUser(null);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do usuário:", err);
      setError("Erro ao carregar dados do usuário.");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    Cookies.remove("firebaseToken");
    Cookies.remove("cpf");
    setUser(null);
    router.push("/login");
  };

  const redirectBasedOnRole = () => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (user.role === 'employee') {
      router.push("/ponto");
    } else if (user.role === 'admin') {
      router.push("/admin-dashboard");
    } else {
      setError("Role de usuário inválida.");
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  return {
    user,
    loading,
    error,
    isEmployee: user?.role === 'employee',
    isAdmin: user?.role === 'admin',
    logout,
    redirectBasedOnRole
  };
};

