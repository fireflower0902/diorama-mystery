(() => {
  const C = window.CASE, T = window.CONTENT, SC = window.SCENES, AU = window.AUDIO, W = window.WORLD;
  const SAVE_KEY = 'case-' + C.id;
  const EV_TOTAL = Object.keys(C.evidence).length;

  /* ───────── 상태 ───────── */
  const fresh = () => ({ started: false, room: C.startRoom || 'lab', seen: [], flags: {}, ev: [], star: [], hints: 0, answersSeen: 0, hintLevel: {}, wrong: 0, elapsed: 0, ending: null, picks: {} });
  let S = load();
  const ui = { view: 'phone.msg', panel: null, lastView: {}, sub: {}, sel: [], introStep: -1, endStep: 0, overlay: null };
  let tickStart = Date.now();

  function load() { if (location.hash === '#reset') { localStorage.removeItem(SAVE_KEY); history.replaceState(null, '', location.pathname); } try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch { return fresh(); } }
  function save() { if (S.started && !S.ending) S.elapsed += (Date.now() - tickStart) / 1000; tickStart = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }
  const has = id => S.ev.includes(id);   // 이제 '드러난 사실' 대신 '모은 증거'로 판단
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nl = s => esc(s).replace(/\n/g, '<br>');
  const $ = sel => document.querySelector(sel);

  /* ───────── 진행 ───────── */
  function collect(id) {
    if (!id || S.ev.includes(id)) return;
    S.ev.push(id); save(); AU.sfx('ev');
    if ((C.keyEvidence || []).includes(id)) W.express('surprised', 3000);
    toast(`증거 추가 · ${C.evidence[id].title} — 수사 수첩에 기록됨`, 'ev');
    renderHeader();
  }
  const stage = () => C.stage(has, S);
  function clockText() {
    const total = C.startClock.h * 60 + C.startClock.m + Math.floor((S.elapsed + (Date.now() - tickStart) / 1000) / 60);
    const h = Math.floor(total / 60) % 24, m = total % 60;
    return `${C.dateLabel} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /* ───────── 레이아웃 ───────── */
  const PANELS = Object.assign(C.panels(T), {
    board: { title: '수사 수첩', icon: '📓', items: [['board', '증거'], ['board.tl', '타임라인'], ['board.people', '인물']] },
    final: { title: '최종 추론', icon: '⚖️', items: [['final', '최종 추론']] },
  });
  const ROOM_NAMES = C.roomNames;
  function openPanel(p, view) {
    ui.panel = p; ui.overlay = null;
    ui.view = view || ui.lastView[p] || PANELS[p].items[0][0];
    if (ui.view === 'phone.call') { ui.sub.call = null; ui.sub.callPick = null; }
    AU.sfx('tap'); render();
  }
  function closePanel() { if (ui.panel === 'phone') { ui.sub.call = null; ui.sub.callPick = null; AU.stopSpeak(); } ui.panel = null; ui.sel = []; render(); }
  function renderHud() {
    const show = S.started && !S.ending;
    $('#hud').className = show && !ui.panel ? 'show' : '';
    if (!show) return;
    $('#hud').innerHTML = `<div class="where">📍 ${ROOM_NAMES[S.room] || ''}</div>
      <div class="hbtns"><button class="hb" data-act="open" data-v="phone">📱<span>내 휴대폰</span></button>
      <button class="hb" data-act="open" data-v="board">📓<span>수사 수첩</span></button>
      <button class="hb" data-act="open" data-v="final">⚖️<span>최종 추론</span></button></div>
      <div class="keys">클릭: 이동·조사 · WASD/방향키: 걷기 · ◆ 아직 안 본 곳</div>`;
  }

  function renderHeader() {
    const snd = `<button class="btn ghost snd ${AU.state.on ? '' : 'off'}" data-act="sound" title="소리 켜기/끄기">${AU.state.on ? '🔊' : '🔇'}</button>`;
    if (!S.started || S.ending) { $('#hdr').innerHTML = `<div class="brand"><b>${esc(C.title)}</b><span>${esc(C.tagline)}</span></div><div class="hstat">${snd}</div>`; return; }
    $('#hdr').innerHTML = `
      <div class="brand"><b>${esc(C.title)}</b><span>${esc(C.tagline)}</span></div>
      <div class="hstat"><span class="clock" id="clock">${clockText()}</span>
        <span class="chip amber">모은 증거 ${S.ev.length}/${EV_TOTAL}</span>
        <button class="btn ghost snd ${AU.state.on ? '' : 'off'}" data-act="sound" title="소리 켜기/끄기">${AU.state.on ? '🔊' : '🔇'}</button><button class="btn ghost" data-act="hint">힌트</button><button class="btn ghost" data-act="menu">⋯</button></div>`;
  }
  function render() {
    renderHeader(); renderHud();
    const P = ui.panel && PANELS[ui.panel];
    $('#panel').className = P ? 'show' : '';
    const area = ui.view.split('.')[0];
    if (P) {
      ui.lastView[ui.panel] = ui.view;
      $('#ptabs').innerHTML = `<b>${P.icon} ${P.title}</b>${P.items.length > 1 ? `<div class="ptabs">${P.items.map(([v, l]) => `<button class="ptab ${ui.view === v ? 'on' : ''}" data-act="go" data-v="${v}">${l}</button>`).join('')}</div>` : '<div class="ptabs"></div>'}<button class="pclose" data-act="closepanel">✕ 닫기</button>`;
      const html = C.lock && ui.panel === C.lock.panel && !S.flags.unlocked ? vLock() : (VIEWS[ui.view] || VIEWS[area])();
      $('#main').innerHTML = html; $('#main').scrollTop = 0;
    } else { $('#main').innerHTML = ''; }
    renderOverlay();
    W.setEnabled(S.started && !S.ending && !ui.panel && !ui.overlay);
    AU.setMood(!S.started ? 'intro' : S.ending ? (S.ending.key === 'true' ? 'end_true' : 'end_bad') : C.mood ? C.mood(S, ui) : 'investigate');
  }

  /* ───────── 화면들 ───────── */
  const bubbles = (msgs, me) => msgs.map(m => m.d ? `<div class="day">${esc(m.d)}</div>`
    : m.sys ? `<div class="sys">${esc(m.sys)}</div>`
    : `<div class="msg ${m.who === me ? 'me' : ''}">${m.who !== me ? `<div class="who">${esc(m.who)}</div>` : ''}<div class="bub">${nl(m.text)}</div><div class="t">${m.t}</div></div>`).join('');

  /* 톡톡(카톡 스타일) 공용 부품: PC(노트북)와 모바일(휴대폰) 모두 사용 */
  const ampm = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`; };
  const PALETTE = ['#e9b38a', '#7d8a99', '#5b4b63', '#2f6f5e', '#c97b7b', '#6b8fb3', '#b39a5a'];
  const avOf = t => t.av || [PALETTE[[...t.name].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length], [...t.name.replace(/[^가-힣A-Za-z0-9]/g, '')][0] || '💬'];
  const avHtml = (a, size = '') => `<div class="ttav ${size}" style="background:${a[0]}">${esc(a[1])}</div>`;
  const lastMsg = t => [...t.msgs].reverse().find(m => m.text || m.sys) || {};
  const groupSize = t => t.group || (new Set(t.msgs.filter(m => m.who).map(m => m.who)).size > 2 ? new Set(t.msgs.filter(m => m.who).map(m => m.who)).size + 1 : 0);
  function ttList(list, key, mobile, cur) {
    const filter = ui.sub[key + 'f'] || 'all', total = list.reduce((n, t) => n + (t.unread || 0), 0);
    const rows = list.filter(t => filter === 'all' || t.unread).map(t => { const lm = lastMsg(t), gs = groupSize(t); return `<button class="ttrow ${cur === t ? 'on' : ''}" data-act="sub" data-k="${key}" data-v="${t.id}">${avHtml(avOf(t))}<div class="ttmid"><div><b>${esc(t.name.replace(/\s*🔕/, ''))}</b>${gs ? `<span>${gs}</span>` : ''}${t.muted || /🔕/.test(t.name) ? '<span class="mute">🔕</span>' : ''}</div><p>${esc(lm.text || lm.sys || '')}</p></div><div class="ttright"><em>${ampm(lm.t || '')}</em>${t.unread ? `<b>${t.unread > 999 ? '999+' : t.unread}</b>` : ''}</div></button>`; }).join('');
    const chips = `<div class="ttchips">${[['all', '전체'], ['unread', '안읽음']].map(([k, l]) => `<button class="ttchip ${filter === k ? 'on' : ''}" data-act="sub" data-k="${key}f" data-v="${k}">${l}${k === 'unread' && total ? `<b>${total}</b>` : ''}</button>`).join('')}</div>`;
    if (!mobile) return chips + rows;
    return `<div class="kktop"><b>채팅</b><span>🔍 💬+ ⚙️</span></div>${chips}<div class="kklist">${rows}</div>
      <div class="kktabs"><i>👤<em>친구</em></i><i class="on">💬${total ? `<b>${total}</b>` : ''}<em>채팅</em></i><i>🗨️<em>오픈채팅</em></i><i>🛍️<em>쇼핑</em></i><i>⋯<em>더보기</em></i></div>`;
  }
  function ttRoom(cur, me, backKey) {
    let html = '', prev = null; const gs = groupSize(cur);
    cur.msgs.forEach((m, i) => {
      if (m.d) { html += `<div class="ttday"><span>📅 ${esc(m.d)}</span></div>`; prev = null; return; }
      if (m.sys) { html += `<div class="ttsys">${esc(m.sys)}</div>`; prev = null; return; }
      const mine = m.who === me, next = cur.msgs[i + 1], lastOfGroup = !next || next.who !== m.who || next.d || next.sys, first = prev !== m.who; prev = m.who;
      const photo = /^\[사진\]/.test(m.text) ? `<div class="ttphoto">🐱<span>${esc(m.text.replace('[사진] ', ''))}</span></div>` : nl(m.text);
      if (mine) html += `<div class="ttmsg me ${first ? 'first' : ''}"><div class="ttmeta">${lastOfGroup ? `<em>${ampm(m.t)}</em>` : ''}</div><div class="ttbub">${photo}</div></div>`;
      else html += `<div class="ttmsg ${first ? 'first' : ''}"><div class="ttside">${first ? avHtml(gs ? [PALETTE[[...m.who].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length], m.who[0]] : avOf(cur), 'sm') : ''}</div><div class="ttcol">${first ? `<div class="ttname">${esc(m.who)}</div>` : ''}<div class="ttline"><div class="ttbub">${photo}</div>${lastOfGroup ? `<em>${ampm(m.t)}</em>` : ''}</div></div></div>`;
    });
    return `<div class="ttroom"><div class="tthead">${backKey ? `<button class="ttback" data-act="sub" data-k="${backKey}" data-v="">‹</button>` : ''}${backKey ? '' : avHtml(avOf(cur), 'sm')}<b>${esc(cur.name.replace(/\s*🔕/, ''))}</b>${gs ? `<span>${gs}</span>` : ''}<i>🔍 ☰</i></div>
      <div class="ttmsgs">${html}</div><div class="ttinput"><i>＋</i><div>메시지 입력</div><span>😊 #</span><button disabled>전송</button></div></div>`;
  }

  const VIEWS = {
    'phone.msg'() {
      const list = T.phone.threads, cur = list.find(t => t.id === ui.sub.pmsg);
      if (cur) { collect(cur.ev); cur.unread = 0; }
      return frame('phone', `<div class="kk">${cur ? ttRoom(cur, '나', 'pmsg') : ttList(list, 'pmsg', true)}</div>`, '톡톡');
    },
    'phone.mail'() { return mailView(T.phone.mails, 'pmail', 'phone', '메일'); },
    'phone.loc'() {
      collect('e_location');
      return frame('phone', `<div class="loc"><div class="mapbox">${SC.map(T.phone.location)}</div>
        <div class="loclist"><div class="lochead">가족 위치 공유 · <b>${esc(C.phoneOwner || '')}</b>의 휴대폰</div>
        ${T.phone.location.map(p => `<div class="lrow ${p.last ? 'last' : ''}"><span>${p.t}</span>${esc(p.place)}</div>`).join('')}
        <p class="muted">위치 공유는 휴대폰 기준입니다. 휴대폰이 꺼지면 위치도 멈춥니다.</p></div></div>`, '위치 공유');
    },
    'phone.call'() {
      const call = ui.sub.call;
      if (call) {
        const d = T.detectiveCall;
        const chosen = ui.sub.callPick && d.options.find(o => o.id === ui.sub.callPick);
        return frame('phone', `<div class="call"><div class="callee"><div class="avatar">김</div><b>김도경 형사</b><span>통화 중</span></div>
          <div class="lines">${d.opening.map(l => `<p class="them">${esc(l)}</p>`).join('')}
          ${chosen ? `<p class="mine">"${esc(chosen.label)}"</p><p class="them">${esc(chosen.reply)}</p>` : ''}</div>
          ${chosen ? `<button class="btn" data-act="hangup">통화 종료</button>` : `<div class="opts">${d.options.map(o => {
            const ok = !o.needsEv || o.needsEv.every(has);
            return `<button class="opt ${ok ? '' : 'dis'}" ${ok ? `data-act="say" data-v="${o.id}"` : 'disabled'}>${ok ? esc(o.label) : '🔒 (이 말을 뒷받침할 기록을 아직 찾지 못했다)'}</button>`;
          }).join('')}</div>`}</div>`, '전화');
      }
      return frame('phone', `<div class="contacts">${(T.phone.contacts || []).map(c => `<button class="crow" data-act="dial" data-v="${c.id}"><div class="avatar">${esc(c.name[0])}</div><div><b>${esc(c.name)}</b><span>${esc(c.sub)}</span></div><i>📞</i></button>`).join('')}
        ${S.flags.records && T.detectiveCall ? `<p class="muted">${esc(T.detectiveCall.after || '')}</p>` : ''}</div>`, '전화');
    },
    'lap.chat'() {
      const list = T.laptop.chats, cur = list.find(t => t.id === ui.sub.lchat);
      if (cur) { collect(cur.ev); cur.unread = 0; }
      const totalUnread = list.reduce((n, t) => n + (t.unread || 0), 0);
      return frame('laptop', `<div class="tt">
        <div class="ttrail"><i>👤</i><i class="on">💬${totalUnread ? `<b>${totalUnread}</b>` : ''}</i><i>⋯</i><span class="ttbottom"><i>🔔</i><i>⚙️</i></span></div>
        <div class="ttlist">${ttList(list, 'lchat', false, cur)}</div>
        ${cur ? ttRoom(cur, C.phoneOwner === '나' ? '나' : '서윤') : `<div class="ttroom empty"><div>💬</div><p>대화를 선택하세요</p></div>`}</div>`, '톡톡');
    },
    'lap.mail'() {
      const box = ui.sub.box || '받은편지함';
      const list = T.laptop.mails.filter(m => m.box === box);
      return frame('laptop', `<div class="tabs">${['받은편지함', '예약'].map(b => `<button class="tab ${b === box ? 'on' : ''}" data-act="sub" data-k="box" data-v="${b}">${b === '예약' ? '예약 메일함' : b}</button>`).join('')}</div>` + mailInner(list, 'lmail'), '메일');
    },
    'lap.cloud'() {
      const cl = T.laptop.cloud;
      const open = ui.sub.ver;
      if (open) collect('e_cloud');
      return frame('laptop', `<div class="cloud"><div class="crumb">내 드라이브 › 공유 드라이브 › <b>${esc(cl.folder)}</b></div>
        <table class="tbl"><tr><th>이름</th><th>마지막 수정</th><th>수정한 사람</th><th>크기</th><th></th></tr>
        ${cl.files.map(f => `<tr><td>📄 ${esc(f.name)}</td><td>${f.t}</td><td>${esc(f.by)}</td><td>${f.size}</td><td>${f.versions ? `<button class="btn sm" data-act="sub" data-k="ver" data-v="1">버전 기록</button>` : ''}</td></tr>`).join('')}</table>
        ${open ? `<div class="versions"><h4>보고서_최종.xlsx · 버전 기록</h4>${cl.versions.map(v => `<div class="vrow ${v.hl ? 'hl' : ''}"><b>${v.v}</b><span>${v.t} · ${esc(v.by)}</span><p>${esc(v.change)}</p></div>`).join('')}</div>` : ''}</div>`, '클라우드');
    },
    'lap.notes'() {
      const cur = T.laptop.notes.find(n => n.id === ui.sub.note);
      if (cur) collect(cur.ev);
      return frame('laptop', `<div class="split notes">
        <div class="list">${T.laptop.notes.map(n => `<button class="row ${cur === n ? 'on' : ''}" data-act="sub" data-k="note" data-v="${n.id}"><b>${esc(n.title)}</b><span>${n.t}</span></button>`).join('')}</div>
        <div class="pane paper">${cur ? `<h3>${esc(cur.title)}</h3><div class="muted">${cur.t}</div><p>${nl(cur.body)}</p>` : empty('메모를 고르세요')}</div></div>`, '메모');
    },
    'lap.health'() {
      const w = T.laptop.watch, tab = ui.sub.htab || 'hr';
      collect(tab === 'hr' ? 'e_watch' : 'e_watchalt');
      const chart = tab === 'hr'
        ? `<div class="chartcap">심박수 (bpm)</div>${SC.watchChart(w.rows, 'hr', { min: 40, max: 135, color: '#e0574f' })}`
        : `<div class="chartcap">상대 고도 (m, 지면 기준)</div>${SC.watchChart(w.rows, 'alt', { min: -8, max: 22, color: '#3b82c4', zero: 0, zeroLabel: '지면 0m' })}
           <div class="chartcap">피부 온도 (°C)</div>${SC.watchChart(w.rows, 'skin', { min: 27, max: 34, color: '#d08a2a' })}`;
      return frame('laptop', `<div class="health"><div class="hhead"><b>${esc(w.device)}</b><span>마지막 동기화 11월 15일 03:10 · Wi-Fi</span></div>
        <div class="tabs">${[['hr', '심박·걸음'], ['alt', '고도·피부 온도']].map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-act="sub" data-k="htab" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="chart">${chart}</div>
        <table class="tbl small"><tr><th>동기화</th><th>네트워크</th><th>심박</th><th>걸음</th><th>고도</th><th>피부 온도</th><th></th></tr>
        ${w.rows.map(r => `<tr><td>${r.t}</td><td>${w.ssid}</td><td>${r.hr}</td><td>${r.steps}</td><td>${r.alt > 0 ? '+' : ''}${r.alt}m</td><td>${r.skin}°C</td><td class="muted">${r.note || ''}</td></tr>`).join('')}</table>
        <p class="muted">워치는 휴대폰 없이도 등록된 Wi-Fi로 기록을 올립니다. 위치(GPS)는 휴대폰이 있어야 기록됩니다.</p></div>`, '헬스 클라우드');
    },
    rec() {
      const r = T.records[ui.view.split('.')[1]];
      collect(r.ev);
      const cols = r.cols;
      return frame('doc', `<div class="doc"><div class="dochead"><b>${esc(r.title)}</b><span>${esc(r.range)}${r.provider ? ' · ' + esc(r.provider) : ''}</span></div>
        <table class="tbl mono"><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
        ${r.rows.map(row => `<tr>${row.slice(0, cols.length).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>
        <p class="muted">${esc(r.foot)}</p></div>`, '수사 자료');
    },
    cctv() {
      const cam = T.cctv.find(c => 'cctv.' + c.id === ui.view);
      const fi = Math.min(ui.sub['f_' + cam.id] || 0, cam.frames.length - 1), f = cam.frames[fi];
      if (f.ev && !f.zoom) collect(f.ev);
      const day = f.day || (f.t < '12' ? '2026-11-15' : '2026-11-14');
      return frame('cctv', `<div class="cctv">
        <div class="screen">${SC.cctv(cam.scene, f.figs)}<div class="osd"><span>● REC</span><span>${esc(cam.name)}</span><span>${day} ${f.t}</span></div><div class="scan"></div></div>
        <div class="caption">${esc(f.caption)}${f.zoom ? ` <button class="btn sm" data-act="zoom" data-v="${f.zoom}" data-ev="${f.ev}">🔍 ${esc(f.zoomLabel || '발 부분 확대')}</button>` : ''}</div>
        <div class="timeline">${cam.frames.map((fr, i) => `<button class="tframe ${i === fi ? 'on' : ''}" data-act="sub" data-k="f_${cam.id}" data-v="${i}">${fr.t}</button>`).join('')}</div>
        <p class="muted">움직임이 감지된 구간만 저장된 영상입니다. 시각을 눌러 이동하세요.</p></div>`, 'CCTV 뷰어');
    },
    diary() {
      collect('e_memo');
      return `<div class="diary"><div class="dcover">한서윤 · 연구 노트 2026</div>${T.diary.map(p => `<div class="dpage"><div class="dd">${esc(p.d)}</div><p>${nl(p.text)}</p></div>`).join('')}</div>`;
    },
    board() {
      const groups = C.evidenceGroups || [['내 휴대폰', '📱'], ['노트북', '💻'], ['CCTV', '📹'], ['기록', '🗂']];
      const f = ui.sub.bf || 'all';
      const list = S.ev.filter(id => f === 'all' ? true : f === 'star' ? S.star.includes(id) : C.evidence[id].src.startsWith(f));
      return `<div class="board"><div class="bhead"><h2>수사 수첩</h2><p>모은 증거가 자동으로 기록된다. 무엇이 무엇과 이어지는지, 누가 거짓말을 하는지는 <b>당신이 판단</b>한다. 중요한 증거에는 ★를 표시해 두자.</p></div>
        <div class="bfilter">${[['all', `전체 ${S.ev.length}`], ['star', `★ ${S.star.length}`], ...groups.map(([g, i]) => [g, `${i} ${g} ${S.ev.filter(id => C.evidence[id].src.startsWith(g)).length}`])].map(([k, l]) => `<button class="ttchip ${f === k ? 'on' : ''}" data-act="sub" data-k="bf" data-v="${k}">${l}</button>`).join('')}
          <span class="muted">모은 증거 ${S.ev.length}/${EV_TOTAL}</span></div>
        <div class="cards">${list.length ? list.map(id => { const e = C.evidence[id], on = S.star.includes(id); return `<div class="card ${on ? 'sel' : ''}"><button class="star ${on ? 'on' : ''}" data-act="star" data-v="${id}" title="중요 표시">★</button><span>${esc(e.src)}</span><b>${esc(e.title)}</b><p>${esc(e.note)}</p></div>`; }).join('') : '<p class="muted">아직 없다. 공간을 돌아다니며 사물을 조사해 보자.</p>'}</div></div>`;
    },
    'board.tl'() {
      const key = w => { const m = w.match(/(\d+)\/(\d+)(?:\s+(\d+):(\d+))?/); return m ? ((+m[1]) * 1e6 + (+m[2]) * 1e4 + (+(m[3] || 0)) * 100 + (+(m[4] || 0))) : 0; };
      const rows = S.ev.flatMap(id => (C.timeline[id] || []).map(([w, t]) => ({ w, t, id, k: key(w) }))).sort((a, b) => a.k - b.k);
      let lastDay = '';
      return `<div class="board"><div class="bhead"><h2>타임라인</h2><p>모은 증거 속 시각을 시간순으로 늘어놓았다. 같은 시각, 서로 다른 기록이 무엇을 말하는지 살펴보자.</p></div>
        <div class="tl">${rows.length ? rows.map(r => { const [d, tm] = r.w.split(' '); const day = d !== lastDay ? `<div class="tlday">${d}</div>` : ''; lastDay = d; return `${day}<div class="tlrow ${S.star.includes(r.id) ? 'star' : ''}"><em>${tm || ''}</em><i></i><div><p>${esc(r.t)}</p><span>${esc(C.evidence[r.id].src)} · ${esc(C.evidence[r.id].title)}</span></div></div>`; }).join('') : '<p class="muted">아직 시각이 있는 증거가 없다.</p>'}</div></div>`;
    },
    'board.people'() {
      return `<div class="board"><div class="bhead"><h2>인물</h2><p>각 인물이 한 말과 주장. <b>본인의 주장은 사실이 아닐 수도 있다.</b> 다른 기록과 맞는지 직접 따져 보자.</p></div>
        <div class="people">${C.people.map(p => { const cl = p.claims.filter(([ev]) => has(ev)); return `<div class="person"><div class="pav">${esc(p.name[0])}</div><div><b>${esc(p.name)}</b><span>${esc(p.role)}</span>${cl.length ? `<ul>${cl.map(([, t]) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="muted">아직 알려진 말이 없다.</p>'}</div></div>`; }).join('')}</div></div>`;
    },
    final() {
      return `<div class="final"><h2>최종 추론</h2><p class="muted">한 번 제출하면 결말이 정해진다. 모은 증거 ${S.ev.length}/${EV_TOTAL}. 수사 수첩의 타임라인과 인물을 다시 확인해 보자.</p>
        ${C.final.map((q, n) => `<div class="q"><b>${n + 1}. ${esc(q.q)}</b>${q.options.map(o => `<label class="${S.picks[q.id] === o.id ? 'on' : ''}"><input type="radio" name="${q.id}" data-act="pickans" data-q="${q.id}" data-v="${o.id}" ${S.picks[q.id] === o.id ? 'checked' : ''}> ${esc(o.label)}</label>`).join('')}</div>`).join('')}
        <button class="btn big" data-act="submit" ${C.final.every(q => S.picks[q.id]) ? '' : 'disabled'}>추론 제출</button></div>`;
    },
  };

  function mailView(list, key, kind, title) { return frame(kind, mailInner(list, key), title); }
  function mailInner(list, key) {
    const cur = list.find(m => m.id === ui.sub[key]);
    if (cur) collect(cur.ev);
    return `<div class="split mail"><div class="list">${list.map(m => `<button class="row ${cur === m ? 'on' : ''}" data-act="sub" data-k="${key}" data-v="${m.id}"><b>${esc(m.from)}</b><span>${esc(m.subject)}</span><em>${m.t}</em></button>`).join('')}</div>
      <div class="pane paper">${cur ? `<h3>${esc(cur.subject)}</h3><div class="mhead">보낸 사람 ${esc(cur.from)}${cur.to ? ` · 받는 사람 ${esc(cur.to)}` : ''}<br>${cur.t}</div>
        ${cur.status ? `<div class="status">⚠ ${esc(cur.status)}</div>` : ''}
        <p>${nl(cur.body)}</p>
        ${cur.table ? `<table class="tbl">${cur.table.map((r, i) => `<tr>${r.map(c => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</table>` : ''}
        ${cur.photo === 'homecoming' ? `<div class="photo">${SC.homecoming(false)}<button class="btn sm" data-act="zoom" data-v="homecoming">🔍 확대</button></div>` : ''}
        ${cur.photo === 'floorplan' ? `<div class="photo plan">${SC.floorplan()}</div>` : ''}` : empty('메일을 고르세요')}</div></div>`;
  }
  function frame(kind, inner, title) { return `<div class="device ${kind}"><div class="dbar"><i></i><i></i><i></i><span>${esc(title)}</span></div><div class="dbody">${inner}</div></div>`; }
  const empty = t => `<div class="empty">${esc(t)}</div>`;
  function vLock() {
    return `<div class="device laptop lockscr"><div class="dbody"><div class="lockbox"><div class="avatar big">${esc(C.lock.avatar)}</div><b>${esc(C.lock.name)}</b>
      <form data-form="pw"><input id="pw" type="password" placeholder="암호 입력" autocomplete="off"><button class="btn">↵</button></form>
      <p class="muted">암호 힌트: ${esc(C.lock.hint)}</p><p class="err" id="pwerr"></p></div></div></div>`;
  }
  function vNoRecords() {
    return `<div class="empty big">🔒 아직 받지 못한 자료다.<br><span class="muted">경찰은 서윤이 스스로 한강에 갔다고 보고 있다. 김도경 형사를 움직일 근거가 필요하다.</span></div>`;
  }

  /* ───────── 오버레이 ───────── */
  function renderOverlay() {
    const o = $('#overlay');
    if (!S.started) { o.className = 'show intro'; o.innerHTML = introHTML(); return; }
    if (S.ending) { o.className = 'show ending'; o.innerHTML = endingHTML(); return; }
    if (!ui.overlay) { o.className = ''; o.innerHTML = ''; return; }
    o.className = 'show';
    const x = ui.overlay;
    if (x.type === 'insight-removed') {
      const i = null;
      o.innerHTML = modal(`<div class="kick">새로운 사실</div><h2>${esc(i.title)}</h2><p>${esc(i.text)}</p>`);
    } else if (x.type === 'zoom') {
      const svg = x.v === 'homecoming' ? SC.homecoming(true) : (SC.zoomArt && SC.zoomArt(x.v)) || SC.shoeZoom(x.v);
      const cap = (T.zoomCaptions || {})[x.v] || (x.v === 'loafer' ? '굽 낮은 갈색 로퍼. 발등에 금색 버클이 달려 있다.' : x.v === 'sneaker' ? '흰 운동화. 옆면에 하늘색 줄.' : '문혜숙 교수의 신발: 금색 버클이 달린 갈색 로퍼.');
      o.innerHTML = modal(`<div class="kick">확대</div><div class="zoomimg ${x.v !== 'homecoming' ? 'cctvz' : ''}">${svg}</div><p>${cap}</p>`);
    } else if (x.type === 'hint') {
      const st = stage(), list = C.hints[st], lv = S.hintLevel[st] || 0;
      o.innerHTML = modal(`<div class="kick">힌트</div><h2>지금 막힌 곳</h2>
        ${list.slice(0, lv).map((h, n) => `<div class="hint ${n === 2 ? 'ans' : ''}"><b>${n === 2 ? '정답' : n + 1 + '단계'}</b><p>${esc(h)}</p></div>`).join('')}
        ${lv < 3 ? `<button class="btn" data-act="morehint">${lv === 0 ? '첫 힌트 보기' : lv === 1 ? '다음 힌트 보기' : '정답 보기'}</button>` : ''}
        <p class="muted">힌트는 점수를 조금, 정답은 많이 깎는다.</p>`);
    } else if (x.type === 'examine') {
      const e = T.examine[x.id]({ records: !!S.flags.records, has, hasEv: has, unlocked: !!S.flags.unlocked, flags: S.flags });
      o.innerHTML = modal(`<div class="kick">${esc(e.kick || '조사')}</div><h2>${esc(e.title)}</h2>${e.lines ? e.lines.map(([w, l]) => `<p class="say"><b>${esc(w)}</b>${esc(l)}</p>`).join('') : `<p>${nl(e.body)}</p>`}
        ${e.action ? `<button class="btn" data-act="${e.action.act}" data-v="${e.action.v || ''}">${esc(e.action.label)}</button>` : ''}`);
    } else if (x.type === 'elevator') {
      const floors = C.floors || [];
      o.innerHTML = modal(`<div class="kick">엘리베이터</div><h2>몇 층으로 갈까?</h2><div class="floors">${floors.map(([id, f, l]) => {
        const lock = floors.find(f => f[0] === id)[3] && !S.flags[floors.find(f => f[0] === id)[3]];
        return `<button class="floor ${S.room === id ? 'here' : ''}" ${lock ? 'disabled' : `data-act="floor" data-v="${id}"`}><b>${f}</b><span>${lock ? '🔒 관계자 카드가 필요하다' : l}${S.room === id ? ' · 현재 층' : ''}</span></button>`;
      }).join('')}</div>`);
    } else if (x.type === 'menu') {
      o.innerHTML = modal(`<div class="kick">메뉴</div><h2>${esc(C.title)}</h2><p class="muted">진행 상황은 이 브라우저에 자동 저장된다.</p>
        <div class="sndset"><b>소리</b>${[['on', '전체 소리'], ['bgm', '배경음'], ['sfx', '효과음'], ['voice', '음성 (대사·내레이션)']].map(([k, l]) => `<label><input type="checkbox" data-act="snd" data-v="${k}" ${AU.state[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
        <div class="sndset voices"><b>목소리 (미리 듣기)</b>${(C.voiceTest || []).map(([k, l]) => `<button class="vrow2" data-act="voicetest" data-v="${k}"><span>▶ ${l}</span><em>${esc(AU.voiceInfo()[k])}</em></button>`).join('')}</div>
        <div class="sndset"><b>사건 바꾸기</b>${CASE_LIST.map(c => `<button class="vrow2" data-act="switchcase" data-v="${c.id}"><span>${c.id === CASE_ID ? '▶ ' : ''}${esc(c.title)}</span><em>${esc(c.minutes)} · ${esc(c.where)}</em></button>`).join('')}</div>
        <button class="btn" data-act="replayintro">인트로 다시 보기</button> <button class="btn danger" data-act="reset">처음부터 다시</button>`);
    }
  }
  const modal = inner => `<div class="modal" data-stop>${inner}<button class="x" data-act="close">✕</button></div>`;

  function introHTML() {
    if (ui.introStep < 0) return `<div class="slide gate"><div class="kick">사건 선택</div><div class="cases">${CASE_LIST.map(c => `<button class="casecard ${c.id === CASE_ID ? 'on' : ''}" data-act="switchcase" data-v="${c.id}"><b>${esc(c.title)}</b><p>${esc(c.tag)}</p><span>⏱ ${esc(c.minutes)} · ${esc(c.level)} · ${esc(c.where)}</span></button>`).join('')}</div>
      <div class="title">${esc(C.title)}</div><p class="tag">${esc(C.tagline)}</p>
      <button class="btn big" data-act="intro">사건 파일 열기</button><p class="muted">🔊 소리를 켜고, 가능하면 이어폰으로 플레이하세요.<br>오른쪽 위 🔊 버튼으로 언제든 끌 수 있습니다.</p></div>`;
    const s = C.intro[ui.introStep], last = ui.introStep === C.intro.length - 1;
    return `<div class="slide"><div class="title">${esc(C.title)}</div><div class="kick">${esc(s.kicker)}</div><p>${esc(s.text)}</p>
      ${last ? `<div class="howto"><b>플레이 방법</b><br>· 바닥을 클릭하거나 WASD/방향키로 걷는다. 사물을 클릭하면 다가가서 조사한다. ◆ 표시는 아직 안 본 곳.<br>· ${esc(C.howto || '')}<br>· 모은 증거는 오른쪽 아래 <b>📓 수사 수첩</b>에 자동으로 기록된다. 타임라인과 인물별 주장을 보며 직접 추리하자.<br>· 결론이 서면 <b>⚖️ 최종 추론</b>.<br>· 막히면 오른쪽 위 <b>힌트</b>.</div>` : ''}
      <div class="dots">${C.intro.map((_, i) => `<i class="${i <= ui.introStep ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn big" data-act="intro">${last ? '수사 시작' : '다음'}</button></div>`;
  }
  function endingHTML() {
    const e = C.endings[S.ending.key], slides = e.slides;
    if (ui.endStep < slides.length) {
      return `<div class="slide end"><div class="kick">${e.kind}</div><div class="title">${esc(e.title)}</div><p>${esc(slides[ui.endStep])}</p>
        <div class="dots">${slides.map((_, i) => `<i class="${i <= ui.endStep ? 'on' : ''}"></i>`).join('')}</div><button class="btn big" data-act="endnext">계속</button></div>`;
    }
    const r = S.ending.result;
    return `<div class="slide end result"><div class="kick">${e.kind}</div><div class="title">${esc(e.title)}</div>
      <div class="grade">${r.grade}<span>${r.score}점</span></div>
      <div class="stats"><div><b>${r.min}분</b><span>수사 시간</span></div><div><b>${S.ev.length}/${EV_TOTAL}</b><span>증거</span></div><div><b>${S.star.length}</b><span>★ 표시</span></div><div><b>${S.hints}</b><span>힌트</span></div><div><b>${S.answersSeen}</b><span>정답 보기</span></div></div>
      <div class="answers">${C.final.map(q => `<div class="${S.picks[q.id] === q.answer ? 'ok' : 'no'}">${S.picks[q.id] === q.answer ? '○' : '✕'} ${esc(q.q)}</div>`).join('')}</div>
      ${S.ev.length < EV_TOTAL ? `<p class="muted">아직 찾지 못한 증거가 ${EV_TOTAL - S.ev.length}개 있다.</p>` : ''}
      <button class="btn big" data-act="reset">처음부터 다시</button></div>`;
  }

  function submit() {
    const p = S.picks, A = Object.fromEntries(C.final.map(q => [q.id, q.answer]));
    const key = C.endingKey(p, A);
    save();
    const min = Math.max(1, Math.round(S.elapsed / 60));
    const correct = C.final.filter(q => p[q.id] === q.answer).length;
    let score = 1000 - (C.final.length - correct) * 160 - (EV_TOTAL - S.ev.length) * 12 - S.hints * 30 - S.answersSeen * 80 - Math.max(0, min - (C.parMinutes || 20)) * 4;
    score = Math.max(0, Math.min(1000, score));
    const grade = key !== 'true' ? (S.ev.length >= EV_TOTAL * 0.7 ? 'B' : 'C') : score >= 900 ? 'S' : score >= 750 ? 'A' : 'B';
    S.ending = { key, result: { score, grade, min } }; ui.endStep = 0; save(); render();
  }

  /* ───────── 이벤트 ───────── */
  let toastN = 0;
  function toast(text, kind = '') {
    const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = text;
    const box = $('#toasts'); box.appendChild(el); while (box.children.length > 3) box.firstChild.remove(); const n = ++toastN;
    setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3100); return n;
  }

  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-act]');
    if (!t) { if (ev.target.id === 'overlay' && ui.overlay) { ui.overlay = null; render(); } return; }
    const a = t.dataset.act, v = t.dataset.v;
    AU.unlock();
    switch (a) {
      case 'open': openPanel(v); break;
      case 'closepanel': AU.sfx('tap'); closePanel(); break;
      case 'floor': ui.overlay = null; AU.sfx('elev'); if (v !== S.room) { S.room = v; save(); W.goRoom(v); } render(); break;
      case 'tofinal': openPanel('final'); break;
      case 'go': AU.sfx('tap'); ui.view = v; if (v === 'phone.call') { ui.sub.call = null; ui.sub.callPick = null; } render(); break;
      case 'sub': AU.sfx(t.dataset.k.startsWith('f_') ? 'static' : 'tap'); ui.sub[t.dataset.k] = isNaN(v) ? v : +v; render(); break;
      case 'dial':
        { const ct = T.phone.contacts.find(c => c.id === v);
          if (ct.call) { ui.sub.call = v; ui.sub.callPick = null; render(); AU.sfx('ring'); setTimeout(() => AU.speak(T.detectiveCall.opening.join(' '), 'detective'), 2000); }
          else { AU.sfx('busy'); toast(ct.toast || '전화를 받지 않는다.'); } }
        break;
      case 'say': {
        ui.sub.callPick = v;
        const o = T.detectiveCall.options.find(o => o.id === v);
        AU.speakSeq([[o.label, 'me'], [o.reply, 'detective']]);
        if (o.unlock && !S.flags[o.unlock]) { S.flags[o.unlock] = true; save(); setTimeout(() => { AU.sfx('msg'); toast(T.detectiveCall.toast || '자료가 도착했다.', 'ev'); }, 400); }
        render(); break;
      }
      case 'hangup': AU.stopSpeak(); AU.sfx('hangup'); ui.sub.call = null; ui.sub.callPick = null; render(); break;
      case 'star': { AU.sfx('tap'); const i = S.star.indexOf(v); if (i >= 0) S.star.splice(i, 1); else S.star.push(v); save(); render(); break; }
      case 'zoom': AU.sfx('zoom'); if (t.dataset.ev) collect(t.dataset.ev); ui.overlay = { type: 'zoom', v }; render(); break;
      case 'hint': AU.sfx('tap'); ui.overlay = { type: 'hint' }; render(); break;
      case 'morehint': { AU.sfx('hint'); const st = stage(); const lv = (S.hintLevel[st] || 0) + 1; S.hintLevel[st] = lv; if (lv === 3) S.answersSeen++; else S.hints++; save(); render(); break; }
      case 'menu': AU.sfx('tap'); ui.overlay = { type: 'menu' }; render(); break;
      case 'close': ui.overlay = null; render(); break;
      case 'intro':
        if (ui.introStep < C.intro.length - 1) { ui.introStep++; AU.sfx('page'); const sl = C.intro[ui.introStep]; AU.speak(sl.kicker + '. ' + sl.text); }
        else { S.started = true; ui.introStep = -1; tickStart = Date.now(); save(); AU.stopSpeak(); AU.sfx('unlock'); }
        render(); break;
      case 'replayintro': S.started = false; ui.overlay = null; ui.introStep = -1; render(); break;
      case 'reset': if (confirm('모든 진행이 사라집니다. 처음부터 다시 할까요?')) { localStorage.removeItem(SAVE_KEY); S = fresh(); AU.stopSpeak(); Object.assign(ui, { view: 'phone.msg', panel: null, lastView: {}, sub: {}, sel: [], overlay: null, introStep: -1, endStep: 0 }); tickStart = Date.now(); W.goRoom(C.startRoom, false); render(); } break;
      case 'pickans': AU.sfx('tap'); S.picks[t.dataset.q] = v; save(); render(); break;
      case 'submit': if (confirm('이 추론으로 제출할까요? 결말이 정해집니다.')) { submit(); AU.sfx('sting'); setTimeout(() => AU.speak(C.endings[S.ending.key].slides[0]), 900); } break;
      case 'endnext': {
        ui.endStep++; const sl = C.endings[S.ending.key].slides;
        if (ui.endStep < sl.length) { AU.sfx('page'); AU.speak(sl[ui.endStep]); } else { AU.stopSpeak(); AU.sfx('result'); }
        render(); break;
      }
      case 'sound': AU.toggle('on'); if (AU.state.on) AU.sfx('tap'); renderHeader(); if (ui.overlay?.type === 'menu') renderOverlay(); break;
      case 'snd': AU.toggle(v); renderHeader(); renderOverlay(); break;
      case 'voicetest': { const vt = C.voiceTest.find(x => x[0] === v); AU.speak(vt[2], v); break; }
      case 'switchcase': if (v !== CASE_ID) { save(); localStorage.setItem('case-current', v); location.href = location.pathname + '?case=' + v; } break;
    }
  });
  document.addEventListener('submit', ev => {
    if (ev.target.dataset.form !== 'pw') return;
    ev.preventDefault();
    const val = $('#pw').value.trim();
    if (C.laptopPasswords.includes(val) || C.laptopPasswords.includes(val.toLowerCase())) {
      S.flags.unlocked = true; save(); AU.unlock(); AU.sfx('unlock'); W.express('smile'); ui.view = C.lock.open; toast('노트북 잠금이 풀렸다.', 'ev'); W.goRoom(S.room, false); render();
    } else { AU.unlock(); AU.sfx('lock'); $('#pwerr').textContent = '암호가 맞지 않습니다.'; $('#pw').value = ''; $('.lockbox').classList.remove('shake'); void $('.lockbox').offsetWidth; $('.lockbox').classList.add('shake'); }
  });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (ui.overlay && S.started && !S.ending) { ui.overlay = null; render(); } else if (ui.panel) closePanel(); });
  setInterval(() => { const c = $('#clock'); if (c) c.textContent = clockText(); }, 15000);
  window.addEventListener('beforeunload', save);

  function markSeen(id) { if (!S.seen.includes(id)) { S.seen.push(id); save(); } }
  W.init($('#world'), {
    player: C.player || 'seojin',
    isSeen: id => S.seen.includes(id),
    onRoom: (id) => { S.room = id; renderHud(); },
    onToast: t => toast(t),
    onInteract(o) {
      AU.unlock(); markSeen(o.id);
      if (o.act === 'panel') { if (o.gate && !S.flags[o.gate]) { AU.sfx('lock'); ui.overlay = { type: 'examine', id: o.gateExamine || 'guard' }; render(); } else openPanel(o.panel); return; }
      if (o.act === 'drawer') { W.openDrawer(); AU.sfx('drawer'); setTimeout(() => openPanel('diary'), 500); return; }
      if (o.act === 'elevator') { AU.sfx('tap'); ui.overlay = { type: 'elevator' }; render(); return; }
      AU.sfx('tap');
      ui.overlay = { type: 'examine', id: o.id };
      const e = T.examine[o.id]({ records: !!S.flags.records, has, hasEv: has, unlocked: !!S.flags.unlocked, flags: S.flags });
      W.express(e.mood || (o.id === 'colddoor' ? 'sad' : o.id === 'frame' ? 'gentle' : o.npc ? 'calm' : 'sharp'), 3500);
      if (e.ev) [].concat(e.ev).forEach(collect);
      if (e.lines) AU.speakSeq(e.lines.map(([w, l]) => [l, e.voice || 'narrator'])); 
      render();
    },
  });
  W.goRoom(S.room || C.startRoom, false);
  render();
})();
