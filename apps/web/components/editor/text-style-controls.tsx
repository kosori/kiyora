'use client';

import { useEditor } from '@kiyora/editor/react';
import {
  DEFAULT_TEXT_STYLE,
  type Shape,
  TEXT_ALIGNS,
  TEXT_SIZE_PRESETS,
  TEXT_VALIGNS,
  type TextAlign,
  type TextVerticalAlign,
} from '@kiyora/model';
import { useCallback } from 'react';
import { OptionButtons } from './option-buttons';

type Option<T extends string> = {
  label: string;
  value: T;
};

/** The four size presets the model names, in ascending order. */
type SizePreset = keyof typeof TEXT_SIZE_PRESETS;

const SIZE_OPTIONS: readonly Option<SizePreset>[] = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
  { label: 'Extra large', value: 'xlarge' },
];

const ALIGN_LABELS: Record<TextAlign, string> = {
  center: 'Centre',
  left: 'Left',
  right: 'Right',
};

const VALIGN_LABELS: Record<TextVerticalAlign, string> = {
  bottom: 'Bottom',
  middle: 'Middle',
  top: 'Top',
};

const ALIGN_OPTIONS: readonly Option<TextAlign>[] = TEXT_ALIGNS.map(
  (value) => ({ label: ALIGN_LABELS[value], value })
);

const VALIGN_OPTIONS: readonly Option<TextVerticalAlign>[] = TEXT_VALIGNS.map(
  (value) => ({ label: VALIGN_LABELS[value], value })
);

const HEADING = 'mb-1.5 text-muted-foreground text-xs uppercase tracking-wide';

/** The preset a stored size names, or `null` when it names no preset. */
const presetOf = (size: number): SizePreset | null => {
  const found = (
    Object.entries(TEXT_SIZE_PRESETS) as [SizePreset, number][]
  ).find(([, value]) => value === size);

  return found?.[0] ?? null;
};

type Props = {
  shape: Shape;
};

/**
 * The controls for a label's text style: the four sizes, the horizontal
 * alignment, and — for a shape label, never a text shape — the vertical
 * alignment. Every pick is one restyle, so one undo walks it back, and it
 * reaches every selected shape through the same store the palette writes.
 */
export const TextStyleControls = ({ shape }: Props) => {
  const editor = useEditor();
  const style = shape.textStyle ?? DEFAULT_TEXT_STYLE;

  const pickSize = useCallback(
    (preset: SizePreset) =>
      editor.restyle({ textStyle: { size: TEXT_SIZE_PRESETS[preset] } }),
    [editor]
  );
  const pickAlign = useCallback(
    (align: TextAlign) => editor.restyle({ textStyle: { align } }),
    [editor]
  );
  const pickValign = useCallback(
    (valign: TextVerticalAlign) => editor.restyle({ textStyle: { valign } }),
    [editor]
  );

  return (
    <section>
      <h3 className={HEADING}>Text</h3>
      <div className='flex flex-col gap-2'>
        <OptionButtons
          label='Text size'
          onPick={pickSize}
          options={SIZE_OPTIONS}
          selected={presetOf(style.size)}
          testId='text-size'
        />
        <OptionButtons
          label='Text align'
          onPick={pickAlign}
          options={ALIGN_OPTIONS}
          selected={style.align}
          testId='text-align'
        />
        {shape.kind === 'text' ? null : (
          <OptionButtons
            label='Text vertical align'
            onPick={pickValign}
            options={VALIGN_OPTIONS}
            selected={style.valign}
            testId='text-valign'
          />
        )}
      </div>
    </section>
  );
};
