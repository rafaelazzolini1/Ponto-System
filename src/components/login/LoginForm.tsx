"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/login/button";
import { Card, CardContent } from "@/components/login/card";
import { Input } from "@/components/login/input";
import { Label } from "@/components/login/label";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Cookies from "js-cookie";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // ====== SEGURANÇA: CPF salvo ======
  useEffect(() => {
    const savedCpf = localStorage.getItem("rememberedCpf");
    if (savedCpf) {
      setCpf(savedCpf);
      setRememberMe(true);
    }
  }, []);

  // ====== VALIDAÇÃO: Formato de CPF ======
  const validarCPF = (cpf: string): boolean => {
    const cpfLimpo = cpf.replace(/\D/g, "");
    
    // Verificar se tem 11 dígitos
    if (cpfLimpo.length !== 11) return false;
    
    // Verificar se não são todos dígitos iguais
    if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;
    
    return true;
  };

  // ====== FORMATAÇÃO: CPF automática ======
  const formatarCPF = (valor: string): string => {
    const apenasNumeros = valor.replace(/\D/g, "");
    
    if (apenasNumeros.length <= 3) return apenasNumeros;
    if (apenasNumeros.length <= 6) 
      return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3)}`;
    if (apenasNumeros.length <= 9) 
      return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6)}`;
    
    return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6, 9)}-${apenasNumeros.slice(9, 11)}`;
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valorFormatado = formatarCPF(e.target.value);
    setCpf(valorFormatado);
    
    // Limpar erro ao digitar
    if (error) setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // ====== VALIDAÇÃO: CPF ======
      const cpfLimpo = cpf.replace(/\D/g, "");
      
      if (!validarCPF(cpf)) {
        setError("CPF inválido. Verifique e tente novamente.");
        setLoading(false);
        return;
      }

      // ====== VALIDAÇÃO: Senha mínima ======
      if (password.length < 6) {
        setError("Senha deve ter no mínimo 6 caracteres.");
        setLoading(false);
        return;
      }

      // ====== AUTENTICAÇÃO: Firebase Auth ======
      const email = `${cpfLimpo}@empresa.com`;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const token = await user.getIdToken();
      const now = new Date().getTime();

      const expirationHours = 1 / 24;
      
      Cookies.set("firebaseToken", token, {
        expires: expirationHours,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/"
      });

      Cookies.set("tokenTimestamp", now.toString(), {
        expires: expirationHours,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/"
      });

      Cookies.set("cpf", cpfLimpo, {
        expires: expirationHours,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/"
      });

      if (rememberMe) {
        localStorage.setItem("rememberedCpf", cpf);
      } else {
        localStorage.removeItem("rememberedCpf");
      }
      
      localStorage.removeItem("rememberedPassword");

      router.push("/ponto");
      
    } catch (err: unknown) {
      let msg = "Erro ao fazer login. Tente novamente.";

      if (err instanceof FirebaseError) {
        switch (err.code) {
          case "auth/user-not-found":
            msg = "CPF não encontrado no sistema.";
            break;
          case "auth/wrong-password":
            msg = "Senha incorreta.";
            break;
          case "auth/too-many-requests":
            msg = "Muitas tentativas. Aguarde alguns minutos.";
            break;
          case "auth/network-request-failed":
            msg = "Erro de conexão. Verifique sua internet.";
            break;
          case "auth/invalid-email":
            msg = "CPF inválido.";
            break;
          case "auth/user-disabled":
            msg = "Usuário desativado. Contate o administrador.";
            break;
          default:
            msg = `Erro: ${err.message}`;
        }
      }

      setError(msg);
      console.error("Erro no login:", err);
      
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6 min-h-screen md:min-h-0 justify-center", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleLogin} className="p-6 md:p-8">
            <div className="flex flex-col gap-4 md:gap-6">
              <div className="flex flex-col items-center text-center">
                {/* Logo visível apenas no mobile */}
                <div className="mb-4 md:hidden">
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    width={120}
                    height={120}
                    className="object-contain dark:brightness-[0.2] dark:grayscale"
                  />
                </div>
                <h1 className="text-xl md:text-2xl font-bold">Bem-vindo</h1>
                <p className="text-sm md:text-base text-balance text-muted-foreground">
                  Realize o login para registrar seu horário
                </p>
              </div>

              {/* Campo CPF */}
              <div className="grid gap-2">
                <Label htmlFor="cpf">CPF*</Label>
                <Input
                  id="cpf"
                  type="text"
                  value={cpf}
                  onChange={handleCPFChange}
                  placeholder="000.000.000-00"
                  required
                  maxLength={14}
                  className="h-11"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>

              {/* Campo Senha */}
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Senha*</Label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="h-11 pr-10"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Lembrar-me (apenas CPF) */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary/20 w-4 h-4"
                  disabled={loading}
                />
                <span className="text-sm text-muted-foreground">
                  Lembrar meu CPF
                </span>
              </label>

              {/* Mensagem de Erro */}
              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/20 p-3 rounded-md border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2">
                    <span className="text-base">⚠️</span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Botão de Login */}
              <Button
                type="submit"
                disabled={loading || !cpf || !password}
                className="w-full h-11 md:h-10 flex items-center justify-center
                         bg-blue-600 text-white font-medium rounded-lg
                         hover:bg-blue-700 hover:shadow-lg hover:scale-[1.02]
                         disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:scale-100
                         transition-all duration-200 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform duration-200" />
                    Entrar
                  </>
                )}
              </Button>


            </div>
          </form>

          {/* Logo visível apenas no desktop */}
          <div className="relative hidden bg-muted md:flex md:items-center md:justify-center">
            <Image
              src="/logo.png"
              alt="Logo"
              width={400}
              height={400}
              className="object-contain dark:brightness-[0.2] dark:grayscale p-8"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}