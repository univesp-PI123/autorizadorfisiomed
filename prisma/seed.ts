/**
 * Carga inicial do banco.
 *
 *   npm run db:seed            cria o primeiro administrador (pergunta nome,
 *                              e-mail e senha; ou lê ADMIN_NOME, ADMIN_EMAIL
 *                              e ADMIN_SENHA do ambiente)
 *   npm run db:seed -- --demo  além disso, cria dados FICTÍCIOS para testar
 *                              (convênios, pacientes, autorizações e usuários
 *                              de exemplo). Não use em produção.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline";
import { hojeISO, paraDate, somarDias, somarMeses } from "../src/lib/datas";

const prisma = new PrismaClient();

// Um único leitor para todas as perguntas, lido pelo iterador assíncrono (que
// guarda as linhas em fila — sem isso, com a entrada vinda de um pipe, as
// respostas chegam todas juntas e se perdem).
let leitor: ReturnType<typeof createInterface> | undefined;
let linhas: AsyncIterator<string> | undefined;
let silenciar = false;

async function perguntar(texto: string, oculto = false): Promise<string> {
  if (!leitor) {
    leitor = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: Boolean(process.stdin.isTTY),
    });
    // Enquanto "silenciar" estiver ligado, o que é digitado não aparece na tela.
    const interno = leitor as unknown as { _writeToOutput: (s: string) => void };
    const original = interno._writeToOutput.bind(leitor);
    interno._writeToOutput = (s: string) => {
      if (!silenciar) original(s);
    };
    linhas = leitor[Symbol.asyncIterator]();
  }
  process.stdout.write(texto);
  silenciar = oculto;
  const { value, done } = await linhas!.next();
  if (silenciar) process.stdout.write("\n");
  silenciar = false;
  if (done) throw new Error("Entrada encerrada antes de responder todas as perguntas.");
  return value.trim();
}

async function criarAdmin() {
  const nome = process.env.ADMIN_NOME || (await perguntar("Nome do administrador: "));
  const email = (process.env.ADMIN_EMAIL || (await perguntar("E-mail do administrador: "))).toLowerCase();
  const senha = process.env.ADMIN_SENHA || (await perguntar("Senha (mín. 8 caracteres): ", true));

  if (nome.length < 3) throw new Error("Nome muito curto.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
  if (senha.length < 8) throw new Error("A senha deve ter ao menos 8 caracteres.");

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log(`Já existe um usuário com o e-mail ${email}. Nada foi alterado.`);
    return existente;
  }
  const admin = await prisma.usuario.create({
    data: { nome, email, perfil: "admin", senhaHash: await bcrypt.hash(senha, 12) },
  });
  console.log(`Administrador ${email} criado.`);
  return admin;
}

async function criarDemo(adminId: string) {
  const hoje = hojeISO();
  const senhaDemo = await bcrypt.hash("Demo@12345", 12);

  // Procedimentos como vêm do AnClinic (a importação da agenda cria os reais).
  for (const [codigoAnclinic, descricao] of [
    ["4440", "PSICOLOGIA ABA"],
    ["4415", "FONOAUDIOLOGIA ABA"],
    ["4460", "TERAPIA OCUPACIONAL ABA"],
  ]) {
    await prisma.procedimento.upsert({ where: { codigoAnclinic }, update: {}, create: { codigoAnclinic, descricao } });
  }

  const terapeutas: string[] = [];
  for (const [nome, email, perfil] of [
    ["Ana Recepcionista", "recepcao@demo.local", "recepcionista"],
    ["Carlos Terapeuta", "terapeuta@demo.local", "terapeuta"],
    ["Fernanda Financeiro", "financeiro@demo.local", "financeiro"],
  ] as const) {
    const u = await prisma.usuario.upsert({
      where: { email },
      update: {},
      create: { nome, email, perfil, senhaHash: senhaDemo },
    });
    if (perfil === "terapeuta") terapeutas.push(u.id);
  }

  const convenios = [];
  for (const c of [
    { nome: "Unimed (demo)", codigoAns: "000001", prazoAutorizacaoDias: 30, alertaAntecipacaoDias: 7 },
    { nome: "Bradesco Saúde (demo)", codigoAns: "000002", prazoAutorizacaoDias: 45, alertaAntecipacaoDias: 10 },
    { nome: "Amil (demo)", codigoAns: "000003", prazoAutorizacaoDias: 30, alertaAntecipacaoDias: 5 },
  ]) {
    convenios.push(
      await prisma.convenio.upsert({
        where: { nome: c.nome },
        update: {},
        create: { ...c, procedimentosCobertos: ["ABA", "Fisioterapia", "Fonoaudiologia"] },
      }),
    );
  }

  const pacientes = [];
  for (const [i, p] of [
    { nome: "Lucas Exemplo", dataNascimento: "2018-03-15", cid: "F84.0" },
    { nome: "Sofia Exemplo", dataNascimento: "2019-07-22", cid: "F84.0" },
    { nome: "Gabriel Exemplo", dataNascimento: "2017-11-08", cid: "F84.1" },
    { nome: "Isabella Exemplo", dataNascimento: "2020-01-30", cid: "F84.0" },
  ].entries()) {
    const cpf = `000.000.000-${String(i + 1).padStart(2, "0")}`;
    const paciente = await prisma.paciente.upsert({
      where: { cpf },
      update: {},
      create: {
        ...p,
        cpf,
        dataNascimento: paraDate(p.dataNascimento),
        responsavel: "Responsável Exemplo",
        diagnostico: "Transtorno do Espectro Autista",
      },
    });
    const convenio = convenios[i % convenios.length];
    await prisma.pacienteConvenio.upsert({
      where: { pacienteId_convenioId: { pacienteId: paciente.id, convenioId: convenio.id } },
      update: {},
      create: {
        pacienteId: paciente.id,
        convenioId: convenio.id,
        numeroCarteirinha: `DEMO-${i + 1}`,
        plano: "Plano Exemplo",
      },
    });
    pacientes.push({ paciente, convenio });
  }

  if ((await prisma.autorizacao.count()) > 0) {
    console.log("Já existem autorizações; dados de exemplo de autorizações não foram recriados.");
    return;
  }

  const exemplos = [
    { i: 0, status: "autorizada", qtd: 20, inicio: somarDias(hoje, -10), fim: somarDias(hoje, 30), usadas: 4 },
    { i: 1, status: "autorizada", qtd: 16, inicio: somarDias(hoje, -20), fim: somarDias(hoje, 5), usadas: 13 },
    { i: 2, status: "pendente", qtd: 10 },
    { i: 3, status: "negada", qtd: 8, motivo: "Procedimento não coberto pelo plano contratado." },
  ] as const;

  for (const e of exemplos) {
    const { paciente, convenio } = pacientes[e.i];
    const aut = await prisma.autorizacao.create({
      data: {
        pacienteId: paciente.id,
        convenioId: convenio.id,
        procedimento: "Sessão de ABA",
        quantidadeSolicitada: e.qtd,
        quantidadeAutorizada: e.status === "autorizada" ? e.qtd : null,
        quantidadeUtilizada: "usadas" in e ? e.usadas : 0,
        status: e.status,
        dataSolicitacao: paraDate(somarDias(hoje, -25)),
        dataInicioVigencia: "inicio" in e ? paraDate(e.inicio) : null,
        dataFimVigencia: "fim" in e ? paraDate(e.fim) : null,
        motivoNegativa: "motivo" in e ? e.motivo : null,
        usuarioCriouId: adminId,
        historico: { create: { statusNovo: e.status, usuarioId: adminId } },
      },
    });

    // Atendimentos espalhados pelos últimos meses, para os gráficos terem dados.
    if (!("inicio" in e)) continue;
    for (let k = 0; k < e.usadas; k++) {
      await prisma.atendimento.create({
        data: {
          pacienteId: paciente.id,
          autorizacaoId: aut.id,
          terapeutaId: terapeutas[0],
          procedimento: "Sessão de ABA",
          // Do dia anterior para trás, sempre dentro da vigência.
          dataAtendimento: paraDate(somarDias(hoje, -(k + 1))),          
          statusCobranca: k === 0 ? "glosado" : "faturado",
          motivoGlosa: k === 0 ? "Exemplo de glosa." : null,
        },
      });
    }
  }
  for (let m = 1; m <= 4; m++) {
    await prisma.atendimento.create({
      data: {
        pacienteId: pacientes[2].paciente.id,
        procedimento: "Avaliação",
        dataAtendimento: paraDate(somarMeses(hoje, -m)),
        semAutorizacao: true,
      },
    });
  }
  console.log("Dados de exemplo criados. Usuários demo: *@demo.local / senha Demo@12345");
}

async function main() {
  const admin = await criarAdmin();
  if (process.argv.includes("--demo")) await criarDemo(admin.id);
}

main()
  .catch((erro) => {
    console.error(`Erro: ${erro instanceof Error ? erro.message : erro}`);
    process.exitCode = 1;
  })
  .finally(() => {
    leitor?.close();
    return prisma.$disconnect();
  });
