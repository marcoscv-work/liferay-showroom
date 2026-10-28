---
title: Page composition
order: 3
---

# Page composition

A page template is Liferay's `page-definition.json`: a tree of containers, rows and columns with fragments in them. The Layout tab under a template edits that tree directly, and the export is the zip Liferay imports.

## LSDS Home

The home page of the design system, every block a fragment of the "Liferay Sites DS pages" set.

```template
id: builtin-lsds-home
height: 560
```

## Composing a page

1. **New** in the Page templates section of the sidebar.
2. In the Layout tab, add a **Container** (full width or fluid), a **Row** with the columns you need, and a **Fragment** in each column from the picker.
3. Click any element in the preview or in the tree to edit its styles: spacing, background, borders, the same options as the page editor, stored in `fragmentStyle` with the theme's spacer tokens.
4. **Export template**, or copy `page-definition.json` from the Code tab.

## For agents

The `page-definition.json` format is stable and documented in the AI catalog at `/catalog.json` and `/llms.txt`. An agent that reads the catalog can compose a page from the fragment keys and hand back a definition; drop that file on this site and it becomes a template you can review, edit and export.

A minimal definition:

```json
{
	"pageElement": {
		"type": "Root",
		"pageElements": [
			{
				"type": "Section",
				"definition": {"layout": {"widthType": "Fluid"}},
				"pageElements": [
					{"type": "Fragment", "definition": {"fragment": {"collectionKey": "liferay-sites-ds", "key": "lsds-hero"}}}
				]
			}
		]
	},
	"version": 1.1
}
```
