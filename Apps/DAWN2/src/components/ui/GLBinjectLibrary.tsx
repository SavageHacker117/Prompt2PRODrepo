// src/components/models/GLBinjectLibrary.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

type ModelInfo = { name: string; url: string; source?: 'manifest'|'guess'|'upload' }

const LS_KEY = 'glbManifestUploads'

async function exists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    return r.ok
  } catch { return false }
}

async function fetchManifest(): Promise<ModelInfo[]> {
  try {
    const r = await fetch('/assets/models/manifest.json', { cache: 'no-store' })
    if (r.ok) {
      const arr = await r.json()
      if (Array.isArray(arr)) {
        return arr.map((u: any) => {
          const url = typeof u === 'string' ? u : (u.url || '')
          const base = (typeof u === 'string' ? u : (u.name || url))
          const name = base.split('/').pop()?.replace(/\.glb$/i, '') || 'model'
          return { name, url, source: 'manifest' as const }
        })
      }
    }
  } catch {}
  return []
}

/** Correct, repo-matching guesses (note: rose path fixed) */
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

function loadUploadsFromLS(): ModelInfo[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    if (Array.isArray(arr)) {
      return arr.map((u: any) => ({ name: u.name, url: u.url, source: 'upload' as const }))
    }
  } catch {}
  return []
}

function saveUploadsToLS(models: ModelInfo[]) {
  const uploads = models.filter(m => m.source === 'upload').map(m => ({ name: m.name, url: m.url }))
  localStorage.setItem(LS_KEY, JSON.stringify(uploads))
}

async function getGLBStats(url: string) {
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(url)
  let objects = 0, meshes = 0, skinned = 0, bones = 0, materials = 0, verts = 0

  const mats = new Set<any>()
  gltf.scene.traverse((o: any) => {
    objects++
    if (o.isBone) bones++
    if (o.isMesh) {
      meshes++
      if (o.isSkinnedMesh) skinned++
      const m = o.material
      if (m) Array.isArray(m) ? m.forEach((x: any) => mats.add(x)) : mats.add(m)
      const pos = o.geometry?.attributes?.position
      if (pos?.count) verts += pos.count
    }
  })
  materials = mats.size
  const animations = gltf.animations?.length || 0
  return { objects, meshes, skinned, bones, materials, verts, animations }
}

export default function GLBinjectLibrary() {
  const [open, setOpen] = useState(true)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [tint, setTint] = useState('#ffffff')
  const [busy, setBusy] = useState(false)
  const [infoUrl, setInfoUrl] = useState<string | null>(null)
  const [stats, setStats] = useState<any | null>(null)

  const scan = async () => {
    setBusy(true)
    const [man, uploads] = await Promise.all([fetchManifest(), Promise.resolve(loadUploadsFromLS())])

    // filter guesses by existence (avoids the /assets/rose.glb 404 → JSON error)
    const guessChecks = await Promise.all(GUESSES.map(async g => (await exists(g)) ? g : null))
    const guessModels = guessChecks
      .filter(Boolean)
      .map(u => ({ name: u!.split('/').pop()!.replace(/\.glb$/i, ''), url: u!, source: 'guess' as const }))

    // merge & de-dupe by URL
    const merged = [...man, ...guessModels, ...uploads]
    const uniq = Array.from(new Map(merged.map(m => [m.url, m])).values())
    setModels(uniq)
    setBusy(false)
  }

  useEffect(() => { scan() }, [])

  // quick info panel
  useEffect(() => {
    let dead = false
    ;(async () => {
      if (!infoUrl) { setStats(null); return }
      setStats('...')
      try {
        const s = await getGLBStats(infoUrl)
        if (!dead) setStats(s)
      } catch {
        if (!dead) setStats(null)
      }
    })()
    return () => { dead = true }
  }, [infoUrl])

  const engine = useMemo(() => ((window as any).__engine ||= {}), [])
  const spawn = (m: ModelInfo) => engine.spawnActor?.(m.url, { tint })

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const url = URL.createObjectURL(f)
    const name = f.name.replace(/\.glb$/i, '')
    const entry: ModelInfo = { name, url, source: 'upload' }
    const next = [...models, entry]
    setModels(next)
    saveUploadsToLS(next)
    setInfoUrl(url)
    e.currentTarget.value = ''
  }

  if (!open) return null

  return (
    <div className="panel" style={{ position: 'fixed', right: 12, bottom: 12, width: 340, zIndex: 26 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontWeight:600 }}>ACTORS</div>
        <button className="btn" onClick={() => setOpen(false)}>✕</button>
      </div>

      <div className="row" style={{ marginBottom:8 }}>
        <div className="label">Tint</div>
        <input className="input" type="color" value={tint} onChange={e=>setTint(e.target.value)} />
        <span style={{ flex:1 }} />
        <button className="btn" onClick={scan} disabled={busy}>{busy ? 'Scanning…' : 'Rescan'}</button>
        <label className="btn" style={{ cursor: 'pointer' }}>
          Upload
          <input type="file" accept=".glb" onChange={onUpload} style={{ display:'none' }} />
        </label>
      </div>

      <div style={{ display:'grid', gap:6, maxHeight:220, overflow:'auto', marginBottom:8 }}>
        {models.map(m => (
          <div key={m.url} className="row" style={{ gap:8 }}>
            <div className="label" title={`${m.url} (${m.source || 'unknown'})`}
                 style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {m.name}
            </div>
            <button className="btn" onClick={() => setInfoUrl(m.url)}>Info</button>
            <button className="btn" onClick={() => spawn(m)}>Spawn</button>
          </div>
        ))}
        {models.length === 0 && <div className="label" style={{ opacity:.8 }}>(no models found)</div>}
      </div>

      <div className="panel" style={{ background:'rgba(0,0,0,.25)' }}>
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
          <div className="label">Preview</div>
          <div className="label" style={{ opacity:.8, fontSize:12, maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {infoUrl || '(select a model)'}
          </div>
        </div>
        <div style={{ marginTop:6, fontSize:12 }}>
          {stats === '...' && <div className="label">Loading…</div>}
          {stats && stats !== '...' && (
            <div className="label" style={{ display:'grid', gridTemplateColumns:'auto auto', gap:4 }}>
              <span>Objects:</span><b>{stats.objects}</b>
              <span>Meshes:</span><b>{stats.meshes}</b>
              <span>Skinned:</span><b>{stats.skinned}</b>
              <span>Bones:</span><b>{stats.bones}</b>
              <span>Materials:</span><b>{stats.materials}</b>
              <span>Vertices:</span><b>{stats.verts}</b>
              <span>Animations:</span><b>{stats.animations}</b>
            </div>
          )}
          {!stats && infoUrl && <div className="label" style={{ opacity:.8 }}>(no stats)</div>}
        </div>
      </div>
    </div>
  )
}
