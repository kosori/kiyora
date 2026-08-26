import { useContext } from 'react';
import type { Editor } from '../editor';
import { EditorContext } from './context';

/** Read the Editor supplied by the nearest Canvas. */
export function useEditor(): Editor {
	const editor = useContext(EditorContext);
	if (editor === null) {
		throw new Error('useEditor must be used inside a <Canvas> component.');
	}
	return editor;
}
