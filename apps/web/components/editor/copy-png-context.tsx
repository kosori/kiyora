'use client';

import { useBoard, useSelection } from '@kiyora/editor/react';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { copySelectionPng } from '~/lib/board-png';
import { createTextMeasurer } from '~/lib/text-measurer';

type CopyPng = {
  /** Why the last copy failed, or `null` when it worked. */
  error: string | null;
  /** Copies the selection as a PNG, reporting a refusal rather than dropping it. */
  copy: () => void;
  /** Drops the last copy's refusal, so another surface can show its own. */
  clearError: () => void;
};

const CopyPngContext = createContext<CopyPng | undefined>(undefined);

/** The message a thrown value carries, so a refusal is never blank. */
const messageOf = (thrown: unknown): string =>
  thrown instanceof Error ? thrown.message : String(thrown);

/**
 * The selection as a PNG on the system clipboard, shared by every surface that
 * offers it: the PNG panel's button and the selection menu's entry. The engine
 * has no clipboard, so the command reaches the app through this provider, and
 * one error state means a refusal surfaces in the same chrome alert whichever
 * surface asked.
 */
export const CopyPngProvider = ({ children }: PropsWithChildren) => {
  const board = useBoard();
  const selection = useSelection();
  const measure = useMemo(() => createTextMeasurer(), []);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const copy = useCallback(() => {
    if (selection.length === 0) {
      return;
    }
    const run = async (): Promise<void> => {
      try {
        await copySelectionPng(board, selection, measure);
        setError(null);
      } catch (thrown) {
        setError(messageOf(thrown));
      }
    };
    run().catch(() => undefined);
  }, [board, measure, selection]);

  const value = useMemo(
    () => ({ clearError, copy, error }),
    [clearError, copy, error]
  );

  return (
    <CopyPngContext.Provider value={value}>{children}</CopyPngContext.Provider>
  );
};

/** The shared PNG copy, or a throw when a surface is outside its provider. */
export const useCopyPng = (): CopyPng => {
  const context = useContext(CopyPngContext);
  if (context === undefined) {
    throw new Error('useCopyPng must be used inside CopyPngProvider');
  }

  return context;
};
