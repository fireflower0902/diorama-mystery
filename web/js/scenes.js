/* SVG로 그리는 장면들: CCTV, 신발 확대, 사진, 지도, 그래프, 도면 */
window.SCENES = (() => {
  const PEOPLE = {
    seoyun: { coat: '#9cc4e4', long: true, hood: false, shoe: 'sneaker', pants: '#30343c', hair: '#1b1a1a', bag: true },
    fake:   { coat: '#9cc4e4', long: true, hood: true, shoe: 'loafer', pants: '#3a3430', hair: '#2a2420', phone: true },
    taeo:   { coat: '#1f2328', long: false, hood: false, shoe: 'dark', pants: '#4a4f58', hair: '#111', tall: 1.06, bagItem: true },
    woobin: { coat: '#8d9096', long: false, hood: true, hoodDown: true, shoe: 'dark', pants: '#25303f', hair: '#111', tall: 1.04, phone: true },
    seoa:   { coat: '#e8a3b8', long: false, hood: false, shoe: 'sneaker', pants: '#3b4a66', hair: '#6b4a3a', bag: true },
    manager:{ coat: '#f2c14e', long: false, hood: false, shoe: 'dark', pants: '#4a5058', hair: '#222', cap: true, bagItem: true },
    guard:  { coat: '#2b3a55', long: false, hood: false, shoe: 'dark', pants: '#2b3a55', hair: '#222', cap: true },
  };

  function shoe(kind, x) {
    if (kind === 'sneaker') return `<rect x="${x - 2}" y="-6" width="16" height="7" rx="3" fill="#f4f4f2"/><rect x="${x - 2}" y="-1" width="16" height="2" fill="#cfcfcf"/>`;
    if (kind === 'loafer') return `<rect x="${x - 2}" y="-6" width="16" height="6" rx="3" fill="#7a4a2a"/><rect x="${x + 6}" y="-5" width="4" height="2" fill="#e0b84a"/>`;
    return `<rect x="${x - 2}" y="-6" width="16" height="6" rx="3" fill="#1a1a1a"/>`;
  }

  function person(who, x, y = 320, s = 1, flip = false) {
    const p = PEOPLE[who];
    const k = s * (p.tall || 1);
    const coatEnd = p.long ? -48 : -88;
    let g = `<g transform="translate(${x},${y}) scale(${flip ? -k : k},${k})">`;
    g += `<ellipse cx="0" cy="0" rx="34" ry="6" fill="rgba(0,0,0,.35)"/>`;
    g += `<rect x="-14" y="-92" width="12" height="88" fill="${p.pants}"/><rect x="2" y="-92" width="12" height="88" fill="${p.pants}"/>`;
    g += shoe(p.shoe, -14) + shoe(p.shoe, 2);
    g += `<path d="M-26,-146 Q0,-156 26,-146 L31,${coatEnd} Q0,${coatEnd + 6} -31,${coatEnd} Z" fill="${p.coat}"/>`;
    if (p.long) g += `<path d="M-28,-120 L28,-120 M-30,-90 L30,-90 M-31,-62 L31,-62" stroke="rgba(0,0,0,.12)" stroke-width="2"/>`;
    g += `<rect x="-36" y="-142" width="11" height="62" rx="5" fill="${p.coat}"/><rect x="25" y="-142" width="11" height="62" rx="5" fill="${p.coat}"/>`;
    if (p.phone) g += `<rect x="27" y="-86" width="8" height="14" rx="2" fill="#0b0b0b"/><rect x="28" y="-85" width="6" height="11" fill="#5fa0c8" opacity=".7"/>`;
    if (p.bag) g += `<rect x="-44" y="-112" width="14" height="30" rx="3" fill="#3b2f2a"/>`;
    if (p.bagItem) g += `<rect x="28" y="-84" width="16" height="20" rx="2" fill="#e8e1d2"/>`;
    g += `<circle cx="0" cy="-166" r="15" fill="#d9b99b"/>`;
    if (p.hood) {
      g += p.hoodDown
        ? `<path d="M-18,-150 Q0,-140 18,-150 L20,-142 Q0,-134 -20,-142 Z" fill="${p.coat}"/><path d="M-15,-172 Q0,-188 15,-172 L15,-166 L-15,-166 Z" fill="${p.hair}"/>`
        : `<path d="M-21,-150 Q-22,-190 0,-190 Q22,-190 21,-150 Q14,-160 0,-160 Q-14,-160 -21,-150 Z" fill="${p.coat}"/><path d="M-14,-160 Q0,-150 14,-160 L12,-150 Q0,-146 -12,-150Z" fill="#1d2228" opacity=".85"/>`;
    } else if (p.cap) {
      g += `<path d="M-16,-172 Q0,-190 16,-172 L22,-170 L-16,-170 Z" fill="#1c2638"/>`;
    } else {
      g += `<path d="M-16,-168 Q-17,-186 0,-186 Q17,-186 16,-168 Q8,-176 0,-175 Q-8,-176 -16,-168 Z" fill="${p.hair}"/>`;
      if (who === 'seoyun') g += `<path d="M-16,-168 L-18,-140 L-11,-146 Z M16,-168 L18,-140 L11,-146 Z" fill="${p.hair}"/>`;
    }
    return g + '</g>';
  }

  const BG = {
    studio: `<rect width="640" height="360" fill="#d9cfc0"/><polygon points="0,360 640,360 560,240 80,240" fill="#b89a74"/>
      ${[0, 1, 2, 3, 4, 5, 6].map(i => `<line x1="${80 + i * 80}" y1="240" x2="${i * 106}" y2="360" stroke="#a68660"/>`).join('')}
      <rect x="40" y="70" width="110" height="230" fill="#7d6a58"/><circle cx="135" cy="190" r="5" fill="#d8c07a"/><rect x="152" y="160" width="10" height="20" fill="#1d2127"/>
      <rect x="230" y="150" width="140" height="70" fill="#f4f1ec"/><rect x="225" y="145" width="150" height="8" fill="#bfb6aa"/>
      <rect x="430" y="110" width="60" height="140" fill="#d8c3a5"/><rect x="410" y="200" width="100" height="10" fill="#b08a6a"/><rect x="415" y="150" width="90" height="10" fill="#b08a6a"/><rect x="420" y="100" width="80" height="22" rx="10" fill="#e8d8c4"/>
      <ellipse cx="330" cy="318" rx="16" ry="5" fill="#f2a07b"/><ellipse cx="365" cy="318" rx="16" ry="5" fill="#8fbbe0"/>
      <rect x="540" y="200" width="100" height="70" fill="#8b6a4e"/><rect x="540" y="190" width="100" height="14" fill="#f4efe8"/>`,
    lobby: `<rect width="640" height="360" fill="#565c63"/>
      <polygon points="0,360 640,360 520,210 120,210" fill="#7b8087"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<line x1="${120 + i * 80}" y1="210" x2="${i * 128}" y2="360" stroke="#6a6f76"/>`).join('')}
      ${[0, 1, 2].map(i => `<line x1="${120 - i * 40}" y1="${230 + i * 45}" x2="${520 + i * 40}" y2="${230 + i * 45}" stroke="#6a6f76"/>`).join('')}
      <rect x="200" y="70" width="240" height="140" fill="#2e3740"/><rect x="206" y="76" width="112" height="134" fill="#3d4a55"/><rect x="322" y="76" width="112" height="134" fill="#3d4a55"/>
      <rect x="40" y="170" width="120" height="50" fill="#4a4f55"/><rect x="40" y="160" width="120" height="12" fill="#3a3e43"/>
      <text x="245" y="60" fill="#c9cdd2" font-size="13" font-family="sans-serif">공학2관 ENGINEERING HALL II</text>`,
    back: `<rect width="640" height="360" fill="#4b4f52"/>
      <polygon points="0,360 640,360 470,190 170,190" fill="#6c6f72"/>
      <rect x="170" y="40" width="300" height="150" fill="#5a5e61"/>
      <rect x="380" y="70" width="80" height="120" fill="#3a4a3f"/><rect x="386" y="76" width="68" height="114" fill="#2f3b33"/>
      <rect x="392" y="52" width="56" height="14" fill="#2f8f4e"/><text x="397" y="63" fill="#e8fff0" font-size="10" font-family="sans-serif">EXIT 후문</text>
      <rect x="360" y="110" width="12" height="18" fill="#222"/><circle cx="366" cy="116" r="2" fill="#e04848"/>
      <rect x="0" y="80" width="170" height="280" fill="#55595c"/>`,
    front: `<rect width="640" height="360" fill="#1d2430"/>
      <rect x="0" y="260" width="640" height="100" fill="#3a3f45"/>
      <rect x="150" y="60" width="340" height="200" fill="#2a3340"/><rect x="160" y="70" width="155" height="190" fill="#4a6070" opacity=".6"/><rect x="325" y="70" width="155" height="190" fill="#4a6070" opacity=".6"/>
      <rect x="500" y="150" width="14" height="22" fill="#111"/><circle cx="507" cy="157" r="2.5" fill="#e04848"/>
      <circle cx="60" cy="40" r="22" fill="#f1d27a" opacity=".35"/><rect x="58" y="40" width="4" height="220" fill="#555"/>
      <text x="230" y="50" fill="#9aa7b4" font-size="13" font-family="sans-serif">도화대학교 공학2관</text>`,
    store: `<rect width="640" height="360" fill="#d8d6cf"/>
      <rect x="0" y="0" width="640" height="150" fill="#bfc6c9"/>
      ${[0, 1, 2, 3].map(i => `<rect x="${20 + i * 150}" y="20" width="130" height="110" fill="#e9e6de"/><line x1="${20 + i * 150}" y1="60" x2="${150 + i * 150}" y2="60" stroke="#aaa"/><line x1="${20 + i * 150}" y1="95" x2="${150 + i * 150}" y2="95" stroke="#aaa"/>`).join('')}
      <rect x="0" y="250" width="640" height="110" fill="#8a8f93"/><rect x="0" y="240" width="640" height="14" fill="#6d7276"/>
      <rect x="440" y="214" width="34" height="26" fill="#333"/>
      ${[0, 1, 2, 3].map(i => `<rect x="${300 + i * 13}" y="225" width="11" height="17" rx="2" fill="#c33"/>`).join('')}`,
  };

  function cat(x, y = 330) {
    return `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="26" ry="5" fill="rgba(0,0,0,.3)"/>
      <ellipse cx="0" cy="-20" rx="30" ry="18" fill="#8d9096"/><circle cx="26" cy="-34" r="14" fill="#8d9096"/>
      <path d="M17,-44 L21,-58 L28,-46 Z M29,-46 L36,-57 L38,-42 Z" fill="#8d9096"/>
      <path d="M-28,-24 Q-50,-40 -40,-58" stroke="#8d9096" stroke-width="7" fill="none" stroke-linecap="round"/>
      <rect x="-20" y="-8" width="6" height="10" fill="#7d8086"/><rect x="12" y="-8" width="6" height="10" fill="#7d8086"/>
      <circle cx="31" cy="-36" r="2.2" fill="#2a2a2a"/></g>`;
  }
  function cctv(scene, figs) {
    const parts = figs.map(f => f.who === 'cat' ? cat(f.x, scene === 'store' ? 300 : 330) : f.who === 'dooropen' ? (BG_DOOR[scene] || '') : person(f.who, f.x, scene === 'store' ? 300 : 330, scene === 'store' ? .9 : 1, f.flip));
    const door = figs.some(f => f.who === 'dooropen') ? parts.filter((_, i) => figs[i].who === 'dooropen').join('') : '';
    return `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg">${BG[scene]}${door}${parts.filter((_, i) => figs[i].who !== 'dooropen').join('')}</svg>`;
  }
  const BG_DOOR = {
    studio: `<rect x="40" y="70" width="110" height="230" fill="#f4ecd8"/><polygon points="40,70 10,60 10,310 40,300" fill="#7d6a58"/><rect x="40" y="70" width="110" height="230" fill="url(#hall)" opacity=".0"/>
      <rect x="52" y="90" width="86" height="200" fill="#e8dcc0"/><text x="58" y="120" font-size="12" fill="#8a7a60" font-family="sans-serif">복도</text>`,
  };
  function zoomArt(kind) {
    if (kind !== 'vest') return null;
    return `<svg viewBox="0 0 450 260" xmlns="http://www.w3.org/2000/svg"><rect width="450" height="260" fill="#5a5d60"/>
      <path d="M110,20 L340,20 L370,250 L80,250 Z" fill="#f2c14e"/><rect x="80" y="150" width="290" height="16" fill="#e0e0e0"/><rect x="80" y="196" width="290" height="16" fill="#e0e0e0"/>
      <text x="225" y="95" text-anchor="middle" font-size="30" font-weight="700" fill="#2a2a2a" font-family="sans-serif">해든빌라</text>
      <text x="225" y="133" text-anchor="middle" font-size="30" font-weight="700" fill="#2a2a2a" font-family="sans-serif">관리실</text></svg>`;
  }

  function shoeZoom(kind) {
    const s = kind === 'loafer'
      ? `<path d="M60,190 Q70,140 150,135 L300,140 Q360,150 380,190 Z" fill="#7a4a2a"/><path d="M60,190 L380,190 L380,205 L60,205 Z" fill="#3b2414"/><rect x="200" y="140" width="50" height="16" rx="3" fill="#e0b84a"/><rect x="208" y="144" width="34" height="8" rx="2" fill="#b38a2a"/>`
      : `<path d="M60,190 Q70,120 160,115 L300,125 Q380,140 390,190 Z" fill="#f4f4f2"/><path d="M60,190 L390,190 L390,210 L60,210 Z" fill="#cfcfcf"/>${[0, 1, 2, 3].map(i => `<line x1="${170 + i * 22}" y1="122" x2="${180 + i * 22}" y2="150" stroke="#999" stroke-width="3"/>`).join('')}<path d="M90,170 Q200,150 330,168" stroke="#9cc4e4" stroke-width="5" fill="none"/>`;
    return `<svg viewBox="0 0 450 260" xmlns="http://www.w3.org/2000/svg"><rect width="450" height="260" fill="#6c6f72"/>${s}<rect x="0" y="210" width="450" height="50" fill="#5a5d60"/></svg>`;
  }

  function homecoming(zoom) {
    if (zoom) return shoeZoom('loafer').replace('#6c6f72', '#9b8e7e').replace('#5a5d60', '#7f735f');
    const ppl = [
      { x: 110, coat: '#5d6b7a', shoe: 'dark' }, { x: 220, coat: '#8a5a44', shoe: 'dark' },
      { x: 330, coat: '#3b3540', shoe: 'loafer', prof: true }, { x: 440, coat: '#9cc4e4', shoe: 'sneaker' }, { x: 545, coat: '#273b2f', shoe: 'dark' },
    ];
    const fig = p => `<g transform="translate(${p.x},330)">
      <rect x="-14" y="-92" width="12" height="88" fill="#2a2a2e"/><rect x="2" y="-92" width="12" height="88" fill="#2a2a2e"/>${shoe(p.shoe, -14)}${shoe(p.shoe, 2)}
      <path d="M-26,-146 Q0,-156 26,-146 L30,-70 Q0,-64 -30,-70 Z" fill="${p.coat}"/>
      <circle cx="0" cy="-166" r="15" fill="#e0c2a4"/><path d="M-16,-168 Q-17,-186 0,-186 Q17,-186 16,-168 Q8,-176 0,-175 Q-8,-176 -16,-168 Z" fill="${p.prof ? '#8b8b8b' : '#1b1a1a'}"/>
      <path d="M-6,-160 Q0,-155 6,-160" stroke="#7a4a3a" stroke-width="2" fill="none"/></g>`;
    return `<svg viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="360" fill="#c9b99f"/><rect y="0" width="640" height="200" fill="#d8cdb8"/>
      <rect x="160" y="30" width="320" height="40" fill="#2f4a3a"/><text x="200" y="57" fill="#f1ead8" font-size="18" font-family="sans-serif">2026 환경공학과 홈커밍데이</text>
      ${ppl.map(fig).join('')}
      <text x="292" y="352" fill="#3b3540" font-size="11" font-family="sans-serif">문혜숙 교수</text></svg>`;
  }

  function map(points) {
    const line = points.map(p => `${p.x},${p.y}`).join(' ');
    return `<svg viewBox="0 0 520 320" xmlns="http://www.w3.org/2000/svg">
      <rect width="520" height="320" fill="#e8e6e0"/>
      <path d="M0,230 C120,210 220,300 360,260 C430,240 470,280 520,270 L520,320 L0,320 Z" fill="#a9c9df"/>
      <text x="300" y="300" fill="#4d7590" font-size="12" font-family="sans-serif">한강</text>
      <path d="M0,150 L520,170" stroke="#fff" stroke-width="8"/><path d="M190,0 L200,320" stroke="#fff" stroke-width="6"/>
      <rect x="95" y="90" width="70" height="55" rx="6" fill="#d5d0c4"/><text x="100" y="84" fill="#555" font-size="11" font-family="sans-serif">도화대학교</text>
      <rect x="390" y="235" width="80" height="30" rx="6" fill="#bcd7b2" opacity=".9"/><text x="380" y="228" fill="#4b6a43" font-size="11" font-family="sans-serif">망원한강공원</text>
      <polyline points="${line}" fill="none" stroke="#e05a47" stroke-width="3" stroke-dasharray="6 5"/>
      ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="${p.last ? 8 : 5}" fill="${p.last ? '#e05a47' : '#fff'}" stroke="#e05a47" stroke-width="3"/>`).join('')}
    </svg>`;
  }

  function watchChart(rows, key, opts) {
    const W = 560, H = 180, pad = 30;
    const vals = rows.map(r => r[key]);
    const min = opts.min, max = opts.max;
    const x = i => pad + i * (W - pad * 2) / (rows.length - 1);
    const y = v => H - pad - (v - min) / (max - min) * (H - pad * 2);
    const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${opts.zero !== undefined ? `<line x1="${pad}" x2="${W - pad}" y1="${y(opts.zero)}" y2="${y(opts.zero)}" stroke="#c9cdd2" stroke-dasharray="4 4"/><text x="${W - pad - 60}" y="${y(opts.zero) - 5}" fill="#8a9099" font-size="10">${opts.zeroLabel}</text>` : ''}
      <polyline points="${pts}" fill="none" stroke="${opts.color}" stroke-width="2.5"/>
      ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${opts.color}"/>`).join('')}
      ${rows.map((r, i) => i % 2 === 0 ? `<text x="${x(i) - 13}" y="${H - 8}" fill="#8a9099" font-size="10">${r.t}</text>` : '').join('')}
    </svg>`;
  }

  function floorplan() {
    const room = (x, y, w, h, label, hl) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${hl ? '#d9ecf7' : '#fff'}" stroke="#2c3e50" stroke-width="2"/><text x="${x + 8}" y="${y + 20}" font-size="12" fill="#2c3e50" font-family="sans-serif">${label}</text>`;
    return `<svg viewBox="0 0 560 420" xmlns="http://www.w3.org/2000/svg"><rect width="560" height="420" fill="#f4f1ea"/>
      <text x="20" y="28" font-size="14" font-weight="700" fill="#2c3e50" font-family="sans-serif">공학2관 단면·평면 (안전점검용)</text>
      <text x="20" y="60" font-size="12" fill="#666" font-family="sans-serif">5F (+18m)</text>${room(90, 44, 200, 50, '수질연구실 501')}${room(300, 44, 160, 50, '세미나실')}
      <text x="20" y="140" font-size="12" fill="#666" font-family="sans-serif">1F (0m)</text>${room(90, 124, 130, 60, '로비 · 정문')}${room(230, 124, 110, 60, '경비실')}${room(350, 124, 110, 60, '후문 · 계단')}
      <line x1="20" y1="200" x2="540" y2="200" stroke="#8b6b3e" stroke-width="3"/><text x="470" y="215" font-size="11" fill="#8b6b3e" font-family="sans-serif">지면</text>
      <text x="20" y="250" font-size="12" fill="#666" font-family="sans-serif">B1 (-4m)</text>
      ${room(90, 230, 150, 80, '시료보관실 (저온 4°C)', true)}${room(250, 230, 100, 80, '기계실')}${room(360, 230, 100, 80, '주차장 연결문')}
      <text x="98" y="275" font-size="10" fill="#1f6f9a" font-family="sans-serif">· 마스터카드 전용</text><text x="98" y="290" font-size="10" fill="#1f6f9a" font-family="sans-serif">· 안쪽에서 열 수 없음</text><text x="98" y="305" font-size="10" fill="#1f6f9a" font-family="sans-serif">· Wi-Fi 중계기 (11/3 설치)</text>
      <rect x="90" y="330" width="370" height="60" fill="#d7d2c6" stroke="#2c3e50"/><text x="200" y="365" font-size="12" fill="#2c3e50" font-family="sans-serif">지하주차장 (B1)</text>
    </svg>`;
  }

  return { cctv, shoeZoom, homecoming, map, watchChart, floorplan, zoomArt };
})();
