import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { isLolGame, LOL_GAME_MODES } from '@gamebuddy/shared';
import { GameIcon } from '../components/GameIcon';
import { PageHeader } from '../components/PageHeader';
import { useOnlineGuard } from '../hooks/useOnlineGuard';

export default function GameModeSelectPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const regionParam = searchParams.get('region') ?? '';
  const nav = useNavigate();
  const { guard } = useOnlineGuard();
  const [game, setGame] = useState<{
    name: string;
    icon: string;
    slug: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getGameSchema(id), api.getGames()])
      .then(([schemaData, games]) => {
        const g = schemaData as { name: string; slug: string };
        if (!isLolGame(g.slug)) {
          nav(`/games/${id}`, { replace: true });
          return;
        }
        if (!regionParam) {
          nav(`/games/${id}/region`, { replace: true });
          return;
        }
        const listed = (games as Array<{ id: string; icon: string }>).find(
          (x) => x.id === id,
        );
        setGame({
          name: g.name,
          icon: listed?.icon ?? '/icons/lol.png',
          slug: g.slug,
        });
      })
      .catch(() => nav('/games', { replace: true }));
  }, [id, nav, regionParam]);

  const pickMode = (mode: string) => {
    const q = new URLSearchParams({
      region: regionParam,
      mode,
    });
    guard(() => nav(`/games/${id}?${q.toString()}`));
  };

  if (!game) return <div className="loading">加载中…</div>;

  return (
    <div className="page-wrap page-mode-select">
      <Link to={`/games/${id}/region`} className="back-link muted">
        ← 更换大区
      </Link>
      <PageHeader
        title={game.name}
        subtitle={`当前大区：${regionParam} · 选择模式后填写搭子档案或筛选玩家`}
      />
      <div className="mode-select-hero glass-panel">
        <GameIcon icon={game.icon} name={game.name} className="game-icon-lg" />
        <p className="mode-select-lead">请选择游戏模式</p>
      </div>
      <div className="mode-select-grid">
        {LOL_GAME_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className="mode-select-card glass-panel card-hover"
            onClick={() => pickMode(mode)}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}
