/* =====================================================================
 *  hand-tracker.js  -  웹캠 손 인식 담당
 *  - MediaPipe의 "Tasks Vision" 라이브러리(HandLandmarker)를 사용해요.
 *    (예전 방식인 @mediapipe/hands 가 아니라 현재 권장되는 @mediapipe/tasks-vision 이에요.)
 *  - 카메라 영상은 화면에 보여 주지 않고, 손의 위치와 모양만 읽어요.
 *  - 결과: 손 있음/없음, 동작(손바닥 palm / 주먹 fist / 기타 other), 가로 위치(0~1)
 * ===================================================================== */
class HandTracker {
  constructor(cfg, videoEl) {
    this.cfg = cfg;
    this.video = videoEl;
    this.stream = null;
    this.landmarker = null;

    // status: idle(대기) requesting(카메라 요청) loading-model(모델 로딩)
    //         running(작동 중) denied(권한 거부) camera-failed(카메라 실패) lib-failed(라이브러리 실패)
    this.status = 'idle';
    this.running = false;
    this.starting = false;
    this.connectedAt = 0;

    this._raf = 0;
    this._lastVideoTime = -1;
    this._lastDetect = 0;
    this._errCount = 0;

    // 손 상태
    this._seen = false;       // 한 번이라도 손을 봤는지
    this._lastSeen = 0;       // 마지막으로 손을 본 시각
    this.raw = 'none';        // 이번 프레임의 동작
    this.stable = 'none';     // 안정화된 동작 (몇 프레임 이어진 동작만 인정)
    this._cand = 'none';
    this._candCount = 0;
    this.sx = 0.5;            // 부드럽게 보정된 가로 위치 (0~1, 거울 모드)
    this._loop = this._loop.bind(this);
  }

  /* ---------- 카메라 + 모델 시작 ---------- */
  async start() {
    if (this.starting || this.running) return this.running;
    this.starting = true;
    try {
      this.status = 'requesting';

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.status = 'camera-failed';
        this.errorDetail = '이 브라우저는 카메라를 지원하지 않거나, 보안 연결이 아니에요.';
        return false;
      }

      // 1) 카메라 권한 요청
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });
      } catch (err) {
        const n = err && err.name;
        if (n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError') {
          this.status = 'denied';
        } else {
          this.status = 'camera-failed';   // 웹캠 없음(NotFoundError), 다른 앱이 사용 중(NotReadableError) 등
        }
        this.errorDetail = (err && err.name) || '';
        return false;
      }

      this.video.srcObject = this.stream;
      try { await this.video.play(); } catch (e) { /* 자동재생 오류는 무시 (muted라 보통 문제없음) */ }
      const track = this.stream.getVideoTracks()[0];
      if (track) track.addEventListener('ended', () => this._onCameraLost());

      // 2) 손 인식 모델 불러오기
      this.status = 'loading-model';
      try {
        await this._loadModel();
      } catch (err) {
        console.error('MediaPipe 로딩 실패:', err);
        this._stopStream();
        this.status = 'lib-failed';
        this.errorDetail = String(err && err.message || err);
        return false;
      }

      // 3) 인식 시작
      this.running = true;
      this.status = 'running';
      this.connectedAt = performance.now();
      this._lastSeen = this.connectedAt;
      this._seen = false;
      this._lastVideoTime = -1;
      this._raf = requestAnimationFrame(this._loop);
      return true;
    } finally {
      this.starting = false;
    }
  }

  async _loadModel() {
    const M = this.cfg.MEDIAPIPE;
    // import()는 파일을 직접 열었을 때(file://)도 동작하는 "동적 불러오기"예요.
    const mod = await import(M.BUNDLE_URL);
    const FilesetResolver = mod.FilesetResolver;
    const HandLandmarker = mod.HandLandmarker;
    if (!FilesetResolver || !HandLandmarker) throw new Error('MediaPipe 모듈에서 HandLandmarker를 찾지 못했어요.');

    const fileset = await FilesetResolver.forVisionTasks(M.WASM_URL);
    const make = (delegate) => HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: M.MODEL_URL, delegate: delegate },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    try {
      this.landmarker = await make('GPU');   // 그래픽카드 사용 (빠름)
    } catch (e) {
      this.landmarker = await make('CPU');   // 안 되면 CPU로 재시도
    }
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    this._stopStream();
    if (this.landmarker && this.landmarker.close) { try { this.landmarker.close(); } catch (e) {} }
    this.landmarker = null;
    this.status = 'idle';
  }
  _stopStream() {
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    this.video.srcObject = null;
  }
  _onCameraLost() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    this.status = 'camera-failed';
    this.errorDetail = '카메라 연결이 끊어졌어요.';
  }

  /* ---------- 매 프레임 인식 루프 ---------- */
  _loop() {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._loop);

    const v = this.video;
    if (v.readyState < 2 || v.currentTime === this._lastVideoTime) return;   // 새 영상 프레임이 있을 때만
    const now = performance.now();
    if (now - this._lastDetect < this.cfg.HAND.DETECT_INTERVAL_MS) return;
    this._lastVideoTime = v.currentTime;
    this._lastDetect = now;

    try {
      const result = this.landmarker.detectForVideo(v, now);
      this._handle(result, now);
      this._errCount = 0;
    } catch (err) {
      this._errCount++;
      if (this._errCount > 20) {          // 계속 실패하면 포기하고 안내
        console.error(err);
        this.running = false;
        this.status = 'camera-failed';
        this.errorDetail = '손 인식 중 오류가 계속 발생했어요.';
      }
    }
  }

  _handle(result, now) {
    const H = this.cfg.HAND;
    const lm = result && result.landmarks && result.landmarks[0];
    if (!lm) { this.raw = 'none'; return; }   // 손이 안 보임 (getState가 시간 기준으로 판단)

    const wasAbsent = !this._seen || (now - this._lastSeen) > H.ABSENT_MS;
    this._seen = true;
    this._lastSeen = now;

    // 1) 동작 분류 + 안정화
    const aspect = (this.video.videoWidth || 640) / (this.video.videoHeight || 480);
    this.raw = this._classify(lm, aspect);
    if (wasAbsent) { this.stable = this.raw; this._cand = this.raw; this._candCount = H.STABLE_FRAMES; }
    if (this.raw === this._cand) { this._candCount++; } else { this._cand = this.raw; this._candCount = 1; }
    if (this._candCount >= H.STABLE_FRAMES) this.stable = this._cand;

    // 2) 손바닥 중심의 가로 위치 → 0~1 (거울처럼 좌우 반전)
    const ids = [0, 5, 9, 13, 17];
    let cx = 0;
    ids.forEach((i) => { cx += lm[i].x; });
    cx /= ids.length;
    let n = (1 - cx - H.RANGE_MIN) / (H.RANGE_MAX - H.RANGE_MIN);
    n = 0.5 + (n - 0.5) * H.SENSITIVITY;
    n = clamp(n, 0, 1);

    // 3) 떨림 보정: 작은 움직임은 무시하고, 큰 움직임은 부드럽게 따라가요
    if (wasAbsent) {
      this.sx = n;
    } else {
      const diff = n - this.sx;
      if (Math.abs(diff) > H.DEADZONE) this.sx += diff * H.SMOOTHING;
    }
  }

  /* 손가락이 펴졌는지/접혔는지로 손바닥·주먹 구분
   * 각 손가락에서 "손목~손가락 끝 거리 ÷ 손목~손가락 뿌리(MCP) 거리"를 계산해요.
   * 손가락을 펴면 이 값이 크고(약 1.8), 주먹을 쥐면 작아요(약 1.0 이하).
   * 손의 크기나 방향이 달라도 비율이라서 잘 동작해요. */
  _classify(lm, aspect) {
    const H = this.cfg.HAND;
    const dist = (a, b) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
    const wrist = lm[0];
    const fingers = [[8, 5], [12, 9], [16, 13], [20, 17]];   // [손가락 끝, 손가락 뿌리] (검지~새끼)
    let extended = 0, curled = 0;
    fingers.forEach((f) => {
      const base = dist(wrist, lm[f[1]]);
      if (base < 1e-6) return;
      const ratio = dist(wrist, lm[f[0]]) / base;
      if (ratio > H.EXTENDED_RATIO) extended++;
      else if (ratio < H.CURLED_RATIO) curled++;
    });
    if (extended >= 3) return 'palm';
    if (curled >= 3 && extended === 0) return 'fist';
    return 'other';
  }

  /* ---------- 게임이 읽어 가는 현재 상태 ---------- */
  getState(now) {
    const H = this.cfg.HAND;
    const ago = Math.max(0, now - this._lastSeen);
    const present = this.running && this._seen && ago < H.ABSENT_MS;
    return {
      present: present,
      gesture: present ? this.stable : 'none',   // 안정화된 동작
      raw: present ? this.raw : 'none',          // 이번 프레임 동작
      xNorm: this.sx,                            // 0(왼쪽) ~ 1(오른쪽)
      lostMs: this.running ? ago : 0
    };
  }
}
