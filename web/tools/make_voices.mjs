/* 모든 사건의 대사를 모아 Edge TTS 음성 파일로 만든다.
 * 실행: node tools/make_voices.mjs <edge-tts 실행 파일 경로>
 *   예) node tools/make_voices.mjs ~/.venvs/tts/bin/edge-tts
 * 결과: audio/voice/<key>.mp3 + js/voices.js (게임이 읽는 목록)
 * 이미 만든 파일은 건너뛴다. 대사를 고친 뒤 다시 실행하면 바뀐 줄만 새로 만든다. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = process.argv[2] || 'edge-tts';
const OUT = path.join(ROOT, 'audio/voice');
fs.mkdirSync(OUT, { recursive: true });

/* 인물별 목소리 (게임 audio.js의 역할 이름과 같다) */
const VOICE = {
  narrator:  ['ko-KR-SunHiNeural', '-6%', '-4Hz'],
  me:        ['ko-KR-SunHiNeural', '+0%', '+0Hz'],
  seoyun:    ['ko-KR-SunHiNeural', '+4%', '+16Hz'],
  prof:      ['ko-KR-SunHiNeural', '-6%', '-12Hz'],
  detective: ['ko-KR-InJoonNeural', '+0%', '-2Hz'],
  taeo:      ['ko-KR-HyunsuMultilingualNeural', '+6%', '+0Hz'],
  woobin:    ['ko-KR-HyunsuMultilingualNeural', '+2%', '-4Hz'],
  guard:     ['ko-KR-InJoonNeural', '-12%', '-14Hz'],
  grandma:   ['ko-KR-SunHiNeural', '-14%', '-20Hz'],
};

/* 게임(audio.js)과 같은 규칙으로 파일 이름을 만든다 */
const clean = t => String(t).replace(/["“”'‘’]/g, '');
const key = (role, text) => { let h = 5381; const s = role + '|' + clean(text); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };

function loadCase(id) {
  const ctx = { window: {} }; vm.createContext(ctx);
  for (const f of ['data.js', 'content.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'cases', id, f), 'utf8'), ctx);
  return { C: ctx.window.CASE, T: ctx.window.CONTENT };
}

function linesOf({ C, T }) {
  const L = [];
  C.intro.forEach(s => L.push(['narrator', s.kicker + '. ' + s.text]));
  Object.values(C.endings).forEach(e => e.slides.forEach(s => L.push(['narrator', s])));
  (C.voiceTest || []).forEach(([r, , t]) => L.push([r, t]));
  for (const fn of Object.values(T.examine || {})) for (const flag of [false, true]) {
    const st = { records: flag, unlocked: flag, has: () => flag, hasEv: () => flag, flags: {} };
    const e = fn(st); if (e.lines) e.lines.forEach(([, l]) => L.push([e.voice || 'narrator', l]));
  }
  const d = T.detectiveCall;
  if (d) { L.push(['detective', d.opening.join(' ')]); d.options.forEach(o => { L.push(['me', o.label]); L.push(['detective', o.reply]); }); }
  return L;
}

const all = new Map();
for (const c of fs.readdirSync(path.join(ROOT, 'cases'))) for (const [r, t] of linesOf(loadCase(c))) all.set(key(r, t), [r, t]);

let made = 0, skipped = 0;
for (const [k, [role, text]] of all) {
  const file = path.join(OUT, k + '.mp3');
  if (fs.existsSync(file)) { skipped++; continue; }
  const [voice, rate, pitch] = VOICE[role] || VOICE.narrator;
  const tries = [[voice, rate, pitch], [voice, rate, pitch], [voice, '+0%', '+0Hz'], ['ko-KR-InJoonNeural', rate, pitch]];
  let ok = false;
  for (const [v, r, p] of tries) {
    try { execFileSync(EDGE, ['--voice', v, `--rate=${r}`, `--pitch=${p}`, '--text', clean(text), '--write-media', file], { stdio: 'ignore' }); ok = true; break; }
    catch { execFileSync('sleep', ['1']); }
  }
  if (!ok) { console.log(`\n실패: [${role}] ${text}`); continue; }
  made++; process.stdout.write(`\r${made} 생성`);
}
const keys = fs.readdirSync(OUT).filter(f => f.endsWith('.mp3')).map(f => f.slice(0, -4)).filter(k => all.has(k));
fs.writeFileSync(path.join(ROOT, 'js/voices.js'), `/* tools/make_voices.mjs가 만든 음성 파일 목록. 직접 고치지 말 것. */\nwindow.VOICE_FILES = ${JSON.stringify(Object.fromEntries(keys.map(k => [k, 1])))};\n`);
console.log(`\n대사 ${all.size}줄 · 새로 생성 ${made} · 기존 ${skipped} · 목록 ${keys.length}`);
