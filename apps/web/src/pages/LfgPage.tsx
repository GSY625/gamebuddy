import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { GameIcon } from '../components/GameIcon';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ThemeConfirmModal } from '../components/ThemeConfirmModal';
import { ThemeModal } from '../components/ThemeModal';
import { ThemeSelect } from '../components/ThemeSelect';
import { ThemeToast } from '../components/ThemeToast';
import { useAuth } from '../context/AuthContext';
import { useOnlineGuard } from '../hooks/useOnlineGuard';

type Game = { id: string; name: string };
type Post = {
  id: string;
  title: string;
  description?: string;
  mode?: string;
  author: { id: string; nickname: string };
  game: { name: string; icon: string };
  _count?: { applications: number };
};
type Application = {
  id: string;
  user: { nickname: string };
  status: string;
};
type MyApplication = {
  id: string;
  status: string;
  message?: string | null;
  createdAt: string;
  post: {
    id: string;
    title: string;
    status: string;
    game: { name: string; icon: string };
    author: { nickname: string };
  };
};

type LfgTab = 'posts' | 'my-apps';

function appStatusLabel(status: string) {
  if (status === 'pending') return '待处理';
  if (status === 'accepted') return '已通过';
  if (status === 'rejected') return '已拒绝';
  return status;
}

function postStatusLabel(status: string) {
  if (status === 'open') return '招募中';
  if (status === 'matched') return '已匹配';
  return status;
}

export default function LfgPage() {
  const { user } = useAuth();
  const { guard } = useOnlineGuard();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<LfgTab>('posts');
  const [pendingManagePostId, setPendingManagePostId] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [filterGameId, setFilterGameId] = useState('');
  const [postGameId, setPostGameId] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [myApps, setMyApps] = useState<MyApplication[]>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [applyPostId, setApplyPostId] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [toast, setToast] = useState('');

  const updateAppCount = useCallback((postId: string, count: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, _count: { applications: count } } : p,
      ),
    );
  }, []);

  const load = useCallback(
    () =>
      api
        .listLfg(filterGameId || undefined)
        .then((data) => setPosts(data as Post[]))
        .finally(() => setPostsLoaded(true)),
    [filterGameId],
  );

  const loadMyApps = useCallback(
    () => api.myLfgApplications().then((data) => setMyApps(data as MyApplication[])),
    [],
  );

  useEffect(() => {
    api.getGames().then((g) => {
      setGames(g);
      if (g[0]) setPostGameId(g[0].id);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (user) void loadMyApps();
  }, [user, loadMyApps]);

  useEffect(() => {
    const managePostId = searchParams.get('manage');
    if (!managePostId) return;
    setPendingManagePostId(managePostId);
    setTab('posts');
    setFilterGameId('');
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const timer = setInterval(() => {
      void load();
      if (user) void loadMyApps();
    }, 15000);
    return () => clearInterval(timer);
  }, [load, loadMyApps, user]);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    guard(async () => {
      if (!postGameId || !title) return;
      await api.createLfg({ gameId: postGameId, title, description: desc });
      setTitle('');
      setDesc('');
      load();
    });
  };

  const openApply = (id: string) => {
    setApplyPostId(id);
    setApplyMessage('');
  };

  const submitApply = () => {
    guard(async () => {
      if (!applyPostId) return;
      setApplying(true);
      try {
        await api.applyLfg(applyPostId, applyMessage.trim() || undefined);
        setApplyPostId(null);
        setApplyMessage('');
        setToast('已申请');
        load();
        void loadMyApps();
      } catch (err) {
        setToast(err instanceof Error ? err.message : '申请失败');
      } finally {
        setApplying(false);
      }
    });
  };

  const openEdit = (p: Post) => {
    setEditingPost(p);
    setEditTitle(p.title);
    setEditDesc(p.description ?? '');
  };

  const submitEdit = () => {
    guard(async () => {
      if (!editingPost || !editTitle.trim()) return;
      setSavingEdit(true);
      try {
        await api.updateLfg(editingPost.id, {
          title: editTitle.trim(),
          description: editDesc,
        });
        setEditingPost(null);
        setToast('帖子已更新');
        load();
      } catch (err) {
        setToast(err instanceof Error ? err.message : '保存失败');
      } finally {
        setSavingEdit(false);
      }
    });
  };

  const openManageApps = useCallback(
    async (postId: string) => {
      setExpanded(postId);
      const list = (await api.lfgApplications(postId)) as Application[];
      setApps(list);
      updateAppCount(postId, list.filter((a) => a.status === 'pending').length);
    },
    [updateAppCount],
  );

  const showApps = async (postId: string) => {
    if (expanded === postId) {
      setExpanded(null);
      setApps([]);
      return;
    }
    await openManageApps(postId);
  };

  useEffect(() => {
    if (!pendingManagePostId || !user || !postsLoaded) return;
    const post = posts.find((p) => p.id === pendingManagePostId);
    if (post && post.author.id !== user.id) {
      setPendingManagePostId(null);
      return;
    }
    void openManageApps(pendingManagePostId)
      .catch(() => setToast('无法打开管理申请，帖子可能已删除'))
      .finally(() => setPendingManagePostId(null));
  }, [pendingManagePostId, posts, user, postsLoaded, openManageApps]);

  const refreshApps = async (postId: string) => {
    const list = (await api.lfgApplications(postId)) as Application[];
    setApps(list);
    updateAppCount(postId, list.filter((a) => a.status === 'pending').length);
  };

  const resolve = (
    postId: string,
    appId: string,
    accept: boolean,
    blockApplicant = false,
  ) => {
    guard(async () => {
      try {
        const res = (await api.resolveLfgApp(postId, appId, {
          accept,
          blockApplicant,
        })) as { party?: { chatRoom?: { id: string } } };
        if (accept && res.party?.chatRoom?.id) {
          window.location.href = `/chat/${res.party.chatRoom.id}`;
          return;
        }
        setToast(blockApplicant ? '已拒绝并屏蔽 30 分钟' : accept ? '已接受申请' : '已拒绝申请');
        if (expanded === postId) await refreshApps(postId);
        load();
      } catch (err) {
        setToast(err instanceof Error ? err.message : '操作失败');
      }
    });
  };

  const confirmDeletePost = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteLfg(pendingDelete.id);
      if (expanded === pendingDelete.id) {
        setExpanded(null);
        setApps([]);
      }
      setPendingDelete(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const gameItems = games.map((g) => ({ value: g.id, label: g.name }));
  const pendingMyApps = myApps.filter((a) => a.status === 'pending').length;

  const myAppStatusByPostId = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of myApps) {
      map.set(a.post.id, a.status);
    }
    return map;
  }, [myApps]);

  const showPostsTab = () => {
    setTab('posts');
    setExpanded(null);
    setApps([]);
    void load();
  };

  return (
    <div className="page-wrap">
      <ThemeToast message={toast} show={Boolean(toast)} onClose={() => setToast('')} />
      <ThemeConfirmModal
        open={pendingDelete !== null}
        title="删除帖子"
        message={
          pendingDelete
            ? `确认删除「${pendingDelete.title}」？删除后相关申请也会一并移除。`
            : ''
        }
        confirmLabel="确认删除"
        confirming={deleting}
        onConfirm={() => void confirmDeletePost()}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
      />
      <ThemeModal
        open={applyPostId !== null}
        title="申请组队"
        onClose={() => {
          if (!applying) setApplyPostId(null);
        }}
        footer={
          <>
            <button type="button" className="ghost" disabled={applying} onClick={() => setApplyPostId(null)}>
              取消
            </button>
            <button type="button" className="btn-primary theme-modal-submit" disabled={applying} onClick={() => void submitApply()}>
              {applying ? '提交中…' : '提交申请'}
            </button>
          </>
        }
      >
        <label className="form-field-label" htmlFor="lfg-apply-message">
          申请留言（可选）
        </label>
        <textarea
          id="lfg-apply-message"
          className="lfg-apply-textarea"
          placeholder="简单介绍一下自己，或说明想一起玩的时段…"
          value={applyMessage}
          onChange={(e) => setApplyMessage(e.target.value)}
          maxLength={200}
          rows={4}
        />
      </ThemeModal>
      <ThemeModal
        open={editingPost !== null}
        title="编辑帖子"
        onClose={() => {
          if (!savingEdit) setEditingPost(null);
        }}
        footer={
          <>
            <button type="button" className="ghost" disabled={savingEdit} onClick={() => setEditingPost(null)}>
              取消
            </button>
            <button type="button" className="btn-primary theme-modal-submit" disabled={savingEdit} onClick={() => void submitEdit()}>
              {savingEdit ? '保存中…' : '保存'}
            </button>
          </>
        }
      >
        <label className="form-field-label" htmlFor="lfg-edit-title">
          标题
        </label>
        <input
          id="lfg-edit-title"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          maxLength={100}
          required
        />
        <label className="form-field-label" htmlFor="lfg-edit-desc">
          补充说明
        </label>
        <textarea
          id="lfg-edit-desc"
          className="lfg-apply-textarea"
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          rows={4}
        />
      </ThemeModal>

      <PageHeader title="找搭子帖" subtitle="发布需求或申请他人的帖子，一起开黑" />

      <div className="tabs">
        <button type="button" className={tab === 'posts' ? 'active' : ''} onClick={showPostsTab}>
          浏览帖子
        </button>
        <button type="button" className={tab === 'my-apps' ? 'active' : ''} onClick={() => setTab('my-apps')}>
          我的申请
          {pendingMyApps > 0 && <span className="tab-badge">{pendingMyApps}</span>}
        </button>
      </div>

      {tab === 'posts' && (
        <>
          <div className="lfg-filter-bar">
            <span className="muted small">按游戏筛选</span>
            <ThemeSelect
              className="lfg-filter-select"
              value={filterGameId}
              onChange={setFilterGameId}
              items={gameItems}
              placeholder="全部游戏"
            />
          </div>

          <form className="inline-form glass-panel" onSubmit={create}>
            <ThemeSelect className="inline-form-select" value={postGameId} onChange={setPostGameId} items={gameItems} required />
            <input placeholder="标题，如：晚上排位缺辅助" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <input placeholder="补充说明" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <button type="submit">发帖</button>
          </form>

          {posts.length === 0 ? (
            <EmptyState variant="chat" title="还没有帖子" description="发一条找搭子帖，等等有缘人吧～" />
          ) : (
            <ul className="post-list">
              {posts.map((p) => {
                const isOwn = user?.id === p.author.id;
                const pendingCount = p._count?.applications ?? 0;
                const myAppStatus = myAppStatusByPostId.get(p.id);
                return (
                  <li key={p.id} className="post-card glass-panel">
                    <div>
                      <GameIcon icon={p.game.icon} name={p.game.name} className="game-icon-sm" />
                      <strong>{p.title}</strong>
                      <span className="muted"> — {p.author.nickname}</span>
                      {isOwn && <span className="own-post-tag">我的帖子</span>}
                      {p.description && <p>{p.description}</p>}
                    </div>
                    <div className="actions">
                      {!isOwn &&
                        (myAppStatus === 'pending' ? (
                          <button type="button" disabled>
                            已申请
                          </button>
                        ) : myAppStatus === 'accepted' ? (
                          <button type="button" disabled>
                            已通过
                          </button>
                        ) : (
                          <button type="button" onClick={() => openApply(p.id)}>
                            申请组队
                          </button>
                        ))}
                      {isOwn && (
                        <>
                          <button type="button" className="ghost" onClick={() => openEdit(p)}>
                            编辑
                          </button>
                          <button type="button" className="ghost" onClick={() => void showApps(p.id)}>
                            管理申请 ({pendingCount})
                          </button>
                          <button type="button" className="btn-danger-outline" onClick={() => setPendingDelete(p)}>
                            删除
                          </button>
                        </>
                      )}
                    </div>
                    {expanded === p.id && isOwn && (
                      <ul className="app-list">
                        {apps.length === 0 ? (
                          <li className="muted">暂无申请</li>
                        ) : (
                          apps.map((a) => (
                            <li key={a.id}>
                              {a.user.nickname} — {appStatusLabel(a.status)}
                              {a.status === 'pending' && (
                                <div className="app-list-actions">
                                  <button type="button" onClick={() => resolve(p.id, a.id, true)}>
                                    接受
                                  </button>
                                  <button type="button" className="ghost" onClick={() => resolve(p.id, a.id, false)}>
                                    拒绝
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-danger-outline"
                                    onClick={() => resolve(p.id, a.id, false, true)}
                                  >
                                    拒绝并屏蔽30分钟
                                  </button>
                                </div>
                              )}
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === 'my-apps' && (
        myApps.length === 0 ? (
          <EmptyState variant="search" title="还没有申请记录" description="在浏览帖子中点击「申请组队」后，状态会显示在这里" />
        ) : (
          <ul className="post-list">
            {myApps.map((a) => (
              <li key={a.id} className="post-card glass-panel">
                <div>
                  <GameIcon icon={a.post.game.icon} name={a.post.game.name} className="game-icon-sm" />
                  <strong>{a.post.title}</strong>
                  <span className="muted"> — {a.post.author.nickname}</span>
                  <p className="muted small">
                    申请状态：<span className={`status-badge status-${a.status}`}>{appStatusLabel(a.status)}</span>
                    {' · '}
                    帖子状态：{postStatusLabel(a.post.status)}
                  </p>
                  {a.message && <p className="small">{a.message}</p>}
                  <p className="muted small">申请于 {new Date(a.createdAt).toLocaleString('zh-CN')}</p>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
