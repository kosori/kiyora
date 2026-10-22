'use client';

import { useBoard, useSelection } from '@kiyora/editor/react';
import type { Board, Shape } from '@kiyora/model';

/** A shape's kind as a person reads it: `predefined-process` to `Predefined process`. */
const kindLabel = (kind: string): string => {
  const words = kind.replaceAll('-', ' ');

  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

/** What a shape answers to: its label when it has one, its kind otherwise. */
const nameOf = (shape: Shape): string => {
  const text = shape.text?.trim();

  return text === undefined || text.length === 0 ? kindLabel(shape.kind) : text;
};

/**
 * Where `shape` sits among the shapes of its kind, in paint order. Two shapes of
 * one kind would otherwise announce the same words, so the selection of the
 * second would stay silent.
 */
const ordinalOf = (shape: Shape, shapes: Board['shapes']): string => {
  const sameKind = shapes.filter((candidate) => candidate.kind === shape.kind);
  const position = sameKind.findIndex((candidate) => candidate.id === shape.id);

  return `${position + 1} of ${sameKind.length}`;
};

/** What the selection is, in words a screen reader can read out. */
const describe = (
  selection: readonly string[],
  shapes: Board['shapes']
): string => {
  if (selection.length === 0) {
    return 'Nothing selected';
  }
  if (selection.length > 1) {
    return `${selection.length} selected`;
  }
  const shape = shapes.find((candidate) => candidate.id === selection[0]);
  if (shape === undefined) {
    return 'Selection changed';
  }

  return `${nameOf(shape)} selected, ${ordinalOf(shape, shapes)}`;
};

/**
 * The board is one image, so a screen reader cannot see which shape a gesture
 * changed. This polite live region says the selection in words, so it is
 * perceivable without moving focus off the canvas.
 */
export const SelectionAnnouncer = () => {
  const board = useBoard();
  const selection = useSelection();

  return (
    <p
      aria-atomic='true'
      aria-live='polite'
      className='sr-only'
      data-testid='selection-announcer'
    >
      {describe(selection, board.shapes)}
    </p>
  );
};
