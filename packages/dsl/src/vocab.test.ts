import { describe, expect, test } from 'bun:test';

import {
	ARROWS,
	COLOR_ALIASES,
	COLORS,
	CORNERS,
	CSS_NAMED_COLORS,
	extractHue,
	FAMILIES,
	FILLS,
	FRAMES,
	HEADS,
	isBack,
	isBidirectional,
	isDotted,
	resolveColor,
	resolveCorner,
	resolveFill,
	resolveFrame,
	resolveHead,
	resolveShape,
	SHAPE_ALIASES,
	SHAPES,
	STANDALONE_FAMILIES,
	slugify,
	snapHue,
	UNSUPPORTED_GRAPH_FAMILIES,
	uniqueId,
} from './vocab';

describe('shapes', () => {
	test('canonical shapes resolve to themselves, case-insensitively', () => {
		expect(resolveShape('rectangle')).toBe('rectangle');
		expect(resolveShape('Cylinder')).toBe('cylinder');
		expect(resolveShape('DOUBLE-CIRCLE')).toBe('double-circle');
	});

	test('every alias resolves to its canonical shape', () => {
		for (const [alias, canonical] of Object.entries(SHAPE_ALIASES)) {
			expect(resolveShape(alias)).toBe(canonical);
		}
	});

	test('documents the headline aliases', () => {
		expect(SHAPE_ALIASES.box).toBe('rectangle');
		expect(SHAPE_ALIASES.db).toBe('cylinder');
		expect(SHAPE_ALIASES.decision).toBe('diamond');
		expect(SHAPE_ALIASES.person).toBe('actor');
	});

	test('unknown tokens resolve to null', () => {
		expect(resolveShape('blob')).toBeNull();
		expect(resolveShape('')).toBeNull();
	});

	test('SHAPES lists canonical names only', () => {
		expect(SHAPES).toContain('cylinder');
		expect(SHAPES).not.toContain('db');
	});
});

describe('colors', () => {
	test('palette colors resolve to themselves', () => {
		for (const color of COLORS) {
			expect(resolveColor(color)).toBe(color);
		}
	});

	test('grey and purple alias to gray and violet', () => {
		expect(resolveColor('grey')).toBe('gray');
		expect(resolveColor('purple')).toBe('violet');
		expect(COLOR_ALIASES.grey).toBe('gray');
		expect(COLOR_ALIASES.purple).toBe('violet');
	});

	test('CSS named colors and hex strings snap predictably to palette colors', () => {
		expect(resolveColor('tomato')).toBe('red');
		expect(resolveColor('#ff6347')).toBe('red');
		expect(resolveColor('#f00')).toBe('red');
		expect(resolveColor('coral')).toBe('orange');
		expect(resolveColor('#ff922b')).toBe('orange');
		expect(resolveColor('gold')).toBe('yellow');
		expect(resolveColor('#ffd700')).toBe('yellow');
		expect(resolveColor('lime')).toBe('green');
		expect(resolveColor('#00ff00')).toBe('green');
		expect(resolveColor('cyan')).toBe('teal');
		expect(resolveColor('aqua')).toBe('teal');
		expect(resolveColor('#00ffff')).toBe('teal');
		expect(resolveColor('navy')).toBe('blue');
		expect(resolveColor('#0000ff')).toBe('blue');
		expect(resolveColor('magenta')).toBe('violet');
		expect(resolveColor('#ff00ff')).toBe('violet');
		expect(resolveColor('hotpink')).toBe('pink');
		expect(resolveColor('#ff69b4')).toBe('pink');
		expect(resolveColor('black')).toBe('gray');
		expect(resolveColor('white')).toBe('gray');
		expect(resolveColor('silver')).toBe('gray');
		expect(resolveColor('#000000')).toBe('gray');
		expect(resolveColor('#ffffff')).toBe('gray');
		expect(resolveColor('#808080')).toBe('gray');
	});

	test('unknown garbage strings resolve to null', () => {
		expect(resolveColor('bluish')).toBeNull();
		expect(resolveColor('#xyz')).toBeNull();
		expect(resolveColor('not-a-color')).toBeNull();
		expect(resolveColor('#12345')).toBeNull();
	});

	test('tokens are trimmed and lowercased', () => {
		expect(resolveColor(' Blue ')).toBe('blue');
		expect(resolveColor('  Tomato  ')).toBe('red');
		expect(resolveColor('  #FF6347  ')).toBe('red');
	});
});

describe('extractHue', () => {
	test('extracts hue from 6-digit hex codes', () => {
		expect(extractHue('#ff0000')).toBe(0);
		expect(extractHue('#ff6347')).toBe(9);
		expect(extractHue('#00ff00')).toBe(120);
		expect(extractHue('#00ffff')).toBe(180);
		expect(extractHue('#0000ff')).toBe(240);
		expect(extractHue('#ff00ff')).toBe(300);
		expect(extractHue('#ffff00')).toBe(60);
	});

	test('extracts hue from 3-digit hex codes', () => {
		expect(extractHue('#f00')).toBe(0);
		expect(extractHue('#0f0')).toBe(120);
		expect(extractHue('#00f')).toBe(240);
	});

	test('returns 0 for achromatic hex codes', () => {
		expect(extractHue('#ffffff')).toBe(0);
		expect(extractHue('#000000')).toBe(0);
		expect(extractHue('#808080')).toBe(0);
	});

	test('returns null for invalid hex strings', () => {
		expect(extractHue('bluish')).toBeNull();
		expect(extractHue('#xyz')).toBeNull();
		expect(extractHue('#12345')).toBeNull();
		expect(extractHue('')).toBeNull();
	});
});

describe('CSS_NAMED_COLORS', () => {
	test('contains standard HTML/CSS color names', () => {
		expect(CSS_NAMED_COLORS.tomato).toBe('#ff6347');
		expect(CSS_NAMED_COLORS.crimson).toBe('#dc143c');
		expect(CSS_NAMED_COLORS.navy).toBe('#000080');
		expect(CSS_NAMED_COLORS.black).toBe('#000000');
		expect(CSS_NAMED_COLORS.white).toBe('#ffffff');
		expect(CSS_NAMED_COLORS.rebeccapurple).toBe('#663399');
	});
});

describe('snapHue', () => {
	test('snaps angles cleanly to closest palette hues', () => {
		expect(snapHue(0)).toBe('red');
		expect(snapHue(10)).toBe('red');
		expect(snapHue(355)).toBe('red');
		expect(snapHue(30)).toBe('orange');
		expect(snapHue(60)).toBe('yellow');
		expect(snapHue(120)).toBe('green');
		expect(snapHue(170)).toBe('teal');
		expect(snapHue(180)).toBe('teal');
		expect(snapHue(215)).toBe('blue');
		expect(snapHue(240)).toBe('blue');
		expect(snapHue(280)).toBe('violet');
		expect(snapHue(300)).toBe('violet');
		expect(snapHue(330)).toBe('pink');
	});

	test('normalizes angles outside 0-360 range', () => {
		expect(snapHue(-10)).toBe('red');
		expect(snapHue(370)).toBe('red');
		expect(snapHue(720)).toBe('red');
	});
});

describe('fills, corners, frames, heads', () => {
	test('fills', () => {
		expect(FILLS).toEqual(['pastel', 'bold', 'outline']);
		for (const fill of FILLS) {
			expect(resolveFill(fill)).toBe(fill);
		}
		expect(resolveFill('BOLD')).toBe('bold');
		expect(resolveFill('solid')).toBeNull();
	});

	test('corners with aliases', () => {
		expect(CORNERS).toEqual(['sharp', 'rounded']);
		expect(resolveCorner('square')).toBe('sharp');
		expect(resolveCorner('round')).toBe('rounded');
		expect(resolveCorner('blobby')).toBeNull();
	});

	test('frames', () => {
		expect(FRAMES).toEqual(['browser', 'phone', 'window', 'tablet']);
		expect(resolveFrame('Browser')).toBe('browser');
		expect(resolveFrame('paper')).toBeNull();
	});

	test('heads with aliases', () => {
		expect(HEADS).toEqual([
			'arrow',
			'circle',
			'cross',
			'none',
			'crow-one',
			'crow-many',
			'crow-one-or-many',
			'crow-zero-or-one',
			'uml-generalization',
			'uml-composition',
			'uml-aggregation',
		]);
		expect(resolveHead('none')).toBe('none');
		expect(resolveHead('x')).toBe('cross');
		expect(resolveHead('o')).toBe('circle');
		expect(resolveHead('dot')).toBe('circle');
		expect(resolveHead('square')).toBeNull();
	});
});

describe('arrows', () => {
	test('the connector token list covers every arrow kind', () => {
		const required = [
			'->',
			'-->',
			'-.->',
			'..>',
			'<-.-',
			'<..',
			'<->',
			'<-->',
			'<..>',
			'<-.->',
			'<-',
			'<--',
			'<>',
			'>',
			'<',
		] as const;
		for (const token of required) {
			expect(ARROWS).toContain(token);
		}
	});

	test('arrow classifiers correctly classify arrow tokens', () => {
		expect(isDotted('-->')).toBe(true);
		expect(isDotted('..>')).toBe(true);
		expect(isDotted('->')).toBe(false);

		expect(isBack('<-')).toBe(true);
		expect(isBack('<--')).toBe(true);
		expect(isBack('->')).toBe(false);

		expect(isBidirectional('<->')).toBe(true);
		expect(isBidirectional('<-->')).toBe(true);
		expect(isBidirectional('->')).toBe(false);
	});
});

describe('slugify', () => {
	test('slugifies names per reference semantics', () => {
		expect(slugify('Cache Server')).toBe('cache-server');
		expect(slugify('A -- B')).toBe('a-b');
		expect(slugify('Hello_World!')).toBe('hello-world');
		expect(slugify('already-kebab')).toBe('already-kebab');
	});

	test('strips non-latin characters', () => {
		expect(slugify('Café')).toBe('caf');
	});

	test('falls back to "node" for empty slugs', () => {
		expect(slugify('')).toBe('node');
		expect(slugify('!!!')).toBe('node');
		expect(slugify('   ')).toBe('node');
	});
});

describe('uniqueId', () => {
	test('deduplicates with -2, -3, … suffixes', () => {
		const used = new Set<string>();
		expect(uniqueId('cache-server', used)).toBe('cache-server');
		expect(uniqueId('cache-server', used)).toBe('cache-server-2');
		expect(uniqueId('cache-server', used)).toBe('cache-server-3');
	});

	test('skips suffixes already taken', () => {
		const used = new Set(['a', 'a-2']);
		expect(uniqueId('a', used)).toBe('a-3');
	});

	test('records the id in the used set', () => {
		const used = new Set<string>();
		uniqueId('node', used);
		expect(used.has('node')).toBe(true);
	});
});

describe('families', () => {
	test('graph-family keywords map to their canonical family', () => {
		expect(FAMILIES.architecture).toBe('architecture');
		expect(FAMILIES.graph).toBe('architecture');
		expect(FAMILIES.flowchart).toBe('flowchart');
		expect(FAMILIES.flow).toBe('flowchart');
		expect(FAMILIES.bpmn).toBe('bpmn');
		expect(FAMILIES.orgchart).toBe('orgchart');
		expect(FAMILIES.org).toBe('orgchart');
		expect(FAMILIES.statemachine).toBe('statemachine');
		expect(FAMILIES.state).toBe('statemachine');
		expect(FAMILIES.fsm).toBe('statemachine');
		expect(FAMILIES.class).toBe('class');
		expect(FAMILIES.erd).toBe('class');
		expect(FAMILIES.uml).toBe('class');
	});

	test('unsupported family keywords are listed for refusal', () => {
		expect(STANDALONE_FAMILIES).toEqual([
			'gitgraph',
			'gantt',
			'sankey',
			'infographic',
			'chart',
		]);
		expect(UNSUPPORTED_GRAPH_FAMILIES).toEqual(['wireframe']);
	});

	test('a whole-line family header must match exactly', () => {
		// `flowchart Cache` is not a header; it stays a node statement.
		expect(FAMILIES['flowchart cache']).toBeUndefined();
		expect(FAMILIES.flowchart).toBe('flowchart');
	});
});
