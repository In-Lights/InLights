import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Trash2, AtSign } from 'lucide-react';
import { getComments, addComment, deleteComment, getAdminUsers, getAdminSession, type ReleaseComment } from '../store';

interface Props {
  releaseId: string;
}

export default function InternalComments({ releaseId }: Props) {
  const [comments, setComments] = useState<ReleaseComment[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [adminUsernames, setAdminUsernames] = useState<string[]>([]);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number } | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const session = getAdminSession();

  useEffect(() => {
    getComments(releaseId).then(setComments);
    getAdminUsers().then(users => setAdminUsernames(users.map(u => u.username)));
  }, [releaseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);

    // detect @mention trigger
    const cursor = e.target.selectionStart;
    const textUpToCursor = val.slice(0, cursor);
    const mentionMatch = textUpToCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionSearch(mentionMatch[1].toLowerCase());
      setShowMentions(true);
      // calculate dropdown position
      const ta = textareaRef.current;
      if (ta) {
        setMentionPos({ top: ta.offsetTop + ta.offsetHeight + 4, left: ta.offsetLeft });
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (username: string) => {
    const cursor = textareaRef.current?.selectionStart ?? body.length;
    const textUpToCursor = body.slice(0, cursor);
    const before = textUpToCursor.replace(/@\w*$/, `@${username} `);
    setBody(before + body.slice(cursor));
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const filteredMentions = adminUsernames.filter(u =>
    u.toLowerCase().includes(mentionSearch) && u !== session.username
  );

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    const comment = await addComment(releaseId, body.trim());
    if (comment) {
      setComments(prev => [...prev, comment]);
      setBody('');
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    await deleteComment(id);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderBody = (text: string) =>
    text.split(/(@\w+)/g).map((part, i) =>
      part.startsWith('@')
        ? <span key={i} className="text-violet-400 font-semibold">{part}</span>
        : <span key={i}>{part}</span>
    );

  const initials = (name: string) => name.slice(0, 2).toUpperCase();

  const avatarColor = (name: string) => {
    const colors = ['bg-violet-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-pink-600', 'bg-indigo-600'];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
  };

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
        <MessageSquare className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold">Internal Comments</span>
        {comments.length > 0 && (
          <span className="ml-auto text-xs text-zinc-500">{comments.length} message{comments.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
        {comments.length === 0 && (
          <div className="text-center py-10">
            <MessageSquare className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-sm text-zinc-600">No comments yet</p>
            <p className="text-xs text-zinc-700 mt-1">Use @username to notify a teammate</p>
          </div>
        )}

        {comments.map(c => {
          const isOwn = c.authorUsername === session.username;
          return (
            <div key={c.id} className={`flex gap-3 group ${isOwn ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${avatarColor(c.authorUsername)}`}>
                {initials(c.authorUsername)}
              </div>

              {/* Bubble */}
              <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className={`flex items-center gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs font-medium text-zinc-400">{c.authorUsername}</span>
                  <span className="text-[10px] text-zinc-600">{formatTime(c.createdAt)}</span>
                </div>
                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  isOwn
                    ? 'bg-violet-600/30 border border-violet-500/20 text-zinc-100 rounded-tr-sm'
                    : 'bg-white/5 border border-white/8 text-zinc-200 rounded-tl-sm'
                }`}>
                  {renderBody(c.body)}
                </div>
                {/* Delete (own messages only) */}
                {isOwn && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 p-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Mention dropdown */}
      {showMentions && filteredMentions.length > 0 && (
        <div className="mx-5 mb-1 rounded-xl border border-white/10 bg-zinc-900 overflow-hidden shadow-xl">
          {filteredMentions.map(u => (
            <button
              key={u}
              onMouseDown={e => { e.preventDefault(); insertMention(u); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 text-left"
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${avatarColor(u)}`}>
                {initials(u)}
              </div>
              <span className="text-sm text-zinc-300">@{u}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-5 py-4 border-t border-white/5">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={handleInput}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
                  e.preventDefault();
                  handleSend();
                }
                if (e.key === 'Escape') setShowMentions(false);
              }}
              placeholder="Add a comment… use @ to mention"
              rows={1}
              className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={() => { setBody(b => b + '@'); textareaRef.current?.focus(); }}
              className="absolute right-3 bottom-3 text-zinc-600 hover:text-violet-400 transition-colors"
              title="Mention someone"
            >
              <AtSign className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !body.trim()}
            className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-zinc-700 mt-1.5">Enter to send · Shift+Enter for new line · @ to mention</p>
      </div>
    </div>
  );
}
