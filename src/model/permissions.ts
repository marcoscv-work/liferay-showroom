import type {Collection, PageTemplate, StyleBook} from './types';

/**
 * What may be done with an asset. Today the answer depends only on where
 * the asset comes from: what ships with the showroom lives in the
 * repository, so the browser can show it but not change or delete it, and
 * what a person imported or created here is theirs. Every part of the
 * interface asks here, so roles and permissions have one place to arrive.
 */

/** A set whose fragments can be changed and deleted in the browser. */
export function canEditCollection(collection: Collection): boolean {
	return collection.source === 'imported';
}

export function canDeleteCollection(collection: Collection): boolean {
	return collection.source === 'imported';
}

export function canDeleteFragment(collection: Collection): boolean {
	return canEditCollection(collection);
}

export function canDeleteTemplate(template: PageTemplate): boolean {
	return template.source !== 'builtin';
}

export function canDeleteStyleBook(styleBook: StyleBook, defaultKey: string): boolean {
	return styleBook.key !== defaultKey && styleBook.source !== 'builtin';
}
