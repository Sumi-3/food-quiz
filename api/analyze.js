/**
 * Gemini API プロキシ（Vercel Edge Function）
 *
 * APIキーをブラウザに出さないため、画像解析は必ずこのエンドポイント経由で行う。
 * リクエスト: POST { base64Image: string, mimeType: string }
 * レスポンス: 200 { items: Array<{ name, category, emoji, fun_fact }> }
 */

export const config = {
  runtime: 'edge',
};

// モデルが廃止されたら環境変数 GEMINI_MODEL で差し替えられるようにしておく
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BASE64_LENGTH = 5_000_000; // Base64で約5MB（実画像で約3.7MB）まで
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 15;

// ベストエフォートのレート制限。Edgeのisolateごとのメモリなので厳密ではないが、
// 素朴な連打や自動収集は弾ける。
const requestLog = new Map();

const PROMPT = `
あなたは小学生向けの食育アシスタントです。
画像に写っている食べ物や料理を特定し、それに含まれる主な食材を日本の「6つの基礎食品群」に基づいて分類してください。

【6つの基礎食品群（カテゴリID）】
1: 炭水化物（ごはん、パン、麺類、いも、砂糖など）- 主にエネルギーになる
2: 脂質（油、バター、マヨネーズなど）- 主にエネルギーになる
3: たんぱく質（肉、魚、卵、大豆製品など）- 主に体をつくる
4: 無機質/ミネラル（牛乳、乳製品、小魚、海藻など）- 主に体をつくる（骨や歯）
5: 緑黄色野菜（にんじん、ほうれん草、トマト、かぼちゃ等）- 主に体の調子を整える
6: その他の野菜・果物・きのこ（キャベツ、玉ねぎ、きのこ、りんご等）- 主に体の調子を整える

画像内の食材をできるだけ細かく特定してください（例：カレーライスなら「ごはん(1)」「豚肉(3)」「にんじん(5)」「じゃがいも(1)」など）。
食材は多くても8個までにしぼってください。
小学生が理解しやすく、興味を持てるような楽しい豆知識（fun_fact）も添えてください。
`;

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      name: { type: 'STRING', description: '食材または料理の名前（日本語）' },
      category: { type: 'INTEGER', description: '6つの基礎食品群のカテゴリID (1〜6)' },
      emoji: { type: 'STRING', description: '食材を表す絵文字を1つ' },
      fun_fact: { type: 'STRING', description: '小学生向けの楽しい豆知識や栄養に関する一言' },
    },
    required: ['name', 'category', 'emoji', 'fun_fact'],
  },
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * ブラウザは GET/HEAD 以外のリクエストに必ず Origin を付けるため、
 * Origin が無い＝ページ以外からの直接呼び出しとみなして拒否する。
 */
function isAllowedOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return false;

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const selfHost = req.headers.get('x-forwarded-host') || new URL(req.url).host;
  if (originHost === selfHost) return true;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(originHost)) return true;

  // 独自ドメインなどを追加したい場合は環境変数 ALLOWED_ORIGINS にカンマ区切りで指定
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return extra.includes(origin) || extra.includes(originHost);
}

function isRateLimited(req) {
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const hits = (requestLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  hits.push(now);
  requestLog.set(ip, hits);

  // 古いエントリを掃除してMapが際限なく育つのを防ぐ
  if (requestLog.size > 1000) {
    for (const [key, times] of requestLog) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) requestLog.delete(key);
    }
  }

  return hits.length > RATE_LIMIT_MAX_REQUESTS;
}

/** Geminiの応答から食材配列を取り出して形を検証する */
function extractItems(data) {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') return null;

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  return parsed
    .filter((item) => item && typeof item.name === 'string' && item.name.trim() !== '')
    .map((item) => ({
      name: String(item.name).slice(0, 40),
      category: Number.isInteger(item.category) ? item.category : null,
      emoji: typeof item.emoji === 'string' ? item.emoji.slice(0, 8) : '🍽️',
      fun_fact: typeof item.fun_fact === 'string' ? item.fun_fact.slice(0, 200) : '',
    }));
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }
  if (!isAllowedOrigin(req)) {
    return json({ error: 'Forbidden' }, 403);
  }
  if (isRateLimited(req)) {
    return json({ error: 'リクエストが多すぎます。少し待ってからもう一度ためしてね。' }, 429);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    return json({ error: 'Server is not configured' }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { base64Image, mimeType } = body || {};
  if (typeof base64Image !== 'string' || typeof mimeType !== 'string') {
    return json({ error: 'Missing image data' }, 400);
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return json({ error: 'Unsupported image type' }, 415);
  }
  if (base64Image.length > MAX_BASE64_LENGTH) {
    return json({ error: 'Image is too large' }, 413);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const requestBody = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.error('Google API Error:', response.status, details);
      // 上流のステータスをそのまま返すとキー起因の問題が露出するので502に丸める
      return json({ error: 'Analysis failed' }, 502);
    }

    const items = extractItems(await response.json());
    if (!items) {
      return json({ error: 'Unexpected response from the model' }, 502);
    }

    return json({ items }, 200);
  } catch (error) {
    console.error('Function error:', error);
    return json({ error: 'Internal Server Error' }, 500);
  }
}
