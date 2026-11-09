#!/usr/bin/env bash
# Installs Westminster Songs on an Ubuntu 24.04 machine (Oracle Cloud Always Free).
#
#   curl -fsSL https://raw.githubusercontent.com/caiosoares1/westminster-songs/main/deploy/oracle/install.sh | sudo bash
#
# Safe to run again: keeps the existing settings and just updates/restarts.
set -euo pipefail

REPO_URL="https://github.com/caiosoares1/westminster-songs.git"
APP_DIR="/opt/westminster-songs"
DEPLOY_DIR="$APP_DIR/deploy/oracle"
ENV_FILE="$DEPLOY_DIR/.env"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "rode com sudo: curl -fsSL ... | sudo bash"
# Prompts read from the terminal, since the script itself arrives on stdin.
[ -r /dev/tty ] || fail "rode num terminal interativo (SSH)."

say "Atualizando o sistema e instalando Docker"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 git curl iptables-persistent unattended-upgrades >/dev/null
systemctl enable --now docker >/dev/null

# Automatic security updates (reboots at 4h if a kernel update needs it).
cat > /etc/apt/apt.conf.d/52westminster-auto-reboot <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
EOF

# Swap: the API build needs more memory than the 2 GB machine has free.
if ! swapon --show | grep -q /swapfile; then
  say "Criando 2 GB de swap"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "Liberando as portas 80 e 443 no firewall da máquina"
# Oracle's Ubuntu images block everything except SSH with a REJECT rule;
# the new rules must come before it.
allow() {
  local proto="$1" port="$2" reject_line
  iptables -C INPUT -p "$proto" --dport "$port" -j ACCEPT 2>/dev/null && return
  reject_line="$(iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" {print $1; exit}')"
  if [ -n "$reject_line" ]; then
    iptables -I INPUT "$reject_line" -p "$proto" --dport "$port" -j ACCEPT
  else
    iptables -A INPUT -p "$proto" --dport "$port" -j ACCEPT
  fi
}
allow tcp 80
allow tcp 443
allow udp 443
netfilter-persistent save >/dev/null

say "Baixando o código"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only -q
else
  git clone -q "$REPO_URL" "$APP_DIR"
fi

if [ -f "$ENV_FILE" ]; then
  say "Configuração existente mantida ($ENV_FILE)"
else
  say "Configuração"
  PUBLIC_IP="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
  [[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "não consegui descobrir o IP público da máquina."
  DOMAIN="${PUBLIC_IP//./-}.sslip.io"

  DB_URL=""
  while [[ "$DB_URL" != postgres* ]]; do
    read -rsp "Connection string do Neon (não aparece na tela): " DB_URL < /dev/tty
    echo
    [[ "$DB_URL" == postgres* ]] || echo "Deve começar com postgresql:// — tente de novo."
  done

  INVITE=""
  while [ "${#INVITE}" -lt 6 ]; do
    read -rp "Código do grupo (mínimo 6 caracteres; o pessoal digita para criar conta): " INVITE < /dev/tty
  done

  umask 077
  cat > "$ENV_FILE" <<EOF
DOMAIN=$DOMAIN
DATABASE_URL=$DB_URL
GROUP_INVITE_CODE=$INVITE
JWT_SECRET=$(openssl rand -hex 32)
EOF
  chmod 600 "$ENV_FILE"
fi

DOMAIN="$(grep '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"

say "Construindo e subindo a API (a primeira vez leva alguns minutos)"
cd "$DEPLOY_DIR"
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null

say "Esperando a API responder em https://$DOMAIN"
for _ in $(seq 1 60); do
  # Through Caddy on this machine, with the real certificate for the domain.
  if curl -fsS --max-time 5 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" 2>/dev/null | grep -q "Hello World"; then
    printf '\n\033[1;32mPronto! A API está no ar em:\n\n    https://%s\n\033[0m\n' "$DOMAIN"
    echo "Cole esse endereço no mobile/eas.json (EXPO_PUBLIC_API_URL)."
    exit 0
  fi
  sleep 5
done

echo
echo "A API não respondeu em 5 minutos. O certificado HTTPS só sai se a porta 80"
echo "estiver aberta para a internet. Verifique:"
echo "  1. As portas 80 e 443 liberadas na Security List da Oracle (veja o DEPLOY.md)."
echo "  2. Os logs:  cd $DEPLOY_DIR && sudo docker compose logs --tail 50"
exit 1
