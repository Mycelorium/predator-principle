# Fast GitHub handoff for Claude

The package is complete enough to launch without further architecture work.
The sole public author identity is **Nirodha Collective**; do not add a personal
name to repository metadata or public pages.

## Give Claude this instruction

> Create a new GitHub repository named `predator-principle` under my account.
> Use the contents of the supplied `predator-principle` folder as the repository
> root; do not nest the folder. Keep the literary Fire manuscripts private and
> do not upload them. The public repository content is already licensed CC BY
> 4.0 under Nirodha Collective. Run `node scripts/configure-repository.mjs
> MY_GITHUB_USERNAME` (the autopilot also derives this automatically), followed
> by `node scripts/validate.mjs`. Commit to `main`, set Actions workflow
> permissions to read/write, enable GitHub Pages with “GitHub Actions” as source,
> and run “Campaign autopilot and Pages deploy” once. Confirm that the first
> dispatch, RSS, JSON Feed, sitemap and Pages site are public. Leave
> `content/autopilot.json` enabled. The 24 campaign dispatches are already
> authorised under the Nirodha Collective launch mandate and must publish in
> sequence every Monday, Wednesday, and Friday. The separate four items in
> `content/queue.json` remain manual drafts with `approved: false`. Return the
> repository URL, Pages URL, first-dispatch URL, workflow status, and any error.

## One decision only

Set **repository visibility to public** for dissemination. The full literary
manuscripts remain in a separate private location regardless.

## Expected checks

```bash
node scripts/validate.mjs
python3 -m http.server 8000 --directory docs
```

The site has no package install and no build step. It is bilingual and reads the
claim/source registries directly from `docs/data/`.

## Workflows Claude should see

- Validate claims
- Deploy website
- Campaign autopilot and Pages deploy
- Publish weekly digest release
- Automated research inbox
- Weekly evidence review
- Generate approved content drafts

## First launch sequence

1. Run the repository configuration script with the GitHub username.
2. Create a **public** repository and allow Actions read/write permissions.
3. Push to `main`, enable Pages from GitHub Actions, and rerun “Campaign autopilot
   and Pages deploy” if its first automatic run started before Pages was enabled.
4. Confirm the first dispatch exists under `/posts/`, then test DE/EN switching,
   E/I/P filters, RSS, JSON Feed, and the share/copy buttons.
5. Confirm the M/W/F schedule remains enabled. Do not bulk-publish all 24 items.
6. Confirm the Tuesday research inbox and Sunday digest-release schedules.

## What is intentionally excluded

- No Fire archive or manuscript text.
- No social-network credentials.
- No credentialed social-network posting until a webhook or channel adapter is
  connected. Website, feeds and GitHub releases publish autonomously.
- No claim that LLM training bias or biosphere trauma is already proven.
- No equation of dissent with predation.

## Optional one-secret syndication

If an existing n8n, Make, Zapier, Buffer, or custom webhook is available, add it
as the repository secret `SYNDICATION_WEBHOOK_URL`. Every new dispatch will then
be sent as structured JSON after publication. An optional bearer token goes in
`SYNDICATION_WEBHOOK_TOKEN`. This is not required for the autonomous website,
feeds, research inbox, or GitHub releases.
