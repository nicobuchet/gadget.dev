/**
 * Interpolates `{{ variable }}` and `{{ env.VAR }}` placeholders in a string.
 */
export function interpolate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_match, key: string) => {
    // Handle env.VAR_NAME
    if (key.startsWith("env.")) {
      const envKey = key.slice(4);
      const value = process.env[envKey];
      if (value === undefined) {
        throw new Error(`Environment variable "${envKey}" is not set`);
      }
      return value;
    }

    // Handle regular variables
    if (key in variables) {
      return variables[key];
    }

    throw new Error(
      `Unresolved variable "{{ ${key} }}". Available: ${Object.keys(variables).join(", ") || "(none)"}`,
    );
  });
}

/**
 * Recursively interpolates all string values in an object.
 */
export function interpolateDeep<T>(
  obj: T,
  variables: Record<string, string>,
): T {
  if (typeof obj === "string") {
    return interpolate(obj, variables) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateDeep(item, variables)) as T;
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateDeep(value, variables);
    }
    return result as T;
  }
  return obj;
}
