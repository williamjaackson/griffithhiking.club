# The CMS

The hike calendar is edited in a Sanity Studio and read by the site at build
time. Nothing else on the site is in Sanity. The home page copy, the photo rail
and the Instagram gallery are still YAML under `src/content` and change through
a pull request.

The studio is at `https://<studioHost>.sanity.studio`, where `studioHost` is the
value in `sanity.project.json`. Executives sign in with Google. They need no
GitHub account and never see this repository.

## Setting it up

```bash
pnpm setup:sanity
```

That runs `scripts/setup-sanity.sh`, which walks through creating the project,
seeding it with the events that used to live in `src/content/events`, deploying
the studio, creating the two tokens GitHub Actions needs, configuring the
webhook, and inviting the executives. Re-run it any time. It asks before every
change.

Commit `sanity.project.json` afterwards. It holds the project id, which is
public, so CI needs no variable for it.

## What lives where

| Path                                  | What                                                        |
| ------------------------------------- | ----------------------------------------------------------- |
| `sanity.project.json`                 | Project id, dataset and studio hostname. Read by both sides |
| `studio/`                             | The studio: a separate pnpm workspace package               |
| `studio/schemaTypes/event.ts`         | The form the executives fill in, and its rules              |
| `studio/seed/events.ndjson`           | The original calendar, for a fresh dataset                  |
| `src/lib/sanity.ts`                   | Fetches published events for the `events` collection        |
| `src/content.config.ts`               | Validates what was fetched                                  |
| `.github/workflows/deploy-studio.yml` | Redeploys the studio when `studio/` changes on main         |
| `scripts/setup-sanity.sh`             | The setup wizard                                            |

GitHub Actions secrets:

- `SANITY_AUTH_TOKEN`: a robot token with the Deploy Studio role. It cannot
  read or write content.

The GitHub personal access token that the Sanity webhook sends is stored only in
the webhook's headers on Sanity's side. It has Contents write on this one
repository and nothing else.

## How a publish reaches the site

1. An executive presses Publish in the studio.
2. Sanity's webhook posts to GitHub's `repository_dispatch` endpoint with
   `event_type: content-published`.
3. `deploy.yml` runs, fetches every published event over the API (not the CDN,
   which can lag a publish by a minute), validates it against the Zod schema,
   builds, and deploys.

The dataset must be public. A private one does not refuse an anonymous query;
it returns an empty list with a 200, and the site builds an empty calendar. The
wizard sets visibility to public on every run, and the loader logs a warning
whenever zero events come back.

Document ids must not contain a dot. Sanity reads `event.morans-falls` as a
document on the `event` path, and anything off the root path is hidden from
anonymous requests, in a public dataset too. The studio generates safe ids. The
seed file uses plain slugs, and a test checks it stays that way.

Drafts do not trigger the webhook and are not fetched. If the webhook's token
expires, publishes stop being instant but the 05:00 Brisbane nightly build still
picks them up. Re-running the wizard mints a new token.

## Two schemas, one set of rules

The studio schema and the site schema enforce the same rules: a required date, a
last day no earlier than the first, no difficulty on a social event, an https
application link. The studio rejects a bad entry before Publish, which is the
only moment an editor is watching. The site rejects it again at build, because a
future studio change could let something through and the build is the last
line.

The option lists (kinds and difficulty grades) are not duplicated. The studio
imports them from `src/lib/events.ts`, so adding a grade is one edit.

## Working on the studio locally

```bash
pnpm -C studio dev      # http://localhost:3333, against the real dataset
pnpm check:studio       # type-check
```

Edits made locally are real edits: the local studio and the hosted one share the
dataset.

## Adding a field

1. Add it to `studio/schemaTypes/event.ts`.
2. Add it to the `events` schema in `src/content.config.ts` and to
   `EVENTS_QUERY` in `src/lib/sanity.ts`. The query lists fields explicitly, so
   a field the site does not know about never reaches the build.
3. Use it in `src/components/Events.astro`.
4. Merge. The studio redeploys itself; the site rebuilds on the next publish.

## Free plan limits that matter

Twenty user seats, and the only roles are Administrator and Viewer. Every
executive who edits is therefore an administrator of the Sanity project, which
means they could also delete the dataset. For a club with a seed file in git
and a nightly build, that is an acceptable trade for not paying.
