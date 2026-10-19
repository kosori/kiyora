# Geometry is clean; the typeface is hand-drawn

The hand-drawn overlay is retired. Figures, frames, stickies and connectors paint their authored geometry once, and the hand-drawn character of the board comes from the typeface.

ADR-0006 chose the overlay because an export with clean rectangles would be a different drawing than the one on screen. That reasoning assumed the overlay *was* the hand-drawn look. A side-by-side of one board rendered with and without it showed the opposite: the ribbon doubled every edge, a crisp line under a translucent band whose contour wandered independently. The clean drawing read better, and the typeface already carries the character. An export is still the drawing the user saw, now because both backends draw clean geometry from the same walker.

## Consequences

- The paint description carries no overlay channel and no fill-opacity channel, and the projection emits neither.
- `perfect-freehand` leaves the model's manifest, the lockfile and the notices.
- Reduced motion no longer hides a ribbon; only the chrome's transitions remain to suppress.
- The wobble seed is gone with the overlay. Nothing replaces it, because nothing is displaced any more.
