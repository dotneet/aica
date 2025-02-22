import { describe, test, expect, beforeEach } from "bun:test";
import { createLLM } from "./factory";
import { LLMConfig, readConfig } from "@/config";

describe("LLM Factory", () => {
  let defaultConfig: LLMConfig;

  beforeEach(async () => {
    const config = await readConfig(null);
    defaultConfig = config.llm;
  });

  describe("OpenAI Provider", () => {
    test("should create OpenAI LLM instance", async () => {
      if (!Bun.env.OPENAI_API_KEY) {
        console.log(
          "Skipping OpenAI LLM instance test: OPENAI_API_KEY is not set",
        );
        return;
      }

      const config: LLMConfig = {
        ...defaultConfig,
        provider: "openai",
      };
      const llm = createLLM(config);
      expect(llm).toBeDefined();
      expect(llm.generate).toBeInstanceOf(Function);
    });

    test("should generate text with OpenAI", async () => {
      if (!Bun.env.OPENAI_API_KEY) {
        console.log(
          "Skipping OpenAI text generation test: OPENAI_API_KEY is not set",
        );
        return;
      }

      const config: LLMConfig = {
        ...defaultConfig,
        provider: "openai",
        openai: {
          ...defaultConfig.openai,
          apiKey: Bun.env.OPENAI_API_KEY,
        },
      };
      const llm = createLLM(config);
      const response = await llm.generate(
        "You are a helpful assistant.",
        [{ role: "user", content: "Hello" }],
        false,
      );
      expect(response).toBeDefined();
      expect(typeof response).toBe("string");
    });
  });

  describe("Anthropic Provider", () => {
    test("should create Anthropic LLM instance", async () => {
      if (!Bun.env.ANTHROPIC_API_KEY) {
        console.log(
          "Skipping Anthropic LLM instance test: ANTHROPIC_API_KEY is not set",
        );
        return;
      }

      const config: LLMConfig = {
        ...defaultConfig,
        provider: "anthropic",
      };
      const llm = createLLM(config);
      expect(llm).toBeDefined();
      expect(llm.generate).toBeInstanceOf(Function);
    });

    test("should generate text with Anthropic", async () => {
      if (!Bun.env.ANTHROPIC_API_KEY) {
        console.log(
          "Skipping Anthropic text generation test: ANTHROPIC_API_KEY is not set",
        );
        return;
      }

      const config: LLMConfig = {
        ...defaultConfig,
        provider: "anthropic",
        anthropic: {
          ...defaultConfig.anthropic,
          apiKey: Bun.env.ANTHROPIC_API_KEY,
        },
      };
      const llm = createLLM(config);
      const response = await llm.generate(
        "You are a helpful assistant.",
        [{ role: "user", content: "Hello" }],
        false,
      );
      expect(response).toBeDefined();
      expect(typeof response).toBe("string");
    });
  });

  describe("Stub Provider", () => {
    test("should create Stub LLM instance", async () => {
      const config: LLMConfig = {
        ...defaultConfig,
        provider: "stub",
      };
      const llm = createLLM(config);
      expect(llm).toBeDefined();
      expect(llm.generate).toBeInstanceOf(Function);
    });

    test("should generate text with Stub", async () => {
      const expectedResponse = "This is a stub response";
      const config: LLMConfig = {
        ...defaultConfig,
        provider: "stub",
        stub: {
          response: expectedResponse,
        },
      };
      const llm = createLLM(config);
      const response = await llm.generate(
        "You are a helpful assistant.",
        [{ role: "user", content: "Hello" }],
        false,
      );
      expect(response).toBe(expectedResponse);
    });
  });

  test("should throw error for unknown provider", async () => {
    const config = {
      ...defaultConfig,
      provider: "unknown" as any,
    };
    expect(() => createLLM(config)).toThrow("Unknown LLM provider: unknown");
  });
});
