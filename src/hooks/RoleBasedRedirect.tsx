"use client";

import { useEffect } from 'react';
import { useAuth } from './useAuth';

interface RoleBasedRedirectProps {
  children?: React.ReactNode;
  fallbackPath?: string;
}

export default function RoleBasedRedirect({ 
  children, 
  fallbackPath = "/login" 
}: RoleBasedRedirectProps) {
  const { user, loading, error, redirectBasedOnRole } = useAuth();

  useEffect(() => {
    if (!loading && !error) {
      if (!user) {
        // Usuário não autenticado, redirecionar para login
        window.location.href = fallbackPath;
      } else {
        // Usuário autenticado, redirecionar baseado na role
        redirectBasedOnRole();
      }
    }
  }, [user, loading, error, redirectBasedOnRole, fallbackPath]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Verificando credenciais...
          </h2>
          <p className="text-gray-600">
            Aguarde enquanto direcionamos você para a página correta.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Erro de Autenticação
          </h2>
          <p className="text-gray-600 mb-4">
            {error}
          </p>
          <button
            onClick={() => window.location.href = fallbackPath}
            className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  // Se chegou até aqui, está redirecionando
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-green-500 text-4xl mb-4">✅</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Redirecionando...
        </h2>
        <p className="text-gray-600">
          {user?.role === 'employee' 
            ? 'Direcionando para o sistema de ponto...'
            : 'Direcionando para o dashboard administrativo...'
          }
        </p>
      </div>
    </div>
  );
}

// Componente para proteger rotas baseado na role
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'employee' | 'admin';
  fallbackPath?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  fallbackPath = "/login" 
}: ProtectedRouteProps) {
  const { user, loading, error } = useAuth();

  useEffect(() => {
    if (!loading && !error) {
      if (!user) {
        window.location.href = fallbackPath;
      } else if (requiredRole && user.role !== requiredRole) {
        // Usuário não tem a role necessária, redirecionar baseado na role atual
        if (user.role === 'employee') {
          window.location.href = "/ponto";
        } else if (user.role === 'admin') {
          window.location.href = "/admin-dashboard";
        }
      }
    }
  }, [user, loading, error, requiredRole, fallbackPath]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Carregando...
          </h2>
          <p className="text-gray-600">
            Verificando permissões de acesso.
          </p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">🚫</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Acesso Negado
          </h2>
          <p className="text-gray-600 mb-4">
            {error || "Você não tem permissão para acessar esta página."}
          </p>
          <button
            onClick={() => window.location.href = fallbackPath}
            className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-yellow-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="text-yellow-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Acesso Restrito
          </h2>
          <p className="text-gray-600 mb-4">
            Esta página é restrita para usuários do tipo "{requiredRole}".
            Você está logado como "{user.role}".
          </p>
          <button
            onClick={() => {
              if (user.role === 'employee') {
                window.location.href = "/ponto";
              } else if (user.role === 'admin') {
                window.location.href = "/admin-dashboard";
              }
            }}
            className="bg-yellow-500 text-white px-6 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
          >
            Ir para Minha Página
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

