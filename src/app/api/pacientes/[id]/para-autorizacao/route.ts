import { json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { deDate, hojeISO, paraDate, somarDias } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { codigoParaGuia } from "@/lib/regras/codigoGuia";

// O que a nova autorização precisa do paciente escolhido: as carteirinhas, os
// procedimentos que ele tem na agenda (por convênio) e o pedido médico com o
// plano terapêutico vigente.
export const GET = rota<{ id: string }>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  const paciente = await prisma.paciente.findUnique({
    where: { id },
    select: {
      id: true, nome: true, cpf: true, dataNascimento: true, ativo: true, cid: true,
      vinculos: { where: { ativo: true }, select: { convenioId: true, numeroCarteirinha: true, convenio: { select: { id: true, nome: true } } } },
    },
  });
  if (!paciente) naoEncontrado("Paciente");

  const hoje = hojeISO();
  const [agendamentos, pedido] = await Promise.all([
    prisma.agendamento.findMany({
      where: { pacienteId: paciente.id, removidoEm: null, data: { gte: paraDate(somarDias(hoje, -60)) }, convenioId: { not: null }, procedimentoId: { not: null } },
      select: {
        data: true,
        convenioId: true,
        convenio: { select: { id: true, nome: true } },
        procedimento: {
          select: {
            id: true, codigoAnclinic: true, descricao: true, codigoTuss: true, tabelaTuss: true,
            equivalencias: { select: { convenioId: true, codigo: true, tabela: true, codigoTuss: true } },
          },
        },
      },
      orderBy: { data: "desc" },
    }),
    prisma.pedidoMedico.findFirst({
      where: { pacienteId: paciente.id, ativo: true, OR: [{ validoAte: null }, { validoAte: { gte: paraDate(hoje) } }] },
      orderBy: [{ dataPedido: "desc" }],
      select: { id: true, medicoNome: true, numeroConselho: true, ufConselho: true, cid: true, dataPedido: true, validoAte: true, sessoesSemanais: true, planoItens: true },
    }),
  ]);

  // Procedimentos da agenda por convênio, com quantas sessões e o código da guia.
  const grupos = new Map<string, { convenio: { id: string; nome: string }; procedimento: { id: string; codigoAnclinic: string; descricao: string }; codigo: string | null; sessoes: number; ultima: string; proxima: string | null }>();
  for (const a of agendamentos) {
    const k = `${a.convenioId}|${a.procedimento!.id}`;
    const g = grupos.get(k);
    const d = deDate(a.data);
    if (g) {
      g.sessoes++;
      if (d >= hoje && (!g.proxima || d < g.proxima)) g.proxima = d;
    } else {
      grupos.set(k, {
        convenio: a.convenio!,
        procedimento: { id: a.procedimento!.id, codigoAnclinic: a.procedimento!.codigoAnclinic, descricao: a.procedimento!.descricao },
        codigo: codigoParaGuia(a.procedimento!, a.convenioId)?.codigo ?? null,
        sessoes: 1,
        ultima: d,
        proxima: d >= hoje ? d : null,
      });
    }
  }
  return json({ paciente, agenda: [...grupos.values()].sort((a, b) => b.sessoes - a.sessoes), pedido });
});
