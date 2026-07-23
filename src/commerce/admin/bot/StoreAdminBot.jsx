import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, Send, Sparkles, Wrench, XCircle } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "../lib/api";
import Markdown from "./Markdown";

/** Agent identifier — base44/agents/commerce/StoreAdmin.jsonc, namespaced by its folder. */
const AGENT_NAME = "commerce/StoreAdmin";
/** sessionStorage key so the conversation survives panel close / page reload. */
const CONVERSATION_KEY = "commerce.StoreAdmin.conversation_id";

const SUGGESTIONS = [
  "Show today's sales summary",
  "List the 10 most recent orders",
  "Which products are low on stock?",
];

/** One chat message bubble (user right, assistant left with markdown + tool chips). */
function Message({ message }) {
  const isUser = message.role === "user";
  const content =
    typeof message.content === "string"
      ? message.content
      : message.content
        ? JSON.stringify(message.content, null, 2)
        : "";
  const toolCalls = (message.tool_calls || []).filter((t) => t.name);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-lg px-3 py-2 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {toolCalls.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {toolCalls.map((t) => (
              <Badge key={t.id} variant="outline" className="gap-1 bg-background/60 px-1.5 py-0 text-[10px] font-normal">
                {t.status === "running" ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : t.status === "error" ? (
                  <XCircle className="h-2.5 w-2.5 text-destructive" />
                ) : (
                  <Wrench className="h-2.5 w-2.5" />
                )}
                {t.name.replace(/^commerce[-/]/, "")}
              </Badge>
            ))}
          </div>
        )}
        {isUser ? (
          <div className="whitespace-pre-wrap text-[13px]">{content}</div>
        ) : content ? (
          <Markdown>{content}</Markdown>
        ) : null}
      </div>
    </div>
  );
}

/**
 * StoreAdmin bot — chat side panel over the `commerce/StoreAdmin` agent
 * (base44/agents/commerce/StoreAdmin.jsonc).
 *
 * Launched from the admin sidebar. Creates the conversation lazily on the
 * first message, then live-updates through the agents WebSocket subscription.
 * Assistant responses render as GitHub-flavored markdown (incl. tables).
 */
export default function StoreAdminBot({ open, onOpenChange }) {
  const [conversationId, setConversationId] = useState(
    () => sessionStorage.getItem(CONVERSATION_KEY) || null
  );
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const conversationRef = useRef(null);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !m.hidden && m.role !== "system"),
    [messages]
  );

  // Agent is busy while the last visible message is the user's, or a tool call is running.
  const busy = useMemo(() => {
    const last = visibleMessages[visibleMessages.length - 1];
    if (!last) return false;
    if (last.role === "user") return true;
    return (last.tool_calls || []).some((t) => t.status === "running");
  }, [visibleMessages]);

  // Load + subscribe whenever the panel is open and a conversation exists.
  useEffect(() => {
    if (!open || !conversationId) return undefined;
    let cancelled = false;
    base44.agents
      .getConversation(conversationId)
      .then((conv) => {
        if (cancelled || !conv) return;
        conversationRef.current = conv;
        setMessages(conv.messages || []);
      })
      .catch(() => {
        // Stale id (e.g. conversation deleted) — start fresh.
        sessionStorage.removeItem(CONVERSATION_KEY);
        setConversationId(null);
        setMessages([]);
      });
    const unsubscribe = base44.agents.subscribeToConversation(conversationId, (conv) => {
      if (cancelled) return;
      conversationRef.current = conv;
      setMessages(conv.messages || []);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [open, conversationId]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleMessages, busy, open]);

  const send = useCallback(
    async (text) => {
      const trimmed = (text ?? input).trim();
      if (!trimmed || sending) return;
      setSending(true);
      try {
        let conv = conversationRef.current;
        if (!conv || conv.id !== conversationId || !conversationId) {
          conv = await base44.agents.createConversation({
            agent_name: AGENT_NAME,
            metadata: { source: "commerce-admin" },
          });
          conversationRef.current = conv;
          sessionStorage.setItem(CONVERSATION_KEY, conv.id);
          setConversationId(conv.id);
        }
        setInput("");
        // Optimistic echo; the subscription replaces it with the stored message.
        setMessages((prev) => [
          ...prev,
          { id: `local-${Date.now()}`, role: "user", content: trimmed },
        ]);
        await base44.agents.addMessage(conv, { role: "user", content: trimmed });
      } catch (err) {
        toast.error(err?.response?.data?.message || err.message || "Failed to reach StoreAdmin");
      } finally {
        setSending(false);
      }
    },
    [input, sending, conversationId]
  );

  const reset = useCallback(() => {
    sessionStorage.removeItem(CONVERSATION_KEY);
    conversationRef.current = null;
    setConversationId(null);
    setMessages([]);
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              StoreAdmin
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="mr-6 h-7 gap-1.5 px-2 text-xs text-muted-foreground"
              onClick={reset}
              disabled={!conversationId && messages.length === 0}
            >
              <RotateCcw className="h-3 w-3" />
              New chat
            </Button>
          </div>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {visibleMessages.length === 0 && (
            <div className="mt-6 space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Ask me anything about your store — I can look things up and make changes for you.
              </p>
              <div className="flex flex-col items-stretch gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs font-normal text-muted-foreground"
                    onClick={() => send(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {visibleMessages.map((m) => (
            <Message key={m.id} message={m} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Working…
            </div>
          )}
        </div>

        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="e.g. Show pending orders as a table"
              rows={1}
              className="max-h-32 min-h-9 resize-none text-[13px]"
            />
            <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => send()} disabled={sending || !input.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
