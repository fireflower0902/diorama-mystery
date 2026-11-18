/* 게임 엔진: 화면(헤더·무대·독), 패널(휴대폰·노트북·CCTV…), 사건 파일, 생각하기, 결론 대화, 결말.
 * 사건마다 다른 내용은 cases/<id>/data.js(규칙)와 content.js(콘텐츠)에 있다. */
(() => {
  const C = window.CASE, T = window.CONTENT, SC = window.SCENES, AU = window.AUDIO, W = window.WORLD;
  const BRAND = '미니 추리 게임';
  const SAVE_KEY = 'case-' + C.id;
  document.title = `${C.title} · ${BRAND}`;
  const narrow = () => innerWidth < 760;

  /* ───────── 상태 ───────── */
  const fresh = () => ({ started: false, room: C.startRoom || 'lab', seen: [], flags: {}, ev: [], star: [], newEv: [], read: [], thinks: 0, thinkLv: {}, elapsed: 0, ending: null, vres: {}, vfail: 0 });
  let S = load();
  const ui = { view: 'phone.msg', panel: null, lastView: {}, sub: {}, introStep: -1, endStep: 0, overlay: null, vd: null };
  let tickStart = Date.now(), lastProgress = Date.now();

  function load() { if (location.hash === '#reset') { localStorage.removeItem(SAVE_KEY); history.replaceState(null, '', location.pathname + location.search); } try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch { return fresh(); } }
  function save() { if (S.started && !S.ending) S.elapsed += (Date.now() - tickStart) / 1000; tickStart = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }
  const has = id => S.ev.includes(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nl = s => esc(s).replace(/\n/g, '<br>');
  const $ = sel => document.querySelector(sel);
  const fn = (v, ...a) => typeof v === 'function' ? v(...a) : v;

  /* ───────── 진행 ───────── */
  function collect(id) {
    if (!id || S.ev.includes(id) || !C.evidence[id]) return;
    S.ev.push(id); S.newEv.push(id); lastProgress = Date.now(); save(); AU.sfx('ev');
    if ((C.keyEvidence || []).includes(id)) W.express('surprised', 3000);
    toast(`📎 ${C.evidence[id].title}`, 'ev', '사건 파일에 끼워 두었다');
    renderDock();
  }
  const stage = () => C.stage(has, S);
  const ctx = () => ({ records: !!S.flags.records, has, hasEv: has, unlocked: !!S.flags.unlocked, flags: S.flags });
  function clockText() {
    const total = C.startClock.h * 60 + C.startClock.m + Math.floor((S.elapsed + (Date.now() - tickStart) / 1000) / 60);
    const h = Math.floor(total / 60) % 24, m = total % 60;
    return `${C.dateLabel} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /* ───────── 그림 (3D 스냅샷) ───────── */
  const AV = T.avatars || {};
  const pf = (fig, mood) => fig ? W.portrait(fig, mood) : '';
  const photo = key => { const p = (T.photos || {})[key]; return p ? W.snap(Object.assign({ key: 'ph:' + key }, p)) : ''; };
  const shotOf = (cam, f, i) => W.snap(Object.assign({ key: `cc:${cam.id}:${i}` }, cam.shot, { figs: f.figs || [], door: f.door }));

  /* ───────── 아이콘 ───────── */
  const ICON = {
    phone: '<svg viewBox="0 0 32 32"><rect x="9" y="3" width="14" height="26" rx="3.5" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="13.5" y="6" width="5" height="1.6" rx=".8" fill="currentColor"/><circle cx="16" cy="25" r="1.6" fill="currentColor"/><path d="M12.5 13.5h7M12.5 17h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".7"/></svg>',
    file: '<svg viewBox="0 0 32 32"><path d="M4 9.5a2 2 0 0 1 2-2h6l2.5 2.5H26a2 2 0 0 1 2 2V24a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9 15h10M9 19h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".7"/><circle cx="23" cy="19" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    think: '<svg viewBox="0 0 32 32"><path d="M9 21c-3 0-5-2.2-5-5s2.2-5 5-5c.6-3 3.2-5 6.5-5 3 0 5.5 1.8 6.3 4.4C25 10.5 28 13 28 16.3 28 19 25.8 21 23 21z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="8" cy="25" r="1.8" fill="currentColor"/><circle cx="4.6" cy="28.4" r="1.1" fill="currentColor"/><path d="M12 16h.01M16 16h.01M20 16h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  };

  /* ───────── 패널 정의 ───────── */
  const PANELS = Object.assign(C.panels(T), {
    board: { title: '사건 파일', icon: '📂', items: [['board', '단서'], ['board.tl', '시간표'], ['board.people', '인물']] },
  });
  function openPanel(p, view) {
    if (!PANELS[p]) return;
    ui.panel = p; ui.overlay = null; hideThought();
    ui.view = view || ui.lastView[p] || PANELS[p].items[0][0];
    if (ui.view === 'phone.call') { ui.sub.call = null; ui.sub.callLog = []; }
    if (p === 'board') S.newEv = [];
    AU.sfx('tap'); render();
  }
  function closePanel() { if (ui.panel === 'phone') { ui.sub.call = null; AU.stopSpeak(); } ui.panel = null; render(); }

  /* ───────── 헤더 · 무대 · 독 ───────── */
  function renderHeader() {
    const snd = `<button class="hbtn snd ${AU.state.on ? '' : 'off'}" data-act="sound" title="소리 켜기/끄기">${AU.state.on ? '🔊' : '🔇'}</button>`;
    const brand = `<div class="brand"><i class="logo"></i><div><small>${BRAND}</small><b>${esc(S.started ? C.title : BRAND)}</b></div></div>`;
    $('#hdr').innerHTML = brand + `<div class="hstat">${S.started && !S.ending ? `<span class="clock" id="clock">${clockText()}</span>` : ''}${snd}${S.started && !S.ending ? '<button class="hbtn" data-act="menu" title="메뉴">☰</button>' : ''}</div>`;
  }
  const unreadThreads = () => (T.phone.threads || []).filter(t => t.unread && !S.read.includes('p:' + t.id)).length;
  function renderDock() {
    const show = S.started && !S.ending;
    document.body.classList.toggle('playing', show);
    if (!show) { $('#dock').innerHTML = ''; return; }
    const ur = unreadThreads(), nudge = Date.now() - lastProgress > 100000;
    $('#dock').innerHTML = `
      <button class="dk" data-act="open" data-v="board"><span class="ic">${ICON.file}${S.newEv.length ? '<i class="dot"></i>' : ''}</span><em>사건 파일</em></button>
      <button class="dk phone ${ur ? 'ring' : ''}" data-act="open" data-v="phone"><span class="ic">${ICON.phone}${ur ? `<i class="badge">${ur}</i>` : ''}</span><em>내 휴대폰</em></button>
      <button class="dk think ${nudge ? 'nudge' : ''}" data-act="think"><span class="ic">${ICON.think}</span><em>생각하기</em></button>`;
    $('#where').textContent = (C.roomNames || {})[S.room] || '';
  }
  function renderStageUI() {
    const show = S.started && !S.ending;
    $('#stageui').className = show ? 'on' : '';
    if (!show) return;
    $('#where').textContent = (C.roomNames || {})[S.room] || '';
  }
  function render() {
    renderHeader(); renderDock(); renderStageUI();
    const P = ui.panel && PANELS[ui.panel];
    $('#panel').className = P ? 'show p-' + ui.panel : '';
    const area = ui.view.split('.')[0];
    if (P) {
      ui.lastView[ui.panel] = ui.view;
      $('#ptabs').innerHTML = `<b>${P.icon} ${esc(P.title)}</b>${P.items.length > 1 ? `<div class="ptabs">${P.items.map(([v, l]) => `<button class="ptab ${ui.view === v ? 'on' : ''}" data-act="go" data-v="${v}">${l}</button>`).join('')}</div>` : '<div class="ptabs"></div>'}<button class="pclose" data-act="closepanel" aria-label="닫기">✕</button>`;
      const html = C.lock && ui.panel === C.lock.panel && !S.flags.unlocked ? vLock() : (VIEWS[ui.view] || VIEWS[area])();
      $('#main').innerHTML = html; $('#main').scrollTop = 0;
      const ms = $('#main .ttmsgs'); if (ms) ms.scrollTop = ms.scrollHeight;
    } else { $('#main').innerHTML = ''; }
    renderOverlay();
    W.setEnabled(S.started && !S.ending && !ui.panel && !ui.overlay);
    AU.setMood(!S.started ? 'intro' : S.ending ? (S.ending.key === 'true' ? 'end_true' : 'end_bad') : C.mood ? C.mood(S, ui) : 'investigate');
  }

  /* ───────── 톡톡 (카톡과 같은 배치, 이름만 가상) ───────── */
  const ampm = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`; };
  const PALETTE = ['#e9b38a', '#7d8a99', '#8a7a9a', '#5f9a86', '#c97b7b', '#6b8fb3', '#b39a5a'];
  const colorOf = name => PALETTE[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length];
  const avOf = t => t.av || [colorOf(t.name), [...t.name.replace(/[^가-힣A-Za-z0-9]/g, '')][0] || '💬'];
  function avHtml(a, size = '', fig) {
    const src = fig ? pf(fig) : '';
    return src ? `<div class="ttav img ${size}"><img src="${src}" alt=""></div>` : `<div class="ttav ${size}" style="background:${a[0]}">${esc(a[1])}</div>`;
  }
  const lastMsg = t => [...t.msgs].reverse().find(m => m.text || m.sys) || {};
  const groupSize = t => t.group || (new Set(t.msgs.filter(m => m.who).map(m => m.who)).size > 2 ? new Set(t.msgs.filter(m => m.who).map(m => m.who)).size + 1 : 0);
  const unreadOf = (t, key) => S.read.includes(key + ':' + t.id) ? 0 : (t.unread || 0);
  function ttList(list, key, mobile, cur) {
    const filter = ui.sub[key + 'f'] || 'all', total = list.reduce((n, t) => n + unreadOf(t, key[0]), 0);
    const rows = list.filter(t => filter === 'all' || unreadOf(t, key[0])).map(t => { const lm = lastMsg(t), gs = groupSize(t), un = unreadOf(t, key[0]); return `<button class="ttrow ${cur === t ? 'on' : ''}" data-act="sub" data-k="${key}" data-v="${t.id}">${avHtml(avOf(t), '', t.fig)}<div class="ttmid"><div><b>${esc(t.name.replace(/\s*🔕/, ''))}</b>${gs ? `<span>${gs}</span>` : ''}${t.muted ? '<span class="mute">🔕</span>' : ''}</div><p>${esc(lm.text || lm.sys || '')}</p></div><div class="ttright"><em>${ampm(lm.t || '')}</em>${un ? `<b>${un > 999 ? '999+' : un}</b>` : ''}</div></button>`; }).join('');
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
      const pimg = m.photo ? photo(m.photo) : '';
      const body = /^\[사진\]/.test(m.text) ? (pimg ? `<img class="ttpic" src="${pimg}" alt="">` : `<div class="ttphoto">🖼<span>${esc(m.text.replace('[사진] ', ''))}</span></div>`) : nl(m.text);
      const bub = `<div class="ttbub ${m.photo ? 'pic' : ''}">${body}</div>`;
      if (mine) html += `<div class="ttmsg me ${first ? 'first' : ''}"><div class="ttmeta">${lastOfGroup ? `<em>${ampm(m.t)}</em>` : ''}</div>${bub}</div>`;
      else {
        const fig = gs ? AV[m.who] : cur.fig;
        html += `<div class="ttmsg ${first ? 'first' : ''}"><div class="ttside">${first ? avHtml(gs ? [colorOf(m.who), m.who[0]] : avOf(cur), 'sm', fig) : ''}</div><div class="ttcol">${first ? `<div class="ttname">${esc(m.who)}</div>` : ''}<div class="ttline">${bub}${lastOfGroup ? `<em>${ampm(m.t)}</em>` : ''}</div></div></div>`;
      }
    });
    return `<div class="ttroom"><div class="tthead">${backKey ? `<button class="ttback" data-act="sub" data-k="${backKey}" data-v="">‹</button>` : avHtml(avOf(cur), 'sm', cur.fig)}<b>${esc(cur.name.replace(/\s*🔕/, ''))}</b>${gs ? `<span>${gs}</span>` : ''}<i>🔍 ☰</i></div>
      <div class="ttmsgs">${html}</div><div class="ttinput"><i>＋</i><div>메시지 입력</div><span>😊 #</span><button disabled>전송</button></div></div>`;
  }
  function markRead(key, t) { const k = key + ':' + t.id; if (!S.read.includes(k)) { S.read.push(k); save(); } }

  /* ───────── 패널 화면들 ───────── */
  const VIEWS = {
    'phone.msg'() {
      const list = T.phone.threads, cur = list.find(t => t.id === ui.sub.pmsg);
      if (cur) { collect(cur.ev); markRead('p', cur); }
      return frame('phone', `<div class="kk">${cur ? ttRoom(cur, '나', 'pmsg') : ttList(list, 'pmsg', true)}</div>`, '톡톡');
    },
    'phone.mail'() { return frame('phone', mailInner(T.phone.mails, 'pmail'), '메일'); },
    'phone.loc'() {
      collect('e_location');
      return frame('phone', `<div class="loc"><div class="mapbox">${SC.map(T.phone.location)}</div>
        <div class="loclist"><div class="lochead">가족 위치 공유 · <b>${esc(C.phoneOwner || '')}</b>의 휴대폰</div>
        ${T.phone.location.map(p => `<div class="lrow ${p.last ? 'last' : ''}"><span>${p.t}</span>${esc(p.place)}</div>`).join('')}
        <p class="muted">위치 공유는 휴대폰 기준입니다. 휴대폰이 꺼지면 위치도 멈춥니다.</p></div></div>`, '위치 공유');
    },
    'phone.call'() {
      const id = ui.sub.call, call = id && (T.calls || {})[id], ct = (T.phone.contacts || []).find(c => c.id === id);
      if (call) {
        const log = ui.sub.callLog || [], used = log.map(l => l.id);
        const opts = (call.options || []).filter(o => !used.includes(o.id));
        return frame('phone', `<div class="call"><div class="callee">${ct && ct.fig ? `<img class="cav" src="${pf(ct.fig)}" alt="">` : `<div class="avatar">${esc((ct || { name: '?' }).name[0])}</div>`}<b>${esc(ct ? ct.name : '')}</b><span>통화 중</span></div>
          <div class="lines">${call.opening.map(l => `<p class="them">${esc(l)}</p>`).join('')}
          ${log.map(l => `<p class="mine">${esc(l.label)}</p><p class="them">${esc(l.reply)}</p>`).join('')}</div>
          <div class="opts">${opts.map(o => { const ok = !o.needsEv || o.needsEv.every(has); return `<button class="opt ${ok ? '' : 'dis'}" ${ok ? `data-act="say" data-v="${o.id}"` : 'disabled'}>${ok ? esc(o.label) : '🔒 (이 말을 뒷받침할 기록을 아직 찾지 못했다)'}</button>`; }).join('')}
          <button class="hang" data-act="hangup">통화 종료</button></div></div>`, '전화');
      }
      return frame('phone', `<div class="contacts"><div class="kktop"><b>연락처</b><span>🔍 ＋</span></div>${(T.phone.contacts || []).map(c => `<button class="crow" data-act="dial" data-v="${c.id}">${c.fig ? `<img class="cav sm" src="${pf(c.fig)}" alt="">` : `<div class="avatar">${esc(c.name[0])}</div>`}<div><b>${esc(c.name)}</b><span>${esc(c.sub)}</span></div><i>📞</i></button>`).join('')}
        ${S.flags.records && T.calls && T.calls.detective && T.calls.detective.after ? `<p class="muted">${esc(T.calls.detective.after)}</p>` : ''}</div>`, '전화');
    },
    'lap.chat'() {
      const list = T.laptop.chats, cur = list.find(t => t.id === ui.sub.lchat);
      if (cur) { collect(cur.ev); markRead('l', cur); }
      const me = C.phoneOwner === '나' ? '나' : '서윤';
      if (narrow()) return frame('laptop', `<div class="kk">${cur ? ttRoom(cur, me, 'lchat') : ttList(list, 'lchat', true)}</div>`, '톡톡 PC');
      const totalUnread = list.reduce((n, t) => n + unreadOf(t, 'l'), 0);
      return frame('laptop', `<div class="tt">
        <div class="ttrail"><i>👤</i><i class="on">💬${totalUnread ? `<b>${totalUnread}</b>` : ''}</i><i>⋯</i><span class="ttbottom"><i>🔔</i><i>⚙️</i></span></div>
        <div class="ttlist">${ttList(list, 'lchat', false, cur)}</div>
        ${cur ? ttRoom(cur, me) : `<div class="ttroom empty"><div>💬</div><p>대화를 선택하세요</p></div>`}</div>`, '톡톡 PC');
    },
    'lap.mail'() {
      const box = ui.sub.box || '받은편지함';
      const list = T.laptop.mails.filter(m => m.box === box);
      return frame('laptop', `<div class="tabs">${['받은편지함', '예약'].map(b => `<button class="tab ${b === box ? 'on' : ''}" data-act="sub" data-k="box" data-v="${b}">${b === '예약' ? '예약 메일함' : b}</button>`).join('')}</div>` + mailInner(list, 'lmail'), '메일');
    },
    'lap.cloud'() {
      const cl = T.laptop.cloud, open = ui.sub.ver;
      if (open) collect('e_cloud');
      return frame('laptop', `<div class="cloud"><div class="crumb">내 드라이브 › 공유 드라이브 › <b>${esc(cl.folder)}</b></div>
        <div class="tblwrap"><table class="tbl"><tr><th>이름</th><th>마지막 수정</th><th>수정한 사람</th><th></th></tr>
        ${cl.files.map(f => `<tr><td>📄 ${esc(f.name)}</td><td>${f.t}</td><td>${esc(f.by)}</td><td>${f.versions ? `<button class="btn sm" data-act="sub" data-k="ver" data-v="1">버전 기록</button>` : ''}</td></tr>`).join('')}</table></div>
        ${open ? `<div class="versions"><h4>보고서_최종.xlsx · 버전 기록</h4>${cl.versions.map(v => `<div class="vrow ${v.hl ? 'hl' : ''}"><b>${v.v}</b><span>${v.t} · ${esc(v.by)}</span><p>${esc(v.change)}</p></div>`).join('')}</div>` : ''}</div>`, '클라우드');
    },
    'lap.notes'() {
      const cur = T.laptop.notes.find(n => n.id === ui.sub.note);
      if (cur) collect(cur.ev);
      const list = `<div class="list">${T.laptop.notes.map(n => `<button class="row ${cur === n ? 'on' : ''}" data-act="sub" data-k="note" data-v="${n.id}"><b>${esc(n.title)}</b><span>${n.t}</span></button>`).join('')}</div>`;
      const pane = `<div class="pane paper">${cur ? `${narrow() ? '<button class="back" data-act="sub" data-k="note" data-v="">‹ 목록</button>' : ''}<h3>${esc(cur.title)}</h3><div class="muted">${cur.t}</div><p>${nl(cur.body)}</p>` : empty('메모를 고르세요')}</div>`;
      return frame('laptop', `<div class="split notes ${cur ? 'has' : ''}">${list}${pane}</div>`, '메모');
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
        <div class="tblwrap"><table class="tbl small"><tr><th>동기화</th><th>네트워크</th><th>심박</th><th>걸음</th><th>고도</th><th>피부 온도</th><th></th></tr>
        ${w.rows.map(r => `<tr><td>${r.t}</td><td>${w.ssid}</td><td>${r.hr}</td><td>${r.steps}</td><td>${r.alt > 0 ? '+' : ''}${r.alt}m</td><td>${r.skin}°C</td><td class="muted">${r.note || ''}</td></tr>`).join('')}</table></div>
        <p class="muted">워치는 휴대폰 없이도 등록된 Wi-Fi로 기록을 올립니다. 위치(GPS)는 휴대폰이 있어야 기록됩니다.</p></div>`, '헬스 클라우드');
    },
    rec() {
      const r = T.records[ui.view.split('.')[1]];
      collect(r.ev);
      return frame('doc', `<div class="doc"><div class="dochead"><b>${esc(r.title)}</b><span>${esc(r.range)}${r.provider ? ' · ' + esc(r.provider) : ''}</span></div>
        <div class="tblwrap"><table class="tbl mono"><tr>${r.cols.map(c => `<th>${c}</th>`).join('')}</tr>
        ${r.rows.map(row => `<tr class="${row[r.cols.length] === true ? 'hl' : ''}">${row.slice(0, r.cols.length).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>
        <p class="muted">${esc(r.foot)}</p></div>`, r.app || '기록');
    },
    cctv() {
      const cam = T.cctv.find(c => 'cctv.' + c.id === ui.view);
      const fi = Math.min(ui.sub['f_' + cam.id] || 0, cam.frames.length - 1), f = cam.frames[fi];
      if (f.ev && !f.zoom) collect(f.ev);
      const day = f.day || (f.t < '12' ? '2026-11-15' : '2026-11-14');
      return frame('cctv', `<div class="cctv">
        <div class="screen ${cam.style || ''}"><img src="${shotOf(cam, f, fi)}" alt=""><div class="noise"></div><div class="scan"></div><div class="osd"><span>● REC</span><span>${esc(cam.name)}</span><span>${day} ${f.t}</span></div></div>
        <div class="caption">${esc(f.caption)}${f.zoom ? ` <button class="btn sm" data-act="zoom" data-v="${f.zoom}" data-ev="${f.ev || ''}">🔍 ${esc(f.zoomLabel || '발 부분 확대')}</button>` : ''}</div>
        <div class="timeline">${cam.frames.map((fr, i) => `<button class="tframe ${i === fi ? 'on' : ''}" data-act="sub" data-k="f_${cam.id}" data-v="${i}">${fr.t.slice(0, 5)}</button>`).join('')}</div>
        <p class="muted">움직임이 감지된 구간만 저장된 영상입니다. 시각을 눌러 이동하세요.</p></div>`, cam.app || 'CCTV 뷰어');
    },
    diary() {
      collect('e_memo');
      return `<div class="notebook"><div class="nbcover">${esc(T.diaryTitle || '연구 노트')}</div>${T.diary.map(p => `<div class="nbpage"><div class="nbd">${esc(p.d)}</div><p>${nl(p.text)}</p></div>`).join('')}</div>`;
    },
    board() {
      const groups = C.evidenceGroups || [['내 휴대폰', '📱'], ['노트북', '💻'], ['CCTV', '📹'], ['기록', '🗂']];
      const f = ui.sub.bf || 'all';
      const list = S.ev.filter(id => f === 'all' ? true : f === 'star' ? S.star.includes(id) : C.evidence[id].src.startsWith(f));
      return `<div class="board"><div class="bhead"><h2>단서</h2><p>보고 들은 것이 자동으로 끼워진다. 무엇이 무엇과 이어지는지는 <b>내가 판단</b>한다. 중요해 보이는 것엔 핀을 꽂아 두자.</p></div>
        <div class="bfilter">${[['all', '전체'], ['star', '📌 핀'], ...groups.map(([g, i]) => [g, `${i} ${g}`])].map(([k, l]) => `<button class="chipb ${f === k ? 'on' : ''}" data-act="sub" data-k="bf" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="cards">${list.length ? list.slice().reverse().map(id => { const e = C.evidence[id], on = S.star.includes(id); return `<div class="card ${on ? 'sel' : ''}"><button class="star ${on ? 'on' : ''}" data-act="star" data-v="${id}" title="핀 꽂기">📌</button><span>${esc(e.src)}</span><b>${esc(e.title)}</b><p>${esc(e.note)}</p></div>`; }).join('') : '<p class="muted">아직 없다. 공간을 돌아다니며 사물을 조사해 보자.</p>'}</div></div>`;
    },
    'board.tl'() {
      const key = w => { const m = w.match(/(\d+)\/(\d+)(?:\s+(\d+):(\d+))?/); return m ? ((+m[1]) * 1e6 + (+m[2]) * 1e4 + (+(m[3] || 0)) * 100 + (+(m[4] || 0))) : 0; };
      const rows = S.ev.flatMap(id => (C.timeline[id] || []).map(([w, t]) => ({ w, t, id, k: key(w) }))).sort((a, b) => a.k - b.k);
      let lastDay = '';
      return `<div class="board"><div class="bhead"><h2>시간표</h2><p>모은 단서 속 시각을 시간순으로 늘어놓았다. 같은 시각, 서로 다른 기록이 무엇을 말하는지 살펴보자.</p></div>
        <div class="tl">${rows.length ? rows.map(r => { const [d, tm] = r.w.split(' '); const day = d !== lastDay ? `<div class="tlday">${d}</div>` : ''; lastDay = d; return `${day}<div class="tlrow ${S.star.includes(r.id) ? 'star' : ''}"><em>${tm || ''}</em><i></i><div><p>${esc(r.t)}</p><span>${esc(C.evidence[r.id].src)} · ${esc(C.evidence[r.id].title)}</span></div></div>`; }).join('') : '<p class="muted">아직 시각이 있는 단서가 없다.</p>'}</div></div>`;
    },
    'board.people'() {
      return `<div class="board"><div class="bhead"><h2>인물</h2><p>각 인물이 한 말과 주장. <b>본인의 주장은 사실이 아닐 수도 있다.</b></p></div>
        <div class="people">${C.people.map(p => { const cl = p.claims.filter(([ev]) => has(ev)); return `<div class="person">${p.fig ? `<img class="pav" src="${pf(p.fig)}" alt="">` : `<div class="pav">${esc(p.name[0])}</div>`}<div><b>${esc(p.name)}</b><span>${esc(p.role)}</span>${cl.length ? `<ul>${cl.map(([, t]) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="muted">아직 알려진 말이 없다.</p>'}</div></div>`; }).join('')}</div></div>`;
    },
  };

  function mailInner(list, key) {
    const cur = list.find(m => m.id === ui.sub[key]);
    if (cur) collect(cur.ev);
    const pimg = cur && cur.photo && (T.photos || {})[cur.photo] ? photo(cur.photo) : '';
    return `<div class="split mail ${cur ? 'has' : ''}"><div class="list">${list.map(m => `<button class="row ${cur === m ? 'on' : ''}" data-act="sub" data-k="${key}" data-v="${m.id}"><b>${esc(m.from)}</b><span>${esc(m.subject)}</span><em>${m.t}</em></button>`).join('')}</div>
      <div class="pane paper">${cur ? `${narrow() ? `<button class="back" data-act="sub" data-k="${key}" data-v="">‹ 목록</button>` : ''}<h3>${esc(cur.subject)}</h3><div class="mhead">보낸 사람 ${esc(cur.from)}${cur.to ? ` · 받는 사람 ${esc(cur.to)}` : ''}<br>${cur.t}</div>
        ${cur.status ? `<div class="status">⚠ ${esc(cur.status)}</div>` : ''}
        <p>${nl(cur.body)}</p>
        ${cur.table ? `<div class="tblwrap"><table class="tbl">${cur.table.map((r, i) => `<tr>${r.map(c => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</table></div>` : ''}
        ${pimg ? `<div class="photo"><img src="${pimg}" alt=""><button class="btn sm" data-act="zoom" data-v="${cur.photo}">🔍 확대</button></div>` : ''}
        ${cur.photo === 'floorplan' ? `<div class="photo plan">${SC.floorplan()}</div>` : ''}` : empty('메일을 고르세요')}</div></div>`;
  }
  function frame(kind, inner, title) { return `<div class="device ${kind}"><div class="dbar"><i></i><i></i><i></i><span>${esc(title)}</span></div><div class="dbody">${inner}</div></div>`; }
  const empty = t => `<div class="empty">${esc(t)}</div>`;
  function vLock() {
    const fig = C.lock.fig ? pf(C.lock.fig) : '';
    return `<div class="device laptop lockscr"><div class="dbody"><div class="lockbox">${fig ? `<img class="lockav" src="${fig}" alt="">` : `<div class="avatar big">${esc(C.lock.avatar)}</div>`}<b>${esc(C.lock.name)}</b>
      <form data-form="pw"><input id="pw" type="password" placeholder="암호 입력" autocomplete="off"><button class="btn">↵</button></form>
      <p class="muted">암호 힌트: ${esc(C.lock.hint)}</p><p class="err" id="pwerr"></p></div></div></div>`;
  }

  /* ───────── 사물을 들여다볼 때의 그림 (화이트보드·쪽지·안내문·사진·게시판) ───────── */
  function visualHTML(v) {
    if (!v) return '';
    switch (v.kind) {
      case 'whiteboard': return `<div class="vis wb"><div class="wbin">${v.lines.map(([t, c, s]) => `<p style="color:${c || '#1f3b73'};font-size:${s || 1}em">${esc(t)}</p>`).join('')}</div><i class="mag a"></i><i class="mag b"></i><div class="tray"><i></i><i></i></div></div>`;
      case 'sticky': return `<div class="vis sticky" style="--rot:${v.rot ?? -2}deg;--c:${v.color || '#fff3a0'}"><p>${nl(v.text)}</p></div>`;
      case 'notice': return `<div class="vis notice"><i class="tape l"></i><i class="tape r"></i><h4>${esc(v.title)}</h4><p>${nl(v.text)}</p>${v.foot ? `<em>${esc(v.foot)}</em>` : ''}</div>`;
      case 'photo': return `<div class="vis polaroid" style="--rot:${v.rot ?? 1.5}deg"><img src="${photo(v.photo)}" alt=""><p>${esc(v.caption || '')}</p></div>`;
      case 'board': return `<div class="vis cork">${v.papers.map(p => `<div class="pp ${p.kind || ''}" style="--rot:${p.rot || 0}deg"><i class="pin"></i><b>${esc(p.title)}</b><p>${nl(p.text)}</p></div>`).join('')}</div>`;
    }
    return '';
  }

  /* ───────── 오버레이 ───────── */
  function renderOverlay() {
    const o = $('#overlay');
    if (!S.started) { o.className = 'show intro'; o.innerHTML = introHTML(); return; }
    if (S.ending) { o.className = 'show ending'; o.innerHTML = endingHTML(); return; }
    if (!ui.overlay) { o.className = ''; o.innerHTML = ''; return; }
    const x = ui.overlay;
    o.className = 'show ' + x.type;
    if (x.type === 'zoom') {
      const z = (T.zooms || {})[x.v] || {};
      const img = W.snap(Object.assign({ key: 'zm:' + x.v, w: 640, h: 400 }, z));
      o.innerHTML = modal(`<div class="kick">확대</div><div class="zoomimg ${z.cctv ? 'cctvz' : ''}"><img src="${img}" alt="">${z.cctv ? '<div class="noise"></div><div class="scan"></div>' : ''}</div><p>${esc(z.caption || '')}</p>`);
    } else if (x.type === 'examine') {
      const e = T.examine[x.id](ctx());
      o.innerHTML = modal(`<div class="kick">${esc(e.kick || '조사')}</div><h2>${esc(e.title)}</h2>${visualHTML(e.visual)}${e.lines ? e.lines.map(([w, l]) => `<p class="say"><b>${esc(w)}</b>${esc(l)}</p>`).join('') : e.body ? `<p class="obs">${nl(e.body)}</p>` : ''}
        ${e.action ? `<button class="btn" data-act="${e.action.act}" data-v="${e.action.v || ''}">${esc(e.action.label)}</button>` : ''}`, e.visual ? 'wide' : '');
    } else if (x.type === 'elevator') {
      const floors = C.floors || [];
      o.innerHTML = modal(`<div class="kick">엘리베이터</div><h2>몇 층으로 갈까?</h2><div class="floors">${floors.map(([id, f, l, need]) => {
        const lock = need && !S.flags[need];
        return `<button class="floor ${S.room === id ? 'here' : ''}" ${lock ? 'disabled' : `data-act="floor" data-v="${id}"`}><b>${f}</b><span>${lock ? '🔒 관계자 카드가 필요하다' : l}${S.room === id ? ' · 현재 층' : ''}</span></button>`;
      }).join('')}</div>`);
    } else if (x.type === 'confirm') {
      o.innerHTML = modal(`<div class="kick">결정</div><h2>${esc(x.title)}</h2><p>${nl(x.text)}</p><div class="row2"><button class="btn ghost" data-act="close">아직 아니다</button><button class="btn danger" data-act="${x.act}" data-v="${x.v || ''}">${esc(x.ok)}</button></div>`);
    } else if (x.type === 'verdict') {
      o.innerHTML = verdictHTML();
      const lg = o.querySelector('.vdlog'); if (lg) lg.scrollTop = lg.scrollHeight;
    } else if (x.type === 'menu') {
      o.innerHTML = modal(`<div class="kick">메뉴</div><h2>${esc(C.title)}</h2><p class="muted">진행 상황은 이 브라우저에 자동 저장된다.</p>
        <div class="sndset"><b>소리</b>${[['on', '전체 소리'], ['bgm', '배경음'], ['sfx', '효과음'], ['voice', '음성 (대사·내레이션)']].map(([k, l]) => `<label><input type="checkbox" data-act="snd" data-v="${k}" ${AU.state[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
        <div class="sndset voices"><b>목소리 (미리 듣기)</b>${(C.voiceTest || []).map(([k, l]) => `<button class="vrow2" data-act="voicetest" data-v="${k}"><span>▶ ${l}</span><em>${esc(AU.voiceInfo()[k])}</em></button>`).join('')}</div>
        <div class="sndset"><b>다른 사건</b>${CASE_LIST.map(c => `<button class="vrow2" data-act="switchcase" data-v="${c.id}"><span>${c.id === CASE_ID ? '▶ ' : ''}${esc(c.title)}</span><em>${esc(c.minutes)} · ${esc(c.where)}</em></button>`).join('')}</div>
        <div class="row2"><button class="btn ghost" data-act="replayintro">인트로 다시 보기</button><button class="btn danger" data-act="reset">처음부터 다시</button></div>`);
    }
  }
  const modal = (inner, cls = '') => `<div class="modal ${cls}" data-stop>${inner}<button class="x" data-act="close" aria-label="닫기">✕</button></div>`;

  /* ───────── 결론 대화: 사건마다 다른 방식으로 결론을 낸다 (data.js의 verdict) ───────── */
  const V = C.verdict;
  const roleName = r => r === 'me' ? (V.names && V.names.me) || '나' : r === 'narrator' ? '' : (V.names || {})[r] || r;
  const roleFig = r => r === 'me' ? C.player : (V.figs || {})[r];
  function startVerdict(start) {
    ui.vd = { log: [], node: null, pick: null, done: null };
    ui.overlay = { type: 'verdict' };
    enterNode(start || V.start);
  }
  function enterNode(id) {
    const n = V.nodes[id]; if (!n) return;
    ui.vd.node = id; ui.vd.pick = null;
    const lines = fn(n.lines, S) || [];
    lines.forEach(l => ui.vd.log.push(l));
    if (n.flag) { S.flags[n.flag] = true; save(); }
    if (n.vres) { Object.assign(S.vres, fn(n.vres, S)); save(); }
    if (n.sfx) AU.sfx(n.sfx);
    AU.speakSeq(lines.map(([r, t]) => [t, r]));
    if (n.goto) return enterNode(fn(n.goto, S));
    if (n.end) ui.vd.done = { end: fn(n.end, S) };
    else if (n.close) ui.vd.done = { close: n.close };
    else ui.vd.done = null;
    render();
  }
  function verdictHTML() {
    const vd = ui.vd, n = V.nodes[vd.node] || {};
    const log = vd.log.map(([r, t]) => r === 'narrator' ? `<p class="vn">${esc(t)}</p>` : `<div class="vl ${r === 'me' ? 'me' : ''}">${roleFig(r) ? `<img src="${pf(roleFig(r))}" alt="">` : '<i></i>'}<div><b>${esc(roleName(r))}</b><p>${esc(t)}</p></div></div>`).join('');
    let ask = '';
    if (vd.done) ask = vd.done.end ? `<button class="btn big" data-act="vdend">${esc(V.endLabel || '결말 보기')} ›</button>` : `<button class="btn big" data-act="vdclose">${esc(vd.done.close === true ? '대화를 끝낸다' : vd.done.close)}</button>`;
    else if (n.ask === 'evidence') ask = `<div class="vdq">${esc(n.prompt)}</div><div class="evpick">${S.ev.map(id => `<button class="evc ${vd.pick === id ? 'on' : ''}" data-act="vdpick" data-v="${id}"><span>${esc(C.evidence[id].src)}</span><b>${esc(C.evidence[id].title)}</b></button>`).join('')}</div><button class="btn" data-act="vdshow" ${vd.pick ? '' : 'disabled'}>이걸 보여 준다</button>`;
    else if (n.ask === 'person') ask = `<div class="vdq">${esc(n.prompt)}</div><div class="ppick">${n.people.map(pid => { const p = C.people.find(p => p.id === pid); return `<button class="pc ${vd.pick === pid ? 'on' : ''}" data-act="vdpick" data-v="${pid}">${p.fig ? `<img src="${pf(p.fig)}" alt="">` : ''}<b>${esc(p.name)}</b><span>${esc(p.role)}</span></button>`; }).join('')}</div><button class="btn" data-act="vdshow" ${vd.pick ? '' : 'disabled'}>이 사람이다</button>`;
    else if (n.ask === 'options') ask = `<div class="vdq">${esc(n.prompt || '')}</div><div class="opts">${n.options.map((o, i) => `<button class="opt" data-act="vdopt" data-v="${i}">${esc(o.label)}</button>`).join('')}</div>`;
    return `<div class="vd"><div class="vdhead"><span>${esc(V.kick || '결론')}</span><b>${esc(V.title)}</b></div><div class="vdlog">${log}</div><div class="vdask">${ask}</div></div>`;
  }
  function vdAnswer(val) {
    const n = V.nodes[ui.vd.node];
    let ok, say;
    if (n.ask === 'evidence') { ok = n.accept.includes(val); say = fn(n.say, val, C.evidence[val]) || `(${C.evidence[val].title}을(를) 보여 준다)`; }
    else if (n.ask === 'person') { ok = val === n.answer; const p = C.people.find(p => p.id === val); say = fn(n.say, val, p) || `${p.name}이에요.`; }
    if (n.mark) { S.vres[n.mark] = ok; save(); }
    ui.vd.log.push(['me', say]);
    AU.sfx(ok ? 'insight' : 'bad');
    enterNode(fn(ok ? n.ok : n.no, S));
  }
  function finish(key) {
    save();
    S.ending = { key, min: Math.max(1, Math.round(S.elapsed / 60)) };
    ui.overlay = null; ui.vd = null; ui.panel = null; ui.endStep = 0; save(); render();
    AU.sfx('sting'); setTimeout(() => AU.speak(C.endings[key].slides[0]), 900);
  }

  /* ───────── 생각하기: 정해진 3단계 대신, 주인공이 지금 상황을 혼잣말로 정리하고 갈 곳을 짚어 준다 ───────── */
  let thoughtTimer = 0;
  function think() {
    const st = stage(), list = (C.thoughts || {})[st] || [];
    if (!list.length) return;
    const lv = S.thinkLv[st] || 0, item = list[lv % list.length];
    S.thinkLv[st] = lv + 1; S.thinks++; lastProgress = Date.now(); save();
    AU.sfx('hint'); W.express('closed', 1800);
    let where = '';
    if (item.target === 'phone') { const b = $('.dk.phone'); if (b) { b.classList.remove('point'); void b.offsetWidth; b.classList.add('point'); } }
    else if (item.target && !W.highlight(item.target) && item.room && item.room !== S.room) where = (C.roomNames || {})[item.room] || '';
    showThought(item.t, where);
    AU.speak(item.t, 'me');
    renderDock();
  }
  function showThought(text, where) {
    const el = $('#thought'), p = W.playerScreen();
    el.innerHTML = `<p>${esc(text)}</p>${where ? `<em>📍 ${esc(where)}</em>` : ''}`;
    el.className = 'on';
    const host = $('#world'), w = el.offsetWidth, h = el.offsetHeight;
    const x = p ? p.x : host.clientWidth / 2, y = p ? p.y : host.clientHeight / 2;
    el.style.left = Math.max(8, Math.min(host.clientWidth - w - 8, x - w / 2)) + 'px';
    el.style.top = Math.max(8, y - h - 8) + 'px';
    clearTimeout(thoughtTimer); thoughtTimer = setTimeout(hideThought, 9000);
  }
  function hideThought() { const el = $('#thought'); if (el) el.className = ''; }

  /* ───────── 인트로 · 결말 ───────── */
  function introHTML() {
    if (ui.introStep < 0) return `<div class="slide gate"><div class="gbrand"><i class="logo big"></i><div class="title">${BRAND}</div><p class="tag">실마리를 찾아서 사건을 해결한다</p></div>
      <div class="cases">${CASE_LIST.map(c => `<button class="casecard ${c.id === CASE_ID ? 'on' : ''}" data-act="switchcase" data-v="${c.id}"><small>CASE ${CASE_LIST.indexOf(c) + 1}</small><b>${esc(c.title)}</b><p>${esc(c.tag)}</p><span>⏱ ${esc(c.minutes)} · ${esc(c.level)} · ${esc(c.where)}</span></button>`).join('')}</div>
      <button class="btn big" data-act="intro">「${esc(C.title)}」 시작</button><p class="muted">🔊 소리를 켜고, 가능하면 이어폰으로 플레이하세요.</p></div>`;
    const s = C.intro[ui.introStep], last = ui.introStep === C.intro.length - 1;
    const touch = matchMedia('(pointer: coarse)').matches;
    return `<div class="slide"><div class="title sm">${esc(C.title)}</div><div class="kick">${esc(s.kicker)}</div><p>${esc(s.text)}</p>
      ${last ? `<div class="howto"><b>플레이 방법</b>
        <div>👆 ${touch ? '바닥을 누르면 걷고, 사물을 누르면 다가가 조사한다. 사물 근처를 누르면 이름이 뜨니 한 번 더 누르자.' : '바닥을 클릭하면 걷고, 사물을 클릭하면 다가가 조사한다. WASD/방향키로도 걷는다.'}</div>
        <div>🔍 ${touch ? '두 손가락으로 벌리면 확대, 확대한 뒤 끌면 둘러보기.' : '마우스 휠로 확대·축소, 확대한 뒤 끌면 둘러보기.'} ◆ 표시는 아직 안 본 곳.</div>
        <div>📱 <b>내 휴대폰</b>은 꼭 확인하자. 메시지와 전화가 사건의 출발점이다.</div>
        <div>📂 본 것은 <b>사건 파일</b>에 자동으로 끼워진다. 💭 막히면 <b>생각하기</b>.</div>
        <div>⚖️ ${esc(C.howto || '')}</div></div>` : ''}
      <div class="dots">${C.intro.map((_, i) => `<i class="${i <= ui.introStep ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn big" data-act="intro">${last ? '수사 시작' : '다음'}</button></div>`;
  }
  function endingHTML() {
    const e = C.endings[S.ending.key], slides = e.slides;
    if (ui.endStep < slides.length) {
      return `<div class="slide end"><div class="kick">${esc(e.kind)}</div><div class="title">${esc(e.title)}</div><p>${esc(slides[ui.endStep])}</p>
        <div class="dots">${slides.map((_, i) => `<i class="${i <= ui.endStep ? 'on' : ''}"></i>`).join('')}</div><button class="btn big" data-act="endnext">계속</button></div>`;
    }
    const truths = (V && V.truths) || [];
    const good = S.ending.key === 'true';
    return `<div class="slide end result"><div class="stamp ${good ? '' : 'grey'}">${good ? '사건 해결' : '사건 종결'}</div><div class="title">${esc(e.title)}</div><div class="kick">${esc(e.kind)}</div>
      <div class="truths">${truths.map(([m, label]) => `<div class="${S.vres[m] ? 'ok' : 'no'}"><i>${S.vres[m] ? '✔' : '?'}</i>${esc(label)}</div>`).join('')}</div>
      <p class="muted">수사 ${S.ending.min}분 · 생각하기 ${S.thinks}번</p>
      ${good ? '' : '<p class="note">다른 결말이 있다. 놓친 기록을 찾아 다시 도전해 보자.</p>'}
      <div class="row2">${CASE_LIST.filter(c => c.id !== CASE_ID).map(c => `<button class="btn ghost" data-act="switchcase" data-v="${c.id}">「${esc(c.title)}」 하러 가기</button>`).join('')}<button class="btn big" data-act="reset">처음부터 다시</button></div></div>`;
  }

  /* ───────── 이벤트 ───────── */
  function toast(text, kind = '', sub = '') {
    const el = document.createElement('div'); el.className = 'toast ' + kind; el.innerHTML = `<b>${esc(text)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    const box = $('#toasts'); box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3100);
  }
  function dial(id) {
    const ct = T.phone.contacts.find(c => c.id === id), call = (T.calls || {})[id];
    if (!call) { AU.sfx('busy'); toast(ct.toast || '전화를 받지 않는다.'); return; }
    ui.sub.call = id; ui.sub.callLog = []; render(); AU.sfx('ring');
    setTimeout(() => AU.speak(call.opening.join(' '), call.voice || id), 1800);
  }

  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-act]');
    if (!t) {
      if (ev.target.id === 'overlay' && ui.overlay && ui.overlay.type !== 'verdict') { ui.overlay = null; render(); }
      if (ev.target.closest('#thought')) hideThought();
      return;
    }
    const a = t.dataset.act, v = t.dataset.v;
    AU.unlock();
    switch (a) {
      case 'open': openPanel(v); break;
      case 'closepanel': AU.sfx('tap'); closePanel(); break;
      case 'floor': ui.overlay = null; AU.sfx('elev'); if (v !== S.room) { S.room = v; save(); W.goRoom(v); } render(); break;
      case 'go': AU.sfx('tap'); ui.view = v; if (v === 'phone.call') { ui.sub.call = null; ui.sub.callLog = []; } render(); break;
      case 'sub': AU.sfx(t.dataset.k.startsWith('f_') ? 'static' : 'tap'); ui.sub[t.dataset.k] = v === '' ? null : isNaN(v) ? v : +v; render(); break;
      case 'dial': dial(v); break;
      case 'say': {
        const call = T.calls[ui.sub.call], o = call.options.find(o => o.id === v);
        (ui.sub.callLog = ui.sub.callLog || []).push(o);
        AU.speakSeq([[o.label, 'me'], [o.reply, call.voice || ui.sub.call]]);
        if (o.flag) { S.flags[o.flag] = true; save(); }
        if (o.unlock && !S.flags[o.unlock]) { S.flags[o.unlock] = true; save(); setTimeout(() => { AU.sfx('msg'); toast(call.toast || '자료가 도착했다.', 'ev'); }, 400); }
        render(); break;
      }
      case 'hangup': AU.stopSpeak(); AU.sfx('hangup'); ui.sub.call = null; ui.sub.callLog = []; render(); break;
      case 'star': { AU.sfx('tap'); const i = S.star.indexOf(v); if (i >= 0) S.star.splice(i, 1); else S.star.push(v); save(); render(); break; }
      case 'zoom': AU.sfx('zoom'); if (t.dataset.ev) collect(t.dataset.ev); ui.overlay = { type: 'zoom', v }; render(); break;
      case 'think': AU.unlock(); think(); break;
      case 'zoomin': W.zoomBy(1.3); break;
      case 'zoomout': W.zoomBy(1 / 1.3); break;
      case 'menu': AU.sfx('tap'); ui.overlay = { type: 'menu' }; render(); break;
      case 'giveup': { const g = C.giveup; AU.sfx('tap'); ui.overlay = { type: 'confirm', title: g.title, text: g.text, ok: g.ok, act: 'confirmend', v: g.end }; render(); break; }
      case 'close': ui.overlay = null; render(); break;
      case 'verdict': AU.sfx('ring'); startVerdict(v || undefined); break;
      case 'vdpick': AU.sfx('tap'); ui.vd.pick = v; renderOverlay(); break;
      case 'vdshow': if (ui.vd.pick) vdAnswer(ui.vd.pick); break;
      case 'vdopt': { const o = V.nodes[ui.vd.node].options[+v]; ui.vd.log.push(['me', o.label]); if (o.flag) { S.flags[o.flag] = true; save(); } AU.sfx('tap'); enterNode(fn(o.next, S)); break; }
      case 'vdclose': AU.stopSpeak(); AU.sfx('hangup'); ui.overlay = null; ui.vd = null; render(); break;
      case 'vdend': AU.stopSpeak(); finish(ui.vd.done.end); break;
      case 'confirmend': finish(v); break;
      case 'intro':
        if (ui.introStep < C.intro.length - 1) { ui.introStep++; AU.sfx('page'); const sl = C.intro[ui.introStep]; AU.speak(sl.kicker + '. ' + sl.text); }
        else { S.started = true; ui.introStep = -1; tickStart = Date.now(); lastProgress = Date.now(); save(); AU.stopSpeak(); AU.sfx('unlock'); warmUp(); }
        render(); break;
      case 'replayintro': S.started = false; ui.overlay = null; ui.introStep = -1; render(); break;
      case 'reset': if (confirm('모든 진행이 사라집니다. 처음부터 다시 할까요?')) { localStorage.removeItem(SAVE_KEY); S = fresh(); AU.stopSpeak(); Object.assign(ui, { view: 'phone.msg', panel: null, lastView: {}, sub: {}, overlay: null, introStep: -1, endStep: 0, vd: null }); tickStart = Date.now(); W.goRoom(C.startRoom, false); render(); } break;
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
      S.flags.unlocked = true; lastProgress = Date.now(); save(); AU.unlock(); AU.sfx('unlock'); W.express('smile'); ui.view = C.lock.open; toast('노트북 잠금이 풀렸다.', 'ev'); W.goRoom(S.room, false); render();
    } else { AU.unlock(); AU.sfx('lock'); $('#pwerr').textContent = '암호가 맞지 않습니다.'; $('#pw').value = ''; $('.lockbox').classList.remove('shake'); void $('.lockbox').offsetWidth; $('.lockbox').classList.add('shake'); }
  });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (ui.overlay && S.started && !S.ending && ui.overlay.type !== 'verdict') { ui.overlay = null; render(); } else if (ui.panel) closePanel(); });
  setInterval(() => { const c = $('#clock'); if (c) c.textContent = clockText(); if (S.started && !S.ending && !ui.panel) renderDock(); }, 10000);
  window.addEventListener('beforeunload', save);

  /* 프로필 사진 등은 처음 한 번 그릴 때 시간이 걸리니, 한가할 때 미리 그려 둔다 */
  function warmUp() {
    const figs = new Set([C.player, ...(T.phone.threads || []).map(t => t.fig), ...((T.laptop || {}).chats || []).map(t => t.fig), ...Object.values(AV), ...(T.phone.contacts || []).map(c => c.fig), ...C.people.map(p => p.fig)].filter(Boolean));
    const q = [...figs];
    const idle = window.requestIdleCallback || (f => setTimeout(f, 120));
    const nextOne = () => { const f = q.shift(); if (!f) return; pf(f); idle(nextOne); };
    idle(nextOne);
  }

  function markSeen(id) { if (!S.seen.includes(id)) { S.seen.push(id); save(); } }
  W.init($('#world'), {
    player: C.player || 'seojin',
    isSeen: id => S.seen.includes(id),
    onRoom: (id) => { S.room = id; save(); renderDock(); renderStageUI(); },
    onToast: t => toast(t),
    onWalk: () => hideThought(),
    onInteract(o) {
      AU.unlock(); markSeen(o.id); hideThought();
      if (o.act === 'panel') { if (o.gate && !S.flags[o.gate]) { AU.sfx('lock'); ui.overlay = { type: 'examine', id: o.gateExamine || 'guard' }; render(); } else openPanel(o.panel); return; }
      if (o.act === 'drawer') { W.openDrawer(); AU.sfx('drawer'); setTimeout(() => openPanel('diary'), 500); return; }
      if (o.act === 'elevator') { AU.sfx('tap'); ui.overlay = { type: 'elevator' }; render(); return; }
      if (o.act === 'door') { AU.sfx('drawer'); S.room = o.to; save(); W.goRoom(o.to, true, o.spawn); return; }
      AU.sfx('tap');
      ui.overlay = { type: 'examine', id: o.id };
      const e = T.examine[o.id](ctx());
      W.express(e.mood || (o.npc ? 'calm' : 'sharp'), 3500);
      if (e.ev) [].concat(e.ev).forEach(collect);
      if (e.lines) AU.speakSeq(e.lines.map(([w, l]) => [l, e.voice || 'narrator']));
      render();
    },
  });
  W.goRoom(S.room || C.startRoom, false);
  if (S.started) warmUp();
  render();

  /* 링크 공유 이미지(og.png) 촬영용: ?shot=og */
  if (new URLSearchParams(location.search).get('shot') === 'og') {
    document.body.classList.add('ogshot');
    const card = document.createElement('div'); card.className = 'ogcard';
    card.innerHTML = `<i class="logo big"></i><div><b>${BRAND}</b><p>실마리를 찾아서 사건을 해결한다</p></div>`;
    $('#stage').appendChild(card);
  }
  window.GAME = { S: () => S, ui, think, startVerdict, finish };
})();
