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

## Still outstanding

**DNS.** `griffithhiking.club` is still on Hostinger's parking nameservers
(`hyperion.dns-parking.com`) pointing at `2.57.91.91`. It needs an `A` record to
`72.61.210.78`. Until then the site is only reachable by sending a `Host` header.

**TLS.** No certificate yet — the nginx block listens on port 80 only, because
certbot cannot validate a domain that does not resolve here. Once DNS points at
the VPS:

```bash
ssh root@72.61.210.78
certbot --nginx -d griffithhiking.club -d www.griffithhiking.club
```

That rewrites the server block for 443 and installs a renewal timer, matching
how `griffithict.club` is already set up on this box.

## Adding another site later

Copy the pattern: `install -d -m 755 -o deploy -g www-data /srv/www/<domain>`,
add an nginx server block with `root /srv/www/<domain>/current`, symlink it into
`sites-enabled`, and point a deploy workflow at the new `SITE_ROOT`. The `deploy`
user and its key can be reused across sites.
