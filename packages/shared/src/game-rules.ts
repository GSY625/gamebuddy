import {
  GamePlatform,
  GamePlatformValue,
  RANK_NONE_OPTION,
} from './game-types';

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
