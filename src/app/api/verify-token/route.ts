import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps, cert } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export async function POST(req: Request) {
  const { token } = await req.json();

  if (!token) {
    return NextResponse.json({ error: "Token não fornecido" }, { status: 401 });
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    return NextResponse.json({ uid: decodedToken.uid }, { status: 200 });
  } catch (error) {
    console.error("Erro ao verificar token:", error);
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}