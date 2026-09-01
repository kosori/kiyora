import type {
	Color,
	Corner,
	Direction,
	Fill,
	Frame,
	Head,
	LegendEntry,
	Span,
} from '@kiyora/dsl';

/** A positioned, renderable node in a compiled scene. */
export type SceneNode = {
	color?: Color;
	corner?: Corner;
	fill?: Fill;
	group?: string;
	height: number;
	icon?: string;
	id: string;
	label: string;
	labelColor?: Color;
	link?: string;
	rotation?: number;
	shadow?: boolean;
	shape?: string;
	span: Span;
	width: number;
	x: number;
	y: number;
};

/** A renderable edge that refers to nodes by id, rather than coordinates. */
export type SceneEdge = {
	back?: boolean;
	bidirectional?: boolean;
	color?: Color;
	dashed?: boolean;
	flow?: boolean;
	from: string;
	head?: Head;
	invisible?: boolean;
	label?: string;
	span: Span;
	to: string;
};

/** A renderable group; its derived bounds are intentionally not stored. */
export type SceneGroup = {
	color?: Color;
	frame?: Frame;
	icon?: string;
	id: string;
	label: string;
	parent?: string;
	span: Span;
};

/** Plain, JSON-serializable output of compilation. */
export type Scene = {
	direction?: Direction;
	edges: SceneEdge[];
	groups: SceneGroup[];
	legend?: LegendEntry[];
	nodes: SceneNode[];
	title: string;
};
