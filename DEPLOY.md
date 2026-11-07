# Publicar o Westminster Songs

Arquitetura (tudo no plano gratuito):

| Parte | Onde | Observação |
|---|---|---|
| API (NestJS + Tesseract) | **Google Cloud Run** | Desliga quando ninguém usa; o primeiro acesso depois disso leva alguns segundos |
| Banco (Postgres) | **Neon** | 1 GB grátis, sobra para milhares de cifras |
| App Android | **APK pelo EAS Build (Expo)** | Você manda o link, o grupo instala |

Não precisa de domínio: o Cloud Run dá um endereço `https://...run.app`.

---

## 1. Banco no Neon

1. Crie uma conta em <https://neon.com> e um projeto chamado `westminster`.
2. Região: **AWS US East (Ohio)**, perto do servidor da API (passo 3).
3. Em **Connect**, desligue **Connection pooling** e copie a connection string.
   Ela tem esta cara:
   `postgresql://usuario:senha@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

## 2. Segredos

Você vai precisar de dois valores:

- **Código do grupo** (`GROUP_INVITE_CODE`): o que o pessoal digita para criar conta. Ex.: `coral-westminster-2026`. Passe só para o grupo.
- **Segredo dos logins** (`JWT_SECRET`): 64 caracteres aleatórios. Gere com:
  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Guarde. Se mudar, todo mundo precisa entrar de novo.

## 3. API no Google Cloud Run

1. Entre em <https://console.cloud.google.com>, crie um projeto (ex.: `westminster-songs`) e ative o faturamento (pede cartão, mas o uso do grupo fica dentro da cota grátis).
2. **Crie um alerta de orçamento** em *Faturamento → Orçamentos e alertas*: R$ 5, com aviso por email. Assim, se algo sair do esperado, você fica sabendo antes de virar custo.
3. Abra o **Cloud Shell** (ícone `>_` no topo do console). Ele já tem `gcloud` e `git`, nada para instalar.
4. No Cloud Shell:
   ```
   git clone https://github.com/caiosoares1/westminster-songs.git
   cd westminster-songs/backend
   ```
5. Crie o arquivo `env.yaml` com os segredos (ele está no `.gitignore` e não vai para o GitHub):
   ```
   cat > env.yaml <<'EOF'
   DATABASE_URL: "COLE-A-CONNECTION-STRING-DO-NEON"
   GROUP_INVITE_CODE: "SEU-CODIGO-DO-GRUPO"
   JWT_SECRET: "SEU-SEGREDO-DE-64-CARACTERES"
   EOF
   ```
6. Publique (na primeira vez ele pergunta se pode ativar algumas APIs: responda `Y`):
   ```
   gcloud run deploy westminster-api \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --memory 1Gi \
     --max-instances 2 \
     --env-vars-file env.yaml
   ```
   - `us-central1`: a cota grátis do Cloud Run é calculada com os preços dessa região.
   - `--max-instances 2`: limita quantas cópias da API podem rodar ao mesmo tempo (segurança contra custo).
   - As tabelas do banco são criadas sozinhas quando a API sobe.
7. No final ele mostra a **Service URL** (`https://westminster-api-xxxxx-uc.a.run.app`). Abra no navegador: deve aparecer `Hello World!`.

**Atualizar a API depois:** no Cloud Shell, `cd westminster-songs && git pull && cd backend` e rode o mesmo `gcloud run deploy` do passo 6.

**Ver erros:** `gcloud run services logs read westminster-api --region us-central1`

## 4. APK para Android

No seu computador, na pasta do projeto:

1. Crie uma conta em <https://expo.dev>.
2. Instale e entre:
   ```
   npm install -g eas-cli
   cd mobile
   eas login
   eas init
   ```
   (`eas init` liga o app à sua conta e grava um `projectId` no `app.json`; faça commit dessa mudança.)
3. Em `mobile/eas.json`, troque `https://COLE-AQUI-A-URL-DO-CLOUD-RUN.run.app` pela Service URL do passo 3.7.
4. Gere o APK:
   ```
   eas build --platform android --profile apk
   ```
   O build roda nos servidores da Expo. No plano grátis pode ficar na fila (em horário de pico, mais de uma hora). No fim aparece um link e um QR code.
5. Mande o link no grupo. No Android, a pessoa abre, baixa e permite "instalar apps desta fonte" quando o celular pedir.

**Primeiro acesso:** crie a sua conta **antes** de mandar para o grupo. A primeira conta criada vira **administrador** (pode excluir músicas e gerenciar membros na aba Conta).

**Atualizar o app:** aumente `versionCode` em `mobile/app.json` (1 → 2…), rode o `eas build` de novo e mande o novo link. Quem instalar por cima mantém o login.

## Limites do plano grátis (o que esperar)

- **Primeiro acesso do dia mais lento**: a API desliga quando ninguém usa e leva alguns segundos para acordar. Depois fica rápida.
- **Cloud Run**: 2 milhões de requisições por mês grátis. Um grupo usa uma fração disso.
- **Imagens da API** (Artifact Registry): 0,5 GB grátis. Cada `gcloud run deploy` guarda uma imagem nova; se passar do limite, o custo é de centavos. Dá para apagar as antigas em *Artifact Registry → cloud-run-source-deploy*.
- **Neon**: 1 GB de dados e 100 horas de processamento por mês; o banco também dorme e acorda em fração de segundo.
- **EAS Build**: até 15 builds Android grátis.

## Segurança

- Ninguém usa o app sem conta, e só cria conta quem tem o código do grupo.
- Para impedir novos cadastros (ex.: o código vazou), troque `GROUP_INVITE_CODE` no `env.yaml` e publique de novo. Quem já tem conta continua entrando.
- Para tirar alguém do grupo: aba **Conta** → ícone de remover ao lado do nome. O acesso é cortado na hora.
- Tentativas de login são limitadas a 10 por minuto por IP.
