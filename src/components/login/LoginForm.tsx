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
  const router = useRouter();

  // Carregar credenciais salvas ao montar o componente
  useEffect(() => {
    const savedCpf = localStorage.getItem("rememberedCpf");
    const savedPassword = localStorage.getItem("rememberedPassword");

    if (savedCpf) {
      setCpf(savedCpf);
      setRememberMe(true);
    }
    if (savedPassword) {
      setPassword(savedPassword);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const cpfLimpo = cpf.replace(/\D/g, "");
      const email = `${cpfLimpo}@empresa.com`;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const token = await user.getIdToken();
      const now = new Date().getTime();


      Cookies.set("firebaseToken", token, {
        expires: 1,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      Cookies.set("tokenTimestamp", now.toString(), {
        expires: 1,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      Cookies.set("cpf", cpfLimpo, {
        expires: 1,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      // Salvar ou remover credenciais baseado no "lembrar-me"
      if (rememberMe) {
        localStorage.setItem("rememberedCpf", cpf);
        localStorage.setItem("rememberedPassword", password);
      } else {
        localStorage.removeItem("rememberedCpf");
        localStorage.removeItem("rememberedPassword");
      }

      router.push("/ponto");
    } catch (err: unknown) {
      let msg = "Senha incorreta.";

      if (err instanceof FirebaseError) {
        if (err.code === "auth/user-not-found") msg = "Usuário não encontrado.";
        if (err.code === "auth/wrong-password") msg = "Senha incorreta.";
      }

      setError(msg);
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

              <div className="grid gap-2">
                <Label htmlFor="cpf">CPF*</Label>
                <Input
                  id="cpf"
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  required
                  className="h-11"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Senha*</Label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary/20 w-4 h-4"
                />
                <span className="text-sm text-muted-foreground">Lembrar-me</span>
              </label>

              {error && (
                <p className="text-red-500 text-sm bg-red-50 dark:bg-red-950/20 p-3 rounded-md">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full h-11 md:h-10 flex items-center justify-center
             bg-blue-600 text-white font-medium rounded-lg
             hover:bg-blue-700 hover:shadow-lg hover:scale-[1.02]
             transition-all duration-200 cursor-pointer"
              >
                <Lock className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform duration-200" />
                Entrar
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