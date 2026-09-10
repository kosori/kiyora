import { describe, expect, mock, test } from 'bun:test';
import { withHappyDom } from '../test-happy-dom';
import {
	browserDownloadable,
	browserOpenable,
	downloadKira,
	FILENAME_EXTENSION,
	FILENAME_FALLBACK,
	FOCUS_CANCEL_FALLBACK_MS,
	kiraFilename,
	MAX_KIRA_BYTES,
	openKira,
	REQUIRED_MIME_TYPE,
	readKiraText,
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

class FakeFile {
	name: string;
	size: number;
	type: string;
	private readonly contents: string;
	constructor(contents: string, name: string, type = 'text/plain') {
		this.contents = contents;
		this.name = name;
		this.size = contents.length;
		this.type = type;
	}
	text(): Promise<string> {
		return Promise.resolve(this.contents);
	}
}

describe('readKiraText', () => {
	test('returns the file text for a .kira file under the size limit', async () => {
		const file = new FakeFile('architecture\ntitle X', 'pipeline.kira');

		const text = await readKiraText(file as unknown as File);

		expect(text).toBe('architecture\ntitle X');
	});

	test('treats the extension check as case-insensitive', async () => {
		const file = new FakeFile('flowchart\nA -> B', 'pipeline.KIRA');

		await expect(readKiraText(file as unknown as File)).resolves.toBe(
			'flowchart\nA -> B'
		);
	});

	test('rejects files whose extension is not .kira', async () => {
		const file = new FakeFile('flowchart\nA -> B', 'diagram.txt');

		await expect(readKiraText(file as unknown as File)).rejects.toThrow(
			/not a \.kira file/i
		);
	});

	test('rejects files larger than the 1 MiB limit', async () => {
		const big = 'x'.repeat(MAX_KIRA_BYTES + 1);
		const file = new FakeFile(big, 'huge.kira');

		await expect(readKiraText(file as unknown as File)).rejects.toThrow(
			/too large/i
		);
	});

	test('accepts a file of exactly the size limit', async () => {
		const exact = 'x'.repeat(MAX_KIRA_BYTES);
		const file = new FakeFile(exact, 'exact.kira');

		await expect(readKiraText(file as unknown as File)).resolves.toBe(exact);
	});

	test('propagates the underlying reader error when the file cannot be read', async () => {
		class BrokenFile {
			name = 'broken.kira';
			size = 10;
			type = 'text/plain';
			text(): Promise<string> {
				return Promise.reject(new Error('disk on fire'));
			}
		}

		await expect(
			readKiraText(new BrokenFile() as unknown as File)
		).rejects.toThrow(/disk on fire/);
	});
});

describe('openKira', () => {
	test('reads the chosen file and forwards its text to onSource', async () => {
		const file = new FakeFile('architecture\ntitle Opened', 'opened.kira');
		const openable = {
			pickFile: mock(() => Promise.resolve(file as unknown as File)),
		};
		const onSource = mock((_source: string) => undefined);
		const onError = mock((_message: string) => undefined);

		await openKira({ onError, onSource, openable });

		expect(openable.pickFile).toHaveBeenCalledTimes(1);
		expect(onSource).toHaveBeenCalledWith('architecture\ntitle Opened');
		expect(onError).not.toHaveBeenCalled();
	});

	test('does nothing when the picker is cancelled (no file chosen)', async () => {
		const openable = { pickFile: mock(() => Promise.resolve(null)) };
		const onSource = mock((_source: string) => undefined);
		const onError = mock((_message: string) => undefined);

		await openKira({ onError, onSource, openable });

		expect(onSource).not.toHaveBeenCalled();
		expect(onError).not.toHaveBeenCalled();
	});

	test('routes wrong-extension failures through onError with a concise message', async () => {
		const file = new FakeFile('flowchart\nA -> B', 'diagram.txt');
		const openable = {
			pickFile: mock(() => Promise.resolve(file as unknown as File)),
		};
		const onSource = mock((_source: string) => undefined);
		const onError = mock((_message: string) => undefined);

		await openKira({ onError, onSource, openable });

		expect(onSource).not.toHaveBeenCalled();
		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError.mock.calls[0]?.[0]).toMatch(/not a \.kira file/i);
	});

	test('routes oversized files through onError and leaves Source untouched', async () => {
		const big = 'x'.repeat(MAX_KIRA_BYTES + 1);
		const file = new FakeFile(big, 'huge.kira');
		const openable = {
			pickFile: mock(() => Promise.resolve(file as unknown as File)),
		};
		const onSource = mock((_source: string) => undefined);
		const onError = mock((_message: string) => undefined);

		await openKira({ onError, onSource, openable });

		expect(onSource).not.toHaveBeenCalled();
		expect(onError.mock.calls[0]?.[0]).toMatch(/too large/i);
	});

	test('routes read failures through onError', async () => {
		class BrokenFile {
			name = 'broken.kira';
			size = 4;
			type = 'text/plain';
			text(): Promise<string> {
				return Promise.reject(new Error('read fail'));
			}
		}
		const openable = {
			pickFile: mock(() =>
				Promise.resolve(new BrokenFile() as unknown as File)
			),
		};
		const onSource = mock((_source: string) => undefined);
		const onError = mock((_message: string) => undefined);

		await openKira({ onError, onSource, openable });

		expect(onSource).not.toHaveBeenCalled();
		expect(onError.mock.calls[0]?.[0]).toMatch(/read fail/);
	});
});

describe('browserOpenable', () => {
	function attachMockFiles(input: HTMLElement, file: File): void {
		Object.defineProperty(input, 'files', {
			configurable: true,
			value: [file],
		});
	}

	test('returns an object whose pickFile method is a function', () => {
		const openable = browserOpenable();
		expect(typeof openable.pickFile).toBe('function');
	});

	test('resolves with the chosen file and removes input from document on change', async () => {
		withHappyDom();
		const openable = browserOpenable();
		const promise = openable.pickFile();

		const input = document.querySelector('input[type="file"]');
		expect(input).toBeInstanceOf(HTMLElement);
		if (!(input && input instanceof HTMLElement)) {
			throw new Error('Expected file input to be an HTMLElement');
		}
		expect(document.body.contains(input)).toBe(true);

		const fakeFile = new FakeFile(
			'flowchart\nA -> B',
			'test.kira'
		) as unknown as File;
		attachMockFiles(input, fakeFile);

		input.dispatchEvent(new Event('change'));

		const result = await promise;
		expect(result).toBe(fakeFile);
		expect(document.querySelector('input[type="file"]')).toBeNull();
	});

	test('resolves with null and removes input from document on cancel', async () => {
		withHappyDom();
		const openable = browserOpenable();
		const promise = openable.pickFile();

		const input = document.querySelector('input[type="file"]');
		expect(input).toBeInstanceOf(HTMLElement);
		if (!(input && input instanceof HTMLElement)) {
			throw new Error('Expected file input to be an HTMLElement');
		}

		input.dispatchEvent(new Event('cancel'));

		const result = await promise;
		expect(result).toBeNull();
		expect(document.querySelector('input[type="file"]')).toBeNull();
	});

	test('removes the input and resolves null on window focus fallback when cancel does not fire', async () => {
		withHappyDom();
		const openable = browserOpenable();
		const promise = openable.pickFile();

		const input = document.querySelector('input[type="file"]');
		expect(input).toBeInstanceOf(HTMLElement);
		if (!(input && input instanceof HTMLElement)) {
			throw new Error('Expected file input to be an HTMLElement');
		}
		expect(document.body.contains(input)).toBe(true);

		// Window regains focus after dialog dismiss without cancel/change
		window.dispatchEvent(new Event('focus'));

		// Wait for the fallback timeout plus margin
		await new Promise((resolve) =>
			setTimeout(resolve, FOCUS_CANCEL_FALLBACK_MS + 50)
		);

		const result = await promise;
		expect(result).toBeNull();
		expect(document.querySelector('input[type="file"]')).toBeNull();
	});

	test('resolves with file when change event fires within the focus fallback window', async () => {
		withHappyDom();
		const openable = browserOpenable();
		const promise = openable.pickFile();

		const input = document.querySelector('input[type="file"]');
		expect(input).toBeInstanceOf(HTMLElement);
		if (!(input && input instanceof HTMLElement)) {
			throw new Error('Expected file input to be an HTMLElement');
		}

		const fakeFile = new FakeFile(
			'flowchart\nA -> B',
			'test.kira'
		) as unknown as File;
		attachMockFiles(input, fakeFile);

		// Focus fires first (as happens in some browsers)
		window.dispatchEvent(new Event('focus'));

		// Change fires shortly after focus before FOCUS_CANCEL_FALLBACK_MS
		input.dispatchEvent(new Event('change'));

		// Wait past the fallback timeout
		await new Promise((resolve) =>
			setTimeout(resolve, FOCUS_CANCEL_FALLBACK_MS + 50)
		);

		const result = await promise;
		expect(result).toBe(fakeFile);
		expect(document.querySelector('input[type="file"]')).toBeNull();
	});
});
