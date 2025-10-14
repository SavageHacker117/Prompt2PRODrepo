# SuperDig — Unified Asset & Data Plan (Browser‑Only, Vite + React + Three.js)

**Goal:** Single cohesive plan for assets, data, and budgets aligned to one repo tree and a phased rollout.  
**All content ships inside the app at `src/assets/**` (no network required beyond static hosting).**

## 1. Repository & Paths (Single Source of Truth)
```
superdig/
├─ index.html
├─ vite.config.ts
├─ package.json
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ assets/                            # All shipped content (models, textures, audio, ui, data)
   │  ├─ models/
   │  │  ├─ vehicles/                    # superdigger.glb
   │  │  ├─ tiles/                       # <biome>_tiles.glb (with broken variants)
   │  │  ├─ surface/                     # landing_pad.glb, fuel_depot.glb, market_kiosk.glb, contract_board.glb
   │  │  ├─ caves/                       # basalt_cavern.glb, ice_cavern.glb, deep_cavern.glb
   │  │  ├─ hazards/                     # gas_vent.glb, ice_spike.glb, heat_zone.glb
   │  │  ├─ pickups/                     # battery.glb, treads_upgrade.glb, drill_tier2.glb
   │  │  └─ items/                       # basalt_ore.glb, copper_shard.glb, crystal_splinter.glb, oil_canister.glb
   │  ├─ textures/
   │  │  ├─ vehicles/
   │  │  ├─ tiles/
   │  │  ├─ surface/
   │  │  ├─ items/
   │  │  └─ vfx/                         # dust_sprite.png, heat_shimmer.png, chip_*.png
   │  ├─ ui/
   │  │  ├─ hud/                         # health_bar_*.png, fuel_bar_*.png, depth_gauge.png
   │  │  ├─ icons/                       # icon_credit.png, icon_drill_t*.png, etc.
   │  │  ├─ market/                      # slot_bg.png, btn_buy.png, btn_sell.png, price_tag.png
   │  │  └─ contracts/                   # poster_lvl*.png, progress_bar.png, reward_badge.png
   │  ├─ audio/
   │  │  ├─ music/                       # surface_loop.opus, underground_loop.opus
   │  │  └─ sfx/                         # drill_loop.wav, tile_break_*.wav, buy_confirm.wav, contract_complete.wav
   │  ├─ sky/                            # space_equirect.hdr or cube_*.hdr/png
   │  └─ data/                           # JSON data driving gameplay/economy
   │     ├─ levels.json                  # level dimensions, biome params, reservoir counts
   │     ├─ tiles.json                   # hp, hardness, drop tables per tile type
   │     ├─ drops.json                   # tile → item weights
   │     ├─ market_prices.json           # item → {{base, rarity, biome_mod, purity_bonus_max}}
   │     ├─ upgrades.json                # upgrade catalog, tiers, costs, stat deltas
   │     └─ contracts.json               # per-level oil quotas, rewards, perk grants
   └─ game/
      ├─ engine/                         # platform/tech modules
      │  ├─ renderer.ts
      │  ├─ scene.ts
      │  ├─ camera.ts
      │  ├─ lighting.ts
      │  ├─ input.ts
      │  ├─ physics.ts                   # gravity, AABB, fall-damage hooks
      │  ├─ terrain.ts                   # chunk grid, instancing, destruction swap
      │  ├─ particles.ts
      │  └─ postfx.ts
      ├─ gameplay/                       # rules/domain
      │  ├─ digger.ts                    # movement, drill, fuel, health, fall-damage
      │  ├─ hazards.ts
      │  ├─ pickups.ts
      │  ├─ inventory.ts                 # cargo slots, stacking
      │  ├─ economy.ts                   # wallet, price calc
      │  ├─ market.ts                    # sell/buy, fees
      │  ├─ upgrades.ts                  # apply upgrade effects
      │  ├─ contracts.ts                 # oil quotas & payouts
      │  └─ save.ts                      # localStorage schema/versioning
      └─ ui/
         ├─ HUD.tsx                      # health (chassis follow), fuel, depth, credits, cargo
         ├─ MarketScreen.tsx
         └─ ContractBoard.tsx
```

## 2. Standards & Budgets
- **Model format:** GLB (glTF 2.0, embedded). **Units:** 1m, Y‑up in Three.js.  
- **Perf targets (1080p):** ≤ 1,200 draw calls, ≤ 1.8M on‑screen tris, ≤ 800MB compressed textures, ≤ 16.6ms/frame.  
- **Textures:** Prefer `.ktx2` (BasisU). UI may use PNG.  
- **LODs:** Up to 3 (`lod0/1/2`) on heavy meshes.  
- **Naming:** `snake_case`; colliders suffix `__col_{box|sphere|mesh}`.

## 3. Level Content (Unified Definition)
- **Level 0 (Surface Hub):** landing_pad, fuel_depot, market_kiosk, contract_board, terrain_rim; skybox in `src/assets/sky`.  
- **Levels 1–3 (Dig Strata):** chunked tile grids per biome: Basalt, Ice/Crystal, Metal Shale/Oil Sand.  
- **Deep Reservoirs:** cavern + oil shader (screen‑space normals & fresnel).

## 4. Player Vehicle — SuperDigger
- `models/vehicles/superdigger.glb` (LOD0 around 25–40k tris). Bones or separated parts for wheels/drill.  
- Sockets: `s_drill`, `s_headlamp`, `s_trailer`. Clips: `idle`, `drill`, `boost`, `turn_left/right`, `damaged`.  
- **UI follow:** chassis health bar; **physics:** gravity + fall‑damage threshold tied to `physics.ts`.

## 5. Props, Hazards, Pickups, Items
- **Props:** fuel/repair station, elevator/winch.  
- **Hazards:** gas_vent, ice_spike, heat_zone volumes.  
- **Pickups:** battery (fuel), treads_upgrade (traction), drill_tier2 (damage).  
- **Items (sellables):** basalt_ore, copper_shard, crystal_splinter, ice_crystal, rare_quartz, iron_nodule, metal_shale_piece, **oil_canister**.

## 6. Particles, Post, Audio
- **Particles:** dust/debris/sparks as sprites or points.  
- **PostFX:** mild bloom, vignette, LUT (toggle). Screen shake on drill & impacts.  
- **Audio:** opus music, wav sfx. Buses: `master > music|sfx|ui|ambience`.

## 7. Economy, Upgrades, Market, Contracts (Data‑Driven)
- **Currency:** Credits (CR).  
- **Market:** Sell items for CR; fee 5% unless perk.  
- **Upgrades:** drill, fuel tank, engine, treads/suspension (reduces fall‑damage), chassis armor, headlamp, cargo trailer, market perks.  
- **Contracts (per level):** deliver N `oil_canister` for lump CR + a permanent perk (e.g., +5% sell price).  
- **Data files (`src/assets/data/`):**  
  - `market_prices.json` — item pricing (base, rarity, biome_mod, purity_bonus_max).  
  - `upgrades.json` — tiers, cost, stat deltas, prerequisites.  
  - `contracts.json` — per‑level quotas & rewards.  
  - `levels.json`, `tiles.json`, `drops.json` — world + drop tables.

## 8. Validation & Acceptance
- glTF validator clean; texture sizes within budgets; UI readable at 1080p/1440p.  
- In‑game overlay: FPS≥60 target, draw calls, VRAM estimate.  

## 9. Phased Rollout (Assets/Data)
- **Phase A (Hub + L1):** Surface hub set, Basalt tileset, SuperDigger, core SFX/music, market_prices v1, upgrades v1 (low tiers), contracts v1 (L1).  
- **Phase B (L2 Ice/Crystal):** add tileset, hazards, items; pricing extension.  
- **Phase C (L3 Metal Shale/Oil):** add tileset, heat hazards, oil_canister + deep cavern, contracts L3.  
- **Phase D (Polish):** LOD passes, KTX2 conversion, UI art pass, audio mixing, balance sweep.