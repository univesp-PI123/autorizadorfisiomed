import { ErroHttp, json, rota } from "@/lib/api/http";
import { lerPdfEnviado } from "@/lib/arquivos";
import { exigirSessao } from "@/lib/auth/sessao";
import { lerPlano } from "@/lib/documentos/plano";

// Lê o plano terapêutico sem gravar nada: o formulário de pedido médico usa
// para se preencher sozinho.
export const POST = rota(async (req) => {
  await exigirSessao(req);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ErroHttp(400, "Envie o arquivo como formulário (multipart/form-data).");
  }
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || !arquivo.size) throw new ErroHttp(422, "Selecione o PDF do plano.");
  const plano = await lerPlano(await lerPdfEnviado(arquivo));
  if (!plano) throw new ErroHttp(422, "Não foi possível ler este PDF como plano terapêutico (PDF escaneado ou outro formulário).");
  return json(plano);
});
