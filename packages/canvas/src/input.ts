import type { Editor } from './editor';
import type { Point } from './viewport';
import { screenToWorld } from './viewport';

const DRAG_THRESHOLD = 4;

type DragMode = 'node' | 'pan' | 'press';

type DragState = {
	mode: DragMode;
	pointerId: number;
	startX: number;
	startY: number;
	lastX: number;
	lastY: number;
	moved: boolean;
	clearOnClick: boolean;
};

/** Optional callbacks for consumers that render independently of Editor. */
export type InputHandlers = {
	onChanged?: () => void;
	/** Notify the host when a node drag starts or ends. */
	onDragStateChange?: (dragging: boolean) => void;
	/** World-space offset applied by the renderer before the viewport transform. */
	worldOffset?: Point;
};

/** Attach pointer and wheel input to an SVG canvas. */
export function attachInput(
	svg: SVGSVGElement,
	editor: Editor,
	handlers: InputHandlers = {}
): () => void {
	let drag: DragState | null = null;
	let spaceDown = false;
	const ownerWindow = svg.ownerDocument.defaultView;

	function localPoint(event: { clientX: number; clientY: number }) {
		const rect = svg.getBoundingClientRect();
		const left = Number.isFinite(rect.left) ? rect.left : 0;
		const top = Number.isFinite(rect.top) ? rect.top : 0;
		return { x: event.clientX - left, y: event.clientY - top };
	}

	function capturePointer(pointerId: number): void {
		if (svg.setPointerCapture) {
			svg.setPointerCapture(pointerId);
		}
	}

	function releasePointer(pointerId: number): void {
		svg.releasePointerCapture?.(pointerId);
	}

	function notify(): void {
		handlers.onChanged?.();
	}

	function onPointerDown(event: PointerEvent): void {
		if (drag || (event.button !== 0 && event.button !== 1)) {
			return;
		}
		capturePointer(event.pointerId);
		drag = {
			clearOnClick: false,
			lastX: event.clientX,
			lastY: event.clientY,
			mode: 'press',
			moved: false,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
		};

		if (event.button === 1 || spaceDown) {
			drag.mode = 'pan';
			return;
		}

		const point = localPoint(event);
		const world = screenToWorld(editor.getViewport(), point);
		const offset = handlers.worldOffset ?? { x: 0, y: 0 };
		const scenePoint = { x: world.x - offset.x, y: world.y - offset.y };
		const node = editor.hitTest(scenePoint);
		if (node) {
			if (event.shiftKey) {
				editor.toggleSelect(node.id);
				drag.mode = 'press';
				notify();
				return;
			}
			if (!editor.getSelection().includes(node.id)) {
				editor.select(node.id);
				notify();
			}
			drag.mode = 'node';
			editor.beginDrag(node.id, scenePoint);
			handlers.onDragStateChange?.(true);
			return;
		}

		// Selection is cleared on a background click, not when a pan begins.
		drag.mode = 'pan';
		drag.clearOnClick = !event.shiftKey;
	}

	function onPointerMove(event: PointerEvent): void {
		if (!drag || drag.pointerId !== event.pointerId) {
			return;
		}
		const distance = Math.hypot(
			event.clientX - drag.startX,
			event.clientY - drag.startY
		);
		if (!drag.moved) {
			if (distance < DRAG_THRESHOLD) {
				return;
			}
			drag.moved = true;
		}

		const dx = event.clientX - drag.lastX;
		const dy = event.clientY - drag.lastY;
		drag.lastX = event.clientX;
		drag.lastY = event.clientY;
		if (drag.mode === 'pan') {
			editor.panBy(dx, dy);
		} else if (drag.mode === 'node') {
			const { zoom } = editor.getViewport();
			editor.drag(dx / zoom, dy / zoom);
		}
		notify();
	}

	function endPointer(event: PointerEvent): void {
		if (!drag || drag.pointerId !== event.pointerId) {
			return;
		}
		const state = drag;
		drag = null;
		releasePointer(event.pointerId);
		if (state.mode === 'node') {
			editor.endDrag();
			handlers.onDragStateChange?.(false);
			notify();
			return;
		}
		if (state.mode === 'pan' && !state.moved && state.clearOnClick) {
			editor.select(null);
			notify();
		}
	}

	function onWheel(event: WheelEvent): void {
		event.preventDefault();
		const point = localPoint(event);
		editor.zoomAt(point, event.deltaY < 0 ? 1.2 : 1 / 1.2);
		notify();
	}

	function onKeyDown(event: KeyboardEvent): void {
		if (event.code !== 'Space') {
			return;
		}
		spaceDown = true;
		event.preventDefault();
		svg.style.cursor = 'grab';
	}

	function onKeyUp(event: KeyboardEvent): void {
		if (event.code !== 'Space') {
			return;
		}
		spaceDown = false;
		svg.style.cursor = 'default';
	}

	svg.addEventListener('pointerdown', onPointerDown);
	svg.addEventListener('pointermove', onPointerMove);
	svg.addEventListener('pointerup', endPointer);
	svg.addEventListener('pointercancel', endPointer);
	svg.addEventListener('wheel', onWheel, { passive: false });
	ownerWindow?.addEventListener('keydown', onKeyDown);
	ownerWindow?.addEventListener('keyup', onKeyUp);

	return () => {
		const activeDrag = drag;
		drag = null;
		if (activeDrag) {
			releasePointer(activeDrag.pointerId);
		}
		if (activeDrag?.mode === 'node') {
			editor.endDrag();
			handlers.onDragStateChange?.(false);
		}
		svg.removeEventListener('pointerdown', onPointerDown);
		svg.removeEventListener('pointermove', onPointerMove);
		svg.removeEventListener('pointerup', endPointer);
		svg.removeEventListener('pointercancel', endPointer);
		svg.removeEventListener('wheel', onWheel);
		ownerWindow?.removeEventListener('keydown', onKeyDown);
		ownerWindow?.removeEventListener('keyup', onKeyUp);
	};
}
