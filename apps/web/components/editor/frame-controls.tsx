'use client';

import { useEditor } from '@kiyora/editor/react';
import {
  FRAME_VARIANTS,
  type FrameShape,
  type FrameVariant,
} from '@kiyora/model';
import { useCallback } from 'react';
import { OptionButtons } from './option-buttons';

type Props = {
  shape: FrameShape;
};

const labelOf = (token: string): string =>
  token.charAt(0).toUpperCase() + token.slice(1);

const VARIANT_OPTIONS = FRAME_VARIANTS.map((value) => ({
  label: labelOf(value),
  value,
}));

/**
 * The variant a selected frame wears: plain or a device. Picking one restyles
 * the frame as one gesture, so one undo puts the previous chrome back.
 */
export const FrameControls = ({ shape }: Props) => {
  const editor = useEditor();
  const pick = useCallback(
    (variant: FrameVariant) => editor.restyle({ variant }),
    [editor]
  );

  return (
    <section>
      <h3 className='mb-1.5 text-muted-foreground text-xs uppercase tracking-wide'>
        Frame
      </h3>
      <OptionButtons
        label='Variant'
        onPick={pick}
        options={VARIANT_OPTIONS}
        selected={shape.variant}
        testId='frame-variant'
      />
    </section>
  );
};
