import { createContext } from 'react';
import type { Editor } from '../store';

/** The engine every React surface under the provider reads. */
export const EditorContext = createContext<Editor | null>(null);
