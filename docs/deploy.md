# Deployment

Static Astro build, deployed to a Hostinger VPS by GitHub Actions on every push
to `main`. Nothing runs on the server for this site — nginx serves files.

## Where everything lives

**On the VPS** (`72.61.210.78`, Ubuntu 25.10):

| Path                                                | What                                                        |
| --------------------------------------------------- | ----------------------------------------------------------- |
| `/srv/www/griffithhiking.club/releases/<ts>-<sha>/` | One directory per deploy                                    |
| `/srv/www/griffithhiking.club/current`              | Symlink to the live release — this is nginx's document root |
| `/etc/nginx/sites-available/griffithhiking.club`    | nginx server block (symlinked into `sites-enabled`)         |
| `/home/deploy/.ssh/authorized_keys`                 | Holds the `griffithhiking-github-deploy` public key         |

**In this repo:**

| Path                           | What                                             |
| ------------------------------ | ------------------------------------------------ |
| `.github/workflows/deploy.yml` | Build, upload, activate, verify                  |
| `infra/activate-release.sh`    | Runs on the server to swap the symlink and prune |
| `infra/server-setup.sh`        | One-off provisioning, idempotent, run as root    |

**GitHub Actions secrets** (repo settings → Secrets → Actions):

- `VPS_HOST` — `72.61.210.78`
- `VPS_SSH_KEY` — private half of the deploy keypair

## How a deploy works

1. `pnpm check` and `pnpm build` run on the runner, so no Node is needed on the VPS.
2. `dist/` is rsynced to a new `releases/<timestamp>-<sha>/` directory.
3. `current` is repointed with `ln` + `mv -T`, which is atomic — no request ever
   sees a missing or half-updated document root.
4. Releases older than the newest 5 are pruned.
5. The workflow curls the origin with a `Host` header and asserts a 200.

## Rolling back

Releases are kept, so a rollback is a relink — no rebuild, no CI:

```bash
ssh deploy@72.61.210.78
cd /srv/www/griffithhiking.club
ls -1dt releases/*/                       # newest first
ln -sfn "$PWD/releases/<older>" current.tmp && mv -Tf current.tmp current
```

## Why deploys run as `deploy`, not `root`

The other apps on this box deploy as root because they're Rails and need to
restart a service. A static site needs nothing privileged: write into its own
directory and swap a symlink. So `deploy` has no sudo rights at all, and a
leaked `VPS_SSH_KEY` cannot reach the rest of the server.

It also can't live under `/root` — nginx workers run as `www-data` and cannot
traverse `/root` (mode 700). Hence `/srv/www`.

## TLS

Cloudflare sits in front of this site, so the origin uses a **Cloudflare Origin
CA certificate** rather than Let's Encrypt:

| Path                                          | Mode          |
| --------------------------------------------- | ------------- |
| `/etc/ssl/griffithhiking.club-origin.pem`     | 644 root:root |
| `/etc/ssl/griffithhiking.club-origin-key.pem` | 600 root:root |

It covers `griffithhiking.club` and `*.griffithhiking.club`, expires **2041**, and
needs no renewal timer or certbot. It is only trusted by Cloudflare, which is why
verifying the origin directly needs `curl -k`.

**Cloudflare must be set to SSL/TLS mode Full (strict).** Anything less either
leaves the Cloudflare-to-origin leg in plaintext (Flexible) or fails to validate.

**Port 80 deliberately serves content instead of redirecting to HTTPS.** If
Cloudflare's SSL mode is ever Flexible it fetches the origin over HTTP, and a 301
to HTTPS would then loop forever. Visitor-facing HTTPS enforcement is
Cloudflare's "Always Use HTTPS" setting, not nginx's job here.

The `:80` and `:443` blocks share `/etc/nginx/snippets/griffithhiking.club.conf`
so the serving rules exist in one place.

## Still outstanding

**DNS.** As of writing, the `.club` registry still delegates
`griffithhiking.club` to Hostinger's parking nameservers. Check propagation with:

```bash
dig +short NS griffithhiking.club @1.1.1.1
```

Once that returns `*.ns.cloudflare.com`, the domain is live. Until then the origin
is reachable only by sending a `Host` header or using `curl --resolve`.

## Adding another site later

Copy the pattern: `install -d -m 755 -o deploy -g www-data /srv/www/<domain>`,
add an nginx server block with `root /srv/www/<domain>/current`, symlink it into
`sites-enabled`, and point a deploy workflow at the new `SITE_ROOT`. The `deploy`
user and its key can be reused across sites.
