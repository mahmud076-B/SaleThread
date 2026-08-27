"use client";

import { useState, useMemo, useEffect } from "react";
import type { ConversationStatus, ChannelType } from "@prisma/client";

type ConversationRow = {
  id: string;
  status: ConversationStatus;
  reason: string | null;
  estimatedValue: string | null;
  lastMessageAt: string;
  isUnread: boolean;
  customer: { name: string; externalId: string };
  channel: { type: ChannelType; displayName: string };
  messages: { id: string; content: string; sender: string; sentAt: string; isFailed?: boolean }[];
};

const STATUS_STYLES: Record<ConversationStatus, string> = {
  sold: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
};

const CHANNEL_STYLES: Record<ChannelType, string> = {
  messenger: "bg-blue-100 text-blue-700",
  instagram: "bg-pink-100 text-pink-700",
};

const STATUS_TABS: Array<ConversationStatus | "all"> = ["all", "pending", "sold", "lost"];

function formatRelativeTime(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatFullTime(isoString: string) {
  return new Date(isoString).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ThreadsClient({ conversations: initialConversations }: { conversations: ConversationRow[] }) {
  const [conversations, setConversations] = useState<ConversationRow[]>(initialConversations);
  const [activeStatus, setActiveStatus] = useState<ConversationStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Composer state
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Sync state if props change (e.g. Next.js refresh)
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      const matchStatus = activeStatus === "all" || c.status === activeStatus;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.customer.name.toLowerCase().includes(q) ||
        (c.reason ?? "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [conversations, activeStatus, search]);

  const markAsRead = async (conversationId: string) => {
    try {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, isUnread: false } : c))
      );
      await fetch(`/api/conversations/${conversationId}/read`, { method: "PATCH" });
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const handleSendReply = async (conversationId: string, textToSend: string, retryId?: string) => {
    if (!textToSend.trim() || isSending) return;

    setIsSending(true);

    // If it's a retry, we remove the failed message first
    if (retryId) {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return { ...c, messages: c.messages.filter((m) => m.id !== retryId) };
          }
          return c;
        })
      );
    }

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      // Append success message locally
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              lastMessageAt: data.data.sentAt,
              messages: [data.data, ...c.messages],
            };
          }
          return c;
        })
      );

      // Only clear text if it wasn't a retry, or if it was a retry and the text was identical
      if (!retryId || textToSend === replyText) {
        setReplyText("");
      }
    } catch (err: any) {
      // Append FAILED message locally
      const failedMessage = {
        id: `failed-${Date.now()}`,
        content: textToSend.trim(),
        sender: "business",
        sentAt: new Date().toISOString(),
        isFailed: true,
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              messages: [failedMessage, ...c.messages],
            };
          }
          return c;
        })
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        id="threads-search"
        type="search"
        placeholder="Search by customer or reason…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Status tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            id={`tab-${s}`}
            onClick={() => setActiveStatus(s)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors capitalize ${
              activeStatus === s
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-gray-500">{filtered.length} conversations</p>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No conversations found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const isExpanded = expandedId === c.id;

            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Header (Click to expand) */}
                <div
                  className={`p-4 cursor-pointer transition-colors ${c.isUnread ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => {
                    if (isExpanded) {
                      setExpandedId(null);
                    } else {
                      setExpandedId(c.id);
                      setReplyText("");
                      if (c.isUnread) markAsRead(c.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      {c.isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                      )}
                      <div>
                        <p className={`text-sm truncate ${c.isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>
                          {c.customer.name}
                        </p>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[c.status]}`}
                          >
                            {c.status}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHANNEL_STYLES[c.channel.type]}`}
                          >
                            {c.channel.type}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {c.estimatedValue && (
                        <p className={`text-sm ${c.isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'}`}>
                          ৳{Number(c.estimatedValue).toLocaleString()}
                        </p>
                      )}
                      <p className={`text-xs mt-0.5 ${c.isUnread ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                        {formatRelativeTime(c.lastMessageAt)}
                      </p>
                    </div>
                  </div>
                  {c.reason && (
                    <p className={`text-xs line-clamp-2 mt-2 ${c.isUnread ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>{c.reason}</p>
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50 flex flex-col">
                    
                    {/* Customer Info Panel */}
                    <div className="bg-white px-4 py-3 border-b border-gray-200 flex justify-between items-center text-sm shadow-sm z-10">
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Customer</p>
                        <p className="font-medium text-gray-900">{c.customer.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Source</p>
                        <p className="font-medium text-gray-900">{c.channel.displayName}</p>
                      </div>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto max-h-80 space-y-3 mb-4 flex flex-col-reverse">
                      {c.messages.map((msg) => {
                        const isBusiness = msg.sender === "business" || msg.sender === "ai_draft";
                        return (
                          <div
                            key={msg.id}
                            className={`max-w-[85%] rounded-lg p-3 text-sm ${
                              isBusiness
                                ? msg.isFailed 
                                  ? "bg-red-50 border border-red-200 text-red-900 self-end rounded-tr-none" 
                                  : "bg-blue-600 text-white self-end rounded-tr-none"
                                : "bg-white border border-gray-200 text-gray-900 self-start rounded-tl-none shadow-sm"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            
                            <div className={`flex items-center justify-between mt-1 gap-4 ${isBusiness ? (msg.isFailed ? 'text-red-500' : 'text-blue-200') : 'text-gray-400'}`}>
                              <p className="text-[10px]">
                                {formatFullTime(msg.sentAt)}
                              </p>
                              {msg.isFailed && (
                                <button 
                                  onClick={() => handleSendReply(c.id, msg.content, msg.id)}
                                  disabled={isSending}
                                  className="text-[11px] font-bold underline hover:text-red-700 disabled:opacity-50"
                                >
                                  Retry
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Composer */}
                    <div className="p-4 pt-0">
                      {c.channel.type === "messenger" ? (
                        <div className="bg-white rounded-lg border border-gray-200 p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-shadow">
                          <textarea
                            placeholder="Type a reply..."
                            className="w-full text-sm resize-none border-none focus:ring-0 p-2 text-gray-900 bg-transparent"
                            rows={2}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            disabled={isSending}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendReply(c.id, replyText);
                              }
                            }}
                          />
                          <div className="flex items-center justify-between mt-2 px-2">
                            <p className="text-xs text-gray-400">Press Enter to send, Shift+Enter for new line</p>
                            <button
                              onClick={() => handleSendReply(c.id, replyText)}
                              disabled={!replyText.trim() || isSending}
                              className={`px-4 py-1.5 text-sm font-medium text-white rounded-md transition-all flex items-center gap-2 ${
                                !replyText.trim() || isSending
                                  ? "bg-blue-300 cursor-not-allowed"
                                  : "bg-blue-600 hover:bg-blue-700 shadow-sm"
                              }`}
                            >
                              {isSending ? (
                                <>
                                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Sending...
                                </>
                              ) : "Send Reply"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 text-center py-2 bg-gray-100 rounded-lg border border-gray-200">
                          Replies are currently only supported for Messenger channels.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
