import { AGENT_ERROR_CODES, adapterSafeAgentMessage } from "../../domain/agent.js";
import { DEMO_NORMALIZE_TEXT, DEMO_TOOL_TIMEOUT_MS, MAX_TOOL_STRING_CHARS } from "../../domain/demo-tool.js";
import type { ToolExecuteRequest, ToolExecuteResult, ToolPort, ToolRiskClass, ToolSource } from "../../domain/ports/tool-port.js";
import type { ToolRegistry } from "../../application/tool-registry.js";
import { createProductToolRegistry } from "./create-default-registry.js";

export { DEMO_NORMALIZE_TEXT, DEMO_TOOL_TIMEOUT_MS };
export { DEMO_ECHO_TOKEN } from "../../domain/demo-tool.js";

const HIGH_RISK: ReadonlySet<ToolRiskClass> = new Set(["write", "irreversible", "external_comm"]);

export type NativeToolPortOptions = {
  registry?: ToolRegistry;
  hangMs?: number;
  allowedTools?: readonly string[];
};

export function createSessionOwnerToolPort(allowedTools: readonly string[]): NativeToolPort {
  return new NativeToolPort({
    registry: createProductToolRegistry(),
    allowedTools,
  });
}

export class NativeToolPort implements ToolPort {
  private readonly registry: ToolRegistry;
  private readonly hangMs?: number;
  private readonly allowedTools?: readonly string[];

  constructor(hangMsOrOptions?: number | NativeToolPortOptions) {
    if (typeof hangMsOrOptions === "number") {
      this.registry = createProductToolRegistry();
      this.hangMs = hangMsOrOptions;
      return;
    }
    this.registry = hangMsOrOptions?.registry ?? createProductToolRegistry();
    this.hangMs = hangMsOrOptions?.hangMs;
    this.allowedTools = hangMsOrOptions?.allowedTools;
  }

  async authorizeAndExecute(request: ToolExecuteRequest): Promise<ToolExecuteResult> {
    if (this.allowedTools !== undefined && !this.allowedTools.includes(request.toolName)) {
      return deny();
    }

    const catalog = this.registry.resolve(request.toolName);
    if (catalog === undefined || catalog.status !== "active") {
      return deny();
    }

    if (catalog.source !== "native" || HIGH_RISK.has(catalog.riskClass)) {
      return deny(catalog.source);
    }

    const parsedArgs = catalog.inputSchema.safeParse(request.arguments);
    if (!parsedArgs.success) {
      return {
        ok: false,
        code: AGENT_ERROR_CODES.TOOL_INVALID_ARGS,
        message: adapterSafeAgentMessage(AGENT_ERROR_CODES.TOOL_INVALID_ARGS),
      };
    }

    const timeoutMs = Math.min(request.timeoutMs, catalog.timeoutMs);
    const args = parsedArgs.data as Record<string, unknown>;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const work = this.runExecutor(catalog.execute, args, controller.signal);
      const result = await Promise.race([
        work,
        abortAsTimeout(controller.signal),
      ]);

      if (!result.ok || controller.signal.aborted) {
        return result.ok
          ? {
              ok: false,
              code: AGENT_ERROR_CODES.TOOL_TIMEOUT,
              message: adapterSafeAgentMessage(AGENT_ERROR_CODES.TOOL_TIMEOUT),
            }
          : result;
      }

      const parsedOutput = catalog.outputSchema.safeParse(result.payload);
      if (!parsedOutput.success) {
        return {
          ok: false,
          code: AGENT_ERROR_CODES.TOOL_FAILED,
          message: adapterSafeAgentMessage(AGENT_ERROR_CODES.TOOL_FAILED),
        };
      }

      const serialized = JSON.stringify(parsedOutput.data);
      if (serialized.length > MAX_TOOL_STRING_CHARS) {
        return {
          ok: false,
          code: AGENT_ERROR_CODES.TOOL_FAILED,
          message: adapterSafeAgentMessage(AGENT_ERROR_CODES.TOOL_FAILED),
        };
      }

      return { ok: true, payload: parsedOutput.data, source: catalog.source };
    } catch (error) {
      if (isTimeoutError(error) || controller.signal.aborted) {
        return {
          ok: false,
          code: AGENT_ERROR_CODES.TOOL_TIMEOUT,
          message: adapterSafeAgentMessage(AGENT_ERROR_CODES.TOOL_TIMEOUT),
        };
      }
      return {
        ok: false,
        code: AGENT_ERROR_CODES.TOOL_FAILED,
        message: adapterSafeAgentMessage(AGENT_ERROR_CODES.TOOL_FAILED),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async runExecutor(
    execute: (args: Record<string, unknown>) => Promise<unknown> | unknown,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<ToolExecuteResult> {
    if (this.hangMs !== undefined) {
      await sleep(this.hangMs, signal);
    }
    if (signal.aborted) {
      throw timeoutError();
    }
    const payload = await execute(args);
    if (signal.aborted) {
      throw timeoutError();
    }
    return { ok: true, payload };
  }
}

function deny(source?: ToolSource): ToolExecuteResult {
  return {
    ok: false,
    code: AGENT_ERROR_CODES.TOOL_DENIED,
    message: adapterSafeAgentMessage(AGENT_ERROR_CODES.TOOL_DENIED),
    ...(source === undefined ? {} : { source }),
  };
}

function timeoutError(): Error & { code: string } {
  return Object.assign(new Error("tool timeout"), { code: AGENT_ERROR_CODES.TOOL_TIMEOUT });
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === AGENT_ERROR_CODES.TOOL_TIMEOUT;
}

function abortAsTimeout(signal: AbortSignal): Promise<ToolExecuteResult> {
  return new Promise((resolve) => {
    const finish = () => {
      resolve({
        ok: false,
        code: AGENT_ERROR_CODES.TOOL_TIMEOUT,
        message: adapterSafeAgentMessage(AGENT_ERROR_CODES.TOOL_TIMEOUT),
      });
    };
    if (signal.aborted) {
      finish();
      return;
    }
    signal.addEventListener("abort", finish, { once: true });
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(timeoutError());
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function listRegisteredRiskClasses(registry: ToolRegistry = createProductToolRegistry()): ToolRiskClass[] {
  return registry.list().map((tool) => tool.riskClass);
}
