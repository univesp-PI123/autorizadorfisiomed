// Grava no banco o resultado das planilhas interpretadas. Tudo numa transação:
// ou a importação entra inteira, ou nada muda.
//
// Reimportar o mesmo arquivo é seguro: as sessões são identificadas pelo ID do
// agendamento no AnClinic e os cadastros pelo CPF (ou carteirinha / nome).

import type { Prisma } from "@prisma/client";
import { paraDate } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import type { AgendaInterpretada, SessaoAgenda } from "./agenda";
import { Avisos } from "./avisos";
import { chaveNome, formatarCpf } from "./planilha";
import type { ProfissionaisInterpretados } from "./profissionais";

type Tx = Prisma.TransactionClient;
const OPCOES_TX = { timeout: 120_000, maxWait: 10_000 };

export type ResumoAgenda = {
  periodo: { inicio: string; fim: string } | null;
  sessoes: number;
  removidas: number;
  novos: { pacientes: number; profissionais: number; procedimentos: number; unidades: number };
  porConvenio: { nome: string; convenioId: string | null; convenio: string | null; sessoes: number }[];
  avisos: { mensagem: string; quantidade: number; linhas: number[] }[];
};

/** Índice de convênios por nome e pelos nomes do AnClinic. */
async function indiceConvenios(tx: Tx) {
  const convenios = await tx.convenio.findMany({ select: { id: true, nome: true, nomesAnclinic: true } });
  const mapa = new Map<string, { id: string; nome: string }>();
  for (const c of convenios) {
    mapa.set(chaveNome(c.nome), c);
    for (const n of c.nomesAnclinic) mapa.set(chaveNome(n), c);
  }
  return mapa;
}

export async function gravarAgenda(
  interpretada: AgendaInterpretada,
  arquivoNome: string,
  usuarioId: string,
) {
  const { sessoes } = interpretada;
  const avisos = new Avisos();
  for (const a of interpretada.avisos) for (const l of a.linhas) avisos.add(a.mensagem, l);

  return prisma.$transaction(async (tx) => {
    const convenios = await indiceConvenios(tx);
    const novos = { pacientes: 0, profissionais: 0, procedimentos: 0, unidades: 0 };

    // Unidades e procedimentos: cria os que ainda não existem.
    const unidades = new Map(
      (await tx.unidade.findMany({ select: { id: true, nomeAnclinic: true } })).map((u) => [chaveNome(u.nomeAnclinic), u.id]),
    );
    for (const nome of new Set(sessoes.map((s) => s.unidade).filter((u): u is string => !!u))) {
      if (unidades.has(chaveNome(nome))) continue;
      const u = await tx.unidade.create({ data: { nome, nomeAnclinic: nome } });
      unidades.set(chaveNome(nome), u.id);
      novos.unidades++;
    }

    const procedimentos = new Map(
      (await tx.procedimento.findMany({ select: { id: true, codigoAnclinic: true } })).map((p) => [p.codigoAnclinic, p.id]),
    );
    for (const s of sessoes) {
      if (!s.procedimento || procedimentos.has(s.procedimento.codigo)) continue;
      const p = await tx.procedimento.create({
        data: { codigoAnclinic: s.procedimento.codigo, descricao: s.procedimento.descricao.slice(0, 200) },
      });
      procedimentos.set(p.codigoAnclinic, p.id);
      novos.procedimentos++;
    }

    // Profissionais: pelo CPF; sem CPF, pelo nome (se for único).
    const listaProf = await tx.profissional.findMany({ select: { id: true, cpf: true, nome: true, cns: true } });
    const profPorCpf = new Map(listaProf.map((p) => [p.cpf, p]));
    const profPorNome = new Map<string, string | null>();
    for (const p of listaProf) {
      const k = chaveNome(p.nome);
      profPorNome.set(k, profPorNome.has(k) ? null : p.id);
    }
    const resolverProfissional = async (s: SessaoAgenda) => {
      const p = s.profissional;
      if (!p) return null;
      if (!p.cpf) {
        const id = profPorNome.get(chaveNome(p.nome));
        if (!id) avisos.add("Profissional sem CPF e sem cadastro com o mesmo nome.", s.linha);
        return id ?? null;
      }
      const existente = profPorCpf.get(p.cpf);
      if (existente) {
        if (!existente.cns && p.cns) {
          await tx.profissional.update({ where: { id: existente.id }, data: { cns: p.cns } });
          existente.cns = p.cns;
        }
        return existente.id;
      }
      const criado = await tx.profissional.create({ data: { nome: p.nome.slice(0, 200), cpf: p.cpf, cns: p.cns } });
      profPorCpf.set(criado.cpf, criado);
      profPorNome.set(chaveNome(criado.nome), criado.id);
      novos.profissionais++;
      return criado.id;
    };

    // Pacientes: CPF → carteirinha no convênio → nome + nascimento.
    const listaPac = await tx.paciente.findMany({ select: { id: true, nome: true, cpf: true, dataNascimento: true, telefone: true } });
    type Pac = (typeof listaPac)[number];
    const pacPorCpf = new Map(listaPac.filter((p) => p.cpf).map((p) => [p.cpf!.replace(/\D/g, ""), p]));
    const pacPorNome = new Map<string, Pac[]>();
    for (const p of listaPac) pacPorNome.set(chaveNome(p.nome), [...(pacPorNome.get(chaveNome(p.nome)) ?? []), p]);
    const vinculos = await tx.pacienteConvenio.findMany({
      select: { id: true, pacienteId: true, convenioId: true, numeroCarteirinha: true },
    });
    const vincPorCarteira = new Map(vinculos.map((v) => [`${v.convenioId}|${v.numeroCarteirinha}`, v]));
    const vincPorPaciente = new Map(vinculos.map((v) => [`${v.pacienteId}|${v.convenioId}`, v]));
    const pacPorId = new Map(listaPac.map((p) => [p.id, p]));

    const resolverPaciente = async (s: SessaoAgenda, convenioId: string | null) => {
      const d = s.paciente;
      if (!d) return null;
      let p: Pac | undefined = d.cpf ? pacPorCpf.get(d.cpf) : undefined;
      if (!p && convenioId && s.carteirinha) {
        const v = vincPorCarteira.get(`${convenioId}|${s.carteirinha}`);
        if (v) p = pacPorId.get(v.pacienteId);
      }
      if (!p) {
        const mesmoNome = pacPorNome.get(chaveNome(d.nome)) ?? [];
        const candidatos = mesmoNome.filter(
          (c) => !d.nascimento || !c.dataNascimento || c.dataNascimento.toISOString().slice(0, 10) === d.nascimento,
        );
        if (candidatos.length === 1) p = candidatos[0];
        else if (candidatos.length > 1) avisos.add("Mais de um paciente com o mesmo nome: vinculado ao primeiro.", s.linha);
        p ??= candidatos[0];
      }

      if (!p) {
        p = await tx.paciente.create({
          data: {
            nome: d.nome.slice(0, 200),
            cpf: d.cpf ? formatarCpf(d.cpf) : null,
            dataNascimento: d.nascimento ? paraDate(d.nascimento) : null,
            telefone: d.telefone,
          },
          select: { id: true, nome: true, cpf: true, dataNascimento: true, telefone: true },
        });
        novos.pacientes++;
        pacPorId.set(p.id, p);
        pacPorNome.set(chaveNome(p.nome), [...(pacPorNome.get(chaveNome(p.nome)) ?? []), p]);
        if (d.cpf) pacPorCpf.set(d.cpf, p);
      } else {
        // Completa só o que está em branco: não sobrescreve o que foi editado no sistema.
        const dados: Prisma.PacienteUpdateInput = {};
        if (!p.cpf && d.cpf && !pacPorCpf.has(d.cpf)) dados.cpf = formatarCpf(d.cpf);
        if (!p.dataNascimento && d.nascimento) dados.dataNascimento = paraDate(d.nascimento);
        if (!p.telefone && d.telefone) dados.telefone = d.telefone;
        if (Object.keys(dados).length) {
          Object.assign(p, await tx.paciente.update({
            where: { id: p.id },
            data: dados,
            select: { id: true, nome: true, cpf: true, dataNascimento: true, telefone: true },
          }));
          if (d.cpf && dados.cpf) pacPorCpf.set(d.cpf, p);
        }
      }

      // Carteirinha: o AnClinic é a referência.
      if (convenioId && s.carteirinha) {
        const chave = `${p.id}|${convenioId}`;
        const v = vincPorPaciente.get(chave);
        if (!v) {
          const criado = await tx.pacienteConvenio.create({
            data: { pacienteId: p.id, convenioId, numeroCarteirinha: s.carteirinha },
            select: { id: true, pacienteId: true, convenioId: true, numeroCarteirinha: true },
          });
          vincPorPaciente.set(chave, criado);
          vincPorCarteira.set(`${convenioId}|${s.carteirinha}`, criado);
        } else if (v.numeroCarteirinha !== s.carteirinha) {
          await tx.pacienteConvenio.update({ where: { id: v.id }, data: { numeroCarteirinha: s.carteirinha, ativo: true } });
          avisos.add("Carteirinha diferente da cadastrada: atualizada com a do AnClinic.", s.linha);
          v.numeroCarteirinha = s.carteirinha;
          vincPorCarteira.set(`${convenioId}|${s.carteirinha}`, v);
        }
      }
      return p.id;
    };

    const importacao = await tx.importacao.create({
      data: { tipo: "agenda", arquivoNome: arquivoNome.slice(0, 255), usuarioId, linhas: sessoes.length + interpretada.ignoradas, resumo: {} },
    });

    const existentes = new Map(
      (await tx.agendamento.findMany({
        where: { idAnclinic: { in: sessoes.map((s) => s.idAnclinic) } },
        select: { idAnclinic: true, unidadeManual: true },
      })).map((a) => [a.idAnclinic, a]),
    );

    const porConvenio = new Map<string, { nome: string; convenioId: string | null; convenio: string | null; sessoes: number }>();
    let criados = 0;
    let atualizados = 0;

    for (const s of sessoes) {
      const conv = s.convenio ? convenios.get(chaveNome(s.convenio)) : undefined;
      const convenioId = conv?.id ?? null;
      if (s.convenio) {
        const g = porConvenio.get(s.convenio) ?? { nome: s.convenio, convenioId, convenio: conv?.nome ?? null, sessoes: 0 };
        g.sessoes++;
        porConvenio.set(s.convenio, g);
      }

      const dados = {
        data: paraDate(s.data),
        horaInicio: s.horaInicio,
        horaFim: s.horaFim,
        pacienteId: await resolverPaciente(s, convenioId),
        profissionalId: await resolverProfissional(s),
        convenioId,
        procedimentoId: s.procedimento ? procedimentos.get(s.procedimento.codigo) ?? null : null,
        unidadeId: s.unidade ? unidades.get(chaveNome(s.unidade)) ?? null : null,
        pacienteAnclinic: s.paciente?.nome.slice(0, 200) ?? null,
        convenioAnclinic: s.convenio?.slice(0, 200) ?? null,
        carteirinha: s.carteirinha,
        statusAnclinic: s.status,
        statusFaturamento: s.statusFaturamento,
        senhaAutorizacao: s.senhaAutorizacao,
        senhaExecucao: s.senhaExecucao,
        agendamentosRestantes: s.agendamentosRestantes,       
        agenda: s.agenda,
        sala: s.sala,
        removidoEm: null,
        importacaoId: importacao.id,
      };
      // Unidade escolhida no sistema não é trocada pela do AnClinic.
      const { unidadeId, ...semUnidade } = dados;
      await tx.agendamento.upsert({
        where: { idAnclinic: s.idAnclinic },
        create: { idAnclinic: s.idAnclinic, ...dados },
        update: existentes.get(s.idAnclinic)?.unidadeManual ? semUnidade : { ...semUnidade, unidadeId },
      });
      if (existentes.has(s.idAnclinic)) atualizados++;
      else criados++;
    }

    // Sessões do mesmo período que não vieram nesta exportação foram
    // excluídas no AnClinic.
    let removidas = 0;
    const { periodo } = interpretada;
    if (periodo) {
      const r = await tx.agendamento.updateMany({
        where: {
          data: { gte: paraDate(periodo.inicio), lte: paraDate(periodo.fim) },
          removidoEm: null,
          idAnclinic: { notIn: sessoes.map((s) => s.idAnclinic) },
        },
        data: { removidoEm: new Date() },
      });
      removidas = r.count;
    }

    const resumo: ResumoAgenda = {
      periodo,
      sessoes: sessoes.length,
      removidas,
      novos,
      porConvenio: [...porConvenio.values()].sort((a, b) => b.sessoes - a.sessoes),
      avisos: avisos.lista(),
    };
    return tx.importacao.update({
      where: { id: importacao.id },
      data: { criados, atualizados, ignorados: interpretada.ignoradas, resumo },
    });
  }, OPCOES_TX);
}

export type ResumoProfissionais = {
  convenio: { id: string; nome: string } | null;
  credenciados: number;
  descredenciados: number;
  semConselho: number;
  avisos: { mensagem: string; quantidade: number; linhas: number[] }[];
};

/**
 * Cadastra/atualiza os profissionais da planilha. Com um convênio escolhido,
 * a planilha passa a ser a lista completa de credenciados nele: quem não está
 * nela deixa de constar como credenciado.
 */
export async function gravarProfissionais(
  interpretada: ProfissionaisInterpretados,
  arquivoNome: string,
  usuarioId: string,
  convenioId: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const convenio = convenioId
      ? await tx.convenio.findUnique({ where: { id: convenioId }, select: { id: true, nome: true } })
      : null;
    const existentes = new Map(
      (await tx.profissional.findMany()).map((p) => [p.cpf, p]),
    );
    let criados = 0;
    let atualizados = 0;
    const ids: string[] = [];

    for (const p of interpretada.profissionais) {
      const atual = existentes.get(p.cpf);
      // Dados de conselho da planilha prevalecem; campos vazios nela não apagam o cadastro.
      const dados = {
        nome: p.nome,
        conselho: p.conselho ?? atual?.conselho ?? null,
        numeroConselho: p.numeroConselho ?? atual?.numeroConselho ?? null,
        ufConselho: p.ufConselho ?? atual?.ufConselho ?? null,
        especialidades: p.especialidades ?? atual?.especialidades ?? null,
        cbo: atual?.cbo ?? p.cbo,
        ativo: true,
      };
      const gravado = atual
        ? await tx.profissional.update({ where: { id: atual.id }, data: dados })
        : await tx.profissional.create({ data: { cpf: p.cpf, ...dados } });
      if (atual) atualizados++;
      else criados++;
      ids.push(gravado.id);
    }

    let descredenciados = 0;
    if (convenio) {
      descredenciados = (
        await tx.profissionalConvenio.deleteMany({ where: { convenioId: convenio.id, profissionalId: { notIn: ids } } })
      ).count;
      await tx.profissionalConvenio.createMany({
        data: ids.map((profissionalId) => ({ profissionalId, convenioId: convenio.id })),
        skipDuplicates: true,
      });
    }

    const resumo: ResumoProfissionais = {
      convenio,
      credenciados: convenio ? ids.length : 0,
      descredenciados,
      semConselho: interpretada.profissionais.filter((p) => !p.conselho || !p.numeroConselho || !p.ufConselho).length,
      avisos: interpretada.avisos,
    };
    return tx.importacao.create({
      data: {
        tipo: "profissionais",
        arquivoNome: arquivoNome.slice(0, 255),
        usuarioId,
        linhas: interpretada.profissionais.length + interpretada.ignoradas,
        criados,
        atualizados,
        ignorados: interpretada.ignoradas,
        resumo,
      },
    });
  }, OPCOES_TX);
}
