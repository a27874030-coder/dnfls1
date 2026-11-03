/* =====================================================================
 *  plush-art.js  -  인형 그림(디자인) 담당
 *  - 외부 이미지 파일 없이 Canvas로 직접 그린 오리지널 인형이에요.
 *  - 게임 규칙(game.js)과 완전히 분리되어 있어요.
 *  - 나중에 정식 캐릭터 이미지를 쓰려면 아래 sprite(id) 함수가
 *    Image(이미지)를 돌려주도록만 바꾸면 돼요. (아래 "교체 방법" 주석 참고)
 * ===================================================================== */
const PlushArt = (function () {
  const TAU = Math.PI * 2;
  const UNITS = 96;        // 인형 한 장의 그림 영역 크기 (-48 ~ +48)
  const BODY_R = 29;       // 몸통 반지름 (게임의 PLUSH_RADIUS와 비율을 맞추는 기준)
  const OUT = 'rgba(48,16,84,0.7)';   // 외곽선 색
  const INK = '#2a1240';              // 눈/입 색
  const cache = {};

  /* ---------- 작은 그리기 도우미 ---------- */
  function circ(c, x, y, r, fill, stroke, lw) {
    c.beginPath(); c.arc(x, y, r, 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw || 2; c.strokeStyle = stroke; c.stroke(); }
  }
  function ell(c, x, y, rx, ry, fill, stroke, lw, rot) {
    c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw || 2; c.strokeStyle = stroke; c.stroke(); }
  }
  // 둥근 입체감을 주는 그라데이션
  function rg(c, x, y, r, c1, c2) {
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.05);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    return g;
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function eyes(c, y, gap, r) {
    [-1, 1].forEach(function (s) {
      circ(c, s * gap, y, r, INK);
      circ(c, s * gap - r * 0.3, y - r * 0.35, r * 0.38, '#fff');
    });
  }
  function cheeks(c, y, gap, color) {
    [-1, 1].forEach(function (s) { ell(c, s * gap, y, 5, 3, color); });
  }
  function mouthW(c, x, y) {   // 'ω' 모양 입
    c.beginPath();
    c.moveTo(x, y); c.quadraticCurveTo(x - 1, y + 4.5, x - 5, y + 3.5);
    c.moveTo(x, y); c.quadraticCurveTo(x + 1, y + 4.5, x + 5, y + 3.5);
    c.lineWidth = 2; c.lineCap = 'round'; c.strokeStyle = INK; c.stroke();
  }
  function star5(c, cx, cy, ro, ri, rot) {   // 별 모양 경로
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = (i % 2 === 0) ? ro : ri;
      const a = rot + (i * Math.PI) / 5;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  }
  function ribbon(c, x, y, color) {   // 리본
    c.save(); c.translate(x, y);
    c.fillStyle = color; c.strokeStyle = OUT; c.lineWidth = 2; c.lineJoin = 'round';
    [-1, 1].forEach(function (s) {
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(s * 9, -10, s * 15, -3);
      c.quadraticCurveTo(s * 15, 7, 0, 0);
      c.fill(); c.stroke();
    });
    circ(c, 0, 0, 3.4, '#ffe55c', OUT, 1.5);
    c.restore();
  }

  /* ---------- 인형 디자인들 (그림 좌표: 중심 0,0) ---------- */

  // 곰돌이 (색을 바꿔 여러 곰돌이를 만들 수 있게 팔레트를 받아요)
  function bear(c, p) {
    circ(c, -21, -18, 11, p.body2, OUT, 2.5);
    circ(c, 21, -18, 11, p.body2, OUT, 2.5);
    circ(c, -21, -18, 5.5, p.inner);
    circ(c, 21, -18, 5.5, p.inner);
    circ(c, 0, 4, BODY_R, rg(c, 0, 4, BODY_R, p.body1, p.body2), OUT, 2.5);
    ell(c, 0, 12, 12, 9, p.muzzle);
    ell(c, 0, 7.5, 4.2, 3, INK);
    eyes(c, -3, 11, 3.8);
    c.beginPath();
    c.moveTo(0, 10); c.quadraticCurveTo(0, 15, -4, 15.5);
    c.moveTo(0, 10); c.quadraticCurveTo(0, 15, 4, 15.5);
    c.lineWidth = 2; c.lineCap = 'round'; c.strokeStyle = INK; c.stroke();
    cheeks(c, 7, 19, 'rgba(255,110,150,0.55)');
  }

  // 토끼
  function bunny(c, p) {
    ell(c, -12, -30, 7.5, 19, rg(c, -12, -30, 19, p.body1, p.body2), OUT, 2.5, -0.15);
    ell(c, 12, -30, 7.5, 19, rg(c, 12, -30, 19, p.body1, p.body2), OUT, 2.5, 0.15);
    ell(c, -12, -29, 3.6, 13, p.inner, null, 0, -0.15);
    ell(c, 12, -29, 3.6, 13, p.inner, null, 0, 0.15);
    circ(c, 0, 6, 27.5, rg(c, 0, 6, 27.5, p.body1, p.body2), OUT, 2.5);
    eyes(c, 2, 10, 3.6);
    ell(c, 0, 9, 3, 2.2, p.nose);
    mouthW(c, 0, 11);
    cheeks(c, 9, 18, 'rgba(255,110,150,0.5)');
  }

  // 고양이
  function cat(c) {
    const orange1 = '#ffc984', orange2 = '#ff9140';
    [-1, 1].forEach(function (s) {
      c.beginPath();
      c.moveTo(s * 27, -6); c.lineTo(s * 23, -34); c.lineTo(s * 6, -20); c.closePath();
      c.fillStyle = orange2; c.fill(); c.lineWidth = 2.5; c.lineJoin = 'round'; c.strokeStyle = OUT; c.stroke();
      c.beginPath();
      c.moveTo(s * 23, -12); c.lineTo(s * 21, -27); c.lineTo(s * 11, -19); c.closePath();
      c.fillStyle = '#ffb3c7'; c.fill();
    });
    ell(c, 0, 6, 30, 26, rg(c, 0, 6, 30, orange1, orange2), OUT, 2.5);
    c.strokeStyle = '#d96a1a'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(0, -17); c.lineTo(0, -9);
    c.moveTo(-8, -15); c.lineTo(-6.5, -9);
    c.moveTo(8, -15); c.lineTo(6.5, -9);
    c.stroke();
    [-1, 1].forEach(function (s) {
      circ(c, s * 11, 1, 4.8, '#c8ff7a', INK, 1.5);
      ell(c, s * 11, 1, 1.5, 3.6, INK);
      circ(c, s * 11 - 1.4, -1.2, 1.3, '#fff');
    });
    c.beginPath(); c.moveTo(-3, 7); c.lineTo(3, 7); c.lineTo(0, 10.5); c.closePath();
    c.fillStyle = '#ff7aa2'; c.fill();
    mouthW(c, 0, 10.5);
    c.strokeStyle = 'rgba(42,18,64,0.6)'; c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(-27, 7); c.lineTo(-17, 8.5); c.moveTo(-27, 12); c.lineTo(-17, 11);
    c.moveTo(27, 7); c.lineTo(17, 8.5); c.moveTo(27, 12); c.lineTo(17, 11);
    c.stroke();
    cheeks(c, 11, 20, 'rgba(255,110,150,0.45)');
  }

  // 무지개 유니콘 (희귀)
  function unicorn(c) {
    const mane = ['#ff4f8b', '#ff9f43', '#ffe55c', '#4cf0a0', '#19c8ff', '#a064ff'];
    for (let i = 0; i < 6; i++) {            // 무지개 갈기(몸통 뒤에 그려요)
      const a = Math.PI * (1.05 + i * 0.17);
      circ(c, Math.cos(a) * 29, 5 + Math.sin(a) * 29, 9.5, mane[i], OUT, 2);
    }
    [-1, 1].forEach(function (s) {           // 귀
      ell(c, s * 19, -21, 5, 8.5, '#ffd0e6', OUT, 2, s * 0.45);
    });
    circ(c, 0, 5, 28, rg(c, 0, 5, 28, '#ffffff', '#e6d6ff'), OUT, 2.5);
    eyes(c, 3, 10.5, 3.8);
    [-1, 1].forEach(function (s) {           // 속눈썹
      c.strokeStyle = INK; c.lineWidth = 1.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(s * 14.5, 0.5); c.lineTo(s * 17.5, -1.5); c.stroke();
    });
    ell(c, -2.6, 12, 1.2, 1.6, '#ff8fb8'); ell(c, 2.6, 12, 1.2, 1.6, '#ff8fb8');
    c.beginPath(); c.arc(0, 13, 4.5, 0.2 * Math.PI, 0.8 * Math.PI);
    c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    cheeks(c, 10, 19, 'rgba(255,110,170,0.5)');
    // 황금 뿔
    const hg = c.createLinearGradient(0, -44, 0, -18);
    hg.addColorStop(0, '#fff6a8'); hg.addColorStop(1, '#ffb800');
    c.beginPath(); c.moveTo(-5.5, -20); c.lineTo(5.5, -20); c.lineTo(0, -44); c.closePath();
    c.fillStyle = hg; c.fill(); c.lineWidth = 2; c.lineJoin = 'round'; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = 'rgba(180,100,0,0.6)'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-3.6, -26); c.lineTo(3.4, -29); c.moveTo(-2.4, -33); c.lineTo(2.2, -35); c.stroke();
    star5(c, 30, -28, 6, 2.4, -Math.PI / 2); c.fillStyle = '#fff6a8'; c.fill();
  }

  // 별 장식 인형 (희귀)
  function starPlush(c) {
    c.save();
    c.shadowColor = 'rgba(255,229,92,0.95)'; c.shadowBlur = 12;
    star5(c, 0, 3, 33, 17, -Math.PI / 2);
    c.lineJoin = 'round';
    c.lineWidth = 11; c.strokeStyle = OUT; c.stroke();
    c.restore();
    star5(c, 0, 3, 33, 17, -Math.PI / 2);
    c.lineJoin = 'round';
    c.lineWidth = 7; c.strokeStyle = '#ffd84a'; c.stroke();
    const g = c.createLinearGradient(0, -30, 0, 34);
    g.addColorStop(0, '#fff29a'); g.addColorStop(1, '#ffb52e');
    c.fillStyle = g; c.fill();
    eyes(c, 1, 8.5, 3.5);
    c.beginPath(); c.arc(0, 6, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
    c.lineWidth = 2; c.lineCap = 'round'; c.strokeStyle = INK; c.stroke();
    cheeks(c, 7, 15, 'rgba(255,100,130,0.5)');
    star5(c, 30, -30, 5, 2, -Math.PI / 2); c.fillStyle = '#ffffff'; c.fill();
    star5(c, -31, 22, 4, 1.6, -Math.PI / 2); c.fillStyle = '#ffffff'; c.fill();
  }

  // 특별한 네온 인형 (희귀)
  function neonBot(c) {
    c.strokeStyle = OUT; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -24); c.lineTo(0, -37); c.stroke();
    c.save(); c.shadowColor = '#ff3dbd'; c.shadowBlur = 12;
    circ(c, 0, -39, 5.5, '#ff6ad5', OUT, 2);
    c.restore();
    c.save(); c.shadowColor = '#19f0ff'; c.shadowBlur = 14;
    const g = c.createLinearGradient(-28, -22, 28, 32);
    g.addColorStop(0, '#9afcff'); g.addColorStop(1, '#7a4dff');
    circ(c, 0, 5, 28, g, '#19f0ff', 3);
    c.restore();
    circ(c, -29, 6, 5, '#ffe55c', OUT, 2);
    circ(c, 29, 6, 5, '#ffe55c', OUT, 2);
    roundRect(c, -19, -8, 38, 20, 9);
    c.fillStyle = '#1a0a3a'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#ff3dbd'; c.stroke();
    c.save(); c.shadowColor = '#19f0ff'; c.shadowBlur = 8;
    circ(c, -8, 2, 3.8, '#19f0ff'); circ(c, 8, 2, 3.8, '#19f0ff');
    c.restore();
    c.beginPath(); c.arc(0, 15, 5, 0.2 * Math.PI, 0.8 * Math.PI);
    c.lineWidth = 2.4; c.lineCap = 'round'; c.strokeStyle = '#ff3dbd'; c.stroke();
    ell(c, -13, -17, 6, 2.6, 'rgba(255,255,255,0.55)', null, 0, -0.5);
  }

  /* ---------- 디자인 표 (CONFIG.PLUSH_TYPES의 id와 연결) ---------- */
  const DESIGNS = {
    bear: function (c) { bear(c, { body1: '#e0a870', body2: '#a76a3b', inner: '#ffb3c7', muzzle: '#f8deb9' }); },
    bunny: function (c) { bunny(c, { body1: '#ffffff', body2: '#f3d9e8', inner: '#ffb3c7', nose: '#ff7aa2' }); },
    cat: cat,
    bunnyLavender: function (c) {
      bunny(c, { body1: '#efe0ff', body2: '#9d6dff', inner: '#ffb3f0', nose: '#ff5ac8' });
      star5(c, 0, -9, 6, 2.6, -Math.PI / 2); c.fillStyle = '#ffe55c'; c.fill();
      c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
      star5(c, -27, -6, 4, 1.6, -Math.PI / 2); c.fillStyle = '#fff'; c.fill();
      star5(c, 28, 14, 4, 1.6, -Math.PI / 2); c.fillStyle = '#fff'; c.fill();
    },
    ribbonBear: function (c) {
      bear(c, { body1: '#ffb3d1', body2: '#e0629b', inner: '#fff0f6', muzzle: '#ffe3ef' });
      ribbon(c, 17, -27, '#19f0ff');
      ribbon(c, 0, 31, '#ffe55c');
    },
    unicorn: unicorn,
    star: starPlush,
    neonBot: neonBot
  };

  /* ---------- 스프라이트(미리 그려 둔 그림) 만들기 ---------- */
  function makeSprite(id) {
    const S = 192;   // 선명하게 보이도록 2배 크기로 그려요
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const c = cv.getContext('2d');
    c.translate(S / 2, S / 2);
    c.scale(S / UNITS, S / UNITS);
    (DESIGNS[id] || DESIGNS.bear)(c);
    return cv;
  }

  /*  교체 방법(나중에 정식 캐릭터 이미지를 쓸 때):
   *   1) 이미지를 new Image()로 불러오고
   *   2) 아래 sprite(id)가 id에 맞는 Image를 돌려주게 바꾸면 끝이에요.
   *   (game.js / renderer.js는 sprite(id)가 돌려준 그림을 그냥 그리기만 해요.) */
  function sprite(id) {
    if (!cache[id]) cache[id] = makeSprite(id);
    return cache[id];
  }

  // 결과 화면 등에서 쓸 작은 아이콘 그리기
  function drawTo(canvasEl, id) {
    const c = canvasEl.getContext('2d');
    c.clearRect(0, 0, canvasEl.width, canvasEl.height);
    c.drawImage(sprite(id), 0, 0, canvasEl.width, canvasEl.height);
  }

  return { UNITS: UNITS, BODY_R: BODY_R, sprite: sprite, drawTo: drawTo };
})();
