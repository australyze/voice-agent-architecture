import type { ConversationMessage } from "@/lib/voice/types";

type ConversationTranscriptProps = {
  messages: ConversationMessage[];
};

export function ConversationTranscript({ messages }: ConversationTranscriptProps) {
  return (
    <section aria-label="Transcripción" className="max-h-80 space-y-3 overflow-auto">
      {messages.length === 0 ? (
        <p className="text-sm text-white/70">La transcripción aparecerá aquí.</p>
      ) : (
        messages.map((message) => (
          <article
            key={message.id}
            className={
              message.role === "user"
                ? "ml-8 rounded-2xl bg-white px-4 py-3 text-wom-text"
                : "mr-8 rounded-2xl bg-wom-secondary/30 px-4 py-3 text-white"
            }
          >
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
              {message.role === "user" ? "Usuario" : "Asistente"}
              {message.timestamp ? ` · ${message.timestamp}` : ""}
            </p>
            <p className="mt-1 text-sm">{message.text}</p>
          </article>
        ))
      )}
    </section>
  );
}
