# WorldField Plugin

Implements a 2D wave equation simulation on a GPU render target.

- **InteracteeFields** inject impulses
- **SetMax** merges current field with interactee contributions
- **Propagate** computes Laplacian + damping
- **Use Cases**: water ripples, energy fields, terrain morphs
