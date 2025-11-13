import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('public', 'assets', 'models')

const OUTS = [
  { file: path.join(ROOT, 'manifest.json'), filter: () => true },
  { file: path.join(ROOT, 'actors', 'manifest.json'),   filter: p => p.includes('/actors/') },
  { file: path.join(ROOT, 'tools', 'manifest.json'),    filter: p => p.includes('/tools/') },
  { file: path.join(ROOT, 'vehicles', 'manifest.json'), filter: p => p.includes('/vehicles/') },
]

async function listGlb(dir) {
  const out = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...await listGlb(full))
    } else if (/\.glb$/i.test(entry.name)) {
      const parts = full.split(path.sep)
      const idx = parts.lastIndexOf('public')
      const rel = parts.slice(idx + 1) // assets/models/...
      out.push('/' + path.posix.join(...rel))
    }
  }
  return out
}

const urls = (await listGlb(ROOT)).sort()

for (const { file, filter } of OUTS) {
  const arr = urls.filter(filter)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(arr, null, 2))
  console.log('wrote', file, arr.length)
}
