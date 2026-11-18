/* 사운드: 외부 파일 없이 Web Audio로 합성한 효과음·배경음 + 브라우저 음성 합성(TTS).
 * 나중에 녹음 파일로 바꾸려면 SFX/MOODS 항목을 오디오 파일 재생으로 교체하면 된다.
 */
window.AUDIO = (() => {
  const KEY = 'case-audio';
  const st = Object.assign({ on: true, bgm: true, sfx: true, voice: true }, safeParse(localStorage.getItem(KEY)));
  let ctx, master, bgmBus, sfxBus, noiseBuf, mood = null, pendingMood = null, moodNodes = null;

  function safeParse(s) { try { return JSON.parse(s) || {}; } catch { return {}; } }
  function save() { localStorage.setItem(KEY, JSON.stringify(st)); }

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = st.on ? 0.8 : 0; master.connect(ctx.destination);
    bgmBus = ctx.createGain(); bgmBus.gain.value = st.bgm ? 1 : 0; bgmBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = st.sfx ? 1 : 0; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function unlock() {
    init();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (pendingMood) { const m = pendingMood; pendingMood = null; setMood(m); }
  }

  /* ───────── 기본 소리 재료 ───────── */
  function tone(freq, dur, o = {}) {
    const t = ctx.currentTime + (o.when || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + dur);
    const v = o.vol ?? 0.2, a = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dest || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, o = {}) {
    const t = ctx.currentTime + (o.when || 0);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.filter || 'bandpass'; f.frequency.value = o.freq || 1200; f.Q.value = o.q ?? 1;
    const v = o.vol ?? 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(t); src.stop(t + dur + 0.05);
  }

  /* ───────── 효과음 ───────── */
  const SFX = {
    tap() { tone(1800, 0.04, { type: 'triangle', vol: 0.05 }); },
    ev() { tone(880, 0.18, { type: 'triangle', vol: 0.12 }); tone(1320, 0.28, { type: 'triangle', vol: 0.1, when: 0.09 }); },
    insight() {
      [196, 247, 294, 392].forEach((f, i) => tone(f, 1.6, { type: 'triangle', vol: 0.07, attack: 0.04, when: i * 0.07 }));
      tone(1568, 0.9, { vol: 0.04, when: 0.3 }); tone(2093, 0.9, { vol: 0.03, when: 0.42 });
      noise(0.8, { filter: 'highpass', freq: 6000, vol: 0.03, attack: 0.2 });
    },
    bad() { tone(140, 0.32, { type: 'sawtooth', vol: 0.07 }); tone(132, 0.32, { type: 'sawtooth', vol: 0.06 }); },
    lock() { tone(220, 0.12, { type: 'square', vol: 0.05 }); tone(180, 0.18, { type: 'square', vol: 0.05, when: 0.1 }); },
    unlock() { noise(0.05, { freq: 3000, vol: 0.12 }); [523, 659, 784].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.09, when: 0.05 + i * 0.07 })); },
    msg() { tone(1046, 0.12, { vol: 0.12 }); tone(1568, 0.22, { vol: 0.1, when: 0.11 }); },
    static() { noise(0.18, { filter: 'highpass', freq: 2500, vol: 0.09 }); tone(60, 0.18, { type: 'square', vol: 0.02 }); },
    zoom() { tone(300, 0.35, { type: 'sine', vol: 0.06, glide: 900 }); noise(0.3, { filter: 'bandpass', freq: 2000, q: 4, vol: 0.04 }); },
    hint() { tone(660, 0.3, { type: 'sine', vol: 0.08 }); tone(990, 0.4, { type: 'sine', vol: 0.06, when: 0.12 }); },
    ring() { [0, 1.1].forEach(w => { tone(425, 0.6, { vol: 0.07, when: w, attack: 0.01 }); tone(450, 0.6, { vol: 0.05, when: w, attack: 0.01 }); }); },
    busy() { [0, 0.5, 1.0].forEach(w => tone(480, 0.25, { vol: 0.07, when: w })); },
    hangup() { tone(700, 0.08, { type: 'square', vol: 0.04 }); tone(500, 0.12, { type: 'square', vol: 0.04, when: 0.08 }); },
    sting() { tone(55, 2.5, { type: 'sawtooth', vol: 0.09, attack: 0.02 }); tone(82.4, 2.5, { type: 'sawtooth', vol: 0.06 }); noise(1.2, { filter: 'lowpass', freq: 300, vol: 0.12 }); },
    result() { [262, 330, 392, 523].forEach((f, i) => tone(f, 1.2, { type: 'triangle', vol: 0.07, when: i * 0.12 })); },
    elev() { tone(1318, 0.9, { vol: 0.08 }); tone(1046, 1.1, { vol: 0.07, when: 0.25 }); noise(0.6, { filter: 'lowpass', freq: 400, vol: 0.05, when: 0.1 }); },
    drawer() { noise(0.35, { filter: 'bandpass', freq: 900, q: 0.8, vol: 0.09, attack: 0.05 }); tone(90, 0.12, { type: 'square', vol: 0.04, when: 0.33 }); },
    page() { noise(0.12, { filter: 'bandpass', freq: 4000, q: 0.7, vol: 0.05, attack: 0.03 }); },
  };
  function sfx(name) { if (!ctx || !st.on || !st.sfx || !SFX[name]) return; SFX[name](); }

  /* ───────── 배경음 ───────── */
  function drone(freqs, type, cutoff, vol, lfoRate = 0.06) {
    const out = ctx.createGain(); out.gain.value = 0.0001;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.7;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = lfoRate; lg.gain.value = cutoff * 0.35;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    const nodes = [lfo];
    freqs.forEach((fr, i) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr; o.detune.value = (i % 2 ? 7 : -7); o.connect(f); o.start(); nodes.push(o); });
    f.connect(out); out.connect(bgmBus);
    return { out, nodes, vol };
  }
  function bed(filterType, freq, vol) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq;
    const out = ctx.createGain(); out.gain.value = 0.0001;
    src.connect(f); f.connect(out); out.connect(bgmBus); src.start();
    return { out, nodes: [src], vol };
  }
  const MOODS = {
    intro: () => [drone([41.2, 61.7], 'triangle', 180, 0.09, 0.04), bed('lowpass', 300, 0.02)],
    investigate: () => [drone([55, 82.4], 'sawtooth', 220, 0.05), bed('lowpass', 500, 0.012)],
    cctv: () => [drone([55, 82.4], 'sawtooth', 200, 0.035), drone([60, 120], 'sine', 400, 0.018, 0.5), bed('highpass', 5000, 0.012)],
    end_true: () => [drone([130.8, 164.8, 196, 261.6], 'triangle', 900, 0.04, 0.03)],
    end_bad: () => [drone([55, 110, 130.8, 164.8], 'triangle', 380, 0.045, 0.03), bed('lowpass', 200, 0.02)],
  };
  function setMood(m) {
    if (!ctx || ctx.state === 'suspended') { pendingMood = m; return; }
    if (m === mood) return;
    mood = m;
    const t = ctx.currentTime;
    if (moodNodes) {
      const old = moodNodes;
      old.forEach(p => { p.out.gain.cancelScheduledValues(t); p.out.gain.setValueAtTime(Math.max(p.out.gain.value, 0.0001), t); p.out.gain.exponentialRampToValueAtTime(0.0001, t + 1.5); });
      setTimeout(() => old.forEach(p => p.nodes.forEach(n => { try { n.stop(); } catch {} })), 1700);
    }
    moodNodes = MOODS[m] ? MOODS[m]() : [];
    moodNodes.forEach(p => p.out.gain.exponentialRampToValueAtTime(p.vol, t + 2.5));
  }

  /* ───────── 음성 (TTS) ───────── */
  let voices = [];
  const loadVoices = () => { voices = (window.speechSynthesis?.getVoices() || []).filter(v => v.lang && v.lang.toLowerCase().startsWith('ko')); };
  if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  /* 인물별 목소리: 성별·나이에 맞는 음성을 앞에서부터 찾는다 (맥 / 윈도우·엣지 / 구글 순).
   * 맞는 음성이 없으면 같은 성별 아무 음성, 그것도 없으면 높낮이로 흉내 낸다. */
  const ROLES = {
    narrator:  { gender: 'f', names: ['Yuna', '유나', 'SunHi', 'Heami', 'Google'], rate: 0.95, pitch: 1.0 },
    me:        { gender: 'f', names: ['Flo', 'Sandy', 'JiMin', 'SoonBok', 'Yuna'], rate: 1.05, pitch: 1.05 },   // 한서진 (29, 여)
    seoyun:    { gender: 'f', names: ['Shelley', 'Sandy', 'SeoHyeon', 'Yuna'], rate: 1.05, pitch: 1.15 },       // 한서윤 (26, 여)
    prof:      { gender: 'f', names: ['Grandma', 'YuJin', 'Shelley'], rate: 0.95, pitch: 0.9 },               // 문혜숙 (54, 여)
    detective: { gender: 'm', names: ['Reed', 'InJoon', 'Hyunsu', 'GookMin', 'Eddy'], rate: 1.0, pitch: 0.85 }, // 김도경 (40대, 남)
    taeo:      { gender: 'm', names: ['Rocko', 'Eddy', 'BongJin', 'InJoon'], rate: 1.08, pitch: 1.0 },          // 강태오 (31, 남)
    woobin:    { gender: 'm', names: ['Eddy', 'Rocko', 'Hyunsu'], rate: 1.05, pitch: 1.05 },                    // 정우빈 (28, 남)
    grandma:   { gender: 'f', names: ['Grandma', 'YuJin', 'Shelley'], rate: 0.88, pitch: 0.9 },                // 302호 할머니 (70대, 여)
    guard:     { gender: 'm', names: ['Grandpa', 'GookMin', 'Reed'], rate: 0.92, pitch: 0.9 },                  // 박영수 (60대, 남)
    seoa:      { gender: 'f', names: ['Sandy', 'Shelley', 'SeoHyeon', 'Yuna'], rate: 1.1, pitch: 1.2 },          // 박서아 (27, 여)
    doyun:     { gender: 'm', names: ['Eddy', 'Rocko', 'Hyunsu'], rate: 1.05, pitch: 1.0 },                     // 이도윤 (29, 남)
    manager:   { gender: 'm', names: ['Reed', 'InJoon', 'GookMin'], rate: 0.98, pitch: 0.95 },                  // 관리실 자동 응답 (남)
  };
  const MALE = /eddy|reed|rocko|grandpa|injoon|hyunsu|gookmin|bongjin|male|남/i, FEMALE = /yuna|flo|sandy|shelley|grandma|sunhi|heami|jimin|seohyeon|yujin|soonbok|female|여/i;
  function voiceFor(role) {
    const r = ROLES[role] || ROLES.narrator;
    for (const n of r.names) { const v = voices.find(v => v.name.toLowerCase().includes(n.toLowerCase())); if (v) return { v, fake: false }; }
    const same = voices.find(v => (r.gender === 'm' ? MALE : FEMALE).test(v.name));
    if (same) return { v: same, fake: false };
    return { v: voices[0] || null, fake: r.gender === 'm' };   // 남성 음성이 없으면 낮은 톤으로 흉내
  }
  function utter(text, role) {
    const r = ROLES[role] || ROLES.narrator, { v, fake } = voiceFor(role);
    const u = new SpeechSynthesisUtterance(String(text).replace(/["“”'‘’]/g, ''));
    u.lang = 'ko-KR'; u.rate = r.rate; u.pitch = fake ? 0.55 : r.pitch; u.volume = 0.95;
    if (v) u.voice = v;
    return u;
  }
  /* 녹음 파일(audio/voice, tools/make_voices.mjs로 생성)이 있으면 재생하고, 없으면 합성 음성으로 읽는다 */
  const fileKey = (role, text) => { let h = 5381; const s = role + '|' + String(text).replace(/["“”'‘’]/g, ''); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
  let token = 0, curAudio = null;
  function playOne(text, role, my) {
    return new Promise(res => {
      if (my !== token) return res();
      const k = fileKey(role, text);
      if (window.VOICE_FILES && VOICE_FILES[k]) {
        const a = new Audio('audio/voice/' + k + '.mp3'); curAudio = a; a.volume = 1;
        a.onended = a.onerror = () => res(); a.play().catch(() => res());
      } else if (window.speechSynthesis) {
        const u = utter(text, role); u.onend = u.onerror = () => res(); speechSynthesis.speak(u);
      } else res();
    });
  }
  async function speakSeq(lines) {
    stopSpeak(); if (!st.on || !st.voice) return;
    const my = ++token;
    for (const [text, who] of lines) { if (my !== token) return; await playOne(text, who || 'narrator', my); }
  }
  function speak(text, who = 'narrator') { speakSeq([[text, who]]); }
  function voiceInfo() { return Object.fromEntries(Object.keys(ROLES).map(k => { const x = voiceFor(k); return [k, x.v ? x.v.name + (x.fake ? ' (낮은 톤 흉내)' : '') : '없음']; })); }
  function stopSpeak() { token++; if (curAudio) { curAudio.pause(); curAudio = null; } if (window.speechSynthesis) speechSynthesis.cancel(); }

  /* ───────── 설정 ───────── */
  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(st.on ? 0.8 : 0, t, 0.05);
    bgmBus.gain.setTargetAtTime(st.bgm ? 1 : 0, t, 0.2);
    sfxBus.gain.setTargetAtTime(st.sfx ? 1 : 0, t, 0.05);
  }
  function toggle(k) {
    st[k] = !st[k]; save(); apply();
    if ((k === 'on' || k === 'voice') && !(st.on && st.voice)) stopSpeak();
    return st[k];
  }

  return { unlock, sfx, setMood, speak, speakSeq, stopSpeak, toggle, voiceInfo, ROLES, state: st };
})();
