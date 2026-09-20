# Griffith Hiking Club

Hikes, club photos and offline attendance for Griffith University's Hiking Club.

[Visit griffithhiking.club](https://griffithhiking.club)

<table>
  <tr>
    <td width="75%"><a href="docs/media/homepage.png"><img src="docs/media/homepage.png" alt="Griffith Hiking Club desktop homepage" /></a></td>
    <td width="25%"><a href="docs/media/instagram-mobile.png"><img src="docs/media/instagram-mobile.png" alt="Mobile homepage at the Instagram section" /></a></td>
  </tr>
</table>

## Trail Pass, without reception

Many hikes have no reception. Save a screenshot of your Trail Pass before leaving. Its QR code carries your details, so leaders can check you in and out offline.

Leaders install and open the [scanner](https://griffithhiking.club/scan/) while online first. Attendance stays on their phone.

Enter details → save your pass. Example details below.

<p>
  <a href="docs/media/trail-pass-details.png"><img src="docs/media/trail-pass-details.png" width="240" alt="Trail Pass form with William Jackson's example details" /></a>
  <a href="docs/media/trail-pass-continue.png"><img src="docs/media/trail-pass-continue.png" width="240" alt="Example student number and phone number before continuing" /></a>
  <a href="docs/media/trail-pass-ready.png"><img src="docs/media/trail-pass-ready.png" width="240" alt="Completed Trail Pass with its QR code" /></a>
</p>

### At the trailhead

Pick a hike → scan in → scan out. “Still out” shows who has yet to return.

<p>
  <a href="docs/media/scanner-roll.png"><img src="docs/media/scanner-roll.png" width="280" alt="Offline attendance roll with William Jackson checked in and the Still out filter" /></a>
</p>

## Run locally

Astro, TypeScript, Tailwind CSS and Sanity. Requires Node.js 22.12+ and pnpm.

```sh
pnpm install
pnpm dev --background
```

Open [localhost:4321](http://localhost:4321).

[CMS](docs/cms.md) · [Offline scanner](docs/scanner.md) · [Deployment](docs/deploy.md)
