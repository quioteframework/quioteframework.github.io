# quioteframework.github.io

Documentation site for the [Quiote PHP framework](https://github.com/quioteframework/quiote), built with [Astro Starlight](https://starlight.astro.build/).

Live at: **https://quioteframework.github.io**

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:4321.

## Adding or editing docs

Documentation lives in `src/content/docs/`. Each `.md` or `.mdx` file maps directly to a URL:

| File | URL |
|---|---|
| `src/content/docs/getting-started/installation.md` | `/getting-started/installation/` |
| `src/content/docs/guides/routing.md` | `/guides/routing/` |
| `src/content/docs/reference/action.md` | `/reference/action/` |

Every file needs frontmatter with at least `title` and `description`:

```md
---
title: Your Page Title
description: One sentence describing this page.
---

Page content here.
```

## Deploying

Pushing to `main` triggers the GitHub Actions workflow at `.github/workflows/deploy.yml`, which builds the site and deploys to GitHub Pages automatically.

Make sure the repo has **GitHub Actions** selected as the Pages source under Settings → Pages.

## Contributing

See [CONTRIBUTING.md](https://github.com/quioteframework/quiote/blob/main/CONTRIBUTING.md) in the main Quiote repository.
