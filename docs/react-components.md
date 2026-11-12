---
title: React components
order: 4
---

# React components

Showroom is about the assets Liferay imports: fragments, page templates and style books. A team often also has React components it uses elsewhere in Liferay, outside the page editor: in a custom app, a widget or the admin screens of a client extension. Those can be documented here too, next to the fragments, so the whole design system lives in one place.

This is optional. A repository without a `components/` folder shows no trace of it.

## What you get

Each component appears under **React components** in the sidebar, rendered with the selected theme and style book like a fragment:

- **Controls** for its props. Changing one re-renders the component in place: it keeps its state and the preview does not reload.
- **Docs** from its `README.md`.
- **Code** with a usage snippet that has the props you set, its source and its props as JSON. **Copy usage** in the toolbar copies the snippet.

The component runs inside the preview with its own React, so it sees the preview's window and document: portals, media queries, focus and `Liferay.ThemeDisplay` behave as on a page.

## Adding a component

```
components/<name>/index.tsx           default-exports the component (or .jsx, .ts, .js)
components/<name>/component.json      name, description, and optionally import and theme
components/<name>/configuration.json  its props, in the fragment configuration format
components/<name>/README.md           the Docs tab
```

`component.json`:

```json
{
	"description": "One sentence on what it is for.",
	"import": "import EmptyState from '@acme/ui/empty-state';",
	"name": "Empty state"
}
```

`import` is the line the usage snippet starts with, the way the component is imported where it is really used. Without it the snippet imports from `./components/<name>`. `theme` picks the theme the component opens with, as a fragment set's does.

`configuration.json` uses the fields a fragment's configuration uses, so the same controls work: `text` for strings and numbers (with `"validation": {"type": "number"}`), `select` for a fixed set of values, `checkbox` for booleans, `colorPicker` and `colorPalette` for colours. Each field's `name` is the prop it sets. Props the component takes but the configuration does not describe, such as callbacks, are simply not set.

The component is bundled when the site builds, so anything it imports must be a dependency of this repository: add `@clayui/button` or any other package to `package.json` the same way its home project has it. A component that imports its own CSS gets it in the preview.

## What they are not

React components are not Liferay assets. A page template cannot place one, the Design Library and the releases leave them out, and nothing imports them into Liferay. To put one on a page, wrap it as a custom element client extension; that wrapper is Liferay's, not Showroom's.

A component that reads Liferay data, through the headless APIs or Objects, has no portal to ask here. Give it sample data through its props, or let it show its empty state.
