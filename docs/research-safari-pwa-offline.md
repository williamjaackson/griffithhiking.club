# Safari PWA offline and camera findings

Research date: 2026-09-03

The reported error, “Safari cannot open the page because your iPhone is not
connected to the Internet,” matches an open WebKit failure report for Home
Screen apps. WebKit bug 225083 documents intermittent offline launch failures
on iOS 14.5 and 14.6, with the same Safari error text, even for apps using
service workers. The report says the app can fail after repeatedly closing and
reopening while offline.

WebKit bug 190269 documents an earlier iOS issue where service-worker caches
were not shared correctly between Safari and a Home Screen app. Its repro is
the same shape: load the PWA online, add it to the Home Screen, disable the
network, then launch it from the Home Screen.

WebKit bug 232302 documents Safari deleting service-worker and other site data
after seven days of inactivity. WebKit’s guidance on that report is to use
`standalone` or `fullscreen` so the app opens as a full-screen Web App. This
project already uses `standalone`.

The camera symptom also has a close match. WebKit bug 252465 reports that an
iOS standalone PWA may be unable to reacquire a `getUserMedia()` video stream
after relaunch. The report says there is no simple application-level fix for
the affected iOS versions.

## What the project can control

- Emit and register the service worker at the site root, because Astro assets
  are under `/_astro/` while the app page is under `/scan/`.
- Precache the scanner page and all of its hashed script, style, font, and
  WebAssembly dependencies.
- Keep the navigation handler cache-first and make camera startup idempotent.
- Test on the target iOS version after a fresh online launch and service-worker
  install.

## What the project cannot guarantee

If iOS has discarded or failed to attach the Home Screen app’s service-worker
storage, Safari rejects the launch before page JavaScript runs. A page-level
fallback cannot replace that missing app shell. The practical recovery is to
open the site in Safari while online, remove and re-add the Home Screen app if
needed, and keep iOS updated. The camera reacquisition issue may still require
an iOS update or a user-facing retry/reset flow.

Sources:

- [WebKit bug 225083: PWA/Home Screen apps intermittently fail to open offline](https://bugs.webkit.org/show_bug.cgi?id=225083)
- [WebKit bug 190269: iOS service-worker cache not shared when added to Home Screen](https://bugs.webkit.org/show_bug.cgi?id=190269)
- [WebKit bug 232302: service worker and storage deleted after seven days](https://bugs.webkit.org/show_bug.cgi?id=232302)
- [WebKit bug 252465: video stream may be unable to play in a PWA](https://bugs.webkit.org/show_bug.cgi?id=252465)
- [Apple WWDC23: What’s new in web apps](https://developer.apple.com/videos/play/wwdc2023/10120/)
