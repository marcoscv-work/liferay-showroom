/** A line of a comparison between two texts. */
export interface DiffLine {
	kind: 'added' | 'removed' | 'same';
	text: string;
}

/**
 * The lines two texts share and the ones only one of them has, in order.
 * A plain longest-common-subsequence over lines: fragment files are small.
 */
export function diffLines(before: string, after: string): DiffLine[] {
	const a = before.split('\n');
	const b = after.split('\n');
	const lengths: number[][] = Array.from({length: a.length + 1}, () => new Array<number>(b.length + 1).fill(0));

	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
		}
	}

	const lines: DiffLine[] = [];
	let i = 0;
	let j = 0;

	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			lines.push({kind: 'same', text: a[i]});
			i++;
			j++;
		}
		else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
			lines.push({kind: 'removed', text: a[i++]});
		}
		else {
			lines.push({kind: 'added', text: b[j++]});
		}
	}

	while (i < a.length) {
		lines.push({kind: 'removed', text: a[i++]});
	}

	while (j < b.length) {
		lines.push({kind: 'added', text: b[j++]});
	}

	return lines;
}

/** The changed lines with a few unchanged ones around them; `null` marks a gap. */
export function diffHunks(lines: DiffLine[], context = 2): (DiffLine | null)[] {
	const keep = new Array<boolean>(lines.length).fill(false);

	lines.forEach((line, index) => {
		if (line.kind !== 'same') {
			for (let near = Math.max(0, index - context); near <= Math.min(lines.length - 1, index + context); near++) {
				keep[near] = true;
			}
		}
	});

	const hunks: (DiffLine | null)[] = [];

	lines.forEach((line, index) => {
		if (keep[index]) {
			hunks.push(line);
		}
		else if (hunks.length && hunks[hunks.length - 1] !== null) {
			hunks.push(null);
		}
	});

	while (hunks.length && hunks[hunks.length - 1] === null) {
		hunks.pop();
	}

	return hunks;
}
