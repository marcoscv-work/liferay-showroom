# Empty state

Shown in place of a list or a result set that has nothing to show. It is the Clay empty state the portal's React apps use, so it matches them under any theme and style book.

## When to use it

- **Empty state**: a list that has no items yet. The action creates the first one.
- **Search state**: a search or a filter that matches nothing. The action clears it, or there is none.
- **Success state**: a task that left nothing to do, such as an inbox with every item handled.
- The other symbols illustrate a feature that has nothing yet: **Page builder**, **Content types**, **Workflow**, **Audience radar**, the **AI** ones and so on. Pick the one that names what is missing.

The illustrations are the animated symbols of `empty_states.svg`, which the portal serves with each theme and `Liferay.ThemeDisplay.getPathThemeEmptyStatesSpritemap()` points at. They follow the light and dark scheme and hold still for people who prefer reduced motion.

## Writing

Say what is missing in the title and what to do about it in the description, in one short sentence each. Keep the action a verb: "Add item", "Clear filters".

The illustration is decorative, so it has no alternative text: the title carries the meaning.
