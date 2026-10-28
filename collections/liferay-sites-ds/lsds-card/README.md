# Card

The unit of every grid on the marketing pages: a resource, a capability, a customer story. Image, label, title, text and a link, each an editable.

```fragment
key: lsds-card
```

## Surfaces

- **glass** is the default on the dark pages, a translucent panel over the gradient.
- **static** is the flat card for light pages and dense grids.
- **highlighted** singles out one card in a row, the featured resource.
- **none** drops the panel and keeps only the content, for image-led grids.

```fragment
key: lsds-card
surface: highlighted
```

```fragment
key: lsds-card
surface: static
tone: purple
```

## Tone

`blue` and `purple` set the accent of the label and the hover glow; they do not change the surface. Use one tone per grid.

## In Liferay

The image (`image-1`) and the link (`link-1`) are the usual editables, which is what makes a card mappable to a content set: drop the card in a collection display, map the image and the title to the content fields, and the grid fills itself.
