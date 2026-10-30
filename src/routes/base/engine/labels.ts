import * as THREE from 'three';
import { STATE_LOOK } from './monitor';
import type { FloorAgent, SectorRow, Wing } from '../types';
import { sectorById } from '../sectors';

const ALARM = new Set(['blocked', 'silent', 'asleep']);
const v3 = new THREE.Vector3();

// Session titles land here, so nodes are built with textContent only.
class Label {
  readonly el = document.createElement('button');
  private key = '';
  constructor(host: HTMLElement, className: string, onClick: () => void) {
    this.el.className = className;
    this.el.type = 'button';
    this.el.onclick = onClick;
    host.appendChild(this.el);
  }
  place(x: number, y: number, z: number, cam: THREE.Camera, w: number, h: number) {
    v3.set(x, y, z).project(cam);
    this.el.style.transform = `translate(-50%,-100%) translate(${((v3.x + 1) / 2) * w}px,${((1 - v3.y) / 2) * h}px)`;
  }
  show(on: boolean) { this.el.style.display = on ? '' : 'none'; }
  fill(key: string, build: (el: HTMLElement) => void) {
    if (key === this.key) return;
    this.key = key;
    this.el.textContent = '';
    build(this.el);
  }
}

const add = (p: HTMLElement, tag: string, text: string, color?: string) => {
  const n = document.createElement(tag);
  n.textContent = text;
  if (color) n.style.color = color;
  p.appendChild(n);
};

export class Labels {
  private agents = new Map<string, Label>();
  private wings = new Map<string, Label>();
  private sectors = new Map<string, Label>();

  constructor(private host: HTMLElement, private on: { agent: (id: string) => void; wing: (id: string) => void; sector: (id: SectorRow['id']) => void }) {}

  private sync<K>(map: Map<string, Label>, ids: string[], cls: string, click: (id: string) => void) {
    for (const [id, l] of map) if (!ids.includes(id)) { l.el.remove(); map.delete(id); }
    for (const id of ids) if (!map.has(id)) map.set(id, new Label(this.host, cls, () => click(id)));
  }

  update(agents: FloorAgent[], wings: Wing[], rows: SectorRow[], cam: THREE.Camera, w: number, h: number, near: boolean, focused: boolean) {
    this.sync(this.agents, agents.map((a) => a.id), 'base-lbl', this.on.agent);
    this.sync(this.wings, wings.map((x) => x.id), 'base-plaque', this.on.wing);
    this.sync(this.sectors, rows.map((r) => r.id), 'base-sector-plaque', (id) => this.on.sector(id as SectorRow['id']));
    for (const a of agents) {
      const l = this.agents.get(a.id)!, st = STATE_LOOK[a.state] ?? STATE_LOOK.waiting, alarm = ALARM.has(a.state);
      l.place(a.x, 5.3, a.z + 0.5, cam, w, h);
      l.show(!focused && (near || alarm));
      l.el.classList.toggle('alarm', alarm);
      l.fill(`${near}|${a.state}|${a.name}|${a.modelLabel}|${a.line}`, (el) => {
        add(el, 'i', `${st.icon} `, alarm ? undefined : st.css);
        add(el, 'b', a.name.slice(0, 28));
        if (near) { add(el, 'small', ` ${a.modelLabel}`); el.appendChild(document.createElement('br')); add(el, 'u', a.line.slice(0, 30)); }
      });
    }
    for (const x of wings) {
      const l = this.wings.get(x.id)!, mine = agents.filter((a) => a.wingId === x.id);
      const busy = mine.filter((a) => a.state === 'working' || a.state === 'thinking').length, bad = mine.filter((a) => ALARM.has(a.state)).length;
      l.place(x.cx, 6.2, -14, cam, w, h);
      l.show(!focused);
      l.fill(`${x.name}|${busy}|${mine.length}|${bad}|${x.hotkey}`, (el) => {
        add(el, 'b', x.name.slice(0, 22));
        if (x.hotkey) { el.appendChild(document.createTextNode(' ')); add(el, 'kbd', x.hotkey); }
        el.appendChild(document.createTextNode(` ${busy}/${mine.length} busy`));
        if (bad) add(el, 'em', ` · ${bad} stuck`);
      });
    }
    for (const r of rows) {
      const l = this.sectors.get(r.id)!, s = sectorById(r.id);
      l.place(s.x0 + 5, 0.3, s.z1 - 0.3, cam, w, h);
      l.show(!focused);
      l.el.style.setProperty('--c', r.color);
      l.fill(`${r.name}`, (el) => { add(el, 'b', r.name); el.appendChild(document.createTextNode(' ')); add(el, 'kbd', r.hotkey); });
    }
  }

  dispose() {
    for (const m of [this.agents, this.wings, this.sectors]) { for (const l of m.values()) l.el.remove(); m.clear(); }
  }
}
