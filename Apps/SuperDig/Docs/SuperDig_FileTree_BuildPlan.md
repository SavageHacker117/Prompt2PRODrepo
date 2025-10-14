# SuperDig — Unified File Tree, Modules & Rollout Plan (Browser‑Only)

**Single source of truth:** one repo tree and phased execution steps for devs to ship cleanly.  
**Stack:** Vite + React + Three.js, TypeScript, WebAudio. No backend required.

## 1. Unified Repo Tree
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

## 2. Core Modules (What to Implement)
- **engine/**: renderer, scene, camera, lighting, input, physics (gravity+AABB, fall damage), terrain (chunks+instancing), particles, postfx.  
- **gameplay/**: digger (controls, drill, fuel, health), hazards, pickups, inventory (cargo slots), economy (wallet, price calc), market (sell/buy), upgrades (apply deltas), contracts (oil quotas), save (localStorage schema/version).  
- **ui/**: HUD (health/fuel/depth/credits/cargo), MarketScreen, ContractBoard.

## 3. Data Contracts (JSON Schemas – in `src/assets/data/`)
- **levels.json**: `{ levelId, biome, chunkSize, depthTargets, reservoirCount }`  
- **tiles.json**: `{ tileId, biome, hp, hardness, dropTableId }`  
- **drops.json**: `{ dropTableId, entries:[{itemId, weight, min, max}] }`  
- **market_prices.json**: `{ itemId, base, rarity, biomeMod, purityMaxPct }`  
- **upgrades.json**: `{ upgradeId, tier, costCR, prereq, effects:{stat:delta} }`  
- **contracts.json**: `{ levelId, oilQuota, rewardCR, perk:{type,value} }`

## 4. Game Loop & Physics
- Fixed update @ 60 Hz; render on rAF with interpolation.  
- Gravity constant, traction/friction; **fall damage** triggers when vertical velocity on ground contact > threshold. Threshold reducible by suspension/treads upgrade.

## 5. Save/Load
- `localStorage` with versioned key: `superdig.save.v1`.  
- Persist: wallet, upgrades, inventory, contract progress, options.

## 6. Build/Run
- `npm run dev` / `build` / `preview`.  
- `npm run validate:assets` optional (glTF + image checks).  
- Host `dist/` on flsgames.com with proper MIME for `.ktx2, .glb, .hdr, .opus`.

## 7. Rollout Plan (Do This In Order)
1. **Bootstrap (A):** renderer, camera, lighting, input scaffolding; HUD shell.  
2. **Terrain + Physics (A):** chunk grid, destruction swap, gravity+AABB, fall damage.  
3. **SuperDigger (A):** movement, drill, fuel, chassis health UI; Surface Hub scene.  
4. **Economy Loop (A):** inventory, market_prices.json v1, MarketScreen (sell only), wallet HUD.  
5. **Upgrades (B):** upgrades.json v1, apply effects (drill, fuel, treads, armor).  
6. **Contracts (C):** contracts.json v1, ContractBoard UI, oil canister delivery.  
7. **Levels 2 & 3 (B/C):** add biomes, hazards, items, pricing/contract extensions.  
8. **Polish (D):** LODs, KTX2, audio mix, UI art pass, perf tuning.

## 8. Acceptance & QA Gates
- Playthrough from new save to L1 contract completion without errors.  
- 60 FPS target on mid laptop (1080p), stable memory, clean console.  
- Economy balance: time‑to‑first‑upgrade ≤ 5 minutes; contract reward meaningful but not OP.