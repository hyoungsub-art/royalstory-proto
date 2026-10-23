/* Kingdom Craft — original timber, stone and leather village audio palette.
 * No external recordings, fetches, gameplay RNG, or simulation state.
 * All samples are rendered once and reused; music is a separate presentation clock.
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const STORAGE_KEY = 'rs_audio_v2';
  const VERSION = 2;
  const LIMIT = 24;
  const DEFAULTS = Object.freeze({ muted: false, master: 0.78, sfx: 0.85, music: 0.24, ambience: 0.18 });
  const defs = {
    click:       ['가죽·나무 조작',  'ui',       0.13, 0.62, 0.045, 'ui',       4],
    select:      ['나무 표식 선택',  'ui',       0.26, 0.61, 0.10,  'ui',       4],
    place:       ['목조 골조·석재',  'building', 0.72, 0.87, 0.12,  'building', 4],
    demolish:    ['건물 철거',       'building', 0.68, 0.87, 0.14,  'building', 4],
    transform:   ['타워 개조',       'building', 0.88, 0.92, 0.26,  'upgrade',  4],
    levelup:     ['건물 성장',       'building', 0.93, 0.88, 0.26,  'upgrade',  4],
    tierup:      ['왕국 승급',       'building', 1.65, 0.90, 0.70,  'upgrade',  5],
    spawn:       ['병력 준비',       'unit',     0.31, 0.42, 0.18,  'spawn',    1],
    unitDown:    ['병력 쓰러짐',     'unit',     0.43, 0.47, 0.18,  'fall',     1],
    hero:        ['영웅 소환',       'unit',     1.12, 0.90, 0.50,  'upgrade',  4],
    footman:     ['검·방패 충돌',    'combat',   0.34, 0.65, 0.085, 'combat',   1],
    cavalry:     ['기병 돌격',       'combat',   0.52, 0.73, 0.16,  'combat',   1],
    archer:      ['활시위·화살',     'combat',   0.39, 0.62, 0.095, 'combat',   1],
    ram:         ['공성추 충격',     'combat',   0.80, 0.84, 0.23,  'heavy',    2],
    mage:        ['불씨·마법 화살',  'combat',   0.65, 0.61, 0.14,  'combat',   1],
    guardShot:   ['수비탑 석궁',     'combat',   0.45, 0.66, 0.12,  'combat',   1],
    arcaneShot:  ['비전탑 불꽃',     'combat',   0.72, 0.65, 0.18,  'combat',   1],
    destroy:     ['석조 붕괴',       'combat',   1.12, 0.86, 0.22,  'heavy',    3],
    star:        ['별 획득',         'reward',   0.88, 0.72, 0.26,  'reward',   4],
    coin:        ['금낭·금화 입금',  'reward',   0.46, 0.40, 0.70,  'coin',     2],
    minePick:    ['곡괭이·광석',     'economy',  0.48, 0.36, 1.15,  'mining',   1],
    workerStep:  ['일꾼 흙길 걸음',  'economy',  0.43, 0.28, 0.72,  'footstep', 1],
    attackOrder: ['공격 깃발',       'order',    0.60, 0.80, 0.14,  'order',    4],
    moveOrder:   ['이동 깃발',       'order',    0.43, 0.74, 0.12,  'order',    4],
    recall:      ['집결 복귀',       'order',    0.53, 0.73, 0.14,  'order',    4],
    tutorial:    ['학습 단계 완료',  'reward',   0.93, 0.78, 0.30,  'reward',   4],
    matchStart:  ['전투 개시',       'result',   1.50, 0.86, 0.80,  'fanfare',  5],
    hallWarning: ['본진 피격 경고',  'warning',  1.10, 0.78, 5.00,  'warning',  5],
    win:         ['승리의 팡파르',   'result',   3.40, 0.87, 1.50,  'fanfare',  6],
    lose:        ['패배의 여운',     'result',   2.65, 0.76, 1.50,  'fanfare',  6],
    error:       ['실행 불가',       'ui',       0.26, 0.65, 0.14,  'ui',       4]
  };
  const aliases = Object.freeze({ melee: 'footman', shoot: 'archer', magic: 'mage', boom: 'ram' });
  const definitions = {};
  Object.keys(defs).forEach(function (name) {
    const d = defs[name];
    definitions[name] = Object.freeze({ label: d[0], category: d[1], duration: d[2], gain: d[3], cooldown: d[4], group: d[5], priority: d[6] });
  });
  Object.keys(aliases).forEach(function (name) { definitions[name] = definitions[aliases[name]]; });
  Object.freeze(definitions);
  const cueNames = Object.freeze(Object.keys(definitions));

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function safeNumber(value, fallback) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }
  function makeRng(seed) {
    let state = (seed >>> 0) || 0x5f3759df;
    return function () { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  }
  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
    return value >>> 0;
  }

  /* Offline DSP: damped physical modes, band-limited friction, and plucked strings.
   * A local generator gives every variant its own texture without touching game RNG.
   */
  function renderer(rate, duration, seed, exactPitch) {
    const data = new Float32Array(Math.ceil(duration * rate));
    const random = makeRng(seed);
    const pitch = exactPitch ? 1 : 1 + (random() - 0.5) * 0.055;
    function add(start, length, fn) {
      const first = Math.max(0, Math.floor(start * rate));
      const count = Math.min(Math.ceil(length * rate), data.length - first);
      for (let i = 0; i < count; i++) data[first + i] += fn(i / rate, i, count);
    }
    function tone(start, length, freq, amp, decay, attack, sweep) {
      if (freq * pitch > rate * 0.44) return;
      const phase = random() * 0.10;
      const atk = Math.max(0.0008, attack || 0.003);
      add(start, length, function (t) {
        const edge = Math.min(1, t / atk) * Math.min(1, Math.max(0, length - t) / 0.025);
        const angle = TAU * (freq * pitch * t + (sweep || 0) * t * t * 0.5) + phase;
        return Math.sin(angle) * amp * edge * Math.exp(-t * (decay || 8));
      });
    }
    function noise(start, length, amp, low, high, decay, attack, swell) {
      let fast = 0, slow = 0;
      const fastA = 1 - Math.exp(-TAU * Math.min(high || 6000, rate * 0.44) / rate);
      const slowA = 1 - Math.exp(-TAU * Math.max(20, low || 20) / rate);
      const atk = attack || 0.002;
      add(start, length, function (t) {
        const white = random() * 2 - 1;
        fast += fastA * (white - fast);
        slow += slowA * (fast - slow);
        let env = Math.min(1, t / atk) * Math.exp(-t * (decay || 9));
        if (swell) env *= Math.sin(Math.PI * t / length);
        env *= Math.min(1, Math.max(0, length - t) / 0.025);
        return (fast - slow) * amp * env;
      });
    }
    function modes(start, length, freq, amp, ratios, damping) {
      const total = ratios.reduce(function (sum, ratio, i) { return sum + 1 / Math.pow(i + 1, 1.25); }, 0);
      ratios.forEach(function (ratio, i) {
        tone(start, length, freq * ratio, amp / (total * Math.pow(i + 1, 1.25)), damping * (1 + i * 0.36), 0.0015);
      });
    }
    function wood(start, amp, freq) {
      modes(start, 0.19, freq || 210, amp * 0.70, [1, 1.59, 2.31, 3.81], 37);
      noise(start, 0.075, amp * 1.35, 150, 3200, 52, 0.0018);
      noise(start + 0.008, 0.10, amp * 0.27, 90, 750, 28, 0.003);
    }
    function metal(start, amp, freq, length) {
      modes(start, length || 0.27, freq || 820, amp * 0.69, [1, 1.478, 2.09, 2.71, 3.93, 5.14], 22);
      noise(start, 0.047, amp * 1.05, 1250, 6800, 77, 0.0015);
    }
    function thud(start, amp, low) {
      tone(start, 0.26, low || 94, amp * 0.43, 21, 0.004, -65);
      tone(start, 0.15, 167, amp * 0.10, 34, 0.003, -70);
      noise(start, 0.29, amp * 1.25, 35, 1150, 17, 0.003);
    }
    function pluck(start, freq, amp, length, dark) {
      const dur = length || 0.6;
      // Noise-excited delay line models a plucked gut string, including pick scrape.
      // Fractional all-pass tuning prevents beating against the wooden pipe.
      const period = rate / (freq * pitch) - 0.5;
      const size = Math.max(4, Math.floor(period)), fraction = period - Math.floor(period);
      const coefficient = (1 - fraction) / (1 + fraction);
      const string = new Float32Array(size);
      let smooth = 0, average = 0;
      for (let i = 0; i < size; i++) {
        smooth += (dark ? 0.47 : 0.76) * ((random() * 2 - 1) - smooth);
        string[i] = smooth; average += smooth;
      }
      average /= size;
      for (let i = 0; i < size; i++) string[i] -= average;
      let cursor = 0, previous = 0, priorAverage = 0, allpass = 0;
      add(start, dur, function (t) {
        const out = string[cursor], filtered = (out + previous) * 0.5;
        const next = coefficient * filtered + priorAverage - coefficient * allpass;
        previous = out; priorAverage = filtered; allpass = next;
        string[cursor] = next * (dark ? 0.985 : 0.994);
        cursor = (cursor + 1) % size;
        const env = Math.min(1, t / 0.003) * Math.min(1, Math.max(0, dur - t) / 0.05);
        return out * amp * 2.1 * env;
      });
      noise(start, 0.048, amp * 0.16, 950, 4200, 65, 0.002);
      modes(start, 0.24, freq * 0.62, amp * 0.10, [1, 2.14], 21);
    }
    function horn(start, freq, amp, length) {
      const dur = length || 0.42;
      [1, 2, 3, 4, 5, 6].forEach(function (h) {
        add(start, dur, function (t) {
          const env = Math.min(1, t / 0.065) * Math.min(1, (dur - t) / 0.15);
          const vibrato = 0.0022 * Math.sin(TAU * 4.1 * t) + 0.0015 * Math.sin(TAU * 6.7 * t);
          return Math.sin(TAU * freq * pitch * h * t + vibrato * freq) * amp * env * Math.exp(-t * 0.75) / (Math.pow(h, 1.55) * 2.0);
        });
      });
      noise(start, dur, amp * 0.23, 330, 2100, 1.5, 0.06);
    }
    function cloth(start, amp) { noise(start, 0.22, amp, 170, 2600, 10, 0.012, true); }
    function flourish(notes, start, step, amp) {
      notes.forEach(function (freq, i) {
        pluck(start + i * step, freq, amp * (1 - i * 0.045), 0.65, true);
      });
    }
    return { data: data, random: random, add: add, tone: tone, noise: noise, wood: wood, metal: metal,
      thud: thud, pluck: pluck, horn: horn, cloth: cloth, flourish: flourish };
  }

  function finish(data, rate, target) {
    // DC-block, tame overlapping transients, and leave true output headroom.
    let previousIn = 0, previousOut = 0, square = 0, peak = 0;
    const dc = Math.exp(-TAU * 24 / rate);
    for (let i = 0; i < data.length; i++) {
      const v = data[i] - previousIn + dc * previousOut;
      previousIn = data[i]; previousOut = v;
      const faded = v * Math.min(1, i / (rate * 0.002)) * Math.min(1, (data.length - 1 - i) / (rate * 0.022));
      data[i] = Math.tanh(faded * 1.15);
      square += data[i] * data[i]; peak = Math.max(peak, Math.abs(data[i]));
    }
    const rms = Math.sqrt(square / Math.max(1, data.length));
    const scale = Math.min(0.88 / Math.max(peak, 0.0001), (target || 0.12) / Math.max(rms, 0.0001), 3);
    for (let i = 0; i < data.length; i++) data[i] *= scale;
    return data;
  }

  function synthesize(name, sampleRate, variant) {
    const key = aliases[name] || name;
    const def = definitions[key];
    if (!def) return new Float32Array(0);
    const rate = clamp(Math.round(safeNumber(sampleRate, 22050)), 8000, 96000);
    const v = Math.round(safeNumber(variant, 0));
    const r = renderer(rate, def.duration, hash(key + ':' + v));
    switch (key) {
      case 'click':
        r.wood(0, 0.23, 265); r.noise(0, 0.070, 0.29, 120, 1500, 32, 0.002); break;
      case 'select':
        r.wood(0, 0.23, 235); r.wood(0.075, 0.11, 330); r.cloth(0.015, 0.21); break;
      case 'error':
        r.wood(0, 0.27, 145); r.wood(0.095, 0.15, 121); r.cloth(0, 0.15); break;
      case 'place':
        r.cloth(0, 0.19); r.thud(0.025, 0.45, 98); r.wood(0.055, 0.42, 190);
        r.wood(0.185, 0.34, 267); r.wood(0.345, 0.25, 216); r.metal(0.19, 0.08, 1050, 0.14);
        r.noise(0.06, 0.49, 0.32, 170, 2700, 7); break;
      case 'demolish':
        r.wood(0, 0.32, 162); r.wood(0.085, 0.25, 121); r.thud(0.145, 0.44, 82);
        r.noise(0.05, 0.53, 0.53, 80, 2900, 5); r.wood(0.28, 0.19, 315); r.wood(0.40, 0.12, 420); break;
      case 'transform':
        r.wood(0, 0.31, 180); r.wood(0.12, 0.28, 245); r.metal(0.25, 0.19, 750, 0.20);
        r.thud(0.27, 0.25, 105); r.pluck(0.35, 220, 0.21, 0.50, true); r.pluck(0.37, 293.66, 0.13, 0.49, true); break;
      case 'levelup':
        r.wood(0, 0.27, 205); r.wood(0.12, 0.25, 264); r.metal(0.135, 0.10, 1050, 0.17);
        r.pluck(0.24, 146.83, 0.23, 0.65, true); r.pluck(0.27, 220, 0.19, 0.61, true); r.pluck(0.30, 293.66, 0.16, 0.59, true); break;
      case 'tierup':
        r.cloth(0, 0.30); r.thud(0.065, 0.36, 86); r.wood(0.20, 0.22, 182);
        r.horn(0.13, 220, 0.24, 0.47); r.horn(0.49, 293.66, 0.25, 0.76);
        r.pluck(0.78, 146.83, 0.19, 0.8, true); r.pluck(0.81, 220, 0.17, 0.76, true); break;
      case 'spawn':
        r.cloth(0, 0.32); r.wood(0.045, 0.18, 175); r.metal(0.09, 0.06, 960, 0.15); break;
      case 'unitDown':
        r.cloth(0, 0.27); r.thud(0.04, 0.29, 118); r.metal(0.075, 0.12, 510, 0.26);
        r.noise(0.09, 0.26, 0.15, 180, 2400, 12, 0.006); break;
      case 'hero':
        r.cloth(0, 0.33); r.thud(0.10, 0.29, 90); r.horn(0.14, 220, 0.19, 0.68);
        r.pluck(0.35, 146.83, 0.21, 0.73, true); r.pluck(0.39, 293.66, 0.16, 0.70, true); break;
      case 'footman':
        r.noise(0, 0.14, 0.53, 480, 4500, 13, 0.012, true);
        r.metal(0.061, 0.49, 970, 0.24); r.wood(0.067, 0.23, 245); r.thud(0.07, 0.17, 126); break;
      case 'cavalry':
        r.wood(0, 0.28, 205); r.thud(0.005, 0.25, 90); r.wood(0.105, 0.28, 285);
        r.thud(0.115, 0.16, 110); r.cloth(0.09, 0.32); r.metal(0.22, 0.31, 780, 0.26); break;
      case 'archer':
        r.cloth(0, 0.12); r.pluck(0.015, 137, 0.29, 0.26, true);
        r.wood(0.02, 0.12, 320); r.noise(0.038, 0.25, 0.43, 1200, 5800, 10, 0.014, true); break;
      case 'ram':
        r.cloth(0, 0.24); r.wood(0.025, 0.51, 145); r.thud(0.048, 0.64, 76);
        r.noise(0.05, 0.58, 0.65, 70, 2500, 5); r.metal(0.11, 0.12, 430, 0.30);
        r.wood(0.22, 0.18, 310); r.wood(0.35, 0.11, 420); break;
      case 'mage':
        r.cloth(0, 0.23); r.noise(0.025, 0.44, 0.52, 180, 4200, 5, 0.035, true);
        r.thud(0.13, 0.20, 146); r.noise(0.17, 0.30, 0.26, 1750, 5800, 11, 0.002);
        [0.08, 0.155, 0.245].forEach(function (t, i) { r.wood(t, 0.10 - i * 0.02, 510 + i * 170); }); break;
      case 'guardShot':
        r.wood(0, 0.43, 185); r.metal(0.02, 0.18, 430, 0.25);
        r.pluck(0.02, 122.5, 0.30, 0.29, true); r.noise(0.05, 0.28, 0.44, 780, 6200, 10, 0.012, true); break;
      case 'arcaneShot':
        r.noise(0, 0.45, 0.44, 180, 3100, 5, 0.045, true); r.thud(0.105, 0.29, 103);
        r.noise(0.12, 0.48, 0.47, 900, 5200, 7, 0.005);
        r.metal(0.095, 0.10, 970, 0.28); r.wood(0.20, 0.14, 430); r.wood(0.28, 0.08, 610); break;
      case 'destroy':
        r.thud(0, 0.72, 73); r.wood(0.025, 0.40, 143); r.metal(0.04, 0.19, 340, 0.48);
        r.noise(0.04, 0.86, 0.65, 55, 3400, 4.1); r.wood(0.19, 0.22, 235);
        r.thud(0.30, 0.26, 102); r.wood(0.45, 0.14, 380); r.wood(0.68, 0.08, 280); break;
      case 'coin':
        r.cloth(0, 0.43); r.thud(0.045, 0.18, 138); r.wood(0.047, 0.15, 315);
        r.metal(0.075, 0.16, 1370, 0.17); r.metal(0.135, 0.09, 1840, 0.14);
        r.noise(0.13, 0.20, 0.15, 650, 3100, 17, 0.005); break;
      case 'minePick':
        r.noise(0, 0.14, 0.26, 300, 2500, 9, 0.014, true); r.metal(0.064, 0.23, 1190, 0.22);
        r.wood(0.064, 0.20, 375); r.thud(0.066, 0.19, 144);
        r.noise(0.075, 0.31, 0.26, 230, 3300, 10, 0.003); r.wood(0.20, 0.06, 580); break;
      case 'workerStep':
        r.thud(0.012, 0.19, 153); r.noise(0, 0.20, 0.34, 80, 1750, 15, 0.009);
        r.cloth(0.02, 0.17); r.wood(0.195, 0.07, 185);
        r.noise(0.20, 0.16, 0.20, 150, 2100, 18, 0.008); break;
      case 'star':
        r.pluck(0.01, 293.66, 0.22, 0.7, true); r.pluck(0.12, 440, 0.18, 0.68, true); r.cloth(0.03, 0.18); break;
      case 'attackOrder':
        r.cloth(0, 0.42); r.thud(0.015, 0.30, 105); r.wood(0.035, 0.18, 240);
        r.horn(0.055, 220, 0.23, 0.42); break;
      case 'moveOrder':
        r.cloth(0, 0.40); r.wood(0.018, 0.20, 270); r.wood(0.12, 0.15, 348);
        r.pluck(0.04, 293.66, 0.14, 0.34, true); break;
      case 'recall':
        r.cloth(0, 0.32); r.wood(0.02, 0.16, 310); r.pluck(0.05, 293.66, 0.20, 0.40, true);
        r.pluck(0.17, 220, 0.17, 0.34, true); break;
      case 'tutorial':
        r.cloth(0, 0.21); r.wood(0.03, 0.15, 284);
        r.flourish([220, 293.66, 440], 0.07, 0.13, 0.22); break;
      case 'matchStart':
        r.thud(0, 0.38, 88); r.wood(0.16, 0.21, 220); r.thud(0.33, 0.26, 103);
        r.horn(0.12, 220, 0.24, 0.42); r.horn(0.48, 293.66, 0.24, 0.70); r.cloth(0.77, 0.26); break;
      case 'hallWarning':
        r.wood(0, 0.34, 165); r.thud(0.02, 0.23, 91); r.wood(0.27, 0.32, 178);
        r.thud(0.29, 0.21, 91); r.horn(0.34, 146.83, 0.20, 0.64); break;
      case 'win':
        r.thud(0.02, 0.34, 86); r.thud(0.35, 0.20, 100); r.wood(0.52, 0.13, 230);
        [[0.08, 220, 0.38], [0.38, 261.63, 0.38], [0.68, 293.66, 0.43], [1.07, 440, 1.15]].forEach(function (note) {
          r.horn(note[0], note[1], 0.28, note[2]); r.horn(note[0], note[1] * 0.5, 0.18, note[2]);
        });
        r.flourish([293.66, 349.23, 440], 1.12, 0.14, 0.19);
        r.pluck(1.53, 146.83, 0.23, 1.30, true); r.pluck(1.57, 220, 0.18, 1.26, true); r.cloth(1.1, 0.18); break;
      case 'lose':
        r.thud(0.02, 0.24, 76); r.horn(0.05, 293.66, 0.22, 0.55);
        r.horn(0.53, 261.63, 0.20, 0.56); r.horn(1.04, 220, 0.20, 0.90);
        r.pluck(0.1, 146.83, 0.20, 1.30, true); r.pluck(1.08, 164.81, 0.14, 1.35, true);
        r.pluck(1.10, 220, 0.14, 1.35, true); break;
    }
    const target = def.category === 'ui' ? 0.065 : def.category === 'economy' || key === 'coin' ? 0.070 :
      key === 'win' || key === 'lose' ? 0.105 : def.category === 'combat' ? 0.090 : 0.095;
    return finish(r.data, rate, target);
  }

  const settings = Object.assign({}, DEFAULTS);
  try {
    const stored = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored && typeof stored === 'object') {
      ['master', 'sfx', 'music', 'ambience'].forEach(function (key) {
        if (Number.isFinite(stored[key])) settings[key] = clamp(stored[key], 0, 1);
      });
      settings.muted = stored.muted === true;
    } else settings.muted = root.localStorage.getItem('rs_mute') === '1';
  } catch (_) { try { settings.muted = root.localStorage.getItem('rs_mute') === '1'; } catch (_) {} }

  let context = null, master = null, compressor = null, channels = null, reverb = null;
  let unlocked = false, needsGesture = true, visibilitySuspended = false, scene = 'lobby';
  let timer = null, musicBeat = 0, nextBeatTime = 0, ambienceStarted = false;
  let played = 0, dropped = 0, serial = 0;
  const bufferCache = new Map(), sampleCache = new Map(), voices = new Set();
  const lastCue = new Map(), lastGroup = new Map(), variants = new Map();
  const supported = !!(root.AudioContext || root.webkitAudioContext);
  const hidden = function () { return !!(root.document && root.document.hidden); };
  function settingsChanged() {
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({ version: VERSION }, settings)));
      root.localStorage.setItem('rs_mute', settings.muted ? '1' : '0');
    } catch (_) {}
    try { if (root.dispatchEvent && root.CustomEvent) root.dispatchEvent(new root.CustomEvent('royalaudiochange', { detail: getSettings() })); } catch (_) {}
  }
  function getSettings() { return Object.assign({}, settings); }
  function setGain(node, value, smoothing) {
    if (!node || !context) return;
    const param = node.gain;
    try {
      param.cancelScheduledValues(context.currentTime);
      if (smoothing && param.setTargetAtTime) param.setTargetAtTime(value, context.currentTime, smoothing);
      else param.setValueAtTime(value, context.currentTime);
    } catch (_) { try { param.value = value; } catch (_) {} }
  }
  function applyVolumes() {
    if (!context || !master) return;
    setGain(master, settings.muted ? 0 : settings.master, settings.muted ? 0 : 0.012);
    ['sfx', 'music', 'ambience'].forEach(function (key) { setGain(channels[key], settings[key], 0.012); });
  }
  function impulse() {
    const length = Math.ceil(context.sampleRate * 0.66);
    const result = context.createBuffer(2, length, context.sampleRate);
    const random = makeRng(0x726f7961);
    for (let side = 0; side < 2; side++) {
      const samples = result.getChannelData(side);
      let smooth = 0;
      for (let i = 0; i < length; i++) {
        const t = i / context.sampleRate;
        smooth += 0.35 * ((random() * 2 - 1) - smooth);
        const begin = Math.min(1, Math.max(0, t - 0.016) / 0.008);
        samples[i] = smooth * Math.exp(-t * 9.4) * begin * 0.34;
      }
      [0.029, 0.047, 0.073, 0.109].forEach(function (at, index) {
        samples[Math.floor((at + side * 0.0023) * context.sampleRate)] += 0.22 / (index + 1);
      });
    }
    return result;
  }
  function resetReverb() {
    if (!context || !reverb) return;
    try { reverb.send.disconnect(); reverb.convolver.disconnect(); } catch (_) {}
    try {
      reverb.convolver = context.createConvolver(); reverb.convolver.buffer = reverb.impulse;
      reverb.send.connect(reverb.convolver); reverb.convolver.connect(reverb.filter);
    } catch (_) {}
  }
  function ensureContext() {
    if (context) return true;
    if (!supported) return false;
    try {
      const AudioContextClass = root.AudioContext || root.webkitAudioContext;
      context = new AudioContextClass({ latencyHint: 'interactive' });
      master = context.createGain(); compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -16; compressor.knee.value = 15; compressor.ratio.value = 3;
      compressor.attack.value = 0.003; compressor.release.value = 0.18;
      master.connect(compressor);
      // A final safety stage catches coincident attacks before device clipping.
      // The soft knee is transparent below -5 dB and never exceeds 0.95 full scale.
      if (context.createWaveShaper) {
        const limiter = context.createWaveShaper(), curve = new Float32Array(2049);
        for (let i = 0; i < curve.length; i++) {
          const input = i * 2 / (curve.length - 1) - 1, magnitude = Math.abs(input);
          curve[i] = magnitude <= 0.55 ? input : Math.sign(input) * (0.55 + 0.4 * Math.tanh((magnitude - 0.55) / 0.4));
        }
        limiter.curve = curve; limiter.oversample = '2x';
        compressor.connect(limiter); limiter.connect(context.destination);
      } else {
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20;
        limiter.attack.value = 0.001; limiter.release.value = 0.065;
        compressor.connect(limiter); limiter.connect(context.destination);
      }
      channels = { sfx: context.createGain(), music: context.createGain(), ambience: context.createGain() };
      Object.keys(channels).forEach(function (name) { channels[name].connect(master); });
      if (context.createConvolver && context.createBiquadFilter) {
        const send = context.createGain(), filter = context.createBiquadFilter(), wet = context.createGain();
        send.gain.value = 0.17; wet.gain.value = 0.60; filter.type = 'lowpass'; filter.frequency.value = 3900;
        channels.sfx.connect(send); channels.music.connect(send); filter.connect(wet); wet.connect(master);
        reverb = { send: send, filter: filter, wet: wet, convolver: null, impulse: impulse() };
        resetReverb();
      }
      applyVolumes();
      return true;
    } catch (_) {
      try { if (context && context.close) context.close(); } catch (_) {}
      context = null; master = null; channels = null; reverb = null;
      return false;
    }
  }
  function forgetVoice(voice) {
    voices.delete(voice);
    try { voice.source.disconnect(); voice.envelope.disconnect(); if (voice.pan) voice.pan.disconnect(); } catch (_) {}
  }
  function stopVoice(voice, immediate) {
    if (!voice || voice.stopped) return;
    voice.stopped = true;
    try {
      const now = context.currentTime;
      voice.envelope.gain.cancelScheduledValues(now);
      voice.envelope.gain.setValueAtTime(immediate ? 0 : voice.level, now);
      if (!immediate) voice.envelope.gain.linearRampToValueAtTime(0, now + 0.012);
      voice.source.stop(immediate ? now : now + 0.014);
    } catch (_) {}
    // Keep the connection for its 12 ms release when stealing a busy combat voice.
    if (immediate) forgetVoice(voice); else voices.delete(voice);
  }
  function stopAll(channel) {
    Array.from(voices).forEach(function (voice) { if (!channel || voice.channel === channel) stopVoice(voice, true); });
  }
  function pruneVoices() {
    if (!context) return;
    Array.from(voices).forEach(function (voice) {
      if (!voice.loop && voice.end <= context.currentTime - 0.02) forgetVoice(voice);
    });
  }
  function reserveVoice(priority) {
    pruneVoices();
    if (voices.size < LIMIT) return true;
    let candidate = null;
    voices.forEach(function (voice) {
      if (voice.channel === 'sfx' && (!candidate || voice.priority < candidate.priority || (voice.priority === candidate.priority && voice.started < candidate.started))) candidate = voice;
    });
    if (candidate && candidate.priority < priority) { stopVoice(candidate, false); return true; }
    dropped++; return false;
  }
  function audioBuffer(key, samples, rate) {
    if (bufferCache.has(key)) return bufferCache.get(key);
    const buffer = context.createBuffer(1, samples.length, rate);
    buffer.getChannelData(0).set(samples);
    bufferCache.set(key, buffer);
    return buffer;
  }
  function cueBuffer(name, variant) {
    const key = name + ':' + variant;
    if (bufferCache.has(key)) return bufferCache.get(key);
    const samples = sampleCache.has(key) ? sampleCache.get(key) : synthesize(name, 22050, variant);
    const buffer = audioBuffer(key, samples, 22050);
    sampleCache.delete(key); return buffer;
  }
  function startBuffer(buffer, options) {
    const opts = options || {};
    const priority = opts.priority == null ? 1 : opts.priority;
    if (!context || !reserveVoice(priority)) return false;
    try {
      const source = context.createBufferSource(), envelope = context.createGain();
      source.buffer = buffer; source.loop = !!opts.loop;
      const rate = clamp(safeNumber(opts.rate, 1), 0.25, 4);
      source.playbackRate.value = rate;
      const when = Math.max(context.currentTime, safeNumber(opts.when, context.currentTime));
      const level = clamp(safeNumber(opts.gain, 1), 0, 1.8);
      const duration = opts.duration || buffer.duration / rate;
      const attack = opts.attack || 0.003;
      envelope.gain.setValueAtTime(0, when);
      envelope.gain.linearRampToValueAtTime(level, when + attack);
      if (!opts.loop) {
        const end = when + duration;
        envelope.gain.setValueAtTime(level, Math.max(when + attack, end - (opts.release || 0.025)));
        envelope.gain.linearRampToValueAtTime(0, end);
      }
      source.connect(envelope);
      let pan = null;
      if (context.createStereoPanner) {
        pan = context.createStereoPanner(); pan.pan.value = clamp(safeNumber(opts.pan, 0), -0.85, 0.85);
        envelope.connect(pan); pan.connect(channels[opts.channel || 'sfx']);
      } else envelope.connect(channels[opts.channel || 'sfx']);
      const voice = { id: ++serial, source: source, envelope: envelope, pan: pan, channel: opts.channel || 'sfx', priority: priority,
        started: when, end: when + duration, loop: !!opts.loop, stopped: false, level: level };
      voices.add(voice);
      source.onended = function () { forgetVoice(voice); };
      source.start(when);
      if (!opts.loop) source.stop(when + duration + 0.004);
      return true;
    } catch (_) { dropped++; return false; }
  }

  function play(name, options) {
    const key = aliases[name] || name, def = definitions[key];
    if (!def || settings.muted || settings.master <= 0 || settings.sfx <= 0 || hidden() || !unlocked || needsGesture || !context || context.state !== 'running') return false;
    const opts = options || {}, now = context.currentTime;
    const interval = def.cooldown;
    if (now - (lastCue.has(key) ? lastCue.get(key) : -100) < interval) { dropped++; return false; }
    // A shared attack budget prevents dozens of units sounding as an abrasive wall.
    const groupInterval = def.group === 'combat' ? 0.046 : def.group === 'heavy' ? 0.10 : def.group === 'coin' ? 0.60 : 0.018;
    if (now - (lastGroup.has(def.group) ? lastGroup.get(def.group) : -100) < groupInterval) { dropped++; return false; }
    const nextVariant = variants.get(key) || 0;
    const variant = opts.variant == null ? nextVariant % 3 : Math.abs(Math.round(safeNumber(opts.variant, 0))) % 3;
    try {
      const buffer = cueBuffer(key, variant);
      const ok = startBuffer(buffer, { channel: 'sfx', gain: def.gain * clamp(safeNumber(opts.gain, 1), 0, 1.5), pan: opts.pan, priority: def.priority });
      if (ok) { variants.set(key, nextVariant + 1); lastCue.set(key, now); lastGroup.set(def.group, now); played++; }
      return ok;
    } catch (_) { dropped++; return false; }
  }

  /* Original eight-bar D Dorian village air in a slow 4/4 metre.
   * Gut-string lute, wooden pipe, frame drum and rim taps; no synth pad or bell.
   * Pauses and dry acoustic transients leave room for workers and battle orders.
   * Scheduling is bounded to 180 ms and every queued source is tracked for stop.
   */
  const harmony = [
    [146.832, 220, 293.665], [130.813, 195.998, 261.626], [97.999, 146.832, 195.998], [146.832, 220, 293.665],
    [146.832, 174.614, 220], [97.999, 123.471, 146.832], [130.813, 164.814, 195.998], [146.832, 220, 293.665]
  ];
  const melody = [
    [440, 0, 0, 392, 0, 349.23, 0, 0], [329.63, 0, 0, 392, 0, 0, 293.66, 0],
    [293.66, 0, 349.23, 0, 392, 0, 0, 0], [440, 0, 0, 0, 293.66, 0, 0, 0],
    [523.25, 0, 0, 493.88, 0, 440, 0, 0], [392, 0, 0, 349.23, 0, 293.66, 0, 0],
    [329.63, 0, 392, 0, 440, 0, 392, 0], [349.23, 0, 0, 329.63, 0, 293.66, 0, 0]
  ];
  const instrumentCache = new Map();
  function instrumentSamples(type, rate) {
    const key = type + ':' + rate;
    if (instrumentCache.has(key)) return instrumentCache.get(key);
    const length = type === 'pipe' ? 1.05 : type === 'drum' ? 0.38 : type === 'tap' ? 0.20 : 1.4;
    const r = renderer(rate, length, hash('village:' + key), true);
    if (type === 'lute') {
      r.pluck(0, 220, 0.37, length, true); r.wood(0, 0.025, 205);
    } else if (type === 'drum') {
      r.thud(0, 0.31, 97); r.tone(0.004, 0.24, 149, 0.075, 18, 0.004);
      r.noise(0, 0.15, 0.29, 80, 2200, 24, 0.003);
    } else if (type === 'tap') { r.wood(0, 0.25, 325); r.noise(0, 0.09, 0.18, 250, 2300, 32, 0.003); }
    else if (type === 'pipe') {
      const base = 440;
      [1, 2, 3, 4].forEach(function (h) {
        r.add(0, length, function (t) {
          const env = Math.min(1, t / 0.09) * Math.pow(Math.sin(Math.PI * t / length), 0.85);
          const breath = 1 + 0.045 * Math.sin(TAU * 7.3 * t) + 0.026 * Math.sin(TAU * 13.7 * t);
          const drift = Math.sin(TAU * 4.1 * t) * 0.055 + Math.sin(TAU * 1.3 * t) * 0.08;
          return Math.sin(TAU * base * h * t + drift * h) * env * breath * 0.27 / Math.pow(h, 2.5);
        });
      });
      r.noise(0.01, length - 0.01, 0.15, 550, 3100, 0.45, 0.08, true);
      r.noise(0, 0.115, 0.17, 1000, 4500, 20, 0.012);
    }
    const result = finish(r.data, rate, type === 'pipe' ? 0.08 : type === 'tap' ? 0.065 : 0.09);
    instrumentCache.set(key, result); return result;
  }
  function instrument(type) {
    const key = 'instrument:' + type;
    if (bufferCache.has(key)) return bufferCache.get(key);
    return audioBuffer(key, instrumentSamples(type, 22050), 22050);
  }
  function musicNote(type, frequency, when, gain, pan) {
    if (settings.music <= 0) return;
    const base = type === 'pipe' ? 440 : 220;
    startBuffer(instrument(type), { channel: 'music', when: when, rate: type === 'drum' || type === 'tap' ? 1 : frequency / base, gain: gain,
      pan: pan || 0, priority: 0, attack: type === 'pipe' ? 0.035 : 0.006, release: type === 'pipe' ? 0.10 : 0.05 });
  }
  function scoreEvents(beat, mode) {
    const bar = Math.floor(beat / 8) % harmony.length, step = beat % 8, chord = harmony[bar], battle = mode === 'battle';
    const notes = [];
    function addNote(type, freq, gain, pan, delay) { notes.push({ type: type, freq: freq, gain: gain, pan: pan || 0, delay: delay || 0 }); }
    if (step % 2 === 0) {
      const stringIndex = [0, 2, 1, 2][step / 2];
      addNote('lute', chord[stringIndex], battle ? 0.47 : 0.55, step % 4 ? 0.19 : -0.19, step === 6 ? 0.012 : 0);
    }
    if (step === 0) {
      addNote('lute', chord[2], 0.19, 0.22, 0.026);
      if (battle) addNote('drum', 220, 0.39, -0.08);
    }
    const pitch = melody[bar][step];
    if (pitch && (!battle || bar % 2 === 0 && (step === 0 || step === 4))) addNote('pipe', pitch, battle ? 0.28 : 0.34, 0.10, 0.018);
    if (battle && step === 4) addNote('drum', 220, 0.27, 0.08);
    if (battle && (step === 3 || step === 7) || !battle && bar % 2 === 1 && step === 6) addNote('tap', 220, battle ? 0.22 : 0.14, -0.16, 0.012);
    return notes;
  }
  function scheduleBeat(beat, when) {
    scoreEvents(beat, scene).forEach(function (note) { musicNote(note.type, note.freq, when + note.delay, note.gain, note.pan); });
  }
  // Offline audition uses the same instrument samples and score as live music.
  // It contains dry mono music at the default mix level, before the room reverb.
  function synthesizeMusic(mode, seconds, sampleRate) {
    const rate = clamp(Math.round(safeNumber(sampleRate, 22050)), 8000, 48000);
    const duration = clamp(safeNumber(seconds, 20), 1, 120), data = new Float32Array(Math.ceil(duration * rate));
    const beatLength = mode === 'battle' ? 0.375 : 0.48;
    for (let beat = 0; beat * beatLength < duration; beat++) {
      scoreEvents(beat, mode).forEach(function (note) {
        const source = instrumentSamples(note.type, rate), base = note.type === 'pipe' ? 440 : 220;
        const speed = note.type === 'drum' || note.type === 'tap' ? 1 : note.freq / base;
        const offset = Math.round((beat * beatLength + note.delay) * rate), length = Math.ceil(source.length / speed);
        const gain = note.gain * DEFAULTS.music * DEFAULTS.master;
        for (let i = 0; i < length && offset + i < data.length; i++) {
          const position = i * speed, index = Math.floor(position), fraction = position - index;
          data[offset + i] += ((source[index] || 0) * (1 - fraction) + (source[index + 1] || 0) * fraction) * gain;
        }
      });
    }
    for (let i = 0; i < data.length; i++) data[i] *= Math.min(1, i / (rate * 0.2)) * Math.min(1, (data.length - 1 - i) / (rate * 0.7));
    return data;
  }
  function ambienceBuffer(type) {
    const key = 'ambience:' + type;
    if (bufferCache.has(key)) return bufferCache.get(key);
    const rate = 22050, duration = type === 'wind' ? 9 : 12;
    const r = renderer(rate, duration, hash(key));
    if (type === 'wind') {
      let low = 0, high = 0;
      r.add(0, duration, function (t) {
        const white = r.random() * 2 - 1;
        low += 0.021 * (white - low); high += 0.0012 * (low - high);
        const gust = 0.57 + 0.17 * Math.sin(TAU * t / duration) + 0.11 * Math.sin(TAU * 3 * t / duration);
        return (low - high) * gust * 0.28;
      });
      // A long loop crossfade is baked into the wave itself, no seam transient.
      const fade = Math.floor(rate * 0.45);
      for (let i = 0; i < fade; i++) {
        const a = i / fade;
        r.data[i] *= a; r.data[r.data.length - 1 - i] *= a;
      }
    } else {
      [0.7, 4.6, 8.4].forEach(function (at, n) {
        for (let chirp = 0; chirp < 2; chirp++) {
          const start = at + chirp * 0.19;
          const freq = 2250 + n * 170;
          r.tone(start, 0.10, freq, 0.035, 9, 0.018, 5600);
          r.tone(start + 0.11, 0.075, freq + 480, 0.020, 12, 0.014, -3600);
        }
      });
    }
    // Ambience deliberately stays quiet and is not loudness-normalized like cues.
    return audioBuffer(key, r.data, rate);
  }
  function startAmbience() {
    if (ambienceStarted || !context || settings.ambience <= 0) return;
    ambienceStarted = true;
    startBuffer(ambienceBuffer('wind'), { channel: 'ambience', loop: true, gain: 0.58, attack: 0.5, priority: 0, pan: 0 });
    if (scene === 'lobby') startBuffer(ambienceBuffer('birds'), { channel: 'ambience', loop: true, gain: 0.28, attack: 0.3, priority: 0, pan: -0.38 });
  }
  function canRunBackground() {
    return context && unlocked && !needsGesture && !settings.muted && settings.master > 0 && (settings.music > 0 || settings.ambience > 0) &&
      !hidden() && context.state === 'running' && (scene === 'lobby' || scene === 'battle');
  }
  function stopTransport() {
    if (timer !== null) { root.clearTimeout(timer); timer = null; }
    stopAll('music'); stopAll('ambience'); ambienceStarted = false;
    nextBeatTime = 0;
  }
  function tick() {
    timer = null;
    if (!canRunBackground()) return;
    const now = context.currentTime;
    if (!nextBeatTime || nextBeatTime < now - 0.35) nextBeatTime = now + 0.045;
    const beatLength = scene === 'battle' ? 0.375 : 0.48;
    let queued = 0;
    while (nextBeatTime < now + 0.18 && queued++ < 3) {
      scheduleBeat(musicBeat++, nextBeatTime); nextBeatTime += beatLength;
    }
    startAmbience();
    timer = root.setTimeout(tick, 70);
  }
  function startTransport() { if (canRunBackground() && timer === null) tick(); }

  async function unlock() {
    if (hidden() || !ensureContext()) return false;
    try {
      if (context.state === 'suspended' && context.resume) await context.resume();
      if (hidden()) { visibilityChange(); return false; }
      if (context.state !== 'running') return false;
      unlocked = true; needsGesture = false; visibilitySuspended = false;
      applyVolumes(); startTransport(); return true;
    } catch (_) { return false; }
  }
  function toggle() {
    settings.muted = !settings.muted;
    if (settings.muted) {
      applyVolumes(); stopTransport(); stopAll(); resetReverb(); lastCue.clear(); lastGroup.clear();
    } else { applyVolumes(); unlock(); }
    settingsChanged(); return settings.muted;
  }
  function setVolume(channel, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, channel) || channel === 'muted' || !Number.isFinite(Number(value))) return getSettings();
    settings[channel] = clamp(Number(value), 0, 1); applyVolumes();
    if (channel === 'ambience') {
      if (settings.ambience === 0) { stopAll('ambience'); ambienceStarted = false; }
      else if (canRunBackground()) startAmbience();
    }
    if (channel === 'music' && settings.music === 0) stopAll('music');
    if (channel === 'sfx' && settings.sfx === 0) { stopAll('sfx'); resetReverb(); }
    if (channel === 'master' && settings.master === 0) { stopTransport(); stopAll(); resetReverb(); }
    else if (settings.master > 0) startTransport();
    settingsChanged(); return getSettings();
  }
  function setScene(nextScene) {
    if (['lobby', 'battle', 'paused', 'result'].indexOf(nextScene) < 0) return scene;
    if (nextScene === scene) {
      if (scene === 'paused') { stopTransport(); stopAll('sfx'); resetReverb(); }
      else startTransport();
      return scene;
    }
    stopTransport(); scene = nextScene; musicBeat = 0;
    if (nextScene === 'paused') { stopAll('sfx'); resetReverb(); }
    if (nextScene === 'lobby' || nextScene === 'battle') startTransport();
    return scene;
  }
  function getDiagnostics() {
    pruneVoices();
    return { supported: supported, unlocked: unlocked && !needsGesture, contextState: context ? context.state : 'uninitialized', scene: scene,
      voices: voices.size, voiceLimit: LIMIT, cacheEntries: bufferCache.size + sampleCache.size, played: played, dropped: dropped, muted: settings.muted,
      suspendedForVisibility: visibilitySuspended, scheduledMusic: Array.from(voices).filter(function (voice) { return voice.channel === 'music'; }).length };
  }
  function visibilityChange() {
    if (!hidden()) return; // Resumption belongs to the next genuine user gesture.
    visibilitySuspended = true; needsGesture = true; stopTransport(); stopAll(); resetReverb();
    lastCue.clear(); lastGroup.clear();
    try { if (context && context.suspend) { const p = context.suspend(); if (p && p.catch) p.catch(function () {}); } } catch (_) {}
  }
  if (root.document && root.document.addEventListener) {
    root.document.addEventListener('pointerdown', function () { if (needsGesture || !unlocked) unlock(); }, { passive: true, capture: true });
    root.document.addEventListener('keydown', function (event) { if (!event.repeat && (needsGesture || !unlocked)) unlock(); }, { capture: true });
    root.document.addEventListener('visibilitychange', visibilityChange);
  }
  // Prepare first-use PCM while the browser is idle, without opening an audio device.
  // Remaining variants are rendered lazily and then retained as AudioBuffers.
  if (supported && typeof root.requestIdleCallback === 'function') {
    const warmQueue = ['click', 'select', 'place', 'coin', 'spawn', 'footman', 'archer', 'attackOrder', 'moveOrder', 'recall',
      'cavalry', 'ram', 'mage', 'guardShot', 'arcaneShot', 'unitDown', 'levelup', 'tierup', 'tutorial', 'matchStart', 'win', 'lose'];
    const warm = function (deadline) {
      if (hidden()) { root.requestIdleCallback(warm, { timeout: 5000 }); return; }
      while (warmQueue.length && (deadline.timeRemaining() > 8 || deadline.didTimeout)) {
        const name = warmQueue.shift(), key = name + ':0';
        if (!bufferCache.has(key)) sampleCache.set(key, synthesize(name, 22050, 0));
        if (deadline.didTimeout) break;
      }
      if (warmQueue.length) root.requestIdleCallback(warm, { timeout: 5000 });
    };
    root.requestIdleCallback(warm, { timeout: 5000 });
  }
  root.RoyalAudio = Object.freeze({ play: play, toggle: toggle, muted: function () { return settings.muted; }, setScene: setScene,
    setVolume: setVolume, getSettings: getSettings, unlock: unlock, getDiagnostics: getDiagnostics,
    synthesize: synthesize, synthesizeMusic: synthesizeMusic, cueNames: cueNames, definitions: definitions, aliases: aliases, version: VERSION });
})(typeof window !== 'undefined' ? window : globalThis);
