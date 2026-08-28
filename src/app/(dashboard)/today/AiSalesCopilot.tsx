"use client";

import { useState } from "react";
import Link from "next/link";
import type { SalesBrief } from "@/lib/ai";

export default function AiSalesCopilot() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [brief, setBrief] = useState<SalesBrief | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const generateBrief = async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/ai/dashboard/sales-brief", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to generate brief");
      }

      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setBrief(data.brief);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setErrorMessage("AI sales brief is temporarily unavailable. Please try again.");
      setStatus("error");
    }
  };

  if (status === "idle") {
    return (
      <section className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-6 shadow-sm mb-8 flex flex-col items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>✨</span> AI Sales Copilot
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Analyze your current sales activity and identify your top priorities for today.
          </p>
        </div>
        <button
          onClick={generateBrief}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2.5 px-5 rounded-lg shadow-sm transition-colors flex items-center gap-2"
        >
          <span>✨</span> Generate Sales Brief
        </button>
      </section>
    );
  }

  if (status === "loading") {
    return (
      <section className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm mb-8 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-gray-900">Analyzing your sales activity...</p>
        <p className="text-xs text-gray-500">This usually takes a few seconds.</p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="bg-red-50 rounded-xl border border-red-100 p-6 shadow-sm mb-8 flex flex-col items-start gap-4">
        <div>
          <h2 className="text-lg font-bold text-red-800 flex items-center gap-2">
            <span>⚠️</span> Sales Brief Unavailable
          </h2>
          <p className="text-sm text-red-600 mt-1">
            {errorMessage}
          </p>
        </div>
        <button
          onClick={generateBrief}
          className="bg-white text-red-700 border border-red-200 hover:bg-red-50 text-sm font-bold py-2 px-4 rounded-lg shadow-sm transition-colors"
        >
          Try Again
        </button>
      </section>
    );
  }

  if (!brief) return null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8 overflow-hidden flex flex-col">
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>✨</span> AI Sales Copilot
          </h2>
          <p className="text-xs text-gray-600 mt-1 font-medium">Your sales priorities for today</p>
        </div>
        <button
          onClick={generateBrief}
          className="text-xs font-bold text-indigo-700 bg-white border border-indigo-200 px-3 py-1.5 rounded shadow-sm hover:bg-indigo-50 transition-colors flex items-center gap-1.5"
        >
          <span>↻</span> Refresh Brief
        </button>
      </div>

      <div className="p-5 space-y-8">
        
        {/* Overview */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Today's Overview</h3>
          <p className="text-sm text-gray-800 font-medium leading-relaxed">{brief.overview}</p>
        </div>

        {/* Priority Actions */}
        {brief.priorityActions.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
              <span>🔥</span> Priority Actions
            </h3>
            <div className="grid gap-3">
              {brief.priorityActions.map((action, idx) => (
                <Link
                  key={idx}
                  href={`/threads?id=${action.conversationId}`}
                  className="block p-4 rounded-lg border border-orange-100 bg-orange-50/50 hover:bg-orange-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                    <p className="font-bold text-gray-900 text-sm">{action.customerName}</p>
                    <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded">High Priority</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-3"><span className="font-semibold text-gray-700">Reason:</span> {action.reason}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-orange-800"><span className="font-bold">Next action:</span> {action.action}</p>
                    <span className="text-xs font-semibold text-orange-700 ml-4 flex-shrink-0">Open Conversation →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Follow-ups */}
        {brief.followUps.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
              <span>📅</span> Follow-ups
            </h3>
            <div className="grid gap-3">
              {brief.followUps.map((followUp, idx) => (
                <Link
                  key={idx}
                  href={`/threads?id=${followUp.conversationId}`}
                  className="block p-4 rounded-lg border border-blue-100 bg-blue-50/50 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <p className="font-bold text-gray-900 text-sm">{followUp.customerName}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                      followUp.timing.toLowerCase().includes('overdue') ? 'bg-red-100 text-red-700' : 
                      followUp.timing.toLowerCase().includes('today') ? 'bg-blue-100 text-blue-700' : 
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {followUp.timing}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">{followUp.action}</p>
                    <span className="text-xs font-semibold text-blue-700 ml-4 flex-shrink-0">Open Conversation →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Opportunities */}
          {brief.opportunities.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <span>💰</span> Opportunities
              </h3>
              <div className="space-y-3">
                {brief.opportunities.map((opp, idx) => {
                  const content = (
                    <div className="p-3 rounded-lg border border-green-100 bg-green-50/30">
                      <p className="font-bold text-sm text-gray-900 mb-1">{opp.title}</p>
                      <p className="text-xs text-gray-600">{opp.explanation}</p>
                    </div>
                  );

                  return opp.conversationId ? (
                    <Link key={idx} href={`/threads?id=${opp.conversationId}`} className="block hover:opacity-80 transition-opacity">
                      {content}
                    </Link>
                  ) : (
                    <div key={idx}>{content}</div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Risks */}
          {brief.risks.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <span>⚠️</span> Risks
              </h3>
              <div className="space-y-3">
                {brief.risks.map((risk, idx) => {
                  const content = (
                    <div className="p-3 rounded-lg border border-red-100 bg-red-50/30">
                      <p className="font-bold text-sm text-gray-900 mb-1">{risk.title}</p>
                      <p className="text-xs text-gray-600">{risk.explanation}</p>
                    </div>
                  );

                  return risk.conversationId ? (
                    <Link key={idx} href={`/threads?id=${risk.conversationId}`} className="block hover:opacity-80 transition-opacity">
                      {content}
                    </Link>
                  ) : (
                    <div key={idx}>{content}</div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Final Summary */}
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Final Summary</h3>
          <p className="text-sm text-gray-700 font-medium italic">{brief.finalSummary}</p>
        </div>

      </div>
    </section>
  );
}
