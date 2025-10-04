// Basic guardrails for AI → Runtime interactions

export function sanitizePrompt(prompt: string): string {
  // Strip any disallowed tokens or dangerous characters
  return prompt.replace(/[{}<>$;]/g, "").slice(0, 500);
}

export function isAllowedEndpoint(url: string, allowlist: string[]): boolean {
  return allowlist.some((prefix) => url.startsWith(prefix));
}

export function enforceShaderCaps(shaderSrc: string): boolean {
  // Simple heuristic: forbid while loops and huge arrays
  if (/while\s*\(/i.test(shaderSrc)) return false;
  if (/\[\d{5,}\]/.test(shaderSrc)) return false;
  return true;
}
