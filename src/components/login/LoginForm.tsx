"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Lock } from 'lucide-react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/login/button";
import { Card, CardContent } from "@/components/login/card";
import { Input } from "@/components/login/input";
import { Label } from "@/components/login/label";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Cookies from "js-cookie"
  ;


export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const cpfLimpo = cpf.replace(/\D/g, "");
      const email = `${cpfLimpo}@empresa.com`;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const token = await user.getIdToken();

      Cookies.set("firebaseToken", token, {
        expires: 1,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      Cookies.set("cpf", cpfLimpo, {
        expires: 1,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      router.push("/ponto");
    } catch (err: any) {
      let msg = "Falha ao fazer login.";
      if (err.code === "auth/user-not-found") msg = "Usuário não encontrado.";
      if (err.code === "auth/wrong-password") msg = "Senha incorreta.";
      setError(msg);
    }

  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleLogin} className="p-6 md:p-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Bem vindo</h1>
                <p className="text-balance text-muted-foreground">Realize o login para registrar seu horário</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cpf">CPF*</Label>
                <Input
                  id="cpf"
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Senha*</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  // checked={rememberMe}
                  // onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary/20"
                />
                <span className="text-sm text-muted-foreground">Lembrar-me</span>
              </label>
              {error && <p className="text-red-500">{error}</p>}
              <Button type="submit" className="w-full">
                <Lock className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform duration-200" />
                Entrar
              </Button>
            </div>
          </form>
          <div className="relative hidden bg-muted md:block">
            <Image
              src="/logo.png"
              alt="Logo"
              width={400}
              height={400}
              className="object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
