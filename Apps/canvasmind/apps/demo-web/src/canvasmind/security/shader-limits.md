# Shader Guardrails

- **Loops**: No `while` loops. Use bounded `for` with max iterations ≤ 256.
- **Array sizes**: Clamp ≤ 4096 entries.
- **Instruction count**: Shader size ≤ 50KB per stage.
- **Precision**: Use `mediump` unless explicitly justified.
- **Disallowed ops**:
  - `dFdx`, `dFdy` (perf-sensitive on mobile)
  - `discard` outside material masks
