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

- **Dashboard** — indicadores (autorizações ativas, pendentes, vencendo,
  glosas, atendimentos sem autorização) e gráficos.
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

## Perfis de acesso

| Tela / ação                         | Admin | Recepção | Terapeuta | Financeiro |
|-------------------------------------|:-----:|:--------:|:---------:|:----------:|
| Dashboard, Configurações (própria senha) | ✅ | ✅ | ✅ | ✅ |
| Pacientes                           | ✅ | ✅ | ✅ |    |
| Convênios (ver)                     | ✅ | ✅ |    | ✅ |
| Convênios (criar/editar)            | ✅ |    |    | ✅ |
| Autorizações                        | ✅ | ✅ |    | ✅ |
| Atendimentos (registrar)            | ✅ | ✅ | ✅ |    |
| Atendimentos (cobrança/glosa)       | ✅ | ✅ |    | ✅ |
| Relatórios                          | ✅ |    |    | ✅ |
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

- Busca de paciente por nome nos formulários (hoje as listas trazem até 200
  pacientes ativos).
- Tela para editar autorização (vigência, protocolo, código TUSS) — a API já
  existe (`PUT /api/autorizacoes/:id`).
- Integração com os convênios (TISS) para solicitar autorizações.
