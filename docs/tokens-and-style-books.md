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

Every style book has a page of its own: pick it under **Style books** in the sidebar, or create one there. The page is its editor at full size, next to a preview that shows the style book at work (its own tokens, a few fragments made for its theme, and the type, buttons, messages and forms every theme styles) and follows each change. The address of the page names the style book, so a link opens it.

The same editor sits in the Style book tab under a fragment or a page template, for changing a token while you look at what it does there. Create, duplicate, export or delete a style book from the toolbar. The export is the zip Liferay's Style Books admin imports, and it keeps a reference to the theme it belongs to.

The editor has three parts above the table of tokens:

- **Added to this style book**: the tokens the style book adds to its theme. See below.
- **Palette**: the theme's colours with this style book's values. A scale the token names describe, such as the grays from 100 to 900 or a colour from its lightest to its darkest shade, shows as one strip; the colours that belong to no scale follow. A dot marks the ones this style book changes, and picking a colour finds its token in the table.
- **Contrast**: the pairs of text and background the token names describe (a button's colour on its background colour, a text colour on the page background), each with its WCAG ratio and what that is enough for, worst first. It opens by itself when a pair is below 4.5:1.

"Only the tokens this style book changes" narrows the table to what makes the style book what it is.

## Tokens of your own

A theme decides which tokens exist, and a brand usually has values none of them covers. **Added to this style book** is where those go: pick a kind, give it a name and a value, and it becomes a token of the style book.

| Kind | For | Example value |
|---|---|---|
| Colour | A brand colour the theme has no token for | `#7414ff` |
| Font family | A display or a brand font | `Georgia, "Times New Roman", serif` |
| Font size | A size outside the theme's scale | `2.5rem` |
| Font weight | A weight | `600` |
| Spacing | A gap or a padding | `4rem` |
| Radius | A corner | `1rem` |

- Each is a CSS custom property named after its label: "Brand purple" is `var(--brand-purple)` in any fragment, and a colour shows up in the colour pickers of fragment configuration next to the theme's tokens.
- Rename it, change it or remove it there. A small sample shows what the value looks like, and a colour has its contrast with the page background next to it.
- The export carries them the way Liferay does since 2026.Q4, in a `frontend-token-definition.json` next to the values, so the Style Books admin imports them with the style book. A style book exported from Liferay with tokens created in its editor brings them here too, filed where Liferay filed them.

Liferay names a token created in its editor with a generated id. The ones made here have readable names, which the definition format allows; check the first import of a style book with its own tokens on your Liferay version.

## From the colours of a site

**Import** has **Style book from a website**. Paste the site's stylesheet, its custom properties or a design tokens file (the W3C format, Style Dictionary or a Figma variables export) and the showroom reads the colours itself, with no AI: the ones declared under the name of a theme token go to that token, and the rest are offered as colours of the style book's own. A website address or a screenshot needs a model to read it, which also decides the role of each colour instead of going by its name; see AI features.

Either way you get the same review: each token with its colour now and the one proposed, each new colour with a name you can change, the contrast of each with the page background, and a box to leave any of them out.
