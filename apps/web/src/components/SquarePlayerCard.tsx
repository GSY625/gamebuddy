import type { GameFieldSchema } from '@gamebuddy/shared';
import { UserAvatarLink } from './UserAvatarLink';
import { ProfileFieldsDisplay } from './ProfileFieldsDisplay';
import { PlayerSafetyActions } from './PlayerSafetyActions';

export type SquarePlayer = {
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
  isVip?: boolean;
  fieldValues: Record<string, unknown>;
  profileName?: string;
  online: boolean;
};

type Props = {
  player: SquarePlayer;
  schema: GameFieldSchema;
  gameSlug: string;
  hideGameMode?: boolean;
  hideServerRegion?: boolean;
  cardId?: string;
  inviteButtonId?: string;
  onInvite: () => void;
  onReport: () => void;
  onBlock: () => void;
};

export function SquarePlayerCard({
  player,
  schema,
  gameSlug,
  hideGameMode,
  hideServerRegion,
  cardId,
  inviteButtonId,
  onInvite,
  onReport,
  onBlock,
}: Props) {
  return (
    <li
      id={cardId}
      className="player-card square-player-card glass-panel"
    >
      <div className="square-player-header">
        <UserAvatarLink
          userId={player.userId}
          url={player.avatarUrl}
          name={player.nickname}
          size={52}
          status={player.online ? 'online' : 'invisible'}
        />
        <div className="square-player-meta">
          <div className="square-player-name-row">
            <strong className="square-player-nickname">{player.nickname}</strong>
            {player.isVip && <span className="vip-badge">VIP</span>}
            <span
              className={`square-player-status ${player.online ? 'online' : ''}`}
            >
              {player.online ? '在线' : '离线'}
            </span>
          </div>
          {player.profileName && (
            <p className="square-player-scheme">{player.profileName}</p>
          )}
        </div>
      </div>

      <ProfileFieldsDisplay
        schema={schema}
        fieldValues={player.fieldValues}
        gameSlug={gameSlug}
        hideGameMode={hideGameMode}
        hideServerRegion={hideServerRegion}
      />

      <PlayerSafetyActions
        inviteButtonId={inviteButtonId}
        onInvite={onInvite}
        onReport={onReport}
        onBlock={onBlock}
      />
    </li>
  );
}
