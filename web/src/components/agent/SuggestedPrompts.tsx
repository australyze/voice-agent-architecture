import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const SUGGESTED_PROMPTS = [
  "¿Cuántos gigas me quedan?",
  "¿Cuánto tengo que pagar este mes?",
  "¿Está funcionando mi servicio?",
];

type SuggestedPromptsProps = {
  onSelect: (prompt: string) => void;
};

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <Card>
      <CardTitle>Frases sugeridas</CardTitle>
      <CardDescription className="mt-1">Solo ejemplos. No inician la llamada.</CardDescription>
      <div className="mt-4 flex flex-col gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Button key={prompt} type="button" variant="outline" onClick={() => onSelect(prompt)}>
            {prompt}
          </Button>
        ))}
      </div>
    </Card>
  );
}
