type Props = {
  paths: string;
  viewBox: number;
};

/**
 * One icon as an inline SVG, drawn from the dataset's own path data. The picker
 * previews the same bytes the canvas paints, so it needs no second library and
 * no icon component per name.
 */
export const IconGlyph = ({ paths, viewBox }: Props) => (
  <svg
    aria-hidden='true'
    className='h-5 w-5'
    fill='none'
    stroke='currentColor'
    strokeLinecap='round'
    strokeLinejoin='round'
    strokeWidth={2}
    viewBox={`0 0 ${viewBox} ${viewBox}`}
  >
    <path d={paths} />
  </svg>
);
