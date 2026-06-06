export const ONBOARDING_VERSION = 1;

export const ONBOARDING_STORAGE_KEYS = {
  version: 'gb_onboarding_version',
  active: 'gb_onboarding_active',
  step: 'gb_onboarding_step',
  valorantGameId: 'gb_onboarding_valorant_id',
} as const;

export const ONBOARDING_STEPS = [
  'games-select',
  'valorant-create',
  'valorant-saved',
  'valorant-browse-search',
  'valorant-browse-invite',
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export const VALORANT_SLUG = 'valorant';

export const ONBOARDING_COPY: Record<
  OnboardingStepId,
  { title?: string; description: string }
> = {
  'games-select': {
    title: '游戏分区',
    description: '选择您想玩的游戏',
  },
  'valorant-create': {
    title: '新建搭子档案',
    description: '以无畏契约为例，您可完善自己的搭子档案。',
  },
  'valorant-saved': {
    title: '我的搭子档案',
    description: '已保存的档案在这里。',
  },
  'valorant-browse-search': {
    title: '广场',
    description: '点击查找可寻找其他用户已发布的档案',
  },
  'valorant-browse-invite': {
    title: '发起邀约',
    description: '可向其他玩家发起邀约，成功即可进入聊天室！',
  },
};
