import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoApp } from "./DemoApp";
import { createFakeMediaClient } from "@/test/fake-media-client";
import { CONNECTING_TIMEOUT_MS } from "@/lib/voice/types";

describe("DemoApp", () => {
  it("should_render_idle_chrome_with_demo_labeling", () => {
    render(<DemoApp mediaClient={createFakeMediaClient().client} />);
    expect(screen.getByRole("heading", { level: 1, name: "WOM Customer Service AI" })).toBeInTheDocument();
    expect(screen.getByText("AI Demo")).toBeInTheDocument();
    expect(screen.getByText("Prototype")).toBeInTheDocument();
    expect(screen.getByText("Demo Environment")).toBeInTheDocument();
  });

  it("should_show_agent_status_capabilities_and_suggested_prompts_without_starting", async () => {
    const fake = createFakeMediaClient();
    const user = userEvent.setup();
    render(<DemoApp mediaClient={fake.client} />);

    expect(screen.getByText("Listo para iniciar")).toBeInTheDocument();
    expect(screen.getByText(/El estado no verifica el runtime/)).toBeInTheDocument();
    expect(screen.getByText("El micrófono se envía al proveedor de voz para transcribir. Esta aplicación no guarda el audio.")).toBeInTheDocument();
    expect(screen.queryByText(/El audio no se guarda en esta HU/)).not.toBeInTheDocument();
    expect(screen.getByText("Español")).toBeInTheDocument();
    expect(screen.getByText("Consumo de datos")).toBeInTheDocument();
    expect(screen.getByText("Estado de cuenta")).toBeInTheDocument();
    expect(screen.getByText("Estado del servicio")).toBeInTheDocument();

    const start = screen.getByRole("button", { name: "Hablar con WOM AI" });
    expect(start).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "¿Cuántos gigas me quedan?" }));
    expect(fake.calls.start).toBe(0);
    expect(start).toBeEnabled();
    start.focus();
    expect(start).toHaveFocus();
    expect(start).toHaveAttribute("aria-label", "Hablar con WOM AI");
  });

  it("should_render_connecting_active_ending_completed_and_error_states", async () => {
    const fake = createFakeMediaClient();
    const user = userEvent.setup();
    render(<DemoApp mediaClient={fake.client} />);

    await user.click(screen.getByRole("button", { name: "Hablar con WOM AI" }));
    expect(screen.getByText(/Conectando el micrófono/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hablar con WOM AI" })).toBeDisabled();

    act(() => {
      fake.emit({ type: "call-start" });
    });
    expect(await screen.findByText("LIVE")).toBeInTheDocument();
    expect(screen.getAllByText("WOM Customer Service AI").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Finalizar conversación")).toBeEnabled();

    act(() => {
      fake.emit({
        type: "transcript",
        message: { id: "u1", role: "user", text: "¿Cuántos gigas me quedan?", timestamp: "12:00" },
      });
    });
    expect(screen.getByText("¿Cuántos gigas me quedan?")).toBeInTheDocument();

    act(() => {
      fake.emit({ type: "tool-activity", label: "Consultando consumo" });
    });
    expect(screen.getByText(/Consultando consumo/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Finalizar conversación" }));
    expect(screen.getByText(/Finalizando la conversación/)).toBeInTheDocument();
    expect(screen.queryByText("Conversación finalizada")).not.toBeInTheDocument();

    act(() => {
      fake.emit({ type: "call-end" });
    });
    expect(await screen.findByText("Conversación finalizada")).toBeInTheDocument();
    expect(screen.getByText(/Ver trazabilidad/)).toBeInTheDocument();
    expect(screen.getByText(/No fue posible recuperar el historial del backend/i)).toBeInTheDocument();
  });

  it("should_not_fetch_latest_global_session_when_channel_id_is_unknown", async () => {
    vi.stubEnv("VITE_PUBLIC_API_BASE_URL", "http://127.0.0.1:3000");
    vi.stubEnv("VITE_DEMO_ORCHESTRATE_SECRET", "demo-secret");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const fake = createFakeMediaClient();
    const user = userEvent.setup();
    render(<DemoApp mediaClient={fake.client} />);
    await user.click(screen.getByRole("button", { name: "Hablar con WOM AI" }));
    act(() => {
      fake.emit({ type: "call-start" });
    });
    await user.click(screen.getByRole("button", { name: "Finalizar conversación" }));
    act(() => {
      fake.emit({ type: "call-end" });
    });
    expect(await screen.findByText(/No fue posible recuperar el historial del backend/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("should_show_loaded_backend_report_when_channel_id_and_secret_succeed", async () => {
    vi.stubEnv("VITE_PUBLIC_API_BASE_URL", "http://127.0.0.1:3000");
    vi.stubEnv("VITE_DEMO_ORCHESTRATE_SECRET", "demo-secret");
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      expect(headers.get("x-demo-orchestrate-secret")).toBe("demo-secret");
      expect(url).not.toContain("limit=1");
      if (url.includes("externalChannelId=vapi-1")) {
        return new Response(JSON.stringify({ data: [{ sessionId: "11111111-1111-4111-8111-111111111111" }] }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ sessionId: "11111111-1111-4111-8111-111111111111", status: "completed" }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const fake = createFakeMediaClient();
    const user = userEvent.setup();
    render(<DemoApp mediaClient={fake.client} />);
    await user.click(screen.getByRole("button", { name: "Hablar con WOM AI" }));
    act(() => {
      fake.emit({ type: "call-start", externalChannelId: "vapi-1" });
    });
    await user.click(screen.getByRole("button", { name: "Finalizar conversación" }));
    act(() => {
      fake.emit({ type: "call-end" });
    });
    expect(await screen.findByText(/Historial del backend recuperado/)).toBeInTheDocument();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("should_show_unavailable_when_session_report_is_unauthorized", async () => {
    vi.stubEnv("VITE_PUBLIC_API_BASE_URL", "http://127.0.0.1:3000");
    vi.stubEnv("VITE_DEMO_ORCHESTRATE_SECRET", "wrong");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const fake = createFakeMediaClient();
    const user = userEvent.setup();
    render(<DemoApp mediaClient={fake.client} />);
    await user.click(screen.getByRole("button", { name: "Hablar con WOM AI" }));
    act(() => {
      fake.emit({ type: "call-start", externalChannelId: "vapi-1" });
    });
    await user.click(screen.getByRole("button", { name: "Finalizar conversación" }));
    act(() => {
      fake.emit({ type: "call-end" });
    });
    expect(await screen.findByText(/No fue posible recuperar el historial del backend/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("should_show_safe_error_without_secrets", async () => {
    const fake = createFakeMediaClient();
    fake.client.start = async () => {
      fake.emit({ type: "error", message: "No fue posible iniciar la conversación. Verifica la configuración de la demo e inténtalo nuevamente." });
      throw new Error("sk-secret-value stack");
    };
    const user = userEvent.setup();
    render(<DemoApp mediaClient={fake.client} />);
    await user.click(screen.getByRole("button", { name: "Hablar con WOM AI" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible iniciar la conversación");
    expect(screen.queryByText(/sk-secret-value/)).not.toBeInTheDocument();
  });

  it("should_return_to_retryable_error_when_connecting_times_out", async () => {
    vi.useFakeTimers();
    const fake = createFakeMediaClient();
    render(<DemoApp mediaClient={fake.client} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hablar con WOM AI" }));
    });
    expect(screen.getByText(/Conectando el micrófono/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONNECTING_TIMEOUT_MS);
    });

    expect(screen.getByRole("alert")).toHaveTextContent("No fue posible iniciar la conversación");
    expect(screen.getByRole("button", { name: "Hablar con WOM AI" })).toBeEnabled();
  });
});

afterEach(() => {
  vi.useRealTimers();
});
