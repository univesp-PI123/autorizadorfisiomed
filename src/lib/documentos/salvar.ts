// Grava um PDF do paciente: identifica o tipo, lê o plano terapêutico, acha o
// paciente (em lote) e liga o documento ao pedido médico.
//
// Plano terapêutico legível → cria (ou completa) o pedido médico com o médico
// prescritor, CRM, CID, data e sessões por semana. Outros documentos entram no
// pedido ativo mais recente do paciente; sem pedido, ficam avulsos.

import type { Prisma, TipoDocumento } from "@prisma/client";
import { apagarArquivo, salvarPdf, sha256 } from "@/lib/arquivos";
import { deDate, paraDate } from "@/lib/datas";
import { chaveNome, formatarCpf } from "@/lib/importacao/planilha";
import { prisma } from "@/lib/prisma";
import { validadePadrao } from "@/lib/regras/pedidoMedico";
import { lerPlano, type PlanoTerapeutico } from "./plano";
import { chaveCarteirinha, numerosDoNome, tipoPeloNome } from "./vinculo";

export type ResultadoDocumento = {
  arquivo: string;
  status: "vinculado" | "sem_paciente" | "duplicado";
  tipo: TipoDocumento;
  paciente?: { id: string; nome: string };
  vinculoPor?: "cpf" | "carteirinha" | "nome_no_plano" | "escolhido";
  pedido?: { id: string; criado: boolean } | null;
  motivo?: string;
  documentoId?: string;
};

type Pac = { id: string; nome: string; cpf: string | null; dataNascimento: Date | null };

/** Índices de pacientes carregados uma vez por lote. */
export async function indicePacientes() {
  const pacientes: Pac[] = await prisma.paciente.findMany({ select: { id: true, nome: true, cpf: true, dataNascimento: true } });
  const vinculos = await prisma.pacienteConvenio.findMany({ select: { pacienteId: true, numeroCarteirinha: true } });
  const porId = new Map(pacientes.map((p) => [p.id, p]));
  const porCpf = new Map(pacientes.filter((p) => p.cpf).map((p) => [p.cpf!.replace(/\D/g, ""), p]));
  const porCarteira = new Map<string, Set<string>>();
  for (const v of vinculos) {
    const k = chaveCarteirinha(v.numeroCarteirinha);
    if (k.length < 5) continue;
    porCarteira.set(k, (porCarteira.get(k) ?? new Set()).add(v.pacienteId));
  }
  const porNome = new Map<string, Pac[]>();
  const porNascimento = new Map<string, Pac[]>();
  for (const p of pacientes) {
    porNome.set(chaveNome(p.nome), [...(porNome.get(chaveNome(p.nome)) ?? []), p]);
    if (p.dataNascimento) {
      const d = deDate(p.dataNascimento);
      porNascimento.set(d, [...(porNascimento.get(d) ?? []), p]);
    }
  }
  return { porId, porCpf, porCarteira, porNome, porNascimento };
}
export type IndicePacientes = Awaited<ReturnType<typeof indicePacientes>>;

const PARTICULAS = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);
const nomesDe = (n: string) => chaveNome(n).split(" ").filter((p) => p && !PARTICULAS.has(p));

/** Mesmo primeiro nome e pelo menos dois nomes em comum. */
export function nomesParecidos(a: string, b: string) {
  const na = nomesDe(a);
  const nb = new Set(nomesDe(b));
  if (!na.length || na[0] !== [...nb][0]) return false;
  return na.filter((p) => nb.has(p)).length >= Math.min(2, na.length, nb.size);
}

export function acharPaciente(
  nomeArquivo: string,
  plano: PlanoTerapeutico | null,
  idx: IndicePacientes,
): { paciente?: Pac; por?: ResultadoDocumento["vinculoPor"]; motivo?: string } {
  const { cpfs, carteirinhas } = numerosDoNome(nomeArquivo);
  for (const c of cpfs) {
    const p = idx.porCpf.get(c);
    if (p) return { paciente: p, por: "cpf" };
  }
  const achados = new Set<string>();
  for (const c of carteirinhas) for (const id of idx.porCarteira.get(chaveCarteirinha(c)) ?? []) achados.add(id);
  if (achados.size === 1) return { paciente: idx.porId.get([...achados][0]), por: "carteirinha" };
  if (achados.size > 1) return { motivo: "A carteirinha do nome do arquivo pertence a mais de um paciente." };

  if (plano?.paciente.nome) {
    const mesmos = (idx.porNome.get(chaveNome(plano.paciente.nome)) ?? []).filter(
      (p) => !plano.paciente.nascimento || !p.dataNascimento || deDate(p.dataNascimento) === plano.paciente.nascimento,
    );
    if (mesmos.length === 1) return { paciente: mesmos[0], por: "nome_no_plano" };
    if (mesmos.length > 1) return { motivo: "Há mais de um paciente com o nome do plano." };
    // O nome no AnClinic pode estar abreviado ("YAN FELIPE OLIVEIRA" x "Yan Felipe
    // Oliveira Santos"): mesma data de nascimento, mesmo primeiro nome e ao menos
    // dois nomes em comum.
    if (plano.paciente.nascimento) {
      const parecidos = (idx.porNascimento.get(plano.paciente.nascimento) ?? []).filter((p) =>
        nomesParecidos(p.nome, plano.paciente.nome!),
      );
      if (parecidos.length === 1) return { paciente: parecidos[0], por: "nome_no_plano" };
      if (parecidos.length > 1) return { motivo: "Há mais de um paciente parecido com o nome e nascimento do plano." };
    }
  }
  const doPlano = plano?.paciente.nome ? " nem com o nome e nascimento escritos no plano" : "";
  if (cpfs.length) return { motivo: `CPF ${formatarCpf(cpfs[0])} do nome do arquivo não está cadastrado${doPlano}.` };
  if (carteirinhas.length) return { motivo: `Nenhum paciente com a carteirinha do nome do arquivo${doPlano}.` };
  return { motivo: `O nome do arquivo não tem CPF nem carteirinha de paciente cadastrado${doPlano}.` };
}

/** Pedido médico a partir do plano terapêutico (sem os dados do médico, não cria). */
function dadosDoPedido(plano: PlanoTerapeutico, nomeArquivo: string) {
  if (!plano.medico.nome || !plano.medico.crm || !plano.dataSolicitacao) return null;
  const somaItens = plano.itens.reduce((s, i) => s + i.total, 0);
  return {
    medicoNome: plano.medico.nome.slice(0, 200),
    conselho: "CRM",
    numeroConselho: plano.medico.crm.slice(0, 15),
    // O formulário não traz a UF do CRM: presume a da clínica, avisando.
    ufConselho: "SP",
    cid: plano.cid,
    dataPedido: paraDate(plano.dataSolicitacao),
    validoAte: validadePadrao(paraDate(plano.dataSolicitacao)),
    sessoesSemanais: somaItens || plano.sessoesSemanais,
    planoItens: plano.itens as unknown as Prisma.InputJsonValue,
    observacoes: `Criado a partir do plano terapêutico (${nomeArquivo.slice(0, 120)}). UF do CRM presumida: SP — confira.`,
  };
}

export async function gravarDocumento({
  nomeArquivo,
  conteudo,
  tipoPadrao,
  usuarioId,
  origem,
  pacienteId,
  pedidoId,
  idx,
}: {
  nomeArquivo: string;
  conteudo: Buffer;
  tipoPadrao: TipoDocumento;
  usuarioId: string;
  origem: "manual" | "lote";
  pacienteId?: string; // já escolhido (cadastro manual)
  pedidoId?: string; // ligar a este pedido (cadastro manual)
  idx?: IndicePacientes;
}): Promise<ResultadoDocumento> {
  const plano = await lerPlano(conteudo);
  const tipo: TipoDocumento = plano ? "plano_terapeutico" : (tipoPeloNome(nomeArquivo) ?? tipoPadrao);
  const base = { arquivo: nomeArquivo, tipo };

  let paciente: Pac | undefined;
  let por: ResultadoDocumento["vinculoPor"] = "escolhido";
  if (pacienteId) {
    paciente = (await prisma.paciente.findUnique({ where: { id: pacienteId }, select: { id: true, nome: true, cpf: true, dataNascimento: true } })) ?? undefined;
  } else {
    const r = acharPaciente(nomeArquivo, plano, idx ?? (await indicePacientes()));
    if (!r.paciente) return { ...base, status: "sem_paciente", motivo: r.motivo };
    paciente = r.paciente;
    por = r.por;
  }
  if (!paciente) return { ...base, status: "sem_paciente", motivo: "Paciente não encontrado." };
  const pacienteRef = { id: paciente.id, nome: paciente.nome };

  const hash = sha256(conteudo);
  const repetido = await prisma.documento.findUnique({ where: { pacienteId_sha256: { pacienteId: paciente.id, sha256: hash } } });
  if (repetido && pedidoId) {
    // Cadastro manual com um PDF já enviado antes: passa a valer para este pedido.
    await prisma.documento.update({ where: { id: repetido.id }, data: { pedidoId } });
    return { ...base, status: "vinculado", paciente: pacienteRef, vinculoPor: por, pedido: { id: pedidoId, criado: false }, documentoId: repetido.id };
  }
  if (repetido) {
    return { ...base, status: "duplicado", paciente: pacienteRef, vinculoPor: por, motivo: "Este arquivo já foi enviado para o paciente." };
  }

  const salvo = await salvarPdf(conteudo);
  try {
    return await prisma.$transaction(async (tx) => {
      let pedido: ResultadoDocumento["pedido"] = null;
      const doPlano = plano ? dadosDoPedido(plano, nomeArquivo) : null;
      if (pedidoId) {
        pedido = { id: pedidoId, criado: false };
        if (doPlano) {
          await tx.pedidoMedico.updateMany({
            where: { id: pedidoId, sessoesSemanais: null },
            data: { sessoesSemanais: doPlano.sessoesSemanais, planoItens: doPlano.planoItens },
          });
        }
      } else if (doPlano) {
        const existente = await tx.pedidoMedico.findFirst({
          where: { pacienteId: paciente!.id, numeroConselho: doPlano.numeroConselho, dataPedido: doPlano.dataPedido },
        });
        if (existente) {
          await tx.pedidoMedico.update({
            where: { id: existente.id },
            data: { sessoesSemanais: existente.sessoesSemanais ?? doPlano.sessoesSemanais, planoItens: existente.planoItens ?? doPlano.planoItens, cid: existente.cid ?? doPlano.cid },
          });
          pedido = { id: existente.id, criado: false };
        } else {
          const criado = await tx.pedidoMedico.create({ data: { ...doPlano, pacienteId: paciente!.id, usuarioId } });
          pedido = { id: criado.id, criado: true };
        }
        if (plano?.cid) {
          await tx.paciente.updateMany({ where: { id: paciente!.id, cid: null }, data: { cid: plano.cid } });
        }
      } else {
        const ultimo = await tx.pedidoMedico.findFirst({
          where: { pacienteId: paciente!.id, ativo: true },
          orderBy: [{ dataPedido: "desc" }, { createdAt: "desc" }],
        });
        if (ultimo) pedido = { id: ultimo.id, criado: false };
      }

      const doc = await tx.documento.create({
        data: {
          pacienteId: paciente!.id,
          pedidoId: pedido?.id ?? null,
          tipo,
          nomeOriginal: nomeArquivo.slice(0, 255),
          ...salvo,
          dados: (plano as unknown as Prisma.InputJsonValue) ?? undefined,
          origem,
          usuarioId,
        },
      });
      return { ...base, status: "vinculado" as const, paciente: pacienteRef, vinculoPor: por, pedido, documentoId: doc.id };
    });
  } catch (erro) {
    await apagarArquivo(salvo.caminho);
    throw erro;
  }
}
