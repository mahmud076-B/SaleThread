"use client";

import { useState, useEffect } from "react";
import type { ConversationStatus, ConversationPriority } from "@prisma/client";

// What the API accepts (estimatedValue is a number for the API, string|null for display)
interface LeadUpdatePayload {
  status?: ConversationStatus;
  priority?: ConversationPriority;
  estimatedValue?: number | null;
  followUpAt?: string | null;
  followUpCompleted?: boolean;
}

// What the parent component state looks like for these fields
interface LeadOptimisticUpdate {
  status?: ConversationStatus;
  priority?: ConversationPriority;
  estimatedValue?: string | null;
  followUpAt?: string | null;
  followUpCompleted?: boolean;
}

interface LeadControlsProps {
  conversationId: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  estimatedValue: string | null;
  followUpAt: string | null;
  followUpCompleted: boolean;
  onUpdate: (data: LeadOptimisticUpdate) => void;
}

export function LeadControls({
  conversationId,
  status,
  priority,
  estimatedValue,
  followUpAt,
  followUpCompleted,
  onUpdate
}: LeadControlsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For deal value edit state
  const [isEditingDeal, setIsEditingDeal] = useState(false);
  const [dealInput, setDealInput] = useState(estimatedValue || "");

  // For follow-up edit state
  const [isEditingFollowUp, setIsEditingFollowUp] = useState(false);
  const [followUpInput, setFollowUpInput] = useState(() => {
    if (!followUpAt) return "";
    // format to YYYY-MM-DDThh:mm for datetime-local input
    const d = new Date(followUpAt);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  // Reset input state when the selected conversation changes.
  // We intentionally only depend on conversationId — we want to reset UI
  // state to the new conversation's values without re-triggering on every
  // prop change (which would fight user edits mid-interaction).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setDealInput(estimatedValue || "");
    if (followUpAt) {
      const d = new Date(followUpAt);
      setFollowUpInput(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    } else {
      setFollowUpInput("");
    }
    setIsEditingDeal(false);
    setIsEditingFollowUp(false);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const handleUpdate = async (
    apiPayload: LeadUpdatePayload,
    optimisticData: LeadOptimisticUpdate
  ) => {
    setIsUpdating(true);
    setError(null);

    // Save previous state for rollback
    const prevState: LeadOptimisticUpdate = {
      status,
      priority,
      estimatedValue,
      followUpAt,
      followUpCompleted,
    };

    // Optimistic update
    onUpdate(optimisticData);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/lead`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload),
      });

      if (!res.ok) {
        throw new Error("Failed to update");
      }
    } catch {
      setError("Update failed, reverted.");
      onUpdate(prevState); // Rollback
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded">{error}</div>}
      
      {/* Status & Priority */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Status</label>
          <select 
            value={status}
            onChange={(e) => {
              const newStatus = e.target.value as ConversationStatus;
              handleUpdate({ status: newStatus }, { status: newStatus });
            }}
            disabled={isUpdating}
            className="w-full text-sm font-medium bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-800 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-colors"
          >
            <optgroup label="Active">
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="qualified">Qualified</option>
            </optgroup>
            <optgroup label="Closed">
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </optgroup>
            {/* Legacy ones if selected */}
            {(status === 'pending' || status === 'sold') && (
              <optgroup label="Legacy">
                {status === 'pending' && <option value="pending">Pending</option>}
                {status === 'sold' && <option value="sold">Sold (Legacy)</option>}
              </optgroup>
            )}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Priority</label>
          <select 
            value={priority}
            onChange={(e) => {
              const newPriority = e.target.value as ConversationPriority;
              handleUpdate({ priority: newPriority }, { priority: newPriority });
            }}
            disabled={isUpdating}
            className={`w-full text-sm font-bold border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors ${
              priority === 'urgent' ? 'bg-red-50 border-red-200 text-red-700 focus:ring-red-500/20' :
              priority === 'high' ? 'bg-orange-50 border-orange-200 text-orange-700 focus:ring-orange-500/20' :
              'bg-gray-50 border-gray-200 text-gray-700 focus:ring-gray-500/20 hover:border-gray-300'
            }`}
          >
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Deal Value */}
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Deal Value</label>
        {isEditingDeal ? (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">৳</span>
              <input 
                type="number"
                min="0"
                step="0.01"
                value={dealInput}
                onChange={(e) => setDealInput(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg pl-6 pr-2.5 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="0.00"
                autoFocus
              />
            </div>
            <button 
              onClick={() => {
                setIsEditingDeal(false);
                const val = parseFloat(dealInput);
                if (!isNaN(val) && val >= 0) {
                  // API gets number, optimistic state gets string representation
                  handleUpdate(
                    { estimatedValue: val },
                    { estimatedValue: val.toString() }
                  );
                } else if (dealInput === "") {
                  handleUpdate(
                    { estimatedValue: null },
                    { estimatedValue: null }
                  );
                }
              }}
              className="text-xs font-semibold bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              Save
            </button>
            <button 
              onClick={() => {
                setIsEditingDeal(false);
                setDealInput(estimatedValue || "");
              }}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div 
            onClick={() => setIsEditingDeal(true)}
            className="group cursor-text flex items-center justify-between text-sm bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 hover:bg-gray-100 transition-colors"
          >
            <span className={estimatedValue ? "font-bold text-gray-900" : "text-gray-400 font-medium"}>
              {estimatedValue ? `৳${Number(estimatedValue).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "Set value..."}
            </span>
            <span className="text-[10px] font-medium text-gray-400 group-hover:text-gray-600">Edit</span>
          </div>
        )}
      </div>

      {/* Follow Up */}
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Follow-up</label>
        {isEditingFollowUp ? (
          <div className="space-y-2">
            <input 
              type="datetime-local"
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setIsEditingFollowUp(false);
                  if (followUpInput) {
                    const dt = new Date(followUpInput);
                    const isoStr = dt.toISOString();
                    handleUpdate(
                      { followUpAt: isoStr, followUpCompleted: false },
                      { followUpAt: isoStr, followUpCompleted: false }
                    );
                  } else {
                    handleUpdate(
                      { followUpAt: null, followUpCompleted: false },
                      { followUpAt: null, followUpCompleted: false }
                    );
                  }
                }}
                className="flex-1 text-xs font-semibold bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800"
              >
                Save
              </button>
              <button 
                onClick={() => setIsEditingFollowUp(false)}
                className="flex-1 text-xs font-medium bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div 
              onClick={() => setIsEditingFollowUp(true)}
              className={`group cursor-pointer flex items-center justify-between text-sm border rounded-lg px-2.5 py-1.5 transition-colors ${
                followUpAt 
                  ? followUpCompleted 
                    ? "bg-gray-50 border-gray-200 text-gray-500 line-through" 
                    : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  : "bg-gray-50 border-gray-100 text-gray-400 font-medium hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className={followUpAt && !followUpCompleted ? "font-bold" : ""}>
                  {followUpAt 
                    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(followUpAt))
                    : "Schedule follow-up..."
                  }
                </span>
              </div>
            </div>
            
            {followUpAt && (
              <div className="flex gap-2">
                {!followUpCompleted && (
                  <button 
                    onClick={() => handleUpdate({ followUpCompleted: true }, { followUpCompleted: true })}
                    disabled={isUpdating}
                    className="flex-1 text-[11px] font-bold bg-green-50 text-green-700 border border-green-200 py-1 rounded hover:bg-green-100 transition-colors"
                  >
                    Mark Done
                  </button>
                )}
                <button 
                  onClick={() => handleUpdate(
                    { followUpAt: null, followUpCompleted: false },
                    { followUpAt: null, followUpCompleted: false }
                  )}
                  disabled={isUpdating}
                  className="flex-1 text-[11px] font-bold bg-gray-50 text-gray-600 border border-gray-200 py-1 rounded hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
