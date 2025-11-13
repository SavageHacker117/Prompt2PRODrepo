import * as THREE from 'three'
import { ScriptRuntime, ScriptDef } from './ScriptRuntime'

export type ScanResult = { ok: boolean; count: number }

export class ScriptHost {
  private scripts = new Map<string, ScriptDef>()
  private active = new Map<string, ScriptRuntime>()
  public boneMap: Map<string, THREE.Object3D> = new Map()
  public skeleton?: THREE.Skeleton

  attach(root: THREE.Object3D) {
    // build a bone map by name
    this.boneMap.clear()
    root.traverse((o: any) => {
      if (o.isBone || o.type === 'Bone') this.boneMap.set(o.name || '(unnamed)', o)
    })
    const skinned = root.getObjectByProperty('isSkinnedMesh', true) as any
    if (skinned?.skeleton) this.skeleton = skinned.skeleton as THREE.Skeleton
  }

  scanForSkeleton(): ScanResult {
    return { ok: this.boneMap.size > 0, count: this.boneMap.size }
  }

  // CRUD
  list(): string[] { return Array.from(this.scripts.keys()) }
  add(name: string, def: ScriptDef) { this.scripts.set(name, def) }
  remove(name: string) {
    this.stop(name)
    this.scripts.delete(name)
  }
  rename(oldName: string, newName: string) {
    if (!this.scripts.has(oldName) || this.scripts.has(newName)) return false
    const def = this.scripts.get(oldName)!
    this.scripts.delete(oldName)
    def.name = newName
    this.scripts.set(newName, def)
    return true
  }

  start(name: string): boolean {
    const def = this.scripts.get(name)
    if (!def) return false
    const bone = this.boneMap.get(def.target) || this.boneMap.get(this.suggestBone('wave') || '')
    if (!bone) return false
    const rt = new ScriptRuntime(def, bone)
    rt.start()
    this.active.set(name, rt)
    return true
  }

  stop(name: string) {
    const rt = this.active.get(name)
    rt?.stop()
    this.active.delete(name)
  }

  clear() { for (const k of Array.from(this.active.keys())) this.stop(k) }

  update(dt: number) { for (const r of this.active.values()) r.update(dt) }

  suggestBone(kind: 'wave' | string): string | null {
    const pref = ['hand', 'wrist', 'forearm', 'arm']
    const names = Array.from(this.boneMap.keys())
    for (const p of pref) {
      const n = names.find(nm => nm.toLowerCase().includes(p))
      if (n) return n
    }
    return names[0] || null
  }

  saveToStorage() {
    const data = JSON.stringify(Array.from(this.scripts.values()))
    localStorage.setItem('scripts', data)
  }
  loadFromStorage() {
    const raw = localStorage.getItem('scripts')
    if (!raw) return
    try {
      const arr: ScriptDef[] = JSON.parse(raw)
      this.scripts.clear()
      for (const def of arr) this.scripts.set(def.name, def)
    } catch {}
  }
}
