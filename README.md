# Liferay Showroom

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

The Showroom's own interface is built with Clay (`public/app/cadmin.css`, the admin flavour of Clay CSS that the Liferay Control Panel uses) and Lexicon icons from the Clay spritemap, so it follows the Lexicon design language, including Clay's light and dark colour schemes. The preview lives in an iframe, so the shell never interferes with the theme being previewed.

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

`npm run pack` (run automatically by `dev` and `build`) packs them into `public/collections/`. Fragments reference a resource as `[resources:<file>]`, exactly as in Liferay; the packer serves the files from `public/collections/<collection>/resources/` and the fragment set export puts them back under `resources/`.

Collections imported through the UI are kept in the browser's local storage.

### Documentation

Markdown, next to the asset it documents:

- `collections/<set>/<fragment>/README.md` is the fragment's Docs tab. It travels inside a fragment set zip (the importer reads it) and never goes into an export.
- `docs/<slug>.md` are the pages of the Docs section, with `title` and `order` in the frontmatter.

Three fenced blocks embed the live system instead of a picture of it, on the theme and style book selected in the toolbar:

````markdown
```fragment
key: lsds-button
variant: outline
editable.link-1: Watch the demo
```

```tokens
set: sdsBrand
```

```template
id: builtin-lsds-home
height: 560
```
````

Links to `other-page.md`, `fragment:<set>/<key>` and `template:<id>` select the page or asset in place.

### Releases

A release is a tag `v<version>` plus a manifest in `releases/<version>.json` listing every exportable asset with a hash of its files, and optional notes in `releases/<version>.md`. The Releases page compares consecutive manifests, so it is exact about which fragments, templates and style books changed, file by file, with links to the repository history.

```bash
npm version minor            # bumps package.json and tags v<version>
npm run release              # writes releases/<version>.json and the zips under release/
git add releases && git commit --amend --no-edit && git push --follow-tags
```

Pushing the tag runs `.github/workflows/release.yml`, which records the release again on CI and attaches the zips and the manifest to the GitHub release. A past version can be recorded from a worktree at its tag with `npm run release -- --root <worktree> --version <version>`.

### Landing

`/landing/` is the product page, and it is itself a page template of the Liferay Sites DS fragments: `templates/landing/page-definition.json` (shown in the sidebar as "Product landing", editable and exportable like any other) rendered to static HTML by `scripts/landing.ts` on the LSDS Dark style book, as part of `npm run pack`. `npm run landing -- --compose` rewrites the definition from the composition in the script; `npm run product-shot` retakes the hero image from the running dev server with Playwright (`PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHANNEL` as for the LSDS build).

### AI catalog

`npm run pack` also writes `public/catalog.json` and `public/llms.txt`: every fragment with its configuration fields, editables and docs, every template and style book, the token definition of each theme, and how to write a `page-definition.json`. An agent that reads either can compose a page from the fragment keys; dropping the resulting JSON on the site turns it into a template to review and export.

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

- `collections/liferay-sites-ds/`: the simplest story of each component as a fragment. The rendered markup is kept, the CSS the story actually uses is extracted (CSS-module names become `lsds-*`, every rule is scoped to the fragment's wrapper so fragments do not restyle each other on a page), headings, paragraphs, images and links become editables, and the component's basic props become `configuration.json` fields bound to the `data-variant` / `data-size` attributes the CSS keys on. Interactive parts (reveal on scroll, accordion, tabs, marquee, banner, progress, card spotlight) run on the plain JavaScript in `scripts/lsds/behaviors.js`.
- `collections/liferay-sites-ds-pages/`: every block of a built page (header, hero, sections, footer) as a fragment, and `templates/<page>/page-definition.json` composing them into a page template. The images and videos the blocks use are downloaded into the collection's `resources/` and referenced as `[resources:<file>]` (`scripts/lsds/media.mjs`), so the exported fragment set is self-contained.
- `public/themes/classic-lsds/`: the "Classic + Liferay Sites DS" theme, whose `frontend-token-definition.json` adds every design token the fragments read (`--sds-*` and the Mantine variables) to the Classic definition, and whose `css/fonts.css` loads the Source Sans 3 typeface once, the way the Storybook's preview head does.
- `style-books/lsds-dark` and `style-books/lsds-light`: the two colour schemes as Liferay style books. Switching the style book restyles every LSDS fragment and page, which is what the tokens are for.

Picking a fragment of these collections switches the preview to the theme that defines its tokens. The selection is mirrored in the URL (`?path=/fragment/<collection>/<fragment>` or `?path=/template/<id>`), so a story can be linked and the browser history moves between stories. The editor itself has its own light / dark / system switch in the sidebar footer, independent of the theme and style book being previewed. Everything (fragment sets, style books, page templates) exports with the toolbar and sidebar buttons in the formats Liferay imports.

Regenerate after the design system changes:

```bash
PLAYWRIGHT_CHANNEL=chrome node scripts/build-lsds.mjs
```

`PLAYWRIGHT_MODULE` can point at an existing `playwright` package (it is not a dependency of this project). Media referenced by the built pages stays on the Storybook host; replace it through the editables.

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds the site on every push to `main` and publishes `dist/` to GitHub Pages. Enable *Settings → Pages → Source: GitHub Actions* in the repository.

## License

The bundled theme CSS, icons and basic fragments come from [Liferay Portal](https://github.com/liferay/liferay-portal) (LGPL 2.1). The storybook code is MIT.
