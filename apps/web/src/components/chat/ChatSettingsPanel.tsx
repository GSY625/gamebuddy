import type { RoomMeta } from '../../pages/chatTypes';

type ChatSettingsPanelProps = {
  meta: RoomMeta;
  voiceHint: string;
  roomNameEdit: string;
  memberLimitEdit: string;
  refreshing: boolean;
  onRefresh: () => void;
  onCopyCode: () => void;
  onRoomNameChange: (value: string) => void;
  onSaveRoomName: () => void;
  onMemberLimitChange: (value: string) => void;
  onSaveMemberLimit: () => void;
  onVoiceHintChange: (value: string) => void;
  onSaveVoice: () => void;
  onConfirmDissolve: () => void;
  onConfirmLeave: () => void;
};

const text = {
  title: '\u804a\u5929\u5ba4\u8bbe\u7f6e',
  refresh: '\u5237\u65b0\u804a\u5929\u5ba4',
  roomId: '\u804a\u5929\u5ba4 ID',
  copy: '\u590d\u5236',
  roomName: '\u804a\u5929\u5ba4\u540d\u79f0',
  unnamed: '\u672a\u547d\u540d',
  saveName: '\u4fdd\u5b58\u540d\u79f0',
  memberLimit: '\u4eba\u6570\u4e0a\u9650',
  memberLimitHint: '\u7559\u7a7a\u8868\u793a\u4e0d\u9650\u5236\uff0c\u8303\u56f4 2 - 99 \u4eba',
  memberLimitPlaceholder: '\u4e0d\u9650\u5236',
  saveMemberLimit: '\u4fdd\u5b58\u4e0a\u9650',
  currentLimit: '\u5f53\u524d\u4e0a\u9650',
  currentUnlimited: '\u5f53\u524d\u4e0d\u9650\u4eba\u6570',
  voiceTitle: '\u8bed\u97f3\uff08\u7b2c\u4e09\u65b9\uff09',
  voiceHint: '\u586b\u5199 QQ/\u5fae\u4fe1\u8bed\u97f3\u623f\u95f4\u8bf4\u660e',
  voicePlaceholder:
    '\u4f8b\u5982\uff1a\u5fae\u4fe1\u8bed\u97f3\u7fa4 / QQ 123456',
  saveVoice: '\u4fdd\u5b58\u8bed\u97f3\u8bf4\u660e',
  memberViewOnly:
    '\u4ec5\u623f\u4e3b\u53ef\u4fee\u6539\uff0c\u6210\u5458\u53ef\u67e5\u770b',
  voiceEmpty: '\u623f\u4e3b\u6682\u672a\u586b\u5199\u8bed\u97f3\u8bf4\u660e',
  dissolve: '\u6ce8\u9500\u804a\u5929\u5ba4',
  leave: '\u9000\u51fa\u804a\u5929\u5ba4',
  unknownCode: '--',
};

export function ChatSettingsPanel({
  meta,
  voiceHint,
  roomNameEdit,
  memberLimitEdit,
  refreshing,
  onRefresh,
  onCopyCode,
  onRoomNameChange,
  onSaveRoomName,
  onMemberLimitChange,
  onSaveMemberLimit,
  onVoiceHintChange,
  onSaveVoice,
  onConfirmDissolve,
  onConfirmLeave,
}: ChatSettingsPanelProps) {
  return (
    <aside className="chat-settings glass-panel">
      <div className="chat-settings-header">
        <h2>{text.title}</h2>
        <button
          type="button"
          className="chat-refresh-btn"
          title={text.refresh}
          aria-label={text.refresh}
          disabled={refreshing}
          onClick={onRefresh}
        >
          <svg
            className={`chat-refresh-icon${refreshing ? ' spinning' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M21 12a9 9 0 1 1-2.64-6.36"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M21 3v6h-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="chat-room-id-box">
        <span className="form-field-label">{text.roomId}</span>
        <div className="chat-room-id-row">
          <code className="room-code">{meta.room.roomCode ?? text.unknownCode}</code>
          <button type="button" className="ghost small-btn" onClick={onCopyCode}>
            {text.copy}
          </button>
        </div>
      </div>

      <div className="form-field">
        <span className="form-field-label">{text.roomName}</span>
        {meta.isLeader ? (
          <>
            <input
              value={roomNameEdit}
              onChange={(event) => onRoomNameChange(event.target.value)}
              maxLength={32}
            />
            <button type="button" className="ghost small-btn" onClick={onSaveRoomName}>
              {text.saveName}
            </button>
          </>
        ) : (
          <p className="room-name-display">{meta.room.name ?? text.unnamed}</p>
        )}
      </div>

      <div className="form-field">
        <span className="form-field-label">{text.memberLimit}</span>
        {meta.isLeader ? (
          <>
            <p className="muted small">{text.memberLimitHint}</p>
            <input
              className="chat-member-limit-input"
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder={text.memberLimitPlaceholder}
              value={memberLimitEdit}
              onChange={(event) => onMemberLimitChange(event.target.value)}
            />
            <button
              type="button"
              className="ghost small-btn"
              onClick={onSaveMemberLimit}
            >
              {text.saveMemberLimit}
            </button>
          </>
        ) : (
          <p className="room-name-display">
            {typeof meta.party.maxMembers === 'number'
              ? `${text.currentLimit} ${meta.party.maxMembers} \u4eba`
              : text.currentUnlimited}
          </p>
        )}
      </div>

      <hr className="chat-divider" />

      <h3>{text.voiceTitle}</h3>
      {meta.isLeader ? (
        <>
          <p className="muted small">{text.voiceHint}</p>
          <input
            placeholder={text.voicePlaceholder}
            value={voiceHint}
            onChange={(event) => onVoiceHintChange(event.target.value)}
          />
          <button type="button" onClick={onSaveVoice}>
            {text.saveVoice}
          </button>
        </>
      ) : (
        <>
          <p className="muted small">{text.memberViewOnly}</p>
          <p className="room-name-display">{voiceHint.trim() || text.voiceEmpty}</p>
        </>
      )}

      <hr className="chat-divider" />

      {meta.isLeader ? (
        <button
          type="button"
          className="btn-danger-outline"
          onClick={onConfirmDissolve}
        >
          {text.dissolve}
        </button>
      ) : (
        <button
          type="button"
          className="btn-danger-outline"
          onClick={onConfirmLeave}
        >
          {text.leave}
        </button>
      )}
    </aside>
  );
}
