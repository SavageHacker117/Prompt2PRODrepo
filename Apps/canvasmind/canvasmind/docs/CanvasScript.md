# CanvasScript DSL

CanvasScript provides a lightweight scene description language.

## Example

scene {
biome "forest"
sky "cloudy"
spawn tree count=20
}

markdown
Copy code

## Compiler Steps
1. Parse CanvasScript → AST
2. Transform AST → JSON Actions
3. Execute JSON Actions via runtime