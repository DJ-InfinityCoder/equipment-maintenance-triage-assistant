import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { AiError, AiErrorSubtype } from "../schemas/errors";
import { GEMINI_TRIAGE_RESPONSE_SCHEMA } from "./schema";

export interface TriageModelRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface TriageModel {
  generate(request: TriageModelRequest): Promise<string>;
}

export function identifyErrorSubtype(error: unknown): AiErrorSubtype {
  if (error instanceof AiError) {
    return error.subtype;
  }

  const errStr = String(error).toLowerCase();
  const status = (error as { status?: number; statusCode?: number })?.status ??
    (error as { status?: number; statusCode?: number })?.statusCode;

  if (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    errStr.includes("404")
  ) {
    return "configuration";
  }

  if (
    errStr.includes("timeout") ||
    errStr.includes("aborted") ||
    errStr.includes("deadline_exceeded") ||
    status === 504 ||
    status === 408
  ) {
    return "timeout";
  }

  if (
    status === 429 ||
    errStr.includes("429") ||
    errStr.includes("quota") ||
    errStr.includes("resource_exhausted") ||
    errStr.includes("rate limit")
  ) {
    return "rate_limit";
  }

  if (
    status === 503 ||
    status === 502 ||
    status === 500 ||
    errStr.includes("503") ||
    errStr.includes("unavailable") ||
    errStr.includes("econnrefused") ||
    errStr.includes("fetch failed")
  ) {
    return "unavailable";
  }

  if (
    errStr.includes("safety") ||
    errStr.includes("blocked") ||
    errStr.includes("policy") ||
    errStr.includes("prohibited")
  ) {
    return "blocked";
  }

  if (
    errStr.includes("json") ||
    errStr.includes("syntaxerror") ||
    errStr.includes("parse") ||
    errStr.includes("malformed") ||
    errStr.includes("invalid_output")
  ) {
    return "invalid_output";
  }

  return "unavailable";
}

export function mapToAiError(error: unknown): AiError {
  if (error instanceof AiError) {
    return error;
  }

  const subtype = identifyErrorSubtype(error);
  const rawMessage = error instanceof Error ? error.message : String(error);

  return new AiError(`AI Model error: ${rawMessage}`, {
    subtype,
    cause: error,
  });
}

export class GeminiTriageModel implements TriageModel {
  private apiKey: string;
  private modelName: string;

  constructor(options?: { apiKey?: string; modelName?: string }) {
    this.apiKey = options?.apiKey || process.env.GEMINI_API_KEY || "";
    this.modelName = options?.modelName || process.env.GEMINI_MODEL?.trim() || "";
  }

  async generate(request: TriageModelRequest): Promise<string> {
    if (!this.apiKey) {
      throw new AiError("GEMINI_API_KEY is not configured", {
        subtype: "configuration",
        userMessage:
          "GEMINI_API_KEY is missing for the Gemini provider.",
      });
    }
    if (!this.modelName) {
      throw new AiError("GEMINI_MODEL is not configured", {
        subtype: "configuration",
        userMessage:
          "GEMINI_MODEL is missing. Set it to a model enabled for your Gemini API key and restart the app.",
      });
    }

    const { systemPrompt, userPrompt, temperature = 0.2, timeoutMs = 20000 } = request;

    const executeCall = async (): Promise<string> => {
      const ai = new GoogleGenAI({ apiKey: this.apiKey });
      const controller = new AbortController();
      const abortFromRequest = () => {
        controller.abort(request.signal?.reason);
      };
      if (request.signal?.aborted) {
        abortFromRequest();
      } else {
        request.signal?.addEventListener("abort", abortFromRequest, { once: true });
      }
      const timeoutId = setTimeout(() => {
        controller.abort(new Error(`AI generation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const response = await ai.models.generateContent({
          model: this.modelName,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            temperature,
            responseMimeType: "application/json",
            responseSchema: GEMINI_TRIAGE_RESPONSE_SCHEMA,
            abortSignal: controller.signal,
          },
        });

        const text = response.text?.trim() || "";
        if (!text) {
          throw new AiError("Gemini returned an empty response", {
            subtype: "invalid_output",
            userMessage: "Gemini returned an empty response.",
          });
        }
        return text;
      } finally {
        clearTimeout(timeoutId);
        request.signal?.removeEventListener("abort", abortFromRequest);
      }
    };

    try {
      return await executeCall();
    } catch (firstError) {
      const subtype = identifyErrorSubtype(firstError);
      if (subtype === "rate_limit" || subtype === "unavailable") {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        try {
          return await executeCall();
        } catch (secondError) {
          throw mapToAiError(secondError);
        }
      }
      throw mapToAiError(firstError);
    }
  }
}

const GroqApiErrorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().optional(),
    code: z.union([z.string(), z.number()]).optional(),
  }).passthrough(),
}).passthrough();

function getGroqApiError(body: unknown): {
  message?: string;
  type?: string;
  code?: string | number;
} {
  const result = GroqApiErrorSchema.safeParse(body);
  if (!result.success) {
    return {};
  }

  return {
    message: result.data.error.message
      ?.replace(/[\r\n\t]+/g, " ")
      .slice(0, 500),
    type: result.data.error.type,
    code: result.data.error.code,
  };
}

function toStandardJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toStandardJsonSchema);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const object = value as Record<string, unknown>;
  const typeMap: Record<string, string> = {
    OBJECT: "object",
    ARRAY: "array",
    STRING: "string",
    INTEGER: "integer",
    NUMBER: "number",
    BOOLEAN: "boolean",
  };

  return Object.fromEntries(
    Object.entries(object).map(([key, entry]) => [
      key,
      key === "type" && typeof entry === "string"
        ? typeMap[entry] ?? entry.toLowerCase()
        : toStandardJsonSchema(entry),
    ])
  );
}

export class GroqTriageModel implements TriageModel {
  private apiKey: string;
  private modelName: string;
  private client: Groq;

  constructor(options?: {
    apiKey?: string;
    modelName?: string;
    fetchFn?: typeof fetch;
  }) {
    this.apiKey = options?.apiKey || process.env.GROQ_API_KEY || "";
    this.modelName = options?.modelName || process.env.GROQ_MODEL?.trim() || "";
    this.client = new Groq({
      apiKey: this.apiKey || "missing-groq-api-key",
      fetch: options?.fetchFn,
      maxRetries: 0,
    });
  }

  async generate(request: TriageModelRequest): Promise<string> {
    if (!this.apiKey) {
      throw new AiError("GROQ_API_KEY is not configured", {
        subtype: "configuration",
        userMessage:
          "GROQ_API_KEY is missing for the Groq provider.",
      });
    }
    if (!this.modelName) {
      throw new AiError("GROQ_MODEL is not configured", {
        subtype: "configuration",
        userMessage:
          "GROQ_MODEL is missing. Set it to a model enabled for your Groq API key and restart the app.",
      });
    }

    const { systemPrompt, userPrompt, temperature = 0.2, timeoutMs = 20000 } = request;
    try {
      const result = await this.client.chat.completions.create(
        {
          model: this.modelName,
          messages: [
            {
              role: "system",
              content: `${systemPrompt}\n\nReturn a single JSON object matching this JSON schema exactly:\n${JSON.stringify(toStandardJsonSchema(GEMINI_TRIAGE_RESPONSE_SCHEMA))}`,
            },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_completion_tokens: 4096,
          response_format: { type: "json_object" },
          stream: false,
        },
        { timeout: timeoutMs, signal: request.signal }
      );

      const text = result.choices[0]?.message.content;
      if (!text) {
        throw new AiError("Groq returned an empty response", {
          subtype: "invalid_output",
          userMessage: "Groq returned an empty response. Please retry triage.",
        });
      }
      return text;
    } catch (error) {
      if (error instanceof AiError) {
        throw error;
      }
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? error.status
          : undefined;
      const providerError =
        typeof error === "object" && error !== null && "error" in error
          ? getGroqApiError(error.error)
          : {};
      const subtype = identifyErrorSubtype(error);

      if (status === 400 || status === 401 || status === 403 || status === 404) {
        throw new AiError("Groq rejected the configured API key or model", {
          subtype: "configuration",
          userMessage:
            "Groq rejected the configured API key or model. Check GROQ_API_KEY and GROQ_MODEL.",
          cause: error,
        });
      }
      if (status === 429) {
        throw new AiError("Groq rate limit exceeded", {
          subtype: "rate_limit",
          userMessage:
            `Groq rate limit: ${providerError.message ?? "The provider rejected this request because a quota was exceeded."} ` +
            "Check the Groq Console for this model's request, token, daily, and billing limits.",
          details: {
            provider: "groq",
            status,
            providerErrorType: providerError.type,
            providerErrorCode: providerError.code,
          },
          cause: error,
        });
      }
      if (subtype === "timeout") {
        throw new AiError(`Groq generation timed out after ${timeoutMs}ms`, {
          subtype: "timeout",
          cause: error,
        });
      }
      throw mapToAiError(error);
    }
  }
}

export class FailoverTriageModel implements TriageModel {
  constructor(
    private readonly providers: Array<{
      name: "gemini" | "groq";
      model: TriageModel;
    }>
  ) {}

  async generate(request: TriageModelRequest): Promise<string> {
    if (this.providers.length === 0) {
      throw new AiError("No AI providers are configured", {
        subtype: "configuration",
        userMessage:
          "Configure GEMINI_API_KEY with GEMINI_MODEL, or GROQ_API_KEY with GROQ_MODEL, then restart the app.",
      });
    }

    let lastError: AiError | undefined;
    const failures: string[] = [];

    for (const provider of this.providers) {
      try {
        return await provider.model.generate(request);
      } catch (error) {
        lastError = mapToAiError(error);
        failures.push(`${provider.name}: ${lastError.subtype}`);
      }
    }

    const finalError = lastError ?? new AiError("AI providers failed", {
      subtype: "unavailable",
    });
    throw new AiError(
      `All configured AI providers failed (${failures.join(", ")})`,
      {
        subtype: finalError.subtype,
        userMessage:
          `AI generation failed for all configured providers (${failures.join(", ")}). ` +
          finalError.userMessage,
        cause: finalError,
      }
    );
  }
}

export function createConfiguredTriageModel(): TriageModel {
  const preferredProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (preferredProvider && preferredProvider !== "gemini" && preferredProvider !== "groq") {
    throw new AiError("AI_PROVIDER must be set to 'gemini' or 'groq'", {
      subtype: "configuration",
      userMessage:
        "Set AI_PROVIDER to either 'gemini' or 'groq' in .env.local, then restart the app.",
    });
  }

  const order: Array<"gemini" | "groq"> = preferredProvider === "groq"
    ? ["groq", "gemini"]
    : ["gemini", "groq"];

  const providers: Array<{ name: "gemini" | "groq"; model: TriageModel }> = [];
  for (const name of order) {
    if (name === "gemini" && process.env.GEMINI_API_KEY) {
      providers.push({ name, model: new GeminiTriageModel() });
      continue;
    }
    if (name === "groq" && process.env.GROQ_API_KEY) {
      providers.push({ name, model: new GroqTriageModel() });
    }
  }

  return new FailoverTriageModel(providers);
}
