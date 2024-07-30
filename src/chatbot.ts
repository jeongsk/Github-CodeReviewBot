import OpenAI from "openai";

export interface ChatbotConfig {
  apiKey: string;
  project: string;
  hash: string;
  baseURL: string;
}

interface EnvironmentVariables {
  MODEL: string;
  TEMPERATURE: string;
  TOP_P: string;
  MAX_TOKENS: string;
}

export default class Chatbot {
  private readonly openai: OpenAI;
  private readonly config: ChatbotConfig;
  private readonly env: EnvironmentVariables;

  constructor(config: ChatbotConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: "LAAS_API_KEY",
      baseURL: config.baseURL,
    });
    this.env = this.loadEnvironmentVariables();
  }

  private loadEnvironmentVariables(): EnvironmentVariables {
    return {
      MODEL: process.env.MODEL || "gpt-4o-mini",
      TEMPERATURE: process.env.TEMPERATURE || "1",
      TOP_P: process.env.TOP_P || "1",
      MAX_TOKENS: process.env.MAX_TOKENS || "",
    };
  }

  public async codeReview(patch: string): Promise<string> {
    if (!patch) {
      throw new Error("Patch cannot be empty");
    }

    console.time("code-review cost");

    try {
      const res = await this.openai.chat.completions.create(
        {
          messages: [],
          model: this.env.MODEL,
        },
        {
          headers: {
            apiKey: this.config.apiKey,
            project: this.config.project,
          },
          body: {
            hash: this.config.hash,
            params: { patch },
            model: this.env.MODEL,
            temperature: parseFloat(this.env.TEMPERATURE),
            top_p: parseFloat(this.env.TOP_P),
            max_tokens: this.env.MAX_TOKENS
              ? parseInt(this.env.MAX_TOKENS)
              : undefined,
          },
        }
      );

      console.timeEnd("code-review cost");
      return res.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("Error during code review:", error);
      throw error;
    }
  }
}
