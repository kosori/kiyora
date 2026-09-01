import type { Editor } from './editor';
import { screenToWorld } from './viewport';

const DRAG_THRESHOLD = 4;
const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 400;

type DragMode = 'marquee' | 'node' | 'pan' | 'press' | 'resize';

type DragState = {
	additive: boolean;
	marqueeStarted?: boolean;
	mode: DragMode;
	pointerId: number;
	startX: number;
	startY: number;
	lastX: number;
	lastY: number;
	moved: boolean;
};

/** Optional callbacks for consumers that render independently of Editor. */
export type InputHandlers = {
	onChanged?: () => void;
	/** Notify the host when a node drag starts or ends. */
	onDragStateChange?: (dragging: boolean) => void;
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
			additive: event.shiftKey,
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
		const target = editor.hitTestHandle(point);
		if (target) {
			editor.beginResize(target.id, target.handle);
			drag.mode = 'resize';
			handlers.onDragStateChange?.(true);
			return;
		}
		const world = screenToWorld(editor.getViewport(), point);
		const node = editor.hitTest(world);
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
			editor.beginDrag(node.id);
			handlers.onDragStateChange?.(true);
			return;
		}

		drag.mode = 'marquee';
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
		} else if (drag.mode === 'resize') {
			const world = screenToWorld(editor.getViewport(), localPoint(event));
			editor.resizeTo(world);
		} else if (drag.mode === 'marquee') {
			if (!drag.marqueeStarted) {
				drag.marqueeStarted = true;
				editor.beginMarquee(
					localPoint({ clientX: drag.startX, clientY: drag.startY })
				);
			}
			editor.marqueeTo(localPoint(event));
		}
		notify();
	}

	function endPointer(event: PointerEvent, cancelled: boolean): void {
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
		if (state.mode === 'resize') {
			editor.endResize();
			handlers.onDragStateChange?.(false);
			notify();
			return;
		}
		if (state.mode !== 'marquee') {
			return;
		}
		if (cancelled) {
			editor.cancelMarquee();
			notify();
			return;
		}
		if (state.moved) {
			editor.endMarquee(state.additive || event.shiftKey);
		} else if (!(state.additive || event.shiftKey)) {
			editor.select(null);
		}
		notify();
	}

	function onPointerUp(event: PointerEvent): void {
		endPointer(event, false);
	}

	function onPointerCancel(event: PointerEvent): void {
		endPointer(event, true);
	}

	function wheelDelta(event: WheelEvent): number {
		if (event.deltaMode === 1) {
			return event.deltaY * LINE_HEIGHT_PX;
		}
		if (event.deltaMode === 2) {
			return event.deltaY * PAGE_HEIGHT_PX;
		}
		return event.deltaY;
	}

	function onWheel(event: WheelEvent): void {
		event.preventDefault();
		if (event.ctrlKey || event.metaKey) {
			const point = localPoint(event);
			editor.zoomAt(point, event.deltaY < 0 ? 1.2 : 1 / 1.2);
			notify();
			return;
		}
		const vertical = wheelDelta(event);
		editor.panBy(-event.deltaX, -vertical);
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
	svg.addEventListener('pointerup', onPointerUp);
	svg.addEventListener('pointercancel', onPointerCancel);
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
		if (activeDrag?.mode === 'resize') {
			editor.endResize();
			handlers.onDragStateChange?.(false);
		}
		if (activeDrag?.mode === 'marquee') {
			editor.cancelMarquee();
		}
		svg.removeEventListener('pointerdown', onPointerDown);
		svg.removeEventListener('pointermove', onPointerMove);
		svg.removeEventListener('pointerup', onPointerUp);
		svg.removeEventListener('pointercancel', onPointerCancel);
		svg.removeEventListener('wheel', onWheel);
		ownerWindow?.removeEventListener('keydown', onKeyDown);
		ownerWindow?.removeEventListener('keyup', onKeyUp);
	};
}
