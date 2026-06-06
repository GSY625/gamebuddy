import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import {
  getServerRegionFieldLabel,
  getServerRegionsForSlug,
  requiresModeAfterRegion,
  requiresServerRegionSelection,
} from '@gamebuddy/shared';
import { GameIcon } from '../components/GameIcon';
import { PageHeader } from '../components/PageHeader';
import { useOnlineGuard } from '../hooks/useOnlineGuard';

export default function GameRegionSelectPage() {
  const { id } = useParams<{ id: string }>();
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
        if (!requiresServerRegionSelection(g.slug)) {
          nav(`/games/${id}`, { replace: true });
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
  }, [id, nav]);

  const pickRegion = (region: string) => {
    if (!id || !game) return;
    const q = `region=${encodeURIComponent(region)}`;
    if (requiresModeAfterRegion(game.slug)) {
      guard(() => nav(`/games/${id}/mode?${q}`));
      return;
    }
    guard(() => nav(`/games/${id}?${q}`));
  };

  if (!game) return <div className="loading">加载中…</div>;

  const regions = getServerRegionsForSlug(game.slug);
  const regionLabel = getServerRegionFieldLabel(game.slug);
  const nextStepHint = requiresModeAfterRegion(game.slug)
    ? '选择大区后，再选择游戏模式'
    : '选择大区后，再填写搭子档案或筛选玩家';

  return (
    <div className="page-wrap page-mode-select">
      <Link to="/games" className="back-link muted">
        ← 返回游戏分区
      </Link>
      <PageHeader title={game.name} subtitle={nextStepHint} />
      <div className="mode-select-hero glass-panel">
        <GameIcon icon={game.icon} name={game.name} className="game-icon-lg" />
        <p className="mode-select-lead">请选择{regionLabel}</p>
      </div>
      <div className="mode-select-grid">
        {regions.map((region) => (
          <button
            key={region}
            type="button"
            className="mode-select-card glass-panel card-hover"
            onClick={() => pickRegion(region)}
          >
            {region}
          </button>
        ))}
      </div>
    </div>
  );
}
