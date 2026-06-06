type Props = {
  onInvite: () => void;
  onReport: () => void;
  onBlock: () => void;
  inviteLabel?: string;
  inviteButtonId?: string;
};

/**
 * 玩家卡片上的邀约 / 举报 / 拉黑按钮，样式与游戏分区一致，供各游戏复用。
 */
export function PlayerSafetyActions({
  onInvite,
  onReport,
  onBlock,
  inviteLabel = '发起邀约',
  inviteButtonId,
}: Props) {
  return (
    <div className="actions player-safety-actions">
      <button type="button" id={inviteButtonId} onClick={onInvite}>
        {inviteLabel}
      </button>
      <button type="button" className="ghost" onClick={onReport}>
        举报
      </button>
      <button type="button" className="ghost" onClick={onBlock}>
        拉黑
      </button>
    </div>
  );
}
