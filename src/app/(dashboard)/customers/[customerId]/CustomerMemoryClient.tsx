"use client";

import { useState } from "react";
import type { CustomerMemoryResult } from "@/lib/ai";

export function CustomerMemoryClient({ customerId }: { customerId: string }) {
  const [memory, setMemory] = useState<CustomerMemoryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateMemory() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai/customers/${customerId}/memory`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate memory");
      }

      const data = await response.json();
      setMemory(data.memory);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-blue-100 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          ✨ Customer Memory
        </h2>
        {memory && (
          <button
            onClick={generateMemory}
            disabled={isLoading}
            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            ↻ Refresh Memory
          </button>
        )}
      </div>

      {!memory && !isLoading && !error && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 mb-4">
            AI can analyze this customer&apos;s history to provide a concise summary.
          </p>
          <button
            onClick={generateMemory}
            className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
          >
            ✨ Generate Memory
          </button>
        </div>
      )}

      {isLoading && (
        <div className="py-8 flex flex-col items-center justify-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-500 animate-pulse">Analyzing customer history...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {memory && !isLoading && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Summary</h3>
            <p className="text-sm text-gray-800 leading-relaxed">{memory.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Key Facts</h3>
              {memory.keyFacts.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                  {memory.keyFacts.map((fact, i) => (
                    <li key={i}>{fact}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic">None identified</p>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Preferences</h3>
              {memory.preferences.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                  {memory.preferences.map((pref, i) => (
                    <li key={i}>{pref}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic">None identified</p>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Past Interactions</h3>
              {memory.pastInteractions.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                  {memory.pastInteractions.map((interaction, i) => (
                    <li key={i}>{interaction}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic">None identified</p>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Unresolved Issues</h3>
              {memory.unresolvedIssues.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  {memory.unresolvedIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic">None identified</p>
              )}
            </div>
          </div>

          <div className="bg-yellow-50/50 p-4 rounded-lg border border-yellow-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Important Notes</h3>
            {memory.importantNotes.length > 0 ? (
              <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">
                {memory.importantNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 italic">None identified</p>
            )}
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Current & Recommended Context</h3>
            <p className="text-sm text-gray-800 mb-2"><span className="font-medium text-gray-900">Current:</span> {memory.currentContext}</p>
            <p className="text-sm text-gray-800"><span className="font-medium text-gray-900">Recommendation:</span> {memory.recommendedContext}</p>
          </div>
        </div>
      )}
    </div>
  );
}
