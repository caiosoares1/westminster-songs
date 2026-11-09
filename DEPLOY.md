# Publicar o Westminster Songs

Tudo grátis, sem cartão:

| Parte | Onde | Observação |
|---|---|---|
| API (NestJS) | **Render** (plano Free) | Fica sempre ligada: ela mesma se acessa a cada 10 min |
| Banco (Postgres) | **Neon** (plano Free) | 1 GB, com backup gerenciado |
| Leitura de fotos (OCR) | **No celular** (ML Kit do Google) | Offline; só no APK, não no Expo Go |
| App Android | **APK compilado pelo GitHub Actions** | Link fixo; o grupo baixa e instala |
| Versão web | **Render** (Static Site, grátis) | `https://westminster-web.onrender.com`; não gasta as horas da API |

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

O **GitHub compila o APK sozinho** (workflow `.github/workflows/android-apk.yml`, grátis em repositório público) e publica num link fixo:

**<https://github.com/caiosoares1/westminster-songs/releases/latest/download/westminster-songs.apk>**

Esse link sempre entrega a versão mais nova. Mande no grupo; no Android, a pessoa abre, baixa e permite "instalar apps desta fonte" quando o celular pedir.

### Configuração (uma vez só): chave de assinatura

O Android só instala uma versão nova por cima da antiga se ela for assinada com a **mesma chave**. A chave **não fica no repositório** (que é público): ela vai em dois secrets do GitHub.

1. No GitHub: repositório → **Settings → Secrets and variables → Actions → New repository secret**.
2. Crie os dois:

   | Name | Secret |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | o conteúdo do arquivo `ANDROID_KEYSTORE_BASE64.txt` (uma linha longa) |
   | `ANDROID_KEYSTORE_PASSWORD` | o conteúdo do arquivo `ANDROID_KEYSTORE_PASSWORD.txt` |

3. **Guarde os dois arquivos fora do GitHub** (ex.: Google Drive pessoal, gerenciador de senhas). O GitHub não deixa ler um secret depois de salvo; sem eles, um app novo só instala depois de desinstalar o antigo (os dados ficam no servidor, só é preciso entrar de novo).

Para gerar uma chave nova (só se perder a antiga), com Java instalado:

```
keytool -genkeypair -storetype PKCS12 -keystore release.p12 -alias westminster -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Westminster Songs"
base64 -w0 release.p12   # vira o ANDROID_KEYSTORE_BASE64
```

### Quando ele compila

A cada push na `main` que mude algo em `mobile/`, ou manualmente em **Actions → APK Android → Run workflow**. Leva uns 20 minutos; acompanhe na aba **Actions**. Cada build ganha um número novo, então o APK novo instala por cima do antigo, sem perder o login.

O endereço da API que vai dentro do APK é o `EXPO_PUBLIC_API_URL` de `mobile/eas.json` (hoje `https://westminster-api.onrender.com`).

**Crie a sua conta antes de mandar para o grupo:** a primeira conta vira **administrador** (pode excluir músicas e gerenciar membros na aba Conta).

**Importar por foto** usa o reconhecimento de texto do próprio celular, então só funciona no APK. No Expo Go (desenvolvimento), a tela mostra um aviso e dá para colar o texto da cifra.

## 5. Versão web

O `render.yaml` também cria o site `westminster-web` (mesmas telas do app; só a importação por foto fica de fora, lá dá para colar o texto da cifra).

1. No Render, abra o Blueprint do projeto e clique em **Manual Sync** (ou aguarde a sincronização automática depois do merge). Ele mostra o novo serviço `westminster-web`: confirme.
2. O primeiro build leva uns 5 minutos. Depois, abra `https://westminster-web.onrender.com` e entre com a mesma conta do app.
3. Se o Render der outro endereço ao site (quando o nome já existe, ele acrescenta letras), copie o endereço e cole em `westminster-api` → **Environment** → `CORS_ORIGINS`. Sem isso o site não consegue falar com a API.

O site é reconstruído sozinho a cada push na `main` que mude algo em `mobile/`.

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
- **GitHub Actions**: ilimitado em repositório público.

## Segurança

- Ninguém usa o app sem conta, e só cria conta quem tem o código do grupo.
- Para impedir novos cadastros (ex.: o código vazou), troque `GROUP_INVITE_CODE`. Quem já tem conta continua entrando.
- Para tirar alguém do grupo: aba **Conta** → ícone de remover ao lado do nome. O acesso é cortado na hora.
- Tentativas de login são limitadas a 10 por minuto por pessoa (pelo IP real de quem está tentando).
