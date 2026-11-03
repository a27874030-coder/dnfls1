/* =====================================================================
 *  audio.js  -  사운드 담당 (Web Audio API로 소리를 직접 만들어요)
 *  - 외부 음원 파일이 필요 없어요.
 *  - 기본은 "무음"이고, 설정에서 배경음악 / 효과음을 각각 켤 수 있어요.
 *  - 브라우저 규칙상 "사용자가 클릭한 뒤"에만 소리가 나도록 만들었어요.
 * ===================================================================== */
class AudioSys {
  constructor() {
    this.musicOn = false;     // 배경음악 (기본 꺼짐)
    this.sfxOn = false;       // 효과음 (기본 꺼짐)
    this.ctx = null;          // 오디오 장치 (처음 켤 때 만들어요)
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this._timer = null;
    this._step = 0;
    this._nextTime = 0;
  }

  /* 오디오 장치 준비 (반드시 사용자 클릭 이후에 호출됨) */
  _ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { this.ctx = new AC(); } catch (e) { return false; }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.55;
    this.sfxGain.connect(this.master);
    return true;
  }

  setMusic(on) {
    if (on) {
      if (!this._ensure()) { this.musicOn = false; return false; }
      this.musicOn = true;
      this._startMusic();
    } else {
      this.musicOn = false;
      this._stopMusic();
    }
    return true;
  }

  setSfx(on) {
    if (on && !this._ensure()) { this.sfxOn = false; return false; }
    this.sfxOn = !!on;
    return true;
  }

  // 탭이 숨겨지면 소리도 잠시 멈춰요
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && (this.musicOn || this.sfxOn)) this.ctx.resume(); }

  /* 음 하나 만들기 */
  _tone(freq, t, dur, type, vol, dest, slideTo) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /* 효과음 */
  sfx(name) {
    if (!this.sfxOn || !this.ctx) return;
    const t = this.ctx.currentTime, d = this.sfxGain;
    switch (name) {
      case 'ui':      this._tone(660, t, 0.08, 'square', 0.25, d); break;
      case 'start':   [523, 659, 784].forEach((f, i) => this._tone(f, t + i * 0.08, 0.14, 'square', 0.25, d)); break;
      case 'drop':    this._tone(520, t, 0.28, 'sawtooth', 0.18, d, 220); break;
      case 'close':   this._tone(700, t, 0.07, 'square', 0.25, d, 320); break;
      case 'miss':    this._tone(300, t, 0.3, 'triangle', 0.3, d, 130); break;
      case 'slip':    this._tone(480, t, 0.4, 'triangle', 0.32, d, 110); break;
      case 'release': this._tone(400, t, 0.12, 'square', 0.2, d, 600); break;
      case 'success': [659, 784, 988, 1319].forEach((f, i) => this._tone(f, t + i * 0.07, 0.16, 'square', 0.25, d)); break;
      case 'rare':    [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => this._tone(f, t + i * 0.07, 0.2, 'triangle', 0.3, d)); break;
      case 'end':     [784, 659, 523, 392].forEach((f, i) => this._tone(f, t + i * 0.13, 0.22, 'triangle', 0.3, d)); break;
    }
  }

  /* 배경음악: 짧은 아케이드풍 아르페지오를 반복 재생 */
  _startMusic() {
    if (this._timer) return;
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.1;
    this._timer = setInterval(() => this._schedule(), 100);
    this._schedule();
  }
  _stopMusic() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }
  _schedule() {
    if (!this.ctx || !this.musicOn) return;
    const roots = [220.0, 174.6, 261.6, 196.0];                   // Am - F - C - G
    const arps = [[0, 3, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12]];
    const stepSec = 0.25;
    while (this._nextTime < this.ctx.currentTime + 0.35) {
      const s = this._step % 16;
      const chord = Math.floor(s / 4);
      const note = arps[chord][s % 4];
      const f = roots[chord] * 2 * Math.pow(2, note / 12);
      this._tone(f, this._nextTime, 0.2, 'square', 0.07, this.musicGain);
      if (s % 4 === 0) this._tone(roots[chord] / 2, this._nextTime, 0.45, 'triangle', 0.16, this.musicGain);
      this._nextTime += stepSec;
      this._step++;
    }
  }
}
