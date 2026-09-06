import { cn } from "@/lib/utils";

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn("rounded-2xl border border-wom-accent/30 bg-wom-muted px-4 py-3 text-sm", className)}
      {...props}
    />
  );
}
