export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'image'
  | 'number';

export interface FieldShowWhen {
  field: string;
  oneOf?: string[];
}

export interface GameFieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  maxImages?: number;
  placeholder?: string;
  showWhen?: FieldShowWhen;
}

export interface GameFieldSchema {
  version: number;
  fields: GameFieldDefinition[];
}

export type GamePlatform = 'pc' | 'mobile';
export type GamePlatformValue = GamePlatform | 'both';

export const RANK_NONE_OPTION = '未定级';
export const GAME_SERVER_REGION_FIELD = 'game_server_region';

export function withRankNoneOption(options: readonly string[]): string[] {
  return [RANK_NONE_OPTION, ...options];
}

export const LOL_DIVISION_TIERS = [
  '黑铁',
  '青铜',
  '白银',
  '黄金',
  '铂金',
  '翡翠',
  '钻石',
] as const;

export const LOL_LP_TIERS = ['大师', '宗师', '王者'] as const;
export const LOL_DIVISION_OPTIONS = ['IV', 'III', 'II', 'I'] as const;
export const LOL_GAME_MODES = [
  '召唤师峡谷单双排',
  '召唤师峡谷灵活组排',
  '匹配模式',
  '极地大乱斗',
  '斗魂竞技场',
  '海克斯大乱斗',
  '自定义',
] as const;
export const LOL_MODES_NO_RANK = ['极地大乱斗', '斗魂竞技场', '海克斯大乱斗'] as const;
export const LOL_RANK_FIELD_KEYS = ['rank', 'rank_division', 'rank_lp'] as const;
export const LOL_LANE_OPTIONS_RANKED = ['上单', '打野', '中单', 'ADC', '辅助'] as const;
export const LOL_LANE_OPTIONS_ARAM = ['战士', '法师', '射手', '刺客', '辅助', '前排', '后排'] as const;
export const LOL_SERVER_REGIONS = [
  '联盟一区',
  '联盟二区',
  '联盟三区',
  '联盟四区',
  '联盟五区',
  '艾欧尼亚',
  '黑色玫瑰',
  '峡谷之巅',
] as const;
export const TFT_SERVER_REGIONS = [
  '联盟一区',
  '联盟二区',
  '联盟三区',
  '联盟四区',
  '联盟五区',
  '艾欧尼亚',
  '黑色玫瑰',
] as const;

export const CF_SERVER_REGIONS = ['东部大区', '西部大区', '南部大区', '北部大区'] as const;
export const MOBILE_ACCOUNT_REGIONS = ['QQ区', '微信区'] as const;

export const VALORANT_DIVISION_TIERS = [
  '黑铁',
  '青铜',
  '白银',
  '黄金',
  '铂金',
  '钻石',
  '超凡',
  '神话',
] as const;
export const VALORANT_DIVISION_OPTIONS = ['1', '2', '3'] as const;

export const CF_DIVISION_TIERS = ['新锐', '精英', '专家', '大师', '宗师', '传奇', '枪王'] as const;
export const CF_BEAN_TIERS = ['荣耀枪王', '枪王之王'] as const;
export const CF_DIVISION_OPTIONS = ['1', '2', '3', '4', '5'] as const;

export const WZRY_DIVISION_RANKS = [
  '倔强青铜',
  '秩序白银',
  '荣耀黄金',
  '尊贵铂金',
  '永恒钻石',
  '至尊星耀',
] as const;
export const WZRY_STAR_RANKS = ['最强王者', '无双王者', '荣耀王者', '传奇王者'] as const;
export const WZRY_DIVISION_OPTIONS = ['V', 'IV', 'III', 'II', 'I'] as const;

const SERVER_REGION_GAME_SLUGS = new Set([
  'lol',
  'crossfire',
  'wzry',
  'peaceelite',
  'jcc',
  'teamfight-tactics',
]);

export function isLolGame(slug: string) {
  return slug === 'lol';
}

export function isValorantGame(slug: string) {
  return slug === 'valorant';
}

export function isCrossfireGame(slug: string) {
  return slug === 'crossfire';
}

export function isNarakaGame(slug: string) {
  return slug === 'naraka';
}

export function isWzryGame(slug: string) {
  return slug === 'wzry';
}

export function isLolModeWithoutRank(mode: string) {
  return (LOL_MODES_NO_RANK as readonly string[]).includes(mode);
}

export function requiresServerRegionSelection(slug: string) {
  return SERVER_REGION_GAME_SLUGS.has(slug);
}

export function requiresModeAfterRegion(slug: string) {
  return slug === 'lol';
}

export function getServerRegionsForSlug(slug: string): readonly string[] {
  switch (slug) {
    case 'lol':
      return LOL_SERVER_REGIONS;
    case 'teamfight-tactics':
      return TFT_SERVER_REGIONS;
    case 'crossfire':
      return CF_SERVER_REGIONS;
    case 'wzry':
    case 'peaceelite':
    case 'jcc':
      return MOBILE_ACCOUNT_REGIONS;
    default:
      return [];
  }
}

export function getServerRegionFieldLabel(slug: string): string {
  if (slug === 'lol' || slug === 'crossfire' || slug === 'teamfight-tactics') {
    return '大区';
  }
  return '区服';
}

export function getGameEntryPath(slug: string, gameId: string): string {
  if (requiresServerRegionSelection(slug)) {
    return `/games/${gameId}/region`;
  }
  return `/games/${gameId}`;
}

export function getLolLaneOptions(gameMode: string): string[] {
  return isLolModeWithoutRank(gameMode)
    ? [...LOL_LANE_OPTIONS_ARAM]
    : [...LOL_LANE_OPTIONS_RANKED];
}

export function getWzryDivisionOptions(rank: string): string[] {
  return (WZRY_DIVISION_RANKS as readonly string[]).includes(rank)
    ? [...WZRY_DIVISION_OPTIONS]
    : [];
}

export function stripLolRankFields(values: Record<string, unknown>) {
  const next = { ...values };
  for (const key of LOL_RANK_FIELD_KEYS) {
    delete next[key];
  }
  return next;
}

function isLolDivisionTier(rank: string) {
  return (LOL_DIVISION_TIERS as readonly string[]).includes(rank);
}

function isLolLpTier(rank: string) {
  return (LOL_LP_TIERS as readonly string[]).includes(rank);
}

function isValorantDivisionTier(rank: string) {
  return (VALORANT_DIVISION_TIERS as readonly string[]).includes(rank);
}

function isCrossfireDivisionTier(rank: string) {
  return (CF_DIVISION_TIERS as readonly string[]).includes(rank);
}

function isCrossfireBeanTier(rank: string) {
  return (CF_BEAN_TIERS as readonly string[]).includes(rank);
}

function isWzryDivisionTier(rank: string) {
  return (WZRY_DIVISION_RANKS as readonly string[]).includes(rank);
}

function formatLolRank(values: Record<string, unknown>) {
  const rank = String(values.rank ?? '');
  if (!rank) return '未填写';
  if (rank === RANK_NONE_OPTION) return rank;
  if (isLolDivisionTier(rank) && values.rank_division) {
    return `${rank} ${values.rank_division}`;
  }
  if (isLolLpTier(rank) && values.rank_lp != null && values.rank_lp !== '') {
    return `${rank} ${values.rank_lp} 胜点`;
  }
  return rank;
}

function formatValorantRank(values: Record<string, unknown>) {
  const rank = String(values.rank ?? '');
  if (!rank) return '未填写';
  if (rank === RANK_NONE_OPTION) return rank;
  if (isValorantDivisionTier(rank) && values.rank_division) {
    return `${rank} ${values.rank_division}`;
  }
  return rank;
}

function formatCrossfireRank(values: Record<string, unknown>) {
  const rank = String(values.rank ?? '');
  if (!rank) return '未填写';
  if (rank === RANK_NONE_OPTION) return rank;
  if (isCrossfireDivisionTier(rank) && values.rank_division) {
    return `${rank} ${values.rank_division}`;
  }
  if (isCrossfireBeanTier(rank) && values.rank_beans != null && values.rank_beans !== '') {
    return `${rank} ${values.rank_beans} 豆`;
  }
  return rank;
}

function formatWzryRank(values: Record<string, unknown>) {
  const rank = String(values.rank ?? '');
  if (!rank) return '未填写';
  if (rank === RANK_NONE_OPTION) return rank;
  if (isWzryDivisionTier(rank) && values.rank_division) {
    return `${rank} ${values.rank_division}`;
  }
  if ((WZRY_STAR_RANKS as readonly string[]).includes(rank) && values.stars != null && values.stars !== '') {
    return `${rank} ${values.stars} 星`;
  }
  return rank;
}

export function formatGameRank(slug: string, values: Record<string, unknown>) {
  if (isLolGame(slug)) return formatLolRank(values);
  if (isValorantGame(slug)) return formatValorantRank(values);
  if (isCrossfireGame(slug)) return formatCrossfireRank(values);
  if (isWzryGame(slug)) return formatWzryRank(values);

  const rank = String(values.rank ?? '');
  return rank || '未填写';
}

export function gameMatchesPlatform(
  gamePlatform: GamePlatformValue,
  activePlatform: GamePlatform,
) {
  return gamePlatform === 'both' || gamePlatform === activePlatform;
}

type GenericSchemaOptions = {
  rankOptions?: string[];
  modeOptions?: string[];
  bioPlaceholder?: string;
  roleOptions?: string[];
  screenshotsLabel?: string;
};

function buildGenericGameSchema(options: GenericSchemaOptions = {}): GameFieldSchema {
  const fields: GameFieldDefinition[] = [];

  if (options.rankOptions?.length) {
    fields.push({
      key: 'rank',
      label: '段位',
      type: 'select',
      required: true,
      options: withRankNoneOption(options.rankOptions),
    });
  }

  if (options.modeOptions?.length) {
    fields.push({
      key: 'game_mode',
      label: '常玩模式',
      type: 'multiselect',
      options: options.modeOptions,
    });
  }

  if (options.roleOptions?.length) {
    fields.push({
      key: 'role',
      label: '常玩定位',
      type: 'multiselect',
      options: options.roleOptions,
    });
  }

  fields.push(
    {
      key: 'honor_screenshot',
      label: options.screenshotsLabel ?? '战绩截图',
      type: 'image',
      maxImages: 3,
    },
    {
      key: 'play_time',
      label: '常玩时段',
      type: 'multiselect',
      options: ['上午', '下午', '晚上', '深夜'],
    },
    {
      key: 'mic_required',
      label: '是否开麦',
      type: 'boolean',
    },
    {
      key: 'bio',
      label: '搭子说明',
      type: 'textarea',
      placeholder: options.bioPlaceholder ?? '补充你的偏好、节奏和组队需求',
    },
  );

  return { version: 1, fields };
}

function buildLolSchema(): GameFieldSchema {
  return {
    version: 1,
    fields: [
      {
        key: GAME_SERVER_REGION_FIELD,
        label: '大区',
        type: 'select',
        required: true,
        options: [...LOL_SERVER_REGIONS],
      },
      {
        key: 'game_mode',
        label: '游戏模式',
        type: 'select',
        required: true,
        options: [...LOL_GAME_MODES],
      },
      {
        key: 'rank',
        label: '段位',
        type: 'select',
        required: true,
        options: withRankNoneOption([...LOL_DIVISION_TIERS, ...LOL_LP_TIERS]),
      },
      {
        key: 'rank_division',
        label: '小段位',
        type: 'select',
        required: true,
        options: [...LOL_DIVISION_OPTIONS],
        showWhen: { field: 'rank', oneOf: [...LOL_DIVISION_TIERS] },
      },
      {
        key: 'rank_lp',
        label: '胜点',
        type: 'number',
        required: true,
        placeholder: '例如 128',
        showWhen: { field: 'rank', oneOf: [...LOL_LP_TIERS] },
      },
      {
        key: 'lane',
        label: '常玩位置',
        type: 'multiselect',
        options: [...LOL_LANE_OPTIONS_RANKED],
      },
      {
        key: 'honor_screenshot',
        label: '战绩截图',
        type: 'image',
        maxImages: 3,
      },
      {
        key: 'play_time',
        label: '常玩时段',
        type: 'multiselect',
        options: ['上午', '下午', '晚上', '深夜'],
      },
      {
        key: 'mic_required',
        label: '是否开麦',
        type: 'boolean',
      },
      {
        key: 'bio',
        label: '搭子说明',
        type: 'textarea',
        placeholder: '主玩位置、英雄池、组队节奏等',
      },
    ],
  };
}

function buildTftSchema(): GameFieldSchema {
  return {
    version: 1,
    fields: [
      {
        key: GAME_SERVER_REGION_FIELD,
        label: '大区',
        type: 'select',
        required: true,
        options: [...TFT_SERVER_REGIONS],
      },
      {
        key: 'rank',
        label: '段位',
        type: 'select',
        required: true,
        options: withRankNoneOption([
          '黑铁',
          '青铜',
          '白银',
          '黄金',
          '铂金',
          '翡翠',
          '钻石',
          '大师',
          '宗师',
          '王者',
        ]),
      },
      {
        key: 'game_mode',
        label: '常玩模式',
        type: 'multiselect',
        options: ['标准排位', '双人作战', '狂暴模式', '娱乐模式'],
      },
      {
        key: 'honor_screenshot',
        label: '战绩截图',
        type: 'image',
        maxImages: 3,
      },
      {
        key: 'play_time',
        label: '常玩时段',
        type: 'multiselect',
        options: ['上午', '下午', '晚上', '深夜'],
      },
      {
        key: 'mic_required',
        label: '是否开麦',
        type: 'boolean',
      },
      {
        key: 'bio',
        label: '搭子说明',
        type: 'textarea',
        placeholder: '常玩阵容、冲分目标、是否愿意语音复盘等',
      },
    ],
  };
}

function buildValorantSchema(): GameFieldSchema {
  return {
    version: 1,
    fields: [
      {
        key: 'rank',
        label: '段位',
        type: 'select',
        required: true,
        options: withRankNoneOption([
          ...VALORANT_DIVISION_TIERS,
          '赋能',
          '不朽',
          '辐能战魂',
        ]),
      },
      {
        key: 'rank_division',
        label: '小段位',
        type: 'select',
        required: true,
        options: [...VALORANT_DIVISION_OPTIONS],
        showWhen: { field: 'rank', oneOf: [...VALORANT_DIVISION_TIERS] },
      },
      {
        key: 'role',
        label: '常玩定位',
        type: 'multiselect',
        options: ['决斗', '先锋', '控场', '哨卫', '补位'],
      },
      {
        key: 'game_mode',
        label: '常玩模式',
        type: 'multiselect',
        options: ['竞技', '超速', '乱斗', '死斗', '自定义'],
      },
      {
        key: 'honor_screenshot',
        label: '战绩截图',
        type: 'image',
        maxImages: 3,
      },
      {
        key: 'play_time',
        label: '常玩时段',
        type: 'multiselect',
        options: ['上午', '下午', '晚上', '深夜'],
      },
      {
        key: 'mic_required',
        label: '是否开麦',
        type: 'boolean',
      },
      {
        key: 'bio',
        label: '搭子说明',
        type: 'textarea',
        placeholder: '主玩英雄、报点习惯、是否冲分等',
      },
    ],
  };
}

function buildWzrySchema(): GameFieldSchema {
  return {
    version: 1,
    fields: [
      {
        key: GAME_SERVER_REGION_FIELD,
        label: '区服',
        type: 'select',
        required: true,
        options: [...MOBILE_ACCOUNT_REGIONS],
      },
      {
        key: 'rank',
        label: '段位',
        type: 'select',
        required: true,
        options: withRankNoneOption([...WZRY_DIVISION_RANKS, ...WZRY_STAR_RANKS]),
      },
      {
        key: 'rank_division',
        label: '小段位',
        type: 'select',
        required: true,
        options: [...WZRY_DIVISION_OPTIONS],
        showWhen: { field: 'rank', oneOf: [...WZRY_DIVISION_RANKS] },
      },
      {
        key: 'stars',
        label: '星数',
        type: 'number',
        required: true,
        placeholder: '例如 25',
        showWhen: { field: 'rank', oneOf: [...WZRY_STAR_RANKS] },
      },
      {
        key: 'lane',
        label: '常玩分路',
        type: 'multiselect',
        options: ['对抗路', '发育路', '中路', '打野', '游走'],
      },
      {
        key: 'honor_screenshot',
        label: '战绩截图',
        type: 'image',
        maxImages: 3,
      },
      {
        key: 'play_time',
        label: '常玩时段',
        type: 'multiselect',
        options: ['上午', '下午', '晚上', '深夜'],
      },
      {
        key: 'mic_required',
        label: '是否开麦',
        type: 'boolean',
      },
      {
        key: 'bio',
        label: '搭子说明',
        type: 'textarea',
        placeholder: '主玩英雄、补位情况、是否冲分等',
      },
    ],
  };
}

function buildCrossfireSchema(): GameFieldSchema {
  return {
    version: 1,
    fields: [
      {
        key: GAME_SERVER_REGION_FIELD,
        label: '大区',
        type: 'select',
        required: true,
        options: [...CF_SERVER_REGIONS],
      },
      {
        key: 'rank',
        label: '段位',
        type: 'select',
        required: true,
        options: withRankNoneOption([...CF_DIVISION_TIERS, ...CF_BEAN_TIERS]),
      },
      {
        key: 'rank_division',
        label: '小段位',
        type: 'select',
        required: true,
        options: [...CF_DIVISION_OPTIONS],
        showWhen: { field: 'rank', oneOf: [...CF_DIVISION_TIERS] },
      },
      {
        key: 'rank_beans',
        label: '豆数',
        type: 'number',
        required: true,
        placeholder: '例如 8',
        showWhen: { field: 'rank', oneOf: [...CF_BEAN_TIERS] },
      },
      {
        key: 'game_mode',
        label: '常玩模式',
        type: 'multiselect',
        options: ['爆破', '团队竞技', '生化', '排位', '挑战'],
      },
      {
        key: 'honor_screenshot',
        label: '战绩截图',
        type: 'image',
        maxImages: 3,
      },
      {
        key: 'play_time',
        label: '常玩时段',
        type: 'multiselect',
        options: ['上午', '下午', '晚上', '深夜'],
      },
      {
        key: 'mic_required',
        label: '是否开麦',
        type: 'boolean',
      },
      {
        key: 'bio',
        label: '搭子说明',
        type: 'textarea',
        placeholder: '主玩模式、枪法风格、配合需求等',
      },
    ],
  };
}

export const MVP_GAMES_SEED = [
  {
    slug: 'lol',
    name: '英雄联盟',
    icon: '/icons/lol.png',
    platform: 'pc' as GamePlatform,
    tags: ['MOBA', '排位', '开黑'],
    schema: buildLolSchema(),
  },
  {
    slug: 'wzry',
    name: '王者荣耀',
    icon: '/icons/wzry.png',
    platform: 'mobile' as GamePlatform,
    tags: ['MOBA', '排位', '开黑'],
    schema: buildWzrySchema(),
  },
  {
    slug: 'valorant',
    name: '无畏契约',
    icon: '/icons/valorant.png',
    platform: 'pc' as GamePlatform,
    tags: ['FPS', '排位', '开黑'],
    schema: buildValorantSchema(),
  },
  {
    slug: 'deltaforce',
    name: '三角洲行动',
    icon: '/icons/deltaforce.png',
    platform: 'pc' as GamePlatform,
    tags: ['战术射击', '夺金', '组队'],
    schema: buildGenericGameSchema({
      modeOptions: ['烽火地带', '全面战场', '排位'],
      roleOptions: ['突击', '支援', '侦察', '工程'],
      bioPlaceholder: '主玩模式、资源节奏、是否愿意指挥等',
    }),
  },
  {
    slug: 'deltaforce-mobile',
    name: '三角洲行动（手游）',
    icon: '/icons/deltaforce.png',
    platform: 'mobile' as GamePlatform,
    tags: ['战术射击', '夺金', '组队'],
    schema: buildGenericGameSchema({
      modeOptions: ['烽火地带', '全面战场', '排位'],
      roleOptions: ['突击', '支援', '侦察', '工程'],
      bioPlaceholder: '主玩模式、资源节奏、是否愿意指挥等',
    }),
  },
  {
    slug: 'hearthstone',
    name: '炉石传说',
    icon: '/icons/hearthstone.png',
    platform: 'pc' as GamePlatform,
    tags: ['卡牌', '天梯', '酒馆战棋'],
    schema: buildGenericGameSchema({
      rankOptions: ['青铜', '白银', '黄金', '铂金', '钻石', '传说'],
      modeOptions: ['标准', '狂野', '酒馆战棋', '竞技场'],
      bioPlaceholder: '主玩模式、卡组偏好、是否一起复盘等',
    }),
  },
  {
    slug: 'goosegooseduck',
    name: '鹅鸭杀',
    icon: '/icons/goosegooseduck.png',
    platform: 'mobile' as GamePlatform,
    tags: ['派对', '语音', '欢乐局'],
    schema: buildGenericGameSchema({
      modeOptions: ['经典局', '速推局', '娱乐局'],
      screenshotsLabel: '精彩截图',
      bioPlaceholder: '麦克风状态、喜欢的身份和局速偏好',
    }),
  },
  {
    slug: 'roco-kingdom',
    name: '洛克王国：世界',
    icon: '/icons/roco-kingdom.png',
    platform: 'pc' as GamePlatform,
    tags: ['养成', '探索', '休闲'],
    schema: buildGenericGameSchema({
      modeOptions: ['主线探索', '副本', '活动', '休闲社交'],
      bioPlaceholder: '常玩目标、进度阶段、组队需求等',
    }),
  },
  {
    slug: 'crossfire',
    name: '穿越火线',
    icon: '/icons/crossfire.png',
    platform: 'pc' as GamePlatform,
    tags: ['FPS', '排位', '爆破'],
    schema: buildCrossfireSchema(),
  },
  {
    slug: 'pubg',
    name: 'PUBG',
    icon: '/icons/pubg.png',
    platform: 'pc' as GamePlatform,
    tags: ['大逃杀', '四排', '冲分'],
    schema: buildGenericGameSchema({
      rankOptions: ['青铜', '白银', '黄金', '铂金', '钻石', '大师'],
      modeOptions: ['四排', '双排', '单排', '娱乐模式'],
      roleOptions: ['突击', '侦察', '指挥', '自由人'],
      bioPlaceholder: '跳点习惯、枪法风格、是否开麦等',
    }),
  },
  {
    slug: 'naraka',
    name: '永劫无间',
    icon: '/icons/naraka.png',
    platform: 'pc' as GamePlatform,
    tags: ['武侠', '大逃杀', '三排'],
    schema: buildGenericGameSchema({
      rankOptions: ['青铜', '白银', '黄金', '铂金', '陨星', '蚀月', '坠日', '无间修罗'],
      modeOptions: ['三排', '双排', '单排', '娱乐模式'],
      bioPlaceholder: '主玩英雄、振刀水平、组队节奏等',
    }),
  },
  {
    slug: 'cs2',
    name: 'CS2',
    icon: '/icons/cs2.png',
    platform: 'pc' as GamePlatform,
    tags: ['FPS', '竞技', '开黑'],
    schema: buildGenericGameSchema({
      rankOptions: ['白银', '黄金', 'AK', '老鹰', '大地球'],
      modeOptions: ['天梯', '优先', '休闲', '死斗'],
      roleOptions: ['突破', '狙击', '指挥', '补枪'],
      bioPlaceholder: '主打地图、报点习惯、是否愿意一起练道具等',
    }),
  },
  {
    slug: 'peaceelite',
    name: '和平精英',
    icon: '/icons/peaceelite.png',
    platform: 'mobile' as GamePlatform,
    tags: ['吃鸡', '四排', '冲分'],
    schema: {
      version: 1,
      fields: [
        {
          key: GAME_SERVER_REGION_FIELD,
          label: '区服',
          type: 'select',
          required: true,
          options: [...MOBILE_ACCOUNT_REGIONS],
        },
        {
          key: 'rank',
          label: '段位',
          type: 'select',
          required: true,
          options: withRankNoneOption([
            '热血青铜',
            '不屈白银',
            '英勇黄金',
            '坚韧铂金',
            '不朽星钻',
            '荣耀皇冠',
            '超级王牌',
            '无敌战神',
          ]),
        },
        {
          key: 'game_mode',
          label: '常玩模式',
          type: 'multiselect',
          options: ['经典模式', '团队竞技', '娱乐模式', '创意工坊'],
        },
        {
          key: 'honor_screenshot',
          label: '战绩截图',
          type: 'image',
          maxImages: 3,
        },
        {
          key: 'play_time',
          label: '常玩时段',
          type: 'multiselect',
          options: ['上午', '下午', '晚上', '深夜'],
        },
        {
          key: 'mic_required',
          label: '是否开麦',
          type: 'boolean',
        },
        {
          key: 'bio',
          label: '搭子说明',
          type: 'textarea',
          placeholder: '刚枪/运营风格、跳点习惯、是否娱乐等',
        },
      ],
    } as GameFieldSchema,
  },
  {
    slug: 'genshin',
    name: '原神',
    icon: '/icons/genshin.png',
    platform: 'both' as GamePlatformValue,
    tags: ['联机', '探索', '深境螺旋'],
    schema: buildGenericGameSchema({
      modeOptions: ['日常清体', '大世界探索', '周本', '活动副本'],
      bioPlaceholder: '世界等级、角色池、联机需求等',
    }),
  },
  {
    slug: 'identityv',
    name: '第五人格',
    icon: '/icons/identityv.png',
    platform: 'mobile' as GamePlatform,
    tags: ['非对称', '求生者', '监管者'],
    schema: buildGenericGameSchema({
      modeOptions: ['排位', '匹配', '五排', '娱乐模式'],
      roleOptions: ['求生者', '监管者'],
      bioPlaceholder: '主玩阵营、角色池、开麦习惯等',
    }),
  },
  {
    slug: 'jcc',
    name: '金铲铲之战',
    icon: '/icons/jcc.png',
    platform: 'mobile' as GamePlatform,
    tags: ['自走棋', '排位', '双人作战'],
    schema: {
      version: 1,
      fields: [
        {
          key: GAME_SERVER_REGION_FIELD,
          label: '区服',
          type: 'select',
          required: true,
          options: [...MOBILE_ACCOUNT_REGIONS],
        },
        {
          key: 'rank',
          label: '段位',
          type: 'select',
          required: true,
          options: withRankNoneOption([
            '黑铁',
            '青铜',
            '白银',
            '黄金',
            '铂金',
            '翡翠',
            '钻石',
            '大师',
            '宗师',
            '王者',
          ]),
        },
        {
          key: 'game_mode',
          label: '常玩模式',
          type: 'multiselect',
          options: ['标准排位', '双人作战', '狂暴模式', '娱乐模式'],
        },
        {
          key: 'honor_screenshot',
          label: '战绩截图',
          type: 'image',
          maxImages: 3,
        },
        {
          key: 'play_time',
          label: '常玩时段',
          type: 'multiselect',
          options: ['上午', '下午', '晚上', '深夜'],
        },
        {
          key: 'mic_required',
          label: '是否开麦',
          type: 'boolean',
        },
        {
          key: 'bio',
          label: '搭子说明',
          type: 'textarea',
          placeholder: '常玩阵容、冲分目标、是否双排冲杯等',
        },
      ],
    } as GameFieldSchema,
  },
  {
    slug: 'marvel-rivals',
    name: '漫威争锋',
    icon: '/icons/marvel-rivals-yellow.jpg',
    platform: 'pc' as GamePlatform,
    tags: ['英雄射击', '排位', '开黑'],
    schema: buildGenericGameSchema({
      rankOptions: ['青铜', '白银', '黄金', '铂金', '钻石', '大师', '宗师', '永恒'],
      modeOptions: ['快速比赛', '竞技模式', '自定义'],
      roleOptions: ['先锋', '决斗', '策略'],
      bioPlaceholder: '主玩英雄、补位意愿、开麦习惯等',
    }),
  },
  {
    slug: 'teamfight-tactics',
    name: '英雄联盟（云顶之弈）',
    icon: '/icons/lol.png',
    platform: 'both' as GamePlatformValue,
    tags: ['云顶之弈', '排位', '双人作战'],
    schema: buildTftSchema(),
  },
  {
    slug: 'honkai-star-rail',
    name: '崩坏：星穹铁道',
    icon: '/icons/honkai-star-rail.png',
    platform: 'both' as GamePlatformValue,
    tags: ['养成', '日常', '攻略'],
    schema: buildGenericGameSchema({
      modeOptions: ['日常清体', '模拟宇宙', '忘却之庭', '活动副本'],
      bioPlaceholder: '主练体系、活动进度、互相交流需求等',
    }),
  },
  {
    slug: 'zenless-zone-zero',
    name: '绝区零',
    icon: '/icons/zenless-zone-zero.png',
    platform: 'both' as GamePlatformValue,
    tags: ['动作', '副本', '攻略'],
    schema: buildGenericGameSchema({
      modeOptions: ['日常体力', '活动副本', '零号空洞', '剧情交流'],
      bioPlaceholder: '主玩角色、练度阶段、联机交流需求等',
    }),
  },
  {
    slug: 'dead-by-daylight',
    name: '黎明杀机',
    icon: '/icons/dead-by-daylight.png',
    platform: 'pc' as GamePlatform,
    tags: ['非对称', '求生者', '监管者'],
    schema: buildGenericGameSchema({
      modeOptions: ['求生者', '监管者', '自定义房间'],
      roleOptions: ['求生者', '监管者'],
      bioPlaceholder: '主玩阵营、常用角色、是否愿意娱乐整活等',
    }),
  },
] as const;
