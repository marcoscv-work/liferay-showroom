# Liferay Storybook

A Storybook-style explorer for Liferay design assets that runs anywhere a static site runs (GitHub Pages, Netlify, a `file://` folder): **no Liferay Portal, Docker or Tomcat involved**.

It renders fragments, page templates and style books the way Liferay does:

1. The real compiled CSS of a Liferay theme (Clay + the theme's `main.css`) is loaded first.
2. The style book values are injected as the `:root { --token: value }` block Liferay generates.
3. The fragment `index.html` (FreeMarker) is rendered with the fragment configuration, then `index.css` and `index.js` run exactly as in a content page.

## What you can do

- **Browse fragments** from bundled (Liferay Sites DS, Basic Components) or imported collections, with their `configuration.json` fields shown as controls (like Storybook args) and their `data-lfr-editable` fields editable.
- **Pick a theme** (Classic, Classic + Liferay Sites DS and Prism are bundled) or import a built theme zip.
- **Load and edit style books**: every frontend token of the theme is listed by category, overrides are applied live, and a style book can be exported as a Liferay zip.
- **Build page templates** with Liferay layout elements (containers, rows, columns, fragments), click elements in the preview to edit their configuration, editables and styles, and export a `page-definition.json` or a page template zip Liferay imports under *Design → Page Templates*.
- **Import Liferay exports** by dropping zips on the window: fragment collections, page templates, style books and built themes.
- **Check warnings**: every FreeMarker construct or Liferay dependency that cannot be reproduced outside the portal is listed instead of failing silently.

## Look and feel

The storybook's own interface is built with Clay (`public/app/cadmin.css`, the admin flavour of Clay CSS that the Liferay Control Panel uses) and Lexicon icons from the Clay spritemap, so it follows the Lexicon design language, including Clay's light and dark colour schemes. The preview lives in an iframe, so the shell never interferes with the theme being previewed.

## Running it

```bash
npm install
npm run dev
```

`npm run build` produces a static `dist/` folder with relative asset paths, ready for any static host.

## Adding content

### Fragment collections

Drop a folder under `collections/` that mirrors a Liferay fragment collection export:

```
collections/<collection>/collection.json
collections/<collection>/<fragment>/fragment.json
collections/<collection>/<fragment>/index.html
collections/<collection>/<fragment>/index.css
collections/<collection>/<fragment>/index.js
collections/<collection>/<fragment>/configuration.json
collections/<collection>/<fragment>/thumbnail.png
collections/<collection>/resources/<file>
```

`npm run pack` (run automatically by `dev` and `build`) packs them into `public/collections/`.

Collections imported through the UI are kept in the browser's local storage.

### Themes

A bundled theme lives under `public/themes/<key>/` with:

```
css/clay.css
css/main.css
frontend-token-definition.json
images/clay/icons.svg
```

Those files are the output of a Liferay theme build (`build/css`, `build/WEB-INF`, `build/images`). Register the key in `src/store/load.ts`.

A theme zip can also be imported at runtime; it is not persisted because the stylesheets are kept as blob URLs.

## How faithful is it?

- Fragment HTML is rendered by a FreeMarker interpreter written for this project (`src/freemarker`). It covers interpolations, `if`, `list`, `assign`, `macro`, `switch`, user directives and the common built-ins. Anything unsupported is reported in the **Warnings** tab.
- `configuration.json` values are resolved the way `FragmentEntryConfigurationParser` does (`colorPalette` objects, `colorPicker` token references, typed `text` fields).
- Page definitions use the same markup Liferay's layout renderer produces: `lfr-layout-structure-item-*` wrappers, `container-fluid container-fluid-max-xl` for fixed-width containers, Bootstrap rows and columns per viewport, `fragmentStyle` converted to the `!important` CSS of `common-styles.json`, spacing numbers mapped to `spacer-N` tokens.
- Taglibs and widgets that need the portal (`[@liferay_portlet]`, collection displays, forms, mapped content) are rendered as placeholders and listed as warnings.

## Liferay Sites Design System as fragments

`scripts/build-lsds.mjs` converts the [Liferay Sites Design System](https://makenaford.github.io/liferay-sites-design-system) Storybook (React + Mantine) into plain Liferay assets, driven by `scripts/lsds/spec.mjs`:

- `collections/liferay-sites-ds/`: the simplest story of each component as a fragment. The rendered markup is kept, the CSS the story actually uses is extracted (CSS-module names become `lsds-*`), headings, paragraphs, images and links become editables, and the component's basic props become `configuration.json` fields bound to the `data-variant` / `data-size` attributes the CSS keys on. Interactive parts (reveal on scroll, accordion, tabs, marquee, banner, progress, card spotlight) run on the plain JavaScript in `scripts/lsds/behaviors.js`.
- `collections/liferay-sites-ds-pages/`: every block of a built page (header, hero, sections, footer) as a fragment, and `templates/<page>/page-definition.json` composing them into a page template.
- `public/themes/classic-lsds/`: the "Classic + Liferay Sites DS" theme, whose `frontend-token-definition.json` adds every design token the fragments read (`--sds-*` and the Mantine variables) to the Classic definition, and whose `css/fonts.css` loads the Source Sans 3 typeface once, the way the Storybook's preview head does.
- `style-books/lsds-dark` and `style-books/lsds-light`: the two colour schemes as Liferay style books. Switching the style book restyles every LSDS fragment and page, which is what the tokens are for.

Picking a fragment of these collections switches the preview to the theme that defines its tokens. Everything (fragment sets, style books, page templates) exports with the toolbar and sidebar buttons in the formats Liferay imports.

Regenerate after the design system changes:

```bash
PLAYWRIGHT_CHANNEL=chrome node scripts/build-lsds.mjs
```

`PLAYWRIGHT_MODULE` can point at an existing `playwright` package (it is not a dependency of this project). Media referenced by the built pages stays on the Storybook host; replace it through the editables.

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds the site on every push to `main` and publishes `dist/` to GitHub Pages. Enable *Settings → Pages → Source: GitHub Actions* in the repository.

## License

The bundled theme CSS, icons and basic fragments come from [Liferay Portal](https://github.com/liferay/liferay-portal) (LGPL 2.1). The storybook code is MIT.
