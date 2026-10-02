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

- **Visão geral** — o trabalho do dia: quantas sessões há a solicitar, pedidos
  aguardando a operadora, negativas da semana para tratar e atendimentos de
  hoje; quantidades do mês e gráfico de atendimentos por mês.
- **Autorizações** — a lista **A solicitar hoje**, montada da agenda do
  AnClinic (veja abaixo), e o ciclo completo de cada pedido, com histórico:
  `pendente → em análise → autorizada/negada`, e `vencida`/`esgotada`
  aplicados automaticamente pelo sistema.
- **Atendimentos** — gerados a partir da agenda: ao aprovar uma autorização,
  as sessões que ela cobre viram atendimentos *aguardando confirmação*; no dia
  da sessão, a recepção confirma (desconta a sessão da autorização) ou cancela,
  com motivo. Registro manual só pelo operador e só no dia, em sessões de 1
  hora (início em hora cheia ou meia hora). Cobrança: faturado, pago ou
  glosado, com motivo da glosa em lista.
- **Sem valores em R$** — a clínica analisa por número de atendimentos (os
  valores mudam caso a caso, como nas liminares), então o sistema só conta.
- **Alertas** — autorizações lançadas à mão vencendo em 7 dias, no topo da
  tela (os pedidos semanais da lista do dia não entram: vencer é o normal).
- **Relatórios** — evolução mensal, autorizações por convênio, glosas;
  exportação CSV/JSON.
- **Configurações** — troca da própria senha; gestão de usuários (admin).
- **Importações** — lista de profissionais credenciados, tabelas de
  procedimentos e documentos dos pacientes (por pasta); histórico com o
  relatório de cada importação. A agenda do dia é importada em Autorizações.
- **Clínica, unidades, profissionais e procedimentos** — os dados que a guia
  TISS exige (CNES, conselho, código TUSS).
- **Pedidos médicos e plano terapêutico** — médico solicitante, CID, sessões
  por semana e os PDFs, na página do paciente; o pedido novo substitui o
  anterior.

A agenda em si continua no AnClinic: o sistema só a importa para saber o que
pedir e o que confirmar.

## Integração AnClinic → Amil (em construção)

Objetivo: a pessoa que chega de manhã importa a agenda, o sistema pede as
autorizações (na véspera, pelo webservice TISS da Amil) e a equipe só trata
as negativas. **Etapa atual:** a lista do dia e os pedidos já saem do
sistema; o envio à Amil entra quando ela liberar o acesso ao webservice — até
lá, o pedido é feito no portal.

Rotina do dia, em **Autorizações**:

1. **Importar agenda do dia:** no AnClinic, exporte o *Relatório de
   Agendamento* em Excel, de hoje e amanhã, com todas as unidades, e envie o
   `.xlsx`. O relatório mostra o que entrou, os convênios ainda não ligados a
   um convênio do sistema, as unidades tiradas da sala e os avisos. Importar
   de novo atualiza; sessões que sumiram da agenda ficam como excluídas.
2. **A solicitar hoje:** o pedido de cada sessão é feito na **véspera**, porque
   a senha da Amil vale a semana (de segunda a sexta): na segunda, pedem-se as
   de segunda e de terça; de terça a quinta, as do dia seguinte; na sexta,
   nenhuma da segunda (a senha não valeria). As sessões vêm agrupadas como vão
   virar pedidos — paciente, procedimento e unidade — em:
   - **Prontas:** têm tudo o que a guia exige.
   - **Com pendência:** o que falta e onde resolver; a unidade que faltar é
     escolhida ali mesmo.
   - **Atendimento escolar** (sala "… - ATENDIMENTO ESCOLAR"): fica fora do
     lote; pede-se no dia, quando o profissional confirma que está com a
     criança na escola (*Pedir agora*).
   - **Negadas:** ver a negativa e, resolvido o motivo, *Pedir de novo*.
   - **Já pedidas:** enviadas ou autorizadas.
3. **Gerar pedidos:** cria os pedidos (status *pendente*) das prontas, com a
   unidade (CNES), o código da guia, a quantidade de sessões e a vigência até a
   sexta. Enquanto o webservice da Amil não é liberado, o pedido é feito no
   portal e o resultado registrado no pedido (*em análise* → *autorizada*, com
   a senha, ou *negada*, com o motivo); com o webservice, envio e resposta
   serão automáticos. Gerar de novo não duplica; pedidos do mesmo dia ainda não
   enviados recebem as sessões novas.
4. **Reimportação:** pedidos ainda não enviados acompanham a agenda — sessão
   desmarcada ou excluída sai do pedido (sem nenhuma, ele é cancelado) e sessão
   remarcada para outra semana volta para a lista.
5. **Atendimentos:** aprovado o pedido, as sessões dele vão para Atendimentos,
   *aguardando confirmação*. A recepção confirma **no dia da sessão** — antes ou
   depois não dá, para a validação não ficar com a data errada; se a sessão
   não aconteceu, cancela com o motivo.

Uma autorização lançada à mão (*Nova autorização*) cobre as sessões da
vigência pelo código do procedimento ou pelo nome/especialidade (ex.:
"Psicologia" cobre "PSICOLOGIA ABA"); um pedido gerado pela lista cobre só as
sessões dele.

**Unidade de atendimento:** define o CNES do pedido. Vem da coluna "Unidade de
Atendimento" do AnClinic; em branco, do começo da sala ("SÃO MIGUEL - SALA 31"
→ FISIOMED ABA SAO MIGUEL). Quando nem assim aparece, escolha a unidade na
lista *A solicitar*; a escolha feita no sistema não é desfeita pelas próximas
importações. Unidades que não existem no AnClinic podem ser criadas em
**Clínica e unidades**.

**Busca de paciente:** nas autorizações (lista e nova autorização) e no
registro de atendimento, um campo único acha o paciente pelo nome, CPF ou
número da carteirinha.

Preparação (uma vez):

- **Convênios → Amil:** "Solicitação de autorização" = Webservice TISS Amil,
  código do prestador e, em "Nomes na agenda do AnClinic", o nome exato da
  coluna Convênio (ex.: `Amil Assitencia Medica Internacional S.a.`).
- **Importações → Profissionais credenciados:** planilha com Nome, CPF,
  Conselho, Número no conselho, UF e Especialidades, escolhendo o convênio. O
  CBO é sugerido pela especialidade; confira em **Profissionais**.
- **Clínica e unidades:** razão social, CNPJ e o CNES de cada unidade (as
  unidades são criadas pela importação da agenda).
- **Procedimentos:** o de/para de cada procedimento do AnClinic (4440,
  4415…) para o código da operadora e o código TUSS (tabela 22) — veja
  abaixo.
- **Documentos:** planos terapêuticos e pedidos médicos — veja abaixo.

### Procedimentos: AnClinic → operadora → TUSS

Três tabelas, na tela **Procedimentos**:

- **Equivalências:** cada procedimento do AnClinic, o equivalente na tabela
  da operadora escolhida e o código TUSS. "Na guia" é o código que vai na
  solicitação: o da operadora, ou o TUSS quando não há equivalente.
- **Tabela da operadora:** importada por planilha (`.xlsx` ou `.csv` com `;`)
  com as colunas `Código AnClinic` (opcional — faz o de/para), `Código
  Operadora`, `Descrição Operadora`, `Código TUSS` e `Tabela`. Há um modelo
  para baixar na tela. Reimportar atualiza pelo código da operadora;
  cada operadora tem a sua tabela.
- **TUSS (tabela 22):** a planilha publicada pela ANS (colunas `Código do
  Termo` e `Termo`), usada para mostrar o nome de cada código.

### Documentos: planos terapêuticos e pedidos médicos

Validade do pedido médico: a informada ou, em branco, **1 ano** a partir da
data do pedido (vale também para o pedido criado pelo plano terapêutico).

Onde ficam: os dados do pedido médico (médico, CRM, CID, data, validade e as
sessões por semana do plano) na tabela `pedidos_medicos`; cada PDF na tabela
`documentos` (tipo, paciente, pedido, tamanho e hash SHA-256 — o mesmo
arquivo não entra duas vezes para o mesmo paciente) e o arquivo em disco, em
`ARQUIVOS_DIR/documentos/AAAA-MM/`. `ARQUIVOS_DIR` é, por padrão,
`dados/arquivos` dentro do projeto; fica fora da pasta pública, os PDFs só
abrem com login, e a pasta entra no backup (passo 9).

**Pedido novo substitui o anterior:** ao cadastrar um pedido médico (ou
quando o plano terapêutico cria um), os pedidos mais antigos do paciente saem
do sistema com os PDFs — o histórico fica no arquivo da clínica. No cadastro
manual dá para marcar *Manter os pedidos anteriores*, para o paciente com dois
pedidos valendo (um para outra terapia, por exemplo). O mesmo vale para o
plano terapêutico de um pedido; um plano mais antigo que o pedido atual do
paciente nem entra.

**Envio em lote** (Importações → Documentos):

- **Pasta de pacientes** — escolha a pasta que tem uma pasta por paciente,
  com o nome dele: não é preciso renomear os arquivos. De cada paciente entram
  só os PDFs que estão direto na pasta dele (o pedido médico e o plano
  terapêutico mais recentes); subpastas, como a de documentos antigos, e
  arquivos de liminar ficam de fora. Também dá para escolher a pasta de um
  paciente só.
- **PDFs soltos** — o paciente é achado pelo **CPF** no nome do arquivo
  (`123.456.789-09_pedido.pdf`) ou pelo **número da carteirinha**.
- No plano terapêutico, também pelo **nome e data de nascimento** escritos no
  PDF (aceita nome abreviado no AnClinic: mesmo primeiro nome e dois nomes em
  comum).

O **plano terapêutico da Amil** (formulário de terapias para TGD, gerado pelo
Word) é lido: médico prescritor, CRM, CID, data da solicitação e as sessões de
cada especialidade por dia da semana. Ele cria o pedido médico do paciente (a
UF do CRM não está no formulário: fica SP, com aviso para conferir). Os
demais PDFs entram no pedido ativo mais recente; sem pedido, ficam como
"documentos sem pedido" na página do paciente, onde podem ser ligados depois.
Arquivo sem paciente não é gravado: o relatório diz o motivo.

O plano aparece na tela da autorização (com a linha do procedimento em
destaque) e preenche a nova autorização: convênio, procedimento, unidade e
código da guia vindos da agenda, e a quantidade = sessões por semana do plano
(a senha vale a semana).

## Visual (design system Sóbrio)

A interface segue o design system **Sóbrio** — bordas finas em vez de
sombras, um único destaque, status em badges discretos, números em fonte mono
(IBM Plex Mono) e texto em IBM Plex Sans — com a **paleta da Fisiomed**: o
azul-marinho da logo como destaque, fundo neutro, e o verde, o amarelo e o
vermelho da logo nos gráficos e no fundo do login. Tem **tema claro e escuro**
(botão na barra superior; a escolha fica salva no navegador).

- `src/styles/sobrio/` — `tokens.css` e `sobrio.css` do pacote do design
  system, **sem alterações**. Para atualizar o design system, substitua esses
  dois arquivos.
- `src/styles/app.css` — a paleta da Fisiomed (sobrepõe as cores do Sóbrio,
  nos temas claro, escuro e no alto contraste), o fundo do login em gradiente
  e os complementos do sistema (estrutura das telas, modal, formulários,
  gráficos).
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
| Atendimentos (registrar, confirmar ou cancelar) | ✅ | ✅ |    |    |
| Atendimentos (ver)                  | ✅ | ✅ | ✅ | ✅ |
| Atendimentos (cobrança/glosa)       | ✅ | ✅ |    | ✅ |
| Relatórios                          | ✅ |    |    | ✅ |
| Lista do dia (A solicitar): ver e gerar pedidos | ✅ | ✅ |    | ✅ |
| Importar a agenda do dia; definir a unidade das sessões | ✅ | ✅ |    |    |
| Histórico de importações, cadastros da integração (ver) | ✅ | ✅ |    | ✅ |
| Importar planilhas; editar profissionais e procedimentos | ✅ | ✅ |    |    |
| Dados da clínica e unidades (editar) | ✅ |    |    |    |
| Pedidos médicos e documentos (ver)  | ✅ | ✅ | ✅ |    |
| Pedidos médicos e documentos (enviar) | ✅ | ✅ |    |    |
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
git clone https://github.com/thiagobelina/autorizamais.git
cd autorizamais

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
30 3 * * * tar -czf ~/backups/arquivos-$(date +\%F).tar.gz -C ~/autorizamais dados && find ~/backups -name 'arquivos-*.tar.gz' -mtime +14 -delete
```

Esses arquivos ficam no mesmo disco da máquina — se ela for perdida, os
backups também vão. Vale copiá-los para um bucket S3 ou ativar snapshots
automáticos do volume EBS (EC2 → Lifecycle Manager).

Para restaurar: `gunzip -c ARQUIVO.sql.gz | psql "postgresql://sga:SENHA_FORTE@localhost:5432/sga"`

### Atualizar o servidor depois de um `git push`

> **Repositório renomeado para `autorizamais`:** num servidor já instalado,
> aponte o git para o endereço novo e, se quiser, renomeie a pasta (o PM2
> precisa ser recriado a partir da pasta nova):
>
> ```bash
> cd ~/autorizadorfisiomed
> git remote set-url origin https://github.com/thiagobelina/autorizamais.git
> # opcional: renomear a pasta
> pm2 delete sga && cd ~ && mv autorizadorfisiomed autorizamais && cd autorizamais
> pm2 start npm --name sga -- start && pm2 save
> ```
>
> Se `ARQUIVOS_DIR` no `.env` tiver o caminho antigo, corrija-o também.

```bash
cd ~/autorizamais
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart sga
```

> **Atualizando para a versão da lista do dia (sem a Agenda):** o `migrate
> deploy` liga cada sessão ao pedido gerado para ela, guarda a unidade no
> pedido e **apaga as colunas de valores em R$** (valor cobrado e pago dos
> atendimentos, valor do faturamento da agenda e valor da tabela da
> operadora). Se quiser guardar esses valores, faça um backup antes (passo 9).

> **Atualizando para a versão com documentos em lote e atendimentos
> automáticos:** o `migrate deploy` cria as tabelas de documentos e de
> procedimentos da operadora e passa os PDFs já anexados aos pedidos médicos
> para a tabela nova (os arquivos em disco não mudam de lugar). Os
> atendimentos existentes ficam como confirmados.

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
cd ~/autorizamais
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

- Tela para editar autorização (vigência, protocolo, código TUSS) — a API já
  existe (`PUT /api/autorizacoes/:id`).
- Envio das solicitações à Amil pelo webservice TISS (aguardando a liberação
  do acesso), consulta do status e relatório do que foi aprovado ou negado.
- Situação da validação na Amil (token/QR code) de cada atendimento ainda no
  dia, se o webservice informar — para agir antes de a criança ir embora.
- Regras de solicitação por convênio: Bradesco (pedido semanal, às quintas) e
  São Cristóvão (carta crédito, com código próprio por paciente).
- Coluna "Observação" do AnClinic no relatório mensal (BSC).
- Unidades de Joinville, que estão em outro acesso do AnClinic.
