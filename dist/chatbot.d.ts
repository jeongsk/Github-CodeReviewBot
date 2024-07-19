export interface ChatbotConfig {
    apiKey: string;
    project: string;
    hash: string;
    baseURL: string;
}
export default class Chatbot {
    private readonly openai;
    private readonly config;
    private readonly env;
    constructor(config: ChatbotConfig);
    private loadEnvironmentVariables;
    codeReview(patch: string): Promise<string>;
}
