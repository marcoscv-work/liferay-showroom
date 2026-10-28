# Hero

The first block of every page: an eyebrow, a title, a sentence and two actions. It has no configuration on purpose, so every page opens the same way and the variation lives in the words and the media.

```fragment
key: lsds-hero
```

## Editables

| Id | Type | Use |
| --- | --- | --- |
| `text-1` | text | The eyebrow, one or two words |
| `title-1` | text | The title, two lines at most on desktop |
| `text-2` | text | The sentence under the title |
| `link-1` | link | The primary action, a filled button |
| `link-2` | link | The secondary action, an outline button |

## In a page

On [LSDS Home](template:builtin-lsds-home) the hero sits under the fixed header, and the header's height is accounted for by the hero's own padding (`body:has(.headerShell[data-position=fixed])`). When you compose a page without the header, the hero keeps a smaller top padding.
