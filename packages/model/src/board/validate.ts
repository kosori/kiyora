import type { z } from 'zod';
import { type Board, boardSchema } from './schema';

/** One field that stopped a candidate board from being a board. */
export type BoardIssue = {
  path: string;
  message: string;
};

const toIssues = (error: z.ZodError): BoardIssue[] =>
  error.issues.map((issue) => ({
    message: issue.message,
    path: issue.path.length === 0 ? 'board' : issue.path.map(String).join('.'),
  }));

const render = (issues: BoardIssue[]): string =>
  [
    `board rejected: ${issues.length} issue(s)`,
    ...issues.map((issue) => `  ${issue.path}: ${issue.message}`),
  ].join('\n');

/** Thrown when a candidate board is not a board. `issues` names every field that failed. */
export class BoardRejection extends Error {
  readonly issues: BoardIssue[];

  constructor(issues: BoardIssue[]) {
    super(render(issues));
    this.name = 'BoardRejection';
    this.issues = issues;
  }
}

/** Every field that stopped `input` from being a board. Empty when it is one. */
export const boardIssues = (input: unknown): BoardIssue[] => {
  const result = boardSchema.safeParse(input);
  return result.success ? [] : toIssues(result.error);
};

/** Validates `input` as a board, throwing a `BoardRejection` that names every field that failed. */
export const parseBoard = (input: unknown): Board => {
  const result = boardSchema.safeParse(input);
  if (!result.success) {
    throw new BoardRejection(toIssues(result.error));
  }
  return result.data;
};
