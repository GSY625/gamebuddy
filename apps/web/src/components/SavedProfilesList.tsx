import { useState } from 'react';
import {
  formatGameRank,
  GAME_SERVER_REGION_FIELD,
  getServerRegionFieldLabel,
} from '@gamebuddy/shared';
import { EmptyState } from './EmptyState';
import { ThemeConfirmModal } from './ThemeConfirmModal';
import { ThemeToast } from './ThemeToast';

export type SavedProfile = {
  id: string;
  name: string;
  fieldValues: Record<string, unknown>;
  updatedAt: string;
  publishedToSquare: boolean;
};

type Props = {
  profiles: SavedProfile[];
  gameSlug: string;
  onEdit: (p: SavedProfile) => void;
  onDelete: (id: string) => void | Promise<void>;
  onPublish: (id: string) => void | Promise<void>;
  onUnpublish: (id: string) => void | Promise<void>;
  showMode?: boolean;
  showServerRegion?: boolean;
};

function WithdrawIcon() {
  return (
    <svg
      className="square-plaza-icon dimmed"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M7 6L4 10l3 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 10h9a4 4 0 010 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SavedProfilesList({
  profiles,
  gameSlug,
  onEdit,
  onDelete,
  onPublish,
  onUnpublish,
  showMode,
  showServerRegion,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<SavedProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const regionLabel = getServerRegionFieldLabel(gameSlug);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await onDelete(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handlePublish = async (id: string) => {
    setPublishingId(id);
    try {
      await onPublish(id);
      setToast('已发布到广场');
    } catch (err) {
      alert(err instanceof Error ? err.message : '发布失败');
    } finally {
      setPublishingId(null);
    }
  };

  const handleUnpublish = async (id: string) => {
    setPublishingId(id);
    try {
      await onUnpublish(id);
      setToast('已从广场撤回');
    } catch (err) {
      alert(err instanceof Error ? err.message : '撤回失败');
    } finally {
      setPublishingId(null);
    }
  };

  if (profiles.length === 0) {
    return (
      <EmptyState
        variant="sleep"
        title="还没有保存的方案"
        description="在「新建搭子档案」里填写并保存，会出现在这里～"
      />
    );
  }

  return (
    <>
      <ThemeToast message={toast} show={Boolean(toast)} onClose={() => setToast('')} />
      <ThemeConfirmModal
        open={pendingDelete !== null}
        title="删除搭子档案"
        message={
          pendingDelete
            ? `确定删除方案「${pendingDelete.name}」吗？删除后无法恢复。`
            : ''
        }
        confirmLabel="确认删除"
        confirming={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
      />
      <ul className="saved-profiles-list">
        {profiles.map((p) => {
          const busy = publishingId === p.id;
          return (
            <li key={p.id} className="saved-profile-card glass-panel">
              <div className="saved-profile-main">
                <h3>
                  {p.name}
                  {p.publishedToSquare && (
                    <span className="saved-profile-published-tag">广场展示中</span>
                  )}
                </h3>
                {showServerRegion &&
                  p.fieldValues[GAME_SERVER_REGION_FIELD] != null && (
                    <p className="muted">
                      {regionLabel}：
                      {String(p.fieldValues[GAME_SERVER_REGION_FIELD])}
                    </p>
                  )}
                {showMode && p.fieldValues.game_mode != null && (
                  <p className="muted">模式：{String(p.fieldValues.game_mode)}</p>
                )}
                <p className="muted">
                  段位：{formatGameRank(gameSlug, p.fieldValues)}
                </p>
                <p className="muted small">
                  更新于 {new Date(p.updatedAt).toLocaleString('zh-CN')}
                </p>
              </div>
              <div className="actions saved-profile-actions">
                {p.publishedToSquare ? (
                  <button
                    type="button"
                    className="btn-square-unpublish"
                    disabled={busy}
                    onClick={() => void handleUnpublish(p.id)}
                  >
                    <WithdrawIcon />
                    {busy ? '处理中…' : '从广场撤回'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-square-publish"
                    disabled={busy}
                    onClick={() => void handlePublish(p.id)}
                  >
                    {busy ? '处理中…' : '发布到广场'}
                  </button>
                )}
                <button type="button" onClick={() => onEdit(p)}>
                  编辑
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setPendingDelete(p)}
                >
                  删除
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
