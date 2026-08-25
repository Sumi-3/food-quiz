/**
 * 画像解析APIと通信するモジュール
 *
 * APIキーはサーバー側（api/analyze.js）だけが持つ。
 * ブラウザは自分のオリジンの /api/analyze を呼ぶだけで、キーには一切触れない。
 */

const ANALYZE_ENDPOINT = '/api/analyze';

/**
 * 画像を解析して食品とその栄養素カテゴリを返す
 * @param {string} base64Image - Base64エンコードされた画像データ（プレフィックスなし）
 * @param {string} mimeType - 画像のMIMEタイプ (例: 'image/jpeg')
 * @returns {Promise<Array<{name: string, category: number|null, emoji: string, fun_fact: string}>>}
 */
export async function analyzeFood(base64Image, mimeType) {
  let response;
  try {
    response = await fetch(ANALYZE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image, mimeType }),
    });
  } catch (err) {
    console.error('解析リクエストの送信に失敗:', err);
    throw new Error('ネットワークに接続できませんでした');
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    console.error('解析APIエラー:', response.status, detail);
    throw new Error(detail.error || `解析に失敗しました (${response.status})`);
  }

  const data = await response.json();
  if (!Array.isArray(data.items)) {
    throw new Error('APIから予期しないレスポンスが返されました');
  }
  return data.items;
}
