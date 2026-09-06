# Attendance

The leader's half of the trail pass. A hiker makes a QR code on their own phone
at `/trail-pass`; a leader reads it at the trailhead with Attendance, the app
at `/scan/`, and it keeps a roll of who turned up. Nothing leaves the leader's
phone unless they export it, and nothing needs a signal.

It only runs installed. Opening `/scan/` in a browser tab shows one thing: how
to add it to the home screen, with the steps for the phone it is on (Safari's
Share sheet on an iPhone, Chrome's menu or install prompt on Android). Once it
is on the home screen it opens as an app and goes straight to the hike list.
An installed app keeps its camera permission and its storage, and opens in
aeroplane mode; a tab does neither reliably, which is why the tab does not try.

## Using it

1. Open Attendance from the home screen.
2. Pick the hike. The list is the upcoming calendar from Sanity, plus
   "Something else" for a hike that is not on it.
3. Point the camera at passes. The camera opens by itself once the phone has
   allowed it; the first time there is a Start camera button. Each read fills
   the whole screen with a colour, plays a note, buzzes an Android phone, and
   puts a card at the top of the feed under the camera. The screen stays that
   colour until it is tapped, and nothing else is read while it is up, so one
   hiker is dealt with before the next.
4. At the end of the walk, switch to Check out and scan everyone again. The
   count becomes "n of m out", and the roll's Still out filter is the list of
   people to go looking for. Those are the roll's two views: All and Still out.
5. Add by hand for anyone without a pass, in either direction. Same four
   questions as the pass, same opt-outs for no student number or no mobile.
6. Open the roll to export a CSV (share sheet, or a download), copy the names
   for a group chat, or clear it from the phone.

The colours are the traffic-light three, and the feed's top card matches:

| Colour | Sound            | When                                                                                                 |
| ------ | ---------------- | ---------------------------------------------------------------------------------------------------- |
| Green  | Two rising notes | Checked in or out, with both numbers on the pass; checkout also stays green when a number is missing |
| Orange | One flat note    | Already checked in, or already checked in and out                                                    |
| Red    | One low note     | A check-in is missing a number, the code is not a trail pass, or the person never checked in         |

A pass can be missing a student number or a phone (the hiker said they had
none). On check-in, the screen goes red and shows a field for each missing
number, so the leader can ask and type it in there and then. On checkout, it
stays green because the person was checked out successfully. Left blank, Save
records that they have none. The card in the feed stays red for a check-in with
an Add button for each gap, so it can still be filled later.

Someone who checks out without having checked in is added and marked out in
one go, with a red flash and a note saying so. They are plainly here, and the
roll should say so, but the leader should know the check-in was missed.

The same person twice is decided by student number when there is one, and by
name plus phone otherwise. A wrong read is removed from the roll, with an undo.

iPhones cannot vibrate from a web page at all; the sound and the flash are the
signals there. Android does, after the first tap on the page.

## Who can use it

Anyone with the address. There is no passkey: the codes it reads carry nothing
a phone camera would not show anyway, and the roll stays on the leader's phone.
If that stops being enough, Cloudflare Access can protect `/scan/*` with Google
login without a code change; see "What is not built" below.

## Where everything lives

| Path                                     | What                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `src/pages/scan/index.astro`             | The page: the install screen, the three app screens, the dialogs, the script |
| `src/pages/scan/manifest.webmanifest.ts` | The app manifest, scoped to `/scan/`, colours from tokens                    |
| `src/lib/scan/roll.ts`                   | The roll: check in, repeats, gaps, remove, fill, CSV, text                   |
| `src/lib/scan/store.ts`                  | Rolls and the open hike in localStorage                                      |
| `src/lib/scan/camera.ts`                 | The back camera and the detection loop                                       |
| `src/lib/scan/feedback.ts`               | The three tones and buzz patterns                                            |
| `public/scan/sw.js`                      | The service worker                                                           |
| `integrations/precache.ts`               | Fills the worker's file list after the build                                 |

The pure parts (`roll.ts`, `store.ts`) have tests under
`src/lib/scan/*.test.ts` and run with `pnpm test`.

## How it works offline

`public/scan/sw.js` is emitted as a root-scoped service worker and registered
with `/` so it can cache Astro's `/_astro/` assets as well as `/scan/`. Its
navigation handler only serves the scanner, so the rest of the site does not
go through it. On install it caches every file the page needs and answers from
that cache first, refreshing in the background when the phone is online.

The list of files is not known until the build ends, because Astro hashes
asset names. `integrations/precache.ts` runs on `astro:build:done`, reads the
built `scan/index.html`, follows the script's imports and the stylesheet's
font references, and writes the list and a content hash into the copy of the
worker in `dist/`. In development the worker keeps its placeholders and is not
registered.

Following the imports matters. Vite puts the validation code that the trail
pass and the scanner share into its own chunk, which only the script names. A
list taken from the page alone left it out, and a phone installed and taken
offline before a second visit would have opened a page that could not run.
Fonts are the Latin files only, to keep the cache under a megabyte and a half.

The barcode reader is the browser's `BarcodeDetector` where it exists (Chrome
on Android, recent Safari). Elsewhere `barcode-detector` registers a ZXing
build compiled to WebAssembly under the same name. That loader fetches its
`.wasm` from a CDN by default; `camera.ts` imports the file as a build asset
instead, tells the loader that URL, and the page lists it with a prefetch so
the worker caches it. It is about 1.1 MB, and only phones without a native
reader ever download it.

Rolls are in localStorage, one key per hike, under
`griffith-hiking-club:scan:`. The app asks for persistent storage on open so
the browser does not evict them. On iOS that exemption only applies
to an app on the home screen, which is another reason to install it.

## Testing

In a desktop browser, `/scan/?app` opens the app screens in a tab. That only
works on the dev server; a production build ignores it.

Phones open the camera only on HTTPS, and a laptop's address on the wifi is
not: on `http://192.168.x.x` the browser hides the camera API altogether and
the app says so. Use a tunnel:

```bash
pnpm dev                                         # or astro dev --host --background
cloudflared tunnel --url http://localhost:4321    # prints an https URL
```

`astro.config.mjs` allows `*.trycloudflare.com` as a host, which Vite would
otherwise block. An app installed from a tunnel address dies with the tunnel,
so install from the deployed site for anything beyond a quick look.

If the camera is refused on HTTPS, the phone has remembered a "don't allow".
On an iPhone that is Settings, then Safari (or the app's own entry), then
Camera. On Android it is the site's permissions in Chrome.

To test offline: install the app, put the phone in aeroplane mode, kill the
app, reopen it. To test the worker's update: deploy a change, open the app
online once, and open it again.

## What is not built

- **A door.** Cloudflare Access on `/scan/*` with Google login for the same
  executives who edit the calendar, if an open address ever becomes a problem.
  Configuration, not code. The worker already treats any non-200, a login
  redirect included, as "keep what you have".
- **The hiker's pass offline.** `/trail-pass` is not cached, so a hiker with
  no signal and a cold browser cannot open their own pass. The worker here is
  scoped to `/scan/` and cannot fix that.
- **Sync.** Rolls stay on the phone. If the club ever wants them somewhere
  central, a Worker that accepts a CSV is the shape of it. Writing to Sanity
  from the phone is out: the free plan has only Administrator tokens, and a
  token in a browser is a token anyone can lift.
- **Expiry.** Rolls stay until cleared. A trimester of names on a leader's
  phone is a privacy question the club should answer; deleting rolls thirty
  days after the hike would be the sensible default.
