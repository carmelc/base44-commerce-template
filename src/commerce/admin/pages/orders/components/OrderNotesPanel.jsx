import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { call } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";

/** Note tone per Woo: system = gray, private = amber, note-to-customer = blue. */
function noteClasses(note) {
  if (note.is_customer_note) return "border-blue-200 bg-blue-50";
  if (note.added_by === "system") return "border-gray-200 bg-gray-50";
  return "border-amber-200 bg-amber-50";
}

/**
 * Order notes feed + add-note form.
 * Props: { orderId, notes, loading, onChanged() }
 */
export default function OrderNotesPanel({ orderId, notes, loading, onChanged }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState("private");
  const [busy, setBusy] = useState(false);

  const addNote = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await call("admin-orders", "add-note", {
        order_id: orderId,
        note: text.trim(),
        is_customer_note: kind === "customer",
      });
      toast.success(kind === "customer" ? "Note sent to customer" : "Note added");
      setText("");
      onChanged();
    } catch {
      /* toast handled by call() */
    } finally {
      setBusy(false);
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await call("admin-orders", "delete-note", { note_id: noteId });
      onChanged();
    } catch {
      /* toast handled by call() */
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Order notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (notes || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {notes.map((n) => (
              <li key={n.id} className={`group relative rounded-md border p-2.5 text-sm ${noteClasses(n)}`}>
                <p className="whitespace-pre-wrap">{n.note}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {formatDateTime(n.created_date)}
                  {n.added_by && n.added_by !== "system" ? ` · ${n.added_by}` : n.added_by === "system" ? " · system" : ""}
                  {n.is_customer_note ? " · sent to customer" : ""}
                </p>
                <button
                  type="button"
                  onClick={() => deleteNote(n.id)}
                  className="absolute right-1.5 top-1.5 hidden rounded p-0.5 hover:bg-black/5 group-hover:block"
                  title="Delete note"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 border-t pt-3">
          <Textarea
            rows={3}
            placeholder="Add a note…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="h-8 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private note</SelectItem>
                <SelectItem value="customer">Note to customer</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addNote} disabled={busy || !text.trim()}>
              {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
