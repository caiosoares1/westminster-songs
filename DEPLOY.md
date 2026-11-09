# Publicar o Westminster Songs

Tudo grátis, sem cartão:

| Parte | Onde | Observação |
|---|---|---|
| API (NestJS) | **Render** (plano Free) | Fica sempre ligada: ela mesma se acessa a cada 10 min |
| Banco (Postgres) | **Neon** (plano Free) | 1 GB, com backup gerenciado |
| Leitura de fotos (OCR) | **No celular** (ML Kit do Google) | Offline; só no APK, não no Expo Go |
| App Android | **APK pelo EAS Build (Expo)** | Você manda o link, o grupo instala |

Não precisa de domínio: o endereço da API fica `https://westminster-api.onrender.com` (ou parecido).

---

## 1. Banco no Neon

1. Em <https://neon.com>, crie um projeto na região **AWS US East 2 (Ohio)**, a mesma da API no Render.
   (Se você já criou em outra região e ele está vazio, apague e crie de novo em Ohio: cada consulta fica mais rápida.)
2. Em **Connect**, desligue **Connection pooling** e copie a connection string (`postgresql://...neon.tech/neondb?sslmode=require...`).
   Não cole essa string em chats nem no GitHub: ela contém a senha.

## 2. API no Render

1. Crie uma conta em <https://render.com> entrando com o **GitHub** (não pede cartão).
2. **New → Blueprint**, escolha o repositório `westminster-songs`. O Render lê o `render.yaml` e mostra o serviço `westminster-api` (plano Free, região Ohio).
3. Ele pede dois valores:
   - **DATABASE_URL**: a connection string do Neon.
   - **GROUP_INVITE_CODE**: o código que o pessoal digita para criar conta (ex.: `coral-westminster-2026`). Passe só para o grupo.

   O `JWT_SECRET` (segredo dos logins) é gerado sozinho.
4. **Apply**. O primeiro deploy leva uns 5 minutos; as tabelas do banco são criadas sozinhas.
5. Abra o endereço do serviço (aparece no topo da página dele, `https://westminster-api....onrender.com`): deve aparecer `Hello World!`.

A partir daí, **todo push na `main` publica a API de novo** automaticamente.

## 3. Despertador (para a API não dormir)

No plano Free, o Render desliga a API depois de 15 minutos sem acesso, e ela leva cerca de 1 minuto para acordar.

**Não precisa fazer nada:** no Render, a própria API acessa o endereço público dela a cada 10 minutos, e isso conta como acesso. Nos **Logs** aparece `Pinging https://...onrender.com every 10 min` quando ela sobe. (Para desligar: variável `KEEP_ALIVE=false` em *Environment*.)

**Reforço opcional:** se o Render desligar a API por motivo próprio (manutenção, por exemplo), ela só volta quando alguém abrir o app (cerca de 1 minuto) e depois se mantém ligada de novo. Para ela voltar mesmo sem ninguém abrir o app, crie também um cronjob grátis em <https://cron-job.org> com a URL da API, a cada 10 minutos.

O plano Free dá 750 horas por mês, o suficiente para **um** serviço ligado o mês todo. Não crie outro serviço Free na mesma conta do Render, senão as horas acabam antes do fim do mês.

## 4. APK para Android

No seu computador, na pasta do projeto:

```
npm install -g eas-cli
cd mobile
eas login
eas init
```

(`eas init` grava um `projectId` no `app.json`; faça commit dessa mudança.)

Em `mobile/eas.json`, troque `https://COLE-AQUI-A-URL-DA-API` pelo endereço do passo 2.5 e gere o APK:

```
eas build --platform android --profile apk
```

O build roda nos servidores da Expo (no plano grátis pode ficar na fila). No fim aparece um link: mande no grupo. No Android, a pessoa permite "instalar apps desta fonte" quando o celular pedir.

**Crie a sua conta antes de mandar para o grupo:** a primeira conta vira **administrador** (pode excluir músicas e gerenciar membros na aba Conta).

**Atualizar o app:** aumente `versionCode` em `mobile/app.json` (1 → 2…), rode o `eas build` de novo e mande o novo link.

**Importar por foto** usa o reconhecimento de texto do próprio celular, então só funciona no APK. No Expo Go (desenvolvimento), a tela mostra um aviso e dá para colar o texto da cifra.

## Manutenção

| O que | Onde |
|---|---|
| Publicar mudanças da API | Automático a cada push na `main` (Render → *Events* mostra o andamento) |
| Ver erros da API | Render → serviço → **Logs** |
| Trocar o código do grupo | Render → serviço → **Environment** → `GROUP_INVITE_CODE` → salvar (reinicia sozinho) |
| Dados | Ficam no Neon. Se o serviço do Render for apagado, crie outro pelo Blueprint com a mesma connection string |

## Limites do plano grátis

- **Render Free**: 512 MB de memória e CPU modesta; suficiente para a API (o OCR, que era a parte pesada, roda no celular). O Render pode reiniciar serviços Free de vez em quando; a API volta sozinha em segundos.
- **Neon**: 1 GB de dados; dorme quando ninguém usa e acorda em fração de segundo.
- **EAS Build**: até 15 builds Android por mês.

## Segurança

- Ninguém usa o app sem conta, e só cria conta quem tem o código do grupo.
- Para impedir novos cadastros (ex.: o código vazou), troque `GROUP_INVITE_CODE`. Quem já tem conta continua entrando.
- Para tirar alguém do grupo: aba **Conta** → ícone de remover ao lado do nome. O acesso é cortado na hora.
- Tentativas de login são limitadas a 10 por minuto por pessoa (pelo IP real de quem está tentando).
- O `backend/Dockerfile` continua disponível para quem quiser rodar a API em outro lugar com Docker.
