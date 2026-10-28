# ORA Space — First interactive consumer-facing launcher

**Website source belongs in the owner's separate `ORASPACE` repository.** This static `web/index.html` connects to the ORA Engine (`ORA` repository) through same-origin `/api/v1/*` routes. It is an *initial functional launcher*, **not** the final screenshot-matched design. Replace its procedural ocean/sky composition with the chosen approved ORA Space art direction after technical validation without changing the API contracts.

Functions already wired: center-field English request → propose ORA; choose phone/cloud/HOMELESS *intent*; inspect live instance states; review and activate; submit an implemented mission; poll events and result receipts; select ORA orb to route a mission through the center; copy public manifest URL. `My Phone` and `My World` don't deploy workers yet.

This page is served by the engine with `--web ../ORASPACE/web` or automatically by `ORA/scripts/run_local.sh` when the repos are siblings. The website has no public sign-up logic, no multi-user accounts, and no promise that a model or external integration is operating. Configure authentication/TLS and actual job workers before public release. Its reactivity is intentionally small-scale Canvas 2D, not a full game engine.
