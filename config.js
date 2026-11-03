/* =====================================================================
 *  config.js  -  게임 설정값 모음 (여기만 고쳐도 게임이 바뀌어요!)
 *  숫자나 글자만 바꾸면 되고, 저장한 뒤 브라우저를 새로고침(F5)하면 적용돼요.
 * ===================================================================== */
const CONFIG = {

  /* ---------- 1) 기본 정보 ---------- */
  TITLE: 'NEON PLUSH CATCHER',                    // ★ 게임 제목 (나중에 여기서 바꾸세요)
  TAGLINE: '귀여운 인형 천국에서 60초 안에 최대한 많이 뽑아 보세요!',

  GAME_SECONDS: 60,        // 한 판 제한 시간(초)
  PLUSH_COUNT: 12,         // 기계 안에 항상 들어 있는 인형 수
  PLUSH_RADIUS: 30,        // 인형 몸통 반지름(px) - 클수록 인형이 커져요
  PLUSH_MIN_GAP: 52,       // 인형끼리 최소 간격(중심~중심, px)

  /* ---------- 2) 인형 희귀도: 점수 / 등장 확률 ----------
   *  weight : 등장 확률 비중 (60 : 30 : 10 = 60% : 30% : 10%)
   *  points : 획득 점수
   *  successMul : 잡기 성공 확률에 곱해지는 값 (1보다 작으면 더 어려움)
   *  slipMul    : 미끄러질 확률에 곱해지는 값 (1보다 크면 더 잘 미끄러짐)
   *  color      : 해당 등급을 표현하는 네온 색 */
  RARITIES: {
    common: { label: '일반', points: 100, weight: 60, successMul: 1.0,  slipMul: 1.0,  color: '#19f0ff' },
    medium: { label: '중급', points: 200, weight: 30, successMul: 0.92, slipMul: 1.1,  color: '#ff3dbd' },
    rare:   { label: '희귀', points: 500, weight: 10, successMul: 0.80, slipMul: 1.25, color: '#ffe55c' }
  },

  /* ---------- 3) 인형 종류 ----------
   *  id가 plush-art.js 안의 그림(디자인)과 연결돼요.
   *  나중에 정식 캐릭터 이미지를 쓰고 싶다면 plush-art.js만 바꾸면 되고,
   *  게임 규칙(game.js)은 그대로 둘 수 있어요. */
  PLUSH_TYPES: [
    { id: 'bear',          name: '작은 곰돌이',   rarity: 'common' },
    { id: 'bunny',         name: '둥근 토끼',     rarity: 'common' },
    { id: 'cat',           name: '작은 고양이',   rarity: 'common' },
    { id: 'bunnyLavender', name: '라벤더 토끼',   rarity: 'medium' },
    { id: 'ribbonBear',    name: '리본 곰돌이',   rarity: 'medium' },
    { id: 'unicorn',       name: '무지개 유니콘', rarity: 'rare' },
    { id: 'star',          name: '별 장식 인형',  rarity: 'rare' },
    { id: 'neonBot',       name: '네온 인형',     rarity: 'rare' }
  ],

  /* ---------- 4) 잡기 / 미끄러짐 확률 ---------- */
  GRAB: {
    radius: 64,        // 집게 중심에서 이 거리 안의 인형만 잡을 수 있어요
    maxChance: 0.92,   // 인형 정중앙에 맞췄을 때 성공 확률 (0.92 = 92%)
    minChance: 0.10,   // 거리 한계 끝자락에서의 성공 확률
    curve: 1.3,        // 클수록 "정확히 맞춰야" 성공 확률이 높아져요
    yWeight: 0.25      // 세로 거리를 얼마나 반영할지 (가로 거리가 더 중요)
  },
  SLIP: {
    baseChance: 0.18,      // 잡은 뒤 미끄러질 기본 확률 (18%)
    poorGripExtra: 0.25,   // 어설프게 잡았을수록 추가되는 미끄러짐 확률
    windowMin: 0.20,       // 올라가는 도중 미끄러지는 시점(0~1)의 최소/최대
    windowMax: 0.80
  },

  /* ---------- 5) 집게 움직임 속도 (px/초) ---------- */
  CLAW: {
    restY: 196,            // 집게 대기 높이
    bottomY: 546,          // 집게가 내려가는 가장 낮은 높이
    gripOffset: 52,        // 집게 머리에서 "잡는 지점"까지 거리
    moveSpeed: 460,        // 좌우 이동 최대 속도
    follow: 9,             // 목표를 따라가는 부드러움 (클수록 빠르게 따라감)
    descendSpeed: 380,     // 하강 속도
    ascendSpeed: 420,      // 상승 속도
    closeSec: 0.45,        // 집게 발이 닫히는 시간(초)
    carrySpeed: 560,       // 인형을 배출구로 옮기는 속도
    releaseSec: 0.50,      // 배출구에서 집게가 열리는 시간(초)
    inputCooldownSec: 0.15 // 동작이 끝난 직후 입력 무시 시간(오작동 방지)
  },

  /* ---------- 6) 손동작 인식 / 민감도 ---------- */
  HAND: {
    RANGE_MIN: 0.20,       // 카메라 화면 가로 20% ~ 80% 구간을 집게 전체 범위에 연결
    RANGE_MAX: 0.80,       //  (구간을 좁히면 손을 조금만 움직여도 집게가 많이 움직여요)
    SENSITIVITY: 1.0,      // 민감도 (1.0 기본, 1.3이면 더 민감)
    SMOOTHING: 0.35,       // 손 떨림 보정 (0~1, 작을수록 더 부드럽고 느림)
    DEADZONE: 0.004,       // 이보다 작은 손 떨림은 무시
    EXTENDED_RATIO: 1.55,  // 손가락이 "펴졌다"고 보는 기준
    CURLED_RATIO: 1.25,    // 손가락이 "접혔다"고 보는 기준
    STABLE_FRAMES: 3,      // 같은 동작이 이 프레임만큼 이어져야 인정
    ABSENT_MS: 250,        // 손이 이 시간 이상 안 보이면 "없음"으로 판단
    LOST_GRACE_MS: 600,    // 손이 사라진 뒤 이 시간이 지나면 일시정지
    DETECT_INTERVAL_MS: 33 // 손 인식 간격 (약 30번/초)
  },

  // ★ 손이 안 보일 때 게임을 일시정지할지 여부 (true: 일시정지 / false: 계속 진행)
  PAUSE_WHEN_HAND_LOST: true,

  /* ---------- 7) 키보드 테스트 모드 ---------- */
  KEYBOARD: {
    ENABLED_BY_DEFAULT: false, // 처음부터 키보드 조작을 켜려면 true
    SPEED: 420                 // 키보드로 집게를 움직이는 속도
  },

  /* ---------- 8) 결과 등급 (점수 기준) ---------- */
  GRADES: [
    { name: '브론즈', min: 0,    color: '#e39a5c' },
    { name: '실버',   min: 600,  color: '#dce8f7' },
    { name: '골드',   min: 1200, color: '#ffe55c' },
    { name: '다이아', min: 2000, color: '#7ff4ff' }
  ],

  /* ---------- 9) 색상 (네온 팔레트) ---------- */
  COLORS: {
    cyan: '#19f0ff',
    pink: '#ff3dbd',
    purple: '#9b5cff',
    yellow: '#ffe55c'
  },

  /* ---------- 10) 기계 화면 배치 (고급: 보통은 건드리지 않아도 돼요) ---------- */
  MACHINE: {
    W: 800, H: 940,                               // 게임 화면 기준 크기
    GLASS: { x: 60, y: 118, w: 680, h: 552 },     // 유리창 영역
    RAIL_Y: 146,                                  // 집게 레일 높이
    FLOOR_BACK_Y: 450,                            // 바닥이 시작되는 높이
    CHUTE: { x: 70, w: 150 },                     // 상품 배출구(왼쪽 아래)
    WELL_TOP_Y: 566,                              // 배출구 구멍 윗부분
    BIN_Y: 772,                                   // 인형이 떨어져 도착하는 높이
    ZONE: { minX: 252, maxX: 712, minY: 468, maxY: 624 }, // 인형이 놓이는 구역
    CLAW_MIN_X: 110, CLAW_MAX_X: 690              // 집게가 움직일 수 있는 가로 범위
  },

  /* ---------- 11) 손 인식 라이브러리 주소 (MediaPipe) ---------- */
  MEDIAPIPE: {
    VERSION: '0.10.14',
    BUNDLE_URL: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
    WASM_URL: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    MODEL_URL: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
  },

  MAX_FRAME_DT: 0.05       // 애니메이션 한 프레임 최대 시간(초) - 끊김 방지용
};

/* ---------- 여러 파일에서 같이 쓰는 도우미 함수 ---------- */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
