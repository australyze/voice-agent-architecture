const PLACEHOLDER_REPLIES: Record<string, string> = {
  es: "Integración de voz operativa. Este es un mensaje de prueba del runtime.",
  en: "Voice integration is operational. This is a runtime test message.",
};

export function placeholderReplyForLocale(locale: string): string {
  return PLACEHOLDER_REPLIES[locale] ?? PLACEHOLDER_REPLIES.es ?? "Voice integration is operational.";
}
