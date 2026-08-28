"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CustomerNotes } from "@/components/CustomerNotes";
import { CustomerTags } from "@/components/CustomerTags";
import { LeadControls } from "@/components/LeadControls";
import { CustomerMemoryClient } from "@/app/(dashboard)/customers/[customerId]/CustomerMemoryClient";
import type { ConversationStatus, ConversationPriority, ChannelType, CustomerTag } from "@prisma/client";

type ConversationRow = {
  id: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  reason: string | null;
  estimatedValue: string | null;
  followUpAt: string | null;
  followUpCompleted: boolean;
  lastMessageAt: string;
  isUnread: boolean;
  customer: { id: string; name: string; externalId: string; tags: { tag: CustomerTag }[] };
  channel: { type: ChannelType; displayName: string };
  messages: { id: string; content: string; sender: string; sentAt: string; isFailed?: boolean }[];
  aiLeadScore: number | null;
  aiLeadTemperature: string | null;
  aiLeadIntent: string | null;
  aiLeadConfidence: string | null;
  aiLeadReasons: any | null;
  aiLeadScoredAt: string | null;
};

function formatRelativeTime(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatFullTime(isoString: string) {
  return new Date(isoString).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ThreadsClientInner({ initialConversations }: { initialConversations: ConversationRow[] }) {
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [conversations, setConversations] = useState<ConversationRow[]>(initialConversations);
  const [activeStatus, setActiveStatus] = useState<ConversationStatus | "all">("all");
  const [channelFilter, setChannelFilter] = useState<ChannelType | "all">("all");
  const [readStatus, setReadStatus] = useState<"all" | "unread" | "read">("all");
  const [leadFilter, setLeadFilter] = useState<"all" | "hot">("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(idParam);
  
  // Mobile Drawer State
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // When selectedConv changes, reset mobile drawer state
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileDrawerOpen(false);
  }, [expandedId]);
  
  // Composer state
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // AI State
  const [aiSuggestions, setAiSuggestions] = useState<{text: string, tone: string}[] | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Phase 2 AI Insights State
  const [conversationInsights, setConversationInsights] = useState<any | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Phase 3 AI Lead Intelligence State
  const [leadIntelligence, setLeadIntelligence] = useState<any | null>(null);
  const [isLeadIntelligenceLoading, setIsLeadIntelligenceLoading] = useState(false);
  const [leadIntelligenceError, setLeadIntelligenceError] = useState<string | null>(null);

  // Phase 5 AI Lead Scoring State
  const [isScoringLoading, setIsScoringLoading] = useState(false);
  const [scoringError, setScoringError] = useState<string | null>(null);

  // Phase 6 AI Follow-up State
  const [followUpRecommendation, setFollowUpRecommendation] = useState<any | null>(null);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [isFollowUpDraftLoading, setIsFollowUpDraftLoading] = useState(false);
  const [followUpDraftError, setFollowUpDraftError] = useState<string | null>(null);

  // Sync state if props change (e.g. Next.js refresh)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations(initialConversations);
  }, [initialConversations]);

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

  // Handle deep linking on mount
  useEffect(() => {
    if (idParam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpandedId(idParam);
      const c = conversations.find(c => c.id === idParam);
      if (c && c.isUnread) {
        markAsRead(idParam);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam]);

  const filtered = useMemo(() => {
    const result = conversations.filter((c) => {
      const matchStatus = activeStatus === "all" || c.status === activeStatus;
      const matchChannel = channelFilter === "all" || c.channel.type === channelFilter;
      const matchRead = readStatus === "all" 
        ? true 
        : readStatus === "unread" ? c.isUnread : !c.isUnread;
      const matchLead = leadFilter === "all" || c.aiLeadTemperature === "hot";

      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.customer.name.toLowerCase().includes(q) ||
        (c.customer.externalId && c.customer.externalId.toLowerCase().includes(q)) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q));

      return matchStatus && matchChannel && matchRead && matchLead && matchSearch;
    });

    result.sort((a, b) => {
      if (a.isUnread && !b.isUnread) return -1;
      if (!a.isUnread && b.isUnread) return 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    return result;
  }, [conversations, activeStatus, channelFilter, readStatus, leadFilter, search]);



  const handleSendReply = async (conversationId: string, textToSend: string, retryId?: string) => {
    if (!textToSend.trim() || isSending) return;
    setIsSending(true);

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
      if (!res.ok) throw new Error(data.error || "Failed to send message");

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

      if (!retryId || textToSend === replyText) {
        setReplyText("");
      }
    } catch {
      const failedMessage = {
        id: `failed-${crypto.randomUUID()}`,
        content: textToSend.trim(),
        sender: "business",
        sentAt: new Date().toISOString(),
        isFailed: true,
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return { ...c, messages: [failedMessage, ...c.messages] };
          }
          return c;
        })
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSuggestReplies = async (conversationId: string) => {
    if (isAiLoading) return;
    setIsAiLoading(true);
    setAiError(null);
    setAiSuggestions(null);

    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}/suggestions`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "AI suggestions are temporarily unavailable. Please try again.");
      }
      
      setAiSuggestions(data.data.suggestions);
    } catch (err: any) {
      setAiError(err.message || "AI suggestions are temporarily unavailable. Please try again.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAnalyzeConversation = async (conversationId: string) => {
    if (isInsightsLoading) return;
    setIsInsightsLoading(true);
    setInsightsError(null);
    
    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}/insights`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "AI insights are temporarily unavailable. Please try again.");
      }
      
      setConversationInsights(data.data.insights);
    } catch (err: any) {
      setInsightsError(err.message || "AI insights are temporarily unavailable. Please try again.");
    } finally {
      setIsInsightsLoading(false);
    }
  };

  const handleLeadUpdate = (updateData: Partial<ConversationRow>) => {
    if (!selectedConv) return;
    setConversations(prev => 
      prev.map(c => 
        c.id === selectedConv.id ? { ...c, ...updateData } : c
      )
    );
  };

  const handleAnalyzeLead = async (conversationId: string) => {
    if (isLeadIntelligenceLoading) return;
    setIsLeadIntelligenceLoading(true);
    setLeadIntelligenceError(null);
    
    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}/lead-intelligence`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "AI lead intelligence is temporarily unavailable. Please try again.");
      }
      
      setLeadIntelligence(data.intelligence);
    } catch (err: any) {
      setLeadIntelligenceError(err.message || "AI lead intelligence is temporarily unavailable. Please try again.");
    } finally {
      setIsLeadIntelligenceLoading(false);
    }
  };

  const applyLeadIntelligence = async (conversationId: string, payload: any) => {
    handleLeadUpdate(payload); // Optimistic update
    
    try {
      const res = await fetch(`/api/conversations/${conversationId}/lead`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error("Failed to apply recommendation.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to apply lead update. Please try again.");
    }
  };

  const handleScoreLead = async (conversationId: string) => {
    if (isScoringLoading) return;
    setIsScoringLoading(true);
    setScoringError(null);
    
    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}/score`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "AI scoring is temporarily unavailable.");
      }
      
      // Update local state
      handleLeadUpdate({
        aiLeadScore: data.data.score,
        aiLeadTemperature: data.data.temperature,
        aiLeadIntent: data.data.buyingIntent,
        aiLeadConfidence: data.data.confidence,
        aiLeadReasons: data.data.reasons,
        aiLeadScoredAt: data.data.scoredAt,
      });
    } catch (err: any) {
      setScoringError(err.message || "AI scoring is temporarily unavailable.");
    } finally {
      setIsScoringLoading(false);
    }
  };

  const handleRecommendFollowUp = async (conversationId: string) => {
    if (isFollowUpLoading) return;
    setIsFollowUpLoading(true);
    setFollowUpError(null);
    setFollowUpRecommendation(null);
    
    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}/follow-up`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "AI follow-up recommendation is temporarily unavailable.");
      }
      
      setFollowUpRecommendation(data.data);
    } catch (err: any) {
      setFollowUpError(err.message || "AI follow-up recommendation is temporarily unavailable.");
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  const handleDraftFollowUp = async (conversationId: string) => {
    if (isFollowUpDraftLoading) return;
    setIsFollowUpDraftLoading(true);
    setFollowUpDraftError(null);
    
    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}/follow-up-draft`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "AI follow-up draft is temporarily unavailable.");
      }
      
      setReplyText(data.data.draft);
      // Focus textarea if we can find it
      const textarea = document.querySelector('textarea[placeholder="Message..."]') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.style.height = 'inherit';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
      }
    } catch (err: any) {
      setFollowUpDraftError(err.message || "AI follow-up draft is temporarily unavailable.");
    } finally {
      setIsFollowUpDraftLoading(false);
    }
  };

  const selectedConv = conversations.find(c => c.id === expandedId);

  return (
    <div className="flex h-full w-full bg-white text-gray-900 overflow-hidden divide-x divide-gray-200 text-sm">
      
      {/* --- COLUMN 1: INBOX NAVIGATION --- */}
      <div className="hidden lg:flex w-64 flex-col bg-gray-50 flex-shrink-0 h-full overflow-y-auto">
        <div className="p-4 py-5">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Inbox</h2>
        </div>

        {/* Platforms */}
        <div className="px-3 mb-6">
          <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Platform</p>
          <div className="space-y-0.5">
            <NavButton 
              active={channelFilter === "all"} 
              onClick={() => setChannelFilter("all")} 
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} 
              label="All Platforms" 
            />
            <NavButton 
              active={channelFilter === "messenger"} 
              onClick={() => setChannelFilter("messenger")} 
              icon={<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.145 2 11.26c0 2.923 1.488 5.485 3.791 7.158V22l3.454-1.895c1.233.342 2.553.526 3.93.526 5.523 0 10-4.145 10-9.26S17.523 2 12 2zm1.093 12.56-2.883-3.076-5.632 3.076 6.183-6.558 2.943 3.076 5.572-3.076-6.183 6.558z"/></svg>} 
              label="Messenger" 
            />
            <NavButton 
              active={channelFilter === "instagram"} 
              onClick={() => setChannelFilter("instagram")} 
              icon={<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>} 
              label="Instagram" 
            />
          </div>
        </div>

        {/* Filters */}
        <div className="px-3 mb-6">
          <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Filters</p>
          <div className="space-y-0.5">
            <NavButton 
              active={readStatus === "all" && activeStatus === "all"} 
              onClick={() => { setReadStatus("all"); setActiveStatus("all"); }} 
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>} 
              label="All Messages" 
              count={conversations.length}
            />
            <NavButton 
              active={readStatus === "unread"} 
              onClick={() => { setReadStatus("unread"); setActiveStatus("all"); }} 
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} 
              label="Unread" 
              count={conversations.filter(c => c.isUnread).length}
            />
            <NavButton 
              active={activeStatus === "pending"} 
              onClick={() => { setActiveStatus("pending"); setReadStatus("all"); }} 
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} 
              label="Pending" 
            />
            <NavButton 
              active={activeStatus === "sold"} 
              onClick={() => { setActiveStatus("sold"); setReadStatus("all"); }} 
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} 
              label="Sold" 
            />
            <NavButton 
              active={activeStatus === "lost"} 
              onClick={() => { setActiveStatus("lost"); setReadStatus("all"); setLeadFilter("all"); }} 
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} 
              label="Lost" 
            />
            <div className="pt-2 mt-2 border-t border-gray-200">
              <NavButton 
                active={leadFilter === "hot"} 
                onClick={() => setLeadFilter(leadFilter === "hot" ? "all" : "hot")} 
                icon={<span className="text-sm">🔥</span>} 
                label="Hot Leads" 
                count={conversations.filter(c => c.aiLeadTemperature === "hot").length}
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- COLUMN 2: CONVERSATION LIST --- */}
      <div className={`flex-col flex-shrink-0 w-full md:w-[320px] lg:w-[360px] bg-white h-full ${expandedId ? 'hidden md:flex' : 'flex'}`}>
        {/* Header & Search */}
        <div className="p-4 border-b border-gray-200 flex flex-col gap-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">Messages</h3>
            <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-full">{filtered.length}</span>
          </div>
          <div className="relative">
            <input
              type="search"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-100/80 border-transparent focus:border-blue-500 focus:bg-white focus:ring-0 rounded-lg pl-9 pr-4 py-2 text-sm transition-colors"
            />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        
        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-sm">No conversations found.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(c => {
                const isActive = expandedId === c.id;
                const latestMsg = c.messages[0];
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setExpandedId(c.id);
                      setReplyText("");
                      setAiSuggestions(null);
                      setAiError(null);
                      setConversationInsights(null);
                      setInsightsError(null);
                      setLeadIntelligence(null);
                      setLeadIntelligenceError(null);
                      setFollowUpRecommendation(null);
                      setFollowUpError(null);
                      setFollowUpDraftError(null);
                      if (c.isUnread) markAsRead(c.id);
                    }}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isActive ? 'bg-blue-50/40 relative' : ''}`}
                  >
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />}
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {c.isUnread && !isActive && <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />}
                        <p className={`text-sm truncate ${c.isUnread && !isActive ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>
                          {c.customer.name}
                        </p>
                        {c.aiLeadTemperature === 'hot' && <span title="Hot Lead" className="text-[10px]">🔥</span>}
                        {c.aiLeadTemperature === 'warm' && <span title="Warm Lead" className="text-[10px]">🟡</span>}
                        {c.followUpAt && !c.followUpCompleted && (
                          <span title="Follow-up scheduled" className="text-[10px]">
                            {new Date(c.followUpAt) < new Date() ? '🔴' : 
                             new Date(c.followUpAt).toDateString() === new Date().toDateString() ? '🟠' : '🟢'}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 whitespace-nowrap ml-2 flex-shrink-0">
                        {formatRelativeTime(c.lastMessageAt)}
                      </span>
                    </div>
                    
                    <p className={`text-sm truncate mb-2 ${c.isUnread && !isActive ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                      {latestMsg?.sender === "business" ? "You: " : ""}{latestMsg?.content || "No messages"}
                    </p>

                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${
                        ['won', 'sold'].includes(c.status) ? 'bg-green-100 text-green-700 border-green-200' :
                        c.status === 'lost' ? 'bg-red-100 text-red-700 border-red-200' :
                        'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                        {c.status}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium uppercase tracking-wider ${
                        c.channel.type === 'messenger' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                      }`}>
                        {c.channel.type}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* --- COLUMN 3: ACTIVE CHAT + INFO PANEL --- */}
      <div className={`flex-1 flex-col bg-white min-w-0 h-full ${expandedId ? 'flex' : 'hidden md:flex'}`}>
        {expandedId && selectedConv ? (
          <div className="flex h-full w-full relative">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
              {/* Header */}
              <div className="h-[73px] flex items-center px-4 border-b border-gray-200 justify-between flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button 
                    className="md:hidden p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-full" 
                    onClick={() => {
                      setExpandedId(null);
                      setAiSuggestions(null);
                      setAiError(null);
                      setConversationInsights(null);
                      setInsightsError(null);
                      setLeadIntelligence(null);
                      setLeadIntelligenceError(null);
                      setFollowUpRecommendation(null);
                      setFollowUpError(null);
                      setFollowUpDraftError(null);
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold flex-shrink-0">
                    {selectedConv.customer.name.charAt(0)}
                  </div>
                  <div className="truncate">
                    <h3 className="font-bold text-gray-900 truncate text-base">{selectedConv.customer.name}</h3>
                    <p className="text-xs text-gray-500 capitalize">{selectedConv.channel.displayName}</p>
                  </div>
                </div>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse bg-white scroll-smooth">
                {selectedConv.messages.length === 0 ? (
                  <div className="text-center py-10 my-auto">
                    <p className="text-gray-400 text-sm">No messages yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedConv.messages.slice().reverse().map((msg, i, arr) => {
                      const isBusiness = msg.sender === "business" || msg.sender === "ai_draft";
                      const prevMsg = i > 0 ? arr[i - 1] : null;
                      const showTime = !prevMsg || new Date(msg.sentAt).getTime() - new Date(prevMsg.sentAt).getTime() > 1000 * 60 * 30; // 30 mins

                      return (
                        <div key={msg.id} className="flex flex-col">
                          {showTime && (
                            <div className="text-center my-4">
                              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{formatFullTime(msg.sentAt)}</span>
                            </div>
                          )}
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-[15px] ${
                              isBusiness
                                ? msg.isFailed 
                                  ? "bg-red-50 border border-red-200 text-red-900 self-end rounded-tr-sm" 
                                  : "bg-blue-600 text-white self-end rounded-tr-sm"
                                : "bg-gray-100 text-gray-900 self-start rounded-tl-sm"
                            }`}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
                          </div>
                          
                          {/* Failure actions */}
                          {msg.isFailed && isBusiness && (
                            <div className="self-end mt-1 mr-1">
                              <button 
                                onClick={() => handleSendReply(selectedConv.id, msg.content, msg.id)}
                                disabled={isSending}
                                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                Failed to send. Click to retry.
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Composer */}
              <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0 flex flex-col gap-3">
                {selectedConv.channel.type === "messenger" ? (
                  <>
                    {/* AI Assistant Area */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.6H22l-6.2 4.8 2.3 7.6-6.1-4.7-6.1 4.7 2.3-7.6-6.2-4.8h7.6L12 2z"/></svg>
                          AI Assistant
                        </span>
                        {!aiSuggestions && !isAiLoading && (
                          <button
                            onClick={() => handleSuggestReplies(selectedConv.id)}
                            className="text-xs font-semibold text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-2.5 py-1 rounded-md transition-colors border border-purple-200 flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Suggest Replies
                          </button>
                        )}
                      </div>

                      {isAiLoading && (
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center gap-3">
                          <svg className="animate-spin h-5 w-5 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          <span className="text-sm font-medium text-gray-600">Analyzing conversation...</span>
                        </div>
                      )}

                      {aiError && (
                        <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-sm text-red-700 flex justify-between items-center">
                          <span>{aiError}</span>
                          <button onClick={() => setAiError(null)} className="text-red-500 hover:text-red-700"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                      )}

                      {aiSuggestions && (
                        <div className="flex gap-3 overflow-x-auto pb-2 snap-x scrollbar-thin scrollbar-thumb-gray-200">
                          {aiSuggestions.map((sug, i) => (
                            <div key={i} className="flex-shrink-0 w-[260px] p-3 bg-gradient-to-br from-white to-purple-50/30 rounded-xl border border-purple-100 shadow-sm flex flex-col justify-between snap-start">
                              <div>
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 mb-2">
                                  {sug.tone}
                                </span>
                                <p className="text-sm text-gray-700 line-clamp-3 mb-3 leading-relaxed">{sug.text}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setReplyText(sug.text);
                                }}
                                className="w-full text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 py-1.5 rounded-lg transition-colors shadow-sm"
                              >
                                Use Reply
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Chat Input */}
                    <div className="relative rounded-xl border border-gray-300 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all bg-white">
                      <textarea
                        placeholder="Message..."
                        className="w-full text-[15px] resize-none border-none focus:ring-0 p-3 pr-12 text-gray-900 bg-transparent placeholder-gray-400 rounded-xl max-h-32 min-h-[44px]"
                        rows={1}
                        value={replyText}
                        onChange={(e) => {
                          setReplyText(e.target.value);
                          e.target.style.height = 'inherit';
                          e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                        }}
                        disabled={isSending}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendReply(selectedConv.id, replyText);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleSendReply(selectedConv.id, replyText)}
                        disabled={!replyText.trim() || isSending}
                        className={`absolute right-2 bottom-2 p-1.5 rounded-full transition-colors flex items-center justify-center ${
                          !replyText.trim() || isSending
                            ? "text-gray-300"
                            : "text-blue-600 hover:bg-blue-50"
                        }`}
                      >
                        {isSending ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
                    <p className="text-sm text-gray-500 font-medium">
                      Replies are currently only supported for Messenger.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Info Panel (Right Sidebar) */}
            <div className="hidden xl:flex w-[280px] flex-col border-l border-gray-200 bg-white flex-shrink-0 h-full overflow-y-auto">
              <div className="p-6 text-center border-b border-gray-100 flex flex-col items-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-3xl mb-4">
                  {selectedConv.customer.name.charAt(0)}
                </div>
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{selectedConv.customer.name}</h3>
                <p className="text-sm text-gray-500 mt-1 capitalize">via {selectedConv.channel.type}</p>
                
                <div className="mt-4 flex gap-2 justify-center w-full">
                  <a href={`/customers/${selectedConv.customer.externalId || selectedConv.customer.name}`} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold py-2 px-4 rounded-lg transition-colors text-center">
                    View Profile
                  </a>
                </div>
              </div>
              
              <div className="p-5 space-y-6">
                {/* AI Conversation Intelligence */}
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Intelligence</h4>
                  {!conversationInsights && !isInsightsLoading && !insightsError && (
                    <button
                      onClick={() => handleAnalyzeConversation(selectedConv.id)}
                      className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      ✨ Analyze Conversation
                    </button>
                  )}

                  {isInsightsLoading && (
                    <div className="w-full flex items-center justify-center py-4 bg-gray-50 rounded-lg border border-gray-100">
                      <svg className="animate-spin h-5 w-5 text-purple-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span className="text-sm font-medium text-gray-600">Analyzing...</span>
                    </div>
                  )}

                  {insightsError && (
                    <div className="w-full p-3 bg-red-50 rounded-lg border border-red-100 flex flex-col items-center gap-2 text-center">
                      <span className="text-xs text-red-700">{insightsError}</span>
                      <button onClick={() => handleAnalyzeConversation(selectedConv.id)} className="text-xs font-semibold text-red-600 hover:text-red-800">
                        Retry
                      </button>
                    </div>
                  )}

                  {conversationInsights && (
                    <div className="w-full bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden flex flex-col">
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-3 py-2 border-b border-purple-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-800 tracking-wide">✨ Conversation Intelligence</span>
                      </div>
                      <div className="p-3 space-y-4">
                        
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Summary</p>
                          <p className="text-xs text-gray-800 leading-relaxed">{conversationInsights.summary}</p>
                        </div>
                        
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Intent</p>
                          <p className="text-xs text-gray-800 leading-relaxed">{conversationInsights.intent}</p>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Lead Temperature</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">
                              {conversationInsights.temperature === 'hot' ? '🔥' :
                               conversationInsights.temperature === 'warm' ? '🟡' :
                               conversationInsights.temperature === 'cold' ? '🔵' : '⚪'}
                            </span>
                            <span className="text-xs font-semibold text-gray-800 capitalize">{conversationInsights.temperature}</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Key Requirements</p>
                          {conversationInsights.requirements?.length > 0 ? (
                            <ul className="list-disc pl-3 text-xs text-gray-800 space-y-0.5">
                              {conversationInsights.requirements.map((req: string, i: number) => (
                                <li key={i}>{req}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-gray-500 italic">No specific requirements identified.</p>
                          )}
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Customer Concerns</p>
                          {conversationInsights.concerns?.length > 0 ? (
                            <ul className="list-disc pl-3 text-xs text-gray-800 space-y-0.5">
                              {conversationInsights.concerns.map((req: string, i: number) => (
                                <li key={i}>{req}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-gray-500 italic">No specific concerns identified.</p>
                          )}
                        </div>

                        <div className="bg-blue-50 -mx-3 -mb-3 p-3 border-t border-blue-100">
                          <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">Recommended Next Action</p>
                          <p className="text-xs text-blue-900 font-medium leading-relaxed">{conversationInsights.nextAction}</p>
                        </div>

                      </div>
                      <div className="border-t border-gray-100 p-2 bg-gray-50">
                        <button
                          onClick={() => handleAnalyzeConversation(selectedConv.id)}
                          disabled={isInsightsLoading}
                          className="w-full text-xs font-medium text-gray-600 hover:text-gray-900 py-1 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          ↻ Refresh Analysis
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Lead Scoring */}
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Lead Scoring</h4>
                  
                  {(!selectedConv.aiLeadScore && !isScoringLoading && !scoringError) && (
                    <button
                      onClick={() => handleScoreLead(selectedConv.id)}
                      className="w-full bg-gradient-to-r from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      ✨ Generate Lead Score
                    </button>
                  )}

                  {isScoringLoading && (
                    <div className="w-full flex items-center justify-center py-4 bg-gray-50 rounded-lg border border-gray-100">
                      <svg className="animate-spin h-5 w-5 text-orange-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span className="text-sm font-medium text-gray-600">Scoring...</span>
                    </div>
                  )}

                  {scoringError && (
                    <div className="w-full p-3 bg-red-50 rounded-lg border border-red-100 flex flex-col items-center gap-2 text-center">
                      <span className="text-xs text-red-700">{scoringError}</span>
                      <button onClick={() => handleScoreLead(selectedConv.id)} className="text-xs font-semibold text-red-600 hover:text-red-800">
                        Retry
                      </button>
                    </div>
                  )}

                  {selectedConv.aiLeadScore !== null && selectedConv.aiLeadTemperature && (
                    <div className="w-full bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden flex flex-col">
                      <div className="bg-gradient-to-r from-orange-50 to-red-50 px-3 py-2 border-b border-orange-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-orange-800 tracking-wide">✨ AI Lead Score</span>
                        <span className="text-[10px] text-gray-500">
                          {formatRelativeTime(selectedConv.aiLeadScoredAt!)}
                        </span>
                      </div>
                      <div className="p-3 space-y-4">
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Score</p>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {selectedConv.aiLeadScore >= 80 ? '🔥' : selectedConv.aiLeadScore >= 50 ? '🟡' : '🔵'}
                              </span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${selectedConv.aiLeadScore >= 80 ? 'bg-red-500' : selectedConv.aiLeadScore >= 50 ? 'bg-orange-400' : 'bg-blue-400'}`} style={{ width: `${selectedConv.aiLeadScore}%` }} />
                              </div>
                              <span className="text-xs font-bold text-gray-900">{selectedConv.aiLeadScore}/100</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Temp</p>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              selectedConv.aiLeadTemperature === 'hot' ? 'bg-red-50 text-red-700 border-red-200' :
                              selectedConv.aiLeadTemperature === 'warm' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              selectedConv.aiLeadTemperature === 'cold' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-gray-50 text-gray-600 border-gray-200'
                            }`}>
                              {selectedConv.aiLeadTemperature}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Intent</p>
                            <span className="text-xs font-semibold text-gray-800 capitalize">{selectedConv.aiLeadIntent}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Confidence</p>
                            <span className="text-xs font-semibold text-gray-800 capitalize">{selectedConv.aiLeadConfidence}</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Key Reasons</p>
                          {selectedConv.aiLeadReasons && Array.isArray(selectedConv.aiLeadReasons) && selectedConv.aiLeadReasons.length > 0 ? (
                            <ul className="list-disc pl-3 text-xs text-gray-800 space-y-1">
                              {selectedConv.aiLeadReasons.map((r: string, i: number) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-gray-500 italic">No specific reasons provided.</p>
                          )}
                        </div>
                      </div>
                      <div className="border-t border-gray-100 p-2 bg-gray-50">
                        <button
                          onClick={() => handleScoreLead(selectedConv.id)}
                          disabled={isScoringLoading}
                          className="w-full text-xs font-medium text-gray-600 hover:text-gray-900 py-1 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          ↻ Re-score Lead
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Lead Intelligence */}
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Lead Intelligence</h4>
                  {!leadIntelligence && !isLeadIntelligenceLoading && !leadIntelligenceError && (
                    <button
                      onClick={() => handleAnalyzeLead(selectedConv.id)}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      ✨ Analyze Lead
                    </button>
                  )}

                  {isLeadIntelligenceLoading && (
                    <div className="w-full flex items-center justify-center py-4 bg-gray-50 rounded-lg border border-gray-100">
                      <svg className="animate-spin h-5 w-5 text-emerald-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span className="text-sm font-medium text-gray-600">Analyzing Lead...</span>
                    </div>
                  )}

                  {leadIntelligenceError && (
                    <div className="w-full p-3 bg-red-50 rounded-lg border border-red-100 flex flex-col items-center gap-2 text-center">
                      <span className="text-xs text-red-700">{leadIntelligenceError}</span>
                      <button onClick={() => handleAnalyzeLead(selectedConv.id)} className="text-xs font-semibold text-red-600 hover:text-red-800">
                        Retry
                      </button>
                    </div>
                  )}

                  {leadIntelligence && (
                    <div className="w-full bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden flex flex-col">
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2 border-b border-emerald-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800 tracking-wide">✨ AI Lead Intelligence</span>
                      </div>
                      <div className="p-3 space-y-4">
                        
                        {/* Score & Intent */}
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Lead Score</p>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🔥</span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${leadIntelligence.leadScore}%` }} />
                              </div>
                              <span className="text-xs font-bold text-gray-900">{leadIntelligence.leadScore}/100</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Intent</p>
                            <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              leadIntelligence.buyingIntent === 'high' ? 'bg-green-50 text-green-700 border-green-200' :
                              leadIntelligence.buyingIntent === 'medium' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              leadIntelligence.buyingIntent === 'low' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                              'bg-gray-50 text-gray-500 border-gray-200'
                            }`}>
                              {leadIntelligence.buyingIntent}
                            </span>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Conversion Probability</p>
                          <p className="text-sm font-bold text-gray-900">{leadIntelligence.conversionProbability}%</p>
                        </div>

                        {/* Recommendations */}
                        <div className="space-y-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rec. Status</p>
                              <p className="text-xs font-bold text-gray-900 capitalize">{leadIntelligence.recommendedStatus}</p>
                            </div>
                            {selectedConv.status !== leadIntelligence.recommendedStatus && (
                              <button 
                                onClick={() => applyLeadIntelligence(selectedConv.id, { status: leadIntelligence.recommendedStatus })}
                                className="text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-2 py-1 rounded shadow-sm transition-colors"
                              >
                                Apply
                              </button>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-3">
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rec. Priority</p>
                              <p className="text-xs font-bold text-gray-900 capitalize">{leadIntelligence.recommendedPriority}</p>
                            </div>
                            {selectedConv.priority !== leadIntelligence.recommendedPriority && (
                              <button 
                                onClick={() => applyLeadIntelligence(selectedConv.id, { priority: leadIntelligence.recommendedPriority })}
                                className="text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-2 py-1 rounded shadow-sm transition-colors"
                              >
                                Apply
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Follow up */}
                        {leadIntelligence.followUpRecommended && (
                          <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                            <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">Follow-up Recommendation</p>
                            <p className="text-xs text-blue-900 mb-1">
                              {leadIntelligence.recommendedFollowUpHours ? `Follow up in approximately ${leadIntelligence.recommendedFollowUpHours} hours` : "Follow up soon"}
                            </p>
                            <p className="text-[11px] text-blue-800/80 mb-2 leading-relaxed">
                              "{leadIntelligence.followUpReason}"
                            </p>
                            <button
                              onClick={() => {
                                const hours = leadIntelligence.recommendedFollowUpHours || 24;
                                const dt = new Date(Date.now() + hours * 60 * 60 * 1000);
                                applyLeadIntelligence(selectedConv.id, { followUpAt: dt.toISOString(), followUpCompleted: false });
                              }}
                              className="w-full text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 py-1.5 rounded-md transition-colors"
                            >
                              Schedule Follow-up
                            </button>
                          </div>
                        )}

                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Risks</p>
                          {leadIntelligence.risks?.length > 0 ? (
                            <ul className="list-disc pl-3 text-xs text-red-800 space-y-0.5">
                              {leadIntelligence.risks.map((risk: string, i: number) => (
                                <li key={i}>{risk}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-emerald-700 italic">No significant risks detected.</p>
                          )}
                        </div>

                        <div className="bg-emerald-50 -mx-3 -mb-3 p-3 border-t border-emerald-100">
                          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Next Best Action</p>
                          <p className="text-xs text-emerald-900 font-medium leading-relaxed">{leadIntelligence.nextBestAction}</p>
                        </div>

                      </div>
                    </div>
                  )}
                </div>

                {/* AI Follow-up */}
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">AI Follow-up</h4>
                  
                  {(!followUpRecommendation && !isFollowUpLoading && !followUpError) && (
                    <button
                      onClick={() => handleRecommendFollowUp(selectedConv.id)}
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      ✨ Recommend Follow-up
                    </button>
                  )}

                  {isFollowUpLoading && (
                    <div className="w-full flex items-center justify-center py-4 bg-gray-50 rounded-lg border border-gray-100">
                      <svg className="animate-spin h-5 w-5 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span className="text-sm font-medium text-gray-600">Analyzing...</span>
                    </div>
                  )}

                  {followUpError && (
                    <div className="w-full p-3 bg-red-50 rounded-lg border border-red-100 flex flex-col items-center gap-2 text-center">
                      <span className="text-xs text-red-700">{followUpError}</span>
                      <button onClick={() => handleRecommendFollowUp(selectedConv.id)} className="text-xs font-semibold text-red-600 hover:text-red-800">
                        Retry
                      </button>
                    </div>
                  )}

                  {followUpRecommendation && (
                    <div className="w-full bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden flex flex-col">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 border-b border-blue-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-800 tracking-wide">✨ AI Follow-up Recommendation</span>
                      </div>
                      <div className="p-3 space-y-4">
                        {followUpRecommendation.shouldFollowUp ? (
                          <>
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Should Follow Up</p>
                                <span className="text-xs font-bold text-green-700">Yes</span>
                              </div>
                              <div className="flex-1">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Urgency</p>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                  followUpRecommendation.urgency === 'urgent' ? 'bg-red-50 text-red-700 border-red-200' :
                                  followUpRecommendation.urgency === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                  'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                  {followUpRecommendation.urgency}
                                </span>
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Suggested Time</p>
                              <p className="text-xs font-bold text-gray-900">{followUpRecommendation.suggestedTimeframe}</p>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Reason</p>
                              <p className="text-xs text-gray-800 leading-relaxed">{followUpRecommendation.reason}</p>
                            </div>

                            <div className="bg-blue-50 -mx-3 -mb-3 p-3 border-t border-blue-100">
                              <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">Recommended Action</p>
                              <p className="text-xs text-blue-900 font-medium leading-relaxed">{followUpRecommendation.recommendedAction}</p>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-2">
                            <p className="text-xs font-medium text-gray-600">No immediate follow-up recommended.</p>
                            <p className="text-[10px] text-gray-500 mt-1">{followUpRecommendation.reason}</p>
                          </div>
                        )}
                      </div>

                      {followUpRecommendation.shouldFollowUp && (
                        <div className="border-t border-gray-100 p-3 bg-gray-50 flex flex-col gap-2">
                          <button
                            onClick={() => {
                              if (followUpRecommendation.suggestedFollowUpAt) {
                                handleLeadUpdate({ followUpAt: followUpRecommendation.suggestedFollowUpAt, followUpCompleted: false });
                              }
                              const el = document.getElementById("lead-controls");
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="w-full text-xs font-bold bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 py-1.5 rounded-lg transition-colors shadow-sm"
                          >
                            Schedule Follow-up
                          </button>
                          
                          <button
                            onClick={() => handleDraftFollowUp(selectedConv.id)}
                            disabled={isFollowUpDraftLoading}
                            className="w-full text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 py-1.5 rounded-lg transition-colors shadow-sm flex justify-center items-center gap-2 disabled:opacity-50"
                          >
                            {isFollowUpDraftLoading ? (
                              <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : "✨ Draft Follow-up Message"}
                          </button>
                          
                          {followUpDraftError && (
                            <p className="text-[10px] text-red-600 text-center mt-1">{followUpDraftError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <CustomerMemoryClient customerId={selectedConv.customer.id} />
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tags</h4>
                  <CustomerTags 
                    customerId={selectedConv.customer.id} 
                    initialAssignedTags={selectedConv.customer.tags?.map((t: { tag: CustomerTag }) => t.tag) || []} 
                  />
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
                  <CustomerNotes customerId={selectedConv.customer.id} />
                </div>

                <div id="lead-controls" className="border-t border-gray-100 pt-5">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Lead Management</h4>
                  <LeadControls 
                    conversationId={selectedConv.id}
                    status={selectedConv.status}
                    priority={selectedConv.priority}
                    estimatedValue={selectedConv.estimatedValue}
                    followUpAt={selectedConv.followUpAt}
                    followUpCompleted={selectedConv.followUpCompleted}
                    onUpdate={handleLeadUpdate}
                  />
                </div>

                {selectedConv.reason && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Reason</h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
                      {selectedConv.reason}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Drawer (Overlay) */}
            {isMobileDrawerOpen && (
              <div className="fixed inset-0 z-50 flex xl:hidden">
                <div 
                  className="fixed inset-0 bg-black/30 backdrop-blur-sm"
                  onClick={() => setIsMobileDrawerOpen(false)}
                />
                <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-[320px] bg-white shadow-xl overflow-y-auto flex flex-col">
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h3 className="font-bold text-gray-900">Customer Info</h3>
                    <button 
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="p-6 text-center border-b border-gray-100 flex flex-col items-center bg-gray-50/50">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-2xl mb-3">
                      {selectedConv.customer.name.charAt(0)}
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight">{selectedConv.customer.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 capitalize">via {selectedConv.channel.type}</p>
                    
                    <a href={`/customers/${selectedConv.customer.externalId || selectedConv.customer.name}`} className="mt-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 text-xs font-semibold py-1.5 px-4 rounded-lg transition-colors inline-block shadow-sm">
                      View Profile
                    </a>
                  </div>
                  
                  <div className="p-5 space-y-6 flex-1">
                    {/* AI Conversation Intelligence */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Intelligence</h4>
                      {!conversationInsights && !isInsightsLoading && !insightsError && (
                        <button
                          onClick={() => handleAnalyzeConversation(selectedConv.id)}
                          className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
                        >
                          ✨ Analyze Conversation
                        </button>
                      )}

                      {isInsightsLoading && (
                        <div className="w-full flex items-center justify-center py-4 bg-gray-50 rounded-lg border border-gray-100">
                          <svg className="animate-spin h-5 w-5 text-purple-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          <span className="text-sm font-medium text-gray-600">Analyzing...</span>
                        </div>
                      )}

                      {insightsError && (
                        <div className="w-full p-3 bg-red-50 rounded-lg border border-red-100 flex flex-col items-center gap-2 text-center">
                          <span className="text-xs text-red-700">{insightsError}</span>
                          <button onClick={() => handleAnalyzeConversation(selectedConv.id)} className="text-xs font-semibold text-red-600 hover:text-red-800">
                            Retry
                          </button>
                        </div>
                      )}

                      {conversationInsights && (
                        <div className="w-full bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden flex flex-col">
                          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-3 py-2 border-b border-purple-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-800 tracking-wide">✨ Conversation Intelligence</span>
                          </div>
                          <div className="p-3 space-y-4">
                            
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Summary</p>
                              <p className="text-xs text-gray-800 leading-relaxed">{conversationInsights.summary}</p>
                            </div>
                            
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Intent</p>
                              <p className="text-xs text-gray-800 leading-relaxed">{conversationInsights.intent}</p>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Lead Temperature</p>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">
                                  {conversationInsights.temperature === 'hot' ? '🔥' :
                                   conversationInsights.temperature === 'warm' ? '🟡' :
                                   conversationInsights.temperature === 'cold' ? '🔵' : '⚪'}
                                </span>
                                <span className="text-xs font-semibold text-gray-800 capitalize">{conversationInsights.temperature}</span>
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Key Requirements</p>
                              {conversationInsights.requirements?.length > 0 ? (
                                <ul className="list-disc pl-3 text-xs text-gray-800 space-y-0.5">
                                  {conversationInsights.requirements.map((req: string, i: number) => (
                                    <li key={i}>{req}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-gray-500 italic">No specific requirements identified.</p>
                              )}
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Customer Concerns</p>
                              {conversationInsights.concerns?.length > 0 ? (
                                <ul className="list-disc pl-3 text-xs text-gray-800 space-y-0.5">
                                  {conversationInsights.concerns.map((req: string, i: number) => (
                                    <li key={i}>{req}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-gray-500 italic">No specific concerns identified.</p>
                              )}
                            </div>

                            <div className="bg-blue-50 -mx-3 -mb-3 p-3 border-t border-blue-100">
                              <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">Recommended Next Action</p>
                              <p className="text-xs text-blue-900 font-medium leading-relaxed">{conversationInsights.nextAction}</p>
                            </div>

                          </div>
                          <div className="border-t border-gray-100 p-2 bg-gray-50">
                            <button
                              onClick={() => handleAnalyzeConversation(selectedConv.id)}
                              disabled={isInsightsLoading}
                              className="w-full text-xs font-medium text-gray-600 hover:text-gray-900 py-1 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              ↻ Refresh Analysis
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI Lead Intelligence (Mobile) */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Lead Intelligence</h4>
                      {!leadIntelligence && !isLeadIntelligenceLoading && !leadIntelligenceError && (
                        <button
                          onClick={() => handleAnalyzeLead(selectedConv.id)}
                          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
                        >
                          ✨ Analyze Lead
                        </button>
                      )}

                      {isLeadIntelligenceLoading && (
                        <div className="w-full flex items-center justify-center py-4 bg-gray-50 rounded-lg border border-gray-100">
                          <svg className="animate-spin h-5 w-5 text-emerald-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          <span className="text-sm font-medium text-gray-600">Analyzing Lead...</span>
                        </div>
                      )}

                      {leadIntelligenceError && (
                        <div className="w-full p-3 bg-red-50 rounded-lg border border-red-100 flex flex-col items-center gap-2 text-center">
                          <span className="text-xs text-red-700">{leadIntelligenceError}</span>
                          <button onClick={() => handleAnalyzeLead(selectedConv.id)} className="text-xs font-semibold text-red-600 hover:text-red-800">
                            Retry
                          </button>
                        </div>
                      )}

                      {leadIntelligence && (
                        <div className="w-full bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden flex flex-col">
                          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2 border-b border-emerald-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-800 tracking-wide">✨ AI Lead Intelligence</span>
                          </div>
                          <div className="p-3 space-y-4">
                            
                            {/* Score & Intent */}
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Lead Score</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">🔥</span>
                                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${leadIntelligence.leadScore}%` }} />
                                  </div>
                                  <span className="text-xs font-bold text-gray-900">{leadIntelligence.leadScore}/100</span>
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Intent</p>
                                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                  leadIntelligence.buyingIntent === 'high' ? 'bg-green-50 text-green-700 border-green-200' :
                                  leadIntelligence.buyingIntent === 'medium' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  leadIntelligence.buyingIntent === 'low' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                                  'bg-gray-50 text-gray-500 border-gray-200'
                                }`}>
                                  {leadIntelligence.buyingIntent}
                                </span>
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Conversion Probability</p>
                              <p className="text-sm font-bold text-gray-900">{leadIntelligence.conversionProbability}%</p>
                            </div>

                            {/* Recommendations */}
                            <div className="space-y-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rec. Status</p>
                                  <p className="text-xs font-bold text-gray-900 capitalize">{leadIntelligence.recommendedStatus}</p>
                                </div>
                                {selectedConv.status !== leadIntelligence.recommendedStatus && (
                                  <button 
                                    onClick={() => applyLeadIntelligence(selectedConv.id, { status: leadIntelligence.recommendedStatus })}
                                    className="text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-2 py-1 rounded shadow-sm transition-colors"
                                  >
                                    Apply
                                  </button>
                                )}
                              </div>
                              
                              <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-3">
                                <div>
                                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rec. Priority</p>
                                  <p className="text-xs font-bold text-gray-900 capitalize">{leadIntelligence.recommendedPriority}</p>
                                </div>
                                {selectedConv.priority !== leadIntelligence.recommendedPriority && (
                                  <button 
                                    onClick={() => applyLeadIntelligence(selectedConv.id, { priority: leadIntelligence.recommendedPriority })}
                                    className="text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-2 py-1 rounded shadow-sm transition-colors"
                                  >
                                    Apply
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Follow up */}
                            {leadIntelligence.followUpRecommended && (
                              <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                                <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">Follow-up Recommendation</p>
                                <p className="text-xs text-blue-900 mb-1">
                                  {leadIntelligence.recommendedFollowUpHours ? `Follow up in approximately ${leadIntelligence.recommendedFollowUpHours} hours` : "Follow up soon"}
                                </p>
                                <p className="text-[11px] text-blue-800/80 mb-2 leading-relaxed">
                                  "{leadIntelligence.followUpReason}"
                                </p>
                                <button
                                  onClick={() => {
                                    const hours = leadIntelligence.recommendedFollowUpHours || 24;
                                    const dt = new Date(Date.now() + hours * 60 * 60 * 1000);
                                    applyLeadIntelligence(selectedConv.id, { followUpAt: dt.toISOString(), followUpCompleted: false });
                                  }}
                                  className="w-full text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 py-1.5 rounded-md transition-colors"
                                >
                                  Schedule Follow-up
                                </button>
                              </div>
                            )}

                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Risks</p>
                              {leadIntelligence.risks?.length > 0 ? (
                                <ul className="list-disc pl-3 text-xs text-red-800 space-y-0.5">
                                  {leadIntelligence.risks.map((risk: string, i: number) => (
                                    <li key={i}>{risk}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-emerald-700 italic">No significant risks detected.</p>
                              )}
                            </div>

                            <div className="bg-emerald-50 -mx-3 -mb-3 p-3 border-t border-emerald-100">
                              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Next Best Action</p>
                              <p className="text-xs text-emerald-900 font-medium leading-relaxed">{leadIntelligence.nextBestAction}</p>
                            </div>

                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI Follow-up (Mobile) */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">AI Follow-up</h4>
                      
                      {(!followUpRecommendation && !isFollowUpLoading && !followUpError) && (
                        <button
                          onClick={() => handleRecommendFollowUp(selectedConv.id)}
                          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
                        >
                          ✨ Recommend Follow-up
                        </button>
                      )}

                      {isFollowUpLoading && (
                        <div className="w-full flex items-center justify-center py-4 bg-gray-50 rounded-lg border border-gray-100">
                          <svg className="animate-spin h-5 w-5 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          <span className="text-sm font-medium text-gray-600">Analyzing...</span>
                        </div>
                      )}

                      {followUpError && (
                        <div className="w-full p-3 bg-red-50 rounded-lg border border-red-100 flex flex-col items-center gap-2 text-center">
                          <span className="text-xs text-red-700">{followUpError}</span>
                          <button onClick={() => handleRecommendFollowUp(selectedConv.id)} className="text-xs font-semibold text-red-600 hover:text-red-800">
                            Retry
                          </button>
                        </div>
                      )}

                      {followUpRecommendation && (
                        <div className="w-full bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden flex flex-col">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 border-b border-blue-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-800 tracking-wide">✨ AI Follow-up Recommendation</span>
                          </div>
                          <div className="p-3 space-y-4">
                            {followUpRecommendation.shouldFollowUp ? (
                              <>
                                <div className="flex gap-4">
                                  <div className="flex-1">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Should Follow Up</p>
                                    <span className="text-xs font-bold text-green-700">Yes</span>
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Urgency</p>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                      followUpRecommendation.urgency === 'urgent' ? 'bg-red-50 text-red-700 border-red-200' :
                                      followUpRecommendation.urgency === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                      'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}>
                                      {followUpRecommendation.urgency}
                                    </span>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Suggested Time</p>
                                  <p className="text-xs font-bold text-gray-900">{followUpRecommendation.suggestedTimeframe}</p>
                                </div>

                                <div>
                                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Reason</p>
                                  <p className="text-xs text-gray-800 leading-relaxed">{followUpRecommendation.reason}</p>
                                </div>

                                <div className="bg-blue-50 -mx-3 -mb-3 p-3 border-t border-blue-100">
                                  <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">Recommended Action</p>
                                  <p className="text-xs text-blue-900 font-medium leading-relaxed">{followUpRecommendation.recommendedAction}</p>
                                </div>
                              </>
                            ) : (
                              <div className="text-center py-2">
                                <p className="text-xs font-medium text-gray-600">No immediate follow-up recommended.</p>
                                <p className="text-[10px] text-gray-500 mt-1">{followUpRecommendation.reason}</p>
                              </div>
                            )}
                          </div>

                          {followUpRecommendation.shouldFollowUp && (
                            <div className="border-t border-gray-100 p-3 bg-gray-50 flex flex-col gap-2">
                              <button
                                onClick={() => {
                                  if (followUpRecommendation.suggestedFollowUpAt) {
                                    handleLeadUpdate({ followUpAt: followUpRecommendation.suggestedFollowUpAt, followUpCompleted: false });
                                  }
                                  const el = document.getElementById("lead-controls");
                                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="w-full text-xs font-bold bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 py-1.5 rounded-lg transition-colors shadow-sm"
                              >
                                Schedule Follow-up
                              </button>
                              
                              <button
                                onClick={() => handleDraftFollowUp(selectedConv.id)}
                                disabled={isFollowUpDraftLoading}
                                className="w-full text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 py-1.5 rounded-lg transition-colors shadow-sm flex justify-center items-center gap-2 disabled:opacity-50"
                              >
                                {isFollowUpDraftLoading ? (
                                  <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : "✨ Draft Follow-up Message"}
                              </button>
                              
                              {followUpDraftError && (
                                <p className="text-[10px] text-red-600 text-center mt-1">{followUpDraftError}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <CustomerMemoryClient customerId={selectedConv.customer.id} />
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tags</h4>
                      <CustomerTags 
                        customerId={selectedConv.customer.id} 
                        initialAssignedTags={selectedConv.customer.tags?.map((t: { tag: CustomerTag }) => t.tag) || []} 
                      />
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
                      <CustomerNotes customerId={selectedConv.customer.id} />
                    </div>

                    <div id="lead-controls" className="border-t border-gray-100 pt-5">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Lead Management</h4>
                      <LeadControls 
                        conversationId={selectedConv.id}
                        status={selectedConv.status}
                        priority={selectedConv.priority}
                        estimatedValue={selectedConv.estimatedValue}
                        followUpAt={selectedConv.followUpAt}
                        followUpCompleted={selectedConv.followUpCompleted}
                        onUpdate={handleLeadUpdate}
                      />
                    </div>

                    {selectedConv.reason && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Reason</h4>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
                          {selectedConv.reason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
            <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="font-semibold text-gray-600 text-lg">Select a conversation</p>
            <p className="text-sm mt-1">Choose a thread from the list to view messages</p>
          </div>
        )}
      </div>

    </div>
  );
}

function NavButton({ active, onClick, icon, label, count }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? "bg-gray-200/60 text-gray-900" 
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={active ? "text-blue-600" : "text-gray-400"}>
          {icon}
        </div>
        {label}
      </div>
      {count !== undefined && count > 0 && (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${active ? "bg-white text-gray-900 shadow-sm" : "bg-gray-200 text-gray-600"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

export function ThreadsClient({ conversations }: { conversations: ConversationRow[] }) {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-gray-500 animate-pulse">Loading inbox...</div>}>
      <ThreadsClientInner initialConversations={conversations} />
    </Suspense>
  );
}
