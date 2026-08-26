import { createContext } from 'react';
import type { Editor } from '../editor';

/** The Editor supplied to React descendants of Canvas. */
export const EditorContext = createContext<Editor | null>(null);
