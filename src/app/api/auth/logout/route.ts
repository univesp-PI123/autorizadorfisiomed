import { NextResponse } from "next/server";
import { apagarCookieSessao } from "@/lib/auth/sessao";

export async function POST() {
  const res = NextResponse.json({ message: "Logout realizado com sucesso." });
  apagarCookieSessao(res);
  return res;
}
