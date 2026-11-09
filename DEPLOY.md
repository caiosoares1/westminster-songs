# Publicar o Westminster Songs

Arquitetura (tudo grátis):

| Parte | Onde | Observação |
|---|---|---|
| API (NestJS + Tesseract) + HTTPS | **Oracle Cloud Always Free** (máquina Ampere A1) | Sempre ligada; HTTPS automático com Caddy |
| Banco (Postgres) | **Neon** | 1 GB grátis, com backup gerenciado |
| App Android | **APK pelo EAS Build (Expo)** | Você manda o link, o grupo instala |

Não precisa de domínio: o endereço da API fica `https://<ip-da-maquina>.sslip.io`.

---

## 1. Banco no Neon

1. Crie um projeto em <https://neon.com>, na região **AWS South America (São Paulo)** se estiver disponível (perto da máquina da Oracle).
2. Em **Connect**, desligue **Connection pooling** e copie a connection string (`postgresql://...neon.tech/neondb?sslmode=require...`).
   Não cole essa string em chats nem no GitHub: ela contém a senha.

## 2. Conta na Oracle Cloud

1. Cadastre-se em <https://signup.cloud.oracle.com>. O cartão é só para verificação.
2. **Home Region: Brazil East (Sao Paulo).** Não dá para mudar depois, e as máquinas grátis só existem na região principal.
3. **Não faça upgrade** para "Pay As You Go": no plano grátis a conta não tem como ser cobrada.
4. **Alerta de orçamento** (☰ → *Billing & Cost Management → Budgets → Create Budget*):
   - Target: Compartment (o principal), valor mensal **5**
   - Alert rule: *Actual Spend*, *Percentage of Budget* = **1**, com o seu email
   - O orçamento avisa, não bloqueia. A proteção de verdade é o item 3.

## 3. Criar a máquina

☰ → *Compute → Instances → Create instance*:

| Campo | Valor |
|---|---|
| Name | `westminster` |
| Image | **Canonical Ubuntu 24.04** |
| Shape | **Ampere → VM.Standard.A1.Flex**, **1 OCPU e 2 GB** (selo "Always Free-eligible") |
| Networking | rede nova, com **Assign a public IPv4 address** |
| SSH keys | **Generate a key pair for me** → **Save private key** (guarde o arquivo `.key`) |

**Por que 2 GB e não mais:** a Oracle pode recuperar máquinas grátis consideradas ociosas (CPU, rede **e** memória abaixo de 20% por 7 dias). Com 2 GB, sistema + API devem ocupar uns 25% da memória (estimativa), acima do limite, então a máquina não conta como parada. Se você criou com mais memória, reduza em *Edit → Edit shape* (a máquina reinicia, nada se perde).

Se aparecer **"Out of capacity"**, tente mais tarde; de madrugada costuma ter vaga.

## 4. Liberar as portas 80 e 443

Na página da máquina: *Primary VNIC → Subnet* (clique no nome) → *Security* → *Default Security List* → **Add Ingress Rules**:

| Campo | Valor |
|---|---|
| Source CIDR | `0.0.0.0/0` |
| IP Protocol | TCP |
| Destination Port Range | `80,443` |

A porta 80 é necessária para o certificado HTTPS (Let's Encrypt) ser emitido.

## 5. Instalar

No seu computador (Windows, PowerShell), na pasta onde salvou a chave:

```powershell
icacls .\ssh-key-*.key /inheritance:r /grant:r "$($env:USERNAME):(R)"
ssh -i .\ssh-key-*.key ubuntu@IP_DA_MAQUINA
```

(O `icacls` só precisa ser rodado uma vez: o SSH recusa chaves que outros usuários do Windows podem ler.)

Já dentro da máquina:

```bash
curl -fsSL https://raw.githubusercontent.com/caiosoares1/westminster-songs/main/deploy/oracle/install.sh | sudo bash
```

O script pede a connection string do Neon (não aparece na tela) e o **código do grupo**, e faz o resto:
Docker, firewall, swap, atualizações automáticas de segurança, API e HTTPS. Leva uns 10 minutos.
No final ele mostra o endereço, ex.: `https://129-146-12-34.sslip.io`. Abra no navegador: deve aparecer `Hello World!`.

As configurações ficam em `/opt/westminster-songs/deploy/oracle/.env` (só o administrador da máquina lê).

## 6. APK para Android

No seu computador, na pasta do projeto:

```
npm install -g eas-cli
cd mobile
eas login
eas init
```

(`eas init` grava um `projectId` no `app.json`; faça commit dessa mudança.)

Em `mobile/eas.json`, troque `https://COLE-AQUI-A-URL-DA-API` pelo endereço do passo 5 e gere o APK:

```
eas build --platform android --profile apk
```

O build roda nos servidores da Expo (no plano grátis pode ficar na fila). No fim aparece um link: mande no grupo. No Android, a pessoa permite "instalar apps desta fonte" quando o celular pedir.

**Crie a sua conta antes de mandar para o grupo:** a primeira conta vira **administrador**.

**Atualizar o app:** aumente `versionCode` em `mobile/app.json` (1 → 2…), rode o `eas build` de novo e mande o novo link.

## Manutenção

| O que | Como (dentro da máquina, via SSH) |
|---|---|
| Atualizar a API com o código novo do GitHub | `sudo /opt/westminster-songs/deploy/oracle/update.sh` |
| Ver erros | `cd /opt/westminster-songs/deploy/oracle && sudo docker compose logs --tail 100 api` |
| Trocar o código do grupo | `sudo nano /opt/westminster-songs/deploy/oracle/.env` e depois o `update.sh` |
| Reiniciar tudo | `sudo reboot` (a API volta sozinha) |

- Atualizações de segurança do Ubuntu são instaladas sozinhas; se precisar reiniciar, a máquina reinicia às 4h e a API volta sozinha.
- Os dados ficam no Neon. Se a máquina for perdida, crie outra (passos 3 a 5) com a mesma connection string e o mesmo código: as músicas continuam lá. Só o IP muda, e aí é preciso gerar um APK novo com o endereço novo.

## Segurança

- Ninguém usa o app sem conta, e só cria conta quem tem o código do grupo.
- Para impedir novos cadastros (ex.: o código vazou), troque `GROUP_INVITE_CODE` no `.env` e rode o `update.sh`. Quem já tem conta continua entrando.
- Para tirar alguém do grupo: aba **Conta** → ícone de remover ao lado do nome. O acesso é cortado na hora.
- Tentativas de login são limitadas a 10 por minuto por IP.

---

## Alternativa: Google Cloud Run

Se preferir não manter uma máquina: o `backend/Dockerfile` também roda no Cloud Run (exige ativar o faturamento do Google Cloud; em alguns casos o Google pede um pré-pagamento reembolsável). No Cloud Shell, dentro de `backend/`, crie um `env.yaml` com `DATABASE_URL`, `GROUP_INVITE_CODE` e `JWT_SECRET` e rode:

```
gcloud run deploy westminster-api --source . --region us-central1 \
  --allow-unauthenticated --memory 1Gi --max-instances 2 \
  --env-vars-file env.yaml
```
