'use client';

import { OptionButtons } from './option-buttons';
import { type Appearance, useAppearance } from './use-appearance';

const OPTIONS: readonly { label: string; value: Appearance }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

/**
 * The chrome's own appearance. It sits beside the camera because it is how the
 * app is looked at, not what the board is — it writes no board setting, so it
 * never reaches autosave or an export.
 */
export const AppearanceControl = () => {
  const { appearance, setAppearance } = useAppearance();

  return (
    <OptionButtons
      label='Appearance'
      onPick={setAppearance}
      options={OPTIONS}
      selected={appearance}
      testId='appearance'
    />
  );
};
