import { useEffect, useRef, useState } from 'react';
import { usePersisted } from '../../lib/persist';
import { todoCounts } from './task-tray';
import type { ToolTodo } from '../../data/types';

interface TaskTrayArgs {
  todos: ToolTodo[];
  isMobile: boolean;
  keyboardOpen: boolean;
}

// `chat.taskTray.collapsed` é a preferência do DESKTOP e continua sendo só isso:
// no celular o tray nasce sempre colapsado (a linha "tarefas · 9/12" já é a
// informação útil) e o expandido vira bottom sheet, então nada do mobile grava
// na chave — um toque no celular não pode reconfigurar o layout do PC.
export function useTaskTray({ todos, isMobile, keyboardOpen }: TaskTrayArgs) {
  const [persisted, setPersisted] = usePersisted<boolean>('chat.taskTray.collapsed', false);
  const [sheet, setSheet] = useState(false);
  const { done, total, allDone } = todoCounts(todos);

  // Quando TUDO conclui, fecha sozinho UMA vez (na transição).
  const prevAllDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !prevAllDone.current) {
      if (isMobile) setSheet(false);
      else setPersisted(true);
    }
    prevAllDone.current = allDone;
  }, [allDone, isMobile, setPersisted]);

  useEffect(() => {
    if (keyboardOpen) setSheet(false);
  }, [keyboardOpen]);

  const collapsed = isMobile || keyboardOpen ? true : persisted;
  const toggle = () => {
    if (isMobile) {
      if (!keyboardOpen) setSheet((s) => !s);
      return;
    }
    setPersisted(!persisted);
  };

  return { done, total, allDone, collapsed, sheet: sheet && !keyboardOpen, closeSheet: () => setSheet(false), toggle };
}
