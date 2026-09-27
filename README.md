# SGA — Fisiomed ABA

Sistema de Gestão de Autorizações. Este README acompanha o andamento do
projeto fase a fase — a Fase 1 (esta) só cria a fundação: projeto Next.js
rodando + banco de dados modelado.

## O que já existe nesta fase

- **`prisma/schema.prisma`** — modelo das 7 entidades do sistema (Paciente,
  Convenio, Autorizacao, HistoricoStatus, Agendamento, Alerta, Usuario) e o
  enum `StatusAutorizacao`, que representa a máquina de estados descrita na
  proposta técnica.
- **`src/lib/prisma.ts`** — conexão reutilizável com o banco.
- **`src/app/`** — esqueleto do Next.js (App Router).

Ainda **não há**: login, telas de cadastro, API de autorizações, dashboard.
Isso vem nas próximas fases, em cima desta base.

## Passo a passo para colocar isso para rodar

### 1. Criar o banco de dados (Neon)

1. Entre em [neon.tech](https://neon.tech) e crie um projeto novo (grátis).
2. No painel, copie a **Connection string** (algo como
   `postgresql://usuario:senha@ep-xxx.neon.tech/neondb?sslmode=require`).

### 2. Configurar as variáveis de ambiente

1. Duplique o arquivo `.env.example` e renomeie a cópia para `.env`.
2. Cole a connection string do Neon em `DATABASE_URL`.
3. Em `JWT_SECRET`, coloque qualquer string longa e aleatória (vamos usar
   isso na Fase 2, para o login).

### 3. Instalar as dependências e criar as tabelas

No terminal, dentro da pasta do projeto:

```bash
npm install
npx prisma migrate dev --name init
```

O segundo comando lê o `schema.prisma` e cria as tabelas de verdade no seu
banco Neon. Se rodar sem erro, o banco já está pronto.

### 4. Rodar localmente

```bash
npm run dev
```

Abra `http://localhost:3000` — deve aparecer a página "SGA — Fisiomed ABA"
confirmando que o projeto e o banco estão conectados.

### 5. Subir para o GitHub

```bash
git init
git add .
git commit -m "chore: fase 1 - esqueleto do projeto e modelo de dados"
git branch -M main
git remote add origin <URL_DO_SEU_REPOSITORIO_NO_GITHUB>
git push -u origin main
```

(Crie o repositório vazio no GitHub antes, pelo site, e copie a URL dele.)

### 6. Colocar no ar (Vercel)

1. No painel da Vercel, clique em "Add New Project" e escolha o repositório
   que você acabou de subir.
2. Em "Environment Variables", adicione `DATABASE_URL` e `JWT_SECRET` com os
   mesmos valores do seu `.env`.
3. Clique em "Deploy".

Depois disso o projeto já está publicado — a cada `git push`, a Vercel
atualiza o site sozinha.

## Próxima fase

Fase 2: cadastro de usuários, login com sessão e o CRUD de pacientes e
convênios.
