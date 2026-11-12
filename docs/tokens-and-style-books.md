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

The Style book tab starts with its **Colours**. "From the theme" is every colour token as a swatch, with a dot on the ones this style book changes: pick one to find it in the table. "Only the tokens this style book changes" narrows the table to what makes the style book what it is.

## Colours of your own

A theme decides which tokens exist, and a brand usually has colours none of them covers. **Added to this style book** is where those go: give a colour a name and a value, and it becomes a token of the style book.

- It is a CSS custom property named after its label: "Brand purple" is `var(--brand-purple)` in any fragment, and it shows up in the colour pickers of fragment configuration next to the theme's tokens.
- Rename it, change it or remove it there. Next to each one is its contrast with the page background and what that is enough for by WCAG 2.2 AA: text, large text and controls, or decoration.
- The export carries them the way Liferay does since 2026.Q4, in a `frontend-token-definition.json` next to the values, so the Style Books admin imports them with the style book. A style book exported from Liferay with tokens created in its editor brings them here too.

Liferay names a token created in its editor with a generated id. The ones made here have readable names, which the definition format allows; check the first import of a style book with its own colours on your Liferay version.

## From the colours of a site

**Import** has **Style book from a website**. Paste the site's stylesheet, its custom properties or a design tokens file (the W3C format, Style Dictionary or a Figma variables export) and the showroom reads the colours itself, with no AI: the ones declared under the name of a theme token go to that token, and the rest are offered as colours of the style book. A website address or a screenshot needs a model to read it, which also decides the role of each colour instead of going by its name; see AI features.

Either way you get the same review: each token with its colour now and the one proposed, each new colour with a name you can change, the contrast of each with the page background, and a box to leave any of them out.
