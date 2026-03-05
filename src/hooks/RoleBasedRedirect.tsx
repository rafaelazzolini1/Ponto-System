"use client";

import { useEffect } from 'react';
import { useAuth } from './useAuth';

interface RoleBasedRedirectProps {
  children?: React.ReactNode;
  fallbackPath?: string;
}

const Spinner = ({ borderColor }: { borderColor: string }) => (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
);

export default function RoleBasedRedirect({
  children,
  fallbackPath = "/login"
}: RoleBasedRedirectProps) {
  const { user, loading, error, redirectBasedOnRole } = useAuth();

  useEffect(() => {
    if (!loading && !error) {
      if (!user) {
        window.location.href = fallbackPath;
      } else {
        redirectBasedOnRole();
      }
    }
  }, [user, loading, error, redirectBasedOnRole, fallbackPath]);

  return <Spinner borderColor="border-blue-500" />;
}

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
        if (user.role === 'employee') {
          window.location.href = "/ponto";
        } else if (user.role === 'admin') {
          window.location.href = "/admin-dashboard";
        }
      }
    }
  }, [user, loading, error, requiredRole, fallbackPath]);

  if (loading || !user || (requiredRole && user.role !== requiredRole)) {
    return <Spinner borderColor="border-blue-500" />;
  }

  if (error) {
    return <Spinner borderColor="border-red-500" />;
  }

  return <>{children}</>;
}