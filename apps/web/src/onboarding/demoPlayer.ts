import type { SquarePlayer } from '../components/SquarePlayerCard';

/** 新手指引最后一步的示例玩家卡片（查找无结果时展示） */
export const ONBOARDING_DEMO_PLAYER: SquarePlayer = {
  userId: '__onboarding_demo__',
  nickname: '二号测试号1',
  online: false,
  profileName: '排位搭子',
  fieldValues: {
    rank: '黄金',
    rank_division: '2',
    agent: ['捷风'],
    play_time: ['晚上'],
    mic_required: true,
    bio: '示例档案，仅供新手指引展示',
  },
};

export function isOnboardingDemoPlayer(userId: string) {
  return userId === ONBOARDING_DEMO_PLAYER.userId;
}
