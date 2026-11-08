
export class StructuredPromptBuilder {
  private schema: Record<string, unknown> | undefined;
  private request: string;

  constructor(request: string) {
    this.request = request;
  }

  static for(request: string): StructuredPromptBuilder {
    return new StructuredPromptBuilder(request);
  }

  withSchema(schema: Record<string, unknown> | undefined): this {
    this.schema = schema;
    return this;
  }

  build(): string {
    const schemaSection = this.schema
      ? `Expected JSON schema:\n${JSON.stringify(this.schema, null, 2)}\n\n`
      : "";

    return (
      "Please generate a JSON response for the following request.\n\n" +
      schemaSection +
      `Request:\n${this.request}\n\n` +
      "Respond only with valid JSON, formatted as:\n```json\n{...}\n```"
    );
  }
}
