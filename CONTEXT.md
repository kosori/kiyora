# Domain Context

## Glossary

### Mindmap Diagram
A specific diagram family that represents a hierarchical tree of ideas.
It parses indentation and list markers (`-` or `*`) to determine parent-child relationships.

### Central Node
The root of the mindmap tree. In the AST, this is just a `MindMapBranch` at the top level.

### Branch
A child node in the mindmap hierarchy. Represented by the `MindMapBranch` type in the AST. Rendered using the standard rounded rectangle shape (with optional `fill` and `color`) and auto-sized to strictly fit its text content.

### Branch Curve
The visual edge connecting a parent branch to a child branch. Rendered as a smooth cubic Bezier curve from the right-center of the parent to the left-center of the child. Unlike graph relations, branch curves do not have arrowheads.

### Horizontal Tree Layout
The layout strategy for mindmaps where the central node is on the left and branches expand to the right. Nodes are positioned vertically using a bottom-up height accumulation algorithm to ensure they are centered relative to their children without overlapping.

### Read-Only Canvas Mode
A state in the canvas where the structural layout is mathematically enforced by the code compile (as with Sequence Diagrams and Mindmaps). Structural mutations like dragging or resizing are disabled to prevent conflicts, while pan, zoom, and selection remain active.

### Attribute Badge
A visual pill overlay rendered on a node (top-right) or edge (midpoint) to display numeric metadata, specifically used for the `value` and `score` attributes.

### Palette Hue Snapping
The algorithm that maps arbitrary external colors (CSS named colors or hex codes) into Kiyora's constrained color palette. It extracts the HSL hue angle and finds the closest matching palette hue, intentionally discarding the original lightness and saturation to preserve the document's color mode and contrast.

### Flow Animation
An active state for structural edges that renders as marching ants. The animation is powered by a locally injected CSS keyframe (`stroke-dashoffset`), ensuring the animation survives SVG export.
