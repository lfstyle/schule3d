// Vergleichsmodus Foto ↔ Spiel (im Fotomodus, nur in der lokalen Version): Ein Originalfoto liegt über dem Bild,
// mit Überblendung und Trennlinie. Die Kamera lässt sich an das Foto anpassen (Maus ziehen = drehen, Mausrad =
// Bildwinkel, WASD/QE = verschieben) und die Ansicht zum Foto speichern. Gespeicherte Ansichten stehen in
// verification/vergleich/ansichten.json und öffnen sich bei der Fotoauswahl wieder.
// Die Fotos liefert nur werkzeuge/lokaler-server.py (fotos/ ist nicht online und nicht in Git).
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const VIEWS_URL = '/verification/vergleich/ansichten.json';
const DEG = Math.PI / 180;

export class PhotoCompare {
  constructor({ camera, photo, canvas }) {
    Object.assign(this, { camera, photo, canvas });
    this.active = false;
    this.views = new Map();
    this.current = null;   // { foto, url, width, height }
    const $ = (id) => document.getElementById(id);
    this.ui = {
      open: $('compare-btn'), panel: $('compare-panel'), folder: $('compare-folder'), file: $('compare-file'),
      disk: $('compare-disk'), opacity: $('compare-opacity'), wipe: $('compare-wipe'), save: $('compare-save'),
      copy: $('compare-copy'), close: $('compare-close'), status: $('compare-status'), img: $('compare-img'), line: $('compare-line'),
    };
    this.ui.open.classList.toggle('hidden', !LOCAL);
    this.ui.open.addEventListener('click', () => this.enter());
    this.ui.close.addEventListener('click', () => this.exit());
    this.ui.folder.addEventListener('change', () => this._fillFiles());
    this.ui.file.addEventListener('change', () => this.choose(this.ui.file.value));
    this.ui.disk.addEventListener('change', () => {
      const f = this.ui.disk.files?.[0];
      if (f) this._load({ foto: null, url: URL.createObjectURL(f), name: f.name });
    });
    this.ui.opacity.addEventListener('input', () => this._style());
    this.ui.wipe.addEventListener('input', () => this._style());
    this.ui.save.addEventListener('click', () => this.save());
    this.ui.copy.addEventListener('click', () => this.copy());
    window.addEventListener('resize', () => this.active && this._layout());
    this._bindAlign();
  }

  async enter() {
    if (!this.photo.active) return;
    this.active = true;
    this.photo.panel.classList.add('hidden');
    this.ui.panel.classList.remove('hidden');
    this.baseFov = this.camera.fov;
    this._status('Fotos werden geladen …');
    try {
      const [folders, views] = await Promise.all([
        fetch('/vergleich/fotos.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        fetch(VIEWS_URL, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);
      this.folders = folders;
      this.views = new Map(views.map((v) => [v.foto, v]));
      this.ui.folder.replaceChildren(...Object.keys(folders).map((name) => {
        const done = folders[name].filter((f) => this.views.has(f)).length;
        return new Option(`${name || '(Hauptordner)'} – ${folders[name].length} Fotos${done ? `, ${done} ausgerichtet` : ''}`, name);
      }));
      this._fillFiles();
      this._status('Foto wählen. Maus ziehen = drehen, Mausrad = Bildwinkel, WASD/Q/E = verschieben (Shift: schneller).');
    } catch {
      this.folders = {};
      this._status('Die Fotoliste gibt es nur mit dem lokalen Server (werkzeuge/lokaler-server.py). Ein Foto von der Festplatte geht trotzdem.');
    }
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.ui.panel.classList.add('hidden');
    this.ui.img.classList.add('hidden');
    this.ui.line.classList.add('hidden');
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    if (this.photo.active) { this.photo.panel.classList.remove('hidden'); this.photo.render(); }
  }

  _fillFiles() {
    const list = this.folders?.[this.ui.folder.value] ?? [];
    this.ui.file.replaceChildren(new Option('– Foto wählen –', ''), ...list.map((f) => new Option(`${this.views.has(f) ? '✓ ' : ''}${f.split('/').pop()}`, f)));
  }

  choose(foto) {
    if (!foto) return;
    this._load({ foto, url: '/fotos/' + foto.split('/').map(encodeURIComponent).join('/'), name: foto });
  }

  _load(item) {
    const img = this.ui.img;
    img.onload = () => {
      this.current = { ...item, width: img.naturalWidth, height: img.naturalHeight };
      img.classList.remove('hidden');
      this.ui.line.classList.remove('hidden');
      const view = item.foto && this.views.get(item.foto);
      if (view) {
        this.camera.position.set(view.x, view.y, view.z);
        this.camera.rotation.set(view.pitch, view.yaw, 0, 'YXZ');
        this.photoFov = view.fov;
      } else {
        // Ohne gespeicherte Ansicht: aktuellen Kamerawinkel auf das Foto umrechnen (Bild bleibt gleich groß).
        const { h } = this._fit(), H = window.innerHeight;
        this.photoFov = 2 * Math.atan(Math.tan(this.baseFov * DEG / 2) * h / H) / DEG;
      }
      this._layout();
      this._status(view ? `Gespeicherte Ansicht geladen${view.notiz ? ` (${view.notiz})` : ''}.` : 'Noch keine Ansicht gespeichert: Kamera an das Foto anpassen, dann „Ansicht speichern“.');
    };
    img.onerror = () => this._status('Foto konnte nicht geladen werden.');
    img.src = item.url;
  }

  // Foto so groß wie möglich, ganz sichtbar und mittig; die Kamera bekommt den Bildwinkel, bei dem das
  // Foto genau seinen eigenen senkrechten Bildwinkel (photoFov) abdeckt.
  _fit() {
    const W = window.innerWidth, H = window.innerHeight, a = this.current.width / this.current.height;
    const w = Math.min(W, H * a);
    return { W, H, w, h: w / a };
  }

  _layout() {
    if (!this.current) return;
    const { W, H, w, h } = this._fit();
    Object.assign(this.ui.img.style, { width: `${w}px`, height: `${h}px`, left: `${(W - w) / 2}px`, top: `${(H - h) / 2}px` });
    this.rect = { left: (W - w) / 2, width: w, top: (H - h) / 2, height: h };
    this.camera.fov = 2 * Math.atan(Math.tan(this.photoFov * DEG / 2) * H / h) / DEG;
    this.camera.updateProjectionMatrix();
    this._style();
    this.photo.render();
  }

  _style() {
    const o = Number(this.ui.opacity.value), x = Number(this.ui.wipe.value);
    this.ui.img.style.opacity = String(o);
    this.ui.img.style.clipPath = `inset(0 ${100 - x}% 0 0)`;
    const r = this.rect;
    if (r) Object.assign(this.ui.line.style, { left: `${r.left + r.width * x / 100}px`, top: `${r.top}px`, height: `${r.height}px` });
    this.ui.line.classList.toggle('hidden', !this.current || x >= 100 || x <= 0);
  }

  _bindAlign() {
    let drag = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.active || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.active || !drag) return;
      // Feiner bei kleinem Bildwinkel; ziehen verschiebt das Bild „mit der Maus“.
      const k = this.camera.fov * DEG / window.innerHeight;
      this.camera.rotation.y += (e.clientX - drag.x) * k;
      this.camera.rotation.x = Math.max(-1.5, Math.min(1.5, this.camera.rotation.x + (e.clientY - drag.y) * k));
      drag = { x: e.clientX, y: e.clientY };
      this.photo.render();
    });
    this.canvas.addEventListener('pointerup', () => { drag = null; });
    this.canvas.addEventListener('wheel', (e) => {
      if (!this.active || !this.current) return;
      e.preventDefault();
      this.photoFov = Math.max(15, Math.min(110, this.photoFov * (e.deltaY > 0 ? 1.03 : 1 / 1.03)));
      this._layout();
    }, { passive: false });
    document.addEventListener('keydown', (e) => {
      if (!this.active || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        if (this.active && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.exit(); }
        return;
      }
      if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.exit(); return; }
      const step = e.shiftKey ? 0.25 : 0.05, yaw = this.camera.rotation.y;
      const fwd = [-Math.sin(yaw), -Math.cos(yaw)], right = [Math.cos(yaw), -Math.sin(yaw)];
      const move = { KeyW: [fwd, 1], KeyS: [fwd, -1], KeyD: [right, 1], KeyA: [right, -1] }[e.code];
      const p = this.camera.position;
      if (move) { p.x += move[0][0] * move[1] * step; p.z += move[0][1] * move[1] * step; }
      else if (e.code === 'KeyE') p.y += step;
      else if (e.code === 'KeyQ') p.y -= step;
      else return;
      e.preventDefault();
      this.photo.render();
    });
  }

  _pose() {
    const c = this.camera, r = c.rotation;
    return { foto: this.current?.foto, x: c.position.x, y: c.position.y, z: c.position.z, yaw: r.y, pitch: r.x, fov: this.photoFov };
  }

  async save() {
    if (!this.current?.foto) { this._status('Speichern geht nur für Fotos aus der Liste (nicht von der Festplatte). „Ansicht kopieren“ geht immer.'); return; }
    try {
      const res = await fetch('/vergleich/ansicht', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this._pose()) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fehler);
      this.views.set(this.current.foto, { ...this._pose() });
      const sel = this.ui.file.selectedOptions[0];
      if (sel && !sel.textContent.startsWith('✓')) sel.textContent = '✓ ' + sel.textContent;
      this._status(`Ansicht gespeichert (${data.anzahl} insgesamt) in verification/vergleich/ansichten.json.`);
    } catch (error) {
      this._status(`Nicht gespeichert: ${error.message || 'lokaler Server nicht erreichbar'}.`);
    }
  }

  async copy() {
    const p = this._pose(), r = (v) => Math.round(v * 1000) / 1000;
    const text = JSON.stringify({ foto: p.foto ?? this.current?.name ?? null, x: r(p.x), y: r(p.y), z: r(p.z), yaw: r(p.yaw), pitch: r(p.pitch), fov: r(p.fov) });
    try { await navigator.clipboard.writeText(text); this._status('Ansicht kopiert: ' + text); }
    catch { this._status(text); }
  }

  _status(text) { this.ui.status.textContent = text; }
}
