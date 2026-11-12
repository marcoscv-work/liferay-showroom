import {useSyncExternalStore} from 'react';

import type {AIImage} from '../ai/types';

/**
 * Whether the import dialog is open, and the images waiting for it: anything
 * can open it (the sidebar, an image dropped on the window) without the
 * components knowing about each other.
 */

interface ImportDialogState {
	images: AIImage[];

	/** Something to tell the person about what they dropped, such as an image too large to use. */
	notice: string;
	open: boolean;
}

let state: ImportDialogState = {images: [], notice: '', open: false};

const listeners = new Set<() => void>();

function set(next: ImportDialogState): void {
	state = next;

	for (const listener of listeners) {
		listener();
	}
}

export function openImportDialog(images: AIImage[] = [], notice = ''): void {
	set({images: [...state.images, ...images], notice, open: true});
}

export function closeImportDialog(): void {
	set({images: [], notice: '', open: false});
}

export function setImportImages(images: AIImage[]): void {
	set({...state, images});
}

export function useImportDialog(): ImportDialogState {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
		() => state,
		() => state
	);
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Images above this are refused: a model takes a few megabytes each, and a screenshot is rarely more. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isImageFile(file: File): boolean {
	return IMAGE_TYPES.includes(file.type);
}

export function isAssetFile(file: File): boolean {
	return /\.(zip|json)$/i.test(file.name);
}

/** Reads the images among some files; the ones too large come back by name. */
export async function readImages(files: File[]): Promise<{images: AIImage[]; rejected: string[]}> {
	const images: AIImage[] = [];
	const rejected: string[] = [];

	for (const file of files.filter(isImageFile)) {
		if (file.size > MAX_IMAGE_BYTES) {
			rejected.push(file.name);

			continue;
		}

		const dataURL = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = () => resolve(String(reader.result));
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});

		images.push({data: dataURL.slice(dataURL.indexOf(',') + 1), mediaType: file.type, name: file.name});
	}

	return {images, rejected};
}
