'use client';

import { useEditor } from '@kiyora/editor/react';
import {
  type ConnectorShape,
  type Head,
  headSchema,
  ROUTES,
  type Route,
} from '@kiyora/model';
import { useCallback } from 'react';
import { OptionButtons } from './option-buttons';

type Props = {
  shape: ConnectorShape;
};

type Option<T extends string> = {
  label: string;
  value: T;
};

const HEADING = 'mb-1.5 text-muted-foreground text-xs uppercase tracking-wide';

/** The grammar's head tokens read as words in the panel. */
const headLabel = (head: Head): string =>
  head
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const HEAD_OPTIONS: Option<Head>[] = headSchema.options.map((head) => ({
  label: headLabel(head),
  value: head,
}));

const ROUTE_OPTIONS: Option<Route>[] = ROUTES.map((route) => ({
  label: route.charAt(0).toUpperCase() + route.slice(1),
  value: route,
}));

/**
 * The connector's own controls: its route and a head for each end, chosen
 * independently. Every change is one store call, so styling a connector is one
 * gesture and one undo. The head list is the grammar's, so the panel and the
 * parser name the same arrowheads.
 */
export const ConnectorStyle = ({ shape }: Props) => {
  const editor = useEditor();

  const pickRoute = useCallback(
    (route: Route) => editor.setConnector(shape.id, { route }),
    [editor, shape.id]
  );
  const pickStart = useCallback(
    (start: Head) => editor.setConnector(shape.id, { start }),
    [editor, shape.id]
  );
  const pickEnd = useCallback(
    (end: Head) => editor.setConnector(shape.id, { end }),
    [editor, shape.id]
  );

  return (
    <div className='flex flex-col gap-4' data-testid='connector-controls'>
      <section>
        <h3 className={HEADING}>Route</h3>
        <OptionButtons
          label='Route'
          onPick={pickRoute}
          options={ROUTE_OPTIONS}
          selected={shape.route}
          testId='route'
        />
      </section>
      <section>
        <h3 className={HEADING}>Heads</h3>
        <div className='flex flex-col gap-2'>
          <OptionButtons
            label='Start head'
            onPick={pickStart}
            options={HEAD_OPTIONS}
            selected={shape.start}
            testId='head-start'
          />
          <OptionButtons
            label='End head'
            onPick={pickEnd}
            options={HEAD_OPTIONS}
            selected={shape.end}
            testId='head-end'
          />
        </div>
      </section>
    </div>
  );
};
