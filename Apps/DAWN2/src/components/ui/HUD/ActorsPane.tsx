// src/components/ui/HUD/ActorsPane.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const LS_UPLOADS = 'glbUploads'
const GUESSES = [
  '/assets/models/actors/rose.glb',
  '/assets/models/actors/dino1.glb',
  '/assets/models/actors/dino2.glb',
  '/assets/models/actors/dino3.glb',
  '/assets/models/actors/mage1.glb',
  '/assets/models/actors/mage2.glb',
  '/assets/models/vehicles/mech.glb',
  '/assets/models/vehicles/superdigger_rig.glb',
  '/assets/models/humanoid.glb',
]

async function exists(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    return r.ok
  } catch {
    return false
  }
}

const statsCache = new Map<string, any>()
async function getStats(url: string) {
  if (statsCache.has(url)) return statsCache.get(url)
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(url)
  let meshes = 0,
    skinned = 0,
    bones = 0,
    anims = gltf.animations?.length || 0,
    verts = 0
  gltf.scene.traverse((o: any) => {
    if (o.isBone) bones++
    if (o.isMesh) {
      meshes++
      if (o.isSkinnedMesh) skinned++
      const pos = o.geometry?.attributes?.position
      if (pos?.count) verts += pos.count
    }
  })
  const s = { meshes, skinned, bones, verts, animations: anims }
  statsCache.set(url, s)
  return s
}

type Model = { name: string; url: string; source: 'manifest' | 'guess' | 'upload' }

export default function ActorsPane() {
  const [models, setModels] = useState<Model[]>([])
  const [tint, setTint] = useState('#ffffff')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ url: string; stats: any | '...' } | null>(
    null,
  )

  const engine = useMemo(() => ((window as any).__engine ||= {}), [])

  // One-time cleanup of old persisted blob: URLs which are invalid after refresh
  useEffect(() => {
    try {
      localStorage.removeItem(LS_UPLOADS)
    } catch {
      // ignore
    }
  }, [])

  function baseName(u: string) {
    return (u.split('/').pop() || '').replace(/\.glb$/i, '').toLowerCase()
  }

  const scan = async () => {
    setBusy(true)
    statsCache.clear()
    setPreview(null)

    const guessed = await Promise.all(GUESSES.map(async (u) => ((await exists(u)) ? u : null)))
    const guessModels: Model[] = guessed
      .filter(Boolean)
      .map((u) => ({
        name: u!.split('/').pop()!.replace(/\.glb$/i, ''),
        url: u!,
        source: 'guess' as const,
      }))

    let manifest: Model[] = []
    try {
      const r = await fetch('/assets/models/manifest.json', { cache: 'no-store' })
      if (r.ok) {
        const arr = await r.json()
        if (Array.isArray(arr))
          manifest = arr.map((v: any) => {
            const url = typeof v === 'string' ? v : v.url
            const name =
              (typeof v === 'string' ? v : v.name || url)
                .split('/')
                .pop()
                ?.replace(/\.glb$/i, '') || 'model'
            return { name, url, source: 'manifest' as const }
          })
      }

      for (const sub of ['tools', 'actors', 'vehicles']) {
        const res = await fetch(`/assets/models/${sub}/manifest.json`, {
          cache: 'no-store',
        })
        if (!res.ok) continue
        const arr = await res.json()
        if (!Array.isArray(arr)) continue
        const extra: Model[] = arr.map((v: any) => {
          const url = typeof v === 'string' ? v : v.url
          const name =
            (typeof v === 'string' ? v : v.name || url)
              .split('/')
              .pop()
              ?.replace(/\.glb$/i, '') || 'model'
          return { name, url, source: 'manifest' as const }
        })
        manifest.push(...extra)
      }
    } catch {}

    const uploads: Model[] = []

    const priority = { manifest: 3, guess: 2, upload: 1 } as const
    const merged = [...manifest, ...guessModels, ...uploads]
    const byUrl = new Map<string, Model>()
    const byName = new Map<string, Model>()
    for (const m of merged) {
      const bn = baseName(m.url)
      const u = m.url
      const curU = byUrl.get(u)
      if (!curU || priority[m.source] > priority[curU.source]) byUrl.set(u, m)
      const curN = byName.get(bn)
      if (!curN || priority[m.source] > priority[curN.source]) byName.set(bn, m)
    }
    const finalModels = Array.from(byName.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    setModels(finalModels)
    setBusy(false)
  }

  useEffect(() => {
    scan()
  }, [])

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    const name = f.name.replace(/\.glb$/i, '')
    const entry: Model = { name, url, source: 'upload' }

    const nextMap = new Map(models.map((m) => [m.name.toLowerCase(), m]))
    nextMap.set(name.toLowerCase(), entry)
    const next = Array.from(nextMap.values())
    setModels(next)
    e.currentTarget.value = ''
  }

  const spawn = (m: Model) => engine.spawnActor?.(m.url, { tint })
  const showInfo = async (url: string) => {
    setPreview({ url, stats: '...' })
    try {
      setPreview({ url, stats: await getStats(url) })
    } catch {
      setPreview({ url, stats: null })
    }
  }

  return (
    <div className="panel">
      <div className="panel" style={{ background: 'rgba(0,0,0,.25)', marginBottom: 8 }}>
        <div className="label" style={{ fontWeight: 600, marginBottom: 6 }}>
          Preview
        </div>
        {!preview && (
          <div className="label" style={{ opacity: 0.8 }}>
            (select a model)
          </div>
        )}
        {preview?.stats === '...' && <div className="label">Loading…</div>}
        {preview?.stats && preview.stats !== '...' && (
          <div
            className="label"
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto auto',
              gap: 4,
            }}
          >
            <span>URL:</span>
            <span
              style={{
                maxWidth: 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {preview.url}
            </span>
            <span>Meshes:</span>
            <b>{preview.stats.meshes}</b>
            <span>Skinned:</span>
            <b>{preview.stats.skinned}</b>
            <span>Bones:</span>
            <b>{preview.stats.bones}</b>
            <span>Vertices:</span>
            <b>{preview.stats.verts}</b>
            <span>Animations:</span>
            <b>{preview.stats.animations}</b>
          </div>
        )}
        {preview && preview.stats === null && (
          <div className="label" style={{ opacity: 0.8 }}>
            (failed to read stats)
          </div>
        )}
      </div>

      <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div className="label">Tint</div>
        <input
          className="input"
          type="color"
          value={tint}
          onChange={(e) => setTint(e.target.value)}
        />
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={scan} disabled={busy}>
          {busy ? 'Scanning…' : 'Rescan'}
        </button>
        <label className="btn" style={{ cursor: 'pointer' }}>
          Upload
          <input
            type="file"
            accept=".glb"
            onChange={onUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflow: 'auto' }}>
        {models.map((m) => (
          <div key={m.url} className="row" style={{ gap: 8 }}>
            <div
              className="label"
              title={`${m.url} (${m.source})`}
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {m.name}
            </div>
            <button className="btn" onClick={() => showInfo(m.url)}>
              Info
            </button>
            <button className="btn" onClick={() => spawn(m)}>
              Spawn
            </button>
          </div>
        ))}
        {models.length === 0 && (
          <div className="label" style={{ opacity: 0.8 }}>
            (no models found)
          </div>
        )}
      </div>
    </div>
  )
}
