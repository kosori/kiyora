import type { SequenceDiagram } from '@kiyora/dsl';
import type { SceneEdge, SceneNode } from './scene';

export const SEQUENCE_COLUMN_WIDTH = 200;
export const SEQUENCE_ACTOR_WIDTH = 100;
export const SEQUENCE_ACTOR_HEIGHT = 40;
export const SEQUENCE_FIRST_MESSAGE_Y = 100;
export const SEQUENCE_ROW_HEIGHT = 60;
export const SEQUENCE_LIFELINE_PADDING = 40;

/** Lay out a sequence diagram on a fixed grid. */
export function layoutSequence(diagram: SequenceDiagram): {
	edges: SceneEdge[];
	nodes: SceneNode[];
} {
	if (diagram.actors.length === 0) {
		return { edges: [], nodes: [] };
	}

	const nodes: SceneNode[] = diagram.actors.map((actor, i) => ({
		height: SEQUENCE_ACTOR_HEIGHT,
		id: actor.id,
		label: actor.label,
		rotation: 0,
		shape: 'rectangle',
		span: actor.span,
		width: SEQUENCE_ACTOR_WIDTH,
		x:
			i * SEQUENCE_COLUMN_WIDTH +
			(SEQUENCE_COLUMN_WIDTH - SEQUENCE_ACTOR_WIDTH) / 2,
		y: 0,
	}));

	const lastMessageY =
		diagram.messages.length > 0
			? SEQUENCE_FIRST_MESSAGE_Y +
				(diagram.messages.length - 1) * SEQUENCE_ROW_HEIGHT
			: SEQUENCE_ACTOR_HEIGHT;
	const lifelineEndY = lastMessageY + SEQUENCE_LIFELINE_PADDING;

	const lifelines: SceneEdge[] = diagram.actors.map((actor) => ({
		dashed: true,
		from: actor.id,
		span: actor.span,
		to: actor.id,
		y1: SEQUENCE_ACTOR_HEIGHT,
		y2: lifelineEndY,
	}));

	const messages: SceneEdge[] = diagram.messages.map((message, j) => {
		const edge: SceneEdge = {
			from: message.from,
			head: 'arrow',
			span: message.span,
			to: message.to,
			y: SEQUENCE_FIRST_MESSAGE_Y + j * SEQUENCE_ROW_HEIGHT,
		};
		if (message.label !== undefined) {
			edge.label = message.label;
		}
		if (message.dashed) {
			edge.dashed = true;
		}
		return edge;
	});

	return {
		edges: [...lifelines, ...messages],
		nodes,
	};
}
