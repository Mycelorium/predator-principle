# Start in GitHub with almost no setup

Public author: **Nirodha Collective**  
Public licence: **CC BY 4.0**  
Campaign: **24 bilingual dispatches / 8 weeks / Monday, Wednesday, Friday**

## Claude does this once

1. Create public repository `predator-principle` and upload this folder as root.
2. The first autopilot run replaces `Mycelorium` automatically from GitHub. Claude
   may also run `node scripts/configure-repository.mjs GITHUB_USERNAME` first.
3. Run `node scripts/validate.mjs`.
4. Allow GitHub Actions read/write access.
5. Select GitHub Pages source: **GitHub Actions**.
6. Run **Campaign autopilot and Pages deploy** once.
7. Return the repository, Pages, and first-dispatch URLs.

After that, no weekly operator is required for the fixed campaign:

- M/W/F: next dispatch + site/feeds update
- Tuesday: unreviewed literature candidate issue
- Sunday: public digest release
- continuously: claim validation on every pull request/push

Optional wider syndication needs only the repository secret
`SYNDICATION_WEBHOOK_URL` pointing to n8n, Make, Zapier, Buffer, or a custom
receiver. The site, RSS, JSON Feed, sitemap, `llms.txt`, GitHub releases, and
research inbox need no external service.
