import CONFIG from './config.js';

/**
 * Gemini APIと通信するモジュール
 */

/**
 * 画像を解析して食品とその栄養素カテゴリを返す
 * @param {string} base64Image - Base64エンコードされた画像データ（プレフィックスなし）
 * @param {string} mimeType - 画像のMIMEタイプ (例: 'image/jpeg')
 * @returns {Promise<Array>} - 解析された食品アイテムの配列
 */
export async function analyzeFood(base64Image, mimeType) {
  if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('APIキーが設定されていません。config.jsを確認してください。');
  }

  const url = `${CONFIG.GEMINI_ENDPOINT}/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  
  // システムプロンプト：6つの栄養素カテゴリを説明
  const prompt = `
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
小学生が理解しやすく、興味を持てるような楽しい豆知識（fun_fact）も添えてください。
`;

  // Structured Output Schema
  const schema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        name: {
          type: "STRING",
          description: "食材または料理の名前（日本語）"
        },
        category: {
          type: "INTEGER",
          description: "6つの基礎食品群のカテゴリID (1〜6)"
        },
        emoji: {
          type: "STRING",
          description: "食材を表す絵文字を1つ"
        },
        fun_fact: {
          type: "STRING",
          description: "小学生向けの楽しい豆知識や栄養に関する一言"
        }
      },
      required: ["name", "category", "emoji", "fun_fact"]
    }
  };

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: schema,
      temperature: 0.2
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API Error:', errorData);
      throw new Error(`APIリクエストに失敗しました: ${response.status}`);
    }

    const data = await response.json();
    
    // レスポンスのテキスト部分を抽出してJSONパース
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
      const jsonText = data.candidates[0].content.parts[0].text;
      const parsedData = JSON.parse(jsonText);
      return parsedData;
    } else {
      throw new Error('APIから予期しないレスポンスが返されました');
    }
  } catch (error) {
    console.error('Gemini 解析エラー:', error);
    throw error;
  }
}
