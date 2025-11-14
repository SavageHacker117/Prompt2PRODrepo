import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

type WorldItemKind = 'block' | 'actor' | 'spawn' | 'other';

type WorldItem = {
  id: string;
  name: string;
  kind: WorldItemKind;
  obj: THREE.Object3D;
};

function getEngine(): any {
  return (window as any).__engine || {};
}

function collectWorldItems(): WorldItem[] {
  const eng = getEngine();
  const scene: THREE.Scene | undefined =
    (window as any).__scene || eng.scene;
  if (!scene) return [];

  const items: WorldItem[] = [];
  const seen = new Set<string>();

  const push = (
    obj: THREE.Object3D,
    kind: WorldItemKind,
    name?: string
  ) => {
    if (!obj || seen.has(obj.uuid)) return;
    seen.add(obj.uuid);

    const label =
      name ||
      obj.name ||
      obj.userData?.name ||
      obj.userData?.id ||
      `${kind}_${items.length + 1}`;

    items.push({ id: obj.uuid, name: label, kind, obj });
  };

  // Spawns: hook into SpawnSystem markers
  if (eng.spawns?.list) {
    for (const sp of eng.spawns.list()) {
      if (sp.marker) {
        push(sp.marker, 'spawn', sp.name || sp.id);
      }
    }
  }

  scene.traverse(obj => {
    // Skip the spawn markers we already added
    if (obj.userData?.isSpawn) return;

    if (obj.userData?.isActorRoot) {
      push(obj, 'actor');
      return;
    }

    if (obj.userData?.isBlock || /^block_/.test(obj.name || '')) {
      push(obj, 'block');
      return;
    }
  });

  items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.name.localeCompare(b.name);
  });

  return items;
}

function focusObject(obj?: THREE.Object3D) {
  if (!obj) return;
  const eng = getEngine();
  if (eng.focusObject) {
    eng.focusObject(obj);
    return;
  }
  const cam: THREE.Camera | undefined =
    eng.camera || (window as any).__camera;
  if (!cam) return;
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) || 1;
  const dir = new THREE.Vector3(0, 0.5, 1).normalize();
  cam.position.copy(center.clone().add(dir.multiplyScalar(radius * 2.5)));
  (cam as any).lookAt?.(center);
}

function duplicateObject(obj?: THREE.Object3D) {
  if (!obj) return;
  const eng = getEngine();
  if (eng.duplicateObject) {
    eng.duplicateObject(obj);
    return;
  }
  // Simple fallback: clone and add to scene
  const scene: THREE.Scene | undefined =
    (window as any).__scene || eng.scene;
  if (!scene) return;
  const clone = obj.clone(true);
  clone.position.add(new THREE.Vector3(0.5, 0, 0.5));
  scene.add(clone);
}

function deleteObject(obj?: THREE.Object3D) {
  if (!obj) return;
  const eng = getEngine();
  if (eng.deleteObject) {
    eng.deleteObject(obj);
    return;
  }
  obj.parent?.remove(obj);
}

export default function WorldPanel() {
  const [items, setItems] = useState<WorldItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  const selected = useMemo(
    () => items.find(i => i.id === selectedId),
    [items, selectedId]
  );

  useEffect(() => {
    const update = () => {
      const list = collectWorldItems();
      setItems(list);
      if (list.length && !list.find(i => i.id === selectedId)) {
        setSelectedId(list[0].id);
      }
    };
    update();
    const t = window.setInterval(update, 750);
    return () => window.clearInterval(t);
  }, [selectedId]);

  return (
    <div className="panel">
      {/* Preview header */}
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="label" style={{ flex: 1 }}>
          {selected
            ? `${selected.kind.toUpperCase()}: ${selected.name}`
            : '(no selection)'}
        </div>
        <button
          className="btn"
          onClick={() => focusObject(selected?.obj)}
          title="Focus camera"
        >
          ⌂
        </button>
        <button
          className="btn"
          onClick={() => duplicateObject(selected?.obj)}
          title="Duplicate"
        >
          ⧉
        </button>
        <button
          className="btn danger"
          onClick={() => deleteObject(selected?.obj)}
          title="Delete"
        >
          ✕
        </button>
      </div>

      {/* List */}
      <div style={{ maxHeight: 260, overflow: 'auto', display: 'grid', gap: 4 }}>
        {items.map(it => (
          <div
            key={it.id}
            className="row"
            style={{
              padding: 3,
              borderRadius: 6,
              background:
                it.id === selectedId ? 'rgba(255,255,255,0.04)' : 'transparent',
              cursor: 'pointer',
            }}
            onClick={() => setSelectedId(it.id)}
          >
            <div style={{ width: 18 }}>
              {it.kind === 'actor' && '🧍'}
              {it.kind === 'block' && '⬛'}
              {it.kind === 'spawn' && '◎'}
              {it.kind === 'other' && '•'}
            </div>
            <div
              className="label"
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {it.name}
            </div>
          </div>
        ))}
        {!items.length && (
          <div className="label" style={{ opacity: 0.7 }}>
            (no objects in world)
          </div>
        )}
      </div>
    </div>
  );
}
