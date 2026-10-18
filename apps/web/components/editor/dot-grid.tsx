import { gridSpacing } from '@kiyora/editor';
import { type Camera, paintColour, type Theme } from '@kiyora/model';

type Props = {
  camera: Camera;
  theme: Theme;
};

/**
 * The dot grid the board sits on. Its world step is banded by the zoom, so
 * zooming out shows a coarser grid instead of a denser screen of dots, and the
 * grid slides with the board. Display-only: the projector never sees it.
 */
export const DotGrid = ({ camera, theme }: Props) => {
  const spacing = gridSpacing(camera.zoom);

  return (
    <>
      <defs>
        <pattern
          data-testid='dot-grid'
          height={spacing}
          id='kiyora-dot-grid'
          patternTransform={`translate(${camera.x % spacing} ${camera.y % spacing})`}
          patternUnits='userSpaceOnUse'
          width={spacing}
        >
          <circle cx={0} cy={0} fill={paintColour('gray', theme, 0.5)} r={1} />
        </pattern>
      </defs>
      <rect fill='url(#kiyora-dot-grid)' height='100%' width='100%' />
    </>
  );
};
