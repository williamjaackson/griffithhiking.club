#!/usr/bin/env bash
# One-off server preparation for static site hosting on this VPS.
# Idempotent: safe to re-run.
set -euo pipefail

SITE="griffithhiking.club"
WEBROOT="/srv/www/${SITE}"
PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJl5ySi+Dh+tCBxAWsd8W6M8sEU11eVOqQCj+L8BsjVT griffithhiking-github-deploy"

echo "== deploy user =="
if ! id -u deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deploy
  echo "created user 'deploy'"
else
  echo "user 'deploy' already exists"
fi
# deploy needs to read files it writes as group www-data
usermod -a -G www-data deploy

echo "== authorised key for deploy =="
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
grep -qF "griffithhiking-github-deploy" /home/deploy/.ssh/authorized_keys \
  || echo "$PUBKEY" >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

echo "== web roots =="
# 755 with group www-data so nginx workers can traverse and read.
install -d -m 755 -o root   -g root      /srv/www
install -d -m 755 -o deploy -g www-data  "${WEBROOT}"
install -d -m 755 -o deploy -g www-data  "${WEBROOT}/releases"

echo "== placeholder release =="
# Gives nginx something valid to serve before the first real deploy.
PLACEHOLDER="${WEBROOT}/releases/0000-placeholder"
if [ ! -e "${WEBROOT}/current" ]; then
  install -d -m 755 -o deploy -g www-data "${PLACEHOLDER}"
  cat > "${PLACEHOLDER}/index.html" <<'HTML'
<!doctype html>
<meta charset="utf-8">
<title>griffithhiking.club</title>
<h1>Awaiting first deploy</h1>
HTML
  chown deploy:www-data "${PLACEHOLDER}/index.html"
  chmod 644 "${PLACEHOLDER}/index.html"
  ln -sfn "${PLACEHOLDER}" "${WEBROOT}/current"
  chown -h deploy:www-data "${WEBROOT}/current"
  echo "placeholder created and 'current' pointed at it"
else
  echo "'current' already exists, left alone"
fi

echo "== nginx shared config =="
# Shared by the :80 and :443 blocks so the serving rules are stated once.
install -d -m 755 /etc/nginx/snippets
cat >"/etc/nginx/snippets/${SITE}.conf" <<'NGINX'
root /srv/www/griffithhiking.club/current;
index index.html;

# HTML must revalidate or a deploy stays invisible to return visitors.
# Set at this level because nginx's index handling internally redirects / to
# /index.html, which leaves any `location = /` block behind. A location
# declaring its own add_header does not inherit this one, which is exactly how
# /_astro/ opts out below.
add_header Cache-Control "public, max-age=0, must-revalidate";

# Astro emits content-hashed filenames here, so they are safe forever.
# Uses add_header rather than `expires` so only one Cache-Control is sent.
location /_astro/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    access_log off;
}

location / {
    try_files $uri $uri/ $uri.html /404.html =404;
}

error_page 404 /404.html;

gzip on;
gzip_vary on;
gzip_comp_level 6;
gzip_min_length 256;
gzip_types text/plain text/css application/javascript application/json
           image/svg+xml application/xml application/rss+xml;
NGINX

echo "== nginx site =="
# Port 80 serves content rather than redirecting to HTTPS. Cloudflare sits in
# front, and if its SSL mode is ever Flexible it fetches the origin over HTTP:
# a 301 to HTTPS would then loop forever. Visitor-facing HTTPS enforcement
# belongs to Cloudflare's "Always Use HTTPS" instead.
cat >"/etc/nginx/sites-available/${SITE}" <<'NGINX'
# griffithhiking.club - static Astro build, deployed by GitHub Actions.
# Document root is a symlink swapped atomically on each deploy.
server {
    listen 80;
    listen [::]:80;
    server_name griffithhiking.club www.griffithhiking.club;

    include /etc/nginx/snippets/griffithhiking.club.conf;
}
NGINX

# The 443 block is only added once the Cloudflare origin certificate is present,
# so this script still succeeds on a host that does not have it yet.
CERT="/etc/ssl/${SITE}-origin.pem"
CERTKEY="/etc/ssl/${SITE}-origin-key.pem"
if [ -r "$CERT" ] && [ -r "$CERTKEY" ]; then
  cat >>"/etc/nginx/sites-available/${SITE}" <<NGINX

# Cloudflare Origin CA certificate: trusted by Cloudflare only, valid to 2041,
# no renewal needed. Requires Cloudflare SSL mode Full (strict).
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name griffithhiking.club www.griffithhiking.club;

    ssl_certificate     ${CERT};
    ssl_certificate_key ${CERTKEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    include /etc/nginx/snippets/${SITE}.conf;
}
NGINX
  echo "TLS block added (origin certificate found)"
else
  echo "no origin certificate at ${CERT} - serving HTTP only"
fi

ln -sfn "/etc/nginx/sites-available/${SITE}" "/etc/nginx/sites-enabled/${SITE}"

echo "== validate and reload nginx =="
nginx -t
systemctl reload nginx
echo "nginx reloaded"

echo
echo "== result =="
ls -la "${WEBROOT}"
echo "sites-enabled:"; ls -l /etc/nginx/sites-enabled/
