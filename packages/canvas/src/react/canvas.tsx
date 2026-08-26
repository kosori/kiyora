import type { HTMLAttributes, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { Editor } from '../editor';
import { createEngine, type Engine } from '../engine';
import { EditorContext } from './context';

export type CanvasProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
	children?: ReactNode;
	editor: Editor;
	showGrid?: boolean;
};

/** Render an SSR-safe canvas host and mount its DOM Engine in the browser. */
export function Canvas({
	children,
	className,
	editor,
	showGrid = true,
	...props
}: CanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (container === null) {
			return;
		}
		const engine: Engine = createEngine(container, editor, { showGrid });
		return () => engine.destroy();
	}, [editor, showGrid]);

	return (
		<EditorContext.Provider value={editor}>
			<div
				{...props}
				className={className}
				data-kiyora-canvas
				ref={containerRef}
			/>
			{children}
		</EditorContext.Provider>
	);
}
