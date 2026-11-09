# Westminster Songs

App de cifras para o grupo de louvor: músicas com histórico de versões, transposição de tom,
importação por foto (OCR no celular) e playlists com o tom de cada música.

| Pasta | O que é |
|---|---|
| `mobile/` | App em Expo / React Native (Android; também roda na web para testes) |
| `backend/` | API em NestJS + Prisma (Postgres) |
| `.github/workflows/android-apk.yml` | Compila o APK e publica em **Releases** |
| `render.yaml` | Configuração da API no Render |

**Baixar o app (Android):** <https://github.com/caiosoares1/westminster-songs/releases/latest/download/westminster-songs.apk>

**Publicação (API, banco e APK):** veja [`DEPLOY.md`](DEPLOY.md).

## Rodar no computador

API (precisa de um Postgres; copie `backend/.env.example` para `backend/.env`):

```
cd backend
npm install
npx prisma migrate deploy
npm run start:dev
```

App (abra no Expo Go; para usar a API publicada, coloque `EXPO_PUBLIC_API_URL=https://westminster-api.onrender.com` em `mobile/.env`):

```
cd mobile
npm install
npx expo start
```

A importação por foto só funciona no APK (o reconhecimento de texto é nativo); no Expo Go dá para colar o texto da cifra.

## Testes

```
cd backend && npm test && npm run lint
cd mobile && npm test && npx tsc --noEmit && npx expo lint
```
