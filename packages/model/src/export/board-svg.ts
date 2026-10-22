import type { Board } from '../board/schema';
import { utf8Length } from '../format';
import type { PaintContext } from '../paint/paint';
import { projectBoard } from '../projection/svg';
import { sanitizeHref } from '../text/markdown';

/** The extension an SVG export wears. */
export const SVG_FILE_EXTENSION = '.svg';

/**
 * The most bytes an SVG export may reach. A board that projects past it is
 * refused rather than written out, because a truncated download is worse than
 * no download: the person keeps a file that looks like their board and is not.
 * A board with many labelled shapes can still reach this, so the cap is generous.
 */
export const SVG_EXPORT_LIMIT_BYTES = 8 * 1024 * 1024;

/** What a caller may choose about an export. A board and its canvas are the rest. */
export type SvgExportOptions = {
  /** The byte cap for this export. Defaults to `SVG_EXPORT_LIMIT_BYTES`. */
  limitBytes?: number;
};

/** Thrown when a board cannot leave the app as an SVG. `reason` names what stopped it. */
export class SvgExportRefusal extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`SVG export refused: ${reason}`);
    this.name = 'SvgExportRefusal';
    this.reason = reason;
  }
}

/** An element that either runs code, fetches something, or animates itself. */
const ACTIVE_ELEMENT =
  /<(script|style|foreignObject|iframe|embed|object|animate|animateTransform|animateMotion|set|feImage)\b/i;

/**
 * The only embedded content an export may carry: a raster in the file itself.
 * The two types are inert — a decoder turns them into pixels — so an `<image>`
 * holding one is a picture, not a document that can reach out or run. SVG and
 * every other type stay refused.
 */
const RASTER_IMAGE = /^<image\b/i;
const RASTER_HREF = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

/** An inline event handler, the other way markup runs code. */
const EVENT_HANDLER = /\son[a-z]+\s*=/i;

/** A paint server that points at another document rather than at this one. */
const OUTSIDE_URL = /url\(\s*['"]?(?!#)/i;

/** A reference an element carries: a link, an embed or a fetch. */
const REFERENCE = /\b(href|xlink:href|src)\s*=\s*"([^"]*)"/gi;

/**
 * What stops `svg` from being a safe document, or `null` when nothing does. An
 * exported SVG is a document other people open, so this reads the markup rather
 * than trusting the projection: it refuses code, animation and embedded content,
 * a paint server that points outside the file, and any reference that is not a
 * fragment inside it. The one embedded element allowed is `<image>` carrying a
 * base64 PNG or JPEG — a raster has nothing to run — and the one link a label may
 * carry is allowed through `sanitizeHref`, the same gate the canvas uses.
 *
 * Only tag markup is read, never text, so a label that reads `onload=` is a
 * label and not an event handler.
 */
export const unsafeSvg = (svg: string): string | null => {
  if (!svg.startsWith('<svg ')) {
    return 'not an SVG document';
  }

  for (const tag of svg.match(/<[^>]*>/g) ?? []) {
    const handler = EVENT_HANDLER.exec(tag);
    if (handler !== null) {
      return `an event handler:${handler[0]}`;
    }

    if (RASTER_IMAGE.test(tag)) {
      const href = /\bhref\s*=\s*"([^"]*)"/.exec(tag)?.[1];
      if (href === undefined || !RASTER_HREF.test(href)) {
        return 'an image that is not a PNG or JPEG embedded in the file';
      }
      continue;
    }

    const element = ACTIVE_ELEMENT.exec(tag);
    if (element !== null) {
      return `content the file must not carry: <${element[1]}>`;
    }

    if (OUTSIDE_URL.test(tag)) {
      return 'a reference outside the file: url(...)';
    }

    for (const [, name = '', value = ''] of tag.matchAll(REFERENCE)) {
      if (value.startsWith('#')) {
        continue;
      }
      if (name.toLowerCase() === 'href' && sanitizeHref(value) !== null) {
        continue;
      }
      return `a reference outside the file: ${name}="${value}"`;
    }
  }

  return null;
};

/**
 * The board as the bytes a person downloads: one self-contained SVG document,
 * measured against a cap and read for anything a document must not carry. It
 * refuses rather than returning a partial or unsafe file, so a failure is
 * reported instead of shipped.
 */
export const exportBoardSvg = (
  board: Board,
  context: PaintContext,
  options: SvgExportOptions = {}
): string => {
  const svg = projectBoard(board, context);
  const limit = options.limitBytes ?? SVG_EXPORT_LIMIT_BYTES;
  const bytes = utf8Length(svg);

  if (bytes > limit) {
    throw new SvgExportRefusal(
      `the artifact is ${bytes} bytes, over the ${limit}-byte cap`
    );
  }

  const hazard = unsafeSvg(svg);
  if (hazard !== null) {
    throw new SvgExportRefusal(hazard);
  }

  return svg;
};
