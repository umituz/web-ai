export interface TextGenerationOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  model?: string;
}

export interface ITextGenerator {
  generateText(prompt: string, options?: TextGenerationOptions): Promise<string>;
  generateTextStream(prompt: string, options?: TextGenerationOptions): AsyncGenerator<string>;
}
