'use client';

import { OptionButtons } from './option-buttons';
import type { Appearance } from './use-appearance';

const OPTIONS: readonly { label: string; value: Appearance }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

type Props = {
  appearance: Appearance;
  setAppearance: (next: Appearance) => void;
};

/**
 * The chrome's own appearance. It lives in the board menu because it is how the
 * app is looked at, not what the board is — it writes no board setting, so it
 * never reaches autosave or an export.
 */
export const AppearanceControl = ({ appearance, setAppearance }: Props) => (
  <OptionButtons
    label='Appearance'
    onPick={setAppearance}
    options={OPTIONS}
    selected={appearance}
    testId='appearance'
  />
);
