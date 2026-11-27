import { useEffect } from 'react';
import { useBoxes } from '../cockpit/useBoxes';
import { onDesktopLink } from '../lib/desktop';
import { chatPath } from '../useRoute';

export function useDesktopLinks(): void {
  const { active, switchBox } = useBoxes();
  useEffect(() => {
    onDesktopLink((link) => {
      history.pushState(null, '', chatPath(link.session));
      if (link.box && link.box !== active) switchBox(link.box);
      else window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }, [active, switchBox]);
}
