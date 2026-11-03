/* =====================================================================
 *  main.js  -  모든 부품을 연결하는 "지휘자"
 *  - 손 인식(hand-tracker) / 게임 규칙(game) / 화면(renderer) / 소리(audio)를 이어 줘요.
 *  - 버튼, 키보드, 화면 크기 변경, 결과 화면 등 "화면 속 글자와 버튼"도 여기서 관리해요.
 * ===================================================================== */
(function () {
  'use strict';

  const cfg = CONFIG;
  const $ = (id) => document.getElementById(id);

  /* ---------- 화면 요소 ---------- */
  const canvas = $('gameCanvas'), stage = $('stage'), video = $('cam');
  const startOverlay = $('startOverlay'), resultOverlay = $('resultOverlay'), settingsOverlay = $('settingsOverlay');
  const timeBox = $('timeBox'), timeValue = $('timeValue');
  const scoreBox = $('scoreBox'), scoreValue = $('scoreValue'), scorePop = $('scorePop');
  const plushValue = $('plushValue'), plushBox = $('plushBox');
  const pauseBanner = $('pauseBanner'), toastEl = $('toast'), kbdHint = $('kbdHint');
  const startBtn = $('startBtn'), camBtn = $('camBtn');

  /* ---------- 부품 만들기 ---------- */
  const game = new Game(cfg);
  const renderer = new Renderer(canvas, game, cfg);
  const audio = new AudioSys();
  const tracker = new HandTracker(cfg, video);

  // 설정 상태 (소리는 기본 꺼짐)
  const settings = { music: false, sfx: false, keyboard: !!cfg.KEYBOARD.ENABLED_BY_DEFAULT };

  // 입력 상태
  const keys = { left: false, right: false };
  let kbDrop = false;        // 스페이스 눌림 (한 번만 처리)
  let fistLatch = false;     // 주먹 한 번 = 작동 한 번 (주먹을 쥐고 있어도 반복 안 됨)
  let lastTs = null;         // 이전 프레임 시각
  let prevScreen = 'menu';

  /* ================== 제목 / 안내 문구 채우기 ================== */
  document.title = cfg.TITLE;
  $('gameTitle').textContent = cfg.TITLE;
  $('startTitle').textContent = cfg.TITLE;
  $('startTagline').textContent = cfg.TAGLINE;
  (function fillRules() {
    const R = cfg.RARITIES;
    $('startRules').innerHTML =
      '제한 시간 <b>' + cfg.GAME_SECONDS + '초</b> · 인형 점수 ' +
      '<b>일반 ' + R.common.points + '</b> / <b>중급 ' + R.medium.points + '</b> / <b>희귀 ' + R.rare.points + '</b><br>' +
      '집게를 인형 한가운데에 맞출수록 잘 잡혀요. 잡아도 미끄러질 수 있어요!';
  })();

  /* ================== 도우미 ================== */
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }
  function retrigger(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  let toastTimer = 0;
  function toast(msg, ms) {            // 화면 아래 잠깐 뜨는 안내 (게임 로직과 무관한 화면용 타이머)
    toastEl.textContent = msg;
    show(toastEl);
    clearTimeout(toastTimer);
    if (ms) toastTimer = setTimeout(() => hide(toastEl), ms);
  }

  /* ================== 설정 토글(배경음악/효과음/키보드) ================== */
  const TOGGLES = [
    { key: 'music', label: '🎵 배경음악' },
    { key: 'sfx', label: '🔊 효과음' },
    { key: 'keyboard', label: '⌨ 키보드 테스트 모드' }
  ];
  document.querySelectorAll('.settings-slot').forEach((slot) => {
    slot.innerHTML = TOGGLES.map((t) =>
      '<label class="toggle"><input type="checkbox" data-setting="' + t.key + '">' +
      '<span class="slider"></span><span>' + t.label + '</span><span class="tstate"></span></label>'
    ).join('');
  });
  function syncToggles() {
    document.querySelectorAll('input[data-setting]').forEach((inp) => {
      inp.checked = !!settings[inp.dataset.setting];
      inp.parentElement.querySelector('.tstate').textContent = inp.checked ? 'ON' : 'OFF';
    });
    kbdHint.classList.toggle('hidden', !settings.keyboard);
  }
  function applySetting(key, on) {
    if (key === 'music') {
      settings.music = audio.setMusic(on) ? on : false;     // 소리를 켜는 "클릭" 안에서 오디오 시작
      if (on && !settings.music) toast('이 브라우저에서는 소리를 켤 수 없어요.', 3000);
    } else if (key === 'sfx') {
      settings.sfx = audio.setSfx(on) ? on : false;
      if (settings.sfx) audio.sfx('ui');
    } else if (key === 'keyboard') {
      settings.keyboard = on;
      keys.left = keys.right = false;
    }
    syncToggles();
  }
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t && t.matches && t.matches('input[data-setting]')) applySetting(t.dataset.setting, t.checked);
  });
  syncToggles();

  /* ================== 화면 크기 맞추기 ================== */
  function fitCanvas() {
    if (Math.min(window.devicePixelRatio || 1, 2) !== renderer.dpr) renderer.rebuild();   // 확대/축소로 선명도가 바뀐 경우
    const M = cfg.MACHINE;
    const w = stage.clientWidth, h = stage.clientHeight;
    if (w <= 0 || h <= 0) return;
    const s = Math.min(w / M.W, h / M.H);
    canvas.style.width = Math.floor(M.W * s) + 'px';
    canvas.style.height = Math.floor(M.H * s) + 'px';
  }
  window.addEventListener('resize', fitCanvas);
  if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe(stage);
  fitCanvas();

  /* ================== 게임 시작 / 결과 ================== */
  function startGame() {
    hide(startOverlay); hide(resultOverlay); hide(settingsOverlay); hide(pauseBanner);
    game.start();                                // 점수/인형/집게/타이머 전부 초기화
    const st = tracker.running ? tracker.getState(performance.now()) : null;
    fistLatch = !!(st && st.present && st.gesture === 'fist');   // 시작 순간 주먹이면, 한 번 풀 때까지 대기
    kbDrop = false;
    lastTs = null;
    scorePop.classList.remove('show');
    audio.sfx('start');
    refreshHud(true);
  }

  game.cb.sfx = function (name) { audio.sfx(name); };
  game.cb.onCatch = function (plush, R) {
    scorePop.textContent = '+' + R.points;
    scorePop.classList.toggle('rare', plush.rarity === 'rare');
    retrigger(scorePop, 'show');
    retrigger(scoreBox, 'bump');
  };
  game.cb.onFinish = function (res) {
    audio.sfx('end');
    showResult(res);
  };

  function showResult(res) {
    $('resultScore').textContent = res.score.toLocaleString();
    $('resultCount').textContent = res.caught;
    const badge = $('gradeBadge');
    badge.textContent = res.grade.name;
    badge.style.background = res.grade.color;
    badge.style.color = '#1a0b45';

    // 획득한 인형을 종류별로 묶어서 보여 줘요
    const box = $('resultCollection');
    box.innerHTML = '';
    if (!res.collection.length) {
      box.innerHTML = '<span class="empty">이번에는 인형을 뽑지 못했어요. 다시 도전해 보세요!</span>';
    } else {
      const groups = {};
      res.collection.forEach((it) => {
        if (!groups[it.typeId]) groups[it.typeId] = { item: it, n: 0 };
        groups[it.typeId].n++;
      });
      Object.keys(groups).forEach((id) => {
        const g = groups[id];
        const div = document.createElement('div');
        div.className = 'coll-item';
        div.style.setProperty('--c', cfg.RARITIES[g.item.rarity].color);
        const cv = document.createElement('canvas');
        cv.width = 108; cv.height = 108;
        PlushArt.drawTo(cv, id);
        const nm = document.createElement('div');
        nm.className = 'nm'; nm.textContent = g.item.name;
        const cnt = document.createElement('div');
        cnt.className = 'cnt'; cnt.textContent = '×' + g.n;
        div.appendChild(cv); div.appendChild(nm); div.appendChild(cnt);
        box.appendChild(div);
      });
    }
    hide(pauseBanner);
    show(resultOverlay);
  }

  /* ================== HUD(위쪽 숫자) 갱신 ================== */
  const shown = { time: -1, score: -1, count: -1 };
  function refreshHud(force) {
    if (force) { shown.time = shown.score = shown.count = -1; }
    const t = game.timeLeftSec;
    if (t !== shown.time) {
      timeValue.textContent = t;
      timeBox.classList.toggle('danger', t <= 10 && (game.screen === 'playing' || game.screen === 'ending'));
      shown.time = t;
    }
    if (game.score !== shown.score) {
      scoreValue.textContent = game.score.toLocaleString();
      shown.score = game.score;
    }
    if (game.caught !== shown.count) {
      if (shown.count >= 0 && game.caught > shown.count) retrigger(plushBox, 'bump');
      plushValue.textContent = game.caught;
      shown.count = game.caught;
    }
  }

  /* ================== 손 인식 상태 표시 ================== */
  const led = { cam: $('camLed'), hud: $('hudLed') };
  const txt = { cam: $('camStatusText'), hud: $('hudHandText') };
  let lastStatusKey = '';
  function setStatusUI(ledClass, text) {
    const key = ledClass + '|' + text;
    if (key === lastStatusKey) return;
    lastStatusKey = key;
    ['cam', 'hud'].forEach((k) => { led[k].className = 'led ' + ledClass; txt[k].textContent = text; });
  }
  function updateStatus(now) {
    switch (tracker.status) {
      case 'idle':          return setStatusUI('', '카메라 꺼짐 (키보드로 테스트 가능)');
      case 'requesting':    return setStatusUI('busy', '카메라 연결 중… 권한 창에서 "허용"을 눌러 주세요');
      case 'loading-model': return setStatusUI('busy', '손 인식 모델을 불러오는 중…');
      case 'denied':        return setStatusUI('bad', '카메라 권한이 필요함 (주소창 옆 카메라 아이콘에서 허용)');
      case 'camera-failed': return setStatusUI('bad', '카메라 연결 실패 (웹캠 확인)');
      case 'lib-failed':    return setStatusUI('bad', '손 인식 라이브러리를 불러오지 못함 (인터넷 확인)');
      case 'running': {
        const h = tracker.getState(now);
        if (!h.present) {
          if (now - tracker.connectedAt < 2000) return setStatusUI('ok', '카메라 연결 완료');
          return setStatusUI('warn', '손을 찾을 수 없음');
        }
        if (h.gesture === 'palm') return setStatusUI('ok', '손바닥 인식: 좌우 이동 가능');
        if (h.gesture === 'fist') return setStatusUI('ok', '주먹 인식: 집게 작동');
        return setStatusUI('ok', '손 인식 중');
      }
    }
  }

  /* ================== 카메라 켜기 ================== */
  async function connectCamera() {
    if (tracker.running) return true;
    if (tracker.starting) return false;
    camBtn.disabled = true;
    const ok = await tracker.start();
    camBtn.disabled = false;
    if (!ok) {
      if (!settings.keyboard) { settings.keyboard = true; syncToggles(); }   // 카메라 없이도 테스트할 수 있게
      const why = {
        denied: '카메라 권한이 거부되었어요. 키보드 테스트 모드를 켰어요. (← → 이동, Space 집게)',
        'camera-failed': '카메라를 사용할 수 없어요. 키보드 테스트 모드를 켰어요. (← → 이동, Space 집게)',
        'lib-failed': '손 인식 라이브러리를 불러오지 못했어요(인터넷 연결 확인). 키보드 테스트 모드를 켰어요.'
      }[tracker.status] || '카메라를 시작하지 못했어요. 키보드 테스트 모드를 켰어요.';
      toast(why, 6000);
    } else {
      toast('카메라 연결 완료! 손바닥을 카메라에 보여 주세요 ✋', 3000);
    }
    return ok;
  }
  camBtn.addEventListener('click', () => { audio.sfx('ui'); connectCamera(); });

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    // 아직 카메라를 한 번도 켜지 않았다면 먼저 연결 시도 (권한 요청 창이 떠요)
    if (!tracker.running && (tracker.status === 'idle')) await connectCamera();
    startBtn.disabled = false;
    if (!tracker.running && !settings.keyboard) {      // 손도 키보드도 없으면 게임을 할 수 없으니 키보드 자동 켜기
      settings.keyboard = true; syncToggles();
      toast('카메라 없이 시작해요. 키보드로 조작하세요: ← → 이동, Space 집게', 5000);
    }
    startGame();
  });
  $('retryBtn').addEventListener('click', startGame);
  $('menuBtn').addEventListener('click', () => {
    game.reset();
    hide(resultOverlay);
    show(startOverlay);
    refreshHud(true);
  });

  /* ---------- 설정 창 ---------- */
  function setSettingsOpen(open) {
    if (open) { show(settingsOverlay); game.setPause('settings', true); }
    else { hide(settingsOverlay); game.setPause('settings', false); lastTs = null; }
  }
  $('settingsBtn').addEventListener('click', () => setSettingsOpen(true));
  $('settingsClose').addEventListener('click', () => setSettingsOpen(false));

  /* ---------- 탭 전환: 숨겨진 동안에는 게임을 멈춰요 (시간이 이상하게 흐르지 않도록) ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.setPause('hidden', true);
      audio.suspend();
    } else {
      game.setPause('hidden', false);
      audio.resume();
      lastTs = null;       // 돌아온 첫 프레임의 시간 차이를 무시
    }
  });

  /* ================== 키보드 ================== */
  function playing() {
    return game.screen === 'playing' && settingsOverlay.classList.contains('hidden');
  }
  window.addEventListener('keydown', (e) => {
    if (!settings.keyboard) return;
    if (e.key === 'ArrowLeft') { keys.left = true; if (playing()) e.preventDefault(); }
    else if (e.key === 'ArrowRight') { keys.right = true; if (playing()) e.preventDefault(); }
    else if (e.code === 'Space') {
      if (playing()) { e.preventDefault(); if (!e.repeat) kbDrop = true; }
    } else if (e.key === 'r' || e.key === 'R') {
      if (!e.repeat && game.screen !== 'menu' && settingsOverlay.classList.contains('hidden')) startGame();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    else if (e.key === 'ArrowRight') keys.right = false;
    else if (e.code === 'Space' && settings.keyboard && playing()) e.preventDefault();
  });
  window.addEventListener('blur', () => { keys.left = keys.right = false; });

  /* ================== 입력 처리 (매 프레임) ================== */
  function handleInput(now, dt) {
    const hand = tracker.running ? tracker.getState(now) : null;

    // (1) 손이 사라졌을 때 일시정지 (집게가 대기 중일 때만, 키보드 모드에서는 안 함)
    let lost = false;
    if (game.screen === 'playing' && hand && !settings.keyboard && cfg.PAUSE_WHEN_HAND_LOST) {
      lost = !hand.present && hand.lostMs > cfg.HAND.LOST_GRACE_MS && game.claw.phase === 'idle';
    }
    game.setPause('hand', lost);
    pauseBanner.classList.toggle('hidden', !lost);

    // (2) 손 입력
    let fistNow = false;
    if (hand && hand.present) {
      fistNow = hand.gesture === 'fist';
      // 손바닥일 때만 좌우 이동 (안정화된 동작 + 이번 프레임도 손바닥일 때)
      if (hand.gesture === 'palm' && hand.raw === 'palm') game.setTargetFromNorm(hand.xNorm);
    }
    if (fistNow) {
      if (!fistLatch) {                  // 주먹을 "쥐는 순간" 딱 한 번만
        fistLatch = true;
        game.requestDrop();              // 집게 작동 중이면 무시돼요
      }
    } else if (hand && hand.present) {
      fistLatch = false;                 // 주먹을 풀어야 다음 작동 가능
    }

    // (3) 키보드 입력 (개발/테스트용)
    const wantDrop = kbDrop; kbDrop = false;
    if (settings.keyboard) {
      const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (dir) game.nudgeTarget(dir * cfg.KEYBOARD.SPEED * dt);
      if (wantDrop) game.requestDrop();
    }
  }

  /* ================== 메인 루프 ================== */
  function frame(ts) {
    requestAnimationFrame(frame);          // 오류가 나도 루프는 계속 돌아요 (빈 화면 방지)
    try {
      if (lastTs === null) lastTs = ts;
      const raw = Math.max(0, ts - lastTs);   // 실제 경과 시간(ms): 타이머용
      lastTs = ts;
      const dt = Math.min(raw / 1000, cfg.MAX_FRAME_DT);   // 애니메이션용(너무 크면 잘라냄)
      const now = performance.now();

      if (game.screen === 'playing' || game.screen === 'ending') handleInput(now, dt);
      else { pauseBanner.classList.add('hidden'); }

      game.update(dt, raw);
      renderer.draw(ts);
      refreshHud(false);
      updateStatus(now);

      if (prevScreen !== 'ending' && game.screen === 'ending') toast('⏰ 시간 종료! 마무리 중…', 1500);
      prevScreen = game.screen;
    } catch (err) {
      console.error(err);
      toast('앗, 문제가 생겼어요. F5로 새로고침해 주세요. (' + (err && err.message) + ')', 0);
    }
  }
  refreshHud(true);
  syncToggles();
  requestAnimationFrame(frame);
})();
