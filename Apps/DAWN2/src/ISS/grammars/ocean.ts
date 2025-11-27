// src/ISS/grammars/ocean.ts

type Dbg = {
  extend: (
    name: string,
    fn: (args: string[]) => string | string[],
    help: string,
  ) => void;
};

function getOcean(engine: any): any | null {
  return engine?.iss?.ocean ?? null;
}

function withOcean(
  engine: any,
  fn: (ocean: any) => string | string[],
): string | string[] {
  const ocean = getOcean(engine);
  if (!ocean) {
    return '⚠️ ISS ocean system not active (engine.iss.ocean is missing).';
  }
  return fn(ocean);
}

export function registerOceanGrammar(
  dbg: Dbg,
  engine: any,
  _levels: Record<string, unknown> = {},
  _extras: Record<string, unknown> = {},
) {
  // ----- Status
  dbg.extend(
    'sea.status',
    () =>
      withOcean(engine, (ocean) => {
        const mesh = ocean.mesh ?? ocean['mesh'];
        const visible =
          typeof ocean.isVisible === 'function'
            ? ocean.isVisible()
            : !!(mesh && mesh.visible);
        const preset =
          typeof ocean.getPreset === 'function' ? ocean.getPreset() : 'unknown';
        const y = mesh?.position?.y ?? 0;

        const u = ocean.material?.uniforms ?? {};
        const lodStart = u.uLodStart?.value ?? '?';
        const lodFade = u.uLodFade?.value ?? '?';
        const turb = u.uTurbidity?.value ?? '?';
        const abs = u.uAbsorption?.value ?? '?';

        return [
          'ISS Ocean status:',
          `  visible         : ${visible}`,
          `  preset          : ${preset}`,
          `  waterLevelY     : ${typeof y === 'number' ? y.toFixed(2) : y}`,
          `  LOD(start,fade) : ${lodStart}, ${lodFade}`,
          `  turbidity       : ${turb}`,
          `  absorption      : ${abs}`,
        ];
      }),
    'Show ISS ocean status (visibility, preset, water level, LOD, clarity).',
  );

  // ----- Visibility toggle
  dbg.extend(
    'sea.toggle',
    (args) =>
      withOcean(engine, (ocean) => {
        const mesh = ocean.mesh ?? ocean['mesh'];
        if (!mesh) return 'No ocean mesh present on engine.iss.ocean.';

        const mode = (args[0] || 'toggle').toLowerCase();
        if (!['on', 'off', 'toggle'].includes(mode)) {
          return 'Usage: sea.toggle [on|off]';
        }

        const visible = mode === 'toggle' ? !mesh.visible : mode === 'on';

        if (typeof ocean.setVisible === 'function') {
          ocean.setVisible(visible);
        } else {
          mesh.visible = visible;
        }

        return `Sea visibility: ${visible ? 'on' : 'off'}`;
      }),
    'Toggle ocean visibility: sea.toggle [on|off].',
  );

  // ----- Preset: pond vs ocean
  dbg.extend(
    'sea.preset',
    (args) =>
      withOcean(engine, (ocean) => {
        const name = (args[0] || '').toLowerCase();
        if (name !== 'pond' && name !== 'ocean') {
          return [
            'Usage: sea.preset <pond|ocean>',
            '  pond  – calm, smaller waves.',
            '  ocean – full power.',
          ];
        }

        if (typeof ocean.setPreset === 'function') {
          ocean.setPreset(name);
        } else {
          const mat = ocean.material ?? ocean['material'];
          const amps: Float32Array | undefined =
            mat?.uniforms?.uWaveAmplitudes?.value;
          const base: Float32Array | undefined =
            ocean.baseWaveAmplitudes ||
            mat?.uniforms?.uWaveAmplitudesBase?.value;

          if (amps && base) {
            const scale = name === 'pond' ? 0.25 : 1.0;
            for (let i = 0; i < amps.length && i < base.length; i += 1) {
              amps[i] = base[i] * scale;
            }
          }
        }

        return `Sea preset set to ${name}`;
      }),
    'Set preset: sea.preset <pond|ocean>.',
  );

  // ----- Water level
  dbg.extend(
    'sea.level',
    (args) =>
      withOcean(engine, (ocean) => {
        if (!args.length) return 'Usage: sea.level <meters>';
        const v = Number(args[0]);
        if (!Number.isFinite(v)) return 'Usage: sea.level <meters> (number)';

        if (typeof ocean.setWaterLevel === 'function') {
          ocean.setWaterLevel(v);
          return `Sea level set to ${v.toFixed(2)}m`;
        }

        return 'This ocean build does not expose setWaterLevel().';
      }),
    'Set water level: sea.level <meters>.',
  );

  // ----- LOD controls
  dbg.extend(
    'sea.lod',
    (args) =>
      withOcean(engine, (ocean) => {
        if (args.length < 2) return 'Usage: sea.lod <start> <fade>';
        const start = Number(args[0]);
        const fade = Number(args[1]);
        if (!Number.isFinite(start) || !Number.isFinite(fade)) {
          return 'Usage: sea.lod <start> <fade>  (numbers, meters)';
        }

        const u = ocean.material?.uniforms;
        if (!u) return 'No uniforms on ocean material.';

        if (u.uLodStart) u.uLodStart.value = start;
        if (u.uLodFade) u.uLodFade.value = fade;

        return `LOD updated: start=${start}, fade=${fade}`;
      }),
    'Adjust distance-based LOD: sea.lod <start> <fade>.',
  );

  // ----- Turbidity & absorption (water clarity)
  dbg.extend(
    'sea.turbidity',
    (args) =>
      withOcean(engine, (ocean) => {
        if (!args.length) return 'Usage: sea.turbidity <value>';
        const v = Number(args[0]);
        if (!Number.isFinite(v)) return 'Usage: sea.turbidity <value>';

        const u = ocean.material?.uniforms;
        if (!u) return 'No uniforms on ocean material.';
        if (u.uTurbidity) u.uTurbidity.value = v;

        return `Turbidity set to ${v}`;
      }),
    'Set turbidity: sea.turbidity <value> (0..~10).',
  );

  dbg.extend(
    'sea.absorption',
    (args) =>
      withOcean(engine, (ocean) => {
        if (!args.length) return 'Usage: sea.absorption <value>';
        const v = Number(args[0]);
        if (!Number.isFinite(v)) return 'Usage: sea.absorption <value>';

        const u = ocean.material?.uniforms;
        if (!u) return 'No uniforms on ocean material.';
        if (u.uAbsorption) u.uAbsorption.value = v;

        return `Absorption set to ${v}`;
      }),
    'Set absorption: sea.absorption <value> (0..~1).',
  );

  // ----- Shallow color
  dbg.extend(
    'sea.color',
    (args) =>
      withOcean(engine, (ocean) => {
        if (args.length < 4) {
          return 'Usage: sea.color shallow <r> <g> <b>  (0..1)';
        }

        const which = args[0].toLowerCase();
        if (which !== 'shallow') {
          return 'Usage: sea.color shallow <r> <g> <b>';
        }

        const r = Number(args[1]);
        const g = Number(args[2]);
        const b = Number(args[3]);
        if (![r, g, b].every(Number.isFinite)) {
          return 'Usage: sea.color shallow <r> <g> <b>';
        }

        const u = ocean.material?.uniforms;
        if (!u?.uShallowColor?.value) return 'Uniform uShallowColor missing.';

        u.uShallowColor.value.set(r, g, b);

        return `Shallow color set to [${r.toFixed(2)}, ${g.toFixed(
          2,
        )}, ${b.toFixed(2)}]`;
      }),
    'Set shallow water color: sea.color shallow <r> <g> <b>.',
  );

  // ----- Sample height (requires WaveSystem sampler support)
  dbg.extend(
    'sea.sample',
    (args) =>
      withOcean(engine, (ocean) => {
        if (args.length < 2) return 'Usage: sea.sample <x> <z> [time]';

        const x = Number(args[0]);
        const z = Number(args[1]);
        const t = args[2] !== undefined ? Number(args[2]) : undefined;

        if (!Number.isFinite(x) || !Number.isFinite(z)) {
          return 'Usage: sea.sample <x> <z> [time]  (x/z must be numbers)';
        }

        const waveSystem = ocean.query ?? ocean.waveSystem;
        const fn =
          waveSystem?.sampleHeightAt ||
          waveSystem?.sampleHeight ||
          waveSystem?.debugSample;

        if (typeof fn !== 'function') {
          return 'Wave sampling not implemented for this build.';
        }

        const y = fn.call(waveSystem, x, z, t);
        if (typeof y !== 'number') {
          return 'Wave sampling returned a non-numeric value.';
        }

        return `sea.sample: height(${x.toFixed(2)}, ${z.toFixed(
          2,
        )}) ≈ ${y.toFixed(3)}`;
      }),
    'Sample ocean height at world X,Z: sea.sample <x> <z> [time].',
  );
}
