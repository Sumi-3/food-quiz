/**
 * えいようクイズ - メインアプリケーション
 * 画面遷移、カメラ連携、Gemini API、ゲーム初期化を統合管理
 */

import { Camera } from './camera.js';
import { analyzeFood } from './gemini.js';
import { initGame, getScore, showResults, resetGame } from './game.js';
import { NUTRIENT_CATEGORIES } from './nutrients.js';

// ========== 画面遷移 ==========

const screens = ['start-screen', 'camera-screen', 'loading-screen', 'game-screen', 'results-screen'];

/**
 * 画面を切り替える
 */
function showScreen(screenId) {
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('active', id === screenId);
    }
  });
}

// グローバルに公開（HTML の onclick から呼べるように）
window.showScreen = showScreen;

// ========== カメラ管理 ==========

let camera = null;
let capturedImage = null; // { base64, blob, mimeType }

/**
 * カメラ画面を開いてカメラを起動
 */
async function openCamera() {
  showScreen('camera-screen');

  const videoEl = document.getElementById('camera-video');
  if (!videoEl) return;

  camera = new Camera(videoEl);
  try {
    await camera.start();
  } catch (err) {
    alert('カメラを起動できませんでした。\nカメラの許可を確認してください。');
    showScreen('start-screen');
  }
}

/**
 * シャッターを押して撮影 → 解析へ
 */
async function capturePhoto() {
  if (!camera) return;

  try {
    capturedImage = await camera.capture();
    camera.stop();

    // 撮影した写真をプレビュー表示
    const preview = document.getElementById('captured-preview');
    if (preview) {
      preview.src = `data:${capturedImage.mimeType};base64,${capturedImage.base64}`;
      preview.style.display = 'block';
    }

    // 解析開始
    await startAnalysis(capturedImage.base64, capturedImage.mimeType);
  } catch (err) {
    console.error('撮影エラー:', err);
    alert('写真の撮影に失敗しました。もう一度試してください。');
  }
}

/**
 * カメラ画面を閉じてスタートに戻る
 */
function closeCamera() {
  if (camera) {
    camera.stop();
    camera = null;
  }
  showScreen('start-screen');
}

// ========== Gemini API 解析 ==========

/**
 * 食べ物画像をGemini APIで解析する
 */
async function startAnalysis(base64Image, mimeType) {
  showScreen('loading-screen');

  // ローディングアニメーションの食材を動かす
  animateLoading();

  try {
    const foodItems = await analyzeFood(base64Image, mimeType);

    if (!foodItems || foodItems.length === 0) {
      alert('食べ物が見つかりませんでした。\nもう一度撮影してみてください。');
      showScreen('start-screen');
      return;
    }

    // fun_fact を funFact に変換（API応答のスネークケース→キャメルケース）
    const normalizedItems = foodItems.map(item => ({
      name: item.name,
      category: item.category,
      emoji: item.emoji,
      funFact: item.fun_fact || item.funFact || `${item.name}は栄養たっぷり！`
    }));

    startGame(normalizedItems);
  } catch (err) {
    console.error('解析エラー:', err);

    if (err.message.includes('APIキーが設定されていません')) {
      alert('APIキーが設定されていません。\njs/config.js を開いて、GEMINI_API_KEY にキーを貼り付けてください。');
    } else {
      alert('解析に失敗しました。サンプルデータで遊びましょう！');
      startGame(getSampleFoodItems());
    }
  }
}

// ========== サンプルデータ ==========

/**
 * カメラやAPIが使えない場合のサンプル食材データ
 */
function getSampleFoodItems() {
  return [
    { name: 'ごはん', category: 1, emoji: '🍚', funFact: 'ごはんは日本人のエネルギーのもと！お茶碗1杯で約230kcalだよ。' },
    { name: 'さけ', category: 3, emoji: '🐟', funFact: 'さけにはDHAがたくさん！頭がよくなるといわれているよ。' },
    { name: 'にんじん', category: 5, emoji: '🥕', funFact: 'にんじんのオレンジ色はβ-カロテン！目にいいんだよ。' },
    { name: 'たまねぎ', category: 6, emoji: '🧅', funFact: 'たまねぎを切ると涙が出るのは、硫化アリルという成分のせいだよ。' },
    { name: '牛乳', category: 4, emoji: '🥛', funFact: '牛乳にはカルシウムがたっぷり！骨や歯を強くするよ。' },
    { name: 'バター', category: 2, emoji: '🧈', funFact: 'バターは牛乳から作られるよ。エネルギーがたくさん！' },
    { name: 'ほうれん草', category: 5, emoji: '🥬', funFact: 'ほうれん草には鉄分がいっぱい！ポパイも大好きだったね。' },
    { name: 'じゃがいも', category: 1, emoji: '🥔', funFact: 'じゃがいもはビタミンCも含んでいるよ。フライドポテトの材料だね！' },
  ];
}

// ========== ゲーム制御 ==========

/**
 * ゲームを開始する
 */
function startGame(foodItems) {
  showScreen('game-screen');
  resetGame();
  initGame(foodItems);
  updateScoreDisplay(0);
}

/**
 * スコア表示を更新
 */
function updateScoreDisplay(score) {
  const scoreBoard = document.getElementById('score-board');
  if (scoreBoard) {
    scoreBoard.textContent = `⭐ スコア: ${score}点`;
  }
}

/**
 * ゲーム終了 → 結果画面へ遷移
 */
function goToResults() {
  const score = getScore();
  showScreen('results-screen');
  showResults();
}

// ========== ローディングアニメーション ==========

const loadingEmojis = ['🍎', '🍊', '🥦', '🍗', '🥛', '🍙', '🥕', '🐟', '🧈', '🥬'];

function animateLoading() {
  const container = document.getElementById('loading-emojis');
  if (!container) return;

  let index = 0;
  const interval = setInterval(() => {
    if (!document.getElementById('loading-screen').classList.contains('active')) {
      clearInterval(interval);
      return;
    }
    container.innerHTML = loadingEmojis.slice(index % loadingEmojis.length, (index % loadingEmojis.length) + 3)
      .map((e, i) => `<span style="animation-delay: ${i * 0.2}s">${e}</span>`).join('');
    index++;
  }, 1500);
}

// ========== サンプルで遊ぶ ==========

function playSample() {
  showScreen('loading-screen');
  animateLoading();

  // サンプルデータで少し待ってからゲーム開始（ローディング演出）
  setTimeout(() => {
    startGame(getSampleFoodItems());
  }, 1500);
}

// ========== イベントリスナー ==========

document.addEventListener('DOMContentLoaded', () => {
  // スタート画面のボタン
  const cameraBtn = document.getElementById('btn-camera');
  if (cameraBtn) {
    cameraBtn.addEventListener('click', openCamera);
  }

  const sampleBtn = document.getElementById('btn-sample');
  if (sampleBtn) {
    sampleBtn.addEventListener('click', playSample);
  }

  // カメラ画面のボタン
  const shutterBtn = document.getElementById('shutter-btn');
  if (shutterBtn) {
    shutterBtn.addEventListener('click', capturePhoto);
  }

  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', closeCamera);
  }

  // 結果画面のボタン
  const replayBtn = document.getElementById('btn-replay');
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      startGame(getSampleFoodItems());
    });
  }

  const newPhotoBtn = document.getElementById('btn-new-photo');
  if (newPhotoBtn) {
    newPhotoBtn.addEventListener('click', openCamera);
  }

  const backToStartBtn = document.getElementById('btn-back-to-start');
  if (backToStartBtn) {
    backToStartBtn.addEventListener('click', () => showScreen('start-screen'));
  }
});

// グローバルに公開（game.jsから呼べるように）
window.goToResults = goToResults;
window.updateScoreDisplay = updateScoreDisplay;
window.playSample = playSample;
window.openCamera = openCamera;
