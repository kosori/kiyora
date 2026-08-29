import { describe, expect, test } from 'bun:test';
import {
	browserDownloadable,
	downloadKira,
	FILENAME_EXTENSION,
	FILENAME_FALLBACK,
	kiraFilename,
	REQUIRED_MIME_TYPE,
} from './io';

describe('kiraFilename', () => {
	test('slugifies a Diagram title into a stable base name', () => {
		expect(kiraFilename('Cache Server')).toBe('cache-server.kira');
		expect(kiraFilename('Request pipeline')).toBe('request-pipeline.kira');
	});

	test('uses the fallback when the title is empty or whitespace', () => {
		expect(kiraFilename('')).toBe(`${FILENAME_FALLBACK}.${FILENAME_EXTENSION}`);
		expect(kiraFilename('   ')).toBe(
			`${FILENAME_FALLBACK}.${FILENAME_EXTENSION}`
		);
	});

	test('uses the DSL slug fallback for non-empty titles that produce no word', () => {
		// A non-latin or symbol-only title is non-empty but the DSL
		// slugify rule falls back to "node" for it. The file name
		// mirrors that result so Save is always deterministic.
		expect(kiraFilename('!!!')).toBe('node.kira');
	});
});

describe('downloadKira', () => {
	type RecordedDownload = {
		blob: Blob;
		filename: string;
	};

	function makeDownloadable(): {
		downloadable: ReturnType<typeof browserDownloadable>;
		recorded: RecordedDownload[];
	} {
		const recorded: RecordedDownload[] = [];
		const downloadable = {
			save({ blob, filename }: RecordedDownload): void {
				recorded.push({ blob, filename });
			},
		};
		return { downloadable, recorded };
	}

	async function blobText(blob: Blob): Promise<string> {
		return await blob.text();
	}

	test('downloads the given Source with the Kira MIME type and title-based filename', async () => {
		const { downloadable, recorded } = makeDownloadable();
		const source = 'architecture\ntitle Request pipeline\nA -> B';

		downloadKira({ downloadable, source, title: 'Request pipeline' });

		expect(recorded).toHaveLength(1);
		const [entry] = recorded;
		expect(entry?.filename).toBe('request-pipeline.kira');
		expect(await blobText(entry?.blob as Blob)).toBe(source);
		expect(entry?.blob.type).toBe(REQUIRED_MIME_TYPE);
	});

	test('falls back to the agreed filename when the title is unusable', () => {
		const { downloadable, recorded } = makeDownloadable();

		downloadKira({ downloadable, source: 'flowchart\nA -> B', title: '' });

		const [entry] = recorded;
		expect(entry?.filename).toBe('diagram.kira');
	});

	test('does not encode canvas-only Scene placement, selection, or Viewport', () => {
		const { downloadable, recorded } = makeDownloadable();
		const source = 'architecture\ntitle Stable\nA -> B';

		// The signature only accepts Source, not Scene or Viewport. The
		// recorded entry below must mirror the Source byte-for-byte, so any
		// future widening of the boundary is caught here.
		downloadKira({ downloadable, source, title: 'Stable' });

		const [entry] = recorded;
		expect(entry?.filename).toBe('stable.kira');
		expect(entry?.blob.size).toBe(source.length);
	});
});

describe('browserDownloadable', () => {
	test('returns an object whose save method is a function', () => {
		const downloadable = browserDownloadable();
		expect(typeof downloadable.save).toBe('function');
	});
});
