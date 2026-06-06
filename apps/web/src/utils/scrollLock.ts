let lockCount = 0;

/** 弹窗等场景锁定页面滚动（支持多层嵌套） */
export function lockBodyScroll() {
  lockCount += 1;
  if (lockCount === 1) {
    document.body.style.overflow = 'hidden';
  }
}

export function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = '';
  }
}

/** 兜底：清除可能残留的滚动锁定 */
export function resetBodyScroll() {
  lockCount = 0;
  document.body.style.overflow = '';
}
