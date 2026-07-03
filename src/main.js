// Composition root — the app entry Vite loads from index.html.
//
// For now it simply boots the transitional monolith. As responsibilities are
// extracted into real modules (src/systems, src/persistence, src/render, …),
// their wiring moves here: this is where concrete effects (RNG, clock, fetch,
// DOM) get injected into the game logic. Keep imports ordered so anything the
// monolith reads at load (e.g. CSS tokens for the PALETTE snapshot) is ready
// first.
import './legacy/game.js';
