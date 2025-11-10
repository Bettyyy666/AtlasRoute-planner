import { GraphTile } from "./graphSchema.js";
import { graphCache } from "../globalVariables.js";

/**
 * Different modes for loading graph data
 */
export type FetchMode = "backbone" | "express" | "detailed";

/**
 * Controller for managing graph fetch modes with debouncing and hysteresis
 */
export class ModeController {
  private mode: FetchMode;
  private lastSwitch = 0;
  private holdUntil = 0;
  private consecutiveHits = 0;
  private frozen = false;

  // Tuning parameters
  private readonly minDwellMs = 8000;      // Minimum residence time
  private readonly cooldownMs = 12000;      // Downgrade cooldown
  private readonly needConsecutive = 6;     // Required consecutive hits

  constructor(initial: FetchMode) {
    this.mode = initial;
    this.lastSwitch = Date.now();
  }

  get current(): FetchMode {
    return this.mode;
  }

  /**
   * Freeze mode switching during warmup
   */
  freeze(durationMs = 2000) {
    this.frozen = true;
    this.holdUntil = Math.max(this.holdUntil, Date.now() + durationMs);
    setTimeout(() => { this.frozen = false; }, durationMs);
  }

  /**
   * Check if a tile has highway features
   */
  private isHighwayTile(tileKey: string): boolean {
    const tile = graphCache[tileKey];
    if (!tile) return false;
    
    return Boolean(
      tile.metadata?.containsMotorway || 
      tile.metadata?.containsInterstate ||
      tile.metadata?.containsHighway ||
      (tile.metadata?.fetchMode !== undefined &&
       tile.metadata?.containsHighway === true &&
       (tile.metadata?.fetchMode === "backbone" || tile.metadata?.fetchMode === "express"))
    );
  }

  /**
   * Evaluate mode switching with debouncing and hysteresis
   */
  maybeSwitch(params: {
    distToGoal: number,              // meters
    stalls: number,
    progressPct: number,             // 0..100
    tilesLoaded: number,
    openSetSize: number,
    gatewayStart: boolean,
    gatewayGoal: boolean,
    stuckNearStart: boolean,
    edgePrefetchAttempts: number,
  }) {
    if (this.frozen) return;

    const now = Date.now();
    const dwellOk = (now - this.lastSwitch) >= this.minDwellMs;
    const coolOk = (now >= this.holdUntil);

    // Density gate
    const minTilesForDetailed = Math.max(14, Math.floor(params.distToGoal / 60000));
    const dist = params.distToGoal;
    let densityOk = params.edgePrefetchAttempts >= 12 || params.openSetSize >= 30000;

    if (dist <= 200_000) {
      densityOk = params.edgePrefetchAttempts >= 4 || params.openSetSize >= 8000;
    }
    if (dist <= 80_000) {
      densityOk = true;
    }

    // Mode selection logic - adjusted for longer routes
    const wantBackbone =
      params.distToGoal > 200_000 && params.progressPct < 60 && !params.stuckNearStart;

    const wantExpress =
      params.distToGoal <= 200_000 && params.distToGoal > 80_000 &&
      (!params.stuckNearStart) &&
      (params.gatewayStart || params.progressPct >= 10);

    const wantDetailed =
      (((params.distToGoal <= 80_000 && params.progressPct >= 55) ||
        (params.stalls >= 4 && params.distToGoal <= 120_000)) &&
       (params.gatewayStart || params.tilesLoaded >= minTilesForDetailed) &&
       densityOk) ||
      params.stuckNearStart;

    // Once in detailed, rarely downgrade
    if (this.mode === "detailed") {
      const canDowngrade =
        coolOk &&
        params.openSetSize > 220_000 &&
        params.distToGoal > 220_000 &&
        params.progressPct < 50;

      if (canDowngrade && dwellOk) {
        this.switchTo("express");
        this.holdUntil = now + this.cooldownMs;
      }
      return;
    }

    // Mode transitions
    if (this.mode === "backbone" && wantExpress) {
      this.bumpAndMaybe(() => this.switchTo("express"), dwellOk);
      return;
    }

    if (wantDetailed) {
      this.bumpAndMaybe(() => this.switchTo("detailed"), dwellOk);
      return;
    }

    // Reset counter if conditions unstable
    this.consecutiveHits = 0;
  }

  private bumpAndMaybe(doSwitch: () => void, dwellOk: boolean) {
    this.consecutiveHits++;
    if (this.consecutiveHits >= this.needConsecutive && dwellOk) {
      doSwitch();
      this.consecutiveHits = 0;
    }
  }

  private switchTo(mode: FetchMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.lastSwitch = Date.now();
  }
}