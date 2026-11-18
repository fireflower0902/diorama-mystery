/* 컨셉 시안: 같은 5층 연구실 배치를 스타일별로 렌더링한다. ?s=a(디오라마) | b(셀셰이딩 누아르) | c(복셀) */
(() => {
  const style = (new URLSearchParams(location.search).get('s') || 'b').toLowerCase();
  const W = innerWidth, H = innerHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H); renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.getElementById('view').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const root = new THREE.Group(); scene.add(root);

  function tex(lines, o = {}) {
    const w = o.w || 512, h = o.h || 256, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = o.bg || '#fff'; g.fillRect(0, 0, w, h); if (o.draw) o.draw(g, w, h);
    let y = o.pad || 18; g.textBaseline = 'top';
    lines.forEach(([t, s = 28, col]) => { g.font = `700 ${s}px -apple-system,"Apple SD Gothic Neo",sans-serif`; g.fillStyle = col || o.fg || '#222'; g.fillText(t, o.pad || 18, y); y += s * 1.35; });
    const t = new THREE.CanvasTexture(c); if (o.pixel) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; } return t;
  }

  /* ───────── 스타일 정의 ───────── */
  const toonGrad = (() => { const d = new Uint8Array([28, 28, 28, 255, 120, 120, 120, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();

  const STYLES = {
    a: { // 미니어처 디오라마
      pal: { floor: 0xe2cfae, wall: 0xf0dfc6, wall2: 0xe6d0b4, desk: 0xd99a6c, leg: 0x8b6a55, metal: 0xbfc8d6, dark: 0x4a5568, bench: 0x7fa6b8, shelf: 0xb07d5a, plant: 0x7cbf86, pot: 0xd27d5c, chair: 0x6f8fb3, base: 0x8b5e3c, coatMe: 0xf2c9a0, coatTaeo: 0x56627a, hair: 0x3b2a22, skin: 0xffd9bd, pants: 0x5a6378, glass: 0xbfe6f2, accent: 0xff8a65 },
      mat: c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true }),
      camera: () => { const cam = new THREE.PerspectiveCamera(22, W / H, 0.1, 200); cam.position.set(14, 26, 30); cam.lookAt(0, 0.2, -0.6); return cam; },
      lights() { scene.background = new THREE.Color(0xf6efe4); scene.add(new THREE.HemisphereLight(0xfff4e6, 0xb8a48e, 0.6)); const l = new THREE.DirectionalLight(0xffe2c4, 1.05); l.position.set(8, 16, 10); shadow(l); scene.add(l); },
      base: true, wallH: 2.4, people: 'chibi',
    },
    b: { // 셀셰이딩 누아르
      pal: { floor: 0x23273a, wall: 0x2c3148, wall2: 0x262a40, desk: 0x6a4a5a, leg: 0x1d2030, metal: 0x7d8aa8, dark: 0x14161f, bench: 0x24304a, shelf: 0x4b3b4f, plant: 0x2f8f7a, pot: 0x7a3b45, chair: 0x1d2030, coatMe: 0xd9c3a0, coatTaeo: 0x1b1e2b, hair: 0x101018, skin: 0xf2d0b5, pants: 0x262a3a, glass: 0x5fd0e0, accent: 0xff3b4e },
      mat: c => new THREE.MeshToonMaterial({ color: c, gradientMap: toonGrad }),
      camera: () => { const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 200); cam.position.set(1.5, 12.5, 15); cam.lookAt(-0.3, 0.2, -0.8); return cam; },
      lights() { scene.background = new THREE.Color(0x0c0e16); scene.add(new THREE.HemisphereLight(0x6a70a8, 0x0a0b12, 0.35)); const k = new THREE.DirectionalLight(0xffd7a8, 1.7); k.position.set(-6, 12, 6); shadow(k); scene.add(k); const rim = new THREE.PointLight(0x37d3ff, 1.3, 14); rim.position.set(6, 3, 1); scene.add(rim); const red = new THREE.PointLight(0xff3b4e, 0.9, 6); red.position.set(-3.6, 1.6, -2.6); scene.add(red); },
      outline: 0x07080c, wallH: 3, people: 'anime',
    },
    c: { // 복셀
      pal: { floor: 0x3d4250, wall: 0x59607a, wall2: 0x4c5269, desk: 0x8a6a4f, leg: 0x3a3a44, metal: 0x9aa6b8, dark: 0x1b1d26, bench: 0x2f4a5c, shelf: 0x6b4a36, plant: 0x3fae5f, pot: 0xa65a3a, chair: 0x2a2e3a, coatMe: 0xd8c09a, coatTaeo: 0x262a36, hair: 0x1a1a22, skin: 0xf0c8a8, pants: 0x34394a, glass: 0x9fe8ff, accent: 0xff4fa3 },
      mat: c => new THREE.MeshLambertMaterial({ color: c }),
      camera: () => { const cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 200); cam.position.set(9, 13, 13); cam.lookAt(-0.6, 0.3, -1); return cam; },
      lights() { scene.background = new THREE.Color(0x07080d); scene.add(new THREE.HemisphereLight(0x6b78b8, 0x0b0c12, 0.5)); const moon = new THREE.DirectionalLight(0x9fb4ff, 0.45); moon.position.set(10, 14, 4); shadow(moon); scene.add(moon);
        [[0xff4fa3, 6.6, 2, -0.5, 1.6], [0x4fe3ff, -3.6, 1.5, -3.2, 1.3], [0xffd27a, 1.3, 2.4, -3.2, 0.9]].forEach(([c, x, y, z, i]) => { const p = new THREE.PointLight(c, i, 9); p.position.set(x, y, z); scene.add(p); }); },
      voxel: 0.25, wallH: 3, people: 'voxel',
    },
  };
  const S = STYLES[style] || STYLES.b, P = S.pal;
  function shadow(l) { l.castShadow = true; l.shadow.mapSize.set(2048, 2048); Object.assign(l.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 }); l.shadow.bias = -0.0015; l.shadow.normalBias = 0.03; }

  /* ───────── 상자 (스타일별) ───────── */
  function B(w, h, d, x, y, z, key, o = {}) {
    const color = typeof key === 'number' ? key : P[key];
    if (S.voxel && !o.smooth) return voxBox(w, h, d, x, y, z, color);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), o.mat || S.mat(color));
    m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; root.add(m);
    if (S.outline && !o.noLine) outline(m, w, h, d);
    return m;
  }
  function outline(m, w, h, d, t = 0.045) {
    const o = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: S.outline, side: THREE.BackSide }));
    o.scale.set((w + t) / w, (h + t) / h, (d + t) / d); m.add(o);
  }
  function voxBox(w, h, d, x, y, z, color) {
    const s = S.voxel, nx = Math.max(1, Math.round(w / s)), ny = Math.max(1, Math.round(h / s)), nz = Math.max(1, Math.round(d / s));
    const geo = new THREE.BoxGeometry(w / nx * 0.98, h / ny * 0.98, d / nz * 0.98);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), nx * ny * nz);
    const m4 = new THREE.Matrix4(), col = new THREE.Color(); let i = 0;
    for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) for (let c = 0; c < nz; c++) {
      m4.makeTranslation(x - w / 2 + (a + 0.5) * w / nx, y + (b + 0.5) * h / ny, z - d / 2 + (c + 0.5) * d / nz); mesh.setMatrixAt(i, m4);
      col.setHex(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06); mesh.setColorAt(i++, col);
    }
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
  }
  function C(r1, r2, h, x, y, z, key, o = {}) {
    if (S.voxel) return voxBox(r1 * 2, h, r1 * 2, x, y, z, typeof key === 'number' ? key : P[key]);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, S.outline ? 10 : 14), o.mat || S.mat(typeof key === 'number' ? key : P[key]));
    m.position.set(x, y + h / 2, z); m.castShadow = true; root.add(m);
    if (S.outline && !o.noLine) { const ol = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: S.outline, side: THREE.BackSide })); ol.scale.setScalar(1.08); m.add(ol); }
    return m;
  }
  function plane(w, h, t, x, y, z, ry = 0, glow = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, emissive: glow ? 0xffffff : 0, emissiveMap: glow ? t : null, emissiveIntensity: glow, roughness: 0.9 }));
    m.position.set(x, y, z); m.rotation.y = ry; root.add(m); return m;
  }

  /* ───────── 사람 (스타일별) ───────── */
  function person(kind, x, z, ry) {
    const coat = kind === 'me' ? P.coatMe : P.coatTaeo, g = new THREE.Group(), sx = root;
    const put = (fn) => { const before = root.children.length; fn(); const added = root.children.splice(before); added.forEach(a => g.add(a)); };
    if (S.people === 'chibi') put(() => {
      C(0.1, 0.1, 0.35, -0.11, 0, 0, P.pants); C(0.1, 0.1, 0.35, 0.11, 0, 0, P.pants);
      C(0.26, 0.32, 0.55, 0, 0.32, 0, coat);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), S.mat(P.skin)); head.position.y = 1.3; head.castShadow = true; root.add(head);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), S.mat(P.hair)); hair.position.y = 1.36; hair.rotation.x = -0.3; root.add(hair);
      if (kind === 'me') B(0.6, 0.45, 0.16, 0, 0.95, -0.24, P.hair);
      [-0.15, 0.15].forEach(ex => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0x222222 })); e.position.set(ex, 1.3, 0.39); root.add(e); });
      [-0.24, 0.24].forEach(ex => { const e = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), new THREE.MeshBasicMaterial({ color: 0xff9e9e, transparent: true, opacity: 0.6 })); e.position.set(ex, 1.2, 0.4); root.add(e); });
    });
    else if (S.people === 'anime') put(() => {
      B(0.16, 0.95, 0.18, -0.11, 0, 0, P.pants); B(0.16, 0.95, 0.18, 0.11, 0, 0, P.pants);
      B(0.18, 0.08, 0.3, -0.11, 0, 0.05, 0x111111); B(0.18, 0.08, 0.3, 0.11, 0, 0.05, 0x111111);
      if (kind === 'me') { C(0.28, 0.42, 1.0, 0, 0.55, 0, coat); B(0.5, 0.1, 0.36, 0, 1.47, 0, 0x7a2e2e); }
      else { B(0.6, 0.72, 0.34, 0, 0.88, 0, coat); B(0.22, 0.12, 0.05, 0, 1.45, 0.17, 0xe8e8e8); }
      B(0.13, 0.66, 0.15, -0.38, 0.9, 0, coat); B(0.13, 0.66, 0.15, 0.38, 0.9, 0, coat);
      C(0.07, 0.07, 0.12, 0, 1.58, 0, P.skin, { noLine: true });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 16), S.mat(P.skin)); head.scale.set(0.95, 1.08, 0.95); head.position.y = 1.86; head.castShadow = true; root.add(head);
      const ol = new THREE.Mesh(head.geometry, new THREE.MeshBasicMaterial({ color: S.outline, side: THREE.BackSide })); ol.scale.setScalar(1.08); head.add(ol);
      const hairM = S.mat(P.hair);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM); cap.position.y = 1.9; cap.rotation.x = -0.2; root.add(cap);
      const spikes = kind === 'me' ? [[-0.12, 1.85, 0.16, 0.3], [0.12, 1.85, 0.16, -0.3], [0, 1.9, 0.18, 0]] : [[-0.1, 2.08, 0.05, 0.5], [0.08, 2.1, 0.08, -0.4], [0, 2.12, -0.05, 0.1], [0.16, 2.0, 0.1, -0.9]];
      spikes.forEach(([sx2, sy, sz, rz]) => { const s = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 5), hairM); s.position.set(sx2, sy, sz); s.rotation.set(kind === 'me' ? 2.6 : 0, 0, rz); root.add(s); });
      if (kind === 'me') { B(0.44, 0.55, 0.14, 0, 1.3, -0.16, P.hair); }
      [-0.075, 0.075].forEach(ex => { const e = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.09), new THREE.MeshBasicMaterial({ color: 0x15131c })); e.position.set(ex, 1.86, 0.2); root.add(e); const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.025), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(ex + 0.012, 1.89, 0.201); root.add(hl); });
    });
    else put(() => {
      B(0.25, 0.75, 0.25, -0.13, 0, 0, P.pants); B(0.25, 0.75, 0.25, 0.13, 0, 0, P.pants);
      B(0.5, kind === 'me' ? 0.9 : 0.75, 0.3, 0, kind === 'me' ? 0.5 : 0.75, 0, coat);
      B(0.25, 0.6, 0.25, -0.38, 0.85, 0, coat); B(0.25, 0.6, 0.25, 0.38, 0.85, 0, coat);
      B(0.5, 0.5, 0.5, 0, 1.5, 0, P.skin); B(0.5, 0.25, 0.5, 0, 1.85, 0, P.hair); if (kind === 'me') B(0.5, 0.5, 0.12, 0, 1.4, -0.25, P.hair);
      const face = tex([], { w: 16, h: 16, pixel: true, bg: '#f0c8a8', draw: (g) => { g.fillStyle = '#1a1a22'; g.fillRect(4, 7, 2, 3); g.fillRect(10, 7, 2, 3); g.fillStyle = '#c86a6a'; g.fillRect(7, 12, 3, 1); } });
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.49, 0.49), new THREE.MeshLambertMaterial({ map: face })); f.position.set(0, 1.75, 0.255); root.add(f);
    });
    g.position.set(x, 0, z); g.rotation.y = ry; sx.add(g); return g;
  }

  /* ───────── 방 (공통 배치) ───────── */
  if (style !== 'a') renderer.outputEncoding = THREE.LinearEncoding;
  S.lights();
  const camera = S.camera();
  const WH = S.wallH;
  if (S.base) { B(15, 0.8, 11, 0, -0.88, 0, 'base'); }
  B(14, 0.06, 10, 0, -0.06, 0, 'floor', { noLine: true });
  if (style === 'b') for (let i = -6; i <= 6; i += 2) B(0.03, 0.005, 10, i, 0, 0, 0x24283a, { noLine: true });
  B(14, WH, 0.25, 0, 0, -5.12, 'wall'); B(0.25, WH, 10, -7.12, 0, 0, 'wall2'); B(0.25, WH, 10, 7.12, 0, 0, 'wall2');
  // 창문
  const win = tex([], { w: 256, h: 192, pixel: !!S.voxel, draw: (c, w, h) => {
    const night = style !== 'a'; const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, night ? '#1b2a4a' : '#bfe2f2'); gr.addColorStop(1, night ? '#3a1d4a' : '#e8f4f8'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    if (night) { for (let i = 0; i < 18; i++) { c.fillStyle = ['#ffd27a', '#ff4fa3', '#4fe3ff'][i % 3]; c.fillRect(Math.random() * w, 100 + Math.random() * 80, 6, 10); } c.strokeStyle = 'rgba(200,220,255,.35)'; for (let i = 0; i < 40; i++) { const x = Math.random() * w, y = Math.random() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 12); c.stroke(); } }
    c.fillStyle = night ? '#0d1018' : '#ffffff'; c.fillRect(w / 2 - 3, 0, 6, h); c.fillRect(0, h / 2 - 3, w, 6); } });
  plane(4, Math.min(1.8, WH - 0.6), win, 6.98, WH / 2 + 0.25, -0.5, -Math.PI / 2, style === 'a' ? 0.4 : 0.8);
  // 서윤 책상
  B(2.6, 0.08, 1.1, -3.5, 0.72, -3.85, 'desk'); B(0.08, 0.72, 1.0, -4.75, 0, -3.85, 'leg'); B(0.7, 0.66, 1.0, -2.55, 0.03, -3.85, 'metal');
  const drawerKey = style === 'b' ? 'accent' : 'metal'; B(0.62, 0.2, 0.06, -2.55, 0.42, -3.33, drawerKey);
  B(0.5, 0.06, 0.5, -3.3, 0.46, -2.85, 'chair'); B(0.5, 0.55, 0.06, -3.3, 0.5, -2.6, 'chair'); C(0.04, 0.04, 0.46, -3.3, 0, -2.85, 'chair');
  const scr = tex([['🔒 한서윤', 30, '#fff'], ['암호를 입력하세요', 20, '#dfe8f2']], { bg: style === 'b' ? '#1d6f8a' : style === 'c' ? '#2a2a6a' : '#7fa8d8', w: 256, h: 160, pad: 40, pixel: !!S.voxel });
  B(0.62, 0.03, 0.42, -3.6, 0.8, -3.85, 'metal', { smooth: true });
  const ls = plane(0.6, 0.38, scr, -3.6, 1.03, -4.08, 0, 1.0); ls.rotation.x = -0.18;
  const photo = tex([], { w: 128, h: 100, draw: (c) => { c.fillStyle = '#e8dccb'; c.fillRect(0, 0, 128, 100); c.fillStyle = '#9cc4e4'; c.fillRect(20, 40, 30, 60); c.fillStyle = '#c9a27a'; c.fillRect(70, 45, 30, 55); c.fillStyle = '#8a8a8a'; c.fillRect(45, 75, 30, 20); } });
  B(0.3, 0.24, 0.04, -2.75, 0.8, -4.2, 'leg', { smooth: true }); plane(0.25, 0.19, photo, -2.75, 0.92, -4.17);
  // 강태오 책상
  B(2.4, 0.08, 1.1, 1.3, 0.72, -3.85, 'desk'); B(0.08, 0.72, 1.0, 0.15, 0, -3.85, 'leg'); B(0.08, 0.72, 1.0, 2.45, 0, -3.85, 'leg');
  B(0.9, 0.55, 0.06, 1.3, 0.98, -4.1, 'dark'); B(0.3, 0.3, 0.2, 2.0, 0.8, -3.7, 0xeeeeee);
  // 실험대 + 시료병
  B(1.3, 0.9, 4.2, 4.6, 0, 0.6, 'bench'); B(1.4, 0.06, 4.3, 4.6, 0.9, 0.6, 'dark');
  const glassM = new THREE.MeshStandardMaterial({ color: P.glass, transparent: true, opacity: 0.6, roughness: 0.1, emissive: style === 'a' ? 0 : P.glass, emissiveIntensity: 0.25 });
  for (let i = 0; i < 6; i++) C(0.08, 0.08, 0.28, 4.4 + (i % 2) * 0.35, 0.96, -0.6 + Math.floor(i / 2) * 0.55, 'glass', { mat: glassM, noLine: true });
  // 화이트보드
  const wb = tex([['이번 주 일정', 34, '#1f3b73'], ['11/14(토) 세진 보고서 최종 검토 — 서윤', 24], ['11/15(일) 09:00 세진 제출 마감', 24], ['시료보관실 정리: 교수님 (M-02) ~11/30', 24, '#c02030'], ['※ 시료보관실 혼자 들어가지 말 것!!', 22, '#c02030']], { w: 768, h: 384, bg: '#f7f7f4', pixel: !!S.voxel });
  B(3.35, 1.75, 0.06, 4.2, Math.min(0.88, WH - 1.9), -4.97, 'metal', { smooth: true }); plane(3.2, 1.6, wb, 4.2, Math.min(1.75, WH - 1.0), -4.92);
  // 책장
  B(0.5, Math.min(2.0, WH - 0.2), 2.4, -6.7, 0, -4.0, 'shelf');
  const books = [0xc0392b, 0x2c3e50, 0x27ae60, 0xf39c12, 0x8e44ad];
  for (let i = 0; i < 9; i++) B(0.3, 0.32, 0.14, -6.6, 0.15 + Math.floor(i / 3) * 0.6, -4.9 + (i % 3) * 0.7, books[i % 5], { noLine: true });
  // 화분
  C(0.25, 0.2, 0.45, 6.3, 0, 4.2, 'pot');
  if (S.voxel) voxBox(0.9, 0.8, 0.9, 6.3, 0.45, 4.2, P.plant); else { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), S.mat(P.plant)); p.position.set(6.3, 0.85, 4.2); p.castShadow = true; root.add(p); if (S.outline) outline(p, 1, 1, 1, 0.08); }
  // 엘리베이터
  B(0.12, Math.min(2.5, WH - 0.1), 1.7, -6.95, 0, -1.8, 'metal'); B(0.06, Math.min(2.2, WH - 0.3), 1.4, -6.87, 0, -1.8, 'metal');
  // 방 이름
  plane(1.6, 0.4, tex([['501  수질연구실', 40, '#fff']], { bg: style === 'b' ? '#ff3b4e' : style === 'c' ? '#7a2a8a' : '#4f8f6a', w: 512, h: 128, pad: 40, pixel: !!S.voxel }), -1, WH - 0.35, -4.98, 0, style === 'a' ? 0 : 0.6);
  // 인물
  person('me', -4.4, -1.6, 0.5);
  person('taeo', 0.2, -1.6, -0.5);
  // 단서 표시(누아르: 붉은 강조)
  if (style === 'b') { const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 32), new THREE.MeshBasicMaterial({ color: 0xff3b4e })); ring.rotation.x = -Math.PI / 2; ring.position.set(-3.6, 0.02, -2.9); root.add(ring); }

  renderer.render(scene, camera);
  document.body.dataset.ready = '1';
})();
