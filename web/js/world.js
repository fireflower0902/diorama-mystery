/* 3D 공간: 방, 캐릭터 이동, 사물 클릭. (Three.js r149, 전역 THREE)
 * app.js와는 콜백으로만 이야기한다: onInteract(사물), onRoom(방), isSeen(id), allow(사물) */
window.WORLD = (() => {
  let renderer, scene, camera, clock, raycaster, mouse, root, floorMesh;
  let cb = {}, enabled = false, room = null, hovered = null;
  let player, target = null, pending = null, stuckT = 0, lastDist = 0, walkT = 0;
  const keys = {}, objects = [], colliders = [], markers = [];
  const SPEED = 3.2, R = 0.33;

  /* ───────── 재료 ───────── */
  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.8, metalness: o.m ?? 0, transparent: !!o.t, opacity: o.t ?? 1, emissive: o.e || 0x000000, emissiveIntensity: o.ei ?? 1 });
  function box(w, h, d, color, x, y, z, o = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), o.mat || M(color, o));
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = !o.noShadow; mesh.receiveShadow = true;
    return mesh;
  }
  function cyl(r1, r2, h, color, x, y, z, o = {}) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, o.seg || 16), o.mat || M(color, o));
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; return mesh;
  }
  function textTex(lines, o = {}) {
    const w = o.w || 512, h = o.h || 256, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = o.bg || '#fff'; g.fillRect(0, 0, w, h);
    if (o.draw) o.draw(g, w, h);
    g.fillStyle = o.fg || '#222'; g.textBaseline = 'top';
    let y = o.pad || 18;
    lines.forEach(l => { const [txt, size = o.size || 28, color] = Array.isArray(l) ? l : [l]; g.font = `${o.weight || 600} ${size}px -apple-system, "Apple SD Gothic Neo", sans-serif`; g.fillStyle = color || o.fg || '#222'; g.fillText(txt, o.pad || 18, y); y += size * 1.35; });
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function plane(w, h, tex, x, y, z, ry = 0, o = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: o.glow ? 0xffffff : 0, emissiveMap: o.glow ? tex : null, emissiveIntensity: o.glow || 0 }));
    m.position.set(x, y, z); m.rotation.y = ry; return m;
  }
  function collide(x, z, w, d) { colliders.push({ x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2 }); }

  /* ───────── 사람 ───────── */
  function person(coat, hair, o = {}) {
    const g = new THREE.Group();
    const legM = M(o.pants || 0x2a2d33), skin = M(0xe0c2a2), coatM = M(coat);
    const legL = box(0.16, 0.8, 0.18, 0, -0.11, 0, 0, { mat: legM }), legR = box(0.16, 0.8, 0.18, 0, 0.11, 0, 0, { mat: legM });
    [legL, legR].forEach(l => { l.geometry.translate(0, -0.4, 0); l.position.y = 0.8; });
    const body = cyl(0.27, 0.32, o.long ? 0.95 : 0.7, 0, 0, o.long ? 0.55 : 0.78, 0, { mat: coatM, seg: 12 });
    const armL = box(0.12, 0.62, 0.14, 0, -0.36, 0, 0, { mat: coatM }), armR = box(0.12, 0.62, 0.14, 0, 0.36, 0, 0, { mat: coatM });
    [armL, armR].forEach(a => { a.geometry.translate(0, -0.31, 0); a.position.y = 1.45; });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), skin); head.position.y = 1.72; head.castShadow = true;
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), M(hair)); hairM.position.y = 1.74; hairM.rotation.x = -0.25;
    const back = o.longHair ? box(0.34, 0.32, 0.12, hair, 0, 1.42, -0.1) : null;
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
    g.add(legL, legR, body, armL, armR, head, hairM, shadow); if (back) g.add(back);
    g.userData.limbs = { legL, legR, armL, armR };
    return g;
  }
  const figure = (id) => { const f = CHARS.build(id); f.scale.setScalar(1.5); return f; };
  const npcs = [];
  function animate(p, t, moving) {
    const L = p.userData.limbs, s = moving ? Math.sin(t * 9) * 0.55 : 0;
    L.legL.rotation.x = s; L.legR.rotation.x = -s; L.armL.rotation.x = -s * 0.8; L.armR.rotation.x = s * 0.8;
  }

  /* ───────── 방 ───────── */
  function shell(W, D, o) {
    const g = new THREE.Group();
    floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M(o.floor, { r: 0.6 }));
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.receiveShadow = true; g.add(floorMesh);
    const grid = new THREE.GridHelper(Math.max(W, D), Math.max(W, D) / (o.tile || 1), o.gridC || 0x000000, o.gridC || 0x000000);
    grid.material.transparent = true; grid.material.opacity = 0.08; grid.position.y = 0.005; g.add(grid);
    const wm = M(o.wall, { r: 0.95 });
    g.add(box(W, 3, 0.2, 0, 0, 0, -D / 2 - 0.1, { mat: wm }));
    g.add(box(0.2, 3, D, 0, -W / 2 - 0.1, 0, 0, { mat: wm }));
    g.add(box(0.2, 3, D, 0, W / 2 + 0.1, 0, 0, { mat: wm }));
    g.add(box(W, 0.12, 0.22, o.trim || 0x555a60, 0, 0, -D / 2 + 0.01, { noShadow: true }));
    // 디오라마 받침대 + 명판
    const th = (window.CASE && CASE.theme) || {};
    const base = new THREE.Mesh(CHARS.rbox(W + 1.2, 0.7, D + 1.2, 0.12), M(th.wood || 0xa8744a, { r: 0.75 })); base.position.y = -0.72; base.receiveShadow = true; g.add(base);
    const rim = new THREE.Mesh(CHARS.rbox(W + 0.7, 0.06, D + 0.7, 0.03), M(th.woodDark || 0x7a5233, { r: 0.7 })); rim.position.y = -0.09; g.add(rim);
    if (o.plate) { const pl = plane(3.4, 0.42, textTex([[o.plate, 34, '#3a2a1a']], { bg: '#e8d5b0', w: 768, h: 96, pad: 26 }), 0, -0.38, D / 2 + 0.605); g.add(pl); }
    return g;
  }
  function interact(def, meshes) {
    const grp = new THREE.Group(); meshes.forEach(m => grp.add(m));
    grp.userData.obj = def; def.group = grp; objects.push(def);
    const mk = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), new THREE.MeshBasicMaterial({ color: 0xf0b44c }));
    mk.position.set(def.at[0], def.my || 2.2, def.at[1]); mk.userData.id = def.id; markers.push(mk);
    root.add(grp, mk);
    return grp;
  }
  function elevator(x, z, ry) {
    const doorTex = textTex([['▲ ▼', 34, '#e8e8e8'], ['엘리베이터', 26, '#e8e8e8']], { bg: '#6f767d', w: 256, h: 128, pad: 40 });
    const frameM = box(0.12, 2.5, 1.7, 0x8c939a, x, 0, z);
    const sign = plane(0.9, 0.45, doorTex, x + (ry > 0 ? 0.08 : -0.08), 2.0, z, ry);
    const doors = box(0.06, 2.2, 1.4, 0xa9b0b6, x + (ry > 0 ? 0.07 : -0.07), 0, z, { m: 0.6, r: 0.35 });
    collide(x + (ry > 0 ? 0.3 : -0.3), z, 0.6, 1.7);
    interact({ id: 'elev', name: '엘리베이터', at: [x + (ry > 0 ? 0.9 : -0.9), z], act: 'elevator', my: 2.8 }, [frameM, doors, sign]);
  }

  const ROOMS = {
    lab: { name: '5층 · 수질연구실 501', W: 14, D: 10, spawn: [-5.7, -1.8], build() {
      const g = shell(14, 10, { floor: 0xc9c1b2, wall: 0xd9dcd6, tile: 1, plate: 'CASE 4°C · 도화대 공학2관 5F 수질연구실' }); root.add(g);
      // 창문 (비 오는 오후)
      const winTex = textTex([], { w: 256, h: 256, draw: (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7f8e9c'); gr.addColorStop(1, '#4d5866'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(220,230,240,.35)'; for (let i = 0; i < 70; i++) { const x = Math.random() * w, y = Math.random() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 14); c.stroke(); } c.fillStyle = '#2c333b'; c.fillRect(w / 2 - 4, 0, 8, h); c.fillRect(0, h / 2 - 4, w, 8); } });
      root.add(plane(4, 1.8, winTex, 6.98, 1.7, -0.5, -Math.PI / 2, { glow: 0.35 }));
      // 서윤 책상
      const desk = [box(2.6, 0.06, 1.1, 0xa8937a, -3.5, 0.72, -3.85), box(0.06, 0.72, 1.0, 0x7d7a74, -4.75, 0, -3.85), box(0.7, 0.66, 1.0, 0x8a8f96, -2.55, 0.03, -3.85)];
      collide(-3.5, -3.85, 2.7, 1.2);
      root.add(...desk);
      root.add(box(0.5, 0.06, 0.5, 0x2b2f35, -3.3, 0.46, -2.85), cyl(0.04, 0.04, 0.46, 0x2b2f35, -3.3, 0, -2.85), box(0.5, 0.55, 0.06, 0x2b2f35, -3.3, 0.5, -2.6));
      const scr = textTex([['🔒 한서윤', 30, '#fff'], ['암호를 입력하세요', 20, '#dfe8f2']], { bg: '#6d8bb0', w: 256, h: 160, pad: 40 });
      const lapBase = box(0.62, 0.025, 0.42, 0xb9bcc0, -3.6, 0.78, -3.85, { m: 0.5, r: 0.4 });
      const lapScr = plane(0.6, 0.38, scr, -3.6, 1.0, -4.08, 0, { glow: 0.9 }); lapScr.rotation.x = -0.18;
      const lapBack = box(0.62, 0.4, 0.02, 0xb9bcc0, -3.6, 0.8, -4.1, { m: 0.5 }); lapBack.rotation.x = -0.18;
      interact({ id: 'laptop', name: '서윤의 노트북', at: [-3.6, -3.85], stand: [-3.6, -2.6], act: 'panel', panel: 'laptop', my: 1.6 }, [lapBase, lapBack, lapScr]);
      const photo = textTex([], { w: 256, h: 200, draw: (c, w, h) => { c.fillStyle = '#e8dccb'; c.fillRect(0, 0, w, h); c.fillStyle = '#9cc4e4'; c.fillRect(40, 70, 70, 130); c.fillStyle = '#c9a27a'; c.fillRect(140, 80, 70, 120); c.fillStyle = '#e0c2a2'; c.beginPath(); c.arc(75, 55, 26, 0, 7); c.arc(175, 62, 26, 0, 7); c.fill(); c.fillStyle = '#8a8a8a'; c.beginPath(); c.ellipse(125, 160, 34, 24, 0, 0, 7); c.fill(); } });
      const frameBox = box(0.3, 0.24, 0.04, 0x5b4636, -2.75, 0.78, -4.2); frameBox.rotation.x = -0.15;
      const framePic = plane(0.25, 0.19, photo, -2.75, 0.9, -4.17, 0); framePic.rotation.x = -0.15;
      interact({ id: 'frame', name: '책상 위 사진 액자', at: [-2.75, -4.1], stand: [-2.75, -2.7], act: 'examine', my: 1.4 }, [frameBox, framePic]);
      const drawer = box(0.62, 0.2, 0.06, 0x9aa0a7, -2.55, 0.42, -3.33);
      const handle = box(0.24, 0.03, 0.03, 0x444, -2.55, 0.5, -3.29);
      const diary = box(0.3, 0.05, 0.4, 0x7a2e2e, -2.55, 0.5, -3.5); diary.visible = false;
      const dg = interact({ id: 'drawer', name: '책상 서랍', at: [-2.55, -3.3], stand: [-2.4, -2.5], act: 'drawer', my: 1.0 }, [drawer, handle, diary]);
      dg.userData.diary = diary;
      // 강태오 책상
      root.add(box(2.4, 0.06, 1.1, 0xa8937a, 1.3, 0.72, -3.85), box(0.06, 0.72, 1.0, 0x7d7a74, 0.15, 0, -3.85), box(0.06, 0.72, 1.0, 0x7d7a74, 2.45, 0, -3.85));
      collide(1.3, -3.85, 2.5, 1.2);
      const mon = box(0.9, 0.55, 0.05, 0x1b1d20, 1.3, 0.95, -4.1), monStand = box(0.08, 0.2, 0.08, 0x1b1d20, 1.3, 0.78, -4.1);
      const bag = box(0.3, 0.3, 0.2, 0xeeeeee, 2.0, 0.78, -3.7);
      interact({ id: 'taeodesk', name: '강태오의 자리', at: [1.3, -3.9], stand: [1.3, -2.6], act: 'examine', my: 1.9 }, [mon, monStand, bag]);
      // 실험대
      root.add(box(1.3, 0.9, 4.2, 0x3e4a52, 4.6, 0, 0.6), box(1.4, 0.05, 4.3, 0x1f262b, 4.6, 0.9, 0.6));
      collide(4.6, 0.6, 1.5, 4.4);
      const bottles = [];
      for (let i = 0; i < 6; i++) bottles.push(cyl(0.08, 0.08, 0.28, 0, 4.4 + (i % 2) * 0.35, 0.95, -0.6 + Math.floor(i / 2) * 0.55, { mat: M(0xbfe3f0, { t: 0.55, r: 0.1 }) }));
      bottles.push(cyl(0.12, 0.06, 0.25, 0, 4.7, 0.95, 1.8, { mat: M(0xd6f0d9, { t: 0.6, r: 0.1 }) }));
      interact({ id: 'bench', name: '실험대의 시료병', at: [4.5, 0.2], stand: [3.4, 0.2], act: 'examine', my: 1.6 }, bottles);
      // 화이트보드
      const wb = textTex([['이번 주 일정', 34, '#1f3b73'], ['11/14(토)  세진 보고서 최종 검토 — 서윤', 24], ['11/15(일)  09:00 세진 제출 마감', 24], ['시료보관실 정리: 교수님 (M-02) ~11/30', 24, '#a02020'], ['※ 시료보관실 혼자 들어가지 말 것!! 안에서 안 열림', 22, '#a02020'], ['태오 졸업심사 12/10 🎓', 22, '#2a7a3a']], { w: 768, h: 384, bg: '#f7f7f4' });
      const wbM = plane(3.2, 1.6, wb, 4.2, 1.75, -4.88);
      const wbF = box(3.35, 1.75, 0.06, 0x9aa1a8, 4.2, 0.88, -4.94);
      interact({ id: 'whiteboard', name: '연구실 화이트보드', at: [4.2, -4.6], stand: [3.9, -3.4], act: 'examine', my: 2.9 }, [wbF, wbM]);
      // 책장
      root.add(box(0.5, 2.0, 2.4, 0x6b5a48, -6.7, 0, -4.0));
      for (let i = 0; i < 9; i++) root.add(box(0.3, 0.32, 0.12, [0xa33, 0x335, 0x3a6, 0xca3, 0x557][i % 5], -6.6, 0.15 + Math.floor(i / 3) * 0.6, -4.9 + (i % 3) * 0.7));
      collide(-6.7, -4.0, 0.6, 2.5);
      // 화분, 소파
      root.add(cyl(0.25, 0.2, 0.45, 0x8b5a3c, 6.3, 0, 4.2), new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), M(0x3f7a4a))); root.children[root.children.length - 1].position.set(6.3, 0.85, 4.2);
      collide(6.3, 4.2, 0.6, 0.6);
      elevator(-7, -1.8, Math.PI / 2);
      // 강태오
      const taeo = figure('taeo'); taeo.position.set(0.2, 0, -1.6); taeo.rotation.y = 0.5; npcs.push(taeo);
      collide(0.2, -1.6, 0.6, 0.6);
      interact({ id: 'taeo', name: '강태오 (연구실 선배)', at: [0.2, -1.6], stand: [0.4, -0.5], act: 'examine', my: 1.95, npc: true }, [taeo]);
      // 방 이름
      root.add(plane(1.6, 0.4, textTex([['501  수질연구실', 40, '#fff']], { bg: '#2f4a3a', w: 512, h: 128, pad: 40 }), -1, 2.65, -4.98));
      // 조명
      lights([0xfff3e0, 0.75], [0xbcd3ff, 0.5], { x: 5, y: 9, z: 4 });
    }},

    lobby: { name: '1층 · 로비와 경비실', W: 16, D: 10, spawn: [-7, -1.2], build() {
      const g = shell(16, 10, { floor: 0xa9aeb4, wall: 0xc9cdd2, tile: 2, plate: 'CASE 4°C · 공학2관 1F 로비 · 경비실' }); root.add(g);
      // 정문 유리
      const glass = M(0x9fc3d8, { t: 0.35, r: 0.05, m: 0.2 });
      const fd = [box(1.5, 2.6, 0.08, 0, -0.78, 0, -4.95, { mat: glass }), box(1.5, 2.6, 0.08, 0, 0.78, 0, -4.95, { mat: glass }), box(3.3, 0.15, 0.12, 0x333, 0, 2.6, -4.95)];
      const sign = plane(2.4, 0.42, textTex([['도화대학교 공학2관', 40, '#222']], { bg: '#e9e6df', w: 512, h: 96, pad: 22 }), 0, 3.0 - 0.15, -4.89);
      interact({ id: 'frontdoor', name: '정문', at: [0, -4.8], stand: [0, -3.6], act: 'examine', my: 2.9 }, [...fd, sign]);
      // 경비실 카운터
      root.add(box(4.2, 1.1, 0.8, 0x5b6470, 4.2, 0, -1.2), box(4.3, 0.06, 0.9, 0x2d3238, 4.2, 1.1, -1.2));
      root.add(box(0.15, 3, 3.6, 0x8d9299, 2.05, 0, -3.2));
      collide(4.2, -1.2, 4.3, 0.9); collide(4.4, -3.2, 4.8, 3.4);
      root.add(plane(1.4, 0.4, textTex([['경 비 실', 46, '#fff']], { bg: '#3a4552', w: 384, h: 96, pad: 20 }), 4.2, 2.7, -1.15));
      // CCTV 모니터 벽
      const cc = textTex([], { w: 512, h: 256, draw: (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) { const x = (i % 2) * w / 2 + 6, y = Math.floor(i / 2) * h / 2 + 6; c.fillStyle = ['#4b5a52', '#56605a', '#3d4a52', '#5a5650'][i]; c.fillRect(x, y, w / 2 - 12, h / 2 - 12); c.fillStyle = '#d6f5d6'; c.font = '16px monospace'; c.fillText('CAM 0' + (i + 1), x + 8, y + 22); } } });
      const ccScr = plane(2.6, 1.3, cc, 4.6, 1.85, -4.88, 0, { glow: 0.7 });
      const ccBox = box(2.8, 1.5, 0.1, 0x111, 4.6, 1.1, -4.95);
      interact({ id: 'cctv', name: 'CCTV 모니터', at: [4.6, -4.5], stand: [3.4, -0.3], act: 'panel', panel: 'cctv', gate: 'records', my: 2.9, reach: 5.5 }, [ccBox, ccScr]);
      // 출입 단말
      const term = box(0.55, 0.38, 0.05, 0x1d2126, 2.9, 1.25, -1.35), termS = plane(0.5, 0.32, textTex([['출입·주차', 30, '#9fe0b0'], ['관제 시스템', 30, '#9fe0b0']], { bg: '#0f1a14', w: 256, h: 160, pad: 30 }), 2.9, 1.44, -1.32, 0, { glow: 0.8 });
      interact({ id: 'terminal', name: '출입·주차 관제 단말', at: [2.9, -1.3], stand: [2.9, -0.2], act: 'panel', panel: 'records', gate: 'records', my: 2.1 }, [term, termS]);
      // 경비원
      const guard = figure('guard'); guard.position.set(5.2, 0, -2.3); npcs.push(guard);
      interact({ id: 'guard', name: '경비원', at: [5.2, -2.3], stand: [5.0, -0.2], act: 'examine', my: 2.0, npc: true, reach: 3.5 }, [guard]);
      // 후문
      const bd = box(0.1, 2.3, 1.2, 0x3a4a3f, 7.95, 0, 2.6), bs = plane(0.9, 0.25, textTex([['EXIT  후문', 40, '#eaffef']], { bg: '#2f8f4e', w: 384, h: 96, pad: 22 }), 7.88, 2.55, 2.6, -Math.PI / 2, { glow: 0.6 });
      const reader = box(0.05, 0.18, 0.12, 0x111, 7.92, 1.2, 1.7);
      interact({ id: 'backdoor', name: '후문', at: [7.8, 2.6], stand: [6.8, 2.6], act: 'examine', my: 2.8 }, [bd, bs, reader]);
      // 의자, 화분
      root.add(box(2.2, 0.45, 0.6, 0x3f4650, -3.5, 0, 3.6), box(2.2, 0.5, 0.12, 0x3f4650, -3.5, 0.45, 3.9)); collide(-3.5, 3.7, 2.3, 0.8);
      root.add(cyl(0.3, 0.25, 0.5, 0x8b5a3c, -7.2, 0, 4.2)); collide(-7.2, 4.2, 0.6, 0.6);
      elevator(-8, -1.2, Math.PI / 2);
      lights([0xffffff, 0.7], [0xcfe0ff, 0.45], { x: -4, y: 9, z: 5 });
    }},

    b1: { name: '지하 1층 · 복도', W: 16, D: 7, spawn: [-7, 0.5], dark: true, build() {
      const g = shell(16, 7, { floor: 0x7a7f86, wall: 0x9aa1a8, tile: 1, trim: 0x2f3337, plate: 'CASE 4°C · 공학2관 B1 복도' }); root.add(g);
      // 배관
      for (let i = 0; i < 2; i++) { const p = cyl(0.06, 0.06, 16, 0x8b8f93, 0, 0, -3.35); p.rotation.z = Math.PI / 2; p.position.y = 2.86 + i * 0.1; root.add(p); }
      // 시료보관실
      const door = box(1.6, 2.3, 0.14, 0x7f97aa, -2, 0, -3.42, { m: 0.15, r: 0.6 });
      const frost = plane(1.5, 0.6, textTex([], { w: 256, h: 96, draw: (c, w, h) => { const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); } }), -2, 0.32, -3.34);
      frost.material.transparent = true; frost.material.opacity = 0.7;
      const csign = plane(1.6, 0.5, textTex([['저온 시료보관실  4°C', 34, '#fff'], ['마스터카드 전용', 22, '#cfe6ff']], { bg: '#1f4f7a', w: 512, h: 150, pad: 24 }), -2, 2.55, -3.39);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.03), new THREE.MeshBasicMaterial({ color: 0xff3030 })); led.position.set(-0.9, 1.35, -3.32);
      const rd = box(0.12, 0.2, 0.05, 0x111, -0.9, 1.15, -3.36);
      interact({ id: 'colddoor', name: '저온 시료보관실 문', at: [-2, -3.3], stand: [-2, -2.2], act: 'examine', my: 3.0 }, [door, frost, csign, rd, led]);
      const cold = new THREE.PointLight(0x7fc4ff, 0.6, 4); cold.position.set(-2, 1.2, -1.6); root.add(cold);
      // 기계실
      const md = box(1.2, 2.2, 0.1, 0x5a5f64, 4, 0, -3.42), ms = plane(1, 0.3, textTex([['기계실', 40, '#fff']], { bg: '#444', w: 256, h: 80, pad: 18 }), 4, 2.5, -3.36);
      interact({ id: 'machine', name: '기계실', at: [4, -3.3], stand: [4, -2.2], act: 'examine', my: 2.8 }, [md, ms]);
      // 주차장 연결문
      const pd = box(0.1, 2.3, 1.4, 0x6f6a5c, 7.95, 0, 1), ps = plane(1.1, 0.3, textTex([['P  주차장 연결문', 36, '#222']], { bg: '#f2c94c', w: 384, h: 96, pad: 22 }), 7.88, 2.5, 1, -Math.PI / 2);
      interact({ id: 'parkdoor', name: '주차장 연결문', at: [7.8, 1], stand: [6.8, 1], act: 'examine', my: 2.8 }, [pd, ps]);
      elevator(-8, 0.5, Math.PI / 2);
      lights([0xc8d4e0, 0.28], [0x8fa0b5, 0.25], { x: 0, y: 7, z: 4, i: 0.35 });
      const flick = new THREE.PointLight(0xfff1d0, 0.9, 7); flick.position.set(3, 2.6, 0); root.add(flick); flick.userData.flicker = true;
    }},

    studio: { name: '빌라 3층 301호', W: 10, D: 8, spawn: [-3.2, 1.6], build() {
      const g = shell(10, 8, { floor: 0xc4a07a, wall: 0xeee6da, tile: 1, gridC: 0x6b4a2a, plate: 'CASE 모찌 · 해든빌라 3층 301호' }); root.add(g);
      const R = (w, h, d, c, x, y, z, r = 0.06) => { const m = new THREE.Mesh(CHARS.rbox(w, h, d, r), M(c, { r: 0.85 })); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
      // 러그
      const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), M(0xe7c9a9, { r: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(-0.6, 0.012, 0.6); rug.receiveShadow = true; root.add(rug);
      // 현관 (왼쪽 벽): 문 + 도어락 + 안내문 + 매트
      const door = box(0.1, 2.3, 1.3, 0x7d6a58, -4.95, 0, 2.4);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), M(0xd8c07a, { m: 0.6, r: 0.3 })); knob.position.set(-4.88, 1.05, 1.9);
      root.add(door, knob); collide(-4.75, 2.4, 0.4, 1.4);
      const lockPanel = box(0.06, 0.32, 0.18, 0x1d2127, -4.88, 1.15, 2.9), lockScr = plane(0.12, 0.2, textTex([['🔐', 60, '#9fe0b0']], { bg: '#0f1a14', w: 64, h: 112, pad: 18 }), -4.84, 1.33, 2.9, Math.PI / 2, { glow: 0.8 });
      interact({ id: 'doorlock', name: '스마트 도어락', at: [-4.8, 2.9], stand: [-3.9, 2.7], act: 'panel', panel: 'records', my: 2.0 }, [lockPanel, lockScr]);
      const paper = plane(0.42, 0.56, textTex([['관리실 안내', 30, '#7a2e2e'], ['11/20(금) 10~12시', 22], ['세대별 누수 점검', 22], ['부재 세대는', 20], ['마스터 비번 출입', 20]], { bg: '#fffdf4', w: 256, h: 340, pad: 18 }), -4.88, 1.5, 2.35, Math.PI / 2);
      interact({ id: 'notice', name: '현관문 안내문', at: [-4.8, 2.35], stand: [-3.9, 2.2], act: 'examine', my: 2.15 }, [paper]);
      const mat = box(0.9, 0.03, 1.2, 0x8a7a6a, -4.3, 0, 2.4, { noShadow: true });
      interact({ id: 'mat', name: '현관 매트', at: [-4.3, 2.4], stand: [-3.6, 2.4], act: 'examine', my: 0.9 }, [mat]);
      root.add(R(0.5, 0.9, 1.2, 0xd9cbb8, -4.65, 0, 3.55)); collide(-4.65, 3.55, 0.6, 1.3);   // 신발장
      // 302호 할머니 (현관문 앞에 서 있음)
      const gm = figure('grandma'); gm.position.set(-3.9, 0, 3.5); gm.rotation.y = 1.2; npcs.push(gm); collide(-3.9, 3.5, 0.5, 0.5);
      interact({ id: 'grandma', name: '302호 할머니', at: [-3.9, 3.5], stand: [-2.9, 3.0], act: 'examine', my: 2.0, npc: true }, [gm]);
      // 주방 (뒤쪽 왼쪽)
      root.add(R(2.6, 0.9, 0.7, 0xf4f1ec, -3.2, 0, -3.55), R(2.7, 0.06, 0.75, 0xbfb6aa, -3.2, 0.9, -3.55, 0.02), R(0.8, 1.9, 0.7, 0xe6e8ea, -4.45, 0, -3.55));
      root.add(R(0.5, 0.06, 0.4, 0x9aa3ab, -3.0, 0.92, -3.55, 0.02)); collide(-3.5, -3.55, 3.2, 0.9);
      // 밥그릇·물그릇
      const bowl1 = cyl(0.16, 0.12, 0.09, 0xf2a07b, -2.2, 0, -2.4), bowl2 = cyl(0.16, 0.12, 0.09, 0x8fbbe0, -1.75, 0, -2.4);
      const kib = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0x9a6a3a)); kib.position.set(-2.2, 0.07, -2.4);
      interact({ id: 'bowl', name: '모찌 밥그릇', at: [-2.0, -2.4], stand: [-2.0, -1.5], act: 'examine', my: 0.9 }, [bowl1, bowl2, kib]);
      // 식탁 + 쪽지
      root.add(R(1.3, 0.06, 0.9, 0xc89a6c, -0.6, 0.7, -0.4, 0.03)); [[-1.15, -0.75], [-0.05, -0.75], [-1.15, -0.05], [-0.05, -0.05]].forEach(([x, z]) => root.add(cyl(0.035, 0.035, 0.7, 0x8a6a4a, x, 0, z)));
      root.add(R(0.42, 0.45, 0.42, 0xf2c94c, -0.6, 0, 0.35)); collide(-0.6, -0.4, 1.4, 1.0);
      const note = plane(0.3, 0.22, textTex([['모찌 밥 줬어!', 28, '#7a2e2e'], ['문 꼭 잠그고 감', 24], ['- 서아 ♡', 24]], { bg: '#fff3a8', w: 256, h: 190, pad: 16 }), -0.5, 0.775, -0.35); note.rotation.x = -Math.PI / 2; note.rotation.z = 0.2;
      interact({ id: 'note', name: '식탁 위 쪽지', at: [-0.5, -0.35], stand: [-0.5, 0.75], act: 'examine', my: 1.4 }, [note]);
      // 캣타워
      const ct = [cyl(0.08, 0.08, 1.8, 0xd8c3a5, 3.9, 0, -3.3), R(0.9, 0.08, 0.7, 0xb08a6a, 3.9, 0.55, -3.3), R(0.8, 0.08, 0.6, 0xb08a6a, 3.9, 1.1, -3.3), R(0.7, 0.3, 0.6, 0xe8d8c4, 3.9, 1.8, -3.3, 0.12), R(1.0, 0.08, 0.8, 0xb08a6a, 3.9, 0, -3.3)];
      collide(3.9, -3.3, 1.0, 0.8);
      interact({ id: 'cattower', name: '캣타워', at: [3.9, -3.2], stand: [3.6, -2.2], act: 'examine', my: 2.5 }, ct);
      // 침대
      const bed = [R(2.0, 0.42, 2.6, 0x8b6a4e, 3.85, 0, 1.6), R(1.9, 0.22, 2.5, 0xf4efe8, 3.85, 0.42, 1.6, 0.1), R(1.85, 0.14, 1.6, 0x9fb7c9, 3.85, 0.6, 2.0, 0.07), R(0.8, 0.16, 0.45, 0xffffff, 3.85, 0.62, 0.55, 0.08), R(0.7, 0.4, 0.45, 0x3d4652, 3.4, 0.64, 1.6, 0.08)];
      collide(3.85, 1.6, 2.1, 2.7);
      interact({ id: 'bed', name: '침대', at: [3.6, 1.6], stand: [2.4, 1.6], act: 'examine', my: 1.4 }, bed);
      // 창문 (오른쪽 벽)
      const winTex = textTex([], { w: 256, h: 256, draw: (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1b2840'); gr.addColorStop(1, '#3b3050'); c.fillStyle = gr; c.fillRect(0, 0, w, h); for (let i = 0; i < 22; i++) { c.fillStyle = ['#ffd27a', '#ffe9b0', '#a8d0ff'][i % 3]; c.fillRect(Math.random() * w, 120 + Math.random() * 120, 7, 10); } c.fillStyle = '#e8e2d8'; c.fillRect(w / 2 - 4, 0, 8, h); c.fillRect(0, h / 2 - 4, w, 8); } });
      const win = plane(2.0, 1.4, winTex, 4.98, 1.6, -1.0, -Math.PI / 2, { glow: 0.5 });
      interact({ id: 'window', name: '창문', at: [4.9, -1.0], stand: [4.0, -1.0], act: 'examine', my: 2.6 }, [win]);
      // 선반 위 펫캠
      root.add(R(1.6, 0.06, 0.35, 0xb08a6a, 0.9, 1.5, -3.8, 0.02));
      const cam = [cyl(0.1, 0.12, 0.06, 0xf4f4f4, 0.9, 1.56, -3.75), new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), M(0xf4f4f4, { r: 0.4 })), new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), M(0x111111, { r: 0.2 }))];
      cam[1].position.set(0.9, 1.72, -3.75); cam[2].position.set(0.9, 1.72, -3.645);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.015), new THREE.MeshBasicMaterial({ color: 0x3fd47a })); led.position.set(0.96, 1.66, -3.66); cam.push(led);
      root.add(plane(0.5, 0.18, textTex([['모찌캠', 40, '#3b2a1a']], { bg: '#f4ead8', w: 256, h: 92, pad: 22 }), 0.4, 1.62, -3.62));
      interact({ id: 'petcam', name: '모찌캠 (펫캠)', at: [0.9, -3.6], stand: [0.9, -2.6], act: 'panel', panel: 'cctv', my: 2.15 }, cam);
      // 책상 스탠드 조명 + 소품
      root.add(R(1.2, 0.75, 0.6, 0xe9e2d6, 1.9, 0, -3.6)); collide(1.9, -3.6, 1.3, 0.7);
      const lamp = new THREE.PointLight(0xffc98a, 0.9, 7); lamp.position.set(1.9, 1.6, -3.2); root.add(lamp);
      root.add(R(0.3, 0.45, 0.3, 0xffe0b0, 2.2, 0.75, -3.6, 0.1));
      lights([0xffe9d0, 0.7], [0xffd9b0, 0.4], { x: 4, y: 9, z: 5, i: 0.7 });
    }},

  };

  function lights(hemi, dir, d) {
    root.add(new THREE.HemisphereLight(hemi[0], 0x2a2622, hemi[1] * 0.75));
    const l = new THREE.DirectionalLight(dir[0], (d.i ?? 0.85) * 0.8); l.position.set(d.x, d.y, d.z);
    l.castShadow = true; l.shadow.mapSize.set(1024, 1024);
    Object.assign(l.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 30 }); l.shadow.bias = -0.0005;
    root.add(l);
  }

  /* ───────── 방 전환 ───────── */
  function goRoom(id, fade = true) {
    const doIt = () => {
      if (root) scene.remove(root);
      objects.length = 0; colliders.length = 0; markers.length = 0; npcs.length = 0; hovered = null;
      root = new THREE.Group(); scene.add(root);
      room = ROOMS[id]; room.id = id; room.build();
      scene.background = new THREE.Color(room.dark ? 0x0b0a0a : 0x17130f);
      scene.fog = new THREE.Fog(scene.background, 30, 48);
      player = figure(cb.player || 'seojin');
      player.position.set(room.spawn[0], 0, room.spawn[1]); player.rotation.y = 0.9;
      root.add(player);
      target = pending = null;
      refreshMarkers();
      camera.position.set(player.position.x * 0.2, 9.5, room.D / 2 + 11);
      cb.onRoom && cb.onRoom(id, room.name);
    };
    if (!fade) return doIt();
    const f = document.getElementById('fade'); f.classList.add('on');
    setTimeout(() => { doIt(); setTimeout(() => f.classList.remove('on'), 80); }, 350);
  }
  function refreshMarkers() { markers.forEach(m => { m.visible = !(cb.isSeen && cb.isSeen(m.userData.id)); }); }

  /* ───────── 이동 ───────── */
  function blocked(x, z) {
    const hw = room.W / 2 - R, hd = room.D / 2 - R;
    if (x < -hw || x > hw || z < -hd || z > hd) return true;
    return colliders.some(c => x > c.x1 - R && x < c.x2 + R && z > c.z1 - R && z < c.z2 + R);
  }
  function step(dt) {
    let dx = 0, dz = 0;
    const kx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const kz = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (enabled && (kx || kz)) { target = null; pending = null; const l = Math.hypot(kx, kz); dx = kx / l; dz = kz / l; }
    else if (target) {
      const vx = target[0] - player.position.x, vz = target[1] - player.position.z, dist = Math.hypot(vx, vz);
      if (dist < 0.12) arrive();
      else {
        dx = vx / dist; dz = vz / dist;
        if (Math.abs(lastDist - dist) < 0.004) stuckT += dt; else stuckT = 0;
        lastDist = dist;
        if (stuckT > 0.35) arrive();
      }
    }
    const moving = !!(dx || dz);
    if (moving) {
      const stepLen = target ? Math.min(SPEED * dt, Math.hypot(target[0] - player.position.x, target[1] - player.position.z)) : SPEED * dt;
      const nx = player.position.x + dx * stepLen, nz = player.position.z + dz * stepLen;
      if (!blocked(nx, player.position.z)) player.position.x = nx;
      if (!blocked(player.position.x, nz)) player.position.z = nz;
      const want = Math.atan2(dx, dz);
      let diff = want - player.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      player.rotation.y += diff * Math.min(1, dt * 12);
      walkT += dt;
    }
    CHARS.animate(player, walkT, moving);
    player.position.y = moving ? Math.abs(Math.sin(walkT * 9)) * 0.04 : 0;
  }
  function arrive() {
    target = null; stuckT = 0;
    if (!pending) return;
    const o = pending; pending = null;
    const d = Math.hypot(o.at[0] - player.position.x, o.at[1] - player.position.z);
    if (d > (o.reach || 3.2)) { cb.onToast && cb.onToast('가까이 갈 수 없다.'); return; }
    player.rotation.y = Math.atan2(o.at[0] - player.position.x, o.at[1] - player.position.z);
    cb.onInteract && cb.onInteract(o);
    refreshMarkers();
  }
  function standPoint(o) {
    if (o.stand) return o.stand;
    const vx = player.position.x - o.at[0], vz = player.position.z - o.at[1], l = Math.hypot(vx, vz) || 1;
    return [o.at[0] + vx / l * 1.1, o.at[1] + vz / l * 1.1];
  }

  /* ───────── 입력 ───────── */
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1; mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(objects.map(o => o.group), true);
    if (hits.length) { let n = hits[0].object; while (n && !n.userData.obj) n = n.parent; if (n) return { obj: n.userData.obj }; }
    const fh = raycaster.intersectObject(floorMesh);
    return fh.length ? { floor: fh[0].point } : {};
  }
  function setHover(o, ev) {
    if (hovered === o) { if (o) moveTip(ev); return; }
    if (hovered) hovered.group.traverse(n => { if (n.material && n.userData.e0 !== undefined) { n.material.emissive.setHex(n.userData.e0); n.material.emissiveIntensity = n.userData.ei0; } });
    hovered = o;
    const tip = document.getElementById('tip');
    if (o) {
      o.group.traverse(n => { if (n.material && n.material.emissive && !n.material.emissiveMap) { n.userData.e0 = n.material.emissive.getHex(); n.userData.ei0 = n.material.emissiveIntensity; n.material.emissive.setHex(0x6b4a12); n.material.emissiveIntensity = 0.55; } });
      tip.textContent = o.name; tip.classList.add('on'); moveTip(ev);
      renderer.domElement.style.cursor = 'pointer';
    } else { tip.classList.remove('on'); renderer.domElement.style.cursor = 'default'; }
  }
  function moveTip(ev) { const tip = document.getElementById('tip'); tip.style.left = ev.clientX + 14 + 'px'; tip.style.top = ev.clientY + 12 + 'px'; }

  function onMove(ev) { if (!enabled) return setHover(null, ev); const p = pick(ev); setHover(p.obj || null, ev); }
  function onClick(ev) {
    if (!enabled) return;
    const p = pick(ev);
    if (p.obj) { pending = p.obj; const s = standPoint(p.obj); target = s; stuckT = 0; lastDist = 1e9; cb.onWalk && cb.onWalk(); }
    else if (p.floor) { pending = null; target = [p.floor.x, p.floor.z]; stuckT = 0; lastDist = 1e9; ring(p.floor); }
  }
  let ringMesh;
  function ring(pt) {
    if (!ringMesh) { ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 24), new THREE.MeshBasicMaterial({ color: 0xf0b44c, transparent: true })); ringMesh.rotation.x = -Math.PI / 2; }
    root.add(ringMesh); ringMesh.position.set(pt.x, 0.02, pt.z); ringMesh.material.opacity = 1; ringMesh.scale.set(1, 1, 1);
  }

  /* ───────── 루프 ───────── */
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
    if (!room) return;
    step(dt);
    markers.forEach((m, i) => { m.rotation.y = t * 2; m.position.y = (objects.find(o => o.id === m.userData.id)?.my || 2.2) + Math.sin(t * 3 + i) * 0.06; });
    if (ringMesh && ringMesh.parent) { ringMesh.material.opacity *= 0.93; ringMesh.scale.multiplyScalar(1.02); if (ringMesh.material.opacity < 0.05) root.remove(ringMesh); }
    root.traverse(n => { if (n.userData.flicker) n.intensity = Math.random() < 0.03 ? 0.15 : 0.9; });
    npcs.forEach((n, i) => CHARS.animate(n, t + i * 2, false));
    const cx = THREE.MathUtils.clamp(player.position.x * 0.25, -room.W / 6, room.W / 6);
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 3);
    camera.lookAt(camera.position.x * 0.9, 0.2, -0.6);
    renderer.render(scene, camera);
  }
  function resize() {
    const el = renderer.domElement.parentElement;
    renderer.setSize(el.clientWidth, el.clientHeight);
    camera.aspect = el.clientWidth / el.clientHeight;
    camera.fov = camera.aspect < 0.8 ? 60 : el.clientHeight < 520 ? 40 : 36; camera.zoom = el.clientHeight < 520 && camera.aspect > 1.8 ? 1.35 : 1; camera.updateProjectionMatrix();
  }

  function init(container, callbacks) {
    cb = callbacks;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
    renderer.domElement.style.touchAction = 'none';
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    clock = new THREE.Clock(); raycaster = new THREE.Raycaster(); mouse = new THREE.Vector2();
    resize(); addEventListener('resize', resize);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('click', onClick);
    addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; keys[e.key.toLowerCase()] = true; });
    addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    addEventListener('blur', () => Object.keys(keys).forEach(k => keys[k] = false));
    loop();
  }
  function openDrawer() {
    const o = objects.find(o => o.id === 'drawer'); if (!o) return;
    const g = o.group; if (g.userData.open) return; g.userData.open = true;
    g.userData.diary.visible = true;
    let k = 0; const iv = setInterval(() => { k++; g.position.z += 0.025; if (k >= 16) clearInterval(iv); }, 16);
  }

  return {
    init, goRoom, openDrawer, refreshMarkers,
    express(mood, ms = 2600) { if (!player) return; CHARS.setExpression(player, mood); clearTimeout(this._et); if (ms) this._et = setTimeout(() => player && CHARS.setExpression(player, player.userData.spec.eye.mood), ms); },
    walkTo(id) { const o = objects.find(o => o.id === id); if (!o) return false; pending = o; target = standPoint(o); stuckT = 0; lastDist = 1e9; return true; },
    screenPos(id) { const o = objects.find(o => o.id === id); if (!o) return null; const v = new THREE.Vector3(o.at[0], 1, o.at[1]).project(camera); const r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
    setEnabled(v) { enabled = v; if (!v) { setHover(null, {}); Object.keys(keys).forEach(k => keys[k] = false); } },
    get room() { return room && room.id; },
    debug() { return { p: player && [player.position.x.toFixed(2), player.position.z.toFixed(2)], target, pending: pending && pending.id, stuckT, enabled }; },
  };
})();
