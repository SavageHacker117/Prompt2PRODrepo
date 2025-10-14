# SuperDig — Unified Requirements Checklist (Assets, Objects, UI, Audio)

**This checklist aligns with the unified repo tree and phased rollout.** All assets live in `src/assets/**`.

## A. Common/Global
- **Sky:** `sky/space_equirect.hdr` or `sky/cube_*.hdr/png`  
- **UI:** HUD bars (health/fuel), depth_gauge, credit icon, cargo slots; market & contract art per tree.  
- **Audio:** music loops (surface/underground), sfx (drill, tile_break, pickup, impact_heavy, buy/sell/contract_complete).

## B. Player (SuperDigger)
- `models/vehicles/superdigger.glb` (+ textures). Sockets `s_drill`, `s_headlamp`. Anim clips per plan.  
- **Health bar follows chassis**; gravity and **fall damage** events wired to UI shake & sfx.

## C. Surface Hub (Level 0)
- `models/surface/landing_pad.glb`, `fuel_depot.glb`, `market_kiosk.glb`, `contract_board.glb`, `terrain_rim.glb`.  
- Decals/VFX sprites (dust, shimmer).

## D. Levels 1–3 Content
- **Tilesets:** `models/tiles/{biome}_tiles.glb` with broken variants; textures `textures/tiles/{biome}_*.ktx2`.  
- **Hazards:** gas_vent (L1), ice_spike (L2), heat_zone (L3).  
- **Pickups:** battery, treads_upgrade, drill_tier2.  
- **Items (sellables):** basalt_ore, copper_shard, crystal_splinter (L1); ice_crystal, rare_quartz (L2); iron_nodule, metal_shale_piece, **oil_canister** (L3).  
- **Caves/Reservoirs:** `caves/basalt_cavern.glb`, `ice_cavern.glb`, `deep_cavern.glb` + `materials/fluids/oil.json`.

## E. Data Files (author once, extend per phase)
- `data/levels.json` (0–3), `tiles.json` (per biome), `drops.json`, `market_prices.json`, `upgrades.json`, `contracts.json`.

## F. UI Screens
- **HUD.tsx** (health/fuel/depth/credits/cargo).  
- **MarketScreen.tsx** (sell/buy/upgrades).  
- **ContractBoard.tsx** (accept/turn‑in, progress/rewards).

## G. Rollout Phases (what art/code to finish in each)
- **Phase A:** Hub set (landing_pad, fuel_depot, kiosk, board), Basalt tileset, SuperDigger, minimal UI & SFX, `levels.json` (0–1), `market_prices.json` v1, `upgrades.json` v1 (low tiers), `contracts.json` (L1).  
- **Phase B:** Ice/Crystal tileset + hazards + items, price & upgrade extensions; MarketScreen buy + upgrades UI.  
- **Phase C:** Metal Shale/Oil tileset, heat hazards, deep cavern, **oil_canister**, contracts L3; polish LODs & KTX2.  
- **Phase D:** Final audio mix, UI art pass, decals, performance tuning, QA.

## H. Acceptance
- All GLBs pass viewer; textures ≤ 4K; build ≥ 60 FPS @1080p.  
- Economy loop functional: mine → sell → upgrade → complete contract.