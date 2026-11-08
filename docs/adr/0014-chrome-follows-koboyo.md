# Chrome follows Koboyo; board geometry stays authored

Kiyora's editor chrome is deliberately measured once against real Koboyo (koboyo.com) so the two read as the same product: full-bleed canvas, floating 12px chrome cards, 32px buttons at 8px radius, a 24px dot grid, `#4da1ff` selection furniture with four corner handles and a bottom-right rotate handle, a floating selection toolbar, and an empty-canvas onboarding. Those values are recorded here and in `apps/web/app/globals.css`, not re-measured on every change.

This narrows invariant 3. **No borrowed measurements** still governs the board: shape geometry, paint, layout, default shape positions and text metrics come from the document model and the injected measurer, never from another product's DOM. Chrome is not board data. It is display-only by invariant 6, it reaches no artifact, and it never enters a board file.

The clone at `~/Developer/koboyo-clone` is an older snapshot of the same product. It is a useful second opinion, not the source of truth; real Koboyo wins conflicts.

## Consequences

- Changing a chrome size, radius, colour or position is a design-token change in `apps/web`; it is not a measurement task and it needs no board migration.
- The selection overlay and the floating toolbar stay display-only; no selection furniture may reach an export.
- A future invariant that forbids derived values still forbids them for authored board data. If a chrome value is copied again, record what was copied and why.
- Tests assert the painted result: a rounded rectangle's path, the four handles, the visible toolbar and the hidden inspector. An element count is still not proof.
