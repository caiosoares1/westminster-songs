# Westminster Songs Mobile

App Expo Router para listar, criar, visualizar e importar musicas com OCR.

## Requisitos

- Node.js 20+
- Backend rodando (porta 3000 por padrao)

## Configuracao

1. Copie o ambiente:

```bash
cp .env.example .env
```

2. Defina:

- `EXPO_PUBLIC_API_URL` (ex.: `http://192.168.0.20:3000`)
- `EXPO_PUBLIC_API_PORT` (ex.: `3000`)

> Em Android emulator, se nao definir URL explicita, o app tenta `10.0.2.2:3000`.

## Instalacao e execucao

```bash
npm install
npm run start
```

## Fluxo MVP

- Tab `MUSICAS`: lista + busca + categorias
- Botao `+`: criar musica manualmente
- Botao camera: importar musica por OCR
- Detalhe da musica: visualizacao + transposicao
