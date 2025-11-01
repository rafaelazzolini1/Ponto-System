// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
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
  logout: () => Promise<void>;
  redirectBasedOnRole: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // ====== ESCUTAR MUDANÇAS NO FIREBASE AUTH ======
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError(null);

      try {
        if (firebaseUser) {
          // Usuário autenticado no Firebase
          const cpf = Cookies.get("cpf");
          
          if (!cpf) {
            setError("CPF não encontrado nos cookies.");
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
              setUser(null);
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
            setError(null);
          } else {
            setError("Usuário não encontrado no sistema.");
            setUser(null);
          }
        } else {
          // Não há usuário autenticado
          setUser(null);
          setError(null);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do usuário:", err);
        setError("Erro ao carregar dados do usuário.");
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    // Cleanup: remover listener quando componente desmontar
    return () => unsubscribe();
  }, []);

  // ====== LOGOUT ======
  const logout = async () => {
    try {
      await auth.signOut();
      Cookies.remove("firebaseToken");
      Cookies.remove("tokenTimestamp");
      Cookies.remove("cpf");
      setUser(null);
      setError(null);
      router.push("/login");
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
      setError("Erro ao fazer logout.");
    }
  };

  // ====== REDIRECIONAR BASEADO NA ROLE ======
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
      router.push("/login");
    }
  };

  return {
    user,
    loading,
    error,
    isEmployee: user?.role === 'employee',
    isAdmin: user?.role === 'admin',
    logout,
    redirectBasedOnRole,
  };
};