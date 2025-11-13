import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BlockType = 'block' | 'platform' | 'ramp'
export type Block = {
  id: string
  type: BlockType
  pos: [number, number, number] // grid/base position (y=0 on floor)
  size: [number, number, number]
  rotY?: number
  color?: string
  groupId?: string | null
  name?: string
}

export type Group = { id: string; name: string }

type Palette = {
  type: BlockType
  size: [number, number, number]
  color: string
}

type State = {
  mode: 'play' | 'edit'
  blocks: Block[]
  groups: Group[]
  selectedIds: string[]
  palette: Palette
  hovered: [number, number, number] | null
  rotY: number

  setMode: (m: 'play' | 'edit') => void
  setPalette: (p: Partial<Palette>) => void
  setHover: (p: [number, number, number] | null) => void
  rotate: () => void
  addBlock: (b?: Partial<Block>) => void
  removeAt: (pos: [number, number, number]) => void
  removeById: (id: string) => void
  duplicateById: (id: string) => void
  clear: () => void
  resetWorld: () => void
  importJSON: (json: string) => void
  exportJSON: () => string

  selectOnly: (id: string) => void
  toggleSelect: (id: string) => void
  clearSelection: () => void
  groupSelection: (name?: string) => void
  ungroupSelection: () => void
  clearGroups: () => void
  renameGroup: (id: string, name: string) => void
  duplicateSelection: () => void
  focusSelection: () => [number, number, number] | null
}

const rid = () =>
  (globalThis.crypto && 'randomUUID' in globalThis.crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random()))

const DEFAULT_PALETTE: Palette = { type: 'block', size: [1, 1, 1], color: '#ffffff' }

export const useWorld = create<State>()(
  persist(
    (set, get) => {
      const cleanupGroups = (blocks: Block[], groups: Group[]) => {
        const used = new Set(blocks.map((b) => b.groupId).filter(Boolean) as string[])
        return groups.filter((g) => used.has(g.id))
      }

      const uniqueGroupName = (raw: string, groups: Group[]) => {
        const base = raw.trim() || `Group ${groups.length + 1}`
        if (!groups.some((g) => g.name === base)) return base
        let i = 2
        while (groups.some((g) => g.name === `${base} (${i})`)) i++
        return `${base} (${i})`
      }

      return {
        mode: 'play',
        blocks: [],
        groups: [],
        selectedIds: [],
        palette: DEFAULT_PALETTE,
        hovered: null,
        rotY: 0,

        setMode: (m) => set({ mode: m }),
        setPalette: (p) => set({ palette: { ...get().palette, ...p } }),
        setHover: (p) => set({ hovered: p }),
        rotate: () =>
          set({ rotY: (get().rotY + Math.PI / 2) % (Math.PI * 2) }),

        addBlock: (partial) =>
          set({
            blocks: [
              ...get().blocks,
              {
                id: rid(),
                type: partial?.type ?? get().palette.type,
                pos: (partial?.pos ?? get().hovered ?? [0, 0, 0]) as [
                  number,
                  number,
                  number,
                ],
                size: (partial?.size ?? get().palette.size) as [
                  number,
                  number,
                  number,
                ],
                color: partial?.color ?? get().palette.color,
                rotY: partial?.rotY ?? get().rotY,
                groupId: partial?.groupId ?? null,
                name: partial?.name ?? undefined,
              },
            ],
          }),

        removeAt: (pos) =>
          set(() => {
            const blocks = get().blocks.filter(
              (b) =>
                !(
                  b.pos[0] === pos[0] &&
                  b.pos[1] === pos[1] &&
                  b.pos[2] === pos[2]
                ),
            )
            return { blocks, groups: cleanupGroups(blocks, get().groups) }
          }),

        removeById: (id) =>
          set(() => {
            const blocks = get().blocks.filter((b) => b.id !== id)
            const selectedIds = get().selectedIds.filter((i) => i !== id)
            return {
              blocks,
              selectedIds,
              groups: cleanupGroups(blocks, get().groups),
            }
          }),

        duplicateById: (id) =>
          set(() => {
            const blocks = get().blocks
            const src = blocks.find((b) => b.id === id)
            if (!src) return {}
            const offset: [number, number, number] = [
              src.pos[0] + 1,
              src.pos[1],
              src.pos[2],
            ]
            const copy: Block = {
              ...src,
              id: rid(),
              pos: offset,
              name: src.name ? `${src.name} (copy)` : src.name,
            }
            return { blocks: [...blocks, copy] }
          }),

        clear: () => set({ blocks: [], groups: [], selectedIds: [] }),

        resetWorld: () =>
          set({
            mode: 'edit',
            blocks: [],
            groups: [],
            selectedIds: [],
            palette: DEFAULT_PALETTE,
            hovered: null,
            rotY: 0,
          }),

        importJSON: (json) => {
          try {
            const data = JSON.parse(json)
            if (Array.isArray(data))
              set({
                blocks: data,
                groups: cleanupGroups(data, get().groups),
              })
            else if (data && Array.isArray(data.blocks)) {
              set({
                blocks: data.blocks,
                groups: cleanupGroups(data.blocks, data.groups || []),
              })
            }
          } catch {}
        },

        exportJSON: () =>
          JSON.stringify(
            { blocks: get().blocks, groups: get().groups },
            null,
            2,
          ),

        selectOnly: (id) => set({ selectedIds: [id] }),

        toggleSelect: (id) => {
          const setSel = new Set(get().selectedIds)
          setSel.has(id) ? setSel.delete(id) : setSel.add(id)
          set({ selectedIds: Array.from(setSel) })
        },

        clearSelection: () => set({ selectedIds: [] }),

        groupSelection: (name) => {
          const ids = get().selectedIds
          if (!ids.length) return
          const groups = get().groups
          const groupId = rid()
          const groupName = uniqueGroupName(
            name || `Group ${groups.length + 1}`,
            groups,
          )
          const nextGroups = [...groups, { id: groupId, name: groupName }]
          const nextBlocks = get().blocks.map((b) =>
            ids.includes(b.id) ? { ...b, groupId } : b,
          )
          set({ groups: nextGroups, blocks: nextBlocks })
        },

        ungroupSelection: () => {
          const ids = get().selectedIds
          const nextBlocks = get().blocks.map((b) =>
            ids.includes(b.id) ? { ...b, groupId: null } : b,
          )
          set({
            blocks: nextBlocks,
            groups: cleanupGroups(nextBlocks, get().groups),
          })
        },

        clearGroups: () =>
          set(() => {
            const blocks = get().blocks.map((b) => ({ ...b, groupId: null }))
            return { blocks, groups: [] }
          }),

        renameGroup: (id, name) =>
          set({
            groups: get().groups.map((g) =>
              g.id === id ? { ...g, name } : g,
            ),
          }),

        duplicateSelection: () =>
          set(() => {
            const { blocks, selectedIds } = get()
            if (!selectedIds.length) return {}
            const extras: Block[] = []
            for (const id of selectedIds) {
              const src = blocks.find((b) => b.id === id)
              if (!src) continue
              const offset: [number, number, number] = [
                src.pos[0] + 1,
                src.pos[1],
                src.pos[2],
              ]
              extras.push({
                ...src,
                id: rid(),
                pos: offset,
                name: src.name ? `${src.name} (copy)` : src.name,
              })
            }
            if (!extras.length) return {}
            return { blocks: [...blocks, ...extras] }
          }),

        focusSelection: () => {
          const ids = get().selectedIds
          if (!ids.length) return null
          const blocks = get().blocks.filter((b) => ids.includes(b.id))
          if (!blocks.length) return null
          const cx = blocks.reduce((a, b) => a + b.pos[0], 0) / blocks.length
          const cy = blocks.reduce((a, b) => a + b.pos[1], 0) / blocks.length
          const cz = blocks.reduce((a, b) => a + b.pos[2], 0) / blocks.length
          return [cx, cy, cz]
        },
      }
    },
    { name: 'dawn-world' },
  ),
)
