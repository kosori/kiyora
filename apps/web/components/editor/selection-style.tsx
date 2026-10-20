'use client';

import { useEditor } from '@kiyora/editor/react';
import {
  type Corner,
  cornerSchema,
  DASHES,
  type Dash,
  FILL_STYLES,
  type FillStyle,
  FOREGROUND,
  type PaletteColour,
  type Shape,
  type Theme,
} from '@kiyora/model';
import { useCallback } from 'react';
import { ColourField } from './colour-field';
import { OptionButtons } from './option-buttons';
import { PaletteSwatches } from './palette-swatches';
import { StyleSlider } from './style-slider';
import { TextStyleControls } from './text-style-controls';

type Props = {
  shape: Shape;
  theme: Theme;
};

type Option<T extends string> = {
  label: string;
  value: T;
};

const labelOf = (token: string): string =>
  token.charAt(0).toUpperCase() + token.slice(1);

/** The option rows, named from the vocabulary itself so no list is written twice. */
const optionsOf = <T extends string>(tokens: readonly T[]): Option<T>[] =>
  tokens.map((value) => ({ label: labelOf(value), value }));

const FILL_OPTIONS = optionsOf<FillStyle>(FILL_STYLES);
const DASH_OPTIONS = optionsOf<Dash>(DASHES);
const CORNER_OPTIONS = optionsOf<Corner>(cornerSchema.options);

const HEADING = 'mb-1.5 text-muted-foreground text-xs uppercase tracking-wide';

/** The style controls for the selection. Every change goes through the store. */
export const SelectionStyle = ({ shape, theme }: Props) => {
  const editor = useEditor();
  const { style } = shape;

  const pickFill = useCallback(
    (fill: PaletteColour) => editor.restyle({ style: { fill } }),
    [editor]
  );
  const pickFillStyle = useCallback(
    (fillStyle: FillStyle) => editor.restyle({ style: { fillStyle } }),
    [editor]
  );
  const pickStroke = useCallback(
    (stroke: PaletteColour) => editor.restyle({ style: { stroke } }),
    [editor]
  );
  const pickInk = useCallback(
    () => editor.restyle({ style: { stroke: FOREGROUND } }),
    [editor]
  );
  const pickStrokeWidth = useCallback(
    (strokeWidth: number) => editor.restyle({ style: { strokeWidth } }),
    [editor]
  );
  const pickDash = useCallback(
    (dash: Dash) => editor.restyle({ style: { dash } }),
    [editor]
  );
  const pickCorner = useCallback(
    (corner: Corner) => editor.restyle({ style: { corner } }),
    [editor]
  );
  const pickOpacity = useCallback(
    (opacity: number) => editor.restyle({ opacity: opacity / 100 }),
    [editor]
  );

  return (
    <div className='flex flex-col gap-4' data-testid='inspector-controls'>
      <section>
        <h3 className={HEADING}>Fill</h3>
        <div className='flex flex-col gap-2'>
          <PaletteSwatches
            label='Fill'
            onPick={pickFill}
            selected={style.fill}
            testId='fill'
            theme={theme}
          />
          <OptionButtons
            label='Fill style'
            onPick={pickFillStyle}
            options={FILL_OPTIONS}
            selected={style.fillStyle}
            testId='fill-style'
          />
          <ColourField onPick={pickFill} />
        </div>
      </section>
      <section>
        <h3 className={HEADING}>Stroke</h3>
        <div className='flex flex-col gap-2'>
          <PaletteSwatches
            label='Stroke'
            onInk={pickInk}
            onPick={pickStroke}
            selected={style.stroke}
            testId='stroke'
            theme={theme}
          />
          <StyleSlider
            label='Stroke width'
            max={12}
            min={0}
            onChange={pickStrokeWidth}
            testId='stroke-width'
            value={style.strokeWidth}
          />
          <OptionButtons
            label='Dash'
            onPick={pickDash}
            options={DASH_OPTIONS}
            selected={style.dash}
            testId='dash'
          />
          <OptionButtons
            label='Corners'
            onPick={pickCorner}
            options={CORNER_OPTIONS}
            selected={style.corner}
            testId='corner'
          />
        </div>
      </section>
      <section>
        <h3 className={HEADING}>Opacity</h3>
        <StyleSlider
          label='Opacity'
          max={100}
          min={0}
          onChange={pickOpacity}
          testId='opacity'
          value={Math.round(shape.opacity * 100)}
        />
      </section>
      <TextStyleControls shape={shape} />
    </div>
  );
};
