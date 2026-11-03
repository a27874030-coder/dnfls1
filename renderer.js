/* =====================================================================
 *  renderer.js  -  화면 그리기 담당 (게임 규칙은 건드리지 않고 "보여 주기만" 해요)
 *  - 바뀌지 않는 부분(기계 몸체, 유리 프레임)은 미리 그려 두고 재사용해서 빠르게 그려요.
 *  - 그리는 순서: 뒷배경 → 인형 → 집게 → 앞 프레임/유리 → 조명 → 배출구 인형 → 효과
 * ===================================================================== */
class Renderer {
  constructor(canvas, game, cfg) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.cfg = cfg;
    this.M = cfg.MACHINE;
    this.t = 0;
    this.rebuild();
  }

  /* 화면 선명도(dpr)가 바뀌거나 처음일 때 미리 그린 그림을 다시 만들어요 */
  rebuild() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = Math.round(this.M.W * this.dpr);
    this.cv.height = Math.round(this.M.H * this.dpr);
    this.back = this._layer((c) => this._drawBack(c));
    this.front = this._layer((c) => this._drawFront(c));
    this._makeBulbs();
  }

  _layer(fn) {
    const cv = document.createElement('canvas');
    cv.width = this.cv.width; cv.height = this.cv.height;
    const c = cv.getContext('2d');
    c.scale(this.dpr, this.dpr);
    fn(c);
    return cv;
  }

  _rr(c, x, y, w, h, r) {   // 둥근 사각형 경로
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ===================== 미리 그려 두는 "뒤쪽" 그림 ===================== */
  _drawBack(c) {
    const M = this.M, G = M.GLASS, C = this.cfg.COLORS;
    // 전체 배경
    let g = c.createLinearGradient(0, 0, 0, M.H);
    g.addColorStop(0, '#150a3c'); g.addColorStop(1, '#07041a');
    c.fillStyle = g; c.fillRect(0, 0, M.W, M.H);

    // 기계 몸체
    this._rr(c, 18, 12, M.W - 36, M.H - 24, 30);
    g = c.createLinearGradient(0, 0, 0, M.H);
    g.addColorStop(0, '#2c1366'); g.addColorStop(1, '#170a3d');
    c.fillStyle = g; c.fill();
    c.lineWidth = 4; c.strokeStyle = C.cyan; c.shadowColor = C.cyan; c.shadowBlur = 18; c.stroke();
    c.shadowBlur = 0;

    // 유리 안쪽 뒷벽
    g = c.createLinearGradient(0, G.y, 0, M.FLOOR_BACK_Y);
    g.addColorStop(0, '#3c1b8e'); g.addColorStop(1, '#1d0d55');
    c.fillStyle = g; c.fillRect(G.x, G.y, G.w, M.FLOOR_BACK_Y - G.y);
    // 반짝이는 별 (항상 같은 위치가 되도록 간단한 난수식 사용)
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const cols = [C.cyan, C.pink, C.yellow, '#ffffff'];
    for (let i = 0; i < 55; i++) {
      c.globalAlpha = 0.25 + rnd() * 0.45;
      c.fillStyle = cols[Math.floor(rnd() * cols.length)];
      c.beginPath();
      c.arc(G.x + 8 + rnd() * (G.w - 16), G.y + 8 + rnd() * (M.FLOOR_BACK_Y - G.y - 16), 0.8 + rnd() * 1.8, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    // 은은한 가로 네온 줄
    c.strokeStyle = 'rgba(25,240,255,0.12)'; c.lineWidth = 2;
    [220, 300, 380].forEach((y) => { c.beginPath(); c.moveTo(G.x, y); c.lineTo(G.x + G.w, y); c.stroke(); });

    // 바닥
    const floorBottom = G.y + G.h;
    g = c.createLinearGradient(0, M.FLOOR_BACK_Y, 0, floorBottom);
    g.addColorStop(0, '#4a2399'); g.addColorStop(1, '#7b2fb8');
    c.fillStyle = g; c.fillRect(G.x, M.FLOOR_BACK_Y, G.w, floorBottom - M.FLOOR_BACK_Y);
    c.strokeStyle = 'rgba(25,240,255,0.18)'; c.lineWidth = 1.5;
    for (let i = -7; i <= 7; i++) {
      c.beginPath();
      c.moveTo(G.x + G.w / 2 + i * 70, M.FLOOR_BACK_Y);
      c.lineTo(G.x + G.w / 2 + i * 120, floorBottom);
      c.stroke();
    }
    c.lineWidth = 3; c.strokeStyle = C.cyan; c.shadowColor = C.cyan; c.shadowBlur = 10;
    c.beginPath(); c.moveTo(G.x, M.FLOOR_BACK_Y); c.lineTo(G.x + G.w, M.FLOOR_BACK_Y); c.stroke();
    c.shadowBlur = 0;

    // 레일
    g = c.createLinearGradient(0, M.RAIL_Y - 6, 0, M.RAIL_Y + 6);
    g.addColorStop(0, '#e6eefc'); g.addColorStop(1, '#7f8db0');
    c.fillStyle = g; c.fillRect(G.x, M.RAIL_Y - 6, G.w, 12);

    // 상품 배출구 구멍
    const cx = M.CHUTE.x + 8, cw = M.CHUTE.w - 16;
    this._rr(c, cx, M.WELL_TOP_Y, cw, floorBottom - M.WELL_TOP_Y + 6, 10);
    g = c.createLinearGradient(0, M.WELL_TOP_Y, 0, floorBottom);
    g.addColorStop(0, '#0a0420'); g.addColorStop(1, '#02010a');
    c.fillStyle = g; c.fill();
    c.lineWidth = 3; c.strokeStyle = C.pink; c.shadowColor = C.pink; c.shadowBlur = 14; c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = C.yellow; c.font = '800 15px system-ui, sans-serif'; c.textAlign = 'center';
    c.fillText('▼ PRIZE ▼', M.CHUTE.x + M.CHUTE.w / 2, M.WELL_TOP_Y + 24);
  }

  /* ===================== 미리 그려 두는 "앞쪽" 그림 ===================== */
  _drawFront(c) {
    const M = this.M, G = M.GLASS, C = this.cfg.COLORS;

    // 마퀴(윗간판)
    this._rr(c, 60, 26, 680, 76, 18);
    let g = c.createLinearGradient(0, 26, 0, 102);
    g.addColorStop(0, '#26104f'); g.addColorStop(1, '#0c0526');
    c.fillStyle = g; c.fill();
    c.lineWidth = 3; c.strokeStyle = C.cyan; c.shadowColor = C.cyan; c.shadowBlur = 14; c.stroke();
    c.shadowBlur = 0;
    // 제목 글자 (길면 자동으로 작게)
    let size = 44;
    c.font = '900 ' + size + 'px "Arial Black", system-ui, sans-serif';
    const w = c.measureText(this.cfg.TITLE).width;
    if (w > 560) { size = Math.floor(size * 560 / w); c.font = '900 ' + size + 'px "Arial Black", system-ui, sans-serif'; }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = C.pink; c.shadowBlur = 20; c.fillStyle = '#ff8de0';
    c.fillText(this.cfg.TITLE, M.W / 2, 64);
    c.shadowBlur = 0; c.textBaseline = 'alphabetic';

    // 유리창 금속 프레임 (바깥 사각형 - 유리 사각형)
    c.beginPath();
    c.rect(36, 104, 728, 600);
    c.rect(G.x, G.y, G.w, G.h);
    g = c.createLinearGradient(0, 104, 0, 704);
    g.addColorStop(0, '#9aa7c8'); g.addColorStop(0.5, '#59658a'); g.addColorStop(1, '#2d3554');
    c.fillStyle = g; c.fill('evenodd');
    [[48, 114], [752, 114], [48, 694], [752, 694]].forEach((p) => {
      c.beginPath(); c.arc(p[0], p[1], 4.5, 0, Math.PI * 2); c.fillStyle = '#dfe7fb'; c.fill();
    });
    // 유리 안쪽 테두리 빛
    c.lineWidth = 2; c.strokeStyle = C.cyan; c.shadowColor = C.cyan; c.shadowBlur = 10;
    c.strokeRect(G.x, G.y, G.w, G.h);
    c.shadowBlur = 0;

    // 유리 반사광 (아주 연하게 - 인형이 가려지지 않도록)
    c.save();
    c.beginPath(); c.rect(G.x, G.y, G.w, G.h); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.beginPath(); c.moveTo(G.x + 80, G.y); c.lineTo(G.x + 190, G.y); c.lineTo(G.x + 20, G.y + G.h); c.lineTo(G.x - 90, G.y + G.h); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.04)';
    c.beginPath(); c.moveTo(G.x + 230, G.y); c.lineTo(G.x + 270, G.y); c.lineTo(G.x + 110, G.y + G.h); c.lineTo(G.x + 70, G.y + G.h); c.fill();
    c.restore();

    // 하단 패널
    this._rr(c, 36, 716, 728, 196, 22);
    g = c.createLinearGradient(0, 716, 0, 912);
    g.addColorStop(0, '#2b1a63'); g.addColorStop(1, '#170b3d');
    c.fillStyle = g; c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(155,92,255,0.8)'; c.stroke();

    // 배출구 통로(프레임을 뚫고 내려가는 어두운 관)
    const sx = M.CHUTE.x + 8, sw = M.CHUTE.w - 16;
    c.fillStyle = '#05020f'; c.fillRect(sx, G.y + G.h, sw, 60);
    c.fillRect(sx, 716, sw, 8);
    // 상품 받는 창
    this._rr(c, sx, 706, sw, 120, 14);
    c.fillStyle = '#040112'; c.fill();
    c.lineWidth = 3; c.strokeStyle = C.pink; c.shadowColor = C.pink; c.shadowBlur = 14; c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = C.pink; c.font = '900 20px "Arial Black", system-ui, sans-serif'; c.textAlign = 'center';
    c.fillText('PRIZE', M.CHUTE.x + M.CHUTE.w / 2, 854);

    // 컨트롤 패널 (장식)
    this._rr(c, 250, 732, 486, 164, 18);
    c.fillStyle = '#1e0f4e'; c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(25,240,255,0.6)'; c.stroke();
    // 조이스틱
    c.beginPath(); c.arc(318, 828, 34, 0, Math.PI * 2);
    g = c.createRadialGradient(310, 818, 4, 318, 828, 36); g.addColorStop(0, '#cfd8f2'); g.addColorStop(1, '#4b5679');
    c.fillStyle = g; c.fill();
    c.strokeStyle = '#8a97bd'; c.lineWidth = 8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(318, 828); c.lineTo(318, 792); c.stroke();
    c.beginPath(); c.arc(318, 786, 16, 0, Math.PI * 2);
    g = c.createRadialGradient(312, 780, 2, 318, 786, 18); g.addColorStop(0, '#ff9bdc'); g.addColorStop(1, '#d1157f');
    c.fillStyle = g; c.fill();
    // 버튼
    [[470, 828, 28, C.pink], [556, 834, 22, C.yellow]].forEach((b) => {
      c.beginPath(); c.arc(b[0], b[1], b[2], 0, Math.PI * 2);
      c.fillStyle = b[3]; c.shadowColor = b[3]; c.shadowBlur = 14; c.fill(); c.shadowBlur = 0;
      c.beginPath(); c.arc(b[0] - b[2] * 0.3, b[1] - b[2] * 0.35, b[2] * 0.3, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.fill();
    });
    // 안내 전광판
    this._rr(c, 372, 752, 340, 36, 10);
    c.fillStyle = '#080320'; c.fill();
    c.lineWidth = 2; c.strokeStyle = C.purple; c.stroke();
    c.fillStyle = C.cyan; c.font = '800 17px system-ui, sans-serif'; c.textAlign = 'center';
    c.fillText('✋ MOVE      ✊ GRAB', 542, 776);
    // 동전 투입구
    this._rr(c, 624, 804, 84, 56, 8);
    c.fillStyle = '#12082f'; c.fill(); c.strokeStyle = '#8a97bd'; c.lineWidth = 2; c.stroke();
    c.fillStyle = C.yellow; c.font = '800 13px system-ui, sans-serif';
    c.fillText('1 PLAY', 666, 827);
    c.fillStyle = '#05020f'; c.fillRect(656, 836, 20, 5);
  }

  /* ===================== 마퀴 전구 위치 ===================== */
  _makeBulbs() {
    this.bulbs = [];
    for (let x = 80; x <= 720; x += 28) { this.bulbs.push([x, 38]); this.bulbs.push([x, 90]); }
    for (let y = 56; y <= 76; y += 20) { this.bulbs.push([72, y]); this.bulbs.push([728, y]); }
  }

  /* ===================== 매 프레임 그리기 ===================== */
  draw(nowMs) {
    const c = this.ctx, g = this.game, M = this.M;
    this.t = nowMs / 1000;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.drawImage(this.back, 0, 0);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // 인형 (뒤쪽(y가 작음)부터 그려서 앞 인형이 위로 오게)
    const list = g.plushes.filter((p) => p.state === 'rest' || p.state === 'fall')
      .sort((a, b) => a.y - b.y);
    for (const p of list) this._plush(c, p);

    this._claw(c);

    // 앞 프레임 + 유리
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.front, 0, 0);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this._lights(c);
    this._binPlush(c);
    this._effects(c);
  }

  /* ----- 인형 한 개 ----- */
  _easeOutBack(t) { const s = 1.70158; t -= 1; return t * t * ((s + 1) * t + s) + 1; }

  _plush(c, p) {
    const R = this.cfg.PLUSH_RADIUS;
    const size = PlushArt.UNITS * (R / PlushArt.BODY_R);
    const s = p.spawnT < 1 ? this._easeOutBack(p.spawnT) : 1;
    const rar = this.cfg.RARITIES[p.rarity];

    // 그림자 (바닥에 놓인 인형만)
    if (p.state === 'rest' || p.state === 'fall') {
      c.fillStyle = 'rgba(0,0,0,0.28)';
      c.beginPath(); c.ellipse(p.x, p.y + R * 0.95, R * 0.85 * s, R * 0.26 * s, 0, 0, Math.PI * 2); c.fill();
    }
    // 희귀/중급 인형의 은은한 후광
    if (p.rarity !== 'common') {
      const a = (p.rarity === 'rare' ? 0.32 : 0.2) + 0.08 * Math.sin(this.t * 3 + p.phase);
      const gr = c.createRadialGradient(p.x, p.y, R * 0.3, p.x, p.y, R * 1.7);
      gr.addColorStop(0, this._rgba(rar.color, a)); gr.addColorStop(1, this._rgba(rar.color, 0));
      c.fillStyle = gr;
      c.beginPath(); c.arc(p.x, p.y, R * 1.7 * s, 0, Math.PI * 2); c.fill();
    }

    let rot;
    if (p.state === 'held') rot = p.rot;
    else rot = Math.sin(this.t * 1.3 + p.phase) * 0.04 + Math.sin(this.t * 34) * 0.22 * p.wobble;
    const sq = p.squash;

    c.save();
    c.translate(p.x, p.y);
    c.rotate(rot);
    c.scale(s * (1 + sq * 0.16), s * (1 - sq * 0.16));
    c.drawImage(PlushArt.sprite(p.typeId), -size / 2, -size / 2, size, size);
    c.restore();
  }

  _rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ----- 집게 ----- */
  _claw(c) {
    const cl = this.game.claw, M = this.M, C = this.cfg.COLORS;

    // 케이블
    c.strokeStyle = '#a9bbdc'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cl.x, M.RAIL_Y); c.lineTo(cl.x, cl.y - 14); c.stroke();
    // 레일 위 이동 장치
    this._rr(c, cl.x - 22, M.RAIL_Y - 12, 44, 24, 6);
    let g = c.createLinearGradient(0, M.RAIL_Y - 12, 0, M.RAIL_Y + 12);
    g.addColorStop(0, '#e9f0ff'); g.addColorStop(1, '#6d7ba3');
    c.fillStyle = g; c.fill();
    c.lineWidth = 2; c.strokeStyle = C.cyan; c.stroke();

    // 집은 인형 (집게 발보다 뒤에)
    if (cl.held) this._plush(c, cl.held);

    // 집게 발 (열림 정도에 따라 각도 변화)
    const open = 1 - cl.closeAmt;
    const a1 = 0.35 + 0.55 * open;
    const a2 = a1 - 1.1;
    [-1, 1].forEach((s) => {
      const p0 = { x: cl.x + s * 14, y: cl.y + 10 };
      const p1 = { x: p0.x + s * Math.sin(a1) * 30, y: p0.y + Math.cos(a1) * 30 };
      const p2 = { x: p1.x + s * Math.sin(a2) * 26, y: p1.y + Math.cos(a2) * 26 };
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = '#46527a'; c.lineWidth = 9;
      c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();
      c.strokeStyle = '#d4def6'; c.lineWidth = 6;
      c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();
      c.beginPath(); c.arc(p2.x, p2.y, 4.5, 0, Math.PI * 2); c.fillStyle = C.pink; c.fill();
    });

    // 집게 머리
    this._rr(c, cl.x - 24, cl.y - 14, 48, 28, 10);
    g = c.createLinearGradient(0, cl.y - 14, 0, cl.y + 14);
    g.addColorStop(0, '#f1f5ff'); g.addColorStop(1, '#6272a0');
    c.fillStyle = g; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = C.cyan; c.stroke();
    c.beginPath(); c.arc(cl.x, cl.y, 5, 0, Math.PI * 2);
    c.fillStyle = (Math.floor(this.t * 4) % 2) ? C.pink : C.yellow; c.fill();
  }

  /* ----- 마퀴 전구 + 성공 시 기계 조명 번쩍 ----- */
  _lights(c) {
    const C = this.cfg.COLORS, g = this.game, G = this.M.GLASS;
    const cols = [C.cyan, C.pink, C.yellow];
    this.bulbs.forEach((b, i) => {
      const on = Math.sin(this.t * 5 + i * 0.9) > 0;
      c.fillStyle = on ? cols[i % 3] : 'rgba(255,255,255,0.14)';
      c.beginPath(); c.arc(b[0], b[1], 3.4, 0, Math.PI * 2); c.fill();
    });
    if (g.flash > 0.01) {
      const col = g.flashColor, f = g.flash;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (f * 0.12) + ')';   // 유리 안쪽은 아주 약하게
      c.fillRect(G.x, G.y, G.w, G.h);
      c.lineWidth = 8;
      c.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (f * 0.85) + ')';
      c.shadowColor = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
      c.shadowBlur = 28 * f;
      c.strokeRect(G.x - 3, G.y - 3, G.w + 6, G.h + 6);
      c.strokeRect(62, 28, 676, 72);
      c.restore();
    }
  }

  /* ----- 배출구로 떨어지는 인형 (유리 아래 통로까지 보이도록 마지막에 그림) ----- */
  _binPlush(c) {
    const M = this.M, G = M.GLASS;
    const list = this.game.plushes.filter((p) => p.state === 'toBin' || p.state === 'binned');
    if (!list.length) return;
    c.save();
    c.beginPath();
    c.rect(M.CHUTE.x - 10, G.y, M.CHUTE.w + 20, 830 - G.y);
    c.clip();
    for (const p of list) {
      c.globalAlpha = p.state === 'binned' ? Math.max(0, 1 - p.binT / 0.8) : 1;
      this._plush(c, p);
    }
    c.restore();
  }

  /* ----- 반짝이 / 떠오르는 글자 ----- */
  _starPath(c, cx, cy, ro, ri, rot) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? ro : ri, a = rot + i * Math.PI / 5;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  }

  _effects(c) {
    const g = this.game;
    for (const p of g.particles) {
      const a = 1 - p.life / p.max;
      c.globalAlpha = Math.max(0, a);
      c.fillStyle = p.color;
      if (p.star) { this._starPath(c, p.x, p.y, p.size, p.size * 0.42, p.rot); c.fill(); }
      else { c.beginPath(); c.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1;

    for (const f of g.floaters) {
      const k = f.life / f.max;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : (k < 0.3 ? 1.2 - ((k - 0.15) / 0.15) * 0.2 : 1);
      c.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      c.font = '900 ' + Math.round(f.size * pop) + 'px "Arial Black", system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 6; c.strokeStyle = 'rgba(20,6,50,0.85)'; c.lineJoin = 'round';
      c.strokeText(f.text, f.x, f.y);
      c.shadowColor = f.color; c.shadowBlur = 14;
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
      c.shadowBlur = 0;
    }
    c.globalAlpha = 1;
    c.textBaseline = 'alphabetic';
  }
}
