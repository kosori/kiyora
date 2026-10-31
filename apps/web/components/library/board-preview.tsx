// biome-ignore-all lint/security/noDangerouslySetInnerHtml: a preview is markup, and every one passes `unsafeSvg`, the same guard an export uses.
import { unsafeSvg } from '@kiyora/model';

type Props = {
  svg?: string;
};

/** The stored SVG when it passes the export guard, or `null` when the tile is neutral. */
const safePreview = (svg: string | undefined): string | null => {
  if (svg === undefined || unsafeSvg(svg) !== null) {
    return null;
  }
  return svg;
};

/**
 * One board's picture in the list. The bytes come from storage, so they are
 * treated as untrusted: a preview that fails the export guard renders as a
 * neutral tile rather than as a document. The tile is decorative — the row's
 * name is the accessible label — and a board without a preview still lists.
 */
export const BoardPreview = ({ svg }: Props) => {
  const safe = safePreview(svg);

  return (
    <div
      aria-hidden
      className='pointer-events-none h-16 w-24 shrink-0 overflow-hidden rounded border border-border bg-muted [&_svg]:h-full [&_svg]:w-full'
      dangerouslySetInnerHTML={safe === null ? undefined : { __html: safe }}
      data-empty={safe === null ? 'true' : undefined}
      data-testid='board-preview'
    />
  );
};
