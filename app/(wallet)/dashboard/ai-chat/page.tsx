"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useCompany } from "@/hooks/use-company";
import { formatCents } from "@/lib/format";

import { PageHeader } from "@/components/page-header";
import { CompanyGuard } from "@/components/company-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Action confirmation helpers ───

type PendingAction = {
  toolCallId: string;
  action: Record<string, unknown> & {
    _action: string;
    _requiresConfirmation: boolean;
  };
};

const ACTION_LABELS: Record<string, string> = {
  create_employee: "Create Employee",
  create_customer: "Create Customer",
  create_product: "Create Product",
  create_employee_payment: "Create Employee Payment",
  create_customer_payment: "Create Customer Payment",
  update_payment_status: "Update Payment Status",
  update_employee: "Update Employee",
  update_customer: "Update Customer",
  approve_advance: "Approve Salary Advance",
  deny_advance: "Deny Salary Advance",
};

function formatActionDetails(
  action: Record<string, unknown>
): [string, string][] {
  const skip = new Set(["_action", "_requiresConfirmation", "companyId"]);
  return Object.entries(action)
    .filter(([key]) => !skip.has(key))
    .map(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .replace("Id", " ID");

      let display = String(value);
      if (key.endsWith("Cents") && typeof value === "number") {
        display = formatCents(value);
      }
      return [label, display];
    });
}

// ─── Confirmation Dialog ───

function ConfirmationCard({
  pending,
  onConfirm,
  onDeny,
  isExecuting,
}: {
  pending: PendingAction;
  onConfirm: () => void;
  onDeny: () => void;
  isExecuting: boolean;
}) {
  const label =
    ACTION_LABELS[pending.action._action] ?? pending.action._action;
  const details = formatActionDetails(pending.action);

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Confirm: {label}</CardTitle>
        <CardDescription>
          The AI is proposing this action. Review and approve or reject.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 space-y-1.5">
          {details.map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onConfirm} disabled={isExecuting}>
            {isExecuting ? "Executing..." : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDeny}
            disabled={isExecuting}
          >
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tool Call Display ───

function ToolCallBadge({
  name,
  state,
}: {
  name: string;
  state: string;
}) {
  const label = name.replace(/^(propose_|get_|list_)/, "").replace(/_/g, " ");

  const isLoading =
    state === "input-streaming" || state === "input-available";
  const variant = state === "output-available" ? "default" : "outline";

  return (
    <Badge variant={variant} className="text-xs capitalize">
      {isLoading ? "Calling: " : ""}
      {label}
      {isLoading ? "..." : ""}
    </Badge>
  );
}

// ─── Suggested prompts ───

const SUGGESTIONS = [
  "Show me a summary of the business",
  "Who are my top customers by revenue?",
  "List all employees and their compensation",
  "What payments are overdue?",
  "Show me the payroll forecast for next 3 months",
  "Create a new product for API access",
  "What's the treasury balance?",
  "Analyze my cashflow health",
];

// ─── Main Chat Component ───

function AIChatContent() {
  const { companyId } = useCompany();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: { companyId },
      }),
    [companyId]
  );

  const { messages, sendMessage, status } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingActions]);

  // Detect pending actions from tool results in messages
  useEffect(() => {
    const newPending: PendingAction[] = [];
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts) {
        // Dynamic tool parts (untyped tools) use type "dynamic-tool"
        if (
          part.type === "dynamic-tool" &&
          part.state === "output-available" &&
          (part.output as Record<string, unknown>)?._requiresConfirmation &&
          !executedIds.has(part.toolCallId)
        ) {
          newPending.push({
            toolCallId: part.toolCallId,
            action: part.output as PendingAction["action"],
          });
        }
      }
    }
    setPendingActions(newPending);
  }, [messages, executedIds]);

  const handleConfirm = useCallback(async (pending: PendingAction) => {
    setExecutingIds((prev) => new Set(prev).add(pending.toolCallId));
    try {
      const res = await fetch("/api/ai/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pending.action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExecutedIds((prev) => new Set(prev).add(pending.toolCallId));
    } catch {
      // Keep in pending so user can retry
    } finally {
      setExecutingIds((prev) => {
        const next = new Set(prev);
        next.delete(pending.toolCallId);
        return next;
      });
    }
  }, []);

  const handleDeny = useCallback((pending: PendingAction) => {
    setExecutedIds((prev) => new Set(prev).add(pending.toolCallId));
  }, []);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInputValue("");
  }, [inputValue, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text: string) => {
    setInputValue(text);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] flex-col">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 lg:px-6"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="text-center">
              <h2 className="text-lg font-medium">Arc AI Assistant</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask anything about your business. I can read all your data and
                propose operations for your approval.
              </p>
            </div>
            <div className="grid max-w-2xl grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="rounded-lg border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((msg: UIMessage) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="space-y-2">
                    {msg.parts.map((part, i: number) => {
                      if (part.type === "text" && part.text) {
                        return msg.role === "assistant" ? (
                          <div
                            key={i}
                            className="prose prose-sm dark:prose-invert max-w-none leading-relaxed"
                          >
                            <ReactMarkdown>{part.text}</ReactMarkdown>
                          </div>
                        ) : (
                          <div
                            key={i}
                            className="whitespace-pre-wrap leading-relaxed"
                          >
                            {part.text}
                          </div>
                        );
                      }
                      if (part.type === "dynamic-tool") {
                        // Don't show badge for confirmed proposals
                        if (
                          part.state === "output-available" &&
                          (part.output as Record<string, unknown>)?._requiresConfirmation
                        ) {
                          return null;
                        }
                        return (
                          <ToolCallBadge
                            key={i}
                            name={part.toolName}
                            state={part.state}
                          />
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              </div>
            ))}

            {/* Pending action confirmations */}
            {pendingActions
              .filter((p) => !executedIds.has(p.toolCallId))
              .map((pending) => (
                <ConfirmationCard
                  key={pending.toolCallId}
                  pending={pending}
                  onConfirm={() => handleConfirm(pending)}
                  onDeny={() => handleDeny(pending)}
                  isExecuting={executingIds.has(pending.toolCallId)}
                />
              ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-muted px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <span className="text-xs text-muted-foreground">
                      Thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t px-4 py-3 lg:px-6">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Arc anything about your business..."
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-4 py-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
          <Button
            type="button"
            size="sm"
            disabled={isLoading || !inputValue.trim()}
            onClick={handleSend}
          >
            Send
          </Button>
        </div>
        <p className="mx-auto mt-1.5 max-w-3xl text-xs text-muted-foreground">
          Arc AI can access all company data. Write operations require your
          approval.
        </p>
      </div>
    </div>
  );
}

export default function AIChatPage() {
  return (
    <>
      <PageHeader
        title="AI Chat"
        description="Conversational assistant with full platform access"
      />
      <CompanyGuard>
        <AIChatContent />
      </CompanyGuard>
    </>
  );
}
