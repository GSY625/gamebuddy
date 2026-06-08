const ACTION_LABELS: Record<string, string> = {
  report_resolved: '处理举报',
  report_rejected: '驳回举报',
  user_banned: '封禁用户',
  user_unbanned: '解除封禁',
  user_restriction_enabled: '启用功能限制',
  user_restriction_disabled: '解除功能限制',
  lfg_hidden_by_admin: '下架招募',
};

const TARGET_LABELS: Record<string, string> = {
  user: '用户',
  report: '举报',
  lfg_post: '招募',
  chat_message: '聊天室消息',
  direct_message: '私信消息',
};

const RESTRICTION_TYPE_LABELS: Record<string, string> = {
  invite: '发送邀请',
  direct_message: '发送私信',
  lfg: '发布招募',
  chat: '聊天发言',
};

const DAMAGED_NOTE_PATTERN = /�|\?{3,}/;

function formatDamagedNote(prefix?: string | null) {
  if (!prefix) {
    return '历史备注已损坏（旧 SQLite 导入）';
  }

  return `${prefix}：历史备注已损坏（旧 SQLite 导入）`;
}

export function formatAdminActionLabel(action: string) {
  return ACTION_LABELS[action] || action;
}

export function formatAdminTargetLabel(targetType: string) {
  return TARGET_LABELS[targetType] || targetType;
}

export function formatRestrictionTypeLabel(type: string) {
  return RESTRICTION_TYPE_LABELS[type] || type;
}

export function formatAdminActionNote(note?: string | null) {
  const trimmed = note?.trim();
  if (!trimmed) {
    return null;
  }

  const restrictionMatch = trimmed.match(/^([a-z_]+)[：:](.*)$/i);
  if (restrictionMatch) {
    const [, type, rawDetail] = restrictionMatch;
    const prefix = formatRestrictionTypeLabel(type);
    const detail = rawDetail.trim();
    if (!detail || DAMAGED_NOTE_PATTERN.test(detail)) {
      return formatDamagedNote(prefix);
    }
    return `${prefix}：${detail}`;
  }

  if (RESTRICTION_TYPE_LABELS[trimmed]) {
    return formatRestrictionTypeLabel(trimmed);
  }

  if (DAMAGED_NOTE_PATTERN.test(trimmed)) {
    return formatDamagedNote();
  }

  return trimmed;
}
