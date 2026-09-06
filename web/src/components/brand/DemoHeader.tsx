import { Badge } from "@/components/ui/badge";

export function DemoHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-wom-secondary">WOM</p>
        <h1 className="text-2xl font-extrabold text-wom-primary md:text-3xl">WOM Customer Service AI</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>AI Demo</Badge>
        <Badge className="bg-wom-primary text-wom-primary-foreground">Demo Environment</Badge>
        <Badge>Prototype</Badge>
      </div>
    </header>
  );
}
