---
title: Getting started
order: 1
---

# Getting started

This site is the published, versioned face of a set of Liferay assets: fragment sets, page templates and style books. Everything you see here is exactly what gets imported into Liferay, rendered without a Liferay.

## What is here

- **Fragments**, grouped in fragment sets. Each one renders live with its configuration as controls and its editables as fields, like the fragment panel in the page editor.
- **Page templates**, composed of those fragments with Liferay's own layout structure (containers, rows, columns).
- **Style books**, the sets of token values a theme exposes. Switch one in the toolbar and every fragment and page restyles.
- **Docs**, these pages and the Docs tab of each fragment, written in plain Markdown next to the asset.
- **Releases**, one per version, with the zips and the exact list of assets that changed.

## Import into Liferay

Every asset exports as the zip Liferay imports, from the same place you see it:

1. A fragment set: the download icon next to the set in the sidebar. Import it in **Site Builder → Fragments → Import**. Fragments keep their key, so a newer version updates the fragments in place.
2. One fragment: **Export fragment** in the toolbar. It is a one-fragment set.
3. A page template: **Export template** in the toolbar, then **Site Builder → Page Templates → Import**. The `page-definition.json` button gives the definition alone, for the headless API or for an agent.
4. A style book: the download icon in the style book group of the toolbar, then **Site Builder → Style Books → Import**.

Each release lists the same zips attached to the GitHub release, so a team imports a version, not a snapshot of someone's browser.

## Bring your own assets

Drop any Liferay export on the page: a fragment set, a page template, a style book, a built theme, or a bare `page-definition.json`. Imported assets stay in your browser and never leave it.

## Where the files live

```
collections/<set>/<fragment>/index.html|index.css|index.js|configuration.json
collections/<set>/<fragment>/README.md     the Docs tab, never exported
collections/<set>/resources/<file>         [resources:<file>] in the fragments
templates/<template>/page-definition.json
style-books/<style-book>/frontend-tokens-values.json
docs/<page>.md                             these pages
releases/<version>.json                    one manifest per release
```

The folders are the Liferay export layout, so a Liferay export unzips straight into the repository and a release is a tag.
