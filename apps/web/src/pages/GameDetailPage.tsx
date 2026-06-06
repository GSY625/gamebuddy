import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import type { GameFieldSchema } from '@gamebuddy/shared';
import {
  GAME_SERVER_REGION_FIELD,
  getServerRegionFieldLabel,
  isLolGame,
  isLolModeWithoutRank,
  requiresServerRegionSelection,
} from '@gamebuddy/shared';
import { ThemeSelect } from '../components/ThemeSelect';
import { DynamicProfileForm } from '../components/DynamicProfileForm';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import {
  SavedProfilesList,
  type SavedProfile,
} from '../components/SavedProfilesList';
import { useOnlineGuard } from '../hooks/useOnlineGuard';
import { usePlayerSafety } from '../hooks/usePlayerSafety';
import {
  SquarePlayerCard,
  type SquarePlayer,
} from '../components/SquarePlayerCard';
import { OnboardingSpotlight } from '../components/OnboardingSpotlight';
import { useOnboarding } from '../context/OnboardingContext';
import type { OnboardingStepId } from '../onboarding/constants';
import {
  isOnboardingDemoPlayer,
  ONBOARDING_DEMO_PLAYER,
} from '../onboarding/demoPlayer';

type Tab = 'create' | 'browse' | 'saved';

function onboardingTabForStep(step: OnboardingStepId): Tab | null {
  switch (step) {
    case 'valorant-create':
      return 'create';
    case 'valorant-saved':
      return 'saved';
    case 'valorant-browse-search':
    case 'valorant-browse-invite':
      return 'browse';
    default:
      return null;
  }
}

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const modeParam = searchParams.get('mode') ?? '';
  const regionParam = searchParams.get('region') ?? '';
  const { guard } = useOnlineGuard();
  const safety = usePlayerSafety();
  const { active: onboardingActive, step: onboardingStep } = useOnboarding();
  const isOnboardingValorant =
    onboardingActive &&
    onboardingStep !== null &&
    onboardingStep !== 'games-select';

  const [schema, setSchema] = useState<GameFieldSchema | null>(null);
  const [gameName, setGameName] = useState('');
  const [gameSlug, setGameSlug] = useState('');
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [players, setPlayers] = useState<SquarePlayer[]>([]);
  const [rankFilter, setRankFilter] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<Tab>('create');
  const [formResetKey, setFormResetKey] = useState(0);
  const [editingProfile, setEditingProfile] = useState<SavedProfile | null>(null);
  const onboardingInviteSearchRef = useRef(false);

  const isLol = isLolGame(gameSlug);
  const needsRegion = requiresServerRegionSelection(gameSlug);
  const lockedRegion =
    needsRegion && regionParam ? regionParam : '';
  const lockedMode = isLol && modeParam ? modeParam : '';
  const rankDisabled = Boolean(lockedMode && isLolModeWithoutRank(lockedMode));
  const hasRankField = Boolean(
    schema?.fields.some((f) => f.key === 'rank' && f.options?.length),
  );
  const hideGameModeInCard = Boolean(lockedMode);
  const hideServerRegionInCard = Boolean(lockedRegion);

  useEffect(() => {
    if (rankDisabled) {
      setRankFilter('');
    }
  }, [rankDisabled, lockedMode]);

  const loadSaved = useCallback(async () => {
    if (!id) return;
    const list = (await api.listMyProfiles(id)) as SavedProfile[];
    setSavedProfiles(list);
  }, [id]);

  const runSearch = useCallback(async () => {
    if (!id) return;
    setSearching(true);
    try {
      const list = (await api.searchProfiles(id, {
        rank: rankDisabled ? undefined : rankFilter || undefined,
        mode: lockedMode || undefined,
        region: lockedRegion || undefined,
      })) as typeof players;
      setPlayers(list);
      setHasSearched(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '查找失败');
    } finally {
      setSearching(false);
    }
  }, [id, rankFilter, lockedMode, lockedRegion, rankDisabled]);

  const load = useCallback(async () => {
    if (!id) return;
    const data = (await api.getGameSchema(id)) as {
      name: string;
      slug: string;
      schema: GameFieldSchema;
    };
    setGameName(data.name);
    setGameSlug(data.slug);
    setSchema(data.schema);

    if (requiresServerRegionSelection(data.slug) && !regionParam) {
      nav(`/games/${id}/region`, { replace: true });
      return;
    }

    if (isLolGame(data.slug) && !modeParam) {
      const q = regionParam
        ? `?region=${encodeURIComponent(regionParam)}`
        : '';
      nav(`/games/${id}/mode${q}`, { replace: true });
      return;
    }

    await loadSaved();
  }, [id, modeParam, regionParam, nav, loadSaved]);

  useEffect(() => {
    load();
  }, [load]);

  const forcedOnboardingTab =
    isOnboardingValorant && onboardingStep
      ? onboardingTabForStep(onboardingStep)
      : null;
  const activeTab = forcedOnboardingTab ?? tab;

  useEffect(() => {
    if (onboardingStep === 'valorant-saved') {
      setEditingProfile(null);
    }
  }, [onboardingStep]);

  const handleBrowseSearchBeforeNext = useCallback(async () => {
    if (!hasSearched) {
      await runSearch();
    }
  }, [hasSearched, runSearch]);

  useEffect(() => {
    if (onboardingStep !== 'valorant-browse-invite') {
      onboardingInviteSearchRef.current = false;
      return;
    }
    if (
      !isOnboardingValorant ||
      !id ||
      hasSearched ||
      onboardingInviteSearchRef.current
    ) {
      return;
    }
    onboardingInviteSearchRef.current = true;
    void runSearch();
  }, [isOnboardingValorant, onboardingStep, id, runSearch, hasSearched]);

  const invite = async (receiverId: string) => {
    if (!id) return;
    try {
      await api.createInvite({ receiverId, gameId: id, message: '一起开黑吗？' });
      safety.showAlert('邀约已发送，对方可在「邀约」页查看', '发送成功');
    } catch (err) {
      safety.showInviteError(err instanceof Error ? err.message : '发送失败');
    }
  };

  const handleDelete = async (profileId: string) => {
    try {
      await api.deleteProfileScheme(profileId);
      if (editingProfile?.id === profileId) {
        setEditingProfile(null);
        setTab('saved');
      }
      await loadSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleEdit = (p: SavedProfile) => {
    guard(() => {
      setEditingProfile(p);
      setTab('create');
    });
  };

  const handlePublish = async (profileId: string) => {
    await api.publishProfileScheme(profileId);
    await loadSaved();
  };

  const handleUnpublish = async (profileId: string) => {
    await api.unpublishProfileScheme(profileId);
    await loadSaved();
  };

  const onFormSaved = async () => {
    await loadSaved();
    if (!editingProfile) {
      setFormResetKey((k) => k + 1);
    }
  };

  const presetValues: Record<string, unknown> | undefined =
    lockedMode || lockedRegion
      ? {
          ...(lockedRegion
            ? { [GAME_SERVER_REGION_FIELD]: lockedRegion }
            : {}),
          ...(lockedMode ? { game_mode: lockedMode } : {}),
        }
      : undefined;

  const detailSubtitle = (() => {
    if (lockedMode && lockedRegion) {
      return `当前大区：${lockedRegion} · 模式：${lockedMode}`;
    }
    if (lockedRegion) {
      return `当前大区：${lockedRegion}`;
    }
    return '新建并保存多套搭子方案，或筛选在线玩家';
  })();

  if (!schema) return <div className="loading">加载中…</div>;

  const isInviteOnboardingStep = onboardingStep === 'valorant-browse-invite';
  const inviteStepReady = isInviteOnboardingStep && hasSearched && !searching;
  const showOnboardingDemoCard =
    inviteStepReady && players.length === 0;
  const squarePlayers = showOnboardingDemoCard
    ? [ONBOARDING_DEMO_PLAYER]
    : players;

  return (
    <div className="page-wrap page-detail-centered">
      <OnboardingSpotlight
        stepId="valorant-create"
        selector="#onboarding-profile-form"
      />
      <OnboardingSpotlight
        stepId="valorant-saved"
        selector="#onboarding-saved-profiles"
      />
      <OnboardingSpotlight
        stepId="valorant-browse-search"
        selector="#onboarding-browse-search"
        onBeforeNext={handleBrowseSearchBeforeNext}
      />
      <OnboardingSpotlight
        stepId="valorant-browse-invite"
        selector="#onboarding-invite-card"
        isLast
        enabled={inviteStepReady}
      />
      {safety.modals}
      {isLol && lockedRegion && (
        <Link
          to={`/games/${id}/mode?region=${encodeURIComponent(lockedRegion)}`}
          className="back-link muted"
        >
          ← 更换模式
        </Link>
      )}
      {needsRegion && (
        <Link to={`/games/${id}/region`} className="back-link muted">
          ← 更换{getServerRegionFieldLabel(gameSlug)}
        </Link>
      )}
      <PageHeader title={gameName} subtitle={detailSubtitle} />
      <div className="tabs tabs-three">
        <button
          type="button"
          className={activeTab === 'create' ? 'active' : ''}
          onClick={() =>
            guard(() => {
              setTab('create');
              if (!editingProfile) setFormResetKey((k) => k + 1);
            })
          }
        >
          新建搭子档案
        </button>
        <button
          type="button"
          className={activeTab === 'browse' ? 'active' : ''}
          onClick={() => guard(() => setTab('browse'))}
        >
          广场
        </button>
        <button
          type="button"
          className={activeTab === 'saved' ? 'active' : ''}
          onClick={() =>
            guard(() => {
              setEditingProfile(null);
              setTab('saved');
            })
          }
        >
          我的搭子档案
          {savedProfiles.length > 0 && (
            <span className="tab-badge">{savedProfiles.length}</span>
          )}
        </button>
      </div>

      {activeTab === 'create' && (
        <div id="onboarding-profile-form">
          {editingProfile && (
            <div className="edit-banner glass-panel">
              <span>正在编辑：{editingProfile.name}</span>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setEditingProfile(null);
                  setFormResetKey((k) => k + 1);
                }}
              >
                取消编辑
              </button>
            </div>
          )}
          <DynamicProfileForm
            gameId={id!}
            gameSlug={gameSlug}
            schema={schema}
            profileId={editingProfile?.id}
            initialName={editingProfile?.name ?? ''}
            initial={editingProfile?.fieldValues}
            presetValues={presetValues}
            lockedMode={lockedMode || undefined}
            lockedRegion={lockedRegion || undefined}
            resetKey={formResetKey}
            onSaved={onFormSaved}
          />
        </div>
      )}

      {activeTab === 'browse' && (
        <div>
          {hasRankField && !rankDisabled && (
            <div className="form-field">
              <span className="form-field-label">按段位筛选</span>
              <ThemeSelect
                value={rankFilter}
                onChange={setRankFilter}
                options={
                  schema.fields.find((f) => f.key === 'rank')?.options ?? []
                }
                placeholder="全部段位"
                required={false}
              />
            </div>
          )}
          {rankDisabled && (
            <p className="muted small field-hint browse-mode-hint">
              「{lockedMode}」模式无需按段位筛选，直接点击查找即可
            </p>
          )}
          {!hasRankField && !rankDisabled && (
            <p className="muted small field-hint browse-mode-hint">
              点击查找即可浏览已发布搭子档案的玩家
            </p>
          )}
          <button
            type="button"
            id="onboarding-browse-search"
            className="btn-primary search-submit-btn"
            disabled={searching}
            onClick={() => guard(() => runSearch())}
          >
            {searching ? '查找中…' : '查找'}
          </button>
          <ul className="player-list" id="onboarding-player-list">
            {isInviteOnboardingStep && searching ? (
              <EmptyState
                variant="search"
                title="正在查找玩家…"
                description="稍候，即将展示广场玩家卡片"
              />
            ) : !hasSearched ? (
              <EmptyState
                variant="search"
                title="点击查找获取玩家列表"
                description={
                  rankDisabled
                    ? `将查找已发布「${lockedMode}」档案的玩家`
                    : hasRankField
                      ? '可选择段位后点击「查找」'
                      : '点击「查找」获取玩家列表'
                }
              />
            ) : squarePlayers.length === 0 ? (
              <EmptyState
                variant="search"
                title="暂时没有符合条件的玩家"
                description={
                  lockedMode
                    ? `当前没有发布「${lockedMode}」档案的玩家，稍后再来看看～`
                    : '换个筛选条件试试，或稍后再来看看～'
                }
              />
            ) : (
              squarePlayers.map((p, index) => (
                <SquarePlayerCard
                  key={p.userId}
                  player={p}
                  schema={schema}
                  gameSlug={gameSlug}
                  hideGameMode={hideGameModeInCard}
                  hideServerRegion={hideServerRegionInCard}
                  cardId={
                    isInviteOnboardingStep && index === 0
                      ? 'onboarding-invite-card'
                      : undefined
                  }
                  inviteButtonId={
                    isInviteOnboardingStep && index === 0
                      ? 'onboarding-browse-invite'
                      : undefined
                  }
                  onInvite={() => {
                    if (isOnboardingDemoPlayer(p.userId)) {
                      safety.showAlert(
                        '这是新手指引示例。向真实玩家发起邀约成功后，即可进入聊天室。',
                        '新手指引',
                      );
                      return;
                    }
                    guard(() => invite(p.userId));
                  }}
                  onReport={() => {
                    if (isOnboardingDemoPlayer(p.userId)) return;
                    guard(() => safety.openReport(p.userId, p.nickname));
                  }}
                  onBlock={() => {
                    if (isOnboardingDemoPlayer(p.userId)) return;
                    guard(() => safety.requestBlock(p.userId, p.nickname));
                  }}
                />
              ))
            )}
          </ul>
        </div>
      )}

      {activeTab === 'saved' && (
        <div id="onboarding-saved-profiles">
          <SavedProfilesList
            profiles={savedProfiles}
            gameSlug={gameSlug}
            onEdit={(p) => guard(() => handleEdit(p))}
            onDelete={(pid) => guard(() => handleDelete(pid))}
            onPublish={(pid) => guard(() => handlePublish(pid))}
            onUnpublish={(pid) => guard(() => handleUnpublish(pid))}
            showMode={isLol}
            showServerRegion={needsRegion}
          />
        </div>
      )}
    </div>
  );
}
