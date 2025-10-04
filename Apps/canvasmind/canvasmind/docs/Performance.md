# Performance Guidelines

- **Instancing**: Use for >100 repeated meshes
- **LODs**: Generate 3 levels for heavy models
- **Texture Atlasing**: Merge small textures into shared sheets
- **Streaming**: Lazy-load offscreen assets
- **Budgets**:
  - Max triangles per scene: 1M
  - Max texture memory: 128 MB
