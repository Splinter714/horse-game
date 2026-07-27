// Rendering housekeeping — the per-frame bookkeeping that keeps the world drawing
// correctly: Y-based depth sorting (including the dust/stink overlays), keeping each
// equipped saddle glued to its horse, trailing foals after their parent, and the
// live coat re-skin used by the appearance editor. No gameplay logic — just keeping
// sprites positioned/ordered. Extracted from PaddockScene (issue #167).

import Phaser from 'phaser';
import { S, DUST_CLEAN_AT, DUST_MAX_ALPHA, STINK_AT, PLAYER_SPEED } from './constants.js';
import { composeCoat } from '../../data/species/horse/coats.js';
import { buildHorseTextures, buildFoalTextures, horsePosture } from '../../art/horseArt.js';

export const WithRendering = (Base) => class extends Base {
  // Body-language posture (#69): while a horse is standing idle, swap its idle
  // animation to the mood-appropriate variant (pinned ears when neglected, drooped
  // head + floppy ears when content) from the pure horsePosture() selector. Only
  // touches the idle pose — walking / eating / rolling / sleeping are left alone, so
  // posture reads on a settled horse without fighting any active movement anim.
  _applyPosture(h) {
    const anim = h.sprite.anims?.currentAnim?.key;
    if (!anim || !anim.startsWith('idle')) return;      // only re-pose a standing idle
    if (!anim.endsWith(h.key)) return;                   // (defensive) our own idle key
    const horse = this.registry.get('allHorses')?.[h.key];
    if (!horse) return;
    // A still-a-baby foal (#15) wears the smaller foal art, which has NO posture-idle
    // frames — it must keep its plain foal idle in every state (#339). Belt-and-braces
    // next to the art builder's isFoal branch: if an adult posture texture ever exists
    // under a foal's key again, the idle pose still refuses to become an adult one.
    if (horse.isFoal) return;
    const id = horsePosture({ neglected: horse.neglected, happiness: horse.stats?.happiness });
    const want = id ? `idle_${id}_${h.key}` : `idle_${h.key}`;
    if (anim !== want && this.anims.exists(want)) h.sprite.play(want, true);
  }
  // Keep each equipped saddle glued to its horse as it wanders. The ridden
  // horse's saddle is synced inside updateRiding, so skip it here.
  updateSaddles() {
    const ridden = this.riding?.h;
    for (const h of this.horses) {
      if (!h.saddleImg || h === ridden) continue;
      h.saddleImg.x = h.sprite.x;
      h.saddleImg.y = h.sprite.y;
      h.saddleImg.setFlipX(h.sprite.flipX);
      // Depth must track the sprite's *current* y (what depthSort uses), not the
      // stale h.sprite.depth from last frame — otherwise moving south drops the
      // saddle behind the horse for a frame.
      h.saddleImg.setDepth(h.sprite.y + 1);
    }
  }

  // Re-skin a horse live from its current coat + marking data (#2/#17). gen()
  // redraws the frame + portrait textures in place, so the existing sprite and its
  // running animations show the new coat with no rebuild. Used by the appearance
  // editor embedded in the info panel (customizer.js / InfoPanelScene, #147).
  reskinHorse(key) {
    const data = this.registry.get('allHorses')?.[key];
    if (!data) return;
    const coat = composeCoat(data.coat, data.markings);
    // A newborn foal (#15) is a horse-roster member wearing the smaller baby art —
    // rebuild its foal frames; every other horse uses the full horse art.
    const build = data.isFoal ? buildFoalTextures : buildHorseTextures;
    build(this, key, coat); // the side-view frames the world + panel use
  }

  updateFoals(delta) {
    for (const foal of this.foals) {
      const parent = foal.parentH.sprite;
      const dx = parent.x - foal.sprite.x;
      const dy = parent.y - foal.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 80) {
        const speed = PLAYER_SPEED * 1.05 * (delta / 1000);
        const ratio = Math.min(1, speed / dist);
        foal.sprite.x += dx * ratio;
        foal.sprite.y += dy * ratio;
        foal.sprite.setFlipX(dx < 0);
        foal.sprite.play(`walk_${foal.key}`, true);
      } else {
        foal.sprite.play(`idle_${foal.key}`, true);
      }

      foal.shadow.x = foal.sprite.x;
      foal.shadow.y = foal.sprite.y;
      foal.shadow.setDepth(foal.sprite.y - 1);
      foal.sprite.setDepth(foal.sprite.y);
    }
  }

  depthSort() {
    const p = this.player;
    p.shadow.setDepth(p.sprite.y - 1);
    p.sprite.setDepth(p.sprite.y);

    const allHorses = this.registry.get('allHorses');
    for (const h of this.horses) {
      h.shadow.x = h.sprite.x;
      h.shadow.y = h.sprite.y;
      h.shadow.setDepth(h.sprite.y - 1);
      h.sprite.setDepth(h.sprite.y);

      this._applyPosture(h); // body-language idle pose from the horse's mood (#69)

      // Keep the dust overlay glued to the sprite and fade it as a whole with
      // how dirty the horse is (grooming < DUST_CLEAN_AT). Brushing raises
      // grooming → the splotches fade out together and vanish when fully clean.
      if (h.dustOverlay) {
        const groom = allHorses[h.key]?.stats.grooming ?? 100;
        const dirt  = Phaser.Math.Clamp((DUST_CLEAN_AT - groom) / DUST_CLEAN_AT, 0, 1);
        // The dust/stink overlays are the STANDING horse shape, so they'd float
        // awkwardly over the lying-down sleep pose — hide them while asleep at night
        // (#102). During the roll (#70), though, keep the dust cloud + stink lines on
        // the torso (playtest fix): the horse is rolling *because* it's filthy, so the
        // stink should read right through the roll until it kicks back up cleaner.
        const animKey = h.sprite.anims?.currentAnim?.key;
        const lying = animKey === `sleep_${h.key}`;
        // While rolling, the belly-up torso sits ~14 design px lower in the frame than
        // the standing body (the roll pose's `dy` seat), so drop the standing-shape
        // overlays by that much (× S world px) to keep the dust cloud + stink lines
        // planted on the torso rather than floating up where the standing back was.
        const rolling = animKey === `roll_${h.key}`;
        const rollDrop = rolling ? 14 * S : 0;
        // The body art bobs 1 design-pixel (= S world px) on the odd idle/walk
        // frames; mirror that here so the dust splotches and stink lines bounce
        // *with* the horse instead of floating over the breathing body.
        const frameKey = h.sprite.frame?.texture?.key || '';
        const bob = /(_1|_3)$/.test(frameKey) ? S : 0;
        h.dustOverlay.x = h.sprite.x;
        h.dustOverlay.y = h.sprite.y + bob + rollDrop;
        h.dustOverlay.setFlipX(h.sprite.flipX);
        h.dustOverlay.angle = h.sprite.angle; // follow the body (e.g. while rolling)
        h.dustOverlay.setDepth(h.sprite.y);
        h.dustOverlay.setAlpha(dirt * DUST_MAX_ALPHA);
        h.dustOverlay.setVisible(dirt > 0 && !lying);

        // Stink lines only on a really filthy horse, gently wavering above its back.
        if (h.stinkOverlay) {
          const stink = Phaser.Math.Clamp((STINK_AT - groom) / STINK_AT, 0, 1);
          const waver = Math.sin(this.time.now / 220 + h._stinkPhase);
          h.stinkOverlay.x = h.sprite.x;
          h.stinkOverlay.y = h.sprite.y - 66 + waver * 3 + bob + rollDrop;
          h.stinkOverlay.setDepth(h.sprite.y + 1);
          h.stinkOverlay.setAlpha(stink * (0.75 + 0.25 * waver));
          h.stinkOverlay.setVisible(stink > 0 && !lying);
        }
      }
    }

    for (const a of this.animals) {
      a.shadow.x = a.sprite.x;
      a.shadow.y = a.sprite.y;
      a.shadow.setDepth(a.sprite.y - 1);
      a.sprite.setDepth(a.sprite.y);
    }

    for (const npc of this.npcs) {
      npc.shadow.x = npc.sprite.x;
      npc.shadow.y = npc.sprite.y;
      npc.shadow.setDepth(npc.sprite.y - 1);
      npc.sprite.setDepth(npc.sprite.y);
    }
  }
};
