#!/usr/bin/env bash
#
# Sets up the Sanity CMS behind the hike calendar: the project, the seed data,
# the hosted studio, the tokens GitHub Actions needs, the webhook that rebuilds
# the site on publish, and the executives' invitations.
#
# Run from the repo root with `pnpm setup:sanity`. Safe to re-run: every stage
# asks before it changes anything, and keeps values it already has.
#
# Everything above the "STAGES" marker is the wizard library: do not hand-edit
# it. Author the per-step stages below the marker.

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Wizard library: delightful, consistent UX, identical across every wizard.
# ──────────────────────────────────────────────────────────────────────────

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""
fi

# Author sets this at the top of the stages section.
TOTAL_STAGES=0

_STAGE_INDEX=0
ENV_FILE="${ENV_FILE:-.env}"
WRITTEN_ENV=()    # KEYs written to ENV_FILE this run
WRITTEN_SECRET=() # secret NAMEs set this run
SKIPPED=()        # things we couldn't do (e.g. gh missing)

# _clear wipes the terminal so only the current step is on screen. No-op when
# output isn't a terminal, so piped logs stay readable.
_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1; then tput clear; else printf '\033[2J\033[3J\033[H'; fi
}

# banner "Title" shows the opening frame: what this wizard does.
banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  %s stages%s\n\n' "$DIM" "$TOTAL_STAGES" "$RESET"
  printf '%s  You drive the browser; this wizard tells you exactly what to do and\n' "$DIM"
  printf '  captures the values you copy back. Stop any time with Ctrl-C and re-run\n'
  printf '  later, since it remembers values already saved.%s\n' "$RESET"
  pause "Ready to start?"
}

# stage "Name" clears the screen, then announces a stage and shows progress.
# Clearing keeps only the current step on screen.
stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  printf '\n%s%s▸ Stage %s/%s · %s%s\n' \
    "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET"
}

# say "..." prints a plain instruction line.
say()  { printf '  %s\n' "$1"; }
# step "..." is a numbered-feeling action the human takes in the browser.
step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

# open_url URL opens it in the human's browser, cross-platform incl. WSL.
open_url() {
  local url="$1"
  printf '  %s↗ opening%s %s\n' "$GREEN" "$RESET" "$url"
  { if   command -v wslview     >/dev/null 2>&1; then wslview "$url"
    elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$url"
    elif command -v xdg-open    >/dev/null 2>&1; then xdg-open "$url"
    elif command -v open        >/dev/null 2>&1; then open "$url"
    else warn "couldn't open a browser; visit it manually: $url"; fi
  } >/dev/null 2>&1 || warn "couldn't open a browser, so visit it manually: $url"
}

# pause "msg" waits for the human to confirm they've done the manual part.
pause() {
  printf '  %s%s%s ' "$DIM" "${1:-Press Enter to continue}" "$RESET"
  read -r _ || true
}

# confirm "question" is a y/N gate; returns success on yes.
confirm() {
  local reply=""
  printf '  %s? %s [y/N] ' "$YELLOW" "$1"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

# _existing KEY: current value of KEY in ENV_FILE, if any.
_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line; line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n1) || return 1
  printf '%s' "${line#*=}"
}

# ask KEY "Prompt" reads a value into $KEY. Offers the existing .env value as
# a default on re-runs (Enter keeps it). Visible input (non-secret).
ask() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -r input || true
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# ask_secret KEY "Prompt" is like ask, but input is hidden.
ask_secret() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -rs input || true
  printf '\n'
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# write_env KEY VALUE upserts KEY=VALUE into ENV_FILE (creates it; replaces
# any existing line). Idempotent.
write_env() {
  local key="$1" value="$2" tmp
  touch "$ENV_FILE"
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  WRITTEN_ENV+=("$key")
  printf '  %s✓ wrote%s %s → %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

# set_secret NAME VALUE sets a GitHub Actions repo secret via gh. Falls back
# to a warning (and records it) if gh is unavailable or unauthenticated.
set_secret() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if printf '%s' "$value" | gh secret set "$name" >/dev/null 2>&1; then
      WRITTEN_SECRET+=("$name")
      printf '  %s✓ set%s GitHub secret %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub secret $name (set it manually: gh secret set $name)")
  warn "skipped GitHub secret $name: gh not ready; set it later"
}

# set_var NAME VALUE sets a GitHub Actions repo variable (non-secret).
set_var() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh variable set "$name" --body "$value" >/dev/null 2>&1; then
      printf '  %s✓ set%s GitHub variable %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub variable $name")
  warn "skipped GitHub variable $name, gh not ready; set it later"
}

# finish clears, then shows a closing summary of everything configured.
finish() {
  _clear
  printf '\n%s%s  ✓ Setup complete%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} ))    && note "wrote ${#WRITTEN_ENV[@]} value(s) to $ENV_FILE: ${WRITTEN_ENV[*]}"
  (( ${#WRITTEN_SECRET[@]} )) && note "set ${#WRITTEN_SECRET[@]} GitHub secret(s): ${WRITTEN_SECRET[*]}"
  if (( ${#SKIPPED[@]} )); then
    printf '\n'; warn "still to do by hand:"
    for s in "${SKIPPED[@]}"; do note "  - $s"; done
  fi
  printf '\n'
}

# ──────────────────────────────────────────────────────────────────────────
# STAGES: one stage() per step the human takes.
# ──────────────────────────────────────────────────────────────────────────

TOTAL_STAGES=9
PROJECT_FILE="sanity.project.json"
REPO="williamjaackson/griffithhiking.club"

# The Sanity CLI lives in the studio package and runs with studio/ as its working
# directory, so any file handed to it needs an absolute path.
sanity() { pnpm -C studio exec sanity "$@"; }
SEED="$PWD/studio/seed/events.ndjson"

# read_project KEY prints that key from sanity.project.json.
read_project() {
  node -e 'const j=require("./"+process.argv[1]); process.stdout.write(String(j[process.argv[2]] ?? ""))' "$PROJECT_FILE" "$1"
}

# write_project KEY VALUE updates one key in sanity.project.json, keeping the
# formatting Prettier expects.
write_project() {
  node -e '
    const fs = require("fs");
    const [file, key, value] = process.argv.slice(1);
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    json[key] = value;
    fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  ' "$PROJECT_FILE" "$1" "$2"
  printf '  %s✓ wrote%s %s → %s\n' "$GREEN" "$RESET" "$1" "$PROJECT_FILE"
}

if [[ ! -f "$PROJECT_FILE" ]]; then
  printf '%sRun this from the repository root, where %s lives.%s\n' "$RED" "$PROJECT_FILE" "$RESET"
  exit 1
fi

banner "Sanity setup for griffithhiking.club"

# ── 1 ─────────────────────────────────────────────────────────────────────
stage "Install and sign in"
say "The studio package needs its dependencies, and the Sanity CLI needs you"
say "signed in. Signing in opens a browser; Google is the easiest option."
pause "Press Enter to install and sign in"
pnpm install
sanity login
say ""
say "Signed in as:"
sanity projects list 2>/dev/null | head -20 || true

# ── 2 ─────────────────────────────────────────────────────────────────────
stage "The Sanity project"
EXISTING_ID="$(read_project projectId)"
if [[ -n "$EXISTING_ID" ]]; then
  say "$PROJECT_FILE already names project $EXISTING_ID."
  if confirm "Keep it?"; then
    PROJECT_ID="$EXISTING_ID"
  fi
fi
if [[ -z "${PROJECT_ID:-}" ]]; then
  if confirm "Create a new project called 'Griffith Hiking Club' with a public 'production' dataset?"; then
    say "Creating..."
    sanity projects create "Griffith Hiking Club" \
      --dataset production --dataset-visibility public
    say ""
    step "Copy the project id from the output above (a short string like 'abc12xyz')."
  else
    step "Find the id of the project you want to use:"
    sanity projects list
    warn "Its 'production' dataset must be public. The site builds without a token."
  fi
  ask PROJECT_ID "Paste the project id:"
  write_project projectId "$PROJECT_ID"
fi

# The site reads the dataset with no token. A private dataset does not refuse
# an anonymous query; it answers with an empty list, and the site would build a
# calendar with nothing on it. So this is set every run, whatever was chosen
# when the project was created.
say ""
say "Making the production dataset public, so the site can read it without a token."
sanity datasets visibility set production public

EXISTING_HOST="$(read_project studioHost)"
say ""
say "The studio will be hosted at <name>.sanity.studio. This is the address"
say "the executives will use, so keep it short. Current: $EXISTING_HOST"
ask STUDIO_HOST "Studio hostname [Enter keeps $EXISTING_HOST]:"
STUDIO_HOST="${STUDIO_HOST:-$EXISTING_HOST}"
[[ "$STUDIO_HOST" != "$EXISTING_HOST" ]] && write_project studioHost "$STUDIO_HOST"

# ── 3 ─────────────────────────────────────────────────────────────────────
stage "Seed the calendar"
say "studio/seed/events.ndjson holds the events that used to live in"
say "src/content/events. Importing them means the site does not go blank the"
say "moment it switches over."
if confirm "Import them into the production dataset now?"; then
  sanity datasets import "$SEED" -d production --replace
else
  SKIPPED+=("seed the dataset: pnpm -C studio exec sanity datasets import $SEED -d production --replace")
fi

# ── 4 ─────────────────────────────────────────────────────────────────────
stage "Deploy the studio"
say "This builds the editing UI and publishes it at https://$STUDIO_HOST.sanity.studio"
say "It also allows the local studio (pnpm -C studio dev) to talk to the project."
if confirm "Deploy now?"; then
  sanity cors add http://localhost:3333 --credentials || true
  pnpm -C studio deploy --yes
else
  SKIPPED+=("deploy the studio: pnpm -C studio deploy")
fi

# ── 5 ─────────────────────────────────────────────────────────────────────
stage "A token so GitHub Actions can redeploy the studio"
say "deploy-studio.yml redeploys the studio whenever its schema changes on main."
say "It needs a robot token with the 'Deploy Studio' role. Nothing more: this"
say "token cannot read or write content."
step "When prompted for a role, choose Deploy Studio. The token is shown once."
pause "Press Enter to create it"
sanity tokens create "GitHub Actions: deploy studio"
ask_secret SANITY_AUTH_TOKEN "Paste the token:"
set_secret SANITY_AUTH_TOKEN "$SANITY_AUTH_TOKEN"

# ── 6 ─────────────────────────────────────────────────────────────────────
stage "A GitHub token so Sanity can trigger a site rebuild"
say "When an executive presses Publish, Sanity calls GitHub, which runs the"
say "deploy workflow. That call needs a token scoped to this one repository."
open_url "https://github.com/settings/personal-access-tokens/new"
step "Token name: 'Sanity webhook: rebuild griffithhiking.club'."
step "Expiration: the longest offered. Note the date; the nightly build still"
step "  runs when it lapses, but publishes stop being instant until you re-run this."
step "Repository access: Only select repositories → $REPO."
step "Permissions → Repository permissions → Contents: Read and write."
step "Generate token, then copy it."
ask_secret GH_DISPATCH_TOKEN "Paste the GitHub token:"

# ── 7 ─────────────────────────────────────────────────────────────────────
stage "The webhook"
say "Now tell Sanity where to send that call. This opens the project's settings;"
say "go to API → Webhooks → Create webhook and fill in exactly this:"
sanity manage >/dev/null 2>&1 || open_url "https://www.sanity.io/manage"
say ""
step "Name:        Rebuild griffithhiking.club"
step "URL:         https://api.github.com/repos/$REPO/dispatches"
step "Dataset:     production"
step "Trigger on:  Create, Update and Delete (all three)"
step "Filter:      _type == \"event\""
step "Projection:  {\"event_type\": \"content-published\"}"
step "HTTP method: POST"
step "HTTP headers, two of them:"
say  "               Authorization: Bearer $GH_DISPATCH_TOKEN"
say  "               Accept: application/vnd.github+json"
step "API version: the newest offered"
step "Leave 'Drafts' and 'Versions' unticked: only a Publish should deploy."
step "Save."
note "The event_type must match repository_dispatch.types in deploy.yml."
pause "Press Enter once the webhook is saved"

# ── 8 ─────────────────────────────────────────────────────────────────────
stage "Invite the executives"
say "Each person is invited as an Administrator (the free plan's only editing"
say "role). They get an email, sign in with Google, and land in the studio."
say "Leave the address blank to move on."
while true; do
  ask INVITE_EMAIL "Email address to invite (blank to finish):"
  [[ -z "$INVITE_EMAIL" ]] && break
  sanity users invite "$INVITE_EMAIL" --role administrator || warn "invite failed for $INVITE_EMAIL"
  INVITE_EMAIL=""
done
note "Later: pnpm -C studio exec sanity users invite <email> --role administrator"

# ── 9 ─────────────────────────────────────────────────────────────────────
stage "Retire the old CMS"
say "The Sveltia CMS committed to a 'content' branch on GitHub. Nothing reads it"
say "any more."
if gh api "repos/$REPO/branches/content" >/dev/null 2>&1; then
  if confirm "Delete the remote 'content' branch?"; then
    gh api -X DELETE "repos/$REPO/git/refs/heads/content" >/dev/null && say "  deleted"
  fi
else
  note "No 'content' branch on the remote; nothing to delete."
fi
say ""
say "If a GitHub OAuth app was registered for Sveltia, it can go too:"
open_url "https://github.com/settings/developers"
pause "Press Enter to finish"

finish
say "Commit sanity.project.json so CI and the deploy workflow pick up the project."
say "Studio:  https://$STUDIO_HOST.sanity.studio"
say "Docs:    docs/cms.md"
