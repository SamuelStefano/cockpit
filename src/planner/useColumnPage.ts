import { useState } from 'react';
import { COLUMN_PAGE } from './planner-logic';

export function useColumnPage<T>(items: T[]) {
  const [limit, setLimit] = useState(COLUMN_PAGE);
  const shown = items.length > limit ? items.slice(0, limit) : items;
  return { shown, hidden: items.length - shown.length, more: () => setLimit((l) => l + COLUMN_PAGE) };
}
