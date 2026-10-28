# Section: Resources

A section title, an intro and a grid of three resource cards, each with a label, an image and a title. It is the section of a page that most often becomes a collection display in Liferay.

```fragment
key: lsds-section-resources
height: 720
```

## Structure

The section is one fragment so that an editor can drop it as a whole; inside, every card repeats the [Card](fragment:liferay-sites-ds/lsds-card) pattern with its own editables (`image-1`, `text-2`, `text-3`...). For a grid fed by content, use the Card fragment inside a collection display instead and keep this section for hand-picked resources.

## Labels

The labels in the cards use the `gradient` variant of [Label](fragment:liferay-sites-ds/lsds-label); change the style book to LSDS Light in the toolbar to see them keep their contrast.
