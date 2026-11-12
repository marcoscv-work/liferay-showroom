---
title: AI features
order: 5
---

# AI features

Liferay's assets are flat files: a fragment is HTML, CSS, JavaScript and a JSON of options, a page template is a JSON tree, a style book is a JSON of values. A model writes them in one pass, so the showroom can turn a design or a website into drafts of them, and rework the fragments it already has.

Everything a model writes arrives as a **draft**. Nothing is published, nothing in the repository changes, and you review each result before you keep it.

## Bringing something in

**Import** opens a dialog. Liferay exports go in as before, by dropping or choosing them. Under them, **Create with AI** has three features:

- **Fragment from a design.** A screenshot, a mockup or a Figma frame becomes a fragment with its configuration and editables, written on the tokens of the style book in use, not on the colours of the picture.
- **Page template from a design.** A page design becomes a page template composed with the fragments already in the catalog. A new fragment is written only for a block none of them covers.
- **Design system from a website.** A website or a published design system becomes a style book, a first set of fragments and a template of its home page.

Each takes images, a link, or both, and a note in your own words. An image dropped anywhere on the window opens the dialog with the image in it.

What comes back is listed before anything is added: the drafts, the notes the model left on what it assumed or could not match, and what the showroom's own checks found. **Keep as drafts** puts the fragments in the "AI drafts" set of your browser, where you open, edit, export or delete them like any imported set.

## Reworking a fragment

**Improve with AI**, in the toolbar of a fragment, has three more:

- **Use design tokens** replaces hard-coded colours, sizes and fonts with the tokens that cover them.
- **Review accessibility** checks the fragment against WCAG 2.2 AA and fixes what it finds, with the success criterion and the reason for each change.
- **Write the docs** writes the fragment's Docs page from its code.

Each ends in a review: the list of changes and, file by file, the lines removed and added. A fragment you imported is changed in place. A fragment that ships with the showroom is saved as a copy in "AI drafts", since the repository is where it really changes.

## Where the model comes from

AI configuration belongs to **Liferay AI Hub**, and that link is not made yet. The showroom ships no model, no key and no endpoint: until a provider is connected, **Generate** is off and the dialog says so.

Two things work today:

- **Copy agent brief**, on every feature, copies the request with its rules, its context (the tokens, the catalog, the fragment) and where each file goes in this repository. Give it to a coding agent working in the repository and review what it commits.
- **Demo mode.** Add `?ai=demo` to the address to see every flow end to end with sample output the showroom writes itself. No model is called, and every result says so.

### Connecting a provider

A provider is one function. Whatever connects AI Hub registers it, from the bundle with `registerAIProvider` (`src/ai/provider.ts`) or from the page:

```js
window.LiferayShowroom.ai.registerProvider({
	id: 'ai-hub',
	name: 'Liferay AI Hub',
	async run(request, {onProgress, signal}) {
		// request.system and request.prompt are ready to send to a model;
		// request.data has the same context as values, for a provider that
		// builds its own prompt; request.images are base64; request.url is a
		// page the provider reads, since a browser cannot; request.schema is
		// the JSON Schema of the answer.
		return answer;
	},
});
```

The features, their prompts and the schema of each answer are in `src/ai/actions.ts` and `src/ai/guide.ts`. Nothing else has to change when the provider arrives.

## What the showroom checks

A model's answer is not trusted as it arrives (`src/ai/results.ts`):

- A fragment without markup is left out. One that does not render, or whose configuration is not valid JSON, is kept with a warning.
- A style book value is kept only for a token the theme has and only if it is a plain CSS value.
- A page that refers to a fragment that does not exist says which one.
- A fragment that loads something from another site, or whose script reaches for the network, the browser's storage or the page around it, is flagged before you keep it. A draft's script runs in the preview as soon as the draft is shown, so read `index.js` when you see that warning.

A website is material the model reads, and the prompt says so: text on it that asks for something else is to be ignored. That lowers the risk of a page steering the model and does not remove it, which is why those checks run on the answer and the review comes before anything is kept.
