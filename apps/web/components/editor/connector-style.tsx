'use client';

import { useEditor } from '@kiyora/editor/react';
import {
  type Anchor,
  type ConnectorShape,
  EDGES,
  type Edge,
  type Endpoint,
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

type EdgeChoice = Edge | 'auto';

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

/** No edge chosen reads as auto, because that is what the walker then does. */
const EDGE_OPTIONS: Option<EdgeChoice>[] = [
  { label: 'Auto', value: 'auto' },
  ...EDGES.map((edge) => ({
    label: edge.charAt(0).toUpperCase() + edge.slice(1),
    value: edge,
  })),
];

/** The edge an end names, or `auto` when it names none or stands free. */
const edgeOf = (endpoint: Endpoint): EdgeChoice =>
  endpoint.kind === 'bound' ? (endpoint.anchor?.edge ?? 'auto') : 'auto';

/** The anchor an end already holds, when it is bound. */
const anchorOf = (endpoint: Endpoint): Anchor | undefined =>
  endpoint.kind === 'bound' ? endpoint.anchor : undefined;

/** The anchor an edge choice writes, keeping a fraction already in force. */
const anchorFor = (choice: EdgeChoice, current?: Anchor): Anchor | null =>
  choice === 'auto'
    ? null
    : { edge: choice, fraction: current?.fraction ?? 0.5 };

/**
 * The connector's own controls: its route, a head for each end, and the edge
 * each bound end attaches to. Every change is one store call, so styling a
 * connector is one gesture and one undo. The head list is the grammar's, so the
 * panel and the parser name the same arrowheads; leaving an edge on Auto keeps
 * the walker picking the side that faces the other end.
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
  const pickFromEdge = useCallback(
    (choice: EdgeChoice) =>
      editor.setConnector(shape.id, {
        fromAnchor: anchorFor(choice, anchorOf(shape.from)),
      }),
    [editor, shape.id, shape.from]
  );
  const pickToEdge = useCallback(
    (choice: EdgeChoice) =>
      editor.setConnector(shape.id, {
        toAnchor: anchorFor(choice, anchorOf(shape.to)),
      }),
    [editor, shape.id, shape.to]
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
      {shape.from.kind === 'bound' || shape.to.kind === 'bound' ? (
        <section>
          <h3 className={HEADING}>Attach</h3>
          <div className='flex flex-col gap-2'>
            {shape.from.kind === 'bound' ? (
              <OptionButtons
                label='Start edge'
                onPick={pickFromEdge}
                options={EDGE_OPTIONS}
                selected={edgeOf(shape.from)}
                testId='edge-start'
              />
            ) : null}
            {shape.to.kind === 'bound' ? (
              <OptionButtons
                label='End edge'
                onPick={pickToEdge}
                options={EDGE_OPTIONS}
                selected={edgeOf(shape.to)}
                testId='edge-end'
              />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
};
