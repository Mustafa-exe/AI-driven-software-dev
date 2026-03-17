# Development Roadmap

## Target Delivery Model
- Solo developer prototype timeline: 4 weeks
- Recommended commitment: 30-45 hours per week
- Development style: one vertical slice per week with aggressive scope control

## Solo Project Scope Adjustment
- Keep the first release focused on one tactical mode only
- Target 4-6 players for initial playable tests
- Use simple 2D placeholders and no advanced shader work
- Keep one small map, 2-3 weapon types, and a minimal buy system
- Use a basic lobby flow instead of full production-grade matchmaking
- Treat advanced anti-cheat, hero abilities, ranked play, reconnect logic, and multiple maps as post-MVP work

## Complexity Scale
- Low: straightforward implementation with limited system dependencies
- Medium: moderate game/system logic with manageable integration risk
- High: multi-system coordination or heavy debugging likely
- Very High: networking, synchronization, scaling, or security-heavy work

## Phase 1 - Core Engine and Local Tactical Combat (Week 1)
Complexity: Medium
Goal: Build a playable local tactical shooter sandbox.

Tasks:
- Implement fixed timestep game loop
- Build input handling (keyboard/mouse)
- Implement simple camera and map boundaries
- Add entity model for players, bullets, cover objects, and objective zone
- Add movement, shooting, health, and elimination

Deliverable:
- Single-player tactical combat prototype with one small map

## Phase 2 - Multiplayer Core (Week 2)
Complexity: High
Goal: Make the prototype playable online.

Tasks:
- Build Node.js WebSocket server
- Implement server-authoritative movement and shooting
- Add collision detection and hit validation on server
- Synchronize player state with basic interpolation on client

Deliverable:
- 2-4 player online matches with stable movement and combat

## Phase 3 - Tactical Round Loop and Basic Infrastructure (Week 3)
Complexity: Medium
Goal: Add the minimum systems that make it a tactical shooter.

Tasks:
- Implement buy phase and round credit rewards
- Add spike plant, defuse, and round timer logic
- Add team score, match win conditions, and round reset flow
- Add simple account storage or guest profile plus match result saving

Deliverable:
- Full end-to-end tactical shooter prototype with persistence of basic stats

## Phase 4 - Stabilization and Release Prep (Week 4)
Complexity: Very High
Goal: Make the prototype stable enough to show or test.

Tasks:
- Fix sync defects and gameplay bugs
- Add simple HUD for health, ammo, credits, and objective state
- Add leaderboard or match history screen
- Test with 4-6 players and optimize obvious bottlenecks

Deliverable:
- Demo-ready browser tactical shooter prototype

## Solo Priority Split
- P0 Must ship: movement, shooting, health, round flow, basic buy phase, plant/defuse objective, minimal stat saving
- P1 Should ship: simple lobby, leaderboard, team assignment, interpolation polish
- P2 Delay if needed: account system, reconnect handling, anti-cheat heuristics, abilities, visual polish

## Realistic Risk Areas for a Solo Developer
- Networking and reconciliation will consume more time than expected
- Full authentication plus matchmaking is too large for 4 weeks unless heavily simplified
- Performance optimization should be limited to clear bottlenecks only
- The 4-week version should be treated as a prototype, not a production-ready launch

## Milestone Gates
- Gate A: Local gameplay works (end of Week 1)
- Gate B: Multiplayer works in small tests (end of Week 2)
- Gate C: Tactical round loop is complete (end of Week 3)
- Gate D: Prototype is stable enough to demo (end of Week 4)
