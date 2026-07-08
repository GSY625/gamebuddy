import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { ThemeConfirmModal } from '../components/ThemeConfirmModal';
import { ThemeAlertModal } from '../components/ThemeAlertModal';
import { ThemeToast } from '../components/ThemeToast';
import { useAuth } from '../context/AuthContext';
import { useChatRoomState } from '../hooks/useChatRoomState';
import { ChatEmojiPicker } from '../components/ChatEmojiPicker';
import {
  ChatMentionPicker,
  renderMessageContent,
} from '../components/ChatMentionPicker';
import { ChatInviteModal } from '../components/chat/ChatInviteModal';
import { ChatMembersPanel } from '../components/chat/ChatMembersPanel';
import { ChatSettingsPanel } from '../components/chat/ChatSettingsPanel';
import { sanitizeMemberLimitInput } from './chatRoomUtils';

export default function ChatPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const [icebreakerLoading, setIcebreakerLoading] = useState(false);
  const {
    meta,
    messages,
    text,
    setText,
    voiceHint,
    setVoiceHint,
    roomNameEdit,
    setRoomNameEdit,
    memberLimitEdit,
    setMemberLimitEdit,
    loading,
    confirmLeave,
    setConfirmLeave,
    confirmDissolve,
    setConfirmDissolve,
    actionLoading,
    alert,
    setAlert,
    notifyToast,
    setNotifyToast,
    friendStatus,
    mentionFilter,
    mentionQuery,
    mentionScrollId,
    inviteOpen,
    setInviteOpen,
    friendsLoading,
    invitableFriends,
    invitingId,
    refreshing,
    bottomRef,
    messageRefs,
    isPartyFull,
    pickMention,
    insertMention,
    scrollToMention,
    send,
    saveVoice,
    saveRoomName,
    saveMemberLimit,
    doLeave,
    doDissolve,
    addFriend,
    acceptFriendRequest,
    copyCode,
    refreshChat,
    openInviteModal,
    inviteFriend,
  } = useChatRoomState(roomId);

  const closeMentionPicker = useCallback(() => {
    setText((current) => current.replace(/@([^\s@]*)$/, ''));
  }, [setText]);

  const handleMemberLimitChange = useCallback(
    (value: string) => {
      setMemberLimitEdit(sanitizeMemberLimitInput(value));
    },
    [setMemberLimitEdit],
  );

  const createChatIcebreaker = useCallback(async () => {
    if (!roomId || icebreakerLoading) return;

    setIcebreakerLoading(true);
    try {
      const hasTextMessage = messages.some((message) => message.type === 'text');
      const result = await api.createChatIcebreaker({
        roomId,
        contextType: hasTextMessage ? 'team_invite' : 'first_message',
      });
      setText(result.message);
      setNotifyToast({
        title: 'AI 破冰',
        message: '已插入输入框，请确认后手动发送',
      });
    } catch (err) {
      setAlert({ message: err instanceof Error ? err.message : 'AI 破冰失败' });
    } finally {
      setIcebreakerLoading(false);
    }
  }, [icebreakerLoading, messages, roomId, setAlert, setNotifyToast, setText]);

  if (loading && !meta) {
    return (
      <div className="chat-page page-wrap">
        <aside className="chat-settings glass-panel">
          <div className="loading chat-inline-loading">加载聊天室中...</div>
        </aside>
        <section className="chat-main glass-panel">
          <div className="loading chat-inline-loading">正在准备消息和成员信息...</div>
        </section>
        <aside className="chat-members glass-panel">
          <div className="loading chat-inline-loading">同步聊天室资料中...</div>
        </aside>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="page-wrap">
        <ThemeAlertModal
          open
          title={alert?.title ?? '鎻愮ず'}
          message={alert?.message ?? '鑱婂ぉ瀹や笉鍙敤'}
          onClose={() => nav('/parties')}
        />
      </div>
    );
  }

  return (
    <div className="chat-page page-wrap">
      <ThemeToast
        message={notifyToast ? `${notifyToast.title}锛?{notifyToast.message}` : ''}
        show={Boolean(notifyToast)}
        variant="warn"
        durationMs={4000}
        onClose={() => setNotifyToast(null)}
      />
      <ThemeAlertModal
        open={alert !== null}
        title={alert?.title}
        message={alert?.message ?? ''}
        onClose={() => setAlert(null)}
      />
      <ThemeConfirmModal
        open={confirmLeave}
        title="閫€鍑鸿亰澶╁"
        message="纭畾瑕侀€€鍑鸿繖涓亰澶╁鍚楋紵閫€鍑哄悗灏嗘棤娉曟煡鐪嬫鎴块棿娑堟伅銆?"
        confirmLabel="纭閫€鍑?"
        confirming={actionLoading}
        onConfirm={() => void doLeave()}
        onCancel={() => setConfirmLeave(false)}
      />
      <ThemeConfirmModal
        open={confirmDissolve}
        title="娉ㄩ攢鑱婂ぉ瀹?"
        message="纭畾瑕佹敞閿€鑱婂ぉ瀹ゅ悧锛熸墍鏈夋垚鍛樺皢琚Щ鍑猴紝鑱婂ぉ瀹?ID 鍙兘浼氳鏂版埧闂村鐢紝姝ゆ搷浣滀笉鍙挙閿€銆?"
        confirmLabel="纭娉ㄩ攢"
        confirming={actionLoading}
        onConfirm={() => void doDissolve()}
        onCancel={() => setConfirmDissolve(false)}
      />

      <ChatSettingsPanel
        meta={meta}
        voiceHint={voiceHint}
        roomNameEdit={roomNameEdit}
        memberLimitEdit={memberLimitEdit}
        refreshing={refreshing}
        onRefresh={() => void refreshChat()}
        onCopyCode={() => void copyCode()}
        onRoomNameChange={setRoomNameEdit}
        onSaveRoomName={() => void saveRoomName()}
        onMemberLimitChange={handleMemberLimitChange}
        onSaveMemberLimit={() => void saveMemberLimit()}
        onVoiceHintChange={setVoiceHint}
        onSaveVoice={() => void saveVoice()}
        onConfirmDissolve={() => setConfirmDissolve(true)}
        onConfirmLeave={() => setConfirmLeave(true)}
      />

      <div className="chat-main glass-panel">
        <header className="chat-header">
          <h2>{meta.room.name ?? '鑱婂ぉ瀹?'}</h2>
          <span className="muted small">ID: {meta.room.roomCode}</span>
        </header>

        <div className="messages">
          {mentionScrollId && (
            <button
              type="button"
              className="chat-mention-banner"
              onClick={scrollToMention}
            >
              鏈変汉 @ 浣狅紝鐐瑰嚮璺宠浆
            </button>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              ref={(element) => {
                if (element) {
                  messageRefs.current.set(message.id, element);
                } else {
                  messageRefs.current.delete(message.id);
                }
              }}
              className={`msg ${message.type === 'system' ? 'system' : ''} ${
                message.type === 'system_alert' ? 'system-alert' : ''
              } ${mentionScrollId === message.id ? 'msg-mentioned' : ''}`}
            >
              {message.type === 'text' && message.user && (
                <strong>{message.user.nickname}: </strong>
              )}
              {message.type === 'text'
                ? renderMessageContent(message.content, user?.nickname)
                : message.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-wrap">
          {mentionFilter && (
            <ChatMentionPicker
              members={meta.members}
              filter={mentionQuery}
              selfId={user?.id}
              onPick={pickMention}
              onClose={closeMentionPicker}
            />
          )}
          <div className="chat-input">
            <ChatEmojiPicker onPick={(emoji) => setText((current) => current + emoji)} />
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && send()}
              placeholder="杈撳叆娑堟伅锛孈 鍙彁鍙婃垚鍛?.."
            />
            <button
              type="button"
              className="ghost"
              disabled={icebreakerLoading}
              onClick={() => void createChatIcebreaker()}
            >
              {icebreakerLoading ? 'AI...' : 'AI 破冰'}
            </button>
            <button type="button" onClick={send}>
              鍙戦€?
            </button>
          </div>
        </div>
      </div>

      <ChatMembersPanel
        members={meta.members}
        maxMembers={meta.party.maxMembers}
        currentUserId={user?.id}
        friendStatus={friendStatus}
        isPartyFull={isPartyFull}
        onOpenInviteModal={openInviteModal}
        onInsertMention={insertMention}
        onAddFriend={(userId) => void addFriend(userId)}
        onAcceptFriendRequest={(userId, requestId, nickname) =>
          void acceptFriendRequest(userId, requestId, nickname)
        }
      />

      <ChatInviteModal
        open={inviteOpen}
        currentMembers={meta.members.length}
        maxMembers={meta.party.maxMembers}
        friendsLoading={friendsLoading}
        invitableFriends={invitableFriends}
        invitingId={invitingId}
        onClose={() => setInviteOpen(false)}
        onInvite={inviteFriend}
      />
    </div>
  );
}
