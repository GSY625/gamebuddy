import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import type { GamePlatform, GamePlatformValue } from '@gamebuddy/shared';
import { gameMatchesPlatform, getGameEntryPath } from '@gamebuddy/shared';

import { api } from '@gamebuddy/api-client';

import { EmptyState } from '../components/EmptyState';
import { GameIcon } from '../components/GameIcon';
import { OnboardingSpotlight } from '../components/OnboardingSpotlight';
import { PageHeader } from '../components/PageHeader';
import { useOnlineGuard } from '../hooks/useOnlineGuard';

type Game = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  platform: GamePlatformValue;
  tags: string[];
};

export default function GamesPage() {
  const nav = useNavigate();
  const { guard } = useOnlineGuard();
  const [games, setGames] = useState<Game[]>([]);
  const [platform, setPlatform] = useState<GamePlatform>('pc');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    api.getGames().then(setGames);
  }, []);

  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return games
      .filter((g) => gameMatchesPlatform(g.platform, platform))
      .filter(
        (g) =>
          !q ||
          g.name.toLowerCase().includes(q) ||
          g.slug.toLowerCase().includes(q) ||
          g.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
  }, [games, platform, searchQuery]);

  return (
    <div className="page-wrap">
      <OnboardingSpotlight
        stepId="games-select"
        selector="#onboarding-games-select"
      />

      <PageHeader
        title="选择游戏分区"
        subtitle="完善档案后即可发布找搭子，或筛选在线玩家一起开黑"
      />

      <div className="onboarding-games-section" id="onboarding-games-select">
        <div className="platform-filter">
          <div className="chip-group" role="group" aria-label="游戏平台">
            <button
              type="button"
              className={`chip ${platform === 'pc' ? 'active' : ''}`}
              onClick={() => setPlatform('pc')}
            >
              端游
            </button>
            <button
              type="button"
              className={`chip ${platform === 'mobile' ? 'active' : ''}`}
              onClick={() => setPlatform('mobile')}
            >
              手游
            </button>
          </div>

          <div className="games-search">
            <input
              type="search"
              className="input-themed games-search-input"
              placeholder="搜索游戏名称、别名或标签"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="搜索游戏"
            />
          </div>
        </div>

        {filteredGames.length === 0 ? (
          <EmptyState
            variant="search"
            title={searchQuery.trim() ? '没有找到匹配的游戏' : '暂无游戏'}
            description={
              searchQuery.trim()
                ? `没有搜索到“${searchQuery.trim()}”相关结果，试试别的关键词`
                : '当前平台下还没有可用游戏'
            }
          />
        ) : (
          <div className="game-grid">
            {filteredGames.map((g) => (
              <Link
                key={g.id}
                to={getGameEntryPath(g.slug, g.id)}
                className="game-card glass-panel card-hover"
                onClick={(e) => {
                  e.preventDefault();
                  guard(() => {
                    nav(getGameEntryPath(g.slug, g.id));
                  });
                }}
              >
                <GameIcon icon={g.icon} name={g.name} />
                <h2>{g.name}</h2>
                <div className="tags">
                  {g.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
