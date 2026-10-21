'use client';

import { commandId, type ContextMenuItem as MenuItem } from '@kiyora/editor';
import { useCallback } from 'react';
import { Button } from '~/components/ui/button';

type Props = {
  item: MenuItem;
  onChoose: (item: MenuItem) => void;
};

/** One command in the context menu: its copy, and whether the selection allows it. */
export const ContextMenuItem = ({ item, onChoose }: Props) => {
  const choose = useCallback(() => onChoose(item), [item, onChoose]);

  return (
    <Button
      className='w-full justify-start font-normal'
      data-testid={`context-menu-${commandId(item.command)}`}
      disabled={item.disabled}
      onClick={choose}
      role='menuitem'
      size='sm'
      variant='ghost'
    >
      {item.label}
    </Button>
  );
};
