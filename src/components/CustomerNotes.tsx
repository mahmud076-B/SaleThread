"use client";

import { useState, useEffect, useCallback } from "react";
import type { CustomerNote } from "@prisma/client";

export function CustomerNotes({ customerId }: { customerId: string }) {
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch notes", err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotes();
  }, [fetchNotes]);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotes([data.data, ...notes]);
        setNewNote("");
      }
    } catch (err) {
      console.error("Failed to add note", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (noteId: string) => {
    if (!editText.trim()) return;
    try {
      const res = await fetch(`/api/customers/${customerId}/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(notes.map((n) => (n.id === noteId ? data.data : n)));
        setEditingId(null);
      }
    } catch (err) {
      console.error("Failed to edit note", err);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    try {
      const res = await fetch(`/api/customers/${customerId}/notes/${noteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotes(notes.filter((n) => n.id !== noteId));
      }
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  };

  if (loading) {
    return <div className="animate-pulse flex space-x-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></div>;
  }

  return (
    <div className="space-y-4">
      {/* Add note input */}
      <div className="flex gap-2 items-start">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a private note..."
          className="flex-1 min-h-[60px] text-sm resize-none rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          rows={2}
          disabled={isSubmitting}
        />
        <button
          onClick={handleAdd}
          disabled={!newNote.trim() || isSubmitting}
          className="bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-md hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          Add
        </button>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No notes added yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="bg-amber-50/50 border border-amber-100 rounded-md p-3 text-sm">
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full text-sm resize-none rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    rows={2}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    <button onClick={() => handleEdit(note.id)} className="text-xs text-blue-600 font-semibold hover:text-blue-800">Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">
                      {new Date(note.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="space-x-3">
                      <button 
                        onClick={() => { setEditingId(note.id); setEditText(note.content); }}
                        className="text-[11px] font-medium text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(note.id)}
                        className="text-[11px] font-medium text-gray-500 hover:text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
