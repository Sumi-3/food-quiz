/**
 * 栄養素グループ（3色）の定義
 */
export const NUTRIENT_GROUPS = {
  energy: { id: 'energy', name: 'エネルギーのもとになる', color: 'yellow', colorHex: '#FEE08B' },
  body: { id: 'body', name: '体をつくるもとになる', color: 'pink', colorHex: '#F4A582' },
  condition: { id: 'condition', name: '体の調子を整えるもとになる', color: 'green', colorHex: '#A6D96A' }
};

/**
 * 6つの基礎食品群の定義
 */
export const NUTRIENT_CATEGORIES = [
  {
    id: 1,
    name: '炭水化物を多く含む食品',
    nameShort: '炭水化物',
    group: 'energy',
    color: 'yellow',
    colorHex: '#FEE08B',
    description: '主に力や体温になる食品',
    exampleFoods: ['ごはん', 'パン', 'めん類', 'いも類', '砂糖']
  },
  {
    id: 2,
    name: '脂質を多く含む食品',
    nameShort: '脂質',
    group: 'energy',
    color: 'yellow',
    colorHex: '#FEE08B',
    description: '力や体温になる食品（とりすぎ注意）',
    exampleFoods: ['油', 'バター', 'マヨネーズ', 'ドレッシング']
  },
  {
    id: 3,
    name: 'たんぱく質を多く含む食品',
    nameShort: 'たんぱく質',
    group: 'body',
    color: 'pink',
    colorHex: '#F4A582',
    description: '主に筋肉や血になる食品',
    exampleFoods: ['肉', '魚', '卵', '大豆', '大豆製品']
  },
  {
    id: 4,
    name: '無機質（ミネラル）を多く含む食品',
    nameShort: 'ミネラル',
    group: 'body',
    color: 'pink',
    colorHex: '#F4A582',
    description: '主に骨や歯になる食品',
    exampleFoods: ['牛乳', '乳製品', '小魚', '海藻']
  },
  {
    id: 5,
    name: 'カロテンを多く含む野菜（緑黄色野菜）',
    nameShort: '緑黄色野菜',
    group: 'condition',
    color: 'green',
    colorHex: '#A6D96A',
    description: '体の調子を整える緑黄色野菜',
    exampleFoods: ['にんじん', 'ほうれん草', 'トマト', 'ピーマン', 'かぼちゃ']
  },
  {
    id: 6,
    name: 'ビタミンCなどを多く含む野菜・きのこ・果物',
    nameShort: 'その他の野菜・果物',
    group: 'condition',
    color: 'green',
    colorHex: '#A6D96A',
    description: '体の調子を整えるその他の野菜や果物',
    exampleFoods: ['キャベツ', '玉ねぎ', 'きのこ類', 'みかん', 'りんご']
  }
];

// 食材分類の簡易辞書（Fallback用）
const foodDictionary = {
  // グループ1: 炭水化物
  'ごはん': 1, 'お米': 1, 'パン': 1, '食パン': 1, 'うどん': 1, 'そば': 1, 'パスタ': 1, 'ラーメン': 1,
  'じゃがいも': 1, 'さつまいも': 1, 'さといも': 1, '砂糖': 1, 'はちみつ': 1, 'もち': 1,
  
  // グループ2: 脂質
  'サラダ油': 2, 'ごま油': 2, 'オリーブオイル': 2, 'バター': 2, 'マーガリン': 2, 'マヨネーズ': 2,
  
  // グループ3: たんぱく質
  '豚肉': 3, '牛肉': 3, '鶏肉': 3, 'ウインナー': 3, 'ハム': 3, 
  '鮭': 3, 'まぐろ': 3, 'さば': 3, 'えび': 3, 'いか': 3, 'ちくわ': 3, 'かまぼこ': 3,
  '卵': 3, 'ゆで卵': 3, '目玉焼き': 3, 
  '豆腐': 3, '納豆': 3, '油揚げ': 3, 'きな粉': 3,
  
  // グループ4: 無機質（ミネラル）
  '牛乳': 4, 'チーズ': 4, 'ヨーグルト': 4, 
  'しらす': 4, 'にぼし': 4, 
  'わかめ': 4, 'こんぶ': 4, 'のり': 4, 'ひじき': 4,
  
  // グループ5: 緑黄色野菜
  'にんじん': 5, 'ほうれん草': 5, 'トマト': 5, 'ピーマン': 5, 'かぼちゃ': 5, 
  'ブロッコリー': 5, '小松菜': 5, 'アスパラガス': 5, 'オクラ': 5, 'ニラ': 5,
  
  // グループ6: その他の野菜・果物・きのこ
  'キャベツ': 6, '玉ねぎ': 6, '大根': 6, '白菜': 6, 'レタス': 6, 'きゅうり': 6, 'なす': 6, 'もやし': 6,
  'しいたけ': 6, 'しめじ': 6, 'えのき': 6, 'エリンギ': 6,
  'りんご': 6, 'みかん': 6, 'バナナ': 6, 'いちご': 6, 'ぶどう': 6, 'スイカ': 6
};

/**
 * 食材名から1〜6のカテゴリIDを判定するヘルパー関数
 * @param {string} foodName - 食材名
 * @returns {number|null} - カテゴリID (1-6) または見つからない場合は null
 */
export function classifyFood(foodName) {
  // 厳密な一致で検索
  if (foodDictionary[foodName]) {
    return foodDictionary[foodName];
  }
  
  // 部分一致で検索（簡易的）
  for (const [key, value] of Object.entries(foodDictionary)) {
    if (foodName.includes(key) || key.includes(foodName)) {
      return value;
    }
  }
  
  return null;
}
