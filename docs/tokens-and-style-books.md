---
title: Tokens and style books
order: 2
---

# Tokens and style books

The design system's tokens are not a separate file: they are Liferay frontend tokens, declared by the theme and valued by style books. That is what lets one fragment set serve a light and a dark site with no change to the fragments.

## How it fits together

- The **theme** (Classic + Liferay Sites DS) declares every token with its CSS variable and default value, in `frontend-token-definition.json`.
- A **style book** overrides values. LSDS Light and LSDS Dark are two style books of the same theme.
- A **fragment** reads CSS variables only, never colours. `var(--sds-surfaces-text-primary)` is the whole contract.

Switch the style book in the toolbar: the tables below and every embedded preview follow it.

## Brand and accent

```tokens
set: sdsBrand
```

```tokens
set: sdsAccent
```

## Surfaces and text

These are the tokens most fragments read. Text primary is what labels, titles and body text use on every surface.

```tokens
set: sdsSurfaces
```

## Actions

Buttons and links.

```tokens
set: sdsAction
```

```fragment
key: lsds-button
title: A button reads only action tokens
```

## Sizes and spacing

```tokens
set: sdsSize
```

## Editing a style book

Create or duplicate a style book from the toolbar, edit any token in the Style book tab under a fragment, and export it. The export is the zip Liferay's Style Books admin imports, and it keeps a reference to the theme it belongs to.
