#!/usr/bin/env bash
#
# HireSense — one-time VPS setup (Ubuntu 22.04 / 24.04, e.g. Hostinger KVM4).
# Installs Node.js 20, Redis, Nginx, Git, PM2, and Certbot (for free HTTPS).
# Run as root:   bash deploy/setup.sh
#
set -e

echo ">> Updating packages..."
apt-get update -y

echo ">> Installing Node.js 20 (LTS)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo ">> Installing Redis, Nginx, Git, Certbot..."
apt-get install -y redis-server nginx git certbot python3-certbot-nginx
systemctl enable --now redis-server

echo ">> Installing PM2 (keeps the app running + restarts on reboot)..."
npm install -g pm2

echo ""
echo "============================================================"
echo " Setup complete."
echo "   Node:  $(node -v)"
echo "   npm:   $(npm -v)"
echo "   Redis: $(redis-cli ping 2>/dev/null || echo 'not responding')"
echo " Next: clone the repo, create the .env files, then build & start."
echo " See docs/DEPLOYMENT_HOSTINGER.md"
echo "============================================================"
