"use client";

import { useState, useEffect } from "react";
import type { CustomerTag } from "@prisma/client";

export function CustomerTags({ 
  customerId,
  initialAssignedTags = []
}: { 
  customerId: string;
  initialAssignedTags?: CustomerTag[];
}) {
  const [availableTags, setAvailableTags] = useState<CustomerTag[]>([]);
  const [assignedTags, setAssignedTags] = useState<CustomerTag[]>(initialAssignedTags);
  const [loading, setLoading] = useState(true);
  
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchTags = async () => {
    try {
      const tagsRes = await fetch("/api/tags");
      if (tagsRes.ok) {
        const data = await tagsRes.json();
        setAvailableTags(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch tags", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTags();
  }, []);

  const handleCreateAndAssign = async () => {
    if (!newTagName.trim()) return;
    setIsCreating(true);
    try {
      // 1. Create tag
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName }),
      });
      if (res.ok) {
        const data = await res.json();
        const newTag = data.data;
        setAvailableTags([...availableTags, newTag]);
        setNewTagName("");
        setShowCreate(false);
        
        // 2. Assign tag
        await handleAssign(newTag.id, newTag);
      } else {
        alert("Failed to create tag (may already exist)");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssign = async (tagId: string, tagObject: CustomerTag) => {
    if (assignedTags.some(t => t.id === tagId)) return; // already assigned
    
    // Optimistic update
    setAssignedTags([...assignedTags, tagObject]);
    
    try {
      const res = await fetch(`/api/customers/${customerId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      if (!res.ok) {
        throw new Error("Failed to assign");
      }
    } catch (err) {
      console.error(err);
      // Revert
      setAssignedTags(assignedTags.filter(t => t.id !== tagId));
    }
  };

  const handleRemove = async (tagId: string) => {
    const tagToRemove = assignedTags.find(t => t.id === tagId);
    if (!tagToRemove) return;

    // Optimistic update
    setAssignedTags(assignedTags.filter(t => t.id !== tagId));

    try {
      const res = await fetch(`/api/customers/${customerId}/tags/${tagId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to remove");
      }
    } catch (err) {
      console.error(err);
      // Revert
      setAssignedTags([...assignedTags, tagToRemove]);
    }
  };

  const unassignedTags = availableTags.filter(
    (at) => !assignedTags.some((st) => st.id === at.id)
  );

  return (
    <div className="space-y-4">
      {/* Assigned Tags */}
      <div className="flex flex-wrap gap-2">
        {assignedTags.map((tag) => (
          <span 
            key={tag.id} 
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
          >
            {tag.name}
            <button 
              onClick={() => handleRemove(tag.id)}
              className="text-gray-400 hover:text-red-500 focus:outline-none"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {assignedTags.length === 0 && (
          <span className="text-xs text-gray-500 italic">No tags assigned.</span>
        )}
      </div>

      {/* Add Tag Section */}
      {!loading && (
        <div className="pt-2 border-t border-gray-100">
          {showCreate ? (
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name..."
                className="flex-1 text-xs rounded-md border-gray-300 py-1.5 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={isCreating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateAndAssign();
                }}
              />
              <button 
                onClick={handleCreateAndAssign}
                disabled={!newTagName.trim() || isCreating}
                className="bg-blue-600 text-white text-xs font-semibold px-2.5 rounded-md hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                Save
              </button>
              <button 
                onClick={() => setShowCreate(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {unassignedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] uppercase font-semibold text-gray-400 w-full mb-1">Available Tags:</span>
                  {unassignedTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => handleAssign(tag.id, tag)}
                      className="text-[11px] px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-blue-300 transition-colors"
                    >
                      + {tag.name}
                    </button>
                  ))}
                </div>
              )}
              
              <button 
                onClick={() => setShowCreate(true)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium self-start flex items-center gap-1 mt-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create new tag
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
