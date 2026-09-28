type Message = { id: string; role: "user" | "assistant"; content: string };

export type QuickReply = {
  label: string;
  value: string;
  field?: string;
};

export function MessageList({
  messages,
  streamingText,
  isStreaming,
}: {
  messages: Message[];
  streamingText?: string | null;
  isStreaming?: boolean;
}) {
  return (
    <main className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
            m.role === "user"
              ? "ml-auto bg-slate-900 text-white"
              : "bg-white shadow-sm ring-1 ring-slate-100"
          }`}
        >
          {m.content}
        </div>
      ))}
      {(isStreaming || streamingText) && (
        <div
          className="max-w-[90%] rounded-2xl bg-white px-3 py-2 text-sm whitespace-pre-wrap shadow-sm ring-1 ring-slate-100"
          aria-live="polite"
        >
          {streamingText}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-slate-400" />
          )}
        </div>
      )}
      {messages.length === 0 && !streamingText && (
        <p className="text-center text-xs text-slate-500">
          Describe the job, attach plans or spreadsheets, and answer any missing
          info.
        </p>
      )}
    </main>
  );
}
