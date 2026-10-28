# Label

A short tag over a title: the type of a resource, the state of a feature, the category of a card. Labels never carry an action.

```fragment
key: lsds-label
```

## Variants

- **gradient** is the default and the only one to use on light surfaces.
- **glass** is for media and the dark hero, where the label floats over an image.
- **filled** is for tonal surfaces such as cards and banners.

```fragment
key: lsds-label
variant: glass
editable.text-1: Webinar
```

```fragment
key: lsds-label
variant: filled
editable.text-1: New
```

Keep the text to one or two words. A label that wraps is a label that should have been a paragraph.

## Colours

The text colour is `--sds-surfaces-text-primary` in every variant, so a label is readable on the light and the dark style books without a variant switch. Compare it by changing the style book in the toolbar.
