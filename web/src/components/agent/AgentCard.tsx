import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const CAPABILITIES = ["Consumo de datos", "Estado de cuenta", "Estado del servicio"];

export function AgentCard() {
  return (
    <Card>
      <CardTitle>WOM Customer Service AI</CardTitle>
      <CardDescription className="mt-1">Agente de atención al cliente simulado. No es un producto oficial WOM.</CardDescription>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-wom-text/60">Estado</dt>
          <dd className="font-semibold text-wom-primary">Listo para iniciar</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-wom-text/60">Idioma</dt>
          <dd className="font-semibold">Español</dd>
        </div>
        <p className="text-xs text-wom-text/60">
          El estado no verifica el runtime. Para WOM configura VOICE_SESSION_OWNER=wom-customer-service-agent.
        </p>
      </dl>
      <ul className="mt-4 flex flex-wrap gap-2">
        {CAPABILITIES.map((item) => (
          <li key={item} className="rounded-full bg-wom-muted px-3 py-1 text-xs font-semibold text-wom-primary">
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export const AGENT_CAPABILITIES = CAPABILITIES;
