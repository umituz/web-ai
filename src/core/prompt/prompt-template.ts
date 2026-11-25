export interface InterpolateOptions {
  missingVarHandler?: "empty" | "leave" | "throw";
  trimValues?: boolean;
}

export function interpolatePrompt(
  template: string,
  variables: Record<string, unknown>,
  options: InterpolateOptions = {},
): string {
  const { missingVarHandler = "leave", trimValues = true } = options;

  return template.replace(/\{\{?([a-zA-Z0-9_.-]+)\}?\}/g, (match, key: string) => {
    const keys = key.split(".");
    let current: unknown = variables;
    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = (current as Record<string, unknown>)[k];
      } else {
        current = undefined;
        break;
      }
    }

    if (current === undefined || current === null) {
      if (missingVarHandler === "throw") {
        throw new Error(`Missing required prompt variable: ${key}`);
      }
      if (missingVarHandler === "empty") {
        return "";
      }
      return match;
    }

    const val = String(current);
    return trimValues ? val.trim() : val;
  });
}
