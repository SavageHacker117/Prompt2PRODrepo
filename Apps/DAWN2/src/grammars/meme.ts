// src/grammars/meme.ts
import { MemeTo3DClient, MemeJobDetail } from '../tools/memeTo3DClient';

type Dbg = {
  extend: (
    name: string,
    fn: (args: string[]) => string | string[],
    help: string,
  ) => void;
};

type EngineWithMeme = any & {
  __meme?: {
    client: MemeTo3DClient;
    lastJob: MemeJobDetail | null;
  };
  // optional hooks (you can implement these later)
  spawnActor?: (url: string, opts?: any) => string | void;
  gs?: {
    spawnSplat?: (url: string, opts?: any) => string | void;
  };
};

function getMemeState(engine: EngineWithMeme) {
  if (!engine.__meme) {
    engine.__meme = {
      client: new MemeTo3DClient({ baseUrl: 'http://localhost:8000' }),
      lastJob: null,
    };
  }
  return engine.__meme;
}

export function registerMemeGrammar(
  dbg: Dbg,
  engine: any,
  _levels: Record<string, unknown> = {},
  _extras: Record<string, unknown> = {},
) {
  const e = engine as EngineWithMeme;
  const meme = getMemeState(e);

  // ---------------------------------------------------------------------------
  // meme.backend
  // ---------------------------------------------------------------------------

  dbg.extend(
    'meme.backend',
    (args) => {
      const url = args[0];
      if (!url) {
        return [
          'meme.backend <url>',
          `  current: ${meme.client.getBaseUrl()}`,
        ];
      }
      meme.client.setBaseUrl(url);
      return `memeTo3D backend set to ${meme.client.getBaseUrl()}`;
    },
    'Get or set the memeTo3D backend base URL: meme.backend <url>.',
  );

  // ---------------------------------------------------------------------------
  // meme.latest
  // ---------------------------------------------------------------------------

  dbg.extend(
    'meme.latest',
    (args) => {
      void (async () => {
        try {
          const job = await meme.client.getLatestJob();
          if (!job) {
            console.log('[memeTo3D] No jobs found on backend.');
            return;
          }
          meme.lastJob = job;

          const assetsCount = (job.manifest as any)?.assets?.length ?? 0;

          console.log('[memeTo3D] Latest job:', job.id, job.status);
          console.log('[memeTo3D] Manifest assets:', assetsCount);
          console.log('[memeTo3D] Full manifest', job.manifest);
          console.log('[memeTo3D] Stored on engine.__meme.lastJob');
        } catch (err) {
          console.error('[memeTo3D] Error fetching latest job:', err);
        }
      })();

      const hint =
        args[0] === 'verbose'
          ? 'Check dev console (F12) for full manifest details.'
          : 'Run again with "verbose" or open dev console (F12) to inspect manifest.';

      return [
        'Fetching latest memeTo3D job from backend asynchronously…',
        `Backend: ${meme.client.getBaseUrl()}`,
        hint,
      ];
    },
    'Fetch latest memeTo3D job + manifest and stash it on engine.__meme.lastJob.',
  );

  // ---------------------------------------------------------------------------
  // meme.spawnAll
  // ---------------------------------------------------------------------------

  dbg.extend(
    'meme.spawnAll',
    () => {
      const job = meme.lastJob;
      const manifest: any = job?.manifest;
      const assets: any[] = manifest?.assets ?? [];

      if (!job || !manifest) {
        return 'No meme job manifest loaded yet. Call "meme.latest" first.';
      }
      if (!assets.length) {
        return `meme.spawnAll: job ${job.id} has no assets in manifest.`;
      }

      const spawnedIds: string[] = [];
      const baseEngine: any = engine;

      for (const asset of assets) {
        const url: string | undefined = asset.url || asset.path;
        if (!url) {
          console.warn('[memeTo3D] asset has no url/path:', asset);
          continue;
        }

        const kind: string = asset.kind || asset.type || '';
        const name: string = asset.name || asset.id || 'asset';

        // Simple routing: GLB → spawnActor; .splat → GS loader (if present).
        const lowerUrl = url.toLowerCase();

        if (lowerUrl.endsWith('.glb')) {
          if (typeof baseEngine.spawnActor === 'function') {
            const actorId =
              baseEngine.spawnActor(url, {
                id: name,
                name,
                // you can add tint/scale later if you want
              }) || name;
            spawnedIds.push(String(actorId));
            console.log('[memeTo3D] spawn GLB', name, 'url:', url, 'actorId:', actorId);
          } else {
            console.warn(
              '[memeTo3D] spawnActor is not available on engine; GLB asset not spawned.',
            );
          }
        } else if (lowerUrl.endsWith('.splat')) {
          const spawnSplat = baseEngine.gs?.spawnSplat;
          if (typeof spawnSplat === 'function') {
            const splatId = spawnSplat(url, { id: name, name, kind: kind || 'splat' });
            spawnedIds.push(String(splatId ?? name));
            console.log('[memeTo3D] spawn SPLAT', name, 'url:', url, 'id:', splatId);
          } else {
            console.warn(
              '[memeTo3D] engine.gs.spawnSplat is not defined; cannot spawn .splat asset:',
              url,
            );
          }
        } else {
          console.warn(
            '[memeTo3D] Unknown asset kind; skipping',
            { kind, url, asset },
          );
        }
      }

      console.group('[memeTo3D] spawnAll');
      console.log(
        `meme.spawnAll: ${assets.length} assets from job ${job.id} (${job.status}).`,
      );
      console.log('Spawned IDs:', spawnedIds.join(', '));
      console.log(
        'TODO (later): once your external GS / 3D pipeline writes .splat + .glb directly, this command will just mirror that manifest.',
      );
      console.groupEnd();

      return [
        `meme.spawnAll: ${assets.length} assets from job ${job.id} (${job.status})`,
        spawnedIds.length
          ? `Spawned actors/splats: ${spawnedIds.join(', ')}`
          : 'No actors/splats spawned (check console for warnings).',
      ];
    },
    'Spawn all assets from the last memeTo3D manifest into the scene (.glb → spawnActor, .splat → engine.gs.spawnSplat).',
  );
}
