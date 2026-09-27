# SGA — Fisiomed ABA

Sistema de Gestão de Autorizações. Este README acompanha o andamento do
projeto fase a fase — a Fase 1 (esta) só cria a fundação: projeto Next.js
rodando + banco de dados modelado.

A aplicação e o banco PostgreSQL rodam **no mesmo servidor na AWS (EC2)**.
Não usamos Neon nem Vercel.

## O que já existe nesta fase

- **`prisma/schema.prisma`** — modelo das 7 entidades do sistema (Paciente,
  Convenio, Autorizacao, HistoricoStatus, Agendamento, Alerta, Usuario) e o
  enum `StatusAutorizacao`, que representa a máquina de estados descrita na
  proposta técnica.
- **`prisma/migrations/`** — o SQL que cria as tabelas. É versionado no Git
  para que o servidor aplique exatamente as mesmas mudanças.
- **`src/lib/prisma.ts`** — conexão reutilizável com o banco.
- **`src/app/`** — esqueleto do Next.js (App Router).

Ainda **não há**: login, telas de cadastro, API de autorizações, dashboard.
Isso vem nas próximas fases, em cima desta base.

## Estrutura de pastas

```
.
├── .env.example          # modelo das variáveis de ambiente
├── prisma/
│   ├── schema.prisma     # modelo de dados
│   └── migrations/       # SQL gerado a partir do schema
└── src/
    ├── app/              # páginas (Next.js App Router)
    └── lib/prisma.ts     # cliente do banco
```

> **Atenção ao subir arquivos pelo site do GitHub:** o upload pelo navegador
> coloca tudo na raiz e perde as pastas. Prefira `git push` pelo terminal.

---

## Instalação no servidor AWS (EC2)

Os comandos abaixo assumem **Ubuntu 22.04 ou 24.04**. Se a sua instância for
Amazon Linux, troque `apt` por `dnf` (os nomes dos pacotes mudam um pouco).

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

Conecte via SSH e rode:

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 22 (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx postgresql

# Gerenciador que mantém a aplicação rodando e reinicia no boot
sudo npm install -g pm2
```

Confira: `node -v` (deve mostrar v22.x) e `sudo systemctl status postgresql`.

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

Por padrão, o PostgreSQL do Ubuntu só aceita conexões da própria máquina
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
npm run build
```

- `npm ci` instala exatamente as versões do `package-lock.json`.
- `prisma migrate deploy` aplica o SQL de `prisma/migrations/` no banco.
  (No servidor usamos `deploy`, **não** `migrate dev` — veja a seção de
  desenvolvimento abaixo.)

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

Abra `http://IP_PUBLICO_DA_INSTANCIA` no navegador — deve aparecer a página
"SGA — Fisiomed ABA".

> **Dica:** associe um *Elastic IP* à instância (EC2 → Elastic IPs). Sem ele,
> o IP público muda toda vez que a máquina é parada e ligada.

### 8. HTTPS (recomendado antes de ter login)

Precisa de um domínio apontando (registro A) para o IP da instância. Com o
`server_name` do Nginx ajustado para esse domínio:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com.br
```

O certificado é renovado automaticamente.

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

2. `cp .env.example .env` e ajuste a `DATABASE_URL`.
3. `npm install`
4. `npx prisma migrate deploy` (cria as tabelas a partir das migrações)
5. `npm run dev` e abra `http://localhost:3000`.

### Mudando o modelo de dados

Ao alterar o `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name descricao-da-mudanca
```

Isso gera uma nova pasta em `prisma/migrations/`. Faça commit dela junto com
o schema — no servidor, o `migrate deploy` vai aplicá-la.

## Próxima fase

Fase 2: cadastro de usuários, login com sessão e o CRUD de pacientes e
convênios.
