import type { OceanPlugin } from '../OceanPlugin';

// Very loose typing – you’ll wire this into your AST/CLI system later.
export function registerOceanCommands(cli: any, ocean: OceanPlugin): void {
  if (!cli || !ocean) return;

  const query = ocean.query;

  cli.register?.('sea.debug.sample', (x: number, z: number, time: number) => {
    const sample = query.sample({ x, y: z } as any, time);
    // eslint-disable-next-line no-console
    console.log('[sea.debug.sample]', { x, z, time, sample });
  });

  // Stubs/placeholders for later:
  cli.register?.('sea.setStyle', (styleName: string) => {
    // you’ll hook this into OceanConfig presets later
    // eslint-disable-next-line no-console
    console.log('[sea.setStyle] not yet implemented:', styleName);
  });
}
