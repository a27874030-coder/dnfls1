/* =====================================================================
 *  game.js  -  게임 규칙 담당 (화면 그리기는 renderer.js, 입력은 main.js)
 *  - 게임 상태: menu(메뉴) → playing(진행) → ending(시간 종료 후 마무리) → result(결과)
 *  - 집게 동작:  idle → descend → close → ascend → carry → release → idle
 *  - 모든 움직임은 "시간(dt)"으로 계산해요. setTimeout을 쓰지 않아서
 *    재시작해도 예전 애니메이션이 남아 꼬이지 않아요.
 * ===================================================================== */
class Game {
  constructor(cfg) {
    this.cfg = cfg;
    this.M = cfg.MACHINE;
    this.chuteX = this.M.CHUTE.x + this.M.CHUTE.w / 2;   // 배출구 가운데 x
    this.GRAVITY = 1900;
    this.pauseReasons = new Set();                        // 일시정지 이유 목록
    // main.js가 연결해 주는 알림 함수들 (소리, 획득, 종료)
    this.cb = { sfx: function () {}, onCatch: function () {}, onFinish: function () {} };
    this.reset();
  }

  /* ---------- 초기화: 점수, 인형, 집게, 타이머를 전부 새로 ---------- */
  reset() {
    const cfg = this.cfg, M = this.M, K = cfg.CLAW;
    this.screen = 'menu';
    this.score = 0;
    this.caught = 0;
    this.collection = [];
    this.timeLeftMs = cfg.GAME_SECONDS * 1000;
    this.timeUp = false;
    this.plushes = [];
    this.nextId = 1;
    this.particles = [];
    this.floaters = [];
    this.flash = 0;
    this.flashColor = [255, 255, 255];
    this.pauseReasons.clear();
    const cx = (M.ZONE.minX + M.ZONE.maxX) / 2;
    this.claw = {
      x: cx, targetX: cx, y: K.restY, vx: 0, sway: 0,
      phase: 'idle', t: 0, closeAmt: 0, held: null,
      willSlip: false, slipAt: 0.5, slipChecked: false, released: false, cool: 0
    };
    for (let i = 0; i < cfg.PLUSH_COUNT; i++) this._spawnPlush(false);
  }

  start() {
    this.reset();
    this.screen = 'playing';
  }

  get timeLeftSec() { return Math.ceil(this.timeLeftMs / 1000); }

  setPause(reason, on) {
    if (on) this.pauseReasons.add(reason); else this.pauseReasons.delete(reason);
  }
  isPaused() { return this.pauseReasons.size > 0; }

  /* ---------- 입력 받는 곳 ---------- */
  // 집게를 좌우로 움직일 수 있는 상태인가?
  canMove() {
    return this.screen === 'playing' && !this.timeUp && !this.isPaused() && this.claw.phase === 'idle';
  }
  // 집게 작동(주먹/스페이스)을 받을 수 있는 상태인가? (작동 중에는 입력 무시)
  canAcceptInput() { return this.canMove() && this.claw.cool <= 0; }

  setTargetFromNorm(n) {             // 손 위치(0~1) → 집게 목표 위치
    if (!this.canMove()) return;
    const M = this.M;
    this.claw.targetX = lerp(M.CLAW_MIN_X, M.CLAW_MAX_X, clamp(n, 0, 1));
  }
  nudgeTarget(dx) {                  // 키보드용: 목표를 조금씩 이동
    if (!this.canMove()) return;
    const M = this.M;
    this.claw.targetX = clamp(this.claw.targetX + dx, M.CLAW_MIN_X, M.CLAW_MAX_X);
  }
  requestDrop() {                    // 집게 하강 시작 (성공하면 true)
    if (!this.canAcceptInput()) return false;
    const c = this.claw;
    c.phase = 'descend';
    c.t = 0;
    c.closeAmt = 0;
    c.held = null;
    c.targetX = c.x;                 // 작동 중에는 위치 고정
    this.cb.sfx('drop');
    return true;
  }

  /* ---------- 매 프레임 갱신 ----------
   * dt    : 애니메이션용 시간(초, 너무 크면 잘라서 사용)
   * rawMs : 실제 경과 시간(ms) → 타이머는 이것으로 계산 (애니메이션과 독립) */
  update(dt, rawMs) {
    if (this.isPaused()) return;

    if (this.screen === 'playing') {
      this.timeLeftMs -= rawMs;
      if (this.timeLeftMs <= 0) {
        this.timeLeftMs = 0;
        this.timeUp = true;
        this.screen = 'ending';      // 새 집게 작동은 막고, 진행 중인 동작만 마무리
      }
    }

    if (this.screen === 'playing' || this.screen === 'ending') this._updateClaw(dt);
    this._updatePlush(dt);
    this._updateEffects(dt);

    if (this.screen === 'ending' && this.claw.phase === 'idle' && !this._busy()) {
      this.screen = 'result';
      this.cb.onFinish(this.getResult());
    }
  }

  /* ---------- 집게 상태 머신 ---------- */
  _updateClaw(dt) {
    const c = this.claw, K = this.cfg.CLAW, M = this.M;
    if (c.cool > 0) c.cool -= dt;
    let vx = 0;

    switch (c.phase) {
      case 'idle': {
        // 목표 위치를 향해 부드럽게 이동 (최대 속도 제한)
        const dx = c.targetX - c.x;
        vx = clamp(dx * K.follow, -K.moveSpeed, K.moveSpeed);
        c.x = clamp(c.x + vx * dt, M.CLAW_MIN_X, M.CLAW_MAX_X);
        if (c.closeAmt > 0) c.closeAmt = Math.max(0, c.closeAmt - dt * 4);   // 발이 천천히 열림
        break;
      }
      case 'descend':
        c.y += K.descendSpeed * dt;
        if (c.y >= K.bottomY) {
          c.y = K.bottomY; c.phase = 'close'; c.t = 0;
          this.cb.sfx('close');
        }
        break;
      case 'close':
        c.t += dt;
        c.closeAmt = Math.min(1, c.t / K.closeSec);
        if (c.closeAmt >= 1) {
          this._judgeGrab();         // ★ 인형을 잡았는지 판정
          c.phase = 'ascend';
        }
        break;
      case 'ascend': {
        c.y -= K.ascendSpeed * dt;
        const prog = clamp((K.bottomY - c.y) / (K.bottomY - K.restY), 0, 1);
        if (c.held && c.willSlip && !c.slipChecked && prog >= c.slipAt) {
          c.slipChecked = true;
          this._slip();              // 올라가던 중 인형이 미끄러짐
        }
        if (c.y <= K.restY) {
          c.y = K.restY;
          if (c.held) { c.phase = 'carry'; } else { this._endCycle(); }
        }
        break;
      }
      case 'carry': {
        const dir = Math.sign(this.chuteX - c.x);
        vx = dir * K.carrySpeed;
        const nx = c.x + vx * dt;
        if ((dir > 0 && nx >= this.chuteX) || (dir <= 0 && nx <= this.chuteX)) {
          c.x = this.chuteX; vx = 0;
          c.phase = 'release'; c.t = 0; c.released = false;
        } else {
          c.x = nx;
        }
        break;
      }
      case 'release':
        c.t += dt;
        c.closeAmt = Math.max(0, 1 - c.t / K.releaseSec);
        if (!c.released && c.t >= K.releaseSec * 0.4) {
          c.released = true;
          const p = c.held;
          c.held = null;
          if (p) { p.state = 'toBin'; p.vy = 0; }   // 인형이 배출구로 떨어짐
          this.cb.sfx('release');
        }
        if (c.t >= K.releaseSec) this._endCycle();
        break;
    }

    c.vx = vx;
    // 인형이 매달려 흔들리는 정도
    c.sway += (clamp(-vx * 0.0006, -0.22, 0.22) - c.sway) * Math.min(1, 8 * dt);
  }

  _endCycle() {
    const c = this.claw, K = this.cfg.CLAW;
    c.phase = 'idle';
    c.y = K.restY;
    c.t = 0;
    c.held = null;
    c.targetX = c.x;                 // 현재 위치에서 정지
    c.cool = K.inputCooldownSec;
  }

  /* ---------- 인형 잡기 판정 ----------
   * 1) 집게 잡는 지점과 가장 가까운 인형을 고른다 (겹쳐 있으면 거리가 가까운 쪽, 같으면 앞쪽)
   * 2) 가까울수록 성공 확률↑  3) 확률 굴려서 성공/실패
   * 4) 성공해도 올라가는 중 미끄러질 수 있음(미리 결정해 둠) */
  _judgeGrab() {
    const c = this.claw, K = this.cfg.CLAW, G = this.cfg.GRAB, S = this.cfg.SLIP;
    const gx = c.x, gy = c.y + K.gripOffset;
    let best = null, bestD = Infinity;
    for (const p of this.plushes) {
      if (p.state !== 'rest' || p.spawnT < 1) continue;
      const d = Math.hypot(p.x - gx, (p.y - gy) * G.yWeight);
      if (d < bestD - 2 || (Math.abs(d - bestD) <= 2 && best && p.y > best.y)) { best = p; bestD = d; }
    }

    if (best && bestD < G.radius) {
      const closeness = 1 - bestD / G.radius;                   // 1이면 정중앙
      const R = this.cfg.RARITIES[best.rarity];
      const chance = lerp(G.minChance, G.maxChance, Math.pow(closeness, G.curve)) * R.successMul;
      if (Math.random() < chance) {
        // 성공: 인형이 집게에 매달림
        best.state = 'held';
        best.offX = best.x - gx;
        best.offY = clamp(best.y - gy, -70, 35);
        best.rot = 0;
        c.held = best;
        const slipChance = clamp((S.baseChance + (1 - closeness) * S.poorGripExtra) * R.slipMul, 0, 0.95);
        c.willSlip = Math.random() < slipChance;
        c.slipAt = rand(S.windowMin, S.windowMax);
        c.slipChecked = false;
        return;
      }
      best.wobble = 1;                                          // 잡을 뻔했지만 실패
      this._floater('아깝다!', gx, gy - 60, '#ffd0f0', 24, 1.0);
    } else {
      this._floater('MISS', gx, gy - 60, '#ffd0f0', 26, 1.0);
    }
    this.cb.sfx('miss');
  }

  /* 올라가던 인형이 미끄러져 원래 더미 쪽으로 떨어짐 (순간이동 없이 떨어지는 애니메이션) */
  _slip() {
    const c = this.claw, Z = this.M.ZONE;
    const p = c.held;
    if (!p) return;
    c.held = null;
    p.state = 'fall';
    p.vy = -80;
    p.fallX = clamp(p.x, Z.minX, Z.maxX);
    p.landY = clamp(Math.max(p.homeY + rand(-12, 12), p.y + 20), Z.minY, Z.maxY);
    p.bounces = 0;
    p.wobble = 1;
    this._floater('앗, 미끄러졌다!', p.x, p.y - 56, '#ff9fe0', 26, 1.3);
    this.cb.sfx('slip');
  }

  /* ---------- 인형 갱신 ---------- */
  _updatePlush(dt) {
    const c = this.claw, K = this.cfg.CLAW, Z = this.M.ZONE, M = this.M;
    for (const p of this.plushes) {
      p.wobble = Math.max(0, p.wobble - dt * 2.2);
      p.squash = Math.max(0, p.squash - dt * 4);
      if (p.spawnT < 1) p.spawnT = Math.min(1, p.spawnT + dt / 0.45);

      switch (p.state) {
        case 'held':                 // 집게에 매달려 따라 움직임
          p.offX += (0 - p.offX) * Math.min(1, 5 * dt);
          p.offY += (6 - p.offY) * Math.min(1, 5 * dt);
          p.x = c.x + p.offX;
          p.y = c.y + K.gripOffset + p.offY;
          p.rot = c.sway;
          break;
        case 'fall':                 // 미끄러져 떨어짐
          p.vy += this.GRAVITY * dt;
          p.y += p.vy * dt;
          p.x += (p.fallX - p.x) * Math.min(1, 6 * dt);
          if (p.y >= p.landY) {
            p.y = p.landY;
            if (p.bounces < 1 && p.vy > 260) { p.vy = -p.vy * 0.28; p.bounces++; p.squash = 0.7; }
            else { p.state = 'rest'; p.vy = 0; p.squash = 1; p.homeY = p.y; }
          }
          break;
        case 'toBin':                // 배출구로 떨어짐
          p.vy += this.GRAVITY * dt;
          p.y += p.vy * dt;
          p.x += (this.chuteX - p.x) * Math.min(1, 10 * dt);
          if (p.y >= M.BIN_Y) {
            p.y = M.BIN_Y; p.state = 'binned'; p.binT = 0; p.squash = 1;
            this._award(p);          // ★ 점수는 여기서 딱 한 번만 지급
          }
          break;
        case 'binned':
          p.binT += dt;
          if (p.binT > 0.8) p.state = 'gone';
          break;
      }
    }
    this._separate(dt);
    this.plushes = this.plushes.filter((p) => p.state !== 'gone');
  }

  // 겹친 인형을 부드럽게 서로 밀어내기
  _separate(dt) {
    const Z = this.M.ZONE;
    const min = this.cfg.PLUSH_MIN_GAP * 0.92;
    const k = Math.min(1, dt * 5);
    const rest = this.plushes.filter((p) => p.state === 'rest');
    for (let i = 0; i < rest.length; i++) {
      for (let j = i + 1; j < rest.length; j++) {
        const a = rest[i], b = rest[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) { dx = rand(-1, 1); dy = rand(-1, 1); d = Math.hypot(dx, dy) || 1; }
        const push = (min - d) * 0.5 * k;
        const ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
      }
    }
    rest.forEach((p) => {
      p.x = clamp(p.x, Z.minX, Z.maxX);
      p.y = clamp(p.y, Z.minY, Z.maxY);
    });
  }

  // 애니메이션이 아직 진행 중인 인형이 있는가? (게임 종료 전 마무리 확인용)
  _busy() {
    return this.plushes.some((p) => p.state === 'held' || p.state === 'fall' || p.state === 'toBin' || p.state === 'binned');
  }

  /* ---------- 인형 획득 처리 (점수 지급) ---------- */
  _award(p) {
    if (p.claimed) return;           // ★ 중복 지급 방지
    p.claimed = true;
    const R = this.cfg.RARITIES[p.rarity];
    const type = this.cfg.PLUSH_TYPES.find((t) => t.id === p.typeId);
    this.score += R.points;
    this.caught += 1;
    this.collection.push({ typeId: p.typeId, name: type ? type.name : p.typeId, rarity: p.rarity, points: R.points });

    const rare = p.rarity === 'rare', mid = p.rarity === 'medium';
    this.flash = rare ? 1 : (mid ? 0.75 : 0.55);
    this.flashColor = this._rgb(R.color);
    this._burst(this.chuteX, 735, R.color, rare ? 46 : (mid ? 24 : 14), rare);
    this._floater('+' + R.points, this.chuteX, 640, R.color, rare ? 58 : 44, 1.3);
    if (rare) this._floater('RARE!', this.chuteX, 590, '#ffffff', 30, 1.3);

    this._spawnPlush(true);          // 빈자리에 새 인형 보충 (획득했을 때만)
    this.cb.sfx(rare ? 'rare' : 'success');
    this.cb.onCatch(p, R);
  }

  /* ---------- 인형 만들기 / 배치 ---------- */
  _pickType() {
    const R = this.cfg.RARITIES;
    const keys = Object.keys(R);
    let total = 0;
    keys.forEach((k) => { total += R[k].weight; });
    let r = Math.random() * total, rarity = keys[keys.length - 1];
    for (const k of keys) { r -= R[k].weight; if (r <= 0) { rarity = k; break; } }
    let list = this.cfg.PLUSH_TYPES.filter((t) => t.rarity === rarity);
    if (!list.length) list = this.cfg.PLUSH_TYPES;
    return list[Math.floor(Math.random() * list.length)];
  }

  _findSpot() {
    const Z = this.M.ZONE, gap = this.cfg.PLUSH_MIN_GAP;
    const others = this.plushes.filter((p) => p.state === 'rest' || p.state === 'fall');
    let best = null, bestScore = -1;
    for (let i = 0; i < 80; i++) {
      const x = rand(Z.minX, Z.maxX), y = rand(Z.minY, Z.maxY);
      let md = Infinity;
      for (const o of others) md = Math.min(md, Math.hypot(o.x - x, o.y - y));
      if (md >= gap) return { x: x, y: y };        // 충분히 떨어진 자리 발견
      if (md > bestScore) { bestScore = md; best = { x: x, y: y }; }
    }
    return best;                                   // 자리가 좁으면 가장 여유 있는 자리
  }

  _spawnPlush(animated) {
    const type = this._pickType();
    const pos = this._findSpot();
    this.plushes.push({
      id: this.nextId++, typeId: type.id, rarity: type.rarity,
      x: pos.x, y: pos.y, homeY: pos.y,
      state: 'rest', spawnT: animated ? 0 : 1,
      vy: 0, wobble: 0, squash: 0, rot: 0, phase: Math.random() * 6.28,
      offX: 0, offY: 0, claimed: false, bounces: 0, binT: 0, fallX: pos.x, landY: pos.y
    });
    if (animated) this._burst(pos.x, pos.y, '#ffffff', 8, false);
  }

  /* ---------- 효과 (반짝임, 떠오르는 글자) ---------- */
  _rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  _burst(x, y, color, n, stars) {
    const colors = [color, '#ffffff', '#ffe55c', '#ff3dbd', '#19f0ff'];
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 220) break;
      const a = rand(0, Math.PI * 2), sp = rand(80, stars ? 380 : 260);
      this.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        life: 0, max: rand(0.5, 1.0), size: rand(3, stars ? 9 : 6),
        color: colors[Math.floor(Math.random() * colors.length)],
        star: stars ? Math.random() < 0.7 : Math.random() < 0.3, rot: rand(0, 6)
      });
    }
  }
  _floater(text, x, y, color, size, life) {
    this.floaters.push({ text: text, x: x, y: y, vy: -50, life: 0, max: life, color: color, size: size });
  }
  _updateEffects(dt) {
    this.flash = Math.max(0, this.flash - dt * 2.5);
    for (const p of this.particles) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.rot += dt * 4;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const f of this.floaters) { f.life += dt; f.y += f.vy * dt; }
    this.floaters = this.floaters.filter((f) => f.life < f.max);
  }

  /* ---------- 결과 ---------- */
  getGrade() {
    const list = this.cfg.GRADES.slice().sort((a, b) => b.min - a.min);
    for (const g of list) if (this.score >= g.min) return g;
    return list[list.length - 1];
  }
  getResult() {
    return { score: this.score, caught: this.caught, collection: this.collection.slice(), grade: this.getGrade() };
  }
}
