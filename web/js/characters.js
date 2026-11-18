/* 피규어(넨도로이드풍) 캐릭터: 약 2등신, 큰 머리 + 작은 몸, 애니메이션 눈 데칼, 조각한 머리 가닥, PVC 광택, 표정 교체.
 * 비주얼 바이블 2-2 설정을 코드로 옮겼다.
 * CHARS.build(id) → THREE.Group (발바닥 y=0, 키 약 1.2) / CHARS.setExpression(group, 'surprised') 로 얼굴 교체 */
window.CHARS = (() => {
  THREE.ColorManagement.legacyMode = false; // 색상 코드를 sRGB 그대로 해석 (물 빠진 색 방지)
  const SPEC = {
    seojin: { name: '한서진', skin: 0xffe1cc, hair: 'bob', hairC: 0x2a2224, body: 'trench', coatC: 0xdcc7a4, pantsC: 0x3a3f4a, shoes: 'boots', extras: ['scarf', 'phone'], scarfC: 0x8a2e3c, eye: { iris: '#6b4a3a', mood: 'calm', brow: 'firm' } },
    seoyun: { name: '한서윤', skin: 0xffe4d2, hair: 'long', hairC: 0x231c1e, body: 'puffer', coatC: 0xa3cbe8, pantsC: 0x30343c, shoes: 'sneakers', extras: ['backpack', 'watch', 'keyring'], eye: { iris: '#8a5a3c', mood: 'gentle', brow: 'soft' } },
    prof:   { name: '문혜숙', skin: 0xf7d9c4, hair: 'greybob', hairC: 0x8e8c92, body: 'longcoat', coatC: 0x3d3743, pantsC: 0x2c2a30, shoes: 'loafers', extras: ['glasses', 'chain'], eye: { iris: '#5a5050', mood: 'smile', brow: 'arched' } },
    taeo:   { name: '강태오', skin: 0xf3d1b8, hair: 'messy', hairC: 0x161416, body: 'jacket', coatC: 0x23272e, pantsC: 0x5a606b, shoes: 'black', extras: ['lanyard', 'cvsbag'], eye: { iris: '#3a3030', mood: 'tired', brow: 'worried' } },
    woobin: { name: '정우빈', skin: 0xf6d6bf, hair: 'short', hairC: 0x141214, body: 'hoodie', coatC: 0x8f9298, pantsC: 0x2b3650, shoes: 'whiteshoes', extras: ['phoneEar'], eye: { iris: '#5a4030', mood: 'uneasy', brow: 'worried' } },
    detective: { name: '김도경', skin: 0xecc8aa, hair: 'buzz', hairC: 0x18161a, body: 'field', coatC: 0x2b3a55, pantsC: 0x8a7f62, shoes: 'black', extras: ['badge', 'notebook'], eye: { iris: '#2e2826', mood: 'sharp', brow: 'firm' } },
    jisu:   { name: '한지수', skin: 0xffe2cf, hair: 'long', hairC: 0x5a3a2a, body: 'jacket', coatC: 0xc8963a, pantsC: 0x3b4a66, shoes: 'sneakers', extras: ['phone'], eye: { iris: '#7a4a2a', mood: 'calm', brow: 'soft' } },
    grandma: { name: '최경자', skin: 0xf6d8c2, hair: 'greybob', hairC: 0xd2d0d4, body: 'longcoat', coatC: 0xa0586a, pantsC: 0x5a4a52, shoes: 'black', extras: ['glasses'], eye: { iris: '#4a3a3a', mood: 'closed', brow: 'soft' } },
    guard:  { name: '박영수', skin: 0xf6d5ba, hair: 'cap', hairC: 0xdadada, body: 'uniform', coatC: 0x34405a, pantsC: 0x34405a, shoes: 'black', extras: ['mustache', 'readglasses', 'keys', 'thermos'], eye: { iris: '#3a3030', mood: 'closed', brow: 'soft' } },
  };

  /* ───────── 재질 ───────── */
  const cache = {};
  function M(c, o = {}) {
    const k = c + JSON.stringify(o);
    return cache[k] || (cache[k] = new THREE.MeshPhysicalMaterial({ color: c, roughness: o.r ?? 0.5, metalness: o.m ?? 0, clearcoat: o.cc ?? 0.35, clearcoatRoughness: 0.35, emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 1 }));
  }
  const PVC = c => M(c, { r: 0.4, cc: 0.6 });     // 머리카락·신발: 광택 PVC
  const CLOTH = c => M(c, { r: 0.62, cc: 0.15 });  // 옷: 반무광
  const SKIN = c => M(c, { r: 0.55, cc: 0.25 });   // 피부
  function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
  const sph = (r, ws = 24, hs = 18, ...rest) => new THREE.SphereGeometry(r, ws, hs, ...rest);
  const cyl = (rt, rb, h, s = 22) => new THREE.CylinderGeometry(rt, rb, h, s);
  function rbox(w, h, d, r = 0.02) {
    r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    const s = new THREE.Shape(), x = -(w / 2 - r), y = -(d / 2 - r), W = w - 2 * r, D = d - 2 * r, c = Math.min(r, W / 2, D / 2) * 0.9;
    s.moveTo(x + c, y); s.lineTo(x + W - c, y); s.quadraticCurveTo(x + W, y, x + W, y + c); s.lineTo(x + W, y + D - c); s.quadraticCurveTo(x + W, y + D, x + W - c, y + D);
    s.lineTo(x + c, y + D); s.quadraticCurveTo(x, y + D, x, y + D - c); s.lineTo(x, y + c); s.quadraticCurveTo(x, y, x + c, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, h - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: 3, curveSegments: 4 });
    g.rotateX(-Math.PI / 2); g.translate(0, r, 0); return g;
  }
  /* 머리 가닥: 길쭉한 덩어리. 붙는 위치(x,y,z)에서 아래로 len만큼 늘어진다 */
  function strand(m, x, y, z, len, w, rz = 0, tilt = 0, d = 0.07) {
    const piv = new THREE.Group(); piv.position.set(x, y, z); piv.rotation.set(tilt, 0, rz);
    const geo = new THREE.ConeGeometry(1, 1, 12, 2); geo.rotateX(Math.PI); geo.translate(0, -0.5, 0);
    const s = mesh(geo, m); s.scale.set(w, len, d); piv.add(s);
    return piv;
  }

  /* 두 점 사이에 놓이는 가닥 (p0=뿌리, p1=끝) */
  const UP = new THREE.Vector3(0, -1, 0);
  function lock(m, p0, p1, w, d = 0.04) {
    const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1), dir = b.clone().sub(a), len = dir.length();
    const geo = new THREE.ConeGeometry(1, 1, 12, 2); geo.rotateX(Math.PI); geo.translate(0, -0.5, 0);
    const s = mesh(geo, m); s.scale.set(w, len, d);
    const piv = new THREE.Group(); piv.position.copy(a); piv.quaternion.setFromUnitVectors(UP, dir.normalize());
    const out = new THREE.Vector3(a.x, 0, a.z).normalize(); const roll = new THREE.Group(); roll.add(s); piv.add(roll);
    roll.rotation.y = Math.atan2(out.x, out.z) * 0.0; return piv;
  }
  const onShell = (x, y, r) => Math.sqrt(Math.max(0.0001, r * r - x * x - y * y));

  /* ───────── 얼굴 데칼 (표정 교체) ───────── */
  const MOODS = ['calm', 'gentle', 'smile', 'tired', 'uneasy', 'sharp', 'closed', 'surprised', 'sad'];
  function faceTexture(e, mood) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
    const eyeY = 300, gap = 100;
    g.fillStyle = 'rgba(255,140,140,.32)'; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(256 + s * 150, 372, 42, 18, 0, 0, Math.PI * 2); g.fill(); });
    [-1, 1].forEach(s => {
      const x = 256 + s * gap;
      if (mood === 'closed') { g.strokeStyle = '#2a2020'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.arc(x, eyeY + 10, 30, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); return; }
      const h = mood === 'sharp' ? 64 : mood === 'tired' ? 64 : mood === 'surprised' ? 88 : 82, w = mood === 'surprised' ? 58 : 56;
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, eyeY, w, h, 0, 0, Math.PI * 2); g.fill();
      const ir = mood === 'surprised' ? 0.55 : 0.82;
      const gr = g.createLinearGradient(0, eyeY - h, 0, eyeY + h); gr.addColorStop(0, '#1a1414'); gr.addColorStop(0.45, e.iris); gr.addColorStop(1, shade(e.iris, 1.5));
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, eyeY + 6, w * ir, h * ir * 1.1, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#120e0e'; g.beginPath(); g.ellipse(x, eyeY + 8, w * 0.36 * ir, h * 0.42 * ir, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x - 14, eyeY - h * 0.36, 13, 17, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + 14, eyeY + h * 0.4, 6, 6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1e1616'; g.lineCap = 'round'; g.lineWidth = 14;
      const tired = mood === 'tired';
      if (tired) { g.fillStyle = '#ffe1cc'; g.beginPath(); g.ellipse(x, eyeY - h * 0.75, w + 8, h * 0.45, 0, 0, Math.PI * 2); g.fill(); }
      const lidY = tired ? eyeY - h * 0.35 : eyeY - h * 0.92;
      g.beginPath(); g.ellipse(x, lidY + h * 0.95, w + 4, h * 0.98, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      g.lineWidth = 7; g.beginPath(); g.moveTo(x + s * (w + 2), lidY + h * 0.6); g.lineTo(x + s * (w + 18), lidY + h * 0.4); g.stroke();
      g.lineWidth = 3; g.strokeStyle = 'rgba(60,40,40,.55)'; g.beginPath(); g.ellipse(x, eyeY, w * 0.8, h, 0, Math.PI * 0.25, Math.PI * 0.75); g.stroke();
      if (tired) { g.strokeStyle = 'rgba(120,90,110,.45)'; g.lineWidth = 5; g.beginPath(); g.arc(x, eyeY + h + 6, 26, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
      if (mood === 'sad') { g.fillStyle = 'rgba(120,190,255,.85)'; g.beginPath(); g.ellipse(x + s * 10, eyeY + h + 14, 8, 14, 0, 0, Math.PI * 2); g.fill(); }
    });
    const brow = mood === 'sad' || mood === 'uneasy' ? 'worried' : mood === 'surprised' ? 'up' : e.brow;
    g.strokeStyle = '#2a2020'; g.lineWidth = 8; g.lineCap = 'round';
    [-1, 1].forEach(s => {
      const x = 256 + s * gap, y = eyeY - 105; g.beginPath();
      if (brow === 'worried') { g.moveTo(x - s * 32, y + 4); g.lineTo(x + s * 30, y - 14); }
      else if (brow === 'firm') { g.moveTo(x - s * 34, y - 6); g.lineTo(x + s * 32, y + 2); }
      else if (brow === 'arched') g.arc(x, y + 20, 34, Math.PI * 1.2, Math.PI * 1.8);
      else if (brow === 'up') g.arc(x, y + 6, 32, Math.PI * 1.15, Math.PI * 1.85);
      else { g.moveTo(x - 30, y - 2); g.quadraticCurveTo(x, y - 12, x + 30, y - 2); }
      g.stroke();
    });
    g.strokeStyle = '#7a3a3a'; g.fillStyle = '#7a3a3a'; g.lineWidth = 6; g.beginPath();
    if (mood === 'surprised') { g.ellipse(256, 398, 12, 16, 0, 0, Math.PI * 2); g.fill(); }
    else if (['smile', 'closed', 'gentle'].includes(mood)) { g.arc(256, 382, 18, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
    else if (['uneasy', 'tired', 'sad'].includes(mood)) { g.moveTo(240, 400); g.quadraticCurveTo(256, 390, 272, 400); g.stroke(); }
    else { g.moveTo(244, 394); g.lineTo(268, 394); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t;
  }
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = v => Math.min(255, Math.round(v * k)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }

  /* ───────── 조립 ───────── */
  function build(id) {
    const c = SPEC[id], g = new THREE.Group(), fig = new THREE.Group(); g.add(fig);
    const skin = SKIN(c.skin), coat = CLOTH(c.coatC), pants = CLOTH(c.pantsC), hairM = PVC(c.hairC);
    const W = c.wide || 1; fig.scale.set(W, c.tall || 1, W);

    /* 다리·신발 */
    const legs = [];
    [-0.075, 0.075].forEach(x => {
      const leg = new THREE.Group(); leg.position.set(x, 0.25, 0);
      leg.add(mesh(cyl(0.055, 0.05, 0.18), pants, 0, -0.1, 0));
      const sh = shoe(c.shoes); sh.position.set(0, -0.25, 0.025); leg.add(sh);
      fig.add(leg); legs.push(leg);
    });

    /* 몸통 */
    const torso = new THREE.Group(); torso.position.y = 0.17; fig.add(torso);
    if (c.body === 'puffer') {
      for (let i = 0; i < 4; i++) { const p = mesh(sph(1, 22, 14), coat, 0, 0.04 + i * 0.09, 0); p.scale.set(0.2 - i * 0.012, 0.065, 0.18 - i * 0.01); torso.add(p); }
      torso.add(mesh(cyl(0.11, 0.13, 0.07), coat, 0, 0.33, 0));
    } else if (c.body === 'trench' || c.body === 'longcoat') {
      torso.add(mesh(cyl(0.13, 0.19, 0.36), coat, 0, 0.16, 0));
      if (c.body === 'trench') { const belt = mesh(new THREE.TorusGeometry(0.16, 0.014, 8, 26), CLOTH(0xb59a74)); belt.rotation.x = Math.PI / 2; belt.position.y = 0.17; torso.add(belt); }
      [-1, 1].forEach(s => { const lap = mesh(rbox(0.06, 0.13, 0.02, 0.008), CLOTH(new THREE.Color(c.coatC).multiplyScalar(0.85).getHex()), s * 0.045, 0.23, 0.125); lap.rotation.z = s * 0.35; lap.rotation.x = -0.25; torso.add(lap); });
      [0.1, 0.03].forEach(y => torso.add(mesh(sph(0.011, 8, 6), M(0x3a3028), 0.03, y, 0.165)));
    } else {
      torso.add(mesh(cyl(0.13, 0.15, 0.1), pants, 0, 0.04, 0));
      torso.add(mesh(cyl(0.135, 0.17, 0.27), coat, 0, 0.2, 0));
      if (c.body === 'hoodie') { const hood = mesh(new THREE.TorusGeometry(0.1, 0.04, 8, 18), coat, 0, 0.34, -0.05); hood.rotation.x = Math.PI / 2.4; torso.add(hood); [-0.03, 0.03].forEach(x => torso.add(mesh(cyl(0.005, 0.005, 0.1, 6), M(0xf2f2f2), x, 0.26, 0.15))); torso.add(mesh(rbox(0.12, 0.06, 0.02, 0.008), coat, 0, 0.13, 0.15)); }
      if (c.body === 'jacket') { for (let i = 0; i < 2; i++) { const seam = mesh(new THREE.TorusGeometry(0.155, 0.007, 6, 24), CLOTH(0x2f343b)); seam.rotation.x = Math.PI / 2; seam.position.y = 0.15 + i * 0.09; torso.add(seam); } torso.add(mesh(cyl(0.005, 0.005, 0.25, 6), M(0x9aa0a8, { m: 0.5 }), 0, 0.2, 0.16)); }
      if (c.body === 'field') [-0.06, 0.06].forEach(x => torso.add(mesh(rbox(0.07, 0.05, 0.02, 0.008), CLOTH(0x22304a), x, 0.22, 0.155)));
      if (c.body === 'uniform') { torso.add(mesh(rbox(0.05, 0.055, 0.015, 0.006), M(0xd8b04a, { m: 0.6, r: 0.3 }), -0.06, 0.25, 0.158)); for (let i = 0; i < 3; i++) torso.add(mesh(sph(0.01, 8, 6), M(0xd8b04a, { m: 0.6, r: 0.3 }), 0, 0.1 + i * 0.07, 0.165)); }
    }

    /* 팔 */
    const arms = [];
    [-1, 1].forEach(s => {
      const arm = new THREE.Group(); arm.position.set(s * 0.165, 0.49, 0);
      arm.add(mesh(cyl(0.04, 0.046, 0.19), coat, 0, -0.095, 0));
      arm.add(mesh(sph(0.05, 14, 12), skin, 0, -0.21, 0.005));
      arm.rotation.z = s * 0.25; fig.add(arm); arms.push(arm);
    });

    /* 머리 */
    const head = new THREE.Group(); head.position.y = 0.84; fig.add(head);
    const R = 0.34;
    const skull = mesh(sph(R, 40, 30), skin); skull.scale.set(1.06, 0.97, 1); head.add(skull);
    const face = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 40, 28, Math.PI / 2 - 0.66, 1.32, Math.PI * 0.4, Math.PI * 0.32),
      new THREE.MeshPhysicalMaterial({ map: faceTexture(c.eye, c.eye.mood), transparent: true, roughness: 0.4, clearcoat: 0.4, depthWrite: false }));
    face.scale.set(1.06, 0.97, 1); head.add(face);
    [-1, 1].forEach(s => head.add(mesh(sph(0.048, 12, 10), skin, s * 0.355, -0.03, 0)));
    hair(head, c, hairM);
    if (c.extras.includes('glasses') || c.extras.includes('readglasses')) {
      const up = c.extras.includes('readglasses'), gm = M(up ? 0x6b4a2a : 0xb08d5a, { m: 0.6, r: 0.3 }), y = up ? 0.2 : -0.04, z = up ? 0.25 : 0.335;
      const gl = new THREE.Group(); gl.position.set(0, y, z); if (up) gl.rotation.x = -0.6; head.add(gl);
      [-0.105, 0.105].forEach(x => gl.add(mesh(new THREE.TorusGeometry(0.072, 0.009, 8, 24), gm, x, 0, 0)));
      const br = mesh(cyl(0.006, 0.006, 0.06, 6), gm); br.rotation.z = Math.PI / 2; gl.add(br);
      if (c.extras.includes('chain')) { const ch = mesh(new THREE.TorusGeometry(0.24, 0.005, 4, 30, Math.PI), M(0xe2bd55, { m: 0.7, r: 0.25 }), 0, -0.12, 0.13); ch.rotation.z = Math.PI; head.add(ch); }
    }
    if (c.extras.includes('mustache')) [-1, 1].forEach(s => { const m = mesh(sph(0.05, 12, 10), PVC(0xfafafa), s * 0.04, -0.12, 0.325); m.scale.set(1.2, 0.5, 0.55); m.rotation.z = s * -0.3; head.add(m); });

    /* 소품 */
    const handR = arms[1], handL = arms[0];
    if (c.extras.includes('scarf')) { const s = mesh(new THREE.TorusGeometry(0.115, 0.042, 12, 24), CLOTH(c.scarfC), 0, 0.52, 0); s.rotation.x = Math.PI / 2; fig.add(s); const tail = mesh(rbox(0.07, 0.16, 0.035, 0.014), CLOTH(c.scarfC), 0.06, 0.34, 0.13); tail.rotation.z = 0.12; fig.add(tail); }
    if (c.extras.includes('phone')) { const p = mesh(rbox(0.06, 0.1, 0.014, 0.008), M(0x1b1d22, { r: 0.3 }), 0, -0.24, 0.05); p.rotation.x = -0.5; handR.add(p); }
    if (c.extras.includes('phoneEar')) { handR.rotation.set(-2.5, 0, 0.1); handR.add(mesh(rbox(0.06, 0.11, 0.014, 0.008), M(0x111111), 0.02, -0.23, 0)); }
    if (c.extras.includes('backpack')) fig.add(mesh(rbox(0.24, 0.24, 0.12, 0.05), CLOTH(0x6a5248), 0, 0.26, -0.2));
    if (c.extras.includes('watch')) handL.add(mesh(rbox(0.06, 0.035, 0.06, 0.01), M(0x222222, { r: 0.3 }), 0, -0.16, 0));
    if (c.extras.includes('keyring')) fig.add(mesh(sph(0.03, 10, 8), M(0x9a9a9a), 0.1, 0.22, -0.27));
    if (c.extras.includes('lanyard')) { const l = mesh(new THREE.TorusGeometry(0.1, 0.007, 4, 20, Math.PI), M(0x3a7bd5), 0, 0.5, 0.06); l.rotation.set(0.3, 0, Math.PI); fig.add(l); fig.add(mesh(rbox(0.06, 0.075, 0.01, 0.006), M(0xffffff), 0, 0.34, 0.16)); }
    if (c.extras.includes('cvsbag')) handR.add(mesh(rbox(0.12, 0.14, 0.07, 0.03), CLOTH(0xf4f4f2), 0, -0.32, 0.02));
    if (c.extras.includes('badge')) fig.add(mesh(rbox(0.05, 0.06, 0.012, 0.008), M(0xd8b04a, { m: 0.6, r: 0.3 }), 0.1, 0.24, 0.165));
    if (c.extras.includes('notebook')) { handL.add(mesh(rbox(0.08, 0.1, 0.018, 0.006), CLOTH(0x2a2a2a), 0, -0.27, 0.04)); handL.rotation.x = -0.6; }
    if (c.extras.includes('keys')) fig.add(mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 12), M(0xc8c8c8, { m: 0.7, r: 0.3 }), 0.15, 0.2, 0.1));
    if (c.extras.includes('thermos')) handL.add(mesh(cyl(0.035, 0.035, 0.13), PVC(0x8a2e2e), 0, -0.29, 0.03));
    if (id === 'taeo') { head.rotation.x = 0.12; head.position.z = 0.03; }

    const shd = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
    shd.rotation.x = -Math.PI / 2; shd.position.y = 0.004; g.add(shd);
    g.userData = { limbs: { legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], head }, spec: c, face, mood: c.eye.mood };
    return g;
  }

  function setExpression(g, mood) {
    const u = g.userData; if (!u.face || u.mood === mood) return;
    u.face.material.map.dispose(); u.face.material.map = faceTexture(u.spec.eye, mood); u.face.material.needsUpdate = true; u.mood = mood;
  }

  function shoe(kind) {
    const g = new THREE.Group();
    const col = { sneakers: 0xf7f7f5, whiteshoes: 0xf4f4f4, loafers: 0x7a4a2a, boots: 0x6b4a32, black: 0x222226 }[kind] || 0x222222;
    g.add(mesh(rbox(0.12, kind === 'boots' ? 0.11 : 0.075, 0.18, 0.035), PVC(col)));
    if (kind === 'sneakers') { g.add(mesh(rbox(0.125, 0.02, 0.185, 0.008), PVC(0xd5d5d5))); g.add(mesh(rbox(0.127, 0.014, 0.09, 0.005), PVC(0x8fbbe0), 0, 0.035, 0)); }
    if (kind === 'loafers') g.add(mesh(rbox(0.07, 0.024, 0.035, 0.008), M(0xe6bf50, { m: 0.75, r: 0.2 }), 0, 0.062, 0.045));
    return g;
  }

  /* ───────── 머리카락 ───────── */
  function hair(head, c, m) {
    const R = 0.34;
    const cap = (r, t, tilt) => { const h = mesh(sph(r, 36, 24, 0, Math.PI * 2, 0, Math.PI * t), m); h.scale.set(1.08, 1, 1.03); h.rotation.x = tilt; return h; };
    const add = (...xs) => xs.forEach(x => head.add(x));
    const fringe = (n, y, yEnd, spread = 0.27) => { const r = R * 1.1; for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1) - 0.5, x = t * spread * 2, x2 = x * 1.12 + t * 0.04, ye = yEnd + Math.abs(t) * 0.05; add(lock(m, [x, y, onShell(x, y, r * 0.98)], [x2, ye, onShell(x2, ye, r) + 0.015], 0.07, 0.035)); } };
    switch (c.hair) {
      case 'bob': case 'greybob': {
        const L = c.hair === 'bob' ? 0.3 : 0.24;
        add(cap(R * 1.06, 0.56, -0.48));
        fringe(6, 0.27, 0.02);
        [-1, 1].forEach(s => add(strand(m, s * 0.335, 0.16, 0.12, L * 1.05, 0.07, s * 0.08, 0.05, 0.05), strand(m, s * 0.34, 0.16, -0.02, L, 0.085, s * 0.1, 0, 0.07), strand(m, s * 0.3, 0.16, -0.14, L * 0.95, 0.09, s * 0.08, 0, 0.08)));
        for (let i = 0; i < 5; i++) { const a = Math.PI * (1.15 + i * 0.175); add(strand(m, Math.cos(a) * 0.3, 0.14, Math.sin(a) * 0.3, L * 0.9, 0.11, Math.cos(a) * 0.12, -0.1, 0.07)); }
        break;
      }
      case 'long': {
        add(cap(R * 1.06, 0.56, -0.48));
        fringe(6, 0.27, 0.0);
        [-1, 1].forEach(s => add(strand(m, s * 0.335, 0.14, 0.1, 0.5, 0.065, s * 0.05, 0.03, 0.05), strand(m, s * 0.33, 0.14, -0.04, 0.55, 0.08, s * 0.05, 0, 0.07)));
        for (let i = 0; i < 6; i++) { const a = Math.PI * (1.12 + i * 0.152); add(strand(m, Math.cos(a) * 0.29, 0.16, Math.sin(a) * 0.3, 0.66, 0.12, Math.cos(a) * 0.04, -0.06, 0.07)); }
        break;
      }
      case 'messy': {
        add(cap(R * 1.06, 0.56, -0.5));
        fringe(5, 0.27, 0.06, 0.22);
        [[-0.15, 0.36, 0.05, 0.4], [0.05, 0.4, 0.0, -0.2], [0.2, 0.33, -0.05, -0.7], [-0.25, 0.28, -0.1, 0.9], [0.0, 0.36, -0.2, 0.2]].forEach(([x, y, z, rz]) => { const s = mesh(new THREE.ConeGeometry(0.07, 0.2, 7), m, x, y, z); s.rotation.z = rz; head.add(s); });
        break;
      }
      case 'short': add(cap(R * 1.05, 0.55, -0.52)); fringe(5, 0.27, 0.08, 0.22); break;
      case 'buzz': add(cap(R * 1.03, 0.53, -0.55)); break;
      case 'cap': {
        add(cap(R * 1.03, 0.55, -0.5));
        const crown = mesh(cyl(0.33, 0.37, 0.17, 30), CLOTH(0x2a3448), 0, 0.22, 0); crown.rotation.x = -0.08; head.add(crown);
        head.add(mesh(cyl(0.36, 0.33, 0.04, 30), CLOTH(0x2a3448), 0, 0.32, 0.02));
        const brim = mesh(cyl(0.22, 0.22, 0.025, 24), PVC(0x1a2030), 0, 0.15, 0.27); brim.scale.z = 0.65; head.add(brim);
        head.add(mesh(rbox(0.08, 0.06, 0.012, 0.006), M(0xd8b04a, { m: 0.6, r: 0.3 }), 0, 0.24, 0.355));
        [-1, 1].forEach(s => add(strand(m, s * 0.33, 0.08, 0.05, 0.08, 0.05, 0, 0, 0.05)));
        break;
      }
    }
  }

  function animate(p, t, moving) {
    const L = p.userData.limbs; if (!L) return;
    const s = moving ? Math.sin(t * 11) * 0.55 : 0;
    L.legL.rotation.x = s; L.legR.rotation.x = -s;
    if (!p.userData.spec.extras.includes('phoneEar')) { L.armL.rotation.x = -s * 0.7; L.armR.rotation.x = s * 0.7; }
    L.head.rotation.z = moving ? Math.sin(t * 11) * 0.04 : Math.sin(t * 1.5) * 0.015;
  }

  return { build, animate, setExpression, MOODS, SPEC, rbox };
})();
