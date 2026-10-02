/* 카드 원정대 — 효과음 (Web Audio로 즉석 합성, 음원 파일 없음)
 * 브라우저 정책상 첫 클릭 이후에만 소리가 난다. 음소거 설정은 브라우저에 기억한다.
 */
(function (global) {
  'use strict';
  let ac = null, master = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('card-expedition-mute') === '1'; } catch (e) { /* noop */ }
  const last = {};

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.55;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp).connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  ['pointerdown', 'keydown'].forEach((ev) => global.addEventListener(ev, () => { if (!muted) ensure(); }, { passive: true }));

  function env(g, t, a, peak, dec, sus = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(sus, t + a + dec);
  }
  function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = 0, attack = 0.005 } = {}) {
    const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    env(g, t, attack, vol, dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + attack + dur + 0.05);
  }
  function noise(dur, { vol = 0.3, at = 0, type = 'bandpass', freq = 1500, q = 1, sweep = 0, attack = 0.003, flutter = 0 } = {}) {
    const t = ac.currentTime + at, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.playbackRate.value = 0.9 + Math.random() * 0.2;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    if (flutter) {
      // 종이 찢는 소리: 진폭을 거칠게 떨어 섬유가 끊기는 느낌
      g.gain.setValueAtTime(0.0001, t);
      const steps = Math.floor(dur / 0.012);
      for (let k = 0; k < steps; k++) g.gain.setValueAtTime(vol * (0.25 + Math.random() * 0.75) * (1 - k / steps * 0.6), t + k * 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else env(g, t, attack, vol, dur);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const SOUNDS = {
    click: () => { noise(0.03, { vol: 0.12, freq: 3200, q: 2 }); },
    card: () => { noise(0.08, { vol: 0.16, freq: 2400, q: 0.8, sweep: 1.8 }); },
    place: () => { tone(150, 0.12, { vol: 0.35, slide: 0.45 }); noise(0.06, { vol: 0.25, freq: 900, q: 0.7 }); },
    attach: () => { tone(660, 0.08, { type: 'triangle', vol: 0.12 }); tone(990, 0.12, { type: 'triangle', vol: 0.1, at: 0.06 }); noise(0.05, { vol: 0.1, freq: 3000 }); },
    hit: () => { noise(0.07, { vol: 0.22, freq: 1300 + Math.random() * 500, q: 1.2 }); tone(110 + Math.random() * 30, 0.06, { vol: 0.12, slide: 0.6 }); },
    crit: () => { noise(0.1, { vol: 0.3, freq: 2200, q: 1.5 }); tone(180, 0.09, { type: 'square', vol: 0.08, slide: 0.5 }); },
    shoot: () => { noise(0.09, { vol: 0.1, freq: 4000, q: 3, sweep: 0.4 }); },
    magic: () => { tone(520, 0.22, { type: 'triangle', vol: 0.1, slide: 1.8 }); noise(0.2, { vol: 0.08, freq: 5000, q: 4, sweep: 0.5 }); },
    skill: () => { noise(0.25, { vol: 0.18, freq: 600, q: 1, sweep: 5 }); tone(440, 0.18, { type: 'triangle', vol: 0.08, at: 0.05, slide: 1.5 }); },
    heal: () => { [660, 880, 1100].forEach((f, i) => tone(f, 0.18, { type: 'sine', vol: 0.08, at: i * 0.05 })); },
    tear: () => { noise(0.32, { vol: 0.42, freq: 2600, q: 0.6, flutter: true }); noise(0.18, { vol: 0.2, freq: 900, q: 0.8, flutter: true, at: 0.05 }); },
    boom: () => { tone(90, 0.4, { vol: 0.45, slide: 0.4 }); noise(0.35, { vol: 0.3, type: 'lowpass', freq: 800, sweep: 0.3 }); },
    warn: () => { tone(880, 0.06, { type: 'square', vol: 0.05 }); tone(660, 0.08, { type: 'square', vol: 0.05, at: 0.08 }); },
    coin: () => { tone(1320, 0.08, { type: 'square', vol: 0.06 }); tone(1760, 0.18, { type: 'square', vol: 0.06, at: 0.07 }); },
    start: () => { noise(0.12, { vol: 0.3, freq: 700, q: 0.6 }); tone(196, 0.15, { type: 'sawtooth', vol: 0.08 }); tone(294, 0.25, { type: 'sawtooth', vol: 0.08, at: 0.12 }); },
    win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.14, at: i * 0.1 })); },
    lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.12, at: i * 0.14 })); },
    boss: () => { tone(65, 0.9, { type: 'sawtooth', vol: 0.12, slide: 0.8, attack: 0.1 }); noise(0.8, { vol: 0.12, type: 'lowpass', freq: 400, attack: 0.1 }); },
    step: () => { noise(0.04, { vol: 0.12, freq: 1800, q: 1 }); },
  };

  function play(name, gap = 0.03) {
    if (muted || !ensure() || !SOUNDS[name]) return;
    const now = ac.currentTime;
    if (last[name] && now - last[name] < gap) return; // 같은 소리가 한꺼번에 몰리지 않게
    last[name] = now;
    try { SOUNDS[name](); } catch (e) { /* 오디오 실패는 무시 */ }
  }
  function setMuted(m) { muted = m; try { localStorage.setItem('card-expedition-mute', m ? '1' : '0'); } catch (e) { /* noop */ } if (!m) ensure(); }

  global.SFX = { play, setMuted, get muted() { return muted; } };
})(window);
