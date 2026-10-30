import * as THREE from 'three';
import { SECTORS } from '../sectors';
import type { BaseEngine } from './engine';

const QWE = ['q', 'w', 'e'];

// Everything hangs off one AbortController, so unmount cannot leave a listener behind.
export function attachInput(e: BaseEngine): () => void {
  const ctl = new AbortController(), { signal } = ctl;
  const { dom } = e.viewport;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let drag: { x: number; y: number; moved: boolean } | null = null;

  const hits = (ev: MouseEvent) => {
    const r = dom.getBoundingClientRect(), v = e.viewport;
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, v.camera);
    return ray.intersectObjects(v.scene.children, true);
  };

  dom.addEventListener('pointerdown', (ev) => { drag = { x: ev.clientX, y: ev.clientY, moved: false }; }, { signal });
  window.addEventListener('pointerup', () => { setTimeout(() => { drag = null; }, 0); }, { signal });
  window.addEventListener('pointermove', (ev) => {
    if (!drag || !ev.buttons) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) <= 4) return;
    drag.moved = true;
    const k = e.rig.height * 0.0016;
    e.rig.pan(-dx * k, -dy * k);
    drag.x = ev.clientX; drag.y = ev.clientY;
  }, { signal });
  dom.addEventListener('wheel', (ev) => { ev.preventDefault(); e.rig.zoom(ev.deltaY > 0 ? 1.1 : 0.9); }, { passive: false, signal });
  dom.addEventListener('click', (ev) => {
    if (drag?.moved) return;
    const all = hits(ev);
    const crate = all.find((h) => h.object.userData.crateId);
    if (crate) { e.clickCrate(crate.object.userData.crateId as string); return; }
    const agent = all.find((h) => h.object.userData.agentId);
    if (agent) {
      const id = agent.object.userData.agentId as string;
      const a = e.floor.agents.find((x) => x.id === id);
      if (a && (e.selectedId || e.viewWingId === a.wingId || !e.floor.wings.some((w) => w.id === a.wingId))) e.select(id);
      else if (a) e.goWing(a.wingId);
      return;
    }
    if (e.selectedId) e.back();
  }, { signal });

  window.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('[role="dialog"]')) return;
    const k = ev.key.toLowerCase(), practice = e.mode === 'practice';
    if (k === 'escape') e.escape();
    if (k === 'tab') { ev.preventDefault(); e.nextDecision(); }
    if (k >= '1' && k <= '6') {
      const wing = e.viewWingId ?? e.floor.wings[0]?.id;
      const mine = e.floor.agents.filter((a) => a.wingId === wing);
      const a = mine[Number(k) - 1];
      if (a) e.select(a.id);
    }
    const qwe = QWE.indexOf(k);
    if (qwe >= 0) e.chooseFirst(qwe);
    const wing = e.floor.wings.find((w) => w.hotkey?.toLowerCase() === k);
    if (wing) e.goWing(wing.id);
    const sector = SECTORS.find((s) => s.hotkey.toLowerCase() === k);
    if (sector) e.goSector(sector.id);
    if (k === 'm') e.cycleSound();
    if (!practice) return;
    if (k === 'f') e.openFunnel();
    if (k === 'p') { ev.preventDefault(); e.setComposer(true); }
    if (k === 'h') e.toggleHistory();
    if (k === ' ') { ev.preventDefault(); e.togglePause(); }
    if (k === 'a') e.stepAway();
  }, { signal });

  return () => ctl.abort();
}
