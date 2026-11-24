import { useState } from 'react';
import { PLANNER_COLUMNS, type PlannerColumn } from '../../../shared/planner';
import { Button, Menu, MenuItem, Popover } from '../primitives';
import { COLUMN_LABELS } from '../../planner/planner-logic';

export function CardMoveMenu({ column, onMoveTo }: { column: PlannerColumn; onMoveTo: (to: PlannerColumn) => void }) {
  const [open, setOpen] = useState(false);
  const pick = (to: PlannerColumn) => { setOpen(false); onMoveTo(to); };
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Popover
        open={open} onClose={() => setOpen(false)} side="bottom" align="end" label="Mover"
        content={(
          <Menu label="Mover para">
            {PLANNER_COLUMNS.filter((c) => c !== column).map((c) => <MenuItem key={c} label={COLUMN_LABELS[c]} icon="move" onClick={() => pick(c)} />)}
          </Menu>
        )}
      >
        <Button variant="ghost" size="xs" square icon="ellipsis" aria-label="Mover" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} />
      </Popover>
    </span>
  );
}
