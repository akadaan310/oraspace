# ORA Space Android Motion Repair v0.5

**Observed device problem:** Photo is rich but water appears static; swiping moves a small constellation element and Chrome toolbar can feel scrollable.

**Verified cause:** The mobile sea/central ORB were baked in `mobile-world.webp`, while the previous WebGL shader only added faint alpha highlights. The Canvas fallback did not displace the baked water image. Mobile main ORB is intentionally a tiny overlay because the baked plate already contains the complete sphere.

**Repair:**
- On phones, reuse exact same image as a time-varying 24fps *slice-refraction* source between horizon and foreground; preserved original art is always visible behind it. This is an approximate optical effect, not computational fluid dynamics.
- Clock-driven specular horizontal glints and animated event-triggered concentric ripples.
- Desktop WebGL2 shader gets stronger but bounded water highlights; fallback Canvas draws animated light.
- Browser document fixed to 100svh/100dvh with `overscroll-behavior:none`; horizontal touch manipulation is retained.
- Motion diagnostics available locally in `window.GLASS_SPACE.status()` (`frames`, `renderer`, `waterSourceLoaded`, `reduceMotion`), no boxes added to the UI.
- Accessibility `prefers-reduced-motion` still suppresses ambient animation.

**Measured local browser test** (Chromium headless with resources inlined due test browser URL network restriction): mobile 412×915, no script errors, no scroll, source loaded, 160 animation frames advanced in 2.2 seconds and mean water-region RGB delta ≈ 14.0 out of 255. This confirms pixel changes, not performance on the user's specific Samsung phone.

**Limitations:** Same baked skyline/foreground reference and optical style, not a truly fluid dynamic water simulation; actual Android GPU and thermal testing still needed. Playback is zero cloud-GPU-cost. Backend API behavior is unchanged.
