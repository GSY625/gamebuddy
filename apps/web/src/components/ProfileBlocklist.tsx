import { useCallback, useEffect, useState } from 'react';
import { api } from '@gamebuddy/api-client';
import { ThemeModal } from './ThemeModal';
import { ThemeToast } from './ThemeToast';

type BlockRow = {
  id: string;
  blockedId: string;
  blocked: { id: string; nickname: string };
};

export function ProfileBlocklistButton() {
  const [open, setOpen] = useState(false);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = (await api.listBlocks()) as BlockRow[];
      setBlocks(list);
    } catch {
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const remove = async (blockedId: string, nickname: string) => {
    setRemovingId(blockedId);
    try {
      await api.unblock(blockedId);
      setBlocks((prev) => prev.filter((b) => b.blockedId !== blockedId));
      setToast(`已将「${nickname}」移出黑名单`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : '操作失败');
    } finally {
      setRemovingId(null);
    }
  };

  const close = () => {
    setOpen(false);
    setToast('');
  };

  return (
    <>
      <button
        type="button"
        className="ghost small-btn"
        onClick={() => setOpen(true)}
      >
        黑名单
      </button>

      <ThemeModal
        open={open}
        title="黑名单"
        onClose={close}
        footer={
          <button type="button" className="btn-primary theme-modal-submit" onClick={close}>
            关闭
          </button>
        }
      >
        <p className="muted small blocklist-modal-desc">
          已拉黑的用户无法与你互相发送邀约；移出后即可恢复正常互动。
        </p>
        <ThemeToast message={toast} show={Boolean(toast)} onClose={() => setToast('')} />
        {loading ? (
          <p className="muted">加载中…</p>
        ) : blocks.length === 0 ? (
          <p className="muted blocklist-empty">暂无黑名单用户</p>
        ) : (
          <ul className="blocklist">
            {blocks.map((b) => (
              <li key={b.id} className="blocklist-item">
                <span className="blocklist-name">{b.blocked.nickname}</span>
                <button
                  type="button"
                  className="ghost blocklist-remove"
                  disabled={removingId === b.blockedId}
                  onClick={() => void remove(b.blockedId, b.blocked.nickname)}
                >
                  {removingId === b.blockedId ? '移除中…' : '移出'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </ThemeModal>
    </>
  );
}
