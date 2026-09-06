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
    expect(screen.getByText(/persistencia \(HU #011\)/i)).toBeInTheDocument();
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
