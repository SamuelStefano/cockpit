import * as THREE from 'three';
import { SECTORS } from '../sectors';
import type { BaseEngine } from './engine';

const QWE = ['q', 'w', 'e'];

// Pinch wheel deltas are small and arrive many times a second, so zoom follows their size.
export const pinchWheelFactor = (deltaY: number) => Math.exp(Math.max(-30, Math.min(30, deltaY)) * 0.01);

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
    if (!drag || !ev.buttons) {
      if (ev.target !== dom) { e.hoverId = null; return; }
      const all = hits(ev);
      const id = (all.find((h) => h.object.userData.agentId)?.object.userData.agentId as string | undefined) ?? null;
      e.hoverId = id;
      dom.style.cursor = id || (e.onMissionClick && all.some((h) => h.object.userData.missionId)) ? 'pointer' : '';
      return;
    }
    if (fingers.size >= 2) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) <= 4) return;
    drag.moved = true;
    const k = e.rig.height * 0.0016;
    e.rig.pan(-dx * k, -dy * k);
    drag.x = ev.clientX; drag.y = ev.clientY;
  }, { signal });
  // Trackpad and touchscreen pinches reach the page as ctrl+wheel: while the Base is open they zoom the floor, never the Deck.
  window.addEventListener('wheel', (ev) => {
    const t = ev.target as Element | null;
    if (ev.ctrlKey) {
      ev.preventDefault();
      if (t?.closest('.base-root')) e.rig.zoom(pinchWheelFactor(ev.deltaY));
    } else if (t === dom || t?.closest('.base-labels')) {
      ev.preventDefault();
      e.rig.zoom(ev.deltaY > 0 ? 1.1 : 0.9);
    }
  }, { passive: false, signal });
  // Safari reports pinches as gesture events instead.
  for (const name of ['gesturestart', 'gesturechange', 'gestureend']) window.addEventListener(name, (ev) => ev.preventDefault(), { passive: false, signal });
  const fingers = new Map<number, { x: number; y: number }>();
  let pinchGap = 0;
  const gap = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  dom.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'touch') return;
    fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (fingers.size === 2) { pinchGap = gap(); if (drag) drag.moved = true; }
  }, { signal });
  window.addEventListener('pointermove', (ev) => {
    if (!fingers.has(ev.pointerId)) return;
    fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (fingers.size !== 2) return;
    const now = gap();
    if (pinchGap > 0 && now > 0) e.rig.zoom(pinchGap / now);
    pinchGap = now;
  }, { signal });
  for (const name of ['pointerup', 'pointercancel'] as const) window.addEventListener(name, (ev) => { fingers.delete(ev.pointerId); }, { signal });
  dom.addEventListener('click', (ev) => {
    if (drag?.moved) return;
    const all = hits(ev);
    const crate = all.find((h) => h.object.userData.crateId);
    if (crate) { e.clickCrate(crate.object.userData.crateId as string); return; }
    const mission = all.find((h) => h.object.userData.missionId);
    if (mission && e.onMissionClick) { e.onMissionClick(mission.object.userData.missionId as string); return; }
    const agent = all.find((h) => h.object.userData.agentId);
    if (agent) {
      const id = agent.object.userData.agentId as string;
      // One click always opens the desk and draws its link to the box.
      e.select(id);
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
    if (k === '[') e.stepDesk(-1);
    if (k === ']') e.stepDesk(1);
    if (k === 'n') e.cycleSound();
    if (!practice) return;
    if (k === 'f') e.openFunnel();
    if (k === 'p') { ev.preventDefault(); e.setComposer(true); }
    if (k === 'h') e.toggleHistory();
    if (k === ' ') { ev.preventDefault(); e.togglePause(); }
    if (k === 'a') e.stepAway();
  }, { signal });

  return () => ctl.abort();
}
