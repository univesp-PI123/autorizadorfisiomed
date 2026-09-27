# SGA — Fisiomed ABA

Sistema de Gestão de Autorizações de Convênios. Centraliza pacientes,
carteirinhas, autorizações e atendimentos para reduzir sessões realizadas sem
cobertura e perdas de receita por glosa.

Aplicação única em **Next.js** (telas + API) com **PostgreSQL**, rodando no
mesmo servidor na **AWS (EC2)**. Não usamos Neon nem Vercel.

> As telas vieram do projeto `frontfisiomed` (React + Express + SQLite), que
> foi incorporado aqui: as telas viraram páginas do Next.js e a API Express
> virou rotas do próprio Next, sobre o PostgreSQL.

## Funcionalidades

- **Visão geral** — indicadores (autorizações ativas, pendentes, vencendo,
  atendimentos do mês), autorizações vencendo, ações rápidas, cobrança e
  gráfico de atendimentos por mês.
- **Pacientes** — cadastro, edição, desativação e carteirinhas de convênio.
- **Convênios** — cadastro de operadoras, prazos e antecedência dos alertas.
- **Autorizações** — ciclo completo com histórico:
  `pendente → em análise → autorizada/negada`, e `vencida`/`esgotada`
  aplicados automaticamente pelo sistema.
- **Atendimentos** — cada sessão consome a autorização do paciente (dentro da
  vigência e do saldo); sessões sem autorização ficam marcadas. Registro de
  cobrança: faturado, pago ou glosado.
- **Alertas** — autorizações vencendo em 7 dias, no topo da tela.
- **Relatórios** — evolução mensal, autorizações por convênio, glosas;
  exportação CSV/JSON.
- **Configurações** — troca da própria senha; gestão de usuários (admin).
- **Agenda e importações** — importação da agenda do AnClinic e da lista de
  profissionais credenciados; situação de cada sessão em relação à
  autorização (veja abaixo).
- **Clínica, unidades, profissionais e procedimentos** — os dados que a guia
  TISS exige (CNES, conselho e CBO, código TUSS).
- **Pedidos médicos** — médico solicitante, CID e os PDFs do pedido, na
  página do paciente.

## Integração AnClinic → Amil (em construção)

Objetivo: solicitar as autorizações sozinho, na véspera (D-1), a partir da
agenda do AnClinic, pelo webservice TISS da Amil. **Etapa atual:** importação
e conferência dos dados. O envio à Amil entra quando ela liberar o acesso ao
webservice.

Rotina:

1. **Importações → Agenda do AnClinic:** no AnClinic, exporte o *Relatório de
   Agendamento* em Excel (um ou mais dias, todas as unidades) e envie o
   `.xlsx`. O relatório mostra o que entrou, os convênios do AnClinic ainda não
   ligados a um convênio do sistema e os avisos, com as linhas da planilha.
   Importar o mesmo dia de novo atualiza; sessões que sumiram da agenda ficam
   como excluídas.
2. **Agenda:** cada sessão aparece como *com pendência* (e o que falta),
   *pronta para solicitar*, *coberta* (autorização vigente com saldo ou senha
   no AnClinic), *fora da integração* (outros convênios, ou faturamento por
   "Assinatura") ou *cancelada*. "O que falta para solicitar" agrupa as
   pendências e leva à tela onde se resolve cada uma.

Preparação (uma vez):

- **Convênios → Amil:** "Solicitação de autorização" = Webservice TISS Amil,
  código do prestador e, em "Nomes na agenda do AnClinic", o nome exato da
  coluna Convênio (ex.: `Amil Assitencia Medica Internacional S.a.`).
- **Importações → Profissionais credenciados:** planilha com Nome, CPF,
  Conselho, Número no conselho, UF e Especialidades, escolhendo o convênio. O
  CBO é sugerido pela especialidade; confira em **Profissionais**.
- **Clínica e unidades:** razão social, CNPJ e o CNES de cada unidade (as
  unidades são criadas pela importação da agenda).
- **Procedimentos:** o código TUSS de cada procedimento do AnClinic (4440,
  4415…), o mesmo usado hoje no portal da Amil.
- **Pacientes → Pedidos médicos:** médico solicitante (CRM/UF), CID, validade
  e os PDFs (até 5, 10 MB cada).

Os PDFs ficam em disco, fora da pasta pública, em `ARQUIVOS_DIR` (padrão:
`dados/arquivos` dentro do projeto) e só são abertos com login. Entram no
backup (passo 9).

## Visual (design system Sóbrio)

A interface segue o design system **Sóbrio**: bordas finas em vez de sombras,
um único rosa de destaque, status em badges discretos, números em fonte mono
(IBM Plex Mono) e texto em IBM Plex Sans. Tem **tema claro e escuro** (botão
na barra superior; a escolha fica salva no navegador).

- `src/styles/sobrio/` — `tokens.css` e `sobrio.css` do pacote do design
  system, **sem alterações**. Para atualizar o design system, substitua esses
  dois arquivos.
- `src/styles/app.css` — complementos do sistema (estrutura das telas, modal,
  formulários, gráficos), usando só os tokens do Sóbrio.
- `public/fundo-login.webp` — imagem de fundo do login.
- **Logos** (`public/marca/`): `logo-fisiomed.png` (colorido, horizontal),
  `logo-fisiomed-branco.webp` (branco, empilhado) e `logo-simbolo.png` (só o
  "O" de quebra-cabeça, recortado do colorido). Uso:
  - menu recolhido → símbolo; menu expandido → logo horizontal (em branco no
    tema escuro);
  - login → horizontal colorido no tema claro, branco empilhado no escuro;
  - o símbolo também é o ícone da aba do navegador (`src/app/icon.png`).
  Para trocar um logo, substitua o arquivo mantendo o nome.

As fontes são baixadas do Google Fonts **durante o `npm run build`** e
servidas pelo próprio site (o navegador dos usuários não acessa o Google).
Por isso o servidor precisa de acesso à internet na hora do build.

## Ambientes (tenants)

No lugar do antigo "Sistema conectado", a barra superior mostra o ambiente em
uso (`autofisiomed.cftconsult.com.br`) e um ponto de status: **verde**
conectado, **âmbar** sem resposta do servidor. Ao clicar, abre a lista de
ambientes.

O modelo é **um subdomínio por cliente**, cada um com a própria instalação e
o próprio banco — trocar de ambiente é abrir o endereço do outro cliente, que
tem o seu próprio login. A lista fica em `src/lib/ambientes.ts`; para um novo
cliente, instale a aplicação no subdomínio dele e acrescente-o ali. (Ainda
não existe um login único entre ambientes; cada um autentica separadamente.)

## Acessibilidade

- **Painel de acessibilidade** (ícone de pessoa na barra superior e no canto
  do login), com as escolhas salvas no navegador:
  - tamanho do texto: 100%, 112%, 125% e 150% (em telas de celular o painel
    orienta a usar o zoom do próprio aparelho);
  - alto contraste (textos, bordas e foco mais fortes, nos dois temas);
  - sublinhar links;
  - reduzir animações (a preferência do sistema operacional também vale);
  - **VLibras**, o tradutor de Libras do governo federal — só é carregado
    quando a pessoa ativa, para o site não chamar o gov.br sem necessidade.
- Tema claro e escuro.
- Navegação completa por teclado: link "Ir para o conteúdo" no primeiro Tab,
  submenus que abrem no foco, modais que prendem o foco e fecham com Esc.
- Rótulos e papéis para leitores de tela (menus, diálogos, tabelas, status),
  gráficos com tabela equivalente oculta, cores de gráfico validadas para
  daltonismo e texto com contraste mínimo WCAG AA.
- Verificado com o **axe-core** (regras WCAG 2.1 A/AA): nenhuma violação em
  todas as telas, nos temas claro e escuro e no alto contraste.

## Perfis de acesso

| Tela / ação                         | Admin | Recepção | Terapeuta | Financeiro |
|-------------------------------------|:-----:|:--------:|:---------:|:----------:|
| Visão geral, Configurações (própria senha) | ✅ | ✅ | ✅ | ✅ |
| Pacientes                           | ✅ | ✅ | ✅ |    |
| Convênios (ver)                     | ✅ | ✅ |    | ✅ |
| Convênios (criar/editar)            | ✅ |    |    | ✅ |
| Autorizações                        | ✅ | ✅ |    | ✅ |
| Atendimentos (registrar)            | ✅ | ✅ | ✅ |    |
| Atendimentos (ver)                  | ✅ | ✅ | ✅ | ✅ |
| Atendimentos (cobrança/glosa)       | ✅ | ✅ |    | ✅ |
| Relatórios                          | ✅ |    |    | ✅ |
| Agenda, histórico de importações, cadastros da integração (ver) | ✅ | ✅ |    | ✅ |
| Importar planilhas; editar profissionais e procedimentos | ✅ | ✅ |    |    |
| Dados da clínica e unidades (editar) | ✅ |    |    |    |
| Pedidos médicos (ver)               | ✅ | ✅ | ✅ |    |
| Pedidos médicos (cadastrar)         | ✅ | ✅ |    |    |
| Gestão de usuários                  | ✅ |    |    |    |

As permissões são verificadas na API, não só escondidas na tela.

## Estrutura de pastas

```
.
├── .env.example            # modelo das variáveis de ambiente
├── prisma/
│   ├── schema.prisma       # modelo de dados
│   ├── migrations/         # SQL versionado, aplicado com "migrate deploy"
│   └── seed.ts             # cria o primeiro administrador (e dados de teste)
├── src/
│   ├── app/
│   │   ├── (sistema)/      # telas internas (exigem login)
│   │   ├── login/          # tela de login
│   │   └── api/            # API REST (route handlers)
│   ├── components/         # layout, modal, tabelas, badges...
│   ├── contextos/          # sessão e alertas
│   └── lib/                # regras de negócio, validação, sessão, datas
└── tests/                  # testes automatizados (npm test)
```

> **Atenção ao subir arquivos pelo site do GitHub:** o upload pelo navegador
> coloca tudo na raiz e perde as pastas. Prefira `git push` pelo terminal.

---

## Instalação no servidor AWS (EC2)

Os comandos abaixo foram escritos para **Debian 13 (trixie)** — a imagem
oficial do Debian na AWS. Também funcionam no Debian 12 e no Ubuntu.

### 1. Liberar as portas no Security Group

No console da AWS → EC2 → sua instância → aba *Security* → Security Group →
*Edit inbound rules*:

| Porta | Origem         | Para quê                     |
|-------|----------------|------------------------------|
| 22    | **Seu IP**     | acesso SSH                   |
| 80    | 0.0.0.0/0      | site (HTTP)                  |
| 443   | 0.0.0.0/0      | site (HTTPS)                 |

**Não abra a porta 5432 (PostgreSQL).** O banco só é acessado pela própria
máquina; deixá-lo exposto na internet é um risco sério, ainda mais com dados
de pacientes (LGPD).

### 2. Instalar Node.js, PostgreSQL, Nginx e Git

Conecte via SSH. Na imagem oficial do Debian na AWS o usuário é **`admin`**
(não `ubuntu` nem `ec2-user`):

```bash
ssh -i sua-chave.pem admin@IP_PUBLICO_DA_INSTANCIA
```

E rode:

```bash
sudo apt update && sudo apt upgrade -y

# Ferramentas básicas (a imagem do Debian é mínima e pode não trazê-las)
sudo apt install -y curl ca-certificates gnupg openssl cron

# Node.js 22 (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx postgresql
# (o Debian 13 instala o PostgreSQL 17)

# Gerenciador que mantém a aplicação rodando e reinicia no boot
sudo npm install -g pm2
```

Confira: `node -v` (deve mostrar v22.x; o mínimo aceito pelo Next.js 16 é
v20.9) e `sudo systemctl status postgresql`.

**Instância pequena (t2/t3.micro, 1 GB de RAM)?** O `npm run build` pode
travar por falta de memória. Crie um swap de 2 GB antes:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3. Criar o banco e o usuário

Gere uma senha forte (`openssl rand -hex 24`) e use no lugar de `SENHA_FORTE`:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER sga WITH PASSWORD 'SENHA_FORTE';
CREATE DATABASE sga OWNER sga;
SQL
```

Por padrão, o PostgreSQL do Debian só aceita conexões da própria máquina
(`localhost`) — é exatamente o que queremos.

### 4. Baixar o projeto e configurar o `.env`

```bash
cd ~
git clone https://github.com/thiagobelina/autorizadorfisiomed.git
cd autorizadorfisiomed

cp .env.example .env
nano .env
```

No `.env`:

- `DATABASE_URL="postgresql://sga:SENHA_FORTE@localhost:5432/sga?schema=public"`
- `JWT_SECRET=` → cole o resultado de `openssl rand -base64 48`

> Se o repositório for privado, o `git clone` vai pedir usuário e senha. Use
> um *Personal Access Token* do GitHub (Settings → Developer settings) como
> senha, ou configure uma *Deploy key* SSH no repositório.

### 5. Instalar dependências, criar as tabelas e compilar

```bash
npm ci
npx prisma migrate deploy
npm run db:seed
npm run build
```

- `npm ci` instala exatamente as versões do `package-lock.json`.
  Ao final ele deve mostrar `found 0 vulnerabilities`. Se um dia aparecerem
  vulnerabilidades, **não rode `npm audit fix --force`** direto no servidor:
  ele pode trocar versões principais e quebrar a aplicação. Corrija no
  computador de desenvolvimento, teste e envie o `package-lock.json` pelo Git.
- `prisma migrate deploy` aplica o SQL de `prisma/migrations/` no banco.
  (No servidor usamos `deploy`, **não** `migrate dev` — veja a seção de
  desenvolvimento abaixo.)
- `npm run db:seed` cria o **primeiro administrador**: pergunta nome, e-mail e
  senha (a senha não aparece enquanto você digita). Os demais usuários são
  criados depois, pela tela *Configurações*. Pode rodar de novo sem risco: se
  o e-mail já existir, nada muda.

Para conferir as tabelas: `sudo -u postgres psql -d sga -c '\dt'`

### 6. Deixar a aplicação rodando com PM2

```bash
pm2 start npm --name sga -- start
pm2 save
pm2 startup      # copie e rode o comando "sudo env PATH=..." que ele imprimir
```

A aplicação agora roda na porta 3000 e volta sozinha se a máquina reiniciar.
Comandos úteis: `pm2 status`, `pm2 logs sga`, `pm2 restart sga`.

### 7. Publicar na porta 80 com Nginx

```bash
sudo tee /etc/nginx/sites-available/sga > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;   # troque pelo seu domínio, se tiver

    # Planilhas do AnClinic e PDFs dos pedidos médicos (o padrão do Nginx é 1 MB)
    client_max_body_size 60m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

sudo ln -s /etc/nginx/sites-available/sga /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Abra `http://IP_PUBLICO_DA_INSTANCIA` no navegador — deve aparecer a tela de
login. Entre com o administrador criado no passo 5.

> **Dica:** associe um *Elastic IP* à instância (EC2 → Elastic IPs). Sem ele,
> o IP público muda toda vez que a máquina é parada e ligada.

### 8. HTTPS (necessário antes de usar com dados reais)

Sem HTTPS, a senha e os dados dos pacientes trafegam abertos pela internet.

Precisa de um domínio apontando (registro A) para o IP da instância. Com o
`server_name` do Nginx ajustado para esse domínio:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com.br
```

O certificado é renovado automaticamente. A aplicação percebe o HTTPS pelo
Nginx e passa a marcar o cookie de sessão como `Secure` sozinha.

### 9. Backup do banco

O banco agora é responsabilidade sua (no Neon o backup era automático).
Backup diário às 3h, mantendo 14 dias:

```bash
mkdir -p ~/backups
crontab -e
```

Adicione a linha:

```
0 3 * * * pg_dump "postgresql://sga:SENHA_FORTE@localhost:5432/sga" | gzip > ~/backups/sga-$(date +\%F).sql.gz && find ~/backups -name 'sga-*.sql.gz' -mtime +14 -delete
```

Os PDFs dos pedidos médicos não estão no banco: inclua a pasta deles no backup
(outra linha no `crontab -e`):

```
30 3 * * * tar -czf ~/backups/arquivos-$(date +\%F).tar.gz -C ~/autorizadorfisiomed dados && find ~/backups -name 'arquivos-*.tar.gz' -mtime +14 -delete
```

Esses arquivos ficam no mesmo disco da máquina — se ela for perdida, os
backups também vão. Vale copiá-los para um bucket S3 ou ativar snapshots
automáticos do volume EBS (EC2 → Lifecycle Manager).

Para restaurar: `gunzip -c ARQUIVO.sql.gz | psql "postgresql://sga:SENHA_FORTE@localhost:5432/sga"`

### Atualizar o servidor depois de um `git push`

```bash
cd ~/autorizadorfisiomed
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart sga
```

> **Atualizando para a versão com importação do AnClinic:** o `migrate deploy`
> cria as tabelas novas (nada é apagado). Ajuste também o Nginx para aceitar
> uploads maiores: acrescente `client_max_body_size 60m;` dentro do bloco
> `server` em `/etc/nginx/sites-available/sga` (e no bloco criado pelo
> certbot, se for outro) e rode `sudo nginx -t && sudo systemctl reload nginx`.

Para conferir se subiu: `curl -s localhost:3000/api/health` deve responder
`{"status":"ok",...}` (só responde "ok" se o banco estiver acessível).

### Vindo da Fase 1 (servidor já instalado)

Se o servidor foi instalado com a versão anterior (Fase 1, só a página
inicial), a atualização é a de cima, **mais um passo: criar o administrador**:

```bash
cd ~/autorizadorfisiomed
git pull
npm ci
npx prisma migrate deploy   # troca as tabelas da Fase 1 pelas do sistema
npm run db:seed             # cria o primeiro administrador
npm run build
pm2 restart sga
```

A migração `sistema_integrado` **apaga as tabelas da Fase 1** e cria as novas.
Elas não eram usadas por nenhuma tela, então devem estar vazias — mas, se
você inseriu algo nelas manualmente, faça um backup antes (passo 9).

---

## Desenvolvimento local (no seu computador)

1. Instale o PostgreSQL localmente e crie banco e usuário como no passo 3.
   Para desenvolvimento, dê ao usuário permissão de criar bancos — o Prisma
   precisa disso para o `migrate dev` (ele usa um banco temporário de
   comparação):

   ```sql
   ALTER USER sga CREATEDB;
   ```

   **Não** faça isso no servidor de produção.

2. `cp .env.example .env` e ajuste a `DATABASE_URL` e o `JWT_SECRET`.
3. `npm install`
4. `npx prisma migrate deploy` (cria as tabelas a partir das migrações)
5. `npm run db:seed -- --demo` — cria o administrador e **dados fictícios**
   para testar (convênios, pacientes, autorizações, atendimentos e usuários
   `recepcao@demo.local`, `terapeuta@demo.local`, `financeiro@demo.local`,
   todos com a senha `Demo@12345`). **Nunca use `--demo` no servidor.**
6. `npm run dev` e abra `http://localhost:3000`.

### Verificações

```bash
npm test          # testes automatizados
npm run lint      # padrões de código
npx tsc --noEmit  # checagem de tipos
```

### Mudando o modelo de dados

Ao alterar o `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name descricao-da-mudanca
```

Isso gera uma nova pasta em `prisma/migrations/`. Faça commit dela junto com
o schema — no servidor, o `migrate deploy` vai aplicá-la.

## Próximos passos sugeridos

- Recuperação de senha por e-mail (o link "Esqueci minha senha" do login já
  existe, mas por enquanto só orienta a procurar o administrador).

- Busca de paciente por nome nos formulários (hoje as listas trazem até 200
  pacientes ativos).
- Tela para editar autorização (vigência, protocolo, código TUSS) — a API já
  existe (`PUT /api/autorizacoes/:id`).
- Envio das solicitações à Amil pelo webservice TISS (aguardando a liberação
  do acesso), consulta do status e relatório do que foi aprovado ou negado.
