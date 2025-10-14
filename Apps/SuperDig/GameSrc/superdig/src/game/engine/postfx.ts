// Placeholder. We can wire EffectComposer later without changing callers.
export function createPostFX() {
  return {
    setBloomEnabled: (_on: boolean) => {},
    setVignetteEnabled: (_on: boolean) => {},
    render: () => {}
  };
}
