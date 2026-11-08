export type ToolValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

export type ToolValidatorFunction = (
  args: Record<string, unknown>,
) => { ok: true } | { ok: false; error: string };

export interface ZodLikeIssue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

export interface ZodLikeSchema {
  safeParse(data: unknown):
    | { readonly success: true; readonly data?: unknown }
    | { readonly success: false; readonly error: { readonly issues: readonly ZodLikeIssue[] } };
}

export type ToolSchema = ToolValidatorFunction | ZodLikeSchema;

export function validateToolArgs(
  toolKey: string,
  args: Record<string, unknown>,
  schemas: Record<string, ToolSchema>,
): ToolValidationResult {
  const schema = schemas[toolKey];
  if (!schema) {
    return { ok: false, error: `Unknown tool: ${toolKey}` };
  }

  if (typeof schema === 'function') {
    return schema(args);
  }

  if ('safeParse' in schema && typeof schema.safeParse === 'function') {
    const parsed = schema.safeParse(args);
    if (parsed.success) return { ok: true };
    const issue = parsed.error.issues[0];
    const pathStr = issue?.path && issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    const message = issue?.message ?? 'Validation failed';
    return { ok: false, error: `Invalid arguments: ${pathStr}${message}` };
  }

  return { ok: false, error: `Invalid schema definition for tool: ${toolKey}` };
}
