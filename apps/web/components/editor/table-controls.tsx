'use client';

import { useEditor } from '@kiyora/editor/react';
import type { TableShape } from '@kiyora/model';
import { useCallback } from 'react';
import { Button } from '~/components/ui/button';

type Props = {
  shape: TableShape;
};

/**
 * The structure edits a selected table offers: one more row, one more column,
 * and the header row's authored flag. Each is one gesture, so each is one undo.
 */
export const TableControls = ({ shape }: Props) => {
  const editor = useEditor();
  const addRow = useCallback(() => {
    editor.addTableRow(shape.id);
  }, [editor, shape.id]);
  const addColumn = useCallback(() => {
    editor.addTableColumn(shape.id);
  }, [editor, shape.id]);
  const toggleHeader = useCallback(() => {
    editor.setTableHeader(shape.id, !shape.headerRow);
  }, [editor, shape.headerRow, shape.id]);

  return (
    <section>
      <h3 className='mb-1.5 text-muted-foreground text-xs uppercase tracking-wide'>
        Table
      </h3>
      <div className='grid grid-cols-2 gap-1.5'>
        <Button
          className='justify-start'
          data-testid='table-add-row'
          onClick={addRow}
          size='sm'
          variant='outline'
        >
          Add row
        </Button>
        <Button
          className='justify-start'
          data-testid='table-add-column'
          onClick={addColumn}
          size='sm'
          variant='outline'
        >
          Add column
        </Button>
      </div>
      <Button
        aria-pressed={shape.headerRow}
        className='mt-1.5 w-full justify-start'
        data-testid='table-header'
        onClick={toggleHeader}
        size='sm'
        variant='outline'
      >
        {shape.headerRow ? 'Header row on' : 'Header row off'}
      </Button>
    </section>
  );
};
