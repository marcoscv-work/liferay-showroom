# Button

The primary call to action of the Liferay Sites design system. One fragment, four variants and three sizes, all driven by `configuration.json`, so an editor picks them from the fragment's panel and never touches markup.

```fragment
key: lsds-button
```

## When to use each variant

- **filled** is the one action a block exists for: the hero's "Contact sales", a section's "See all resources". One per block.
- **outline** sits next to a filled button as the secondary path, "Watch the demo" beside "Start free".
- **neutral** is for actions on media or dark surfaces where brand colour would compete with the content.
- **rounded** is the pill shape the marketing pages use in navigation and chips. Do not mix it with the other shapes in the same block.

```fragment
key: lsds-button
variant: outline
```

```fragment
key: lsds-button
variant: neutral
editable.link-1: Watch the demo
```

## Sizes

`lg` is the default on pages, `md` inside cards and forms, `sm` only in dense places such as the header.

```fragment
key: lsds-button
size: sm
variant: rounded
```

## In Liferay

The link is an editable (`link-1`), so the text and the target are mapped in the page editor like any Liferay link: a URL, a page or a content field. The button renders as an `<a>` on purpose: Liferay cannot map a `<button>`.

Tokens it reads: `--sds-btn-*` for the shape and `--sds-action-*` for the colours, both in [the style books](fragment:liferay-sites-ds/lsds-button).
