#!/usr/bin/env bash
# bootstrap.sh — one-time (idempotent) server prep for MICRO_FACTORY on the
# co-tenant box sidekick-agent. Run as root:
#
#   scp -r deploy root@sidekick-agent:/tmp/iq-deploy
#   ssh root@sidekick-agent bash /tmp/iq-deploy/bootstrap.sh
#
# Safe to re-run: every step is guarded. It deliberately touches NOTHING
# belonging to other tenants — no Coolify config, no Traefik static config,
# no firewall, no docker. The Traefik dynamic file and Coolify resources
# are manual steps (printed at the end; see deploy/README.md).
set -euo pipefail

SRC=$(cd "$(dirname "$0")" && pwd)
IQ=/srv/iq

# Pinned toolchains — bump deliberately, in step with go.mod / bun.lock.
GO_VERSION=1.26.0
NODE_VERSION=22.11.0
BUN_VERSION=1.3.0

[ "$(id -u)" = 0 ] || {
  echo "run as root" >&2
  exit 1
}
case "$(uname -m)" in
x86_64)
  GO_ARCH=amd64
  NODE_ARCH=x64
  ;;
aarch64)
  GO_ARCH=arm64
  NODE_ARCH=arm64
  ;;
*)
  echo "unsupported arch: $(uname -m)" >&2
  exit 1
  ;;
esac
NODE_DIR="node-v${NODE_VERSION}-linux-${NODE_ARCH}"

say() { printf '\n==> %s\n' "$1"; }

# --- 1. swap (the box runs swapless; builds need OOM headroom) -------------
if ! swapon --show | grep -q .; then
  say "creating 4G swapfile"
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
else
  say "swap present — skipping"
fi
grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
# Overflow-only: co-tenant behavior unchanged except OOM headroom.
echo 'vm.swappiness = 10' >/etc/sysctl.d/99-iq.conf
sysctl -q -p /etc/sysctl.d/99-iq.conf

# --- 2. toolchains (additive; nothing existed on this host) ----------------
if ! /usr/local/go/bin/go version 2>/dev/null | grep -q "go$GO_VERSION"; then
  say "installing Go $GO_VERSION ($GO_ARCH)"
  curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz" -o /tmp/go.tgz
  rm -rf /usr/local/go
  tar -C /usr/local -xzf /tmp/go.tgz
  rm /tmp/go.tgz
fi

if ! /usr/local/bin/node --version 2>/dev/null | grep -q "v$NODE_VERSION"; then
  say "installing Node $NODE_VERSION ($NODE_ARCH)"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIR}.tar.xz" -o /tmp/node.txz
  rm -rf "/usr/local/${NODE_DIR}"
  tar -C /usr/local -xJf /tmp/node.txz
  for b in node npm npx; do ln -sfn "/usr/local/${NODE_DIR}/bin/$b" "/usr/local/bin/$b"; done
  rm /tmp/node.txz
fi

if ! command -v rclone >/dev/null || ! command -v unzip >/dev/null; then
  say "installing rclone + unzip (bun installer needs unzip)"
  apt-get update -qq
  apt-get install -y -q rclone unzip
fi

# Global PATH gets ONLY root-owned dirs. Never put iq-writable paths
# (/srv/iq/.bun/bin) on other users' PATH — that's a privilege-escalation
# vector on a shared box. iq's own shell gets bun via ~iq/.bashrc (the bun
# installer adds it; ship sets its own PATH explicitly anyway).
cat >/etc/profile.d/iq-toolchains.sh <<'EOF'
export PATH=/usr/local/go/bin:$PATH
EOF

# --- 3. iq user + tree ------------------------------------------------------
id iq >/dev/null 2>&1 || {
  say "creating user iq (home $IQ)"
  useradd -r -m -d "$IQ" -s /bin/bash iq
}
install -d -o iq -g iq "$IQ"/{git,app,releases,current,env,dev,log,.config/rclone,.ssh}
chmod 700 "$IQ/.ssh"
# Login shells read .profile (not .bashrc); useradd -r created neither.
[ -f "$IQ/.profile" ] || {
  printf '[ -f ~/.bashrc ] && . ~/.bashrc\n' >"$IQ/.profile"
  chown iq:iq "$IQ/.profile"
}
if [ ! -f "$IQ/.ssh/authorized_keys" ] && [ -f /root/.ssh/authorized_keys ]; then
  say "seeding iq authorized_keys from root's"
  install -o iq -g iq -m 600 /root/.ssh/authorized_keys "$IQ/.ssh/authorized_keys"
fi

# Bun lives under the iq user (BUN_INSTALL=/srv/iq/.bun).
if ! sudo -u iq "$IQ/.bun/bin/bun" --version 2>/dev/null | grep -qx "$BUN_VERSION"; then
  say "installing Bun $BUN_VERSION"
  sudo -u iq env BUN_INSTALL="$IQ/.bun" bash -c \
    "curl -fsSL https://bun.sh/install | bash -s -- bun-v${BUN_VERSION}"
fi

# --- 4. bare repo + hook ----------------------------------------------------
[ -f "$IQ/git/app.git/HEAD" ] || {
  say "creating bare repo"
  sudo -u iq git init --bare -b main "$IQ/git/app.git"
}
install -o iq -g iq -m 755 "$SRC/post-receive" "$IQ/git/app.git/hooks/post-receive"

# --- 5. systemd units + limited sudo ---------------------------------------
say "installing systemd units"
install -m 644 "$SRC"/systemd/iq-*.service "$SRC"/systemd/iq-*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable iq-api.service iq-web.service >/dev/null
systemctl enable --now iq-sweep.timer iq-minio-backup.timer >/dev/null

say "installing sudoers drop-in (systemctl for iq-* only)"
cat >/tmp/iq-sudoers <<'EOF'
iq ALL=(root) NOPASSWD: /usr/bin/systemctl start iq-api.service, /usr/bin/systemctl stop iq-api.service, /usr/bin/systemctl restart iq-api.service, /usr/bin/systemctl start iq-web.service, /usr/bin/systemctl stop iq-web.service, /usr/bin/systemctl restart iq-web.service
EOF
visudo -c -f /tmp/iq-sudoers >/dev/null
install -m 440 /tmp/iq-sudoers /etc/sudoers.d/iq
rm /tmp/iq-sudoers

# --- 6. env templates (copy-if-absent; fill real values by hand) -----------
[ -f "$IQ/env/api.env" ] || install -o iq -g iq -m 600 "$SRC/env/api.env.example" "$IQ/env/api.env"
[ -f "$IQ/env/web.build.env" ] || install -o iq -g iq -m 600 "$SRC/env/web.build.env.example" "$IQ/env/web.build.env"

# --- done -------------------------------------------------------------------
cat <<EOF

bootstrap done. Manual steps remaining (details: deploy/README.md):

  1. Coolify UI: PostgreSQL resource, public port 5433; then create
     databases 'app' and 'app_dev' in it.
  2. Coolify UI: Garage service — add "ports: ['9002:3900']" to its compose
     before deploying (S3 API; no console). Then init via the garage CLI:
     layout assign/apply, key, buckets, grants, CORS — and api.env needs
     S3_REGION=garage (Garage validates the SigV4 region).
  3. Fill /srv/iq/env/api.env and /srv/iq/env/web.build.env (0600 already).
  4. Copy the Traefik dynamic file (set the basicAuth hash first):
       cp $SRC/traefik/iq.dynamic.yaml /data/coolify/proxy/dynamic/iq.yaml
  5. On the Mac, add the deploy push URL:
       git remote set-url --add --push origin git@github.com:JamesHawking/print-cut-ship.git
       git remote set-url --add --push origin iq@sidekick-agent:/srv/iq/git/app.git
  6. git push   →  watch the first deploy stream.
EOF
