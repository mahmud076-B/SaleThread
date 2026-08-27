"use client";

export function TodayActions({
  draftId,
  conversationId,
}: {
  draftId: string;
  conversationId: string;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        id={`send-btn-${draftId}`}
        onClick={() =>
          console.log("[stub] Send draft", { draftId, conversationId })
        }
        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-3 py-2 transition-colors"
      >
        Send
      </button>
      <button
        id={`edit-btn-${draftId}`}
        onClick={() =>
          console.log("[stub] Edit draft", { draftId, conversationId })
        }
        className="flex-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg px-3 py-2 transition-colors"
      >
        Edit
      </button>
      <button
        id={`skip-btn-${draftId}`}
        onClick={() =>
          console.log("[stub] Skip draft", { draftId, conversationId })
        }
        className="px-3 py-2 text-gray-400 hover:text-gray-600 text-sm transition-colors"
      >
        Skip
      </button>
    </div>
  );
}
