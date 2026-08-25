/**
 * 食育ドラッグ＆ドロップゲームのメインロジック
 * モバイルファースト・タッチ操作対応
 */

// ゲームのステート
const state = {
  foodItems: [],
  scores: {},
  placedItems: 0,
  totalItems: 0,
  audioContext: null,
};

// 栄養素ゾーンの定義
const ZONES = {
  1: { name: '炭水化物', group: 'energy', hint: 'ヒント：エネルギーになる「きいろ」のなかまだよ！🟡' },
  2: { name: '脂質', group: 'energy', hint: 'ヒント：エネルギーになる「きいろ」のなかまだよ！🟡' },
  3: { name: 'たんぱく質', group: 'body', hint: 'ヒント：からだをつくる「あか・ピンク」のなかまだよ！🩷' },
  4: { name: '無機質', group: 'body', hint: 'ヒント：からだをつくる「あか・ピンク」のなかまだよ！🩷' },
  5: { name: 'ビタミン（緑黄色野菜）', group: 'condition', hint: 'ヒント：からだの調子をととのえる「みどり」のなかまだよ！🟢' },
  6: { name: 'ビタミン（その他の野菜・果物）', group: 'condition', hint: 'ヒント：からだの調子をととのえる「みどり」のなかまだよ！🟢' },
};

// ========== オーディオ ==========

function initAudio() {
  if (!state.audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) state.audioContext = new AudioCtx();
  }
}

/** 正解チャイム */
function playSuccessSound() {
  if (!state.audioContext) return;
  const ctx = state.audioContext;

  // C5 → E5 → G5 のアルペジオ
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime + i * 0.12;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

/** 不正解音 */
function playErrorSound() {
  if (!state.audioContext) return;
  const ctx = state.audioContext;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 200;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.25, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.start(t);
  osc.stop(t + 0.25);
}

// ========== パーティクルエフェクト ==========

function createSparkles(x, y) {
  const colors = ['#FFD700', '#FF69B4', '#00E676', '#00BFFF', '#FF6D00', '#AA00FF'];
  for (let i = 0; i < 20; i++) {
    const el = document.createElement('div');
    el.className = 'sparkle-particle';
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 60;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    el.style.cssText = `
      position: fixed; left: ${x}px; top: ${y}px;
      width: ${6 + Math.random() * 6}px; height: ${6 + Math.random() * 6}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: 50%; pointer-events: none; z-index: 9999;
      animation: sparkle-fly 0.8s cubic-bezier(.25,1,.5,1) forwards;
      --tx: ${tx}px; --ty: ${ty}px;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }
}

// ========== ヒント表示 ==========

function showHint(food) {
  const hintEl = document.getElementById('hint-display');
  if (!hintEl) return;

  const zone = ZONES[food.category];
  hintEl.textContent = zone ? zone.hint : 'もう一回やってみよう！';
  hintEl.classList.add('show');
  setTimeout(() => hintEl.classList.remove('show'), 2500);
}

// ========== スコア計算 ==========

function calculateStars(attempts) {
  if (attempts <= 1) return 3;
  if (attempts === 2) return 2;
  return 1;
}

export function getScore() {
  if (state.foodItems.length === 0) return 0;
  let earned = 0;
  for (const item of state.foodItems) {
    earned += calculateStars(state.scores[item.name] || 1);
  }
  return Math.round((earned / (state.foodItems.length * 3)) * 100);
}

// ========== ドラッグ＆ドロップ ==========

function setupDraggable(card, foodData) {
  let isDragging = false;
  let offsetX = 0, offsetY = 0;
  let originalParent = null;
  let placeholder = null;

  function getPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function onStart(e) {
    if (card.classList.contains('placed')) return;
    initAudio();

    isDragging = true;
    const pos = getPos(e);
    const rect = card.getBoundingClientRect();
    offsetX = pos.x - rect.left;
    offsetY = pos.y - rect.top;

    const layoutWidth = card.offsetWidth;
    const layoutHeight = card.offsetHeight;

    // プレースホルダーを残す
    originalParent = card.parentElement;
    placeholder = document.createElement('div');
    placeholder.className = 'food-card-placeholder';
    placeholder.style.width = layoutWidth + 'px';
    placeholder.style.height = layoutHeight + 'px';
    originalParent.insertBefore(placeholder, card);

    // 親要素のtransform等の影響を受けないようにbody直下に移動
    document.body.appendChild(card);

    // カードを fixed にして浮かせる
    card.style.position = 'fixed';
    card.style.left = (pos.x - offsetX) + 'px';
    card.style.top = (pos.y - offsetY) + 'px';
    card.style.width = layoutWidth + 'px';
    card.style.height = layoutHeight + 'px';
    card.style.zIndex = '1000';
    card.style.transform = 'scale(1.15) rotate(3deg)';
    card.style.boxShadow = '0 12px 28px rgba(0,0,0,0.25)';
    card.style.transition = 'transform 0.1s, box-shadow 0.1s';
    card.classList.add('dragging');
  }

  function onMove(e) {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();

    const pos = getPos(e);
    card.style.left = (pos.x - offsetX) + 'px';
    card.style.top = (pos.y - offsetY) + 'px';

    // ドロップゾーンのハイライト
    document.querySelectorAll('.drop-zone').forEach(zone => {
      const r = zone.getBoundingClientRect();
      if (pos.x >= r.left && pos.x <= r.right && pos.y >= r.top && pos.y <= r.bottom) {
        zone.classList.add('hover-active');
      } else {
        zone.classList.remove('hover-active');
      }
    });
  }

  function onEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    card.classList.remove('dragging');

    const pos = getPos(e);
    let droppedZone = null;

    // ハイライト解除 & ドロップ先判定
    document.querySelectorAll('.drop-zone').forEach(zone => {
      zone.classList.remove('hover-active');
      const r = zone.getBoundingClientRect();
      if (pos.x >= r.left && pos.x <= r.right && pos.y >= r.top && pos.y <= r.bottom) {
        droppedZone = zone;
      }
    });

    if (droppedZone) {
      const zoneCategory = parseInt(droppedZone.dataset.category, 10);
      if (!state.scores[foodData.name]) state.scores[foodData.name] = 0;
      state.scores[foodData.name]++;

      if (zoneCategory === foodData.category) {
        // ✅ 正解！
        playSuccessSound();
        createSparkles(pos.x, pos.y);

        // プレースホルダー削除
        if (placeholder && placeholder.parentElement) {
          placeholder.remove();
        }

        // カードをゾーンに配置
        card.classList.add('placed');
        card.style.position = 'relative';
        card.style.left = 'auto';
        card.style.top = 'auto';
        card.style.width = '';
        card.style.height = '';
        card.style.zIndex = '';
        card.style.transform = 'scale(1)';
        card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        card.style.transition = '';

        // ゾーン内の配置済みアイテムエリアに追加
        const placedArea = droppedZone.querySelector('.zone-placed-items');
        if (placedArea) {
          placedArea.appendChild(card);
        } else {
          droppedZone.appendChild(card);
        }

        // チェックマーク追加
        const check = document.createElement('div');
        check.className = 'check-mark';
        check.textContent = '✓';
        card.appendChild(check);

        // バウンスアニメーション
        card.animate([
          { transform: 'scale(1)' },
          { transform: 'scale(1.3)' },
          { transform: 'scale(0.95)' },
          { transform: 'scale(1)' }
        ], { duration: 400, easing: 'ease-out' });

        state.placedItems++;

        // スコア更新
        if (window.updateScoreDisplay) {
          window.updateScoreDisplay(getScore());
        }

        // 全部配置完了？
        if (state.placedItems === state.totalItems) {
          setTimeout(() => {
            if (window.goToResults) window.goToResults();
          }, 1200);
        }
      } else {
        // ❌ 不正解
        playErrorSound();
        showHint(foodData);
        returnToOriginal();
      }
    } else {
      // ゾーン外 → 元に戻す
      returnToOriginal();
    }

    function returnToOriginal() {
      card.classList.add('error');
      card.style.position = '';
      card.style.left = '';
      card.style.top = '';
      card.style.width = '';
      card.style.height = '';
      card.style.zIndex = '';
      card.style.transform = '';
      card.style.boxShadow = '';
      card.style.transition = '';

      // プレースホルダーの位置に戻す
      if (placeholder && placeholder.parentElement) {
        placeholder.parentElement.insertBefore(card, placeholder);
        placeholder.remove();
      }

      setTimeout(() => card.classList.remove('error'), 500);
    }
  }

  // タッチイベント
  card.addEventListener('touchstart', onStart, { passive: false });
  card.addEventListener('touchmove', onMove, { passive: false });
  card.addEventListener('touchend', onEnd, { passive: false });
  card.addEventListener('touchcancel', onEnd, { passive: false });

  // マウスイベント
  card.addEventListener('mousedown', onStart);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
}

// ========== ゲーム初期化 ==========

export function initGame(foodItems) {
  state.foodItems = foodItems;
  state.scores = {};
  state.placedItems = 0;
  state.totalItems = foodItems.length;

  const container = document.getElementById('food-cards-container');
  if (!container) return;
  container.innerHTML = '';

  // ゾーン内の配置済みアイテムをクリア
  document.querySelectorAll('.zone-placed-items').forEach(el => el.innerHTML = '');

  foodItems.forEach((food, i) => {
    const card = document.createElement('div');
    card.className = 'food-card';
    card.style.animationDelay = `${i * 0.1}s`;
    card.innerHTML = `
      <div class="food-emoji">${food.emoji}</div>
      <div class="food-name">${food.name}</div>
    `;
    card.style.touchAction = 'none';

    setupDraggable(card, food);
    container.appendChild(card);
  });
}

// ========== リザルト画面 ==========

export function showResults() {
  const screen = document.getElementById('results-screen');
  if (!screen) return;

  const score = getScore();

  // 評価メッセージ
  let message, messageEmoji;
  if (score >= 90) { message = 'すごい！パーフェクト！'; messageEmoji = '🏆'; }
  else if (score >= 70) { message = 'よくできました！'; messageEmoji = '🎉'; }
  else if (score >= 50) { message = 'がんばったね！'; messageEmoji = '👍'; }
  else { message = 'もうちょっとがんばろう！'; messageEmoji = '💪'; }

  let html = `
    <div class="results-container">
      <div class="results-header">
        <div class="results-emoji">${messageEmoji}</div>
        <h2 class="results-title">${message}</h2>
        <div class="results-score">
          <span class="score-number" id="animated-score">0</span>
          <span class="score-unit">点</span>
        </div>
      </div>

      <div class="results-items">
        <h3>📋 けっか</h3>
  `;

  state.foodItems.forEach(food => {
    const attempts = state.scores[food.name] || 1;
    const stars = calculateStars(attempts);
    const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    const zoneName = ZONES[food.category]?.name || '';

    html += `
      <div class="result-item">
        <div class="result-item-emoji">${food.emoji}</div>
        <div class="result-item-info">
          <div class="result-item-name">${food.name} <span class="result-stars">${starStr}</span></div>
          <div class="result-item-zone">→ ${zoneName}</div>
          <div class="result-item-fact">💡 ${food.funFact}</div>
        </div>
      </div>
    `;
  });

  html += `
      </div>

      <div class="results-actions">
        <button id="btn-replay" class="btn btn-primary" onclick="window.playSample()">🔄 もう一回あそぶ</button>
        <button id="btn-new-photo" class="btn btn-secondary" onclick="window.openCamera()">📸 新しい写真をとる</button>
        <button id="btn-back-to-start" class="btn btn-tertiary" onclick="window.showScreen('start-screen')">🏠 はじめにもどる</button>
      </div>
    </div>
  `;

  screen.innerHTML = html;

  // スコアカウントアップアニメーション
  const scoreEl = document.getElementById('animated-score');
  if (scoreEl) {
    let current = 0;
    const interval = setInterval(() => {
      current += 2;
      if (current >= score) {
        current = score;
        clearInterval(interval);
      }
      scoreEl.textContent = current;
    }, 20);
  }
}

export function resetGame() {
  state.scores = {};
  state.placedItems = 0;
  state.totalItems = 0;
  document.querySelectorAll('.zone-placed-items').forEach(el => el.innerHTML = '');
  const container = document.getElementById('food-cards-container');
  if (container) container.innerHTML = '';
}

// ========== 動的CSS注入（スパークルアニメーション等） ==========

const dynamicStyles = document.createElement('style');
dynamicStyles.textContent = `
  @keyframes sparkle-fly {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
  }
`;
document.head.appendChild(dynamicStyles);
