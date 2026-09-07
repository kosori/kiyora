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
	rotation: number;
	shadow?: boolean;
	shape?: string;
	span: Span;
	width: number;
	x: number;
	y: number;
};

/**
 * A renderable edge that connects nodes by id. For sequence diagrams,
 * explicit row or lifeline Y coordinates (`y` for horizontal messages,
 * `y1`/`y2` for vertical lifelines) guide projection.
 */
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
	y?: number;
	y1?: number;
	y2?: number;
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
	readOnly?: boolean;
	title: string;
	variant?: 'orgchart' | 'statemachine';
};
