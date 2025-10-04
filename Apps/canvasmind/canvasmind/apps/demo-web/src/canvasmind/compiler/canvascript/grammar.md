# CanvasScript Grammar (MVP)

**Goal:** tiny DSL → JSON Actions for scene authoring.

file := stmt*
stmt := scene_block | spawn_stmt | sky_stmt | water_stmt | light_stmt

scene_block := "scene" "{" stmt* "}"
spawn_stmt := "spawn" ident (kvpair)* ( "count" "=" int )?
sky_stmt := "sky" string # label/preset
water_stmt := "water" "waves" "intensity" "=" num
light_stmt := "lighting" "sun" "angle" "=" num

kvpair := ident "=" (num | range | string)
range := num ".." num

ident := [a-zA-Z_][a-zA-Z0-9_-]*
num := [0-9]+("."[0-9]+)?
int := [0-9]+
string := " .*? "
comment := "//" until EOL
ws := spaces, tabs, newlines

shell
Copy code

### Examples

scene {
biome "coast"
sky "stormy"
spawn boulder scale=0.7..1.2 count=8
water waves intensity=0.6
lighting sun angle=15
}

markdown
Copy code

### Output (JSON Actions)

- `skybox.generate { prompt: <sky string> }`
- `spawn { kind:<ident>, count, props:{...} }`
- `worldfield.setParams { ... }` (optional)
- `lighting.set { sunAngle: <num> }`