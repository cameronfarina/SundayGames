# Sunday Games ESPN Connector

This Manifest V3 browser extension removes the manual DevTools step when a Sunday Games user
connects one private ESPN fantasy league.

It reads exactly two cookies from https://fantasy.espn.com: espn_s2 and SWID. It does not read the
user's ESPN password, enumerate unrelated cookies, scrape ESPN pages, or store credentials inside
the extension. Sunday Games sends the two values through its existing authenticated connection
flow and stores them using the existing encrypted credential envelope.

## Test it locally

1. Run ASDF_NODEJS_VERSION=24.19.0 npm run build:extension from the repository root.
2. Open chrome://extensions.
3. Turn on Developer mode.
4. Choose **Load unpacked** and select dist/browser-extension.
5. Sign in at [ESPN Fantasy](https://fantasy.espn.com/) in the same Chrome profile.
6. Open Sunday Games, paste the private ESPN league link, and choose **Find this league**.
7. Choose **Connect with browser extension** when the private-league options appear.

The extension button is rendered only after Sunday Games detects the installed extension. Without
it, the current public-link and manual-cookie paths remain available.

## Release boundaries

- This is a desktop Chrome/Edge path. It does not make private ESPN sync available in mobile Chrome.
- Do not publish or broadly enable the connector until Sunday Games has provider authorization for
  commercial ESPN sync and has completed an accountable human security review.
- A Chrome Web Store release needs a developer account, privacy disclosures, listing images, a
  support URL, and review approval.
- Upload dist/sunday-games-espn-connector.zip; do not upload the repository or source directory.
