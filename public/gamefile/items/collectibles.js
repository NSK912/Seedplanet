// === SEEDPLANET MODULE: JS/COLLECTIBLES.JS ===

var collectibles = window.collectibles || [];
window.collectibles = collectibles;

function syncTreeAttachedFruits() {
  if (typeof window === "undefined") return;
  const rawNature = (window.natureObstacles && window.natureObstacles.length > 0)
    ? window.natureObstacles.concat(window.allDeterministicNatureObstacles || [])
    : (window.allDeterministicNatureObstacles || []);
  const seenIds = new Set();
  const natureList = [];
  for (let obs of rawNature) {
    if (obs && obs.id && !seenIds.has(obs.id)) {
      seenIds.add(obs.id);
      natureList.push(obs);
    }
  }
  if (!natureList || natureList.length === 0) return;

  const colList = window.collectibles || [];
  const chopped = window.choppedTrees || [];

  for (let obs of natureList) {
    if (obs && obs.isWhiteRedTree && obs.fruitPositions && obs.fruitPositions.length > 0) {
      if (chopped.includes(obs.id)) continue;
      for (let fIdx = 0; fIdx < obs.fruitPositions.length; fIdx++) {
        const fInfo = obs.fruitPositions[fIdx];
        const fruitId = "df_" + obs.id + "_" + fIdx;
        const existing = colList.find(c => c.fruitId === fruitId || (c.treeId === obs.id && c.fruitIdx === fIdx));
        if (!existing) {
          colList.push({
            type: "dragon_fruit",
            position: [fInfo.pos[0], fInfo.pos[1], fInfo.pos[2]],
            normal: fInfo.normal ? [fInfo.normal[0], fInfo.normal[1], fInfo.normal[2]] : [0, -1, 0],
            R: fInfo.R ? [fInfo.R[0], fInfo.R[1], fInfo.R[2]] : [1, 0, 0],
            F: fInfo.F ? [fInfo.F[0], fInfo.F[1], fInfo.F[2]] : [0, 0, 1],
            active: true,
            size: 0.035,
            seed: 1234 + obs.id * 10 + fIdx,
            color: [0.92, 0.14, 0.46],
            isAttachedToTree: true,
            swayWeight: typeof fInfo.swayWeight === "number" ? fInfo.swayWeight : 1.0,
            treeId: obs.id,
            fruitIdx: fIdx,
            fruitId: fruitId,
            isDynamic: false
          });
        } else if (existing.isAttachedToTree) {
          existing.position = [fInfo.pos[0], fInfo.pos[1], fInfo.pos[2]];
          if (fInfo.normal) existing.normal = [fInfo.normal[0], fInfo.normal[1], fInfo.normal[2]];
          if (fInfo.R) existing.R = [fInfo.R[0], fInfo.R[1], fInfo.R[2]];
          if (fInfo.F) existing.F = [fInfo.F[0], fInfo.F[1], fInfo.F[2]];
          existing.swayWeight = typeof fInfo.swayWeight === "number" ? fInfo.swayWeight : 1.0;
        }
      }
    } else if (obs && obs.type === "cotton_plant" && obs.active !== false) {
      const cottonId = "cotton_" + obs.id;
      const existing = colList.find(c => c.cottonId === cottonId);
      if (!existing) {
        colList.push({
          type: "cotton_plant",
          position: [obs.position[0], obs.position[1], obs.position[2]],
          normal: obs.normal ? [obs.normal[0], obs.normal[1], obs.normal[2]] : [0, 1, 0],
          R: obs.R ? [obs.R[0], obs.R[1], obs.R[2]] : [1, 0, 0],
          F: obs.F ? [obs.F[0], obs.F[1], obs.F[2]] : [0, 0, 1],
          active: true,
          size: 0.06,
          seed: typeof obs.seed === "number" ? obs.seed : (obs.id * 17.31),
          color: [0.96, 0.96, 0.94],
          cottonId: cottonId,
          isDynamic: false
        });
      }
    } else if (obs && obs.type === "crown_flower" && obs.active !== false) {
      const crownFlowerId = "crown_flower_" + obs.id;
      const existing = colList.find(c => c.crownFlowerId === crownFlowerId);
      if (!existing) {
        colList.push({
          type: "crown_flower",
          position: [obs.position[0], obs.position[1], obs.position[2]],
          normal: obs.normal ? [obs.normal[0], obs.normal[1], obs.normal[2]] : [0, 1, 0],
          R: obs.R ? [obs.R[0], obs.R[1], obs.R[2]] : [1, 0, 0],
          F: obs.F ? [obs.F[0], obs.F[1], obs.F[2]] : [0, 0, 1],
          active: true,
          size: 0.06,
          seed: typeof obs.seed === "number" ? obs.seed : (obs.id * 19.17),
          color: [0.92, 0.90, 0.96],
          crownFlowerId: crownFlowerId,
          isDynamic: false
        });
      }
    }
  }
  for (let i = 0; i < colList.length; i++) {
    if (!colList[i].worldKey) {
      colList[i].worldKey = colList[i].cottonId || colList[i].crownFlowerId || colList[i].fruitId || ("item_" + i);
    }
  }
  window.collectibles = colList;
  if (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.rebuild === "function") {
    SpatialGrid.rebuild(colList);
  }
  if (typeof refreshCollectiblesVBO === "function") {
    refreshCollectiblesVBO();
  }
}
window.syncTreeAttachedFruits = syncTreeAttachedFruits;

// =========================================================================
// UNIFIED ULTRA-LIGHTWEIGHT GROUND DROP SYSTEM (Single codepath for ALL drops:
// tough_meat, leather, log, branch, rock, ores, dragon_fruit, grass, cloth, etc.)
// =========================================================================
(function initGroundDropSystem() {
  const DROP_META = {
    tough_meat:        { label: "TOUGH_MEAT",        icon: "🥩",  size: 0.085, color: [0.60, 0.16, 0.18], floatInWater: false },
    leather:           { label: "LEATHER",           icon: "🟫",  size: 0.085, color: [0.35, 0.38, 0.42], floatInWater: false },
    hide:              { label: "LEATHER",           icon: "🟫",  size: 0.085, color: [0.35, 0.38, 0.42], floatInWater: false },
    log:               { label: "LOG",               icon: "🪵",  size: 0.085, color: [0.50, 0.30, 0.15], floatInWater: true  },
    branch:            { label: "BRANCH",            icon: "🌿",  size: 0.025, color: [0.50, 0.30, 0.15], floatInWater: true  },
    rock:              { label: "ROCK",              icon: "🪨",  size: 0.025, color: [0.50, 0.50, 0.50], floatInWater: false },
    big_rock:          { label: "BIG_ROCK",          icon: "🪨",  size: 0.055, color: [0.48, 0.48, 0.48], floatInWater: false },
    dirt:              { label: "DIRT",              icon: "🟫",  size: 0.035, color: [0.42, 0.30, 0.18], floatInWater: false },
    iron_ore:          { label: "IRON_ORE",          icon: "🟥",  size: 0.04,  color: [0.65, 0.35, 0.30], floatInWater: false },
    gold_ore:          { label: "GOLD_ORE",          icon: "🪙",  size: 0.04,  color: [0.85, 0.72, 0.20], floatInWater: false },
    glow_ore:          { label: "GLOW_ORE",          icon: "✨",  size: 0.04,  color: [0.30, 0.90, 0.85], floatInWater: false },
    glow_battery:      { label: "GLOW_BATTERY",      icon: "🔋",  size: 0.065, color: [0.30, 0.90, 0.85], floatInWater: false },
    glow_battery_empty:{ label: "GLOW_BATTERY_EMPTY",icon: "🪫",  size: 0.065, color: [0.35, 0.35, 0.38], floatInWater: false },
    dragon_fruit:      { label: "DRAGON_FRUIT",      icon: "🐉",  size: 0.038, color: [0.92, 0.14, 0.46], floatInWater: false },
    cotton_plant:      { label: "COTTON_PLANT",      icon: "☁️",  size: 0.06,  color: [0.96, 0.96, 0.94], floatInWater: false },
    crown_flower:      { label: "CROWN_FLOWER",      icon: "💮",  size: 0.06,  color: [0.92, 0.90, 0.96], floatInWater: false },
    grass:             { label: "GRASS",             icon: "🌱",  size: 0.060, color: [0.35, 0.62, 0.24], floatInWater: true  },
    cloth:             { label: "CLOTH",             icon: "⬜",  size: 0.08,  color: [0.94, 0.93, 0.90], floatInWater: false },
    rubber_block:      { label: "RUBBER_BLOCK",      icon: "⬛",  size: 0.08,  color: [0.18, 0.18, 0.20], floatInWater: false },
    fried_bug:         { label: "FRIED_BUG",         icon: "🍤",  size: 0.072, color: [0.78, 0.48, 0.20], floatInWater: false },
    isopod_item:       { label: "ISOPOD",            icon: "🦐",  size: 0.20,  color: [0.55, 0.50, 0.46], floatInWater: false },
    isopod:            { label: "ISOPOD",            icon: "🦐",  size: 0.20,  color: [0.55, 0.50, 0.46], floatInWater: false },
    meganeura_item:    { label: "MEGANEURA",         icon: "🦟",  size: 0.24,  color: [0.35, 0.65, 0.40], floatInWater: false },
    meganeura:         { label: "MEGANEURA",         icon: "🦟",  size: 0.24,  color: [0.35, 0.65, 0.40], floatInWater: false },
    obsidian_cube_item:{ label: "OBSIDIAN_CUBE",     icon: "🟪",  size: 0.075, color: [0.22, 0.12, 0.35], floatInWater: false },
    obsidian_cube:     { label: "OBSIDIAN_CUBE",     icon: "🟪",  size: 0.075, color: [0.22, 0.12, 0.35], floatInWater: false },
    obsidian_flux_item:{ label: "OBSIDIAN_FLUX",     icon: "🟣",  size: 0.078, color: [0.55, 0.22, 0.85], floatInWater: false },
    obsidian_flux:     { label: "OBSIDIAN_FLUX",     icon: "🟣",  size: 0.078, color: [0.55, 0.22, 0.85], floatInWater: false },
    axe:               { label: "AXE",               icon: "🪓",  size: 0.042, color: [0.60, 0.60, 0.65], floatInWater: false },
    pickaxe:           { label: "PICKAXE",           icon: "⛏️", size: 0.042, color: [0.60, 0.60, 0.65], floatInWater: false },
    shovel:            { label: "SHOVEL",            icon: "🪏",  size: 0.022, color: [0.60, 0.60, 0.65], floatInWater: false },
    tanto:             { label: "TANTO",             icon: "🗡️", size: 0.052, color: [0.85, 0.85, 0.90], floatInWater: false },
    aegis_shift:       { label: "AEGIS_SHIFT",       icon: "⛏️⚔️", size: 0.064, color: [0.75, 0.78, 0.88], floatInWater: false },
    bow:               { label: "BOW",               icon: "🏹",  size: 0.085, color: [0.55, 0.38, 0.22], floatInWater: true  },
    arrow:             { label: "ARROW",             icon: "🏹",  size: 0.050, color: [0.55, 0.40, 0.25], floatInWater: true  },
    iron_bullet:       { label: "IRON_BULLET",       icon: "⚫",  size: 0.009, color: [0.75, 0.78, 0.82], floatInWater: false },
    wooden_arm_cannon: { label: "WOODEN_ARM_CANNON", icon: "🪵",  size: 0.24,  color: [0.55, 0.38, 0.22], floatInWater: true  },
    iron_bucket:       { label: "IRON_BUCKET",       icon: "🪣",  size: 0.040, color: [0.62, 0.66, 0.72], floatInWater: false },
    water_bucket:      { label: "WATER_BUCKET",      icon: "🪣",  size: 0.040, color: [0.22, 0.62, 0.92], floatInWater: false },
    double_breasted_suit:  { label: "DOUBLE_BREASTED_SUIT",  icon: "🧥", size: 0.056, color: [0.24, 0.25, 0.27], floatInWater: true  },
    black_slacks:          { label: "BLACK_SLACKS",          icon: "👖", size: 0.050, color: [0.22, 0.23, 0.25], floatInWater: true  },
    opera_cape:            { label: "OPERA_CAPE",            icon: "🧛", size: 0.056, color: [0.10, 0.11, 0.13], floatInWater: true  },
    traveler_hoodie:       { label: "TRAVELER_HOODIE",       icon: "🧥", size: 0.056, color: [0.93, 0.90, 0.85], floatInWater: true  },
    hoodie_cloak:          { label: "TRAVELER_HOODIE",       icon: "🧥", size: 0.056, color: [0.93, 0.90, 0.85], floatInWater: true  },
    white_shirt_short:     { label: "WHITE_SHIRT_SHORT",     icon: "👔", size: 0.050, color: [0.98, 0.98, 0.99], floatInWater: true  },
    black_pleated_skirt:   { label: "BLACK_PLEATED_SKIRT",   icon: "👗", size: 0.050, color: [0.13, 0.14, 0.16], floatInWater: true  },
    black_leggings:        { label: "BLACK_LEGGINGS",        icon: "👖", size: 0.048, color: [0.13, 0.14, 0.16], floatInWater: true  },
    white_bodysuit_top:    { label: "WHITE_BODYSUIT_TOP",    icon: "👕", size: 0.046, color: [0.97, 0.98, 0.99], floatInWater: true  },
    white_bodysuit_shorts: { label: "WHITE_BODYSUIT_SHORTS", icon: "🩳", size: 0.044, color: [0.97, 0.98, 0.99], floatInWater: true  },
    traveler_boots:        { label: "TRAVELER_BOOTS",        icon: "🥾", size: 0.042, color: [0.15, 0.16, 0.18], floatInWater: false },
    hoodie_boots:          { label: "TRAVELER_BOOTS",        icon: "🥾", size: 0.042, color: [0.15, 0.16, 0.18], floatInWater: false },
    oxford_shoes:          { label: "OXFORD_SHOES",          icon: "👞", size: 0.042, color: [0.09, 0.10, 0.12], floatInWater: false },
    dress_boots:           { label: "DRESS_BOOTS",           icon: "🥾", size: 0.042, color: [0.09, 0.10, 0.12], floatInWater: false }
  };

  // Placeable structures / furniture / vehicles / mechs (27 items + aliases).
  // Kept SEPARATE from DROP_META so isGroundDropType() stays false for placed buildings,
  // while getMeta() and renderPlaceableDrop() give ground-dropped items crisp normalized miniature 3D models.
  const PLACEABLE_DROP_META = {
    wood_floor:               { label: "WOOD_FLOOR",        icon: "🟫", size: 0.058, color: [0.65, 0.45, 0.25], floatInWater: true,  mockSize: 0.75 },
    plank:                    { label: "WOOD_FLOOR",        icon: "🟫", size: 0.058, color: [0.65, 0.45, 0.25], floatInWater: true,  mockSize: 0.75 },
    thin_wood_floor:          { label: "THIN_WOOD_FLOOR",   icon: "🪵", size: 0.058, color: [0.65, 0.45, 0.25], floatInWater: true,  mockSize: 0.75 },
    stone_floor:              { label: "STONE_FLOOR",       icon: "🧱", size: 0.058, color: [0.55, 0.55, 0.57], floatInWater: false, mockSize: 0.08, mockExtra: { width: 0.75, depth: 0.75, isIconPreview: true } },
    wood_wall:                { label: "WOOD_WALL",         icon: "🧱", size: 0.062, color: [0.65, 0.45, 0.25], floatInWater: true,  mockSize: 0.25 },
    wood_window:              { label: "WOOD_WINDOW",       icon: "🪟", size: 0.062, color: [0.65, 0.45, 0.25], floatInWater: true,  mockSize: 0.25 },
    wood_door:                { label: "WOOD_DOOR",         icon: "🚪", size: 0.064, color: [0.65, 0.45, 0.25], floatInWater: true,  mockSize: 0.25 },
    wood_roof:                { label: "WOOD_ROOF",         icon: "🏠", size: 0.064, color: [0.65, 0.45, 0.25], floatInWater: true,  mockSize: 0.25, mockExtra: { angle: 0.0 } },
    wood_stairs:              { label: "WOOD_STAIRS",       icon: "🪜", size: 0.064, color: [0.65, 0.45, 0.25], floatInWater: true,  mockSize: 0.25, mockExtra: { stairTop: [-0.175, 0.175, -0.175], stairBottom: [0.175, -0.175, 0.175] } },
    folding_ladder:           { label: "FOLDING_LADDER",    icon: "🪜", size: 0.064, color: [0.55, 0.58, 0.62], floatInWater: false, mockSize: 0.25, mockExtra: { stairTop: [-0.175, 0.175, -0.175], stairBottom: [0.175, -0.175, 0.175] } },
    campfire:                 { label: "CAMPFIRE",          icon: "🔥", size: 0.056, color: [0.50, 0.36, 0.22], floatInWater: false, mockSize: 0.25 },
    lantern:                  { label: "LANTERN",           icon: "🏮", size: 0.044, color: [0.95, 0.78, 0.35], floatInWater: false, mockSize: 0.25 },
    wood_bed:                 { label: "WOOD_BED",          icon: "🛏️", size: 0.064, color: [0.58, 0.40, 0.22], floatInWater: true,  mockSize: 0.25 },
    wood_chair:               { label: "WOOD_CHAIR",        icon: "🪑", size: 0.054, color: [0.58, 0.40, 0.22], floatInWater: true,  mockSize: 0.25 },
    wood_table:               { label: "WOOD_TABLE",        icon: "🪑", size: 0.060, color: [0.56, 0.38, 0.21], floatInWater: true,  mockSize: 0.25 },
    wood_chest:               { label: "WOOD_CHEST",        icon: "🧰", size: 0.056, color: [0.52, 0.35, 0.18], floatInWater: true,  mockSize: 0.25 },
    wood_planter_box:         { label: "WOOD_PLANTER_BOX",  icon: "🪴", size: 0.058, color: [0.52, 0.35, 0.19], floatInWater: true,  mockSize: 0.25 },
    obsidian_pad_warp_item:   { label: "OBSIDIAN_PAD_WARP", icon: "🧭", size: 0.058, color: [0.18, 0.14, 0.26], floatInWater: false, mockSize: 0.25 },
    obsidian_pad_warp:        { label: "OBSIDIAN_PAD_WARP", icon: "🧭", size: 0.058, color: [0.18, 0.14, 0.26], floatInWater: false, mockSize: 0.25 },
    obsidian_compass_pad_item:{ label: "OBSIDIAN_PAD_WARP", icon: "🧭", size: 0.058, color: [0.18, 0.14, 0.26], floatInWater: false, mockSize: 0.25 },
    obsidian_compass_pad:     { label: "OBSIDIAN_PAD_WARP", icon: "🧭", size: 0.058, color: [0.18, 0.14, 0.26], floatInWater: false, mockSize: 0.25 },
    wood_boat:                { label: "WOOD_BOAT",         icon: "⛵", size: 0.072, color: [0.56, 0.38, 0.20], floatInWater: false, mockSize: 0.25 },
    boat_wing:                { label: "BOAT_WING",         icon: "🪽", size: 0.068, color: [0.86, 0.80, 0.68], floatInWater: true,  mockSize: 0.25 },
    wood_wheel:               { label: "WOOD_WHEEL",        icon: "🛞", size: 0.052, color: [0.55, 0.38, 0.22], floatInWater: true,  mockSize: 0.25 },
    electric_engine:          { label: "ELECTRIC_ENGINE",   icon: "⚙️", size: 0.054, color: [0.75, 0.75, 0.78], floatInWater: false, mockSize: 0.25 },
    robot_stand:              { label: "ROBOT_STAND",       icon: "🤖", size: 0.066, color: [0.22, 0.22, 0.25], floatInWater: false, mockSize: 0.25 },
    robot_cockpit:            { label: "ROBOT_COCKPIT",     icon: "🤖", size: 0.066, color: [0.52, 0.35, 0.18], floatInWater: false, mockSize: 0.25 },
    robot_left_arm:           { label: "ROBOT_LEFT_ARM",    icon: "🦾", size: 0.062, color: [0.52, 0.35, 0.18], floatInWater: false, mockSize: 0.25 },
    robot_right_arm:          { label: "ROBOT_RIGHT_ARM",   icon: "🦾", size: 0.062, color: [0.52, 0.35, 0.18], floatInWater: false, mockSize: 0.25 },
    robot_left_leg:           { label: "ROBOT_LEFT_LEG",    icon: "🦿", size: 0.064, color: [0.52, 0.35, 0.18], floatInWater: false, mockSize: 0.25 },
    robot_right_leg:          { label: "ROBOT_RIGHT_LEG",   icon: "🦿", size: 0.064, color: [0.52, 0.35, 0.18], floatInWater: false, mockSize: 0.25 },
    robot_core:               { label: "ROBOT_CORE",        icon: "💠", size: 0.054, color: [0.30, 0.85, 0.90], floatInWater: false, mockSize: 0.25 },
    robot_module:             { label: "ROBOT_MODULE",      icon: "🧩", size: 0.054, color: [0.52, 0.35, 0.18], floatInWater: false, mockSize: 0.25 }
  };

  function normalizeDropType(type) {
    return String(type || "").toLowerCase();
  }

  function isGroundDropType(type) {
    if (!type) return false;
    return Object.prototype.hasOwnProperty.call(DROP_META, normalizeDropType(type));
  }

  function getPlaceableDropMeta(type) {
    if (!type) return null;
    const key = normalizeDropType(type);
    return Object.prototype.hasOwnProperty.call(PLACEABLE_DROP_META, key) ? PLACEABLE_DROP_META[key] : null;
  }

  function isGroundDrop(item) {
    if (!item || !item.type) return false;
    if (item.isGroundDrop) return true;
    return isGroundDropType(item.type);
  }

  function getMeta(type) {
    const key = normalizeDropType(type);
    if (Object.prototype.hasOwnProperty.call(DROP_META, key)) {
      return DROP_META[key];
    }
    if (Object.prototype.hasOwnProperty.call(PLACEABLE_DROP_META, key)) {
      return PLACEABLE_DROP_META[key];
    }
    return {
      label: key ? key.toUpperCase() : "BRANCH",
      icon: "🌿",
      size: 0.05,
      color: [0.6, 0.6, 0.6],
      floatInWater: false
    };
  }

  // Always returns a clean right-handed orthonormal basis (R x N = F, det(R,N,F) = +1)
  function computeSurfaceBasis(pos, normal, tangent, bitangent) {
    let nx, ny, nz;
    if (normal && normal.length >= 3) {
      const nLen = Math.hypot(normal[0], normal[1], normal[2]) || 1;
      nx = normal[0] / nLen; ny = normal[1] / nLen; nz = normal[2] / nLen;
    } else if (pos && pos.length >= 3) {
      const pLen = Math.hypot(pos[0], pos[1], pos[2]) || 1;
      nx = pos[0] / pLen; ny = pos[1] / pLen; nz = pos[2] / pLen;
    } else {
      nx = 0; ny = 1; nz = 0;
    }

    let fx, fy, fz;
    if (bitangent && bitangent.length >= 3) {
      const dot = bitangent[0] * nx + bitangent[1] * ny + bitangent[2] * nz;
      fx = bitangent[0] - dot * nx;
      fy = bitangent[1] - dot * ny;
      fz = bitangent[2] - dot * nz;
      const fLen = Math.hypot(fx, fy, fz);
      if (fLen > 0.001) {
        fx /= fLen; fy /= fLen; fz /= fLen;
      } else {
        fx = 0; fy = 0; fz = 0;
      }
    } else if (tangent && tangent.length >= 3) {
      // Cross tangent with N to get orthogonal F
      fx = tangent[1] * nz - tangent[2] * ny;
      fy = tangent[2] * nx - tangent[0] * nz;
      fz = tangent[0] * ny - tangent[1] * nx;
      const fLen = Math.hypot(fx, fy, fz);
      if (fLen > 0.001) {
        fx /= fLen; fy /= fLen; fz /= fLen;
      } else {
        fx = 0; fy = 0; fz = 0;
      }
    } else {
      fx = 0; fy = 0; fz = 0;
    }

    if (fx === 0 && fy === 0 && fz === 0) {
      const ax = Math.abs(nx) > 0.85 ? 0 : 1;
      const ay = Math.abs(nx) > 0.85 ? 1 : 0;
      const az = 0;
      fx = ny * az - nz * ay;
      fy = nz * ax - nx * az;
      fz = nx * ay - ny * ax;
      const fLen = Math.hypot(fx, fy, fz) || 1;
      fx /= fLen; fy /= fLen; fz /= fLen;
    }

    // R = N x F -> guarantees (R x N) · F = +1 (right-handed)
    const rx = ny * fz - nz * fy;
    const ry = nz * fx - nx * fz;
    const rz = nx * fy - ny * fx;
    return {
      normal: [nx, ny, nz],
      R: [rx, ry, rz],
      F: [fx, fy, fz]
    };
  }

  const STACK_THRESHOLD = 5;
  const STACK_MERGE_RADIUS = 0.30;

  function isStackableDropType(type, opts) {
    const key = normalizeDropType(type);
    if (!key) return false;
    if (key === "cotton_plant" || key === "crown_flower") return false;
    if (opts && opts.extra && opts.extra.isAttachedToTree) return false;
    if (opts && opts.extra && opts.extra.isPlayerDropped) return true;
    return isGroundDropType(key);
  }

  function findNearbyMatchingDrops(colList, pos, dropType, radius) {
    const rSq = radius * radius;
    const candidates = (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.queryRadius === "function")
      ? SpatialGrid.queryRadius(pos[0], pos[1], pos[2], radius)
      : colList;
    const matched = [];
    for (let i = 0; i < candidates.length; i++) {
      const d = candidates[i];
      if (!d || d.active === false || !d.isDynamic || d.isPreview || d.isAttachedToTree) continue;
      if (normalizeDropType(d.type) !== dropType) continue;
      if (!d.position) continue;
      const dx = d.position[0] - pos[0];
      const dy = d.position[1] - pos[1];
      const dz = d.position[2] - pos[2];
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq <= rSq) {
        matched.push({ drop: d, distSq });
      }
    }
    if (matched.length > 1) {
      matched.sort((a, b) => a.distSq - b.distSq);
    }
    return matched;
  }

  function spawn(opts) {
    if (!opts || !opts.position) return null;
    const colList = (typeof collectibles !== "undefined" && Array.isArray(collectibles))
      ? collectibles
      : (typeof window !== "undefined" && Array.isArray(window.collectibles) ? window.collectibles : null);
    if (!colList) return null;

    const dropType = normalizeDropType(opts.type);
    if (!dropType) return null;
    const meta = getMeta(dropType);
    const addCount = Math.max(1, Math.floor(typeof opts.count === "number" ? opts.count : 1));
    const p = opts.position;

    // Stack Drop system: if adding > 5 items, or > 5 drops of the same type pile up nearby,
    // collapse/merge into a single drop entity carrying drop.count (eliminates excess physics & VBO meshes)
    const allowMerge = opts.allowStackMerge !== false && isStackableDropType(dropType, opts);
    if (allowMerge) {
      const nearby = findNearbyMatchingDrops(colList, p, dropType, STACK_MERGE_RADIUS);
      if (nearby.length > 0) {
        let hostEntry = nearby.find(m => (m.drop.count || 1) > 1);
        let nearbyTotal = 0;
        for (let i = 0; i < nearby.length; i++) {
          nearbyTotal += Math.max(1, nearby[i].drop.count || 1);
        }
        if (hostEntry) {
          const host = hostEntry.drop;
          host.count = Math.max(1, host.count || 1) + addCount;
          host._groundDropAgeSec = 0;
          return host;
        }
        if (addCount > STACK_THRESHOLD || (nearbyTotal + addCount) > STACK_THRESHOLD) {
          const host = nearby[0].drop;
          host.count = nearbyTotal + addCount;
          host._groundDropAgeSec = 0;
          for (let i = 1; i < nearby.length; i++) {
            markCollected(nearby[i].drop);
          }
          return host;
        }
      }
    }

    const basis = opts.rawBasis
      ? {
          normal: opts.normal ? [opts.normal[0], opts.normal[1], opts.normal[2]] : [0, 1, 0],
          R: opts.R ? [opts.R[0], opts.R[1], opts.R[2]] : [1, 0, 0],
          F: opts.F ? [opts.F[0], opts.F[1], opts.F[2]] : [0, 0, 1]
        }
      : computeSurfaceBasis(opts.position, opts.normal, opts.R || opts.tangent, opts.F || opts.bitangent);

    let dx = 0, dy = 0, dz = 0;
    if (opts.applyScatter !== false) {
      const offR = (typeof opts.offsetR === "number")
        ? opts.offsetR
        : ((opts.scatterRadius || 0.004) * Math.cos(opts.scatterAngle !== undefined ? opts.scatterAngle : Math.random() * Math.PI * 2));
      const offF = (typeof opts.offsetF === "number")
        ? opts.offsetF
        : ((opts.scatterRadius || 0.004) * Math.sin(opts.scatterAngle !== undefined ? opts.scatterAngle : Math.random() * Math.PI * 2));
      const lift = (typeof opts.scatterLift === "number") ? opts.scatterLift : (0.005 + Math.random() * 0.01);
      dx = basis.R[0] * offR + basis.F[0] * offF + basis.normal[0] * lift;
      dy = basis.R[1] * offR + basis.F[1] * offF + basis.normal[1] * lift;
      dz = basis.R[2] * offR + basis.F[2] * offF + basis.normal[2] * lift;
    }

    const drop = {
      type: dropType,
      position: [p[0] + dx, p[1] + dy, p[2] + dz],
      normal: basis.normal,
      R: basis.R,
      F: basis.F,
      U: basis.normal,
      color: opts.color || meta.color,
      size: (typeof opts.size === "number") ? opts.size : meta.size,
      active: true,
      isDynamic: true,
      isGroundDrop: true,
      _dropSettled: false,
      _settleFrames: 0,
      _groundDropAgeSec: 0,
      seed: (typeof opts.seed === "number") ? opts.seed : Math.random()
    };
    if (addCount > 1) {
      drop.count = addCount;
    }

    if (opts.vel && opts.vel.length >= 3) {
      drop.vel = [opts.vel[0], opts.vel[1], opts.vel[2]];
    } else if (opts.isHand) {
      drop.vel = [
        dx * 0.01 + (Math.random() - 0.5) * 0.001,
        dy * 0.01 + (Math.random() - 0.5) * 0.001,
        dz * 0.01 + (Math.random() - 0.5) * 0.001
      ];
    } else {
      const vOut = (typeof opts.popOut === "number") ? opts.popOut : (0.0018 + Math.random() * 0.0025);
      const vUp = (typeof opts.popUp === "number") ? opts.popUp : (0.0025 + Math.random() * 0.0035);
      const ang = (typeof opts.scatterAngle === "number") ? opts.scatterAngle : Math.random() * Math.PI * 2;
      const cosA = Math.cos(ang), sinA = Math.sin(ang);
      drop.vel = [
        (basis.R[0] * cosA + basis.F[0] * sinA) * vOut + basis.normal[0] * vUp,
        (basis.R[1] * cosA + basis.F[1] * sinA) * vOut + basis.normal[1] * vUp,
        (basis.R[2] * cosA + basis.F[2] * sinA) * vOut + basis.normal[2] * vUp
      ];
    }

    if (opts.spin) drop.spin = [opts.spin[0], opts.spin[1], opts.spin[2]];
    if (typeof opts.spinSpeed === "number") {
      drop.spinSpeed = opts.spinSpeed;
    } else if (opts.isHand) {
      drop.spin = [(Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05];
      drop.spinSpeed = 0.01 + Math.random() * 0.02;
    }

    if (opts.extra && typeof opts.extra === "object") {
      Object.assign(drop, opts.extra);
    }

    colList.push(drop);
    if (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.insert === "function") {
      SpatialGrid.insert(drop);
    }
    if (!opts.skipRefresh && typeof window !== "undefined") {
      window.pendingDynamicCollectibleRefresh = true;
    }
    return drop;
  }

  function spawnBatch(origin, entries, opts) {
    if (!origin || !Array.isArray(entries) || entries.length === 0) return [];
    const o = opts || {};
    const basis = computeSurfaceBasis(origin, o.normal, o.R || o.tangent, o.F || o.bitangent);
    const spawned = [];

    for (let eIdx = 0; eIdx < entries.length; eIdx++) {
      const entry = entries[eIdx];
      if (!entry) continue;
      const count = Math.max(1, Math.floor(entry.count || 1));
      const dropType = normalizeDropType(entry.type || entry.name);
      if (!dropType) continue;

      const allowStack = o.allowStackMerge !== false && entry.allowStackMerge !== false && isStackableDropType(dropType, { extra: entry.extra });
      if (allowStack && count > STACK_THRESHOLD) {
        const ang = o.ringScatter
          ? ((eIdx / Math.max(1, entries.length)) * Math.PI * 2)
          : Math.random() * Math.PI * 2;
        const rad = o.ringScatter
          ? (o.baseRadius || 0.08)
          : ((o.minRadius || 0.002) + Math.random() * (o.radiusJitter || 0.005));
        const d = spawn({
          type: dropType,
          count: count,
          position: origin,
          normal: basis.normal,
          R: basis.R,
          F: basis.F,
          rawBasis: true,
          color: entry.color,
          size: entry.size,
          isHand: !!(entry.isHand || o.isHand),
          scatterAngle: ang,
          scatterRadius: rad,
          scatterLift: (typeof o.lift === "number") ? o.lift : (0.005 + Math.random() * 0.01),
          popOut: o.popOut,
          popUp: o.popUp,
          vel: entry.vel,
          spin: entry.spin,
          spinSpeed: entry.spinSpeed,
          extra: entry.extra,
          allowStackMerge: true,
          skipRefresh: true
        });
        if (d && spawned.indexOf(d) === -1) spawned.push(d);
        continue;
      }

      for (let k = 0; k < count; k++) {
        const ang = o.ringScatter
          ? (((eIdx * 13 + k) / Math.max(1, count)) * Math.PI * 2)
          : Math.random() * Math.PI * 2;
        const rad = o.ringScatter
          ? ((o.baseRadius || 0.08) + (k % 3) * (o.ringStep || 0.04))
          : ((o.minRadius || 0.002) + Math.random() * (o.radiusJitter || 0.005));
        const d = spawn({
          type: dropType,
          count: 1,
          position: origin,
          normal: basis.normal,
          R: basis.R,
          F: basis.F,
          rawBasis: true,
          color: entry.color,
          size: entry.size,
          isHand: !!(entry.isHand || o.isHand),
          scatterAngle: ang,
          scatterRadius: rad,
          scatterLift: (typeof o.lift === "number") ? o.lift : (0.005 + Math.random() * 0.01),
          popOut: o.popOut,
          popUp: o.popUp,
          vel: entry.vel,
          spin: entry.spin,
          spinSpeed: entry.spinSpeed,
          extra: entry.extra,
          allowStackMerge: entry.allowStackMerge !== undefined ? entry.allowStackMerge : o.allowStackMerge,
          skipRefresh: true
        });
        if (d && spawned.indexOf(d) === -1) spawned.push(d);
      }
    }

    if (spawned.length > 0 && !o.skipRefresh && typeof window !== "undefined") {
      window.pendingDynamicCollectibleRefresh = true;
    }
    return spawned;
  }

  function takeFromDrop(item, maxTake) {
    if (!item || item.active === false) return 0;
    const total = Math.max(1, Math.floor(item.count || 1));
    const take = (typeof maxTake === "number") ? Math.min(total, Math.max(0, Math.floor(maxTake))) : total;
    if (take <= 0) return 0;
    if (take >= total) {
      item.count = 0;
      markCollected(item);
      return total;
    }
    item.count = total - take;
    return take;
  }

  function markCollected(item) {
    if (!item) return false;
    item.active = false;
    if (item.cottonId) {
      const obsId = parseInt(String(item.cottonId).replace("cotton_", ""), 10);
      const natureList = (window.allDeterministicNatureObstacles || []).concat(window.natureObstacles || []);
      const obs = natureList.find(o => o && o.id === obsId);
      if (obs) obs.active = false;
    } else if (item.crownFlowerId) {
      const obsId = parseInt(String(item.crownFlowerId).replace("crown_flower_", ""), 10);
      const natureList = (window.allDeterministicNatureObstacles || []).concat(window.natureObstacles || []);
      const obs = natureList.find(o => o && o.id === obsId);
      if (obs) obs.active = false;
    }
    if (typeof window !== "undefined" && window.WildPlantGrowthSystem && typeof window.WildPlantGrowthSystem.onCollectibleHarvested === "function") {
      window.WildPlantGrowthSystem.onCollectibleHarvested(item);
    }

    if (item.isDynamic) {
      if (
        !window.pendingDynamicCollectibleRefresh &&
        typeof window.hideDynamicCollectibleInVBO === "function" &&
        window.hideDynamicCollectibleInVBO(item)
      ) {
        // Fast surgical GPU sub-buffer zero-out (0ms, no full dynamic VBO rebuild!)
      } else {
        if (typeof pendingDynamicCollectibleRefresh !== "undefined") pendingDynamicCollectibleRefresh = true;
        window.pendingDynamicCollectibleRefresh = true;
      }
    } else if (typeof window.hideStaticCollectibleInVBO === "function" && window.hideStaticCollectibleInVBO(item)) {
      // Fast surgical GPU sub-buffer zero-out for static collectibles
    } else {
      if (typeof pendingCollectibleRefresh !== "undefined") pendingCollectibleRefresh = true;
      window.pendingCollectibleRefresh = true;
    }
    if (isRemovableDynamicDrop(item)) {
      _deadDynamicDropCount++;
    }
    return true;
  }

  // =========================================================================
  // AUTO-TRANSFER EXPIRED GROUND DROPS & LANDED AMMO TO NEAREST RANDOM LOOT CHEST
  // Strictly excludes planet-generated static world items (branches/rocks/plants/fruits/boats).
  // =========================================================================
  const AUTO_TRANSFER_TTL_SEC = 120; // 2 minutes on the ground before auto-transfer
  const AUTO_TRANSFER_SWEEP_INTERVAL_SEC = 1.0;
  const DEAD_DROP_COMPACT_THRESHOLD = 24;
  let _autoTransferSweepAccum = 0;
  let _deadDynamicDropCount = 0;
  let _cachedLootChestsList = null;
  let _cachedLootChestsSource = null;
  let _cachedLootChestsLen = -1;
  let _cachedLootChestsGridVer = -1;

  function isRemovableDynamicDrop(c) {
    if (!c || !c.isDynamic || c.isWorldGenerated || c.isPlayerPlaced || c.worldKey) return false;
    return !!(c.isGroundDrop || c.type === "arrow");
  }

  function compactInactiveDrops(colList) {
    const list = Array.isArray(colList)
      ? colList
      : ((typeof collectibles !== "undefined" && Array.isArray(collectibles))
        ? collectibles
        : (typeof window !== "undefined" && Array.isArray(window.collectibles) ? window.collectibles : null));
    if (!list || list.length === 0) {
      _deadDynamicDropCount = 0;
      return 0;
    }
    let writeIdx = 0;
    let removed = 0;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c && c.active === false && isRemovableDynamicDrop(c)) {
        removed++;
        continue;
      }
      if (writeIdx !== i) {
        list[writeIdx] = c;
      }
      writeIdx++;
    }
    if (removed > 0) {
      list.length = writeIdx;
      _cachedLootChestsList = null;
      if (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.rebuild === "function") {
        SpatialGrid.rebuild(list);
      }
    }
    _deadDynamicDropCount = 0;
    return removed;
  }

  function getAutoTransferTtlSec() {
    if (typeof window !== "undefined" && typeof window.GROUND_DROP_TRANSFER_TTL_SEC === "number" && window.GROUND_DROP_TRANSFER_TTL_SEC > 0) {
      return window.GROUND_DROP_TRANSFER_TTL_SEC;
    }
    return AUTO_TRANSFER_TTL_SEC;
  }

  function isAutoTransferEligible(c) {
    if (!c || c.active === false || c.isPreview || c.isAttachedToTree) return false;
    // Planet-generated static world collectibles (rocks, branches, cotton, crown flower, tree fruits)
    // and world-generated beach boats/chests are never touched.
    if (!c.isDynamic || c.isWorldGenerated) return false;
    if (!c.position || c.position.length < 3) return false;

    // 1. All dynamic ground drops (chopped/mined/looted/dropped items, dropped structures/boats/ammo, detached fruits)
    if (c.isGroundDrop) return true;

    // 2. Fired projectiles / ammo that landed on the ground (arrows, iron bullets, etc.)
    if (c.type === "arrow") {
      if (c.isStuck) return true;
      if (c.attachedToNPC && (c.attachedToNPC.hp <= 0 || c.attachedToNPC.ragdollEnabled)) return true;
      return false;
    }

    return false;
  }

  // Single canonical resolver converting ANY ground collectible/drop/landed ammo to inventory/chest item metadata
  function resolveDropItemData(drop) {
    if (!drop) return null;
    let rawName = null;
    if (drop.dropItemName) {
      rawName = String(drop.dropItemName).trim().toUpperCase();
    } else if (drop.type === "arrow" && drop.ammoType) {
      rawName = String(drop.ammoType).trim().toUpperCase();
    } else {
      const meta = getMeta(drop.type);
      rawName = (meta && meta.label)
        ? String(meta.label).trim().toUpperCase()
        : String(drop.type || "BRANCH").trim().toUpperCase();
    }

    const def = (typeof window !== "undefined" && typeof window.getItemDefinition === "function")
      ? window.getItemDefinition(rawName)
      : null;
    const canonicalName = (def && def.id) ? def.id : rawName;
    const metaFallback = getMeta(drop.type);
    const icon = drop.dropItemIcon || (def && def.icon) || (metaFallback && metaFallback.icon) || "📦";
    const label = drop.dropItemLabel || canonicalName;
    const maxStack = Math.max(1, (def && typeof def.maxStack === "number") ? def.maxStack : 30);
    const count = Math.max(1, Math.floor(drop.count || 1));

    const itemData = {
      name: canonicalName,
      icon: icon,
      label: label,
      count: count
    };
    if (typeof drop.dropRechargeTime === "number") {
      itemData.rechargeTime = drop.dropRechargeTime;
    }
    return { itemData, maxStack };
  }

  function buildChestItemFromDrop(drop) {
    return resolveDropItemData(drop);
  }

  function getActiveRandomLootChests(colList) {
    if (!Array.isArray(colList)) return [];
    const gridVer = (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.version === "number") ? SpatialGrid.version : -1;
    if (
      _cachedLootChestsList &&
      _cachedLootChestsSource === colList &&
      _cachedLootChestsLen === colList.length &&
      _cachedLootChestsGridVer === gridVer
    ) {
      // Fast filter in case a cached loot chest was just demolished (active flipped to false)
      let allActive = true;
      for (let i = 0; i < _cachedLootChestsList.length; i++) {
        if (!_cachedLootChestsList[i] || _cachedLootChestsList[i].active === false) {
          allActive = false;
          break;
        }
      }
      if (allActive) return _cachedLootChestsList;
    }

    const chests = [];
    for (let i = 0; i < colList.length; i++) {
      const c = colList[i];
      if (!c || c.active === false || c.isPreview || c.isGroundDrop) continue;
      if (c.type !== "wood_chest" || !c.isRandomLootChest) continue;
      if (!c.position || c.position.length < 3) continue;
      chests.push(c);
    }
    _cachedLootChestsList = chests;
    _cachedLootChestsSource = colList;
    _cachedLootChestsLen = colList.length;
    _cachedLootChestsGridVer = gridVer;
    return chests;
  }

  function findRandomLootChestsByDistance(pos, colList, preloadedChests) {
    if (!pos) return [];
    const sourceChests = Array.isArray(preloadedChests) ? preloadedChests : getActiveRandomLootChests(colList);
    if (sourceChests.length === 0) return [];
    const px = pos[0], py = pos[1], pz = pos[2];
    const chests = [];
    for (let i = 0; i < sourceChests.length; i++) {
      const c = sourceChests[i];
      if (!c || c.active === false || !c.position) continue;
      const dx = c.position[0] - px;
      const dy = c.position[1] - py;
      const dz = c.position[2] - pz;
      chests.push({ chest: c, distSq: dx * dx + dy * dy + dz * dz });
    }
    if (chests.length > 1) {
      chests.sort((a, b) => a.distSq - b.distSq);
    }
    return chests;
  }

  function depositIntoChestStorage(chest, itemData, maxStack, amount) {
    if (!chest || !itemData || amount <= 0) return 0;
    if (!Array.isArray(chest.storage)) {
      chest.storage = Array(20).fill(null);
    } else {
      while (chest.storage.length < 20) chest.storage.push(null);
    }
    let remaining = amount;
    let deposited = 0;
    const hasCustomCharge = typeof itemData.rechargeTime === "number";

    // Pass 1: stack into existing matching slots (only when stackable and no distinct rechargeTime)
    if (maxStack > 1 && !hasCustomCharge) {
      for (let i = 0; i < 20 && remaining > 0; i++) {
        const slot = chest.storage[i];
        if (!slot || slot.name !== itemData.name) continue;
        if (typeof slot.rechargeTime === "number") continue;
        const cur = Math.max(1, Math.floor(slot.count || 1));
        const space = maxStack - cur;
        if (space > 0) {
          const add = Math.min(space, remaining);
          slot.count = cur + add;
          remaining -= add;
          deposited += add;
        }
      }
    }

    // Pass 2: place into empty slots
    for (let i = 0; i < 20 && remaining > 0; i++) {
      if (chest.storage[i] !== null && chest.storage[i] !== undefined) continue;
      const add = Math.min(maxStack, remaining);
      const entry = {
        name: itemData.name,
        icon: itemData.icon,
        label: itemData.label,
        count: add
      };
      if (hasCustomCharge) {
        entry.rechargeTime = itemData.rechargeTime;
      }
      chest.storage[i] = entry;
      remaining -= add;
      deposited += add;
    }

    return deposited;
  }

  function depositDropToNearestLootChest(drop, colList, opts) {
    const list = Array.isArray(colList)
      ? colList
      : ((typeof collectibles !== "undefined" && Array.isArray(collectibles))
        ? collectibles
        : (typeof window !== "undefined" && Array.isArray(window.collectibles) ? window.collectibles : null));
    if (!drop || !list || !isAutoTransferEligible(drop)) {
      return { deposited: 0, remaining: drop ? (drop.count || 1) : 0, chest: null, openChestModified: false };
    }

    const built = resolveDropItemData(drop);
    if (!built || !built.itemData) {
      return { deposited: 0, remaining: drop.count || 1, chest: null, openChestModified: false };
    }

    const orderedChests = findRandomLootChestsByDistance(drop.position, list, opts && opts.cachedLootChests);
    if (orderedChests.length === 0) {
      return { deposited: 0, remaining: built.itemData.count, chest: null, openChestModified: false };
    }

    let remaining = built.itemData.count;
    let depositedTotal = 0;
    let firstTargetChest = null;
    let openChestModified = false;
    const curOpen = (typeof currentOpenChest !== "undefined") ? currentOpenChest : null;

    for (let i = 0; i < orderedChests.length && remaining > 0; i++) {
      const targetChest = orderedChests[i].chest;
      const added = depositIntoChestStorage(targetChest, built.itemData, built.maxStack, remaining);
      if (added > 0) {
        if (!firstTargetChest) firstTargetChest = targetChest;
        depositedTotal += added;
        remaining -= added;
        if (curOpen && curOpen === targetChest) {
          openChestModified = true;
        }
      }
    }

    if (depositedTotal > 0) {
      if (remaining <= 0) {
        if (drop.attachedToNPC) drop.attachedToNPC = null;
        drop.count = 0;
        markCollected(drop);
      } else {
        drop.count = remaining;
        drop._groundDropAgeSec = 0;
      }
      if (openChestModified && !(opts && opts.deferChestRender) && typeof renderChest === "function") {
        renderChest();
      }
    }

    return { deposited: depositedTotal, remaining: remaining, chest: firstTargetChest, openChestModified: openChestModified };
  }

  function processExpiredDrops(dtSec, colList) {
    const dtVal = (typeof dtSec === "number" && dtSec > 0 && dtSec < 10) ? dtSec : (1 / 60);
    _autoTransferSweepAccum += dtVal;
    if (_autoTransferSweepAccum < AUTO_TRANSFER_SWEEP_INTERVAL_SEC) return 0;
    const elapsedSec = _autoTransferSweepAccum;
    _autoTransferSweepAccum = 0;

    const list = Array.isArray(colList)
      ? colList
      : ((typeof collectibles !== "undefined" && Array.isArray(collectibles))
        ? collectibles
        : (typeof window !== "undefined" && Array.isArray(window.collectibles) ? window.collectibles : null));
    if (!list || list.length === 0) return 0;

    // Scan ONLY dynamic items via SpatialGrid.dynamicItems when synced (avoids iterating 3,000+ static world items)
    let scanList = list;
    if (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.ensureSynced === "function" && Array.isArray(SpatialGrid.dynamicItems)) {
      SpatialGrid.ensureSynced(list);
      scanList = SpatialGrid.dynamicItems;
    }

    const ttlSec = getAutoTransferTtlSec();
    let transferredDrops = 0;
    let cachedLootChests = null;
    let anyOpenChestModified = false;

    for (let i = 0; i < scanList.length; i++) {
      const c = scanList[i];
      if (!isAutoTransferEligible(c)) continue;
      c._groundDropAgeSec = (typeof c._groundDropAgeSec === "number" ? c._groundDropAgeSec : 0) + elapsedSec;
      if (c._groundDropAgeSec >= ttlSec) {
        if (cachedLootChests === null) {
          cachedLootChests = getActiveRandomLootChests(list);
        }
        const res = depositDropToNearestLootChest(c, list, {
          cachedLootChests: cachedLootChests,
          deferChestRender: true
        });
        if (res.deposited > 0) {
          transferredDrops++;
          if (res.openChestModified) anyOpenChestModified = true;
        } else {
          // No random loot chest available or all full: retry gently in 15s without losing the item
          c._groundDropAgeSec = Math.max(0, ttlSec - 15);
        }
      }
    }

    if (anyOpenChestModified && typeof renderChest === "function") {
      renderChest();
    }

    if (_deadDynamicDropCount >= DEAD_DROP_COMPACT_THRESHOLD) {
      compactInactiveDrops(list);
    }

    return transferredDrops;
  }

  window.GroundDropSystem = {
    META: DROP_META,
    PLACEABLE_META: PLACEABLE_DROP_META,
    STACK_THRESHOLD,
    STACK_MERGE_RADIUS,
    AUTO_TRANSFER_TTL_SEC,
    normalizeDropType,
    isGroundDropType,
    getPlaceableDropMeta,
    isGroundDrop,
    isStackableDropType,
    isAutoTransferEligible,
    resolveDropItemData,
    buildChestItemFromDrop,
    depositDropToNearestLootChest,
    processExpiredDrops,
    compactInactiveDrops,
    getMeta,
    computeSurfaceBasis,
    spawn,
    spawnBatch,
    takeFromDrop,
    markCollected,
    getRarity: function(itemOrType) {
      return (typeof window !== "undefined" && typeof window.getItemRarity === "function")
        ? window.getItemRarity(itemOrType)
        : "COMMON";
    }
  };
})();

// Shared function to detach dragon fruits from white-red trees (Used by Player and PlayerClones)
function detachTreeAttachedFruits(tree) {
  if (!tree) return false;
  const isWhiteRed = Boolean(tree.isWhiteRedTree || (tree.fruitPositions && tree.fruitPositions.length > 0));
  if (!isWhiteRed) return false;

  const colList = (typeof collectibles !== "undefined" && Array.isArray(collectibles)) ? collectibles : (window.collectibles || []);
  let detachedAny = false;
  let detachedStaticFromMain = false;

  const computeInwardVel = (pos, fallbackNorm) => {
    let nx = 0, ny = 1, nz = 0;
    if (pos) {
      const rLen = Math.hypot(pos[0], pos[1], pos[2]);
      if (rLen > 0.001) {
        nx = pos[0] / rLen; ny = pos[1] / rLen; nz = pos[2] / rLen;
      }
    } else if (fallbackNorm) {
      nx = fallbackNorm[0]; ny = fallbackNorm[1]; nz = fallbackNorm[2];
    }
    return [
      -nx * 0.012 + (Math.random() - 0.5) * 0.004,
      -ny * 0.012 + (Math.random() - 0.5) * 0.004,
      -nz * 0.012 + (Math.random() - 0.5) * 0.004
    ];
  };

  for (let c of colList) {
    if (c && c.active !== false && c.isAttachedToTree && c.treeId === tree.id) {
      if (!c.isDynamic) detachedStaticFromMain = true;
      c.isAttachedToTree = false;
      c.isDynamic = true;
      c.isGroundDrop = true;
      c._dropSettled = false;
      c._settleFrames = 0;
      c._groundDropAgeSec = 0;
      c.vel = computeInwardVel(c.position, tree.normal);
      c.spin = [(Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05];
      c.spinSpeed = 0.02;
      if (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.insert === "function") {
        SpatialGrid.insert(c);
      }
      detachedAny = true;
    }
  }

  // If tree has fruitPositions but some or none were in colList yet, spawn via unified GroundDropSystem
  if (tree.fruitPositions && tree.fruitPositions.length > 0) {
    for (let fIdx = 0; fIdx < tree.fruitPositions.length; fIdx++) {
      const fInfo = tree.fruitPositions[fIdx];
      const fruitId = "df_" + tree.id + "_" + fIdx;
      const existing = colList.find(c => c.fruitId === fruitId || (c.treeId === tree.id && c.fruitIdx === fIdx));
      if (!existing) {
        window.GroundDropSystem.spawn({
          type: "dragon_fruit",
          position: fInfo.pos,
          normal: fInfo.normal || [0, -1, 0],
          R: fInfo.R || [1, 0, 0],
          F: fInfo.F || [0, 0, 1],
          rawBasis: true,
          applyScatter: false,
          size: 0.035,
          seed: 1234 + tree.id * 10 + fIdx,
          color: [0.92, 0.14, 0.46],
          vel: computeInwardVel(fInfo.pos, fInfo.normal || tree.normal),
          spin: [(Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05],
          spinSpeed: 0.02,
          extra: {
            isAttachedToTree: false,
            treeId: tree.id,
            fruitIdx: fIdx,
            fruitId: fruitId
          },
          skipRefresh: true
        });
        detachedAny = true;
      }
    }
    tree.fruitPositions = [];
  }

  if (detachedAny) {
    if (detachedStaticFromMain) {
      if (typeof pendingCollectibleRefresh !== "undefined") pendingCollectibleRefresh = true;
      if (typeof window !== "undefined") window.pendingCollectibleRefresh = true;
    }
    if (typeof window !== "undefined") {
      window.pendingDynamicCollectibleRefresh = true;
    }
  }
  return detachedAny;
}
window.detachTreeAttachedFruits = detachTreeAttachedFruits;

// Shared local-space mesh template cache & ultra-fast emitter helper for ALL droppable items
// (Explicitly invoked by each item file — NO Auto-Cache magic)
const _groundDropTemplateCache = window._groundDropTemplateCache || (window._groundDropTemplateCache = {});

function _emitCachedDropTemplate(tpl, p, r, n, f, s, yOff, vertices, colors, indices, colorTransform) {
  if (!tpl) return;
  const tv = tpl.verts;
  const tc = tpl.cols;
  const ti = tpl.inds;
  const vCount = tv.length / 3;
  const vBase = vertices.length / 3;

  const px = p[0], py = p[1], pz = p[2];
  const rx = r[0] * s, ry = r[1] * s, rz = r[2] * s;
  const nx = n[0] * s, ny = n[1] * s, nz = n[2] * s;
  const fx = f[0] * s, fy = f[1] * s, fz = f[2] * s;
  const ox = px + nx * yOff;
  const oy = py + ny * yOff;
  const oz = pz + nz * yOff;

  if (typeof colorTransform === "function") {
    for (let i = 0; i < vCount; i++) {
      const o = i * 3;
      const lx = tv[o], ly = tv[o + 1], lz = tv[o + 2];
      vertices.push(
        ox + rx * lx + nx * ly + fx * lz,
        oy + ry * lx + ny * ly + fy * lz,
        oz + rz * lx + nz * ly + fz * lz
      );
      const enc = colorTransform(tc[o], tc[o + 1], tc[o + 2]);
      colors.push(enc[0], enc[1], enc[2]);
    }
  } else if (Array.isArray(colorTransform) && colorTransform.length >= 3) {
    const oc0 = colorTransform[0], oc1 = colorTransform[1], oc2 = colorTransform[2];
    for (let i = 0; i < vCount; i++) {
      const o = i * 3;
      const lx = tv[o], ly = tv[o + 1], lz = tv[o + 2];
      vertices.push(
        ox + rx * lx + nx * ly + fx * lz,
        oy + ry * lx + ny * ly + fy * lz,
        oz + rz * lx + nz * ly + fz * lz
      );
      colors.push(oc0, oc1, oc2);
    }
  } else {
    for (let i = 0; i < vCount; i++) {
      const o = i * 3;
      const lx = tv[o], ly = tv[o + 1], lz = tv[o + 2];
      vertices.push(
        ox + rx * lx + nx * ly + fx * lz,
        oy + ry * lx + ny * ly + fy * lz,
        oz + rz * lx + nz * ly + fz * lz
      );
      colors.push(tc[o], tc[o + 1], tc[o + 2]);
    }
  }

  // Flip triangle winding if basis (R, N, F) is left-handed so backface culling never hides faces
  const det =
    (r[1] * n[2] - r[2] * n[1]) * f[0] +
    (r[2] * n[0] - r[0] * n[2]) * f[1] +
    (r[0] * n[1] - r[1] * n[0]) * f[2];
  if (det < 0) {
    if (tpl.indsFlip) {
      const tif = tpl.indsFlip;
      for (let i = 0; i < tif.length; i++) {
        indices.push(vBase + tif[i]);
      }
    } else {
      for (let i = 0; i < ti.length; i += 3) {
        indices.push(vBase + ti[i], vBase + ti[i + 2], vBase + ti[i + 1]);
      }
    }
  } else {
    for (let i = 0; i < ti.length; i++) {
      indices.push(vBase + ti[i]);
    }
  }
}
window._emitCachedDropTemplate = _emitCachedDropTemplate;

window.DropTemplateCache = {
  cache: _groundDropTemplateCache,
  quantizeColor: function(col) {
    if (!col || col.length < 3) return "def";
    return `${Math.round(col[0] * 100)}_${Math.round(col[1] * 100)}_${Math.round(col[2] * 100)}`;
  },
  rotateBasis: function(r, f, angle) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    return {
      R: [r[0] * cosA + f[0] * sinA, r[1] * cosA + f[1] * sinA, r[2] * cosA + f[2] * sinA],
      F: [r[0] * -sinA + f[0] * cosA, r[1] * -sinA + f[1] * cosA, r[2] * -sinA + f[2] * cosA]
    };
  },
  basisFromF: function(fVec) {
    let fx = fVec ? fVec[0] : 0, fy = fVec ? fVec[1] : 0, fz = fVec ? fVec[2] : 1;
    const fLen = Math.hypot(fx, fy, fz) || 1;
    fx /= fLen; fy /= fLen; fz /= fLen;
    const refX = Math.abs(fy) < 0.9 ? 0 : 1;
    const refY = Math.abs(fy) < 0.9 ? 1 : 0;
    const refZ = 0;
    let rx = refY * fz - refZ * fy;
    let ry = refZ * fx - refX * fz;
    let rz = refX * fy - refY * fx;
    const rLen = Math.hypot(rx, ry, rz) || 1;
    rx /= rLen; ry /= rLen; rz /= rLen;
    const nx = fy * rz - fz * ry;
    const ny = fz * rx - fx * rz;
    const nz = fx * ry - fy * rx;
    return {
      R: [rx, ry, rz],
      N: [nx, ny, nz],
      F: [fx, fy, fz]
    };
  },
  bake: function(buildLocalFn) {
    const tv = [], tc = [], ti = [];
    buildLocalFn(tv, tc, ti);
    if (ti.length === 0) return null;
    const vCount = tv.length / 3;
    const IdxArr = vCount > 65535 ? Uint32Array : Uint16Array;
    const indsFlip = new IdxArr(ti.length);
    for (let i = 0; i < ti.length; i += 3) {
      indsFlip[i] = ti[i];
      indsFlip[i + 1] = ti[i + 2];
      indsFlip[i + 2] = ti[i + 1];
    }
    return {
      verts: new Float32Array(tv),
      cols: new Float32Array(tc),
      inds: new IdxArr(ti),
      indsFlip
    };
  },
  getOrBake: function(key, buildLocalFn) {
    if (_groundDropTemplateCache[key]) return _groundDropTemplateCache[key];
    const tpl = this.bake(buildLocalFn);
    if (tpl) {
      _groundDropTemplateCache[key] = tpl;
    }
    return tpl;
  },
  emit: _emitCachedDropTemplate,
  render: function(key, opts, buildLocalFn, vertices, colors, indices) {
    const tpl = this.getOrBake(key, buildLocalFn);
    if (!tpl) return false;
    _emitCachedDropTemplate(
      tpl,
      opts.position || [0, 0, 0],
      opts.R || [1, 0, 0],
      opts.normal || [0, 1, 0],
      opts.F || [0, 0, 1],
      (typeof opts.scale === "number") ? opts.scale : 1.0,
      (typeof opts.yOff === "number") ? opts.yOff : 0.0,
      vertices,
      colors,
      indices,
      opts.colorTransform
    );
    return true;
  },
  // Bake any full-scale placeable structure/furniture/vehicle/mech ONCE into a normalized
  // unit-bounding-box miniature template (X/Z centered at 0, bottom flush at Y = 0), then emit at meta.size.
  renderPlaceableDrop(item, meta, rawHandler, vertices, colors, indices) {
    if (!item || !meta || !rawHandler || typeof rawHandler.render !== "function") return false;
    const normType = String(item.type || "").toLowerCase();
    const key = `placeable_drop_v1_${normType}`;
    const tpl = this.getOrBake(key, (tv, tc, ti) => {
      const savedGlobals = {};
      const guarded = {
        getHeightOnSphere: () => 0,
        globalSeed: 12345,
        RADIUS: 0.0,
        HEIGHT_SCALE: 1.0,
        waterLevel: 0.0,
        waterEnabled: false,
        playerScale: 0.1,
        waterRadius: 10.0,
        collectibles: [],
        _spatialDoors: null,
        _spatialWindows: null,
        _spatialRoofs: null,
        _spatialFloors: null,
        floorPreviewCollectible: null
      };
      for (const k in guarded) {
        savedGlobals[k] = window[k];
        window[k] = guarded[k];
      }
      try {
        const mockItem = Object.assign({
          position: [0, 0, 0],
          R: [1, 0, 0],
          F: [0, 0, 1],
          normal: [0, 1, 0],
          size: typeof meta.mockSize === "number" ? meta.mockSize : 0.25,
          seed: 123.45,
          color: meta.color || [0.65, 0.45, 0.25],
          type: normType,
          isPreview: false,
          isValidPlacement: true,
          isGroundDrop: false,
          angle: 0
        }, meta.mockExtra || {});
        rawHandler.render(mockItem, tv, tc, ti, "preview");
      } finally {
        for (const k in savedGlobals) {
          if (savedGlobals[k] === undefined) {
            delete window[k];
          } else {
            window[k] = savedGlobals[k];
          }
        }
      }
      if (tv.length >= 3) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < tv.length; i += 3) {
          const x = tv[i], y = tv[i + 1], z = tv[i + 2];
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
        const cx = (minX + maxX) * 0.5;
        const cz = (minZ + maxZ) * 0.5;
        const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.0001);
        const inv = 1.0 / span;
        for (let i = 0; i < tv.length; i += 3) {
          tv[i]     = (tv[i]     - cx)   * inv;
          tv[i + 1] = (tv[i + 1] - minY) * inv;
          tv[i + 2] = (tv[i + 2] - cz)   * inv;
        }
      }
    });
    if (!tpl) return false;
    const p = item.position || [0, 0, 0];
    const r = item.R || [1, 0, 0];
    const n = item.normal || [0, 1, 0];
    const f = item.F || [0, 0, 1];
    const seed = (typeof item.seed === "number") ? item.seed : 0;
    const basis = this.rotateBasis(r, f, (seed * 6.28318) % (Math.PI * 2));
    const scale = (typeof item.size === "number" && item.size > 0 && item.size <= 0.12) ? item.size : meta.size;
    _emitCachedDropTemplate(
      tpl,
      p,
      basis.R,
      n,
      basis.F,
      scale,
      0.03,
      vertices,
      colors,
      indices,
      null
    );
    return true;
  }
};

// Initialize ItemRegistry
window.ItemRegistry = window.ItemRegistry || window.ITEM_DEFINITIONS || {};

// Register "cotton_plant" item 3D renderer (explicit DropTemplateCache)
window.ItemRegistry["cotton_plant"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    if (typeof window.buildCottonPlant !== "function") return;
    const isIcon = (targetBuffer === "preview" || !!(item && item.isIconPreview));
    const isDropped = !isIcon && !!(item && (item.isGroundDrop || item.isPlayerDropped));
    const p = item.position || [0, 0, 0];
    const n = item.normal || [0, 1, 0];
    const r = item.R || [1, 0, 0];
    const f = item.F || [0, 0, 1];
    const seed = typeof item.seed === "number" ? item.seed : 123.45;
    const bucket = Math.abs(Math.floor(seed * 7.13)) % 8;
    const key = `cotton_plant_${isIcon ? "icon" : "world"}_v${bucket}`;
    const basis = isDropped ? window.DropTemplateCache.rotateBasis(r, f, (seed * 6.28318) % (Math.PI * 2)) : { R: r, F: f };
    const scale = isDropped ? 0.46 : 1.0;
    const yOff = isDropped ? 0.004 : 0.0;

    window.DropTemplateCache.render(
      key,
      { position: p, R: basis.R, normal: n, F: basis.F, scale: scale, yOff: yOff },
      (tv, tc, ti) => {
        const prevDisable = window._disableTreeColorEncoding;
        if (isIcon) {
          window._disableTreeColorEncoding = true;
        }
        try {
          window.buildCottonPlant(
            0, 0, 0,
            0, 1, 0,
            [1, 0, 0], [0, 0, 1], [0, 1, 0],
            seed,
            tv, tc, ti,
            isIcon
          );
        } finally {
          window._disableTreeColorEncoding = prevDisable;
        }
      },
      vertices, colors, indices
    );
  }
};
window.ItemRegistry["COTTON_PLANT"] = window.ItemRegistry["cotton_plant"];

// Register "crown_flower" item 3D renderer (explicit DropTemplateCache)
window.ItemRegistry["crown_flower"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    if (typeof window.buildCrownFlowerPlant !== "function") return;
    const isIcon = (targetBuffer === "preview" || !!(item && item.isIconPreview));
    const isDropped = !isIcon && !!(item && (item.isGroundDrop || item.isPlayerDropped));
    const p = item.position || [0, 0, 0];
    const n = item.normal || [0, 1, 0];
    const r = item.R || [1, 0, 0];
    const f = item.F || [0, 0, 1];
    const seed = typeof item.seed === "number" ? item.seed : 123.45;
    const bucket = Math.abs(Math.floor(seed * 7.13)) % 8;
    const key = `crown_flower_${isIcon ? "icon" : "world"}_v${bucket}`;
    const basis = isDropped ? window.DropTemplateCache.rotateBasis(r, f, (seed * 6.28318) % (Math.PI * 2)) : { R: r, F: f };
    const scale = isDropped ? 0.38 : 1.0;
    const yOff = isDropped ? 0.004 : 0.0;

    window.DropTemplateCache.render(
      key,
      { position: p, R: basis.R, normal: n, F: basis.F, scale: scale, yOff: yOff },
      (tv, tc, ti) => {
        const prevDisable = window._disableTreeColorEncoding;
        if (isIcon) {
          window._disableTreeColorEncoding = true;
        }
        try {
          window.buildCrownFlowerPlant(
            0, 0, 0,
            0, 1, 0,
            [1, 0, 0], [0, 0, 1], [0, 1, 0],
            seed,
            tv, tc, ti,
            isIcon
          );
        } finally {
          window._disableTreeColorEncoding = prevDisable;
        }
      },
      vertices, colors, indices
    );
  }
};
window.ItemRegistry["CROWN_FLOWER"] = window.ItemRegistry["crown_flower"];

// Build a single 3D grass blade model (explicit DropTemplateCache for both icon & world blade variants)
window.buildGrassBladeModel = function(item, vertices, colors, indices, targetBuffer) {
  const isIcon = (targetBuffer === "preview" || !!(item && item.isIconPreview));
  const p = (item && item.position) ? item.position : [0, 0, 0];
  const r = (item && item.R) ? item.R : [1, 0, 0];
  const n = (item && item.normal) ? item.normal : [0, 1, 0];
  const f = (item && item.F) ? item.F : [0, 0, 1];

  const hasGreenColor = !!(item && item.color && item.color.length === 3 && item.color[1] > item.color[0]);
  const topColor = hasGreenColor ? item.color : [0.13, 0.65, 0.15];
  const botColor = (item && item.botColor && item.botColor.length === 3)
    ? item.botColor
    : [topColor[0] * 0.35, topColor[1] * 0.42, topColor[2] * 0.35];

  const colKey = window.DropTemplateCache.quantizeColor(topColor);

  if (isIcon) {
    window.DropTemplateCache.render(
      `grass_icon_${colKey}`,
      { position: p, R: r, normal: n, F: f, scale: 1.0, yOff: 0.0 },
      (tv, tc, ti) => {
        const gHeight = 0.145;
        const gWidth = 0.016;
        const curve = 0.35;
        tv.push(
          -gWidth, -gHeight * 0.5, 0.0,
           gWidth, -gHeight * 0.5, 0.0,
           gWidth * curve, gHeight * 0.5, 0.0
        );
        tc.push(
          botColor[0], botColor[1], botColor[2],
          botColor[0], botColor[1], botColor[2],
          topColor[0], topColor[1], topColor[2]
        );
        ti.push(0, 1, 2);
      },
      vertices, colors, indices
    );
    return;
  }

  const isDropped = !!(item && (item.isGroundDrop || item.isPlayerDropped));
  const gHeight = isDropped
    ? 0.060
    : ((item && typeof item.bladeHeight === "number") ? item.bladeHeight : 0.145);
  const gWidth = isDropped
    ? 0.022
    : ((item && typeof item.bladeWidth === "number") ? Math.max(0.013, item.bladeWidth) : 0.016);
  const curve = (item && typeof item.bladeCurve === "number") ? item.bladeCurve : 0.35;
  const hScale = gHeight / 0.145;
  const qCurve = Math.round(curve * 10) / 10;
  const qWidth = Math.round(gWidth * 1000) / 1000;
  const rotSeed = (item && typeof item.seed === "number") ? item.seed : 0;
  const basis = isDropped ? window.DropTemplateCache.rotateBasis(r, f, (rotSeed * 6.28318) % (Math.PI * 2)) : { R: r, F: f };

  window.DropTemplateCache.render(
    `grass_world_${colKey}_w${qWidth}_c${qCurve}${isDropped ? "_drop" : ""}`,
    { position: p, R: basis.R, normal: n, F: basis.F, scale: hScale, yOff: 0.0 },
    (tv, tc, ti) => {
      const lift = 0.005 / (hScale || 1);
      const liftTop = 0.011 / (hScale || 1);
      const baseH = 0.145;
      const zOff = isDropped ? -baseH * 0.5 : 0.0;
      tv.push(
         qWidth, lift, zOff,
        -qWidth, lift, zOff,
         qWidth * qCurve, liftTop, zOff + baseH,
         qWidth, lift, zOff,
         qWidth * qCurve, liftTop, zOff + baseH,
        -qWidth, lift, zOff
      );
      tc.push(
        -botColor[0] - 10.0, botColor[1], botColor[2],
        -botColor[0] - 10.0, botColor[1], botColor[2],
        -topColor[0] - 10.0, topColor[1], topColor[2],
        -botColor[0] - 10.0, botColor[1], botColor[2],
        -topColor[0] - 10.0, topColor[1], topColor[2],
        -botColor[0] - 10.0, botColor[1], botColor[2]
      );
      ti.push(0, 1, 2, 3, 4, 5);
    },
    vertices, colors, indices
  );
};

window.ItemRegistry["grass"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    window.buildGrassBladeModel(item, vertices, colors, indices, targetBuffer);
  }
};
window.ItemRegistry["GRASS"] = window.ItemRegistry["grass"];

// (tough_meat & leather are now registered in gamefile/items/tough_meat.js and gamefile/items/leather.js)

// Register "log" item 3D renderer (explicit DropTemplateCache)
window.ItemRegistry["log"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const isIcon = (targetBuffer === "preview" || !!(item && item.isIconPreview));
    const lColor = item.color || [0.50, 0.30, 0.15];
    const p = item.position || [0, 0, 0];
    const r = item.R || [1, 0, 0];
    const f = item.F || [0, 0, 1];
    const n = item.normal || [0, 1, 0];
    const s = (typeof item.size === "number") ? item.size : 0.085;
    const yOff = isIcon ? 0.0 : 0.25;

    if (item.seed === undefined) item.seed = Math.random();
    const rot = isIcon ? { R: r, F: f } : window.DropTemplateCache.rotateBasis(r, f, item.seed * Math.PI * 2);
    const key = `log_${window.DropTemplateCache.quantizeColor(lColor)}`;

    window.DropTemplateCache.render(
      key,
      { position: p, R: rot.R, normal: n, F: rot.F, scale: s, yOff: yOff },
      (tv, tc, ti) => {
        buildTaperedSegment(
          [-0.55, 0, 0],
          [ 0.55, 0, 0],
          0.28,
          0.252,
          6,
          lColor,
          tv,
          tc,
          ti,
          true
        );
      },
      vertices, colors, indices
    );
  }
};
window.ItemRegistry["LOG"] = window.ItemRegistry["log"];

// Register "planet_core" item 3D renderer
window.ItemRegistry["planet_core"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    buildLowPolySphere(
      item.position,
      item.radius,
      item.segs,
      item.color,
      item.noiseStrength,
      item.seed,
      vertices,
      colors,
      indices
    );
  }
};

function buildCollectibles(count, seed) {
        const _origRandom = Math.random;

        // 1) Find original tree and rock positions deterministically so chopping trees doesn't shift collectible generation
        const originalTrees = [];
        const originalRocks = [];
        const minLandHeight = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15) + 0.02;
        const totalNature = typeof currentNatureCount !== 'undefined' ? currentNatureCount : 80;
        for (let i = 0; i < totalNature; i++) {
          Math.random = mulberry32(seed + i * 11235);
          const u = Math.random();
          const v = Math.random();
          const theta = Math.acos(2 * u - 1);
          const phi = 2 * Math.PI * v;
          const height = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, seed) : getHeightOnSphere(theta, phi, seed);
          
          if (height >= minLandHeight) {
            const forestDensity = fbmNoise(
              Math.sin(theta) * Math.cos(phi) * 2.8,
              Math.cos(theta) * 2.8,
              Math.sin(theta) * Math.sin(phi) * 2.8,
              seed + 1234,
              3,
            );
            const nx = Math.sin(theta) * Math.cos(phi);
            const ny = Math.cos(theta);
            const nz = Math.sin(theta) * Math.sin(phi);
            const r = RADIUS + height * HEIGHT_SCALE;
            const wx = r * nx;
            const wy = r * ny;
            const wz = r * nz;

            if (isPositionInsideCave(wx, wy, wz, 0.25)) continue;
            
            if (forestDensity > -0.05) {
               originalTrees.push({ position: [wx, wy, wz], normal: [nx, ny, nz] });
            } else {
               originalRocks.push({ position: [wx, wy, wz], normal: [nx, ny, nz] });
            }
          }
        }

        collectibles = [];
        window.collectibles = collectibles;
        for (let i = 0; i < count; i++) {
          Math.random = mulberry32(seed + i * 24680); // Seed per iteration
          
          const type = Math.random() > 0.4 ? "branch" : "rock"; // More branches

          let theta, phi, height, r, nx, ny, nz, x, y, z;
          let rx, ry, rz, fx, fy, fz;

          if (type === "branch" && originalTrees.length > 0) {
            // Spawn near a deterministic random tree
            const treeIdx = Math.floor(Math.random() * originalTrees.length);
            const chosenTree = originalTrees[treeIdx];
            const tPos = chosenTree.position;
            const tNorm = chosenTree.normal;

            let txR, txY, txZ;
            if (Math.abs(tNorm[0]) < 0.9 && Math.abs(tNorm[2]) < 0.9) {
              txR = -tNorm[2]; txY = 0; txZ = tNorm[0];
            } else {
              txR = 1; txY = 0; txZ = 0;
            }
            const lenTxR = Math.sqrt(txR * txR + txY * txY + txZ * txZ) || 1;
            txR /= lenTxR; txY /= lenTxR; txZ /= lenTxR;

            const txFx = tNorm[1] * txZ - tNorm[2] * txY;
            const txFy = tNorm[2] * txR - tNorm[0] * txZ;
            const txFz = tNorm[0] * txY - tNorm[1] * txR;

            const dist = 0.04 + Math.random() * 0.15; // Spread around tree
            const angle = Math.random() * Math.PI * 2;

            const px = tPos[0] + (Math.cos(angle) * txR + Math.sin(angle) * txFx) * dist;
            const py = tPos[1] + (Math.cos(angle) * txY + Math.sin(angle) * txFy) * dist;
            const pz = tPos[2] + (Math.cos(angle) * txZ + Math.sin(angle) * txFz) * dist;

            const pDist = Math.sqrt(px*px + py*py + pz*pz) || 1;
            nx = px / pDist; ny = py / pDist; nz = pz / pDist;

            theta = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
            phi = Math.atan2(nz, nx);
            height = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, seed) : getHeightOnSphere(theta, phi, seed);
            r = RADIUS + height * HEIGHT_SCALE;

            x = r * nx; y = r * ny; z = r * nz;
          } else if (type === "rock" && originalRocks.length > 0 && Math.random() > 0.3) {
            // Spawn near a deterministic random rock
            const rockIdx = Math.floor(Math.random() * originalRocks.length);
            const chosenRock = originalRocks[rockIdx];
            const tPos = chosenRock.position;
            const tNorm = chosenRock.normal;

            let txR, txY, txZ;
            if (Math.abs(tNorm[0]) < 0.9 && Math.abs(tNorm[2]) < 0.9) {
              txR = -tNorm[2]; txY = 0; txZ = tNorm[0];
            } else {
              txR = 1; txY = 0; txZ = 0;
            }
            const lenTxR = Math.sqrt(txR * txR + txY * txY + txZ * txZ) || 1;
            txR /= lenTxR; txY /= lenTxR; txZ /= lenTxR;

            const txFx = tNorm[1] * txZ - tNorm[2] * txY;
            const txFy = tNorm[2] * txR - tNorm[0] * txZ;
            const txFz = tNorm[0] * txY - tNorm[1] * txR;

            const dist = 0.05 + Math.random() * 0.2; // Spread around rock
            const angle = Math.random() * Math.PI * 2;

            const px = tPos[0] + (Math.cos(angle) * txR + Math.sin(angle) * txFx) * dist;
            const py = tPos[1] + (Math.cos(angle) * txY + Math.sin(angle) * txFy) * dist;
            const pz = tPos[2] + (Math.cos(angle) * txZ + Math.sin(angle) * txFz) * dist;

            const pDist = Math.sqrt(px*px + py*py + pz*pz) || 1;
            nx = px / pDist; ny = py / pDist; nz = pz / pDist;

            theta = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
            phi = Math.atan2(nz, nx);
            height = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, seed) : getHeightOnSphere(theta, phi, seed);
            r = RADIUS + height * HEIGHT_SCALE;

            x = r * nx; y = r * ny; z = r * nz;
          } else {
            // Standard random spawn for rocks (or branches if no trees)
            theta = Math.random() * Math.PI;
            phi = Math.random() * Math.PI * 2;
            height = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, seed) : getHeightOnSphere(theta, phi, seed);
            
            if (type === "branch") {
              const minLandHeight = waterLevel * 0.15 + 0.05;
              if (height < minLandHeight) continue;
            }

            r = RADIUS + height * HEIGHT_SCALE;
            nx = Math.sin(theta) * Math.cos(phi);
            ny = Math.cos(theta);
            nz = Math.sin(theta) * Math.sin(phi);
            x = r * nx; y = r * ny; z = r * nz;
          }

          if (Math.abs(nx) < 0.9 && Math.abs(nz) < 0.9) {
            rx = -nz; ry = 0; rz = nx;
          } else {
            rx = 1; ry = 0; rz = 0;
          }
          const lenR = Math.sqrt(rx * rx + ry * ry + rz * rz);
          rx /= lenR; ry /= lenR; rz /= lenR;

          fx = ry * nz - rz * ny;
          fy = rz * nx - rx * nz;
          fz = rx * ny - ry * nx;

          const color = type === "rock"
              ? [ 0.4 + Math.random() * 0.1, 0.4 + Math.random() * 0.1, 0.4 + Math.random() * 0.1 ]
              : [ 0.4 + Math.random() * 0.1, 0.25 + Math.random() * 0.05, 0.15 ];

          let overlapCave = false;
          if (tunnels3D) {
            for (let t of tunnels3D) {
              if (t.isDug) continue;
              const dx = x - t.x;
              const dy = y - t.y;
              const dz = z - t.z;
              const checkR = t.r + 0.15;
              if (dx*dx + dy*dy + dz*dz < checkR * checkR) {
                overlapCave = true;
                break;
              }
            }
          }
          if (overlapCave) continue;

          collectibles.push({
            type: type,
            position: [x, y, z],
            normal: [nx, ny, nz],
            R: [rx, ry, rz],
            F: [fx, fy, fz],
            active: true,
            size: 0.015 + Math.random() * 0.02,
            seed: seed + i * 200,
            color: color,
          });
        }

        collectibles.push({
          type: "planet_core",
          position: [0, 0, 0],
          radius: 2.0,
          segs: 128,
          color: [0.0, 0.0, 0.0],
          noiseStrength: 0.0,
          seed: 123,
          active: true,
          isDynamic: false
        });
        const rBase = (typeof RADIUS !== 'undefined' ? RADIUS : 8.0);
        const numStoneFloors = Math.min(18, Math.max(4, Math.round(3 + Math.sqrt(rBase))));
        const placedHouses = [];
        const placedVillages = [];
        const natureObsList = (typeof window !== "undefined" && Array.isArray(window.allDeterministicNatureObstacles) && window.allDeterministicNatureObstacles.length > 0)
          ? window.allDeterministicNatureObstacles
          : ((typeof natureObstacles !== "undefined" && natureObstacles) ? natureObstacles : (typeof window !== "undefined" && window.natureObstacles ? window.natureObstacles : []));

        const minHouseLandHeight = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15) + 0.05;
        const sampleH_house = (th, ph) => (typeof getVisualHeightOnSphere === "function")
          ? getVisualHeightOnSphere(th, ph, seed)
          : getHeightOnSphere(th, ph, seed);

        // Temporary spatial hashes for O(1) obstacle/debris lookup during village & house placement
        const _genCellInv = 0.5; // 2.0m cells
        const _genNatureGrid = new Map();
        for (let oIdx = 0; oIdx < natureObsList.length; oIdx++) {
          const obs = natureObsList[oIdx];
          if (!obs || !obs.position) continue;
          const k = `${Math.floor(obs.position[0] * _genCellInv)},${Math.floor(obs.position[1] * _genCellInv)},${Math.floor(obs.position[2] * _genCellInv)}`;
          let bucket = _genNatureGrid.get(k);
          if (!bucket) { bucket = []; _genNatureGrid.set(k, bucket); }
          bucket.push(obs);
        }
        const _genDebrisGrid = new Map();
        const _genBlockingStructs = [];
        for (let cIdx = 0; cIdx < collectibles.length; cIdx++) {
          const c = collectibles[cIdx];
          if (!c || !c.active || !c.position) continue;
          if (c.type === "stone_floor" || c.type === "campfire") {
            _genBlockingStructs.push(c);
          } else if (c.type === "rock" || c.type === "big_rock" || c.type === "branch") {
            const k = `${Math.floor(c.position[0] * _genCellInv)},${Math.floor(c.position[1] * _genCellInv)},${Math.floor(c.position[2] * _genCellInv)}`;
            let bucket = _genDebrisGrid.get(k);
            if (!bucket) { bucket = []; _genDebrisGrid.set(k, bucket); }
            bucket.push(c);
          }
        }
        let _clearedNatureDirtyMin = Infinity;
        let _clearedNatureDirtyMax = -1;
        const _flushClearedNatureBuffer = () => {
          if (_clearedNatureDirtyMax <= _clearedNatureDirtyMin) return;
          const rawVerts = (typeof natureRawVertices !== "undefined") ? natureRawVertices : window.natureRawVertices;
          const vBuffer = (typeof natureVertexBuffer !== "undefined") ? natureVertexBuffer : window.natureVertexBuffer;
          if (rawVerts && typeof gl !== "undefined" && gl && vBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
            const slice = (rawVerts instanceof Float32Array)
              ? rawVerts.subarray(_clearedNatureDirtyMin, _clearedNatureDirtyMax)
              : new Float32Array(rawVerts.slice(_clearedNatureDirtyMin, _clearedNatureDirtyMax));
            gl.bufferSubData(gl.ARRAY_BUFFER, _clearedNatureDirtyMin * 4, slice);
          }
          _clearedNatureDirtyMin = Infinity;
          _clearedNatureDirtyMax = -1;
        };

        // Reusable helper: clear rocks, branches, and natural trees/rocks within a radius
        const clearAreaAround = (cx, cy, cz, clearRad) => {
          const clearRadSq = clearRad * clearRad;
          const minCx = Math.floor((cx - clearRad) * _genCellInv);
          const maxCx = Math.floor((cx + clearRad) * _genCellInv);
          const minCy = Math.floor((cy - clearRad) * _genCellInv);
          const maxCy = Math.floor((cy + clearRad) * _genCellInv);
          const minCz = Math.floor((cz - clearRad) * _genCellInv);
          const maxCz = Math.floor((cz + clearRad) * _genCellInv);
          const rawVerts = (typeof natureRawVertices !== "undefined") ? natureRawVertices : window.natureRawVertices;

          for (let gx = minCx; gx <= maxCx; gx++) {
            for (let gy = minCy; gy <= maxCy; gy++) {
              for (let gz = minCz; gz <= maxCz; gz++) {
                const key = `${gx},${gy},${gz}`;
                const dBucket = _genDebrisGrid.get(key);
                if (dBucket) {
                  for (let bi = 0; bi < dBucket.length; bi++) {
                    const c = dBucket[bi];
                    if (!c || !c.active || c.isHouse || c.isProceduralHouse || c.isVillageCampfire || !c.position) continue;
                    const cdx = c.position[0] - cx;
                    const cdy = c.position[1] - cy;
                    const cdz = c.position[2] - cz;
                    if (cdx*cdx + cdy*cdy + cdz*cdz <= clearRadSq) {
                      c.active = false;
                    }
                  }
                }
                const nBucket = _genNatureGrid.get(key);
                if (nBucket) {
                  for (let ni = 0; ni < nBucket.length; ni++) {
                    const obs = nBucket[ni];
                    if (!obs || !obs.position || obs._genCleared) continue;
                    const odx = obs.position[0] - cx;
                    const ody = obs.position[1] - cy;
                    const odz = obs.position[2] - cz;
                    if (odx*odx + ody*ody + odz*odz <= clearRadSq) {
                      obs._genCleared = true;
                      if (obs.type === "tree") {
                        if (typeof choppedTrees !== "undefined" && !choppedTrees.includes(obs.id)) choppedTrees.push(obs.id);
                        else if (window.choppedTrees && !window.choppedTrees.includes(obs.id)) window.choppedTrees.push(obs.id);
                      } else {
                        if (typeof destroyedRocks !== "undefined" && !destroyedRocks.includes(obs.id)) destroyedRocks.push(obs.id);
                        else if (window.destroyedRocks && !window.destroyedRocks.includes(obs.id)) window.destroyedRocks.push(obs.id);
                      }
                      if (obs.meshStart !== undefined && obs.meshEnd !== undefined && rawVerts) {
                        const startF = obs.meshStart * 3;
                        const endF = obs.meshEnd * 3;
                        for (let j = startF; j < endF; j++) rawVerts[j] = 0;
                        if (startF < _clearedNatureDirtyMin) _clearedNatureDirtyMin = startF;
                        if (endF > _clearedNatureDirtyMax) _clearedNatureDirtyMax = endF;
                      }
                    }
                  }
                }
              }
            }
          }
        };

        // Reusable helper: validate a flat, cave-free, obstacle-free house footprint (reused by Village & Standalone Houses)
        const validateHouseSpot = (theta, phi, halfW, halfD, houseRadius, existingHouses, opts = {}) => {
          const h = sampleH_house(theta, phi);
          if (h < minHouseLandHeight) return null;

          const candNx = Math.sin(theta) * Math.cos(phi);
          const candNy = Math.cos(theta);
          const candNz = Math.sin(theta) * Math.sin(phi);
          const r = RADIUS + h * HEIGHT_SCALE;
          const candWx = r * candNx;
          const candWy = r * candNy;
          const candWz = r * candNz;

          let candR, candF;
          if (opts.customFDir) {
            // Project desired forward vector (e.g. facing toward village campfire) onto tangent plane
            const fDotN = opts.customFDir[0] * candNx + opts.customFDir[1] * candNy + opts.customFDir[2] * candNz;
            let fx = opts.customFDir[0] - candNx * fDotN;
            let fy = opts.customFDir[1] - candNy * fDotN;
            let fz = opts.customFDir[2] - candNz * fDotN;
            const fLen = Math.hypot(fx, fy, fz);
            if (fLen > 1e-5) {
              candF = [fx / fLen, fy / fLen, fz / fLen];
              // R = F x N so that N x R = F (right-handed basis matching existing house frame)
              let rx = candF[1] * candNz - candF[2] * candNy;
              let ry = candF[2] * candNx - candF[0] * candNz;
              let rz = candF[0] * candNy - candF[1] * candNx;
              const rLen = Math.hypot(rx, ry, rz) || 1;
              candR = [rx / rLen, ry / rLen, rz / rLen];
            }
          }
          if (!candR || !candF) {
            let txR, txY, txZ;
            if (Math.abs(candNy) < 0.9) {
              txR = -candNz; txY = 0; txZ = candNx;
            } else {
              txR = 1; txY = 0; txZ = 0;
            }
            const lenTxR = Math.sqrt(txR * txR + txY * txY + txZ * txZ) || 1;
            candR = [txR / lenTxR, txY / lenTxR, txZ / lenTxR];
            candF = [
              candNy * candR[2] - candNz * candR[1],
              candNz * candR[0] - candNx * candR[2],
              candNx * candR[1] - candNy * candR[0]
            ];
            const lenF = Math.sqrt(candF[0]*candF[0] + candF[1]*candF[1] + candF[2]*candF[2]) || 1;
            candF[0] /= lenF; candF[1] /= lenF; candF[2] /= lenF;
          }

          const minHouseGap = (typeof opts.minHouseGap === "number") ? opts.minHouseGap : 1.2;
          const maxDev = (typeof opts.maxDev === "number") ? opts.maxDev : 0.016;
          const maxDelta = (typeof opts.maxDelta === "number") ? opts.maxDelta : 0.022;
          const maxSlope = (typeof opts.maxSlope === "number") ? opts.maxSlope : 0.08;
          const minDotUp = (typeof opts.minDotUp === "number") ? opts.minDotUp : 0.994;

          // 1. Check distance to already placed/candidate houses
          for (let ph = 0; ph < existingHouses.length; ph++) {
            const prevH = existingHouses[ph];
            const pdx = candWx - prevH.x;
            const pdy = candWy - prevH.y;
            const pdz = candWz - prevH.z;
            const minAllowedDist = houseRadius + prevH.radius + minHouseGap;
            if (pdx*pdx + pdy*pdy + pdz*pdz < minAllowedDist * minAllowedDist) {
              return null;
            }
          }

          // Optional campfire / plaza center clearance
          if (opts.avoidCenter && typeof opts.avoidCenterRad === "number") {
            const adx = candWx - opts.avoidCenter[0];
            const ady = candWy - opts.avoidCenter[1];
            const adz = candWz - opts.avoidCenter[2];
            const minCenDist = houseRadius + opts.avoidCenterRad;
            if (adx*adx + ady*ady + adz*adz < minCenDist * minCenDist) {
              return null;
            }
          }

          // 2. Check HOLES: Cave tunnels, openings, pits ("หลุม")
          const tunnels = (typeof window !== "undefined" && window.tunnels3D) ? window.tunnels3D : (typeof tunnels3D !== "undefined" ? tunnels3D : []);
          if (tunnels && tunnels.length > 0) {
            const maxCaveClearance = houseRadius + 0.65;
            for (let tIdx = 0; tIdx < tunnels.length; tIdx++) {
              const tun = tunnels[tIdx];
              if (tun.isDug) continue;
              const tdx = candWx - tun.x;
              const tdy = candWy - tun.y;
              const tdz = candWz - tun.z;
              const safeDist = tun.r + maxCaveClearance;
              if (tdx*tdx + tdy*tdy + tdz*tdz < safeDist * safeDist) {
                return null;
              }
            }
          }

          const sampleOffsets = [
            [0, 0],
            [-halfW, -halfD],
            [halfW, -halfD],
            [-halfW, halfD],
            [halfW, halfD],
            [0, -halfD],
            [0, halfD],
            [-halfW, 0],
            [halfW, 0]
          ];

          if (typeof isPositionInsideCave === "function") {
            for (let sIdx = 0; sIdx < sampleOffsets.length; sIdx++) {
              const [sx, sy] = sampleOffsets[sIdx];
              const spX = candWx + candR[0]*sx + candF[0]*sy;
              const spY = candWy + candR[1]*sx + candF[1]*sy;
              const spZ = candWz + candR[2]*sx + candF[2]*sy;
              if (isPositionInsideCave(spX, spY, spZ, 0.45)) {
                return null;
              }
            }
          }

          // C) Check terrain surface flatness
          let minH = h;
          let maxH = h;
          for (let sIdx = 0; sIdx < sampleOffsets.length; sIdx++) {
            const [sx, sy] = sampleOffsets[sIdx];
            const spX = candWx + candR[0]*(sx * 1.15) + candF[0]*(sy * 1.15);
            const spY = candWy + candR[1]*(sx * 1.15) + candF[1]*(sy * 1.15);
            const spZ = candWz + candR[2]*(sx * 1.15) + candF[2]*(sy * 1.15);
            const cDist = Math.sqrt(spX*spX + spY*spY + spZ*spZ) || 1;
            const cTheta = Math.acos(Math.max(-1.0, Math.min(1.0, spY / cDist)));
            const cPhi = Math.atan2(spZ, spX);
            const cH = sampleH_house(cTheta, cPhi);

            if (cH < minHouseLandHeight) return null;
            if (cH < minH) minH = cH;
            if (cH > maxH) maxH = cH;
            if (Math.abs(cH - h) > maxDev) return null;
          }
          if ((maxH - minH) > maxDelta) return null;

          // D) True local terrain normal (ป้องกันบ้านสุ่มเอียง)
          const deltaProbe = 0.15;
          const probeRx = candWx + candR[0] * deltaProbe;
          const probeRy = candWy + candR[1] * deltaProbe;
          const probeRz = candWz + candR[2] * deltaProbe;
          const distPrR = Math.sqrt(probeRx*probeRx + probeRy*probeRy + probeRz*probeRz) || 1;
          const hProbeR = sampleH_house(Math.acos(Math.max(-1.0, Math.min(1.0, probeRy / distPrR))), Math.atan2(probeRz, probeRx));

          const probeFx = candWx + candF[0] * deltaProbe;
          const probeFy = candWy + candF[1] * deltaProbe;
          const probeFz = candWz + candF[2] * deltaProbe;
          const distPrF = Math.sqrt(probeFx*probeFx + probeFy*probeFy + probeFz*probeFz) || 1;
          const hProbeF = sampleH_house(Math.acos(Math.max(-1.0, Math.min(1.0, probeFy / distPrF))), Math.atan2(probeFz, probeFx));

          const slopeR = ((hProbeR - h) * HEIGHT_SCALE) / deltaProbe;
          const slopeF = ((hProbeF - h) * HEIGHT_SCALE) / deltaProbe;
          if (Math.abs(slopeR) > maxSlope || Math.abs(slopeF) > maxSlope) return null;

          let terrNx = candNx - candR[0] * slopeR - candF[0] * slopeF;
          let terrNy = candNy - candR[1] * slopeR - candF[1] * slopeF;
          let terrNz = candNz - candR[2] * slopeR - candF[2] * slopeF;
          const lenTerrN = Math.sqrt(terrNx*terrNx + terrNy*terrNy + terrNz*terrNz) || 1;
          terrNx /= lenTerrN; terrNy /= lenTerrN; terrNz /= lenTerrN;

          const dotUp = terrNx * candNx + terrNy * candNy + terrNz * candNz;
          if (dotUp < minDotUp) return null;

          let adjR = [
            candR[0] - terrNx * (candR[0]*terrNx + candR[1]*terrNy + candR[2]*terrNz),
            candR[1] - terrNy * (candR[0]*terrNx + candR[1]*terrNy + candR[2]*terrNz),
            candR[2] - terrNz * (candR[0]*terrNx + candR[1]*terrNy + candR[2]*terrNz)
          ];
          const lenAdjR = Math.sqrt(adjR[0]*adjR[0] + adjR[1]*adjR[1] + adjR[2]*adjR[2]) || 1;
          adjR[0] /= lenAdjR; adjR[1] /= lenAdjR; adjR[2] /= lenAdjR;

          let adjF = [
            terrNy * adjR[2] - terrNz * adjR[1],
            terrNz * adjR[0] - terrNx * adjR[2],
            terrNx * adjR[1] - terrNy * adjR[0]
          ];
          const lenAdjF = Math.sqrt(adjF[0]*adjF[0] + adjF[1]*adjF[1] + adjF[2]*adjF[2]) || 1;
          adjF[0] /= lenAdjF; adjF[1] /= lenAdjF; adjF[2] /= lenAdjF;

          // 3. Check TREES & ROCKS in natureObstacles via spatial hash (optional skip for village plaza fallback since clearAreaAround clears them)
          if (!opts.allowClearNature) {
            const treeClearance = 0.55;
            const rockClearance = 0.45;
            const searchR = houseRadius + 1.25;
            const searchRSq = (houseRadius + 3.0) * (houseRadius + 3.0);
            const minNx = Math.floor((candWx - searchR) * _genCellInv);
            const maxNx = Math.floor((candWx + searchR) * _genCellInv);
            const minNy = Math.floor((candWy - searchR) * _genCellInv);
            const maxNy = Math.floor((candWy + searchR) * _genCellInv);
            const minNz = Math.floor((candWz - searchR) * _genCellInv);
            const maxNz = Math.floor((candWz + searchR) * _genCellInv);
            for (let gx = minNx; gx <= maxNx; gx++) {
              for (let gy = minNy; gy <= maxNy; gy++) {
                for (let gz = minNz; gz <= maxNz; gz++) {
                  const nBucket = _genNatureGrid.get(`${gx},${gy},${gz}`);
                  if (!nBucket) continue;
                  for (let oIdx = 0; oIdx < nBucket.length; oIdx++) {
                    const obs = nBucket[oIdx];
                    if (!obs || !obs.position || obs._genCleared) continue;
                    const odx = obs.position[0] - candWx;
                    const ody = obs.position[1] - candWy;
                    const odz = obs.position[2] - candWz;
                    const distSq = odx*odx + ody*ody + odz*odz;
                    if (distSq > searchRSq) continue;

                    const localR = odx * candR[0] + ody * candR[1] + odz * candR[2];
                    const localF = odx * candF[0] + ody * candF[1] + odz * candF[2];
                    const localN = odx * candNx + ody * candNy + odz * candNz;
                    if (Math.abs(localN) > 2.5) continue;

                    const isTree = (obs.type === "tree" || (typeof COLLISION_LAYERS !== "undefined" && obs.layer === COLLISION_LAYERS.TREE));
                    const isRock = (obs.type === "rock" || obs.type === "big_rock" || obs.type === "iron_ore" || obs.type === "gold_ore" || obs.type === "glow_ore" || obs.type === "copper_ore" || obs.type === "coal_ore" || (typeof COLLISION_LAYERS !== "undefined" && obs.layer === COLLISION_LAYERS.ROCK));
                    if (isTree) {
                      const rad = obs.trunkBaseRadius ? Math.max(0.2, obs.trunkBaseRadius) : 0.25;
                      if (Math.abs(localR) < halfW + treeClearance + rad && Math.abs(localF) < halfD + treeClearance + rad) return null;
                    } else if (isRock) {
                      const rad = obs.radius ? Math.min(0.5, obs.radius * 0.5) : 0.25;
                      if (Math.abs(localR) < halfW + rockClearance + rad && Math.abs(localF) < halfD + rockClearance + rad) return null;
                    }
                  }
                }
              }
            }
          }

          // 4. Check existing collectibles (stone_floor / campfire always avoided; rocks/branches checked via spatial hash)
          for (let sIdx = 0; sIdx < _genBlockingStructs.length; sIdx++) {
            const c = _genBlockingStructs[sIdx];
            if (!c.active || !c.position) continue;
            const cdx = c.position[0] - candWx;
            const cdy = c.position[1] - candWy;
            const cdz = c.position[2] - candWz;
            const pad = (c.type === "campfire") ? 0.85 : 0.45;
            if (cdx*cdx + cdy*cdy + cdz*cdz < (houseRadius + pad) * (houseRadius + pad)) {
              return null;
            }
          }
          if (!opts.allowClearNature) {
            const debSearchR = houseRadius + 0.50;
            const debPadSq = (houseRadius + 0.45) * (houseRadius + 0.45);
            const minDx = Math.floor((candWx - debSearchR) * _genCellInv);
            const maxDx = Math.floor((candWx + debSearchR) * _genCellInv);
            const minDy = Math.floor((candWy - debSearchR) * _genCellInv);
            const maxDy = Math.floor((candWy + debSearchR) * _genCellInv);
            const minDz = Math.floor((candWz - debSearchR) * _genCellInv);
            const maxDz = Math.floor((candWz + debSearchR) * _genCellInv);
            for (let gx = minDx; gx <= maxDx; gx++) {
              for (let gy = minDy; gy <= maxDy; gy++) {
                for (let gz = minDz; gz <= maxDz; gz++) {
                  const dBucket = _genDebrisGrid.get(`${gx},${gy},${gz}`);
                  if (!dBucket) continue;
                  for (let bi = 0; bi < dBucket.length; bi++) {
                    const c = dBucket[bi];
                    if (!c.active || !c.position) continue;
                    const cdx = c.position[0] - candWx;
                    const cdy = c.position[1] - candWy;
                    const cdz = c.position[2] - candWz;
                    if (cdx*cdx + cdy*cdy + cdz*cdz < debPadSq) {
                      return null;
                    }
                  }
                }
              }
            }
          }

          return {
            x: candWx, y: candWy, z: candWz,
            nx: terrNx, ny: terrNy, nz: terrNz,
            R: adjR, F: adjF,
            radius: houseRadius
          };
        };

        // Reusable helper: build a complete or ruined procedural house at a validated spot
        const buildProceduralHouseAt = (spot, spec) => {
          const {
            i, gridX, gridY, wfSize, wfW, totalW, totalD, houseRadius,
            isPerfect, isHeavilyRuined, villageIndex = -1, preferredDoorSide = null
          } = spec;
          const wx = spot.x, wy = spot.y, wz = spot.z;
          const nx = spot.nx, ny = spot.ny, nz = spot.nz;
          const R = spot.R, F = spot.F;

          placedHouses.push({
            x: wx,
            y: wy,
            z: wz,
            nx: nx,
            ny: ny,
            nz: nz,
            R: R,
            F: F,
            radius: houseRadius,
            totalW: totalW,
            totalD: totalD,
            gridX: gridX,
            gridY: gridY,
            wfW: wfW,
            entranceDoor: null,
            villageIndex: villageIndex,
            isVillageHouse: villageIndex >= 0
          });

          // Extra safety clearance for surrounding border
          clearAreaAround(wx, wy, wz, Math.max(totalW, totalD) * 0.65);

          const stoneFoundationItem = {
            type: "stone_floor",
            position: [wx, wy, wz],
            normal: [nx, ny, nz],
            R: R,
            F: F,
            active: true,
            size: 0.25,
            width: totalW,
            depth: totalD,
            angle: 0.0,
            seed: seed + i * 5000,
            isHouse: true,
            isProceduralHouse: true,
            villageIndex: villageIndex,
            hideFromCompass: true
          };
          collectibles.push(stoneFoundationItem);
          _genBlockingStructs.push(stoneFoundationItem);

          const stoneH = wfSize * 0.15;
          const baseWfH = (typeof woodFloorHeight === "number") ? woodFloorHeight : ((typeof window !== "undefined" && typeof window.woodFloorHeight === "number") ? window.woodFloorHeight : 0.05);
          const actualWfThickness = baseWfH + wfSize * 0.12;
          
          const floorCenterHeight = stoneH + actualWfThickness / 2;
          const wallBaseHeight = stoneH + actualWfThickness;
          
          const roofStyle = Math.random() > 0.3 ? "gable" : "flat";
          const roofAxis = Math.random() > 0.5 ? "X" : "Y";
          
          const missingWallProb = isPerfect ? 0 : (isHeavilyRuined ? 0.62 : 0.35);
          const missingRoofProb = isPerfect ? 0 : (isHeavilyRuined ? 0.85 : 0.55);
          const missingFloorProb = isPerfect ? 0 : (isHeavilyRuined ? 0.32 : 0.12);
          
          const cells = [];
          for (let gx = 0; gx < gridX; gx++) {
            cells[gx] = [];
            for (let gy = 0; gy < gridY; gy++) {
              const hasFloor = Math.random() >= missingFloorProb;
              cells[gx][gy] = {
                hasFloor: hasFloor,
                // CRITICAL: Walls and roofs can ONLY exist on a cell that has a floor! No mid-air floating structures!
                hasRoof: hasFloor && (Math.random() >= missingRoofProb),
                wallLeft: (hasFloor && gx === 0) ? (Math.random() >= missingWallProb) : false,
                wallRight: (hasFloor && gx === gridX - 1) ? (Math.random() >= missingWallProb) : false,
                wallBottom: (hasFloor && gy === 0) ? (Math.random() >= missingWallProb) : false,
                wallTop: (hasFloor && gy === gridY - 1) ? (Math.random() >= missingWallProb) : false
              };
            }
          }

          // Ensure ruined houses always remain recognizable (at least 2 floors & 1 wall) and visibly damaged
          if (!isPerfect) {
            let floorCount = 0;
            let wallCount = 0;
            let missingParts = 0;
            const totalCells = gridX * gridY;
            for (let gx = 0; gx < gridX; gx++) {
              for (let gy = 0; gy < gridY; gy++) {
                const c = cells[gx][gy];
                if (c.hasFloor) floorCount++; else missingParts++;
                if (!c.hasRoof) missingParts++;
                if (gx === 0) { if (c.wallLeft) wallCount++; else missingParts++; }
                if (gx === gridX - 1) { if (c.wallRight) wallCount++; else missingParts++; }
                if (gy === 0) { if (c.wallBottom) wallCount++; else missingParts++; }
                if (gy === gridY - 1) { if (c.wallTop) wallCount++; else missingParts++; }
              }
            }
            // Keep at least 2 wooden floor tiles on the foundation
            const minFloors = Math.min(2, totalCells);
            for (let gx = 0; gx < gridX && floorCount < minFloors; gx++) {
              for (let gy = 0; gy < gridY && floorCount < minFloors; gy++) {
                if (!cells[gx][gy].hasFloor) {
                  cells[gx][gy].hasFloor = true;
                  floorCount++;
                }
              }
            }
            // Keep at least 1 perimeter wall remnant so it clearly reads as a ruined house
            if (wallCount === 0) {
              outerWallRestore:
              for (let gx = 0; gx < gridX; gx++) {
                for (let gy = 0; gy < gridY; gy++) {
                  const c = cells[gx][gy];
                  if (!c.hasFloor) continue;
                  if (gx === 0) { c.wallLeft = true; wallCount++; break outerWallRestore; }
                  if (gx === gridX - 1) { c.wallRight = true; wallCount++; break outerWallRestore; }
                  if (gy === 0) { c.wallBottom = true; wallCount++; break outerWallRestore; }
                  if (gy === gridY - 1) { c.wallTop = true; wallCount++; break outerWallRestore; }
                }
              }
            }
            // Guarantee at least one visible break (remove a corner roof + wall if RNG rolled intact)
            if (missingParts === 0) {
              cells[0][0].hasRoof = false;
              cells[0][0].wallLeft = false;
            }
          }

          // Enforce structural support rule: A roof must be supported by its perimeter wall (no floating roofs)
          for (let gx = 0; gx < gridX; gx++) {
            for (let gy = 0; gy < gridY; gy++) {
              const c = cells[gx][gy];
              if (c.hasRoof) {
                if (!c.hasFloor) { c.hasRoof = false; continue; }
                if (gx === 0 && !c.wallLeft) c.hasRoof = false;
                if (gx === gridX - 1 && !c.wallRight) c.hasRoof = false;
                if (gy === 0 && !c.wallBottom) c.hasRoof = false;
                if (gy === gridY - 1 && !c.wallTop) c.hasRoof = false;
              }
            }
          }

          // Enforce interior roof support (prevents floating gable peaks or disconnected interior flat roofs)
          if (roofStyle === "gable") {
            let changed = true;
            while (changed) {
              changed = false;
              for (let gx = 0; gx < gridX; gx++) {
                for (let gy = 0; gy < gridY; gy++) {
                  const c = cells[gx][gy];
                  if (!c.hasRoof) continue;
                  if (roofAxis === "X" && gx > 0 && gx < gridX - 1) {
                    if (!cells[gx - 1][gy].hasRoof || !cells[gx + 1][gy].hasRoof) {
                      c.hasRoof = false;
                      changed = true;
                    }
                  } else if (roofAxis === "Y" && gy > 0 && gy < gridY - 1) {
                    if (!cells[gx][gy - 1].hasRoof || !cells[gx][gy + 1].hasRoof) {
                      c.hasRoof = false;
                      changed = true;
                    }
                  }
                }
              }
            }
          } else {
            // Flat roof: interior roof tiles must connect via orthogonal roof neighbors to a wall-supported perimeter roof
            const supported = Array.from({ length: gridX }, () => Array(gridY).fill(false));
            const queue = [];
            for (let gx = 0; gx < gridX; gx++) {
              for (let gy = 0; gy < gridY; gy++) {
                const c = cells[gx][gy];
                if (!c.hasRoof) continue;
                const isPerimeter = (gx === 0 || gx === gridX - 1 || gy === 0 || gy === gridY - 1);
                if (isPerimeter) {
                  supported[gx][gy] = true;
                  queue.push([gx, gy]);
                }
              }
            }
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (let qi = 0; qi < queue.length; qi++) {
              const [cx, cy] = queue[qi];
              for (let d = 0; d < dirs.length; d++) {
                const nx2 = cx + dirs[d][0];
                const ny2 = cy + dirs[d][1];
                if (nx2 >= 0 && nx2 < gridX && ny2 >= 0 && ny2 < gridY && cells[nx2][ny2].hasRoof && !supported[nx2][ny2]) {
                  supported[nx2][ny2] = true;
                  queue.push([nx2, ny2]);
                }
              }
            }
            for (let gx = 0; gx < gridX; gx++) {
              for (let gy = 0; gy < gridY; gy++) {
                if (cells[gx][gy].hasRoof && !supported[gx][gy]) {
                  cells[gx][gy].hasRoof = false;
                }
              }
            }
          }

          // Choose at most ONE entrance door candidate for the entire house
          const doorCandidates = [];
          for (let gx = 0; gx < gridX; gx++) {
            for (let gy = 0; gy < gridY; gy++) {
              const c = cells[gx][gy];
              if (!c.hasFloor) continue;
              if (c.wallBottom && gy === 0) doorCandidates.push({ gx, gy, side: "bottom" });
              if (c.wallTop && gy === gridY - 1) doorCandidates.push({ gx, gy, side: "top" });
              if (c.wallLeft && gx === 0) doorCandidates.push({ gx, gy, side: "left" });
              if (c.wallRight && gx === gridX - 1) doorCandidates.push({ gx, gy, side: "right" });
            }
          }

          let entranceDoor = null;
          if (doorCandidates.length > 0 && (isPerfect || Math.random() < 0.75)) {
            if (preferredDoorSide) {
              const preferred = doorCandidates.filter(dc => dc.side === preferredDoorSide);
              if (preferred.length > 0) {
                entranceDoor = preferred[Math.floor(Math.random() * preferred.length)];
              }
            }
            if (!entranceDoor) {
              entranceDoor = doorCandidates[Math.floor(Math.random() * doorCandidates.length)];
            }
          }
          if (placedHouses.length > 0) {
            const lastHouse = placedHouses[placedHouses.length - 1];
            lastHouse.entranceDoor = entranceDoor;
            lastHouse.isRuined = !isPerfect;
            lastHouse.ruinLevel = isPerfect ? 0 : (isHeavilyRuined ? 2 : 1);
          }
          
          for (let gx = 0; gx < gridX; gx++) {
            for (let gy = 0; gy < gridY; gy++) {
               const c = cells[gx][gy];
               const cx = -totalW/2 + wfW/2 + gx * wfW;
               const cy = -totalD/2 + wfW/2 + gy * wfW;
               
               const localPos = [
                 wx + R[0]*cx + F[0]*cy,
                 wy + R[1]*cx + F[1]*cy,
                 wz + R[2]*cx + F[2]*cy
               ];
               
               if (c.hasFloor) {
                 const fPos = [
                   localPos[0] + nx*floorCenterHeight,
                   localPos[1] + ny*floorCenterHeight,
                   localPos[2] + nz*floorCenterHeight
                 ];
                 collectibles.push({
                   type: "wood_floor",
                   position: fPos,
                   normal: [nx, ny, nz],
                   R: R,
                   F: F,
                   active: true,
                   size: wfSize,
                   seed: seed + i*1000 + gx*10 + gy,
                   isHouse: true,
                   isProceduralHouse: true,
                   houseIndex: placedHouses.length - 1,
                   gx: gx,
                   gy: gy,
                   hideFromCompass: true,
                   isWorldGenerated: true
                 });
               }
               
               if (c.hasRoof && c.hasFloor) {
                 if (roofStyle === "flat") {
                   const roofHeight = wallBaseHeight + 0.25;
                   const roofPos = [
                     localPos[0] + nx*roofHeight,
                     localPos[1] + ny*roofHeight,
                     localPos[2] + nz*roofHeight
                   ];
                   collectibles.push({
                     type: "thin_wood_floor",
                     position: roofPos,
                     normal: [nx, ny, nz],
                     R: R,
                     F: F,
                     active: true,
                     size: wfSize,
                     seed: seed + i*2000 + gx*10 + gy,
                     isHouse: true,
                     isProceduralHouse: true,
                     hideFromCompass: true,
                     isWorldGenerated: true
                   });
                 } else {
                   // Gable roof logic
                   let isSlope = false;
                   let isFlatTop = false;
                   let roofRDir = R;
                   let roofFDir = F;
                   
                   if (roofAxis === "X") {
                     // ridge along Y-axis, slopes down along X-axis
                     if (gx === 0) {
                       isSlope = true;
                       roofFDir = R; 
                       roofRDir = [-F[0], -F[1], -F[2]];
                     } else if (gx === gridX - 1) {
                       isSlope = true;
                       roofFDir = [-R[0], -R[1], -R[2]];
                       roofRDir = F;
                     } else {
                       isFlatTop = true;
                     }
                   } else {
                     // ridge along X-axis, slopes down along Y-axis
                     if (gy === 0) {
                       isSlope = true;
                       roofFDir = F; 
                       roofRDir = R;
                     } else if (gy === gridY - 1) {
                       isSlope = true;
                       roofFDir = [-F[0], -F[1], -F[2]];
                       roofRDir = [-R[0], -R[1], -R[2]];
                     } else {
                       isFlatTop = true;
                     }
                   }

                   if (isFlatTop) {
                     const peakHeight = wallBaseHeight + 0.50; // top of slopes
                     const roofPos = [
                       localPos[0] + nx*peakHeight,
                       localPos[1] + ny*peakHeight,
                       localPos[2] + nz*peakHeight
                     ];
                     collectibles.push({
                       type: "thin_wood_floor",
                       position: roofPos,
                       normal: [nx, ny, nz],
                       R: R,
                       F: F,
                       active: true,
                       size: wfSize,
                       seed: seed + i*2000 + gx*10 + gy,
                       isHouse: true,
                       isProceduralHouse: true,
                       hideFromCompass: true,
                       isWorldGenerated: true
                     });
                   } else if (isSlope) {
                     const roofHeight = wallBaseHeight + 0.25;
                     const roofPos = [
                       localPos[0] + nx*roofHeight,
                       localPos[1] + ny*roofHeight,
                       localPos[2] + nz*roofHeight
                     ];
                     collectibles.push({
                       type: "wood_roof",
                       position: roofPos,
                       normal: [nx, ny, nz],
                       R: roofRDir,
                       F: roofFDir,
                       active: true,
                       size: wfSize,
                       angle: 0,
                       seed: seed + i*2000 + gx*10 + gy,
                       isHouse: true,
                       isProceduralHouse: true,
                       hideFromCompass: true,
                       isWorldGenerated: true
                     });
                   }
                 }
               }

               // Only spawn walls if the cell has a floor beneath it!
               if (c.hasFloor) {
                 const wallPosBase = [
                   localPos[0] + nx*wallBaseHeight,
                   localPos[1] + ny*wallBaseHeight,
                   localPos[2] + nz*wallBaseHeight
                 ];

                 // CRITICAL ENGINE RULE: wood_door and wood_window are fixtures that MUST CO-LOCATE with a wood_wall.
                 // wood_wall renders the framing and side planks; wood_door / wood_window renders the door leaf / window frame inside.
                 // Never spawn wood_door or wood_window alone in mid-air without wood_wall!
                 const addWall = (wOffset, wR, wF, seedOffset, fixtureType = null, elevOffset = 0) => {
                   const wPos = [
                     wallPosBase[0] + wOffset[0] + nx * elevOffset,
                     wallPosBase[1] + wOffset[1] + ny * elevOffset,
                     wallPosBase[2] + wOffset[2] + nz * elevOffset
                   ];

                   // Always place the base structural wood_wall
                   collectibles.push({
                     type: "wood_wall",
                     position: wPos,
                     normal: [nx, ny, nz],
                     R: wR,
                     F: wF,
                     active: true,
                     size: wfSize,
                     seed: seed + i*3000 + seedOffset,
                     isHouse: true,
                     isProceduralHouse: true,
                     hideFromCompass: true,
                     isWorldGenerated: true
                   });

                   // If this wall has a door or window fixture, co-locate it with the wall
                   if (elevOffset === 0 && (fixtureType === "wood_door" || fixtureType === "wood_window")) {
                     collectibles.push({
                       type: fixtureType,
                       position: [wPos[0], wPos[1], wPos[2]],
                       normal: [nx, ny, nz],
                       R: wR,
                       F: wF,
                       active: true,
                       size: wfSize,
                       angle: 0.0,
                       seed: seed + i*3000 + seedOffset + 500,
                       isHouse: true,
                       isProceduralHouse: true,
                       hideFromCompass: true,
                       isWorldGenerated: true
                     });
                   }
                 };

                 const getFixtureType = (side) => {
                   if (entranceDoor && entranceDoor.gx === gx && entranceDoor.gy === gy && entranceDoor.side === side) {
                     return "wood_door";
                   }
                   // 25% chance of a window on perimeter walls
                   if (Math.random() < 0.25) {
                     return "wood_window";
                   }
                   return null; // solid wood_wall
                 };

                 if (c.wallLeft) addWall([-R[0]*(wfW/2), -R[1]*(wfW/2), -R[2]*(wfW/2)], F, [-R[0], -R[1], -R[2]], gy, getFixtureType("left"));
                 if (c.wallRight) addWall([R[0]*(wfW/2), R[1]*(wfW/2), R[2]*(wfW/2)], F, R, gy + 100, getFixtureType("right"));
                 if (c.wallBottom) addWall([-F[0]*(wfW/2), -F[1]*(wfW/2), -F[2]*(wfW/2)], R, [-F[0], -F[1], -F[2]], gx + 200, getFixtureType("bottom"));
                 if (c.wallTop) addWall([F[0]*(wfW/2), F[1]*(wfW/2), F[2]*(wfW/2)], R, F, gx + 300, getFixtureType("top"));
                 
                 // Gable ends (triangular upper walls to fill peak gap)
                 // ONLY add if roof exists, floor exists, and the lower wall below it exists!
                 if (c.hasRoof && roofStyle === "gable") {
                   if (roofAxis === "X") {
                     if (gy === 0 && c.wallBottom) addWall([-F[0]*(wfW/2), -F[1]*(wfW/2), -F[2]*(wfW/2)], R, [-F[0], -F[1], -F[2]], gx + 1200, null, 0.25);
                     if (gy === gridY - 1 && c.wallTop) addWall([F[0]*(wfW/2), F[1]*(wfW/2), F[2]*(wfW/2)], R, F, gx + 1300, null, 0.25);
                   } else {
                     if (gx === 0 && c.wallLeft) addWall([-R[0]*(wfW/2), -R[1]*(wfW/2), -R[2]*(wfW/2)], F, [-R[0], -R[1], -R[2]], gy + 1000, null, 0.25);
                     if (gx === gridX - 1 && c.wallRight) addWall([R[0]*(wfW/2), R[1]*(wfW/2), R[2]*(wfW/2)], F, R, gy + 1100, null, 0.25);
                   }
                 }
               }
            }
          }
          return placedHouses.length - 1;
        };

        // =========================================================
        // A) PROCEDURAL VILLAGE SYSTEM (หมู่บ้าน 3-5 หลัง ล้อมรอบกองไฟตรงกลาง)
        // สุ่มบ้านสมบูรณ์กับบ้านพังครึ่งต่อครึ่ง (50/50) ดึงโค้ดสร้างบ้านเดิมมาใช้ทั้งหมด
        // =========================================================
        let houseSeedCounter = 0;
        const villageTargetHouses = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5 houses

        const trySpawnVillage = (relaxedPass = false) => {
          const maxCenterAttempts = relaxedPass ? 160 : 120;
          const ringDists = relaxedPass ? [1.75, 2.1, 2.45, 2.85, 3.3, 3.75] : [1.75, 2.05, 2.4, 2.8, 3.2];
          const angleTweaks = [0, 0.14, -0.14, 0.28, -0.28, 0.42, -0.42];
          const tunnels = (typeof window !== "undefined" && window.tunnels3D) ? window.tunnels3D : (typeof tunnels3D !== "undefined" ? tunnels3D : []);

          for (let attempt = 0; attempt < maxCenterAttempts; attempt++) {
            const u = Math.random();
            const v = Math.random();
            const vTheta = Math.acos(2 * u - 1);
            const vPhi = 2 * Math.PI * v;
            const vH = sampleH_house(vTheta, vPhi);
            if (vH < minHouseLandHeight) continue;

            const vNx = Math.sin(vTheta) * Math.cos(vPhi);
            const vNy = Math.cos(vTheta);
            const vNz = Math.sin(vTheta) * Math.sin(vPhi);
            const vRDist = RADIUS + vH * HEIGHT_SCALE;
            const vWx = vRDist * vNx;
            const vWy = vRDist * vNy;
            const vWz = vRDist * vNz;

            // Ensure village campfire plaza is not inside a cave tunnel
            let centerInCave = false;
            if (tunnels && tunnels.length > 0) {
              for (let tIdx = 0; tIdx < tunnels.length; tIdx++) {
                const tun = tunnels[tIdx];
                if (tun.isDug) continue;
                const tdx = vWx - tun.x, tdy = vWy - tun.y, tdz = vWz - tun.z;
                const safeDist = tun.r + 1.1;
                if (tdx*tdx + tdy*tdy + tdz*tdz < safeDist * safeDist) { centerInCave = true; break; }
              }
            }
            if (centerInCave) continue;
            if (typeof isPositionInsideCave === "function" && isPositionInsideCave(vWx, vWy, vWz, 0.6)) continue;

            // Local tangent frame for campfire plaza
            let txR, txY, txZ;
            if (Math.abs(vNy) < 0.9) { txR = -vNz; txY = 0; txZ = vNx; }
            else { txR = 1; txY = 0; txZ = 0; }
            const lenTxR = Math.hypot(txR, txY, txZ) || 1;
            const vR = [txR / lenTxR, txY / lenTxR, txZ / lenTxR];
            const vF = [
              vNy * vR[2] - vNz * vR[1],
              vNz * vR[0] - vNx * vR[2],
              vNx * vR[1] - vNy * vR[0]
            ];
            const lenVF = Math.hypot(vF[0], vF[1], vF[2]) || 1;
            vF[0] /= lenVF; vF[1] /= lenVF; vF[2] /= lenVF;

            // Quick flatness check at campfire center
            const probeD = 0.25;
            const pRx = vWx + vR[0] * probeD, pRy = vWy + vR[1] * probeD, pRz = vWz + vR[2] * probeD;
            const dPR = Math.hypot(pRx, pRy, pRz) || 1;
            const hPR = sampleH_house(Math.acos(Math.max(-1, Math.min(1, pRy / dPR))), Math.atan2(pRz, pRx));
            const pFx = vWx + vF[0] * probeD, pFy = vWy + vF[1] * probeD, pFz = vWz + vF[2] * probeD;
            const dPF = Math.hypot(pFx, pFy, pFz) || 1;
            const hPF = sampleH_house(Math.acos(Math.max(-1, Math.min(1, pFy / dPF))), Math.atan2(pFz, pFx));
            const slR = ((hPR - vH) * HEIGHT_SCALE) / probeD;
            const slF = ((hPF - vH) * HEIGHT_SCALE) / probeD;
            const maxPlazaSlope = relaxedPass ? 0.16 : 0.10;
            if (Math.abs(slR) > maxPlazaSlope || Math.abs(slF) > maxPlazaSlope) continue;

            // Try finding 3-5 valid house spots arranged in a ring around the central campfire
            const baseAngle = Math.random() * Math.PI * 2;
            const candidateSpots = [];
            const tempPlaced = placedHouses.slice();

            for (let slot = 0; slot < villageTargetHouses; slot++) {
              const wfSize = 0.25;
              const wfW = wfSize * 1.2;
              const gridX = 2 + Math.floor(Math.random() * 3); // 2, 3, 4
              const gridY = 2 + Math.floor(Math.random() * 3); // 2, 3, 4
              const totalW = gridX * wfW;
              const totalD = gridY * wfW;
              const halfW = totalW / 2;
              const halfD = totalD / 2;
              const houseRadius = Math.sqrt(halfW * halfW + halfD * halfD);

              const slotAngle = baseAngle + (slot / villageTargetHouses) * Math.PI * 2;
              let foundSlotSpot = null;

              slotSearch:
              for (let rIdx = 0; rIdx < ringDists.length; rIdx++) {
                const dist = ringDists[rIdx];
                for (let aIdx = 0; aIdx < angleTweaks.length; aIdx++) {
                  const ang = slotAngle + angleTweaks[aIdx];
                  const tx = vWx + (Math.cos(ang) * vR[0] + Math.sin(ang) * vF[0]) * dist;
                  const ty = vWy + (Math.cos(ang) * vR[1] + Math.sin(ang) * vF[1]) * dist;
                  const tz = vWz + (Math.cos(ang) * vR[2] + Math.sin(ang) * vF[2]) * dist;
                  const tLen = Math.hypot(tx, ty, tz) || 1;
                  const cTheta = Math.acos(Math.max(-1.0, Math.min(1.0, ty / tLen)));
                  let cPhi = Math.atan2(tz, tx);
                  if (cPhi < 0) cPhi += Math.PI * 2;

                  // Orient house forward (+F) inward toward the village campfire
                  const inwardDir = [vWx - tx, vWy - ty, vWz - tz];
                  const spot = validateHouseSpot(cTheta, cPhi, halfW, halfD, houseRadius, tempPlaced, {
                    customFDir: inwardDir,
                    minHouseGap: 0.55,
                    avoidCenter: [vWx, vWy, vWz],
                    avoidCenterRad: 0.90,
                    maxDev: relaxedPass ? 0.028 : 0.018,
                    maxDelta: relaxedPass ? 0.042 : 0.026,
                    maxSlope: relaxedPass ? 0.14 : 0.095,
                    minDotUp: relaxedPass ? 0.986 : 0.992,
                    allowClearNature: relaxedPass
                  });
                  if (spot) {
                    foundSlotSpot = { spot, gridX, gridY, wfSize, wfW, totalW, totalD, houseRadius };
                    break slotSearch;
                  }
                }
              }

              if (foundSlotSpot) {
                candidateSpots.push(foundSlotSpot);
                tempPlaced.push(foundSlotSpot.spot);
              }
            }

            // Need at least 3 houses to form a village (3-5 houses)
            if (candidateSpots.length >= 3) {
              const vIdx = placedVillages.length;
              // Clear obstacles around central campfire plaza
              clearAreaAround(vWx, vWy, vWz, 0.85);

              // True terrain normal for campfire
              let cfNx = vNx - vR[0] * slR - vF[0] * slF;
              let cfNy = vNy - vR[1] * slR - vF[1] * slF;
              let cfNz = vNz - vR[2] * slR - vF[2] * slF;
              const cfNLen = Math.hypot(cfNx, cfNy, cfNz) || 1;
              cfNx /= cfNLen; cfNy /= cfNLen; cfNz /= cfNLen;

              let cfR = [
                vR[0] - cfNx * (vR[0]*cfNx + vR[1]*cfNy + vR[2]*cfNz),
                vR[1] - cfNy * (vR[0]*cfNx + vR[1]*cfNy + vR[2]*cfNz),
                vR[2] - cfNz * (vR[0]*cfNx + vR[1]*cfNy + vR[2]*cfNz)
              ];
              const cfRLen = Math.hypot(cfR[0], cfR[1], cfR[2]) || 1;
              cfR = [cfR[0] / cfRLen, cfR[1] / cfRLen, cfR[2] / cfRLen];
              let cfF = [
                cfNy * cfR[2] - cfNz * cfR[1],
                cfNz * cfR[0] - cfNx * cfR[2],
                cfNx * cfR[1] - cfNy * cfR[0]
              ];
              const cfFLen = Math.hypot(cfF[0], cfF[1], cfF[2]) || 1;
              cfF = [cfF[0] / cfFLen, cfF[1] / cfFLen, cfF[2] / cfFLen];

              const cfPos = [vWx + cfNx * 0.005, vWy + cfNy * 0.005, vWz + cfNz * 0.005];
              const cfSizeVal = (typeof campfireSize === "number") ? campfireSize : 0.25;
              const villageCampfire = {
                type: "campfire",
                position: cfPos,
                normal: [cfNx, cfNy, cfNz],
                R: cfR,
                F: cfF,
                U: [cfNx, cfNy, cfNz],
                color: [0.50, 0.36, 0.22],
                size: cfSizeVal,
                active: true,
                isDynamic: false,
                isPreview: false,
                isVillageCampfire: true,
                villageIndex: vIdx,
                isWorldGenerated: true,
                isPlayerPlaced: false,
                hideFromCompass: true,
                seed: seed + 77000 + vIdx * 500,
                worldKey: `village_campfire_${vIdx}`
              };
              collectibles.push(villageCampfire);
              _genBlockingStructs.push(villageCampfire);

              if (typeof suppressGrassUnder === "function") {
                const cfSupRad = (typeof getSuppressRadius === "function") ? getSuppressRadius("campfire", cfSizeVal) : 0.35;
                suppressGrassUnder(cfPos, cfSupRad);
              }

              // 50/50 split of intact vs ruined houses inside the village
              const vCount = candidateSpots.length;
              const numIntact = Math.floor(vCount / 2) + ((vCount % 2 === 1 && Math.random() < 0.5) ? 1 : 0);
              const intactFlags = [];
              for (let k = 0; k < vCount; k++) intactFlags.push(k < numIntact);
              for (let k = intactFlags.length - 1; k > 0; k--) {
                const j = Math.floor(Math.random() * (k + 1));
                const tmp = intactFlags[k];
                intactFlags[k] = intactFlags[j];
                intactFlags[j] = tmp;
              }

              const villageHouseIndices = [];
              let intactBuilt = 0;
              let ruinedBuilt = 0;
              for (let k = 0; k < vCount; k++) {
                const cs = candidateSpots[k];
                const isPerf = intactFlags[k];
                const isHeavy = !isPerf && (Math.random() < 0.45);
                if (isPerf) intactBuilt++; else ruinedBuilt++;
                const hIdx = buildProceduralHouseAt(cs.spot, {
                  i: houseSeedCounter++,
                  gridX: cs.gridX,
                  gridY: cs.gridY,
                  wfSize: cs.wfSize,
                  wfW: cs.wfW,
                  totalW: cs.totalW,
                  totalD: cs.totalD,
                  houseRadius: cs.houseRadius,
                  isPerfect: isPerf,
                  isHeavilyRuined: isHeavy,
                  villageIndex: vIdx,
                  preferredDoorSide: "top" // +F points inward toward village campfire
                });
                villageHouseIndices.push(hIdx);
              }

              placedVillages.push({
                index: vIdx,
                center: [vWx, vWy, vWz],
                normal: [cfNx, cfNy, cfNz],
                R: cfR,
                F: cfF,
                campfire: villageCampfire,
                houseIndices: villageHouseIndices,
                intactCount: intactBuilt,
                ruinedCount: ruinedBuilt
              });
              return true;
            }
          }
          return false;
        };

        if (!trySpawnVillage(false)) {
          trySpawnVillage(true);
        }

        // =========================================================
        // B) STANDALONE PROCEDURAL HOUSES (บ้านสุ่มเดี่ยวส่วนที่เหลือทั่วดาว)
        // =========================================================
        const remainingStandaloneHouses = Math.max(0, numStoneFloors - placedHouses.length);
        for (let s = 0; s < remainingStandaloneHouses; s++) {
          const wfSize = 0.25;
          const wfW = wfSize * 1.2;
          const gridX = 2 + Math.floor(Math.random() * 3); // 2, 3, 4
          const gridY = 2 + Math.floor(Math.random() * 3); // 2, 3, 4
          const totalW = gridX * wfW;
          const totalD = gridY * wfW;
          const halfW = totalW / 2;
          const halfD = totalD / 2;
          const houseRadius = Math.sqrt(halfW * halfW + halfD * halfD);

          let foundSpot = null;
          for (let attempt = 0; attempt < 80; attempt++) {
            const u = Math.random();
            const v = Math.random();
            const theta = Math.acos(2 * u - 1);
            const phi = 2 * Math.PI * v;
            const spot = validateHouseSpot(theta, phi, halfW, halfD, houseRadius, placedHouses, { minHouseGap: 1.2 });
            if (spot) {
              foundSpot = spot;
              break;
            }
          }
          if (!foundSpot) continue;

          const isPerf = Math.random() < 0.5;
          const isHeavy = !isPerf && (Math.random() < 0.45);
          buildProceduralHouseAt(foundSpot, {
            i: houseSeedCounter++,
            gridX,
            gridY,
            wfSize,
            wfW,
            totalW,
            totalD,
            houseRadius,
            isPerfect: isPerf,
            isHeavilyRuined: isHeavy,
            villageIndex: -1,
            preferredDoorSide: null
          });
        }

        // Flush all cleared tree/rock vertex edits to GPU in a single batched bufferSubData call
        _flushClearedNatureBuffer();

        // =========================================================
        // PROCEDURAL BOATS (WOOD_BOAT ONLY - สุ่มวางตามบ้านสุ่ม และชายหาด)
        // Rule: Pure boats only (no wheels/engines).
        // House count: strictly less than half of the procedural houses count.
        // =========================================================
        const numPlacedHouses = placedHouses.length;
        // Strictly less than half of total placed houses
        const maxHouseBoats = Math.max(0, Math.floor((numPlacedHouses - 1) / 2));
        const houseBoatCount = Math.min(maxHouseBoats, Math.max(0, Math.floor(numPlacedHouses * 0.35)));
        
        const placedBoatPositions = [];

        if (houseBoatCount > 0 && numPlacedHouses > 0) {
          // Shuffle house indices deterministically
          const houseIndices = [];
          for (let h = 0; h < numPlacedHouses; h++) houseIndices.push(h);
          Math.random = mulberry32(seed + 94321);
          for (let h = houseIndices.length - 1; h > 0; h--) {
            const j = Math.floor(Math.random() * (h + 1));
            const tmp = houseIndices[h];
            houseIndices[h] = houseIndices[j];
            houseIndices[j] = tmp;
          }

          for (let b = 0; b < houseBoatCount; b++) {
            const house = placedHouses[houseIndices[b]];
            if (!house) continue;

            const hx = house.x, hy = house.y, hz = house.z;
            const hR = house.R || [1, 0, 0], hF = house.F || [0, 0, 1];
            const hRad = house.radius || 0.6;

            // Try placing outside the house (e.g. near entrance or side yard)
            const angleOffsets = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
            for (let aIdx = 0; aIdx < angleOffsets.length; aIdx++) {
              const ang = angleOffsets[aIdx];
              const dist = hRad + 0.38 + Math.random() * 0.15;
              const offX = (Math.cos(ang) * hR[0] + Math.sin(ang) * hF[0]) * dist;
              const offY = (Math.cos(ang) * hR[1] + Math.sin(ang) * hF[1]) * dist;
              const offZ = (Math.cos(ang) * hR[2] + Math.sin(ang) * hF[2]) * dist;

              const candX = hx + offX;
              const candY = hy + offY;
              const candZ = hz + offZ;
              const cDist = Math.sqrt(candX*candX + candY*candY + candZ*candZ) || 1;
              const bnx = candX / cDist;
              const bny = candY / cDist;
              const bnz = candZ / cDist;

              const bTheta = Math.acos(Math.max(-1.0, Math.min(1.0, bny)));
              const bPhi = Math.atan2(bnz, bnx);
              const bH = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(bTheta, bPhi, seed) : getHeightOnSphere(bTheta, bPhi, seed);
              const bRad = RADIUS + bH * HEIGHT_SCALE;
              const bPos = [bnx * (bRad + 0.002), bny * (bRad + 0.002), bnz * (bRad + 0.002)];

              if (typeof isPositionInsideCave === "function" && isPositionInsideCave(bPos[0], bPos[1], bPos[2], 0.35)) {
                continue;
              }

              // Compute orthogonal tangent vectors
              let txR, txY, txZ;
              if (Math.abs(bny) < 0.9) {
                txR = -bnz; txY = 0; txZ = bnx;
              } else {
                txR = 1; txY = 0; txZ = 0;
              }
              const lenR = Math.sqrt(txR*txR + txY*txY + txZ*txZ) || 1;
              const bR_vec = [txR / lenR, txY / lenR, txZ / lenR];
              const bF_vec = [
                bR_vec[1] * bnz - bR_vec[2] * bny,
                bR_vec[2] * bnx - bR_vec[0] * bnz,
                bR_vec[0] * bny - bR_vec[1] * bnx
              ];
              const lenF = Math.sqrt(bF_vec[0]*bF_vec[0] + bF_vec[1]*bF_vec[1] + bF_vec[2]*bF_vec[2]) || 1;
              bF_vec[0] /= lenF; bF_vec[1] /= lenF; bF_vec[2] /= lenF;

              collectibles.push({
                type: "wood_boat",
                position: bPos,
                normal: [bnx, bny, bnz],
                R: bR_vec,
                F: bF_vec,
                active: true,
                isDynamic: true,
                size: 0.25,
                isPreview: false,
                hasWheel: false,
                hasWheels: false,
                wheelCount: 0,
                hasEngine: false,
                angle: Math.random() * Math.PI * 2,
                seed: seed + 50000 + b * 777,
                isWorldGenerated: true,
                isRandomBoat: true,
                isPlayerPlaced: false,
                hideFromCompass: true
              });

              placedBoatPositions.push(bPos);
              break;
            }
          }
        }

        // =========================================================
        // 2. BEACH BOATS (เรือสุ่มตามชายหาด)
        // =========================================================
        const waterRad = RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * 0.15;
        const targetBeachBoats = Math.min(6, Math.max(3, Math.round(2 + Math.sqrt(rBase))));
        let beachBoatsSpawned = 0;

        for (let attempt = 0; attempt < 160 && beachBoatsSpawned < targetBeachBoats; attempt++) {
          Math.random = mulberry32(seed + 65432 + attempt * 997);
          const u = Math.random();
          const v = Math.random();
          const theta = Math.acos(2 * u - 1);
          const phi = 2 * Math.PI * v;
          const h = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, seed) : getHeightOnSphere(theta, phi, seed);
          const terrainRad = RADIUS + h * HEIGHT_SCALE;
          const hDiff = terrainRad - waterRad;

          // Beach shoreline zone: from shallow shoreline (-0.035) up to dry beach sand (+0.075)
          if (hDiff < -0.035 || hDiff > 0.075) continue;

          const candNx = Math.sin(theta) * Math.cos(phi);
          const candNy = Math.cos(theta);
          const candNz = Math.sin(theta) * Math.sin(phi);

          // Check for steep terrain / cliffs dropping into water (ensure gentle beach slope)
          const testOffset = 0.03;
          const tH1 = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta + testOffset, phi, seed) : getHeightOnSphere(theta + testOffset, phi, seed);
          const tH2 = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi + testOffset, seed) : getHeightOnSphere(theta, phi + testOffset, seed);
          if (Math.abs(tH1 - h) > 0.045 || Math.abs(tH2 - h) > 0.045) continue;

          const spawnRad = terrainRad < waterRad ? (waterRad - 0.02) : (terrainRad + 0.002);
          const candWx = spawnRad * candNx;
          const candWy = spawnRad * candNy;
          const candWz = spawnRad * candNz;

          if (typeof isPositionInsideCave === "function" && isPositionInsideCave(candWx, candWy, candWz, 0.35)) {
            continue;
          }

          // Check distance from existing placed houses
          let tooCloseHouse = false;
          for (let ph = 0; ph < placedHouses.length; ph++) {
            const hItem = placedHouses[ph];
            const dx = candWx - hItem.x, dy = candWy - hItem.y, dz = candWz - hItem.z;
            if (dx*dx + dy*dy + dz*dz < (hItem.radius + 1.0) * (hItem.radius + 1.0)) {
              tooCloseHouse = true;
              break;
            }
          }
          if (tooCloseHouse) continue;

          // Check distance from already spawned boats
          let tooCloseBoat = false;
          for (let pb = 0; pb < placedBoatPositions.length; pb++) {
            const bP = placedBoatPositions[pb];
            const dx = candWx - bP[0], dy = candWy - bP[1], dz = candWz - bP[2];
            if (dx*dx + dy*dy + dz*dz < 1.44) { // at least 1.2m apart
              tooCloseBoat = true;
              break;
            }
          }
          if (tooCloseBoat) continue;

          // Tangent coordinate system
          let txR, txY, txZ;
          if (Math.abs(candNy) < 0.9) {
            txR = -candNz; txY = 0; txZ = candNx;
          } else {
            txR = 1; txY = 0; txZ = 0;
          }
          const lenR = Math.sqrt(txR * txR + txY * txY + txZ * txZ) || 1;
          const bR = [txR / lenR, txY / lenR, txZ / lenR];
          const bF = [
            bR[1] * candNz - bR[2] * candNy,
            bR[2] * candNx - bR[0] * candNz,
            bR[0] * candNy - bR[1] * candNx
          ];
          const lenF = Math.sqrt(bF[0]*bF[0] + bF[1]*bF[1] + bF[2]*bF[2]) || 1;
          bF[0] /= lenF; bF[1] /= lenF; bF[2] /= lenF;

          collectibles.push({
            type: "wood_boat",
            position: [candWx, candWy, candWz],
            normal: [candNx, candNy, candNz],
            R: bR,
            F: bF,
            active: true,
            isDynamic: true,
            size: 0.25,
            isPreview: false,
            hasWheel: false,
            hasWheels: false,
            wheelCount: 0,
            hasEngine: false,
            angle: Math.random() * Math.PI * 2,
            seed: seed + 80000 + beachBoatsSpawned * 331,
            isWorldGenerated: true,
            isRandomBoat: true,
            isPlayerPlaced: false,
            hideFromCompass: true
          });

          placedBoatPositions.push([candWx, candWy, candWz]);
          beachBoatsSpawned++;
        }

        // Dragon fruits grow attached to white-red trees as collectible entities
        syncTreeAttachedFruits();

        // =========================================================
        // 3. RANDOM LOOT CHESTS (กล่องสุ่มตามกลุ่มต้นไม้ และชายหาด)
        // - Spawns near tree clusters & beaches
        // - Randomly half-buried & tilted OR normally snapped to terrain & grid
        // - Loot rolled from ITEM_RARITIES (COMMON / RARE only; excludes CRAFT_ONLY & SYSTEM items)
        // - Max 3 distinct items per chest, max 3 count per item
        // =========================================================
        {
          const lootRng = mulberry32(seed + 71337);
          const placedLootChestPositions = [];
          const savedLootChests = (typeof window !== "undefined" && Array.isArray(window.savedHouseChestsStorage))
            ? window.savedHouseChestsStorage
            : [];
          const sampleH = (th, ph) => (typeof getVisualHeightOnSphere === "function"
            ? getVisualHeightOnSphere(th, ph, seed)
            : getHeightOnSphere(th, ph, seed));

          const gridArcStep = 0.30 / Math.max(8, RADIUS);

          const isClearForLootChest = (wx, wy, wz, minTreeClear, minChestClear) => {
            if (typeof isPositionInsideCave === "function" && isPositionInsideCave(wx, wy, wz, 0.25)) {
              return false;
            }
            // Avoid overlapping houses
            for (let ph = 0; ph < placedHouses.length; ph++) {
              const hItem = placedHouses[ph];
              const dx = wx - hItem.x, dy = wy - hItem.y, dz = wz - hItem.z;
              const minD = (hItem.radius || 0.6) + 0.75;
              if (dx * dx + dy * dy + dz * dz < minD * minD) return false;
            }
            // Avoid overlapping beach/house boats
            for (let pb = 0; pb < placedBoatPositions.length; pb++) {
              const bP = placedBoatPositions[pb];
              const dx = wx - bP[0], dy = wy - bP[1], dz = wz - bP[2];
              if (dx * dx + dy * dy + dz * dz < 0.85 * 0.85) return false;
            }
            // Avoid overlapping other random loot chests
            const minCSq = minChestClear * minChestClear;
            for (let pc = 0; pc < placedLootChestPositions.length; pc++) {
              const cP = placedLootChestPositions[pc];
              const dx = wx - cP[0], dy = wy - cP[1], dz = wz - cP[2];
              if (dx * dx + dy * dy + dz * dz < minCSq) return false;
            }
            // Avoid clipping directly inside trees or boulders
            const minTSq = minTreeClear * minTreeClear;
            for (let oIdx = 0; oIdx < natureObsList.length; oIdx++) {
              const obs = natureObsList[oIdx];
              if (!obs || !obs.position) continue;
              const dx = wx - obs.position[0];
              const dy = wy - obs.position[1];
              const dz = wz - obs.position[2];
              const dSq = dx * dx + dy * dy + dz * dz;
              if (dSq < minTSq) return false;
            }
            return true;
          };

          const trySpawnLootChestAt = (rawTheta, rawPhi, zone, minTreeClear, minChestClear) => {
            // Randomly choose placement style: ~55% half-buried & tilted, ~45% normal grid-snapped
            const isBuriedTilted = lootRng() < 0.55;
            let theta = Math.max(0.08, Math.min(Math.PI - 0.08, rawTheta));
            let phi = rawPhi;

            if (!isBuriedTilted) {
              // Normal grid snap on planet surface (0.30m grid matching wood floor/chest placement)
              theta = Math.max(0.08, Math.min(Math.PI - 0.08, Math.round(theta / gridArcStep) * gridArcStep));
              const phiStep = gridArcStep / Math.max(0.2, Math.sin(theta));
              phi = Math.round(phi / phiStep) * phiStep;
            }

            const h = sampleH(theta, phi);
            const terrainRad = RADIUS + h * HEIGHT_SCALE;
            const hDiff = terrainRad - waterRad;

            if (zone === "beach") {
              // Dry/damp beach sand strictly above water line
              if (hDiff < 0.006 || hDiff > 0.115) return false;
            } else {
              // Forest land well above water line
              if (hDiff < 0.04) return false;
            }

            // Slope check
            const eps = 0.015;
            const hT = sampleH(Math.min(Math.PI - 0.05, theta + eps), phi);
            const hP = sampleH(theta, phi + eps);
            const dhScale = HEIGHT_SCALE / (eps * Math.max(1, terrainRad));
            const slopeVal = Math.hypot((hT - h) * dhScale, (hP - h) * dhScale);
            const maxSlope = zone === "beach" ? 0.35 : (isBuriedTilted ? 0.62 : 0.48);
            if (slopeVal > maxSlope) return false;

            const sinT = Math.sin(theta), cosT = Math.cos(theta);
            const sinP = Math.sin(phi), cosP = Math.cos(phi);
            const nx = sinT * cosP, ny = cosT, nz = sinT * sinP;

            // Surface base position (half-buried sinks 0.028..0.042m out of 0.0855m chest height)
            const buryDepth = isBuriedTilted ? (0.028 + lootRng() * 0.014) : -0.001;
            const spawnRad = terrainRad - buryDepth;
            const wx = spawnRad * nx;
            const wy = spawnRad * ny;
            const wz = spawnRad * nz;

            if (!isClearForLootChest(wx, wy, wz, minTreeClear, minChestClear)) return false;

            const east = [-sinP, 0, cosP];
            const north = [-cosT * cosP, sinT, -cosT * sinP];

            // Cardinal 90° snap for normal grid placement, free random yaw + pitch/roll for buried tilted
            const heading = isBuriedTilted
              ? (lootRng() * Math.PI * 2)
              : (Math.floor(lootRng() * 4) * (Math.PI / 2));
            const cosH = Math.cos(heading), sinH = Math.sin(heading);

            let cN = [nx, ny, nz];
            let cR = [
              east[0] * cosH - north[0] * sinH,
              east[1] * cosH - north[1] * sinH,
              east[2] * cosH - north[2] * sinH
            ];
            let cF = [
              north[0] * cosH + east[0] * sinH,
              north[1] * cosH + east[1] * sinH,
              north[2] * cosH + east[2] * sinH
            ];

            if (isBuriedTilted) {
              // Apply random roll (~10°..24°) and pitch (~9°..22°) keeping strict right-handed orthonormality
              const rollSign = lootRng() < 0.5 ? -1 : 1;
              const pitchSign = lootRng() < 0.5 ? -1 : 1;
              const rollAng = rollSign * (0.18 + lootRng() * 0.24);
              const pitchAng = pitchSign * (0.16 + lootRng() * 0.22);

              const cosR = Math.cos(rollAng), sinR = Math.sin(rollAng);
              const r1 = [
                cR[0] * cosR + cN[0] * sinR,
                cR[1] * cosR + cN[1] * sinR,
                cR[2] * cosR + cN[2] * sinR
              ];
              const n1 = [
                -cR[0] * sinR + cN[0] * cosR,
                -cR[1] * sinR + cN[1] * cosR,
                -cR[2] * sinR + cN[2] * cosR
              ];

              const cosP = Math.cos(pitchAng), sinP2 = Math.sin(pitchAng);
              const n2 = [
                n1[0] * cosP + cF[0] * sinP2,
                n1[1] * cosP + cF[1] * sinP2,
                n1[2] * cosP + cF[2] * sinP2
              ];
              const f2 = [
                -n1[0] * sinP2 + cF[0] * cosP,
                -n1[1] * sinP2 + cF[1] * cosP,
                -n1[2] * sinP2 + cF[2] * cosP
              ];

              cR = r1;
              cN = n2;
              cF = f2;
            }

            const posKey = `${Math.round(wx * 1000)}_${Math.round(wy * 1000)}_${Math.round(wz * 1000)}`;
            const lootWorldKey = `wood_chest_loot_${zone}_${posKey}`;

            // Restore saved chest storage if previously opened/looted; otherwise roll fresh rarity-based loot
            let chestStorage = null;
            if (savedLootChests.length > 0) {
              const savedMatch = savedLootChests.find(s => s && s.worldKey === lootWorldKey);
              if (savedMatch && Array.isArray(savedMatch.storage)) {
                chestStorage = savedMatch.storage.slice(0, 20);
                while (chestStorage.length < 20) chestStorage.push(null);
              }
            }
            if (!chestStorage) {
              const chestItemRng = mulberry32(seed + 91900 + placedLootChestPositions.length * 1013 + (zone === "beach" ? 5000 : 0));
              chestStorage = (typeof window !== "undefined" && typeof window.generateRandomLootChestStorage === "function")
                ? window.generateRandomLootChestStorage(chestItemRng)
                : Array(20).fill(null);
            }

            collectibles.push({
              type: "wood_chest",
              position: [wx, wy, wz],
              normal: cN,
              R: cR,
              F: cF,
              active: true,
              isDynamic: false,
              size: 0.25,
              isPreview: false,
              storage: chestStorage,
              isWorldGenerated: true,
              isPlayerPlaced: false,
              isRandomLootChest: true,
              lootZone: zone,
              placementStyle: isBuriedTilted ? "buried_tilted" : "grid_snapped",
              hideFromCompass: true,
              seed: seed + 91000 + placedLootChestPositions.length * 521,
              worldKey: lootWorldKey
            });

            placedLootChestPositions.push([wx, wy, wz]);
            return true;
          };

          // A) Tree Cluster Chests (กล่องสุ่มตามกลุ่มต้นไม้)
          const treeObs = [];
          for (let oIdx = 0; oIdx < natureObsList.length; oIdx++) {
            const obs = natureObsList[oIdx];
            if (obs && obs.type === "tree" && obs.position) {
              treeObs.push(obs);
            }
          }

          if (treeObs.length > 0) {
            // Prioritize trees that belong to a cluster (>= 2 neighbor trees within 3.2m)
            const clusterTrees = [];
            const clusterRadSq = 3.2 * 3.2;
            const stride = Math.max(1, Math.floor(treeObs.length / 180));
            for (let t = 0; t < treeObs.length; t += stride) {
              const a = treeObs[t].position;
              let neighbors = 0;
              for (let u = 0; u < treeObs.length; u++) {
                if (u === t) continue;
                const b = treeObs[u].position;
                const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
                if (dx * dx + dy * dy + dz * dz <= clusterRadSq) {
                  neighbors++;
                  if (neighbors >= 2) break;
                }
              }
              if (neighbors >= 2) clusterTrees.push(treeObs[t]);
            }
            const treePool = clusterTrees.length > 0 ? clusterTrees : treeObs;

            // Deterministic Fisher-Yates shuffle of candidate cluster trees
            const shuffledTrees = treePool.slice();
            for (let sIdx = shuffledTrees.length - 1; sIdx > 0; sIdx--) {
              const j = Math.floor(lootRng() * (sIdx + 1));
              const tmp = shuffledTrees[sIdx];
              shuffledTrees[sIdx] = shuffledTrees[j];
              shuffledTrees[j] = tmp;
            }

            const targetTreeChests = Math.min(10, Math.max(4, Math.round(3 + Math.sqrt(rBase))));
            let treeChestsSpawned = 0;

            for (let ti = 0; ti < shuffledTrees.length && treeChestsSpawned < targetTreeChests; ti++) {
              const tr = shuffledTrees[ti];
              const tp = tr.position;
              const tLen = Math.hypot(tp[0], tp[1], tp[2]) || 1;
              const tnx = tp[0] / tLen, tny = tp[1] / tLen, tnz = tp[2] / tLen;
              const tTheta = Math.acos(Math.max(-1.0, Math.min(1.0, tny)));
              const tPhi = Math.atan2(tnz, tnx);
              const tSinP = Math.sin(tPhi), tCosP = Math.cos(tPhi);
              const tSinT = Math.sin(tTheta), tCosT = Math.cos(tTheta);
              const tEast = [-tSinP, 0, tCosP];
              const tNorth = [-tCosT * tCosP, tSinT, -tCosT * tSinP];

              // Try up to 4 offsets around the tree trunk (0.34m..0.72m)
              for (let aTry = 0; aTry < 4; aTry++) {
                const ang = lootRng() * Math.PI * 2;
                const dist = 0.34 + lootRng() * 0.38;
                const offX = (Math.cos(ang) * tEast[0] + Math.sin(ang) * tNorth[0]) * dist;
                const offY = (Math.cos(ang) * tEast[1] + Math.sin(ang) * tNorth[1]) * dist;
                const offZ = (Math.cos(ang) * tEast[2] + Math.sin(ang) * tNorth[2]) * dist;
                const cx = tp[0] + offX, cy = tp[1] + offY, cz = tp[2] + offZ;
                const cLen = Math.hypot(cx, cy, cz) || 1;
                const cTheta = Math.acos(Math.max(-1.0, Math.min(1.0, cy / cLen)));
                const cPhi = Math.atan2(cz, cx);

                if (trySpawnLootChestAt(cTheta, cPhi, "forest", 0.28, 1.8)) {
                  treeChestsSpawned++;
                  break;
                }
              }
            }
          }

          // B) Beach Chests (กล่องสุ่มตามชายหาด)
          const targetBeachChests = Math.min(8, Math.max(4, Math.round(2 + Math.sqrt(rBase))));
          let beachChestsSpawned = 0;

          for (let attempt = 0; attempt < 220 && beachChestsSpawned < targetBeachChests; attempt++) {
            const u = lootRng();
            const v = lootRng();
            const candTheta = Math.acos(2 * u - 1);
            const candPhi = 2 * Math.PI * v;

            if (trySpawnLootChestAt(candTheta, candPhi, "beach", 0.30, 1.9)) {
              beachChestsSpawned++;
            }
          }
        }

        Math.random = _origRandom;

        for (let i = 0; i < collectibles.length; i++) {
          const c = collectibles[i];
          c.isWorldGenerated = true;
          if (c.isPlayerPlaced === undefined) c.isPlayerPlaced = false;
          if (!c.worldKey) {
            const px = c.position ? Math.round(c.position[0] * 1000) : 0;
            const py = c.position ? Math.round(c.position[1] * 1000) : 0;
            const pz = c.position ? Math.round(c.position[2] * 1000) : 0;
            c.worldKey = `${c.type}_${px}_${py}_${pz}`;
          }
        }

        const staticWorldCollectibles = collectibles.filter(c => !c.isDynamic);
        if (Array.isArray(savedCollectiblesState) && savedCollectiblesState.length > 0) {
          if (savedCollectiblesState.length === staticWorldCollectibles.length) {
            for (let i = 0; i < staticWorldCollectibles.length; i++) {
              staticWorldCollectibles[i].active = Boolean(savedCollectiblesState[i]);
            }
          } else if (savedCollectiblesState.length === collectibles.length) {
            for (let i = 0; i < collectibles.length; i++) {
              collectibles[i].active = Boolean(savedCollectiblesState[i]);
            }
          } else {
            const countToRestore = Math.min(staticWorldCollectibles.length, savedCollectiblesState.length);
            for (let i = 0; i < countToRestore; i++) {
              staticWorldCollectibles[i].active = Boolean(savedCollectiblesState[i]);
            }
          }
        }

        if (typeof window !== "undefined" && Array.isArray(window.savedRemovedWorldKeys) && window.savedRemovedWorldKeys.length > 0) {
          const removedKeySet = new Set(window.savedRemovedWorldKeys);
          const demChests = Array.isArray(window.demolishedHouseChests) ? new Set(window.demolishedHouseChests) : new Set();
          for (let i = 0; i < collectibles.length; i++) {
            const c = collectibles[i];
            if (c) {
              if (c.worldKey && removedKeySet.has(c.worldKey)) {
                c.active = false;
              } else if (c.type === "wood_chest" && c.houseIndex !== undefined && (removedKeySet.has("house_chest_" + c.houseIndex) || demChests.has(c.houseIndex))) {
                c.active = false;
              }
            }
          }
        }

        refreshCollectiblesVBO();
        if (typeof SpatialGrid !== "undefined") {
          SpatialGrid.rebuild(collectibles);
        }

        window.placedHouses = placedHouses;
        window.placedVillages = placedVillages;
        if (typeof window.respawnPlayerClonesNearHouses === "function") {
          window.respawnPlayerClonesNearHouses();
        }
      }

      function getHouseSpawnLocation(preferredHouseIndex = -1) {
        const houses = (typeof window !== "undefined" && window.placedHouses && window.placedHouses.length > 0)
          ? window.placedHouses
          : [];

        const seed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
        const pRad = (typeof RADIUS !== "undefined") ? RADIUS : 32;
        const hScale = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 1.0;
        const wLevel = (typeof waterLevel !== "undefined") ? waterLevel : 1.0;
        const effectiveWaterRad = pRad + wLevel * (hScale * 0.25) + 0.05;

        if (houses.length > 0) {
          const indices = [];
          for (let i = 0; i < houses.length; i++) indices.push(i);
          if (preferredHouseIndex >= 0 && preferredHouseIndex < houses.length) {
            indices.unshift(indices.splice(preferredHouseIndex, 1)[0]);
          } else {
            for (let i = indices.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              const temp = indices[i];
              indices[i] = indices[j];
              indices[j] = temp;
            }
          }

          for (const hIdx of indices) {
            const house = houses[hIdx];
            if (!house) continue;

            const hx = house.x, hy = house.y, hz = house.z;
            const hR = house.R || [1, 0, 0];
            const hF = house.F || [0, 0, 1];
            const wfW = house.wfW || 0.30;
            const totalW = house.totalW || 0.6;
            const totalD = house.totalD || 0.6;
            const door = house.entranceDoor;

            // Safe clearance distance (เว้นระยะห่างหน้าประตู / หน้าระเบียงบ้าน 0.55 - 0.80 เมตร อย่างสวยงาม ไม่ติดกำแพง)
            const safeClearance = 0.60;

            const candidateOffsets = [];
            if (door) {
              const cellCx = -totalW / 2 + wfW / 2 + door.gx * wfW;
              const cellCy = -totalD / 2 + wfW / 2 + door.gy * wfW;
              if (door.side === "bottom") {
                candidateOffsets.push({ offR: cellCx, offF: cellCy - wfW / 2 - safeClearance });
                candidateOffsets.push({ offR: cellCx, offF: cellCy - wfW / 2 - (safeClearance + 0.35) });
              } else if (door.side === "top") {
                candidateOffsets.push({ offR: cellCx, offF: cellCy + wfW / 2 + safeClearance });
                candidateOffsets.push({ offR: cellCx, offF: cellCy + wfW / 2 + (safeClearance + 0.35) });
              } else if (door.side === "left") {
                candidateOffsets.push({ offR: cellCx - wfW / 2 - safeClearance, offF: cellCy });
                candidateOffsets.push({ offR: cellCx - wfW / 2 - (safeClearance + 0.35), offF: cellCy });
              } else if (door.side === "right") {
                candidateOffsets.push({ offR: cellCx + wfW / 2 + safeClearance, offF: cellCy });
                candidateOffsets.push({ offR: cellCx + wfW / 2 + (safeClearance + 0.35), offF: cellCy });
              }
            }

            // เพิ่มจุดรอบๆ ตัวบ้านกรณีไม่มีประตู หรือหน้าประตูมีสิ่งกีดขวาง
            const houseRad = house.radius || Math.sqrt((totalW / 2) * (totalW / 2) + (totalD / 2) * (totalD / 2));
            const testAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
            for (const ang of testAngles) {
              candidateOffsets.push({
                offR: Math.cos(ang) * (houseRad + safeClearance),
                offF: Math.sin(ang) * (houseRad + safeClearance)
              });
            }

            for (const offset of candidateOffsets) {
              const candWx = hx + hR[0] * offset.offR + hF[0] * offset.offF;
              const candWy = hy + hR[1] * offset.offR + hF[1] * offset.offF;
              const candWz = hz + hR[2] * offset.offR + hF[2] * offset.offF;

              const candDist = Math.sqrt(candWx * candWx + candWy * candWy + candWz * candWz) || 1;
              const candNx = candWx / candDist;
              const candNy = candWy / candDist;
              const candNz = candWz / candDist;

              const theta = Math.acos(Math.max(-1.0, Math.min(1.0, candNy)));
              let phi = Math.atan2(candNz, candNx);
              if (phi < 0) phi += Math.PI * 2;

              const hVal = typeof getVisualHeightOnSphere === "function"
                ? getVisualHeightOnSphere(theta, phi, seed)
                : (typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta, phi, seed) : 0);
              const surfaceRad = pRad + hVal * hScale;

              // ข้ามหากจมน้ำ
              if (surfaceRad < effectiveWaterRad) continue;

              // ข้ามหากอยู่ในถ้ำ
              if (typeof isPositionInsideCave === "function" && isPositionInsideCave(candWx, candWy, candWz, 0.3)) {
                continue;
              }

              return {
                theta: theta,
                phi: phi,
                house: house,
                houseIndex: hIdx,
                x: candWx,
                y: candWy,
                z: candWz,
                success: true
              };
            }
          }
        }

        // Fallback: หากไม่มีบ้านที่เหมาะสม ให้สุ่มหาพิกัดบนบกที่ไม่จมน้ำ
        let fallbackTheta = Math.PI / 2;
        let fallbackPhi = 0;
        for (let attempt = 0; attempt < 50; attempt++) {
          const u = Math.random();
          const v = Math.random();
          const testTheta = Math.acos(2 * u - 1);
          const testPhi = 2 * Math.PI * v;
          const hVal = typeof getVisualHeightOnSphere === "function"
            ? getVisualHeightOnSphere(testTheta, testPhi, seed)
            : (typeof getHeightOnSphere === "function" ? getHeightOnSphere(testTheta, testPhi, seed) : 0);
          const surfaceRad = pRad + hVal * hScale;
          if (surfaceRad >= effectiveWaterRad) {
            fallbackTheta = testTheta;
            fallbackPhi = testPhi;
            break;
          }
        }

        return {
          theta: fallbackTheta,
          phi: fallbackPhi,
          house: null,
          houseIndex: -1,
          success: false
        };
      }
      function getVillageSpawnLocation(villageIndex = 0) {
        const villages = (typeof window !== "undefined" && Array.isArray(window.placedVillages) && window.placedVillages.length > 0)
          ? window.placedVillages
          : [];
        const houses = (typeof window !== "undefined" && Array.isArray(window.placedHouses))
          ? window.placedHouses
          : [];

        const village = villages[villageIndex] || villages[0];
        if (!village || !village.center) {
          return getHouseSpawnLocation();
        }

        const seed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
        const pRad = (typeof RADIUS !== "undefined") ? RADIUS : 32;
        const hScale = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 1.0;
        const wLevel = (typeof waterLevel !== "undefined") ? waterLevel : 1.0;
        const effectiveWaterRad = pRad + wLevel * (hScale * 0.25) + 0.05;

        const [vx, vy, vz] = village.center;
        const vR = village.R || [1, 0, 0];
        const vF = village.F || [0, 0, 1];

        // Pick a clear spot around the village center campfire (0.80m - 1.20m) not overlapping any house
        const testDists = [0.85, 1.05, 1.25];
        const testAngles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (3 * Math.PI) / 2, (7 * Math.PI) / 4];

        for (let dIdx = 0; dIdx < testDists.length; dIdx++) {
          const dist = testDists[dIdx];
          for (let aIdx = 0; aIdx < testAngles.length; aIdx++) {
            const ang = testAngles[aIdx];
            const candWx = vx + (Math.cos(ang) * vR[0] + Math.sin(ang) * vF[0]) * dist;
            const candWy = vy + (Math.cos(ang) * vR[1] + Math.sin(ang) * vF[1]) * dist;
            const candWz = vz + (Math.cos(ang) * vR[2] + Math.sin(ang) * vF[2]) * dist;

            const candDist = Math.hypot(candWx, candWy, candWz) || 1;
            const candNx = candWx / candDist;
            const candNy = candWy / candDist;
            const candNz = candWz / candDist;

            const theta = Math.acos(Math.max(-1.0, Math.min(1.0, candNy)));
            let phi = Math.atan2(candNz, candNx);
            if (phi < 0) phi += Math.PI * 2;

            const hVal = typeof getVisualHeightOnSphere === "function"
              ? getVisualHeightOnSphere(theta, phi, seed)
              : (typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta, phi, seed) : 0);
            const surfaceRad = pRad + hVal * hScale;
            if (surfaceRad < effectiveWaterRad) continue;
            if (typeof isPositionInsideCave === "function" && isPositionInsideCave(candWx, candWy, candWz, 0.3)) continue;

            // Make sure spawn spot is outside every house footprint
            let insideHouse = false;
            for (let hi = 0; hi < houses.length; hi++) {
              const h = houses[hi];
              if (!h) continue;
              const dx = candWx - h.x, dy = candWy - h.y, dz = candWz - h.z;
              const safeR = (h.radius || 0.6) + 0.35;
              if (dx * dx + dy * dy + dz * dz < safeR * safeR) {
                insideHouse = true;
                break;
              }
            }
            if (insideHouse) continue;

            // Compute heading so player faces inward toward the central village campfire
            const sinT = Math.sin(theta), cosT = Math.cos(theta);
            const sinP = Math.sin(phi), cosP = Math.cos(phi);
            const east = [-sinP, 0, cosP];
            const north = [-cosT * cosP, sinT, -cosT * sinP];
            const toFireX = vx - candWx, toFireY = vy - candWy, toFireZ = vz - candWz;
            const dEast = toFireX * east[0] + toFireY * east[1] + toFireZ * east[2];
            const dNorth = toFireX * north[0] + toFireY * north[1] + toFireZ * north[2];
            const heading = Math.atan2(dEast, dNorth);

            return {
              theta,
              phi,
              heading,
              village,
              villageIndex: village.index,
              x: candWx,
              y: candWy,
              z: candWz,
              success: true
            };
          }
        }

        // Fallback: spawn in front of an intact house inside the village (or first village house)
        if (Array.isArray(village.houseIndices) && village.houseIndices.length > 0) {
          const intactIdx = village.houseIndices.find(idx => houses[idx] && !houses[idx].isRuined);
          return getHouseSpawnLocation(intactIdx !== undefined ? intactIdx : village.houseIndices[0]);
        }
        return getHouseSpawnLocation();
      }
      window.getHouseSpawnLocation = getHouseSpawnLocation;
      window.getRandomHouseSpawn = getHouseSpawnLocation;
      window.getVillageSpawnLocation = getVillageSpawnLocation;

      window.addBox = addBox;
      function addBox(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices) {
        const hw = w / 2;
        const hh = h / 2;
        const hd = d / 2;
        
        let r = right, u = up, f = forward;
        let isFlipped = false;
        if (r && u && f) {
          const det = (r[1]*u[2] - r[2]*u[1])*f[0] + (r[2]*u[0] - r[0]*u[2])*f[1] + (r[0]*u[1] - r[1]*u[0])*f[2];
          if (det < 0) {
            isFlipped = true;
          }
        }

        const cubeVerts = [
          [-hw, -hh, -hd],
          [hw, -hh, -hd],
          [hw, -hh, hd],
          [-hw, -hh, hd],
          [-hw, hh, -hd],
          [hw, hh, -hd],
          [hw, hh, hd],
          [-hw, hh, hd],
        ];
        
        const cubeIndices = isFlipped ? [
          0, 1, 2, 0, 2, 3, // bottom
          4, 6, 5, 4, 7, 6, // top
          0, 5, 1, 0, 4, 5, // back
          2, 7, 3, 2, 6, 7, // front
          0, 3, 7, 0, 7, 4, // left
          1, 6, 2, 1, 5, 6  // right
        ] : [
          0, 2, 1, 0, 3, 2, // bottom (CW outward)
          4, 5, 6, 4, 6, 7, // top (CW outward)
          0, 1, 5, 0, 5, 4, // back (CW outward)
          2, 3, 7, 2, 7, 6, // front (CW outward)
          0, 7, 3, 0, 4, 7, // left (CW outward)
          1, 2, 6, 1, 6, 5  // right (CW outward)
        ];
        
        const baseIdx = outVertices.length / 3;
        
        for (let i = 0; i < 8; i++) {
           const v = cubeVerts[i];
           const rx = r[0]*v[0] + u[0]*v[1] + f[0]*v[2];
           const ry = r[1]*v[0] + u[1]*v[1] + f[1]*v[2];
           const rz = r[2]*v[0] + u[2]*v[1] + f[2]*v[2];
           
           outVertices.push(center[0]+rx, center[1]+ry, center[2]+rz);
           outColors.push(color[0], color[1], color[2]);
        }
        
        for (let i = 0; i < cubeIndices.length; i++) {
            outIndices.push(baseIdx + cubeIndices[i]);
        }
      }

      function buildHitboxes() {
        const vertices = [];
        const colors = [];
        const indices = [];
        
        if (showHitboxes) {
            const allObstacles = [
              ...natureObstacles,
              ...cubeObstacles,
              ...amphibians,
            ];
            
            for (let i = 0; i < allObstacles.length; i++) {
                const obs = allObstacles[i];
                let color = [1.0, 0.0, 0.0]; // Red for hitboxes
                
                if (obs.meshStart !== undefined && obs.meshEnd !== undefined) {
                    const baseIdx = vertices.length / 3;
                    const count = obs.meshEnd - obs.meshStart;
                    for (let j = 0; j < count; j++) {
                        const vIdx = obs.meshStart + j;
                        vertices.push(
                            natureRawVertices[vIdx*3],
                            natureRawVertices[vIdx*3+1],
                            natureRawVertices[vIdx*3+2]
                        );
                        colors.push(color[0], color[1], color[2]);
                        indices.push(baseIdx + j);
                    }
                } else if (obs.colliders && obs.colliders.length > 0) {
                    for (let col of obs.colliders) {
                        const r = col.radius;
                        if (!obs.position) continue;
                        
                        const cx = obs.position[0] + (col.offset[0] || 0);
                        const cy = obs.position[1] + (col.offset[1] || 0);
                        const cz = obs.position[2] + (col.offset[2] || 0);
                        
                        const h = r * 2;
                        
                        const up = [0, 1, 0];
                        if (obs.normal) {
                           up[0] = obs.normal[0]; up[1] = obs.normal[1]; up[2] = obs.normal[2];
                        }
                        
                        let ref = [0, 1, 0];
                        if (Math.abs(up[1]) > 0.9) ref = [1, 0, 0];
                        
                        let right = [
                            up[1]*ref[2] - up[2]*ref[1],
                            up[2]*ref[0] - up[0]*ref[2],
                            up[0]*ref[1] - up[1]*ref[0]
                        ];
                        let rLen = Math.sqrt(right[0]*right[0] + right[1]*right[1] + right[2]*right[2]);
                        right = [right[0]/rLen, right[1]/rLen, right[2]/rLen];
                        
                        let fwd = [
                            right[1]*up[2] - right[2]*up[1],
                            right[2]*up[0] - right[0]*up[2],
                            right[0]*up[1] - right[1]*up[0]
                        ];
                        
                        const boxCenter = [cx, cy, cz];
                        
                        addBox(boxCenter, r*2, r*2, r*2, color, right, up, fwd, vertices, colors, indices);
                    }
                }
            }

            const staticCols = (typeof window !== "undefined" && window.staticCollectiblesList) ? window.staticCollectiblesList : [];
            const colRawVerts = (typeof window !== "undefined" && window.collectibleRawVertices) ? window.collectibleRawVertices : null;
            if (colRawVerts && staticCols.length > 0) {
                for (let i = 0; i < staticCols.length; i++) {
                    const item = staticCols[i];
                    if (!item || !item.active || item.isPreview || item.isDemolished) continue;
                    if (item.type !== "wood_bed" && item.type !== "wood_chest") continue;
                    if (item.meshStart !== undefined && item.meshEnd !== undefined) {
                        const baseIdx = vertices.length / 3;
                        const count = item.meshEnd - item.meshStart;
                        for (let j = 0; j < count; j++) {
                            const vIdx = item.meshStart + j;
                            if (vIdx * 3 + 2 >= colRawVerts.length) break;
                            vertices.push(
                                colRawVerts[vIdx * 3],
                                colRawVerts[vIdx * 3 + 1],
                                colRawVerts[vIdx * 3 + 2]
                            );
                            colors.push(1.0, 0.0, 0.0);
                            indices.push(baseIdx + j);
                        }
                    }
                }
            }
        }
        
        hitboxIndicesLength = indices.length;
        if (hitboxIndicesLength > 0) {
            if (!hitboxVertexBuffer) hitboxVertexBuffer = gl.createBuffer();
            if (!hitboxColorBuffer) hitboxColorBuffer = gl.createBuffer();
            if (!hitboxIndexBuffer) hitboxIndexBuffer = gl.createBuffer();

            gl.bindBuffer(gl.ARRAY_BUFFER, hitboxVertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

            gl.bindBuffer(gl.ARRAY_BUFFER, hitboxColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

            const isUint32 = indices.length > 65535;
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, hitboxIndexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, isUint32 ? new Uint32Array(indices) : new Uint16Array(indices), gl.STATIC_DRAW);
        }
      }

      let cachedRawBoatHull = null;
      function getOrCreateRawBoatHull() {
        if (cachedRawBoatHull) return cachedRawBoatHull;
        
        const tempVerts = [];
        const tempColors = [];
        const tempIndices = [];
        
        const p = [0, 0, 0];
        const n = [0, 1, 0];
        const r = [1, 0, 0];
        const f = [0, 0, 1];
        
        const bs = 0.4;
        const w = 0.5 * bs;
        const l = 1.2 * bs;
        const h = 0.2 * bs;
        const t = 0.04 * bs;
        
        const bCol = [0.55, 0.4, 0.25];
        const darkCol = [0.38, 0.26, 0.15];
        const lightCol = [0.65, 0.5, 0.35];
        const bottomShade = [0.46, 0.32, 0.18];
        
        const drawPartLocal = (localCenter, size, color, rotX = 0, rotY = 0, rotZ = 0) => {
          let currR = [...r];
          let currN = [...n];
          let currF = [...f];
          
          if (rotX !== 0) {
            const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
            const ny = [
              currN[0]*cosX - currF[0]*sinX,
              currN[1]*cosX - currF[1]*sinX,
              currN[2]*cosX - currF[2]*sinX
            ];
            const fz = [
              currN[0]*sinX + currF[0]*cosX,
              currN[1]*sinX + currF[1]*cosX,
              currN[2]*sinX + currF[2]*cosX
            ];
            currN = ny;
            currF = fz;
          }
          if (rotY !== 0) {
            const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
            const rx = [
              currR[0]*cosY + currF[0]*sinY,
              currR[1]*cosY + currF[1]*sinY,
              currR[2]*cosY + currF[2]*sinY
            ];
            const fz = [
              -currR[0]*sinY + currF[0]*cosY,
              -currR[1]*sinY + currF[1]*cosY,
              -currR[2]*sinY + currF[2]*cosY
            ];
            currR = rx;
            currF = fz;
          }
          if (rotZ !== 0) {
            const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);
            const rx = [
              currR[0]*cosZ + currN[0]*sinZ,
              currR[1]*cosZ + currN[1]*sinZ,
              currR[2]*cosZ + currN[2]*sinZ
            ];
            const ny = [
              -currR[0]*sinZ + currN[0]*cosZ,
              -currR[1]*sinZ + currN[1]*cosZ,
              -currR[2]*sinZ + currN[2]*cosZ
            ];
            currR = rx;
            currN = ny;
          }
          
          const cx = p[0] + r[0]*localCenter[0] + n[0]*localCenter[1] + f[0]*localCenter[2];
          const cy = p[1] + r[1]*localCenter[0] + n[1]*localCenter[1] + f[1]*localCenter[2];
          const cz = p[2] + r[2]*localCenter[0] + n[2]*localCenter[1] + f[2]*localCenter[2];
          
          addBox([cx, cy, cz], size[0], size[1], size[2], color, currR, currN, currF, tempVerts, tempColors, tempIndices);
        };

        const segments = [
          { f: 0.0,       len: 0.12, pitch: 0.0,   y: 0.002, wf: 1.0,   sideTilt: 0.35 },
          { f: 0.10,      len: 0.10, pitch: 0.16,  y: 0.010, wf: 0.88,  sideTilt: 0.32 },
          { f: 0.19,      len: 0.10, pitch: 0.44,  y: 0.034, wf: 0.60,  sideTilt: 0.26 },
          { f: -0.10,     len: 0.10, pitch: -0.14, y: 0.008, wf: 0.92,  sideTilt: 0.32 },
          { f: -0.19,     len: 0.10, pitch: -0.38, y: 0.028, wf: 0.68,  sideTilt: 0.26 }
        ];

        for (let seg of segments) {
          const W_seg = w * seg.wf;
          drawPartLocal([0, seg.y, seg.f], [W_seg * 0.7, t, seg.len], bottomShade, seg.pitch, 0, 0);
          drawPartLocal([-W_seg * 0.32, seg.y + 0.003, seg.f], [W_seg * 0.35, t * 0.8, seg.len], bottomShade, seg.pitch, 0, -0.4);
          drawPartLocal([W_seg * 0.32, seg.y + 0.003, seg.f], [W_seg * 0.35, t * 0.8, seg.len], bottomShade, seg.pitch, 0, 0.4);

          const leftWallX = -W_seg * 0.52 - Math.sin(seg.sideTilt) * h * 0.5;
          const rightWallX = W_seg * 0.52 + Math.sin(seg.sideTilt) * h * 0.5;
          const wallY = seg.y + h * 0.45;
          drawPartLocal([leftWallX, wallY, seg.f], [t, h, seg.len], bCol, seg.pitch, 0, -seg.sideTilt);
          drawPartLocal([rightWallX, wallY, seg.f], [t, h, seg.len], bCol, seg.pitch, 0, seg.sideTilt);

          const railY = seg.y + h * 0.95;
          const leftRailX = leftWallX - Math.sin(seg.sideTilt) * h * 0.45;
          const rightRailX = rightWallX + Math.sin(seg.sideTilt) * h * 0.45;
          drawPartLocal([leftRailX, railY, seg.f], [t * 1.3, t * 0.7, seg.len * 1.04], darkCol, seg.pitch, 0, -seg.sideTilt);
          drawPartLocal([rightRailX, railY, seg.f], [t * 1.3, t * 0.7, seg.len * 1.04], darkCol, seg.pitch, 0, seg.sideTilt);
        }

        drawPartLocal([0, h * 0.38, 0.05], [w * 0.85, h * 0.72, t * 0.8], lightCol, 0, 0, 0);
        drawPartLocal([0, h * 0.38, -0.05], [w * 0.88, h * 0.72, t * 0.8], lightCol, 0, 0, 0);
        drawPartLocal([0, h * 0.55, 0.0], [w * 1.02, t * 0.6, 0.06], lightCol, 0, 0, 0);
        drawPartLocal([0, h * 0.95, 0.21], [w * 0.56, t * 0.7, 0.08], darkCol, 0.44, 0, 0);
        drawPartLocal([0, h * 0.7, 0.25], [t * 1.3, h * 0.8, t * 1.3], darkCol, 0.55, 0, 0);
        drawPartLocal([0, h * 0.48, -0.23], [w * 0.66, h * 0.95, t * 1.2], darkCol, -0.38, 0, 0);

        cachedRawBoatHull = {
          vertices: tempVerts,
          colors: tempColors,
          indices: tempIndices
        };
        return cachedRawBoatHull;
      }

      window._rebuildCollectibleSpatialHelpers = function() {
        const spatialDoors = new Map();
        const spatialWindows = new Map();
        const spatialRoofs = new Map();
        const spatialFloors = new Map();
        const activeCampfires = [];
        const lightCollectibles = [];

        for (let i = 0; i < collectibles.length; i++) {
          const c = collectibles[i];
          if (!c || !c.active || !c.position) continue;
          const px = c.position[0], py = c.position[1], pz = c.position[2];
          const t = c.type;
          if (!c.isGroundDrop) {
            if (t === "wood_door") {
              const key = Math.floor(px / 0.5) + "_" + Math.floor(py / 0.5) + "_" + Math.floor(pz / 0.5);
              let arr = spatialDoors.get(key);
              if (!arr) { arr = []; spatialDoors.set(key, arr); }
              arr.push(c);
            } else if (t === "wood_window") {
              const key = Math.floor(px / 0.5) + "_" + Math.floor(py / 0.5) + "_" + Math.floor(pz / 0.5);
              let arr = spatialWindows.get(key);
              if (!arr) { arr = []; spatialWindows.set(key, arr); }
              arr.push(c);
            } else if (t === "wood_roof") {
              const key = Math.floor(px / 2.0) + "_" + Math.floor(py / 2.0) + "_" + Math.floor(pz / 2.0);
              let arr = spatialRoofs.get(key);
              if (!arr) { arr = []; spatialRoofs.set(key, arr); }
              arr.push(c);
            } else if (t === "thin_wood_floor" || t === "wood_floor") {
              const key = Math.floor(px) + "_" + Math.floor(py) + "_" + Math.floor(pz);
              let arr = spatialFloors.get(key);
              if (!arr) { arr = []; spatialFloors.set(key, arr); }
              arr.push(c);
            }
          }
          if (!c.isPreview) {
            if (t === "campfire" && !c.isGroundDrop) {
              activeCampfires.push(c);
              lightCollectibles.push(c);
            } else if ((t === "lantern" && !c.isGroundDrop) || t === "glow_ore" || t === "glow_battery") {
              lightCollectibles.push(c);
            }
          }
        }
        window._spatialDoors = spatialDoors;
        window._spatialWindows = spatialWindows;
        window._spatialRoofs = spatialRoofs;
        window._spatialFloors = spatialFloors;
        window._activeCampfiresList = activeCampfires;
        window._lightCollectiblesList = lightCollectibles;
      };

      window._registerSingleCollectibleInSpatialHelpers = function(c) {
        if (!c || !c.active || !c.position) return;
        if (!window._spatialDoors || !window._spatialFloors || !window._lightCollectiblesList) {
          window._rebuildCollectibleSpatialHelpers();
          return;
        }
        const px = c.position[0], py = c.position[1], pz = c.position[2];
        const t = c.type;
        const addToMap = (map, cellSize) => {
          const key = Math.floor(px / cellSize) + "_" + Math.floor(py / cellSize) + "_" + Math.floor(pz / cellSize);
          let arr = map.get(key);
          if (!arr) { arr = []; map.set(key, arr); }
          if (!arr.includes(c)) arr.push(c);
        };
        if (!c.isGroundDrop) {
          if (t === "wood_door") addToMap(window._spatialDoors, 0.5);
          else if (t === "wood_window") addToMap(window._spatialWindows, 0.5);
          else if (t === "wood_roof") addToMap(window._spatialRoofs, 2.0);
          else if (t === "thin_wood_floor" || t === "wood_floor") addToMap(window._spatialFloors, 1.0);
        }
        if (!c.isPreview) {
          if (t === "campfire" && !c.isGroundDrop) {
            if (!window._activeCampfiresList.includes(c)) window._activeCampfiresList.push(c);
            if (!window._lightCollectiblesList.includes(c)) window._lightCollectiblesList.push(c);
          } else if ((t === "lantern" && !c.isGroundDrop) || t === "glow_ore" || t === "glow_battery") {
            if (!window._lightCollectiblesList.includes(c)) window._lightCollectiblesList.push(c);
          }
        }
      };

      window.dirtyNeighborStructureCaches = function(pos, radius, excludeItem, filterTypes) {
        if (!pos) return false;
        const r = radius || 2.2;
        const rSq = r * r;
        let candidates;
        if (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.queryRadius === "function") {
          candidates = SpatialGrid.queryRadius(pos[0], pos[1], pos[2], r);
        } else {
          candidates = collectibles;
        }
        let anyAffected = false;
        for (let i = 0; i < candidates.length; i++) {
          const o = candidates[i];
          if (!o || !o.active || o.isPreview || o === excludeItem || !o.position) continue;
          const ot = o.type;
          if (filterTypes && !filterTypes.includes(ot)) continue;
          const dx = o.position[0] - pos[0];
          const dy = o.position[1] - pos[1];
          const dz = o.position[2] - pos[2];
          if (dx * dx + dy * dy + dz * dz > rSq) continue;
          if (ot === "thin_wood_floor") {
            o._extDirty = true;
            anyAffected = true;
          } else if (ot === "wood_wall") {
            o._coFixtureDirty = true;
            o._trimDirty = true;
            anyAffected = true;
          } else if (ot === "wood_roof") {
            o._roofDirty = true;
            anyAffected = true;
          }
        }
        return anyAffected;
      };

      function refreshCollectiblesVBO(targetBuffer = 'all') {
        if (targetBuffer === 'all' || targetBuffer === 'place' || targetBuffer === 'demolish') {
          window._rebuildCollectibleSpatialHelpers();
          window._skipSpatialRebuildInRefresh = true;
          try {
            refreshCollectiblesVBO('main');
            refreshCollectiblesVBO('dynamic');
            refreshCollectiblesVBO('doors');
          } finally {
            window._skipSpatialRebuildInRefresh = false;
          }
          return;
        }

        const vertices = [];
        const colors = [];
        const indices = [];

        let itemsToProcess = [];
        if (targetBuffer === 'main') {
          window._boatSleepCheckTick = (window._boatSleepCheckTick || 0) + 1;
          for (let item of collectibles) {
            if (!item.isDynamic && item.type !== "wood_door" && item.type !== "wood_window" && item.type !== "wood_planter_box" && item.type !== "wild_growing_plant") {
              delete item.meshStart;
              delete item.meshEnd;
            }
          }
          const currentActiveBoat = (typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof window !== "undefined" && window.activeRidingBoat);
          itemsToProcess = collectibles.filter(c => !c.isDynamic && c.type !== "wood_door" && c.type !== "wood_window" && c.type !== "wood_planter_box" && c.type !== "wild_growing_plant" && c !== currentActiveBoat);
        } else if (targetBuffer === 'dynamic') {
          for (let item of collectibles) {
            if ((item.isDynamic && (item.isGroundDrop || (item.type !== "wood_door" && item.type !== "wood_window"))) || item.type === "wood_planter_box" || item.type === "wild_growing_plant") {
              delete item.meshStart;
              delete item.meshEnd;
            }
          }
          const currentActiveBoat = (typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof window !== "undefined" && window.activeRidingBoat);
          itemsToProcess = collectibles.filter(c => ((c.isDynamic && (c.isGroundDrop || (c.type !== "wood_door" && c.type !== "wood_window"))) || c.type === "wood_planter_box" || c.type === "wild_growing_plant") && c !== currentActiveBoat);
        } else if (targetBuffer === 'doors') {
          for (let item of collectibles) {
            if (!item.isGroundDrop && (item.type === "wood_door" || item.type === "wood_window")) {
              delete item.meshStart;
              delete item.meshEnd;
            }
          }
          itemsToProcess = collectibles.filter(c => !c.isGroundDrop && (c.type === "wood_door" || c.type === "wood_window"));
        } else {
          itemsToProcess = (typeof floorPreviewCollectible !== 'undefined' && floorPreviewCollectible ? [floorPreviewCollectible] : []);
        }

        // Build spatial acceleration grids ONCE when rebuilding 'main' or 'doors' (skip redundant rebuild during 'all')
        if (!window._skipSpatialRebuildInRefresh && (targetBuffer === 'main' || targetBuffer === 'doors' || !window._spatialDoors)) {
          window._rebuildCollectibleSpatialHelpers();
        }

        const DYNAMIC_TYPED_ARRAYS = window._DYNAMIC_TYPED_ARRAYS || (window._DYNAMIC_TYPED_ARRAYS = {});
        function getReusableTypedArray(key, Ctor, arr) {
            let buf = DYNAMIC_TYPED_ARRAYS[key];
            if (!buf || buf.length < arr.length) {
                buf = new Ctor(Math.max(arr.length * 1.5, 2048));
                DYNAMIC_TYPED_ARRAYS[key] = buf;
            }
            buf.set(arr);
            return buf.subarray(0, arr.length);
        }

        // Dirty-state & Fast Translation check for 'preview' buffer
        if (targetBuffer === 'preview') {
          const prevItem = (typeof floorPreviewCollectible !== 'undefined' && floorPreviewCollectible && floorPreviewCollectible.active)
            ? floorPreviewCollectible
            : null;
          if (!prevItem) {
            if (window._lastPreviewFullSig === 'EMPTY' && previewIndicesLength === 0) {
              return;
            }
            window._lastPreviewFullSig = 'EMPTY';
            window._lastPreviewShapeSig = 'EMPTY';
            previewIndicesLength = 0;
            return;
          }

          const p = prevItem.position || [0, 0, 0];
          const r = prevItem.R || [1, 0, 0];
          const f = prevItem.F || [0, 0, 1];
          const n = prevItem.normal || [0, 1, 0];
          const validBit = prevItem.isValidPlacement !== false ? 1 : 0;
          const ang = (prevItem.angle || 0).toFixed(4);
          const sz = (prevItem.size || 0).toFixed(3);
          const wVal = (prevItem.width || 0).toFixed(3);
          const dVal = (prevItem.depth || 0).toFixed(3);
          const topoVer = window._collectiblesTopologyVersion || 0;

          // Include relative stairTop/stairBottom for stairs & folding_ladder, and position for roof/wall trimming
          let extraShapeKey = '';
          if (prevItem.stairTop && prevItem.stairBottom) {
            extraShapeKey =
              (prevItem.stairTop[0] - p[0]).toFixed(3) + ',' +
              (prevItem.stairTop[1] - p[1]).toFixed(3) + ',' +
              (prevItem.stairTop[2] - p[2]).toFixed(3) + ',' +
              (prevItem.stairBottom[0] - p[0]).toFixed(3) + ',' +
              (prevItem.stairBottom[1] - p[1]).toFixed(3) + ',' +
              (prevItem.stairBottom[2] - p[2]).toFixed(3);
          } else if (prevItem.type === 'wood_wall' || prevItem.type === 'wood_roof' || prevItem.type === 'thin_wood_floor') {
            extraShapeKey = p[0].toFixed(3) + ',' + p[1].toFixed(3) + ',' + p[2].toFixed(3) + ',' + topoVer;
          }

          const boatSnapBit = prevItem.isBoatSnapped ? 1 : 0;
          const shapeSig =
            prevItem.type + '|' + validBit + '|' + boatSnapBit + '|' + ang + '|' + sz + '|' + wVal + '|' + dVal + '|' +
            r[0].toFixed(4) + ',' + r[1].toFixed(4) + ',' + r[2].toFixed(4) + '|' +
            f[0].toFixed(4) + ',' + f[1].toFixed(4) + ',' + f[2].toFixed(4) + '|' +
            n[0].toFixed(4) + ',' + n[1].toFixed(4) + ',' + n[2].toFixed(4) + '|' +
            extraShapeKey;

          const posSig = p[0].toFixed(4) + ',' + p[1].toFixed(4) + ',' + p[2].toFixed(4);
          const fullSig = shapeSig + '@' + posSig;

          // 1) Exact match: nothing changed at all -> skip 100% of CPU & GPU work
          if (window._lastPreviewFullSig === fullSig && previewVertexBuffer && previewIndicesLength > 0) {
            return;
          }

          // 2) Shape & orientation identical, only position translated (e.g. preview vertical bobbing):
          // shift cached flat vertices by (dx, dy, dz) and upload ONLY previewVertexBuffer!
          if (
            window._lastPreviewShapeSig === shapeSig &&
            window._lastPreviewFlatVerts &&
            window._lastPreviewOrigin &&
            previewVertexBuffer &&
            previewIndicesLength > 0
          ) {
            const dx = p[0] - window._lastPreviewOrigin[0];
            const dy = p[1] - window._lastPreviewOrigin[1];
            const dz = p[2] - window._lastPreviewOrigin[2];
            const flatV = window._lastPreviewFlatVerts;
            for (let i = 0, len = flatV.length; i < len; i += 3) {
              flatV[i] += dx;
              flatV[i + 1] += dy;
              flatV[i + 2] += dz;
            }
            window._lastPreviewOrigin[0] = p[0];
            window._lastPreviewOrigin[1] = p[1];
            window._lastPreviewOrigin[2] = p[2];
            window._lastPreviewFullSig = fullSig;

            gl.bindBuffer(gl.ARRAY_BUFFER, previewVertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, flatV, gl.DYNAMIC_DRAW);
            return;
          }

          window._lastPreviewShapeSig = shapeSig;
          window._lastPreviewFullSig = fullSig;
          window._lastPreviewOrigin = [p[0], p[1], p[2]];
        }

        const activeProcessedItems = [];
        for (let item of itemsToProcess) {
          if (!item.active) continue;
          if (targetBuffer !== 'preview' && item.isPreview) continue;

          const startIdx = indices.length;

          const rawHandler = window.ItemRegistry[item.type];
          const placeableDropMeta = (item.isGroundDrop && targetBuffer !== 'preview' && !item.isPreview && window.GroundDropSystem && typeof window.GroundDropSystem.getPlaceableDropMeta === "function")
            ? window.GroundDropSystem.getPlaceableDropMeta(item.type)
            : null;
          if (placeableDropMeta && rawHandler && typeof rawHandler.render === "function") {
            window.DropTemplateCache.renderPlaceableDrop(item, placeableDropMeta, rawHandler, vertices, colors, indices);
          } else {
            const handler = (rawHandler && typeof rawHandler.render === "function")
              ? rawHandler
              : (item.isGroundDrop
                  ? (window.ItemRegistry["cloth"] || window.ItemRegistry["branch"] || window.ItemRegistry["rock"])
                  : null);
            if (handler && typeof handler.render === "function") {
              handler.render(item, vertices, colors, indices, targetBuffer);
            }
          }
          if (targetBuffer === 'main' || targetBuffer === 'dynamic' || targetBuffer === 'doors') {
            item.meshStart = startIdx;
            item.meshEnd = indices.length;
            if (indices.length > startIdx) {
              activeProcessedItems.push(item);
            }
          }
        }

        if (targetBuffer === 'main') {
          window.staticCollectiblesList = activeProcessedItems;
          window._collectiblesTopologyVersion = (window._collectiblesTopologyVersion || 0) + 1;
        } else if (targetBuffer === 'dynamic') {
          window.dynamicCollectiblesList = activeProcessedItems;
        } else if (targetBuffer === 'doors') {
          window.doorWindowCollectiblesList = activeProcessedItems;
          window._collectiblesTopologyVersion = (window._collectiblesTopologyVersion || 0) + 1;
        }

        if (indices.length === 0) {
          if (targetBuffer === 'main') {
            collectibleIndicesLength = 0;
            window.staticCollectiblesList = [];
            window.collectibleRawVertices = null;
            window._staticColIndexCapacity = 0;
          } else if (targetBuffer === 'dynamic') {
            dynamicCollectibleIndicesLength = 0;
            window.dynamicCollectiblesList = [];
            window.dynamicCollectibleRawVertices = null;
          } else if (targetBuffer === 'doors') {
            doorWindowIndicesLength = 0;
            window.doorWindowCollectiblesList = [];
            window.doorWindowRawVertices = null;
            window.doorWindowRawNormals = null;
          } else {
            previewIndicesLength = 0;
            window._lastPreviewFlatVerts = null;
          }
          return;
        }

        const flatGeom = makeFlatShadedGeometry(vertices, colors, indices, true);
        const indCount = flatGeom.indices.length;
        const isUint32 = indCount > 65535;

        if (targetBuffer === 'main') {
            // Allocate dedicated persistent backing buffer with headroom capacity so:
            // (1) window.collectibleRawVertices is NEVER corrupted by dynamic/doors/fire reusable arrays,
            // (2) placing new items appends incrementally via gl.bufferSubData in <0.5ms!
            const rawCap = Math.max(Math.ceil(indCount * 1.25), indCount + 36000);
            const capInds = isUint32 ? rawCap : Math.min(65535, rawCap);
            const capFloats = capInds * 3;
            const usedFloats = indCount * 3;

            let vCapBuf = window._staticColVertsCapBuf;
            if (!vCapBuf || vCapBuf.length < capFloats) {
              vCapBuf = new Float32Array(capFloats);
              window._staticColVertsCapBuf = vCapBuf;
            }
            vCapBuf.set(flatGeom.vertices, 0);

            collectibleIndicesLength = indCount;
            window._staticColIndexCapacity = capInds;
            window._staticColIsUint32 = isUint32;
            window.collectibleRawVertices = vCapBuf.subarray(0, usedFloats);

            if (!collectibleVertexBuffer)
              collectibleVertexBuffer = gl.createBuffer();
            window.collectibleVertexBuffer = collectibleVertexBuffer;
            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleVertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, capFloats * 4, gl.STATIC_DRAW);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, window.collectibleRawVertices);

            if (!collectibleColorBuffer) collectibleColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, capFloats * 4, gl.STATIC_DRAW);
            gl.bufferSubData(
              gl.ARRAY_BUFFER,
              0,
              flatGeom.colors instanceof Float32Array ? flatGeom.colors : new Float32Array(flatGeom.colors)
            );

            if (!collectibleNormalBuffer)
              collectibleNormalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleNormalBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, capFloats * 4, gl.STATIC_DRAW);
            gl.bufferSubData(
              gl.ARRAY_BUFFER,
              0,
              flatGeom.normals instanceof Float32Array ? flatGeom.normals : new Float32Array(flatGeom.normals)
            );

            if (!collectibleIndexBuffer) collectibleIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, collectibleIndexBuffer);
            const idxBytes = isUint32 ? 4 : 2;
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, capInds * idxBytes, gl.STATIC_DRAW);
            gl.bufferSubData(
              gl.ELEMENT_ARRAY_BUFFER,
              0,
              isUint32
                ? (flatGeom.indices instanceof Uint32Array ? flatGeom.indices : new Uint32Array(flatGeom.indices))
                : (flatGeom.indices instanceof Uint16Array ? flatGeom.indices : new Uint16Array(flatGeom.indices))
            );
        } else if (targetBuffer === 'dynamic') {
            dynamicCollectibleIndicesLength = indCount;
            const dynVertSlice = getReusableTypedArray('dynVerts', Float32Array, flatGeom.vertices);
            window.dynamicCollectibleRawVertices = dynVertSlice;

            if (!dynamicCollectibleVertexBuffer)
              dynamicCollectibleVertexBuffer = gl.createBuffer();
            window.dynamicCollectibleVertexBuffer = dynamicCollectibleVertexBuffer;
            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleVertexBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              dynVertSlice,
              gl.DYNAMIC_DRAW,
            );

            if (!dynamicCollectibleColorBuffer) dynamicCollectibleColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleColorBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              getReusableTypedArray('dynCols', Float32Array, flatGeom.colors),
              gl.DYNAMIC_DRAW,
            );

            if (!dynamicCollectibleNormalBuffer)
              dynamicCollectibleNormalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleNormalBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              getReusableTypedArray('dynNorms', Float32Array, flatGeom.normals),
              gl.DYNAMIC_DRAW,
            );

            if (!dynamicCollectibleIndexBuffer) dynamicCollectibleIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dynamicCollectibleIndexBuffer);
            gl.bufferData(
              gl.ELEMENT_ARRAY_BUFFER,
              isUint32 ? getReusableTypedArray('dynInds32', Uint32Array, flatGeom.indices) : getReusableTypedArray('dynInds16', Uint16Array, flatGeom.indices),
              gl.DYNAMIC_DRAW,
            );
        } else if (targetBuffer === 'doors') {
            // Own persistent copies so dynamic/fire reusable buffers never overwrite doorWindowRawVertices/Normals
            const flatVerts = new Float32Array(flatGeom.vertices);
            const flatNorms = new Float32Array(flatGeom.normals);
            doorWindowIndicesLength = indCount;
            window.doorWindowRawVertices = flatVerts;
            window.doorWindowRawNormals = flatNorms;

            if (!doorWindowVertexBuffer)
              doorWindowVertexBuffer = gl.createBuffer();
            window.doorWindowVertexBuffer = doorWindowVertexBuffer;
            gl.bindBuffer(gl.ARRAY_BUFFER, doorWindowVertexBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              flatVerts,
              gl.DYNAMIC_DRAW,
            );

            if (!doorWindowColorBuffer) doorWindowColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, doorWindowColorBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              flatGeom.colors instanceof Float32Array ? flatGeom.colors : new Float32Array(flatGeom.colors),
              gl.DYNAMIC_DRAW,
            );

            if (!doorWindowNormalBuffer)
              doorWindowNormalBuffer = gl.createBuffer();
            window.doorWindowNormalBuffer = doorWindowNormalBuffer;
            gl.bindBuffer(gl.ARRAY_BUFFER, doorWindowNormalBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              flatNorms,
              gl.DYNAMIC_DRAW,
            );

            if (!doorWindowIndexBuffer) doorWindowIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, doorWindowIndexBuffer);
            gl.bufferData(
              gl.ELEMENT_ARRAY_BUFFER,
              isUint32 ? (flatGeom.indices instanceof Uint32Array ? flatGeom.indices : new Uint32Array(flatGeom.indices)) : (flatGeom.indices instanceof Uint16Array ? flatGeom.indices : new Uint16Array(flatGeom.indices)),
              gl.DYNAMIC_DRAW,
            );
        } else {
            previewIndicesLength = indCount;
            const prevVertSlice = getReusableTypedArray('prevVerts', Float32Array, flatGeom.vertices);
            window._lastPreviewFlatVerts = prevVertSlice;

            if (!previewVertexBuffer)
              previewVertexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, previewVertexBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              prevVertSlice,
              gl.DYNAMIC_DRAW,
            );

            if (!previewColorBuffer) previewColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, previewColorBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              getReusableTypedArray('prevCols', Float32Array, flatGeom.colors),
              gl.DYNAMIC_DRAW,
            );

            if (!previewNormalBuffer)
              previewNormalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, previewNormalBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              getReusableTypedArray('prevNorms', Float32Array, flatGeom.normals),
              gl.DYNAMIC_DRAW,
            );

            if (!previewIndexBuffer) previewIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, previewIndexBuffer);
            gl.bufferData(
              gl.ELEMENT_ARRAY_BUFFER,
              isUint32 ? getReusableTypedArray('prevInds32', Uint32Array, flatGeom.indices) : getReusableTypedArray('prevInds16', Uint16Array, flatGeom.indices),
              gl.DYNAMIC_DRAW,
            );
        }
      }

      // Fast incremental GPU append when placing 1 item (avoids ~1s full-planet VBO rebuild!)
      window.appendPlacedCollectibleToVBO = function(item) {
        if (!item || !item.active || item.isPreview) return false;
        window._collectiblesTopologyVersion = (window._collectiblesTopologyVersion || 0) + 1;
        window._registerSingleCollectibleInSpatialHelpers(item);

        if (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.insert === "function") {
          SpatialGrid.insert(item);
        }
        if (typeof window.invalidateStructureCollisionCache === "function") {
          window.invalidateStructureCollisionCache();
        }

        const t = item.type;
        // 1) Dynamic items, planter boxes & wild growing plants: rebuild ONLY 'dynamic' buffer
        if (item.isDynamic || t === "wood_planter_box" || t === "wild_growing_plant") {
          refreshCollectiblesVBO('dynamic');
          return true;
        }

        // 2) Doors & windows: rebuild 'doors', and only rebuild 'main' if a co-located wood_wall needs a cutout
        if (t === "wood_door" || t === "wood_window") {
          const hitWall = window.dirtyNeighborStructureCaches(item.position, 0.25, item, ["wood_wall"]);
          window._skipSpatialRebuildInRefresh = true;
          try {
            refreshCollectiblesVBO('doors');
            if (hitWall) refreshCollectiblesVBO('main');
          } finally {
            window._skipSpatialRebuildInRefresh = false;
          }
          return true;
        }

        // 3) Static 'main' items: check if any neighbor's trim/extension needs rebuilding
        let neighborNeedsRebuild = false;
        if (t === "wood_roof") {
          neighborNeedsRebuild = window.dirtyNeighborStructureCaches(item.position, 2.2, item, ["wood_wall", "wood_roof"]);
        } else if (t === "thin_wood_floor" || t === "wood_floor") {
          neighborNeedsRebuild = window.dirtyNeighborStructureCaches(item.position, 0.55, item, ["thin_wood_floor"]);
        }

        if (
          !neighborNeedsRebuild &&
          typeof gl !== "undefined" && gl &&
          collectibleVertexBuffer && collectibleColorBuffer && collectibleNormalBuffer && collectibleIndexBuffer &&
          window._staticColVertsCapBuf &&
          typeof window._staticColIndexCapacity === "number" &&
          window._staticColIndexCapacity > 0
        ) {
          const handler = window.ItemRegistry && window.ItemRegistry[t];
          if (handler && typeof handler.render === "function") {
            const tmpV = [], tmpC = [], tmpI = [];
            handler.render(item, tmpV, tmpC, tmpI, 'main');
            const addIndCount = tmpI.length;
            if (addIndCount === 0) return true;

            const oldLen = collectibleIndicesLength;
            const newLen = oldLen + addIndCount;
            const wasUint32 = !!window._staticColIsUint32;
            const wouldBeUint32 = newLen > 65535;

            if (newLen <= window._staticColIndexCapacity && wasUint32 === wouldBeUint32) {
              const flat = makeFlatShadedGeometry(tmpV, tmpC, tmpI, false);
              const flatIndLen = flat.indices.length;
              const finalNewLen = oldLen + flatIndLen;
              if (finalNewLen <= window._staticColIndexCapacity && (finalNewLen > 65535) === wasUint32) {
                const startFloat = oldLen * 3;
                const endFloat = finalNewLen * 3;
                window._staticColVertsCapBuf.set(flat.vertices, startFloat);
                window.collectibleRawVertices = window._staticColVertsCapBuf.subarray(0, endFloat);

                gl.bindBuffer(gl.ARRAY_BUFFER, collectibleVertexBuffer);
                gl.bufferSubData(gl.ARRAY_BUFFER, startFloat * 4, flat.vertices);

                gl.bindBuffer(gl.ARRAY_BUFFER, collectibleColorBuffer);
                gl.bufferSubData(gl.ARRAY_BUFFER, startFloat * 4, flat.colors);

                gl.bindBuffer(gl.ARRAY_BUFFER, collectibleNormalBuffer);
                gl.bufferSubData(gl.ARRAY_BUFFER, startFloat * 4, flat.normals);

                const offsetIdx = wasUint32 ? new Uint32Array(flatIndLen) : new Uint16Array(flatIndLen);
                for (let k = 0; k < flatIndLen; k++) {
                  offsetIdx[k] = oldLen + flat.indices[k];
                }
                const idxBytes = wasUint32 ? 4 : 2;
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, collectibleIndexBuffer);
                gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, oldLen * idxBytes, offsetIdx);

                item.meshStart = oldLen;
                item.meshEnd = finalNewLen;
                if (!Array.isArray(window.staticCollectiblesList)) window.staticCollectiblesList = [];
                window.staticCollectiblesList.push(item);
                collectibleIndicesLength = finalNewLen;
                return true;
              }
            }
          }
        }

        // Fallback when buffer capacity is full, Uint16->Uint32 crossed, or a neighbor wall/roof/thin-floor needs re-trimming:
        // Still rebuild ONLY 'main' (NOT 'dynamic' or 'doors'), and only dirtied neighbors recompute!
        window._skipSpatialRebuildInRefresh = true;
        try {
          refreshCollectiblesVBO('main');
        } finally {
          window._skipSpatialRebuildInRefresh = false;
        }
        return true;
      };

      // Fast surgical GPU update for an existing item modified in place (e.g. attaching wheel/engine/wing to a boat)
      window.updateCollectibleInVBO = function(item) {
        if (!item || !item.active || item.isPreview) return false;
        window._collectiblesTopologyVersion = (window._collectiblesTopologyVersion || 0) + 1;
        if (item.isDynamic || item.type === "wood_planter_box" || item.type === "wild_growing_plant") {
          refreshCollectiblesVBO('dynamic');
          return true;
        }
        if (item.type === "wood_door" || item.type === "wood_window") {
          refreshCollectiblesVBO('doors');
          return true;
        }
        if (typeof window.hideStaticCollectibleInVBO === "function") {
          window.hideStaticCollectibleInVBO(item);
        }
        return window.appendPlacedCollectibleToVBO(item);
      };

      // Surgical GPU sub-buffer update for actively swinging doors & windows:
      // Recomputes only the swinging door/window item(s) and updates their slice in doorWindowVertexBuffer
      // and doorWindowNormalBuffer via gl.bufferSubData without touching any other door, window, or dynamic item!
      window.updateSwingingDoorsAndWindowsInVBO = function(swingingItems) {
        if (!swingingItems || swingingItems.length === 0) return;
        if (
          !window.doorWindowRawVertices ||
          !window.doorWindowRawNormals ||
          !doorWindowVertexBuffer ||
          !doorWindowNormalBuffer ||
          typeof gl === "undefined" ||
          !gl
        ) {
          refreshCollectiblesVBO('doors');
          return;
        }

        const rawV = window.doorWindowRawVertices;
        const rawN = window.doorWindowRawNormals;

        for (let i = 0; i < swingingItems.length; i++) {
          const item = swingingItems[i];
          if (
            !item ||
            !item.active ||
            item.meshStart === undefined ||
            item.meshEnd === undefined ||
            item.meshEnd <= item.meshStart
          ) {
            refreshCollectiblesVBO('doors');
            return;
          }

          const startF = item.meshStart * 3;
          const endF = item.meshEnd * 3;
          const expectedLen = endF - startF;
          if (endF > rawV.length || endF > rawN.length) {
            refreshCollectiblesVBO('doors');
            return;
          }

          const v = [], c = [], idx = [];
          const handler = window.ItemRegistry[item.type];
          if (!handler || typeof handler.render !== "function") continue;
          handler.render(item, v, c, idx, 'doors');

          const flatGeom = makeFlatShadedGeometry(v, c, idx, true);
          if (!flatGeom || flatGeom.vertices.length !== expectedLen) {
            refreshCollectiblesVBO('doors');
            return;
          }

          const fv = flatGeom.vertices;
          const fn = flatGeom.normals;
          for (let j = 0; j < expectedLen; j++) {
            rawV[startF + j] = fv[j];
            rawN[startF + j] = fn[j];
          }

          const vSlice = rawV.subarray(startF, endF);
          const nSlice = rawN.subarray(startF, endF);

          gl.bindBuffer(gl.ARRAY_BUFFER, doorWindowVertexBuffer);
          gl.bufferSubData(gl.ARRAY_BUFFER, startF * 4, vSlice);

          gl.bindBuffer(gl.ARRAY_BUFFER, doorWindowNormalBuffer);
          gl.bufferSubData(gl.ARRAY_BUFFER, startF * 4, nSlice);
        }
      };

      // Fast surgical GPU sub-buffer update when picking up a static collectible:
      // zeroes out only the item's vertex range in collectibleVertexBuffer via gl.bufferSubData
      // instead of rebuilding the entire planet's static collectibles & house structures VBO.
      window.hideStaticCollectibleInVBO = function(item) {
        if (!item || item.isDynamic) return false;
        if (
          item.meshStart !== undefined &&
          item.meshEnd !== undefined &&
          item.meshEnd > item.meshStart &&
          window.collectibleRawVertices &&
          collectibleVertexBuffer &&
          typeof gl !== "undefined" &&
          gl
        ) {
          const startF = item.meshStart * 3;
          const endF = item.meshEnd * 3;
          const rawV = window.collectibleRawVertices;
          if (endF <= rawV.length) {
            for (let j = startF; j < endF; j++) rawV[j] = 0;
            const sliceView =
              typeof rawV.subarray === "function"
                ? rawV.subarray(startF, endF)
                : new Float32Array(rawV.slice(startF, endF));
            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleVertexBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, startF * 4, sliceView);
            item.meshStart = 0;
            item.meshEnd = 0;
            window._collectiblesTopologyVersion = (window._collectiblesTopologyVersion || 0) + 1;
            return true;
          }
        }
        return false;
      };

      // Fast surgical GPU sub-buffer zero-out when picking up a dynamic ground drop:
      // zeroes out only the item's vertex slice via gl.bufferSubData without rebuilding other drops!
      window.hideDynamicCollectibleInVBO = function(item) {
        if (!item || !item.isDynamic) return false;
        if (
          item.meshStart !== undefined &&
          item.meshEnd !== undefined &&
          item.meshEnd > item.meshStart &&
          window.dynamicCollectibleRawVertices &&
          dynamicCollectibleVertexBuffer &&
          typeof gl !== "undefined" &&
          gl
        ) {
          const startF = item.meshStart * 3;
          const endF = item.meshEnd * 3;
          const rawV = window.dynamicCollectibleRawVertices;
          if (endF <= rawV.length) {
            for (let j = startF; j < endF; j++) rawV[j] = 0;
            const sliceView = rawV.subarray(startF, endF);
            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleVertexBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, startF * 4, sliceView);
            return true;
          }
        }
        return false;
      };

      // === AUTHORITATIVE CENTRALIZED WHEELED BOAT CONTROLLER ===
      window.updateWheeledBoatControls = function(boat, inputState, dt) {
        if (!boat) return null;
        dt = (typeof dt === "number" && dt > 0) ? dt : 1.0;
        const moveForwardInput = (typeof inputState.moveForwardInput === "number") ? inputState.moveForwardInput : 0;
        const moveSidewaysInput = (typeof inputState.moveSidewaysInput === "number") ? inputState.moveSidewaysInput : 0;
        const isShiftHeld = !!inputState.isShiftHeld;
        const isHandbrake = !!inputState.isHandbrake;
        const pSpeed = (typeof inputState.playerSpeed === "number" && inputState.playerSpeed > 0) ? inputState.playerSpeed : 0.005;
        const isInWater = !!inputState.isInWater;
        const waterEnabled = !!inputState.waterEnabled;
        const charScale = (typeof inputState.charScale === "number") ? inputState.charScale : 1.0;
        let heading = (typeof inputState.charHeading === "number") ? inputState.charHeading : 0;
        const pitchGrade = (typeof inputState.pitchGrade === "number") ? inputState.pitchGrade : (boat.pitchGrade || 0);
        const allowHudNotice = inputState.silentNotice !== true;
        const shouldConsumeBattery = inputState.consumeBattery !== false;

        const hasWing = !!(boat.hasWing || boat.hasWings);
        const hasWheels = !!(boat.hasWheel || boat.hasWheels || (boat.wheelCount && boat.wheelCount > 0));
        const isLandBoat = hasWheels || hasWing;
        const hasEngine = !!boat.hasEngine;
        const hasBattery = (typeof inputState.hasBattery === "boolean")
          ? inputState.hasBattery
          : (typeof window.BatterySystem !== "undefined" && window.BatterySystem.hasActiveBattery());
        const isAirborne = !!(boat.isAirborne && !isInWater);
        const isControlledFlight = !!(boat.isFlying && hasWing);

        let moveNorthFactor = 0;
        let moveEastFactor = 0;
        let currentSpeedVal = 0;

        if (isLandBoat) {
            // === 1. FRONT WHEEL STEERING ANGLE ===
            // Left (A, moveSidewaysInput = -1) -> targetSteer = +0.52 (wheels point Left along +R)
            // Right (D, moveSidewaysInput = +1) -> targetSteer = -0.52 (wheels point Right along -R)
            const maxSteerRad = 0.52; // ~30 degrees
            const targetSteer = -moveSidewaysInput * maxSteerRad;
            let currentSteer = boat.steerAngle || 0;
            currentSteer += (targetSteer - currentSteer) * Math.min(1.0, 0.25 * dt);
            boat.steerAngle = currentSteer;

            // === 2. ACCELERATION, BRAKING, REVERSING & HANDBRAKE ===
            let vehSpeed = boat.vehicleSpeed || 0;
            let topFwdSpeed = (hasEngine && hasBattery) ? pSpeed * 5.0 : (hasEngine ? pSpeed * 0.5 : (!hasWheels && isInWater ? pSpeed * 1.5 : 0));
            let topRevSpeed = (hasEngine && hasBattery) ? pSpeed * 2.0 : (hasEngine ? pSpeed * 0.2 : (!hasWheels && isInWater ? pSpeed * 0.8 : 0));
            let accelPower = (hasEngine && hasBattery) ? pSpeed * 0.16 * dt : (!hasWheels && isInWater && !hasEngine ? pSpeed * 0.08 * dt : 0);
            let brakePower = pSpeed * 0.30 * dt;
            let coastFriction = Math.pow(isInWater ? 0.96 : ((isAirborne || boat.isFlying) && hasWing ? 0.995 : 0.985), dt);

            if (hasWing && hasEngine && hasBattery && (boat.isFlying || isShiftHeld)) {
                topFwdSpeed = Math.max(topFwdSpeed, pSpeed * 4.5);
                accelPower = Math.max(accelPower, pSpeed * 0.16 * dt);
            }

            const canAccelerate = (hasEngine && hasBattery) || (!hasWheels && isInWater && !hasEngine);

            // Feedback notices
            if (allowHudNotice) {
                if (!hasEngine && hasWheels && (Math.abs(moveForwardInput) > 0.1 || Math.abs(moveSidewaysInput) > 0.1)) {
                    const nowTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
                    if (typeof showNotice === "function" && (!boat._lastEngineNotice || nowTime - boat._lastEngineNotice > 3000)) {
                        boat._lastEngineNotice = nowTime;
                        showNotice("เรือติดล้อต้องติดตั้งเครื่องยนต์ไฟฟ้าก่อนจึงจะขับเคลื่อนได้! (Attach Electric Engine to drive wheeled boat)");
                    }
                } else if (hasEngine && !hasBattery && (Math.abs(moveForwardInput) > 0.1 || (boat.isFlying && isShiftHeld))) {
                    if (typeof window.BatterySystem !== "undefined") {
                        window.BatterySystem.showEmptyNotice();
                    }
                }
            }

            const isUsingPower = Math.abs(moveForwardInput) > 0.1 || (boat.isFlying && isShiftHeld);
            if (shouldConsumeBattery && hasEngine && hasBattery && isUsingPower) {
                if (typeof window.BatterySystem !== "undefined") {
                    window.BatterySystem.consumePower(dt);
                }
            }

            boat.isHandbraking = isHandbrake && !boat.isFlying;

            // Slope gravity roll
            const gravityRollPower = pitchGrade * pSpeed * 0.4 * dt * (isInWater ? 0.2 : 1.0);
            if (!boat.isHandbraking) {
                vehSpeed -= gravityRollPower;
            }

            // Slope angle limit (Cliffs steeper than 45 degrees / pitchGrade > 1.0 cannot be driven up)
            // 45-degree angle condition ONLY works on land/ground, NEVER on water or in flight!
            const isSlopeTooSteep = !isInWater && !boat.isFlying && !isAirborne && (pitchGrade > 1.0);

            if (boat.isHandbraking) {
                vehSpeed *= Math.pow(0.85, dt);
            } else if (moveForwardInput > 0.1 && canAccelerate) {
                if (vehSpeed < -0.01) {
                    vehSpeed += brakePower; // Braking while moving backwards
                } else if (!isSlopeTooSteep) {
                    vehSpeed = Math.min(topFwdSpeed, vehSpeed + accelPower);
                } else {
                    // GTA Style Inertia & Slope Traction Slip:
                    // Does NOT abruptly freeze to 0. Existing inertia smoothly carries momentum,
                    // while drive traction slips (wheels spin without full grip).
                    // Gravity rollback smoothly decelerates and slips the vehicle back down.
                    const tractionGrip = Math.max(0.0, 1.0 - (pitchGrade - 1.0) * 3.0);
                    vehSpeed = Math.min(topFwdSpeed, vehSpeed + accelPower * tractionGrip);
                    vehSpeed -= (pitchGrade * pSpeed * 0.25 * dt);
                }
            } else if (!boat.isFlying && moveForwardInput < -0.1 && canAccelerate) {
                if (vehSpeed > 0.01) {
                    vehSpeed -= brakePower; // Braking while moving forward
                } else {
                    vehSpeed = Math.max(-topRevSpeed, vehSpeed - accelPower); // Reversing backwards
                }
            } else {
                vehSpeed *= coastFriction;
                if (Math.abs(vehSpeed) < 0.00001) vehSpeed = 0;
            }

            boat.vehicleSpeed = vehSpeed;

            // === 3. VEHICLE STEERING / HEADING (UNIFIED REALISTIC FLATOUT / ARCADE CONTROLS) ===
            const refMaxSpeed = pSpeed * 5.0;
            if (!isAirborne && !boat.isFlying) {
                // Forward (W / vehSpeed >= 0):
                //   Press Left (A, currentSteer > 0) -> turnDir = +1 -> heading increases -> turns Left!
                //   Press Right (D, currentSteer < 0) -> turnDir = +1 -> heading decreases -> turns Right!
                // Reverse (S / vehSpeed < 0):
                //   Press Left (A, currentSteer > 0) -> turnDir = -1 -> heading decreases -> rear curves Left, backs up Left!
                //   Press Right (D, currentSteer < 0) -> turnDir = -1 -> heading increases -> rear curves Right, backs up Right!
                const isReversing = (vehSpeed < -0.001 || (moveForwardInput < -0.1 && vehSpeed <= 0.001));
                const turnDir = isReversing ? -1 : 1;
                const driftMultiplier = boat.isHandbraking ? 2.4 : 1.0;

                if (Math.abs(vehSpeed) > 0.001) {
                    const turnRate = currentSteer * (Math.abs(vehSpeed) / refMaxSpeed) * 0.035 * turnDir * driftMultiplier;
                    heading += turnRate * dt;
                }
                if (Math.abs(moveSidewaysInput) > 0.05) {
                    const lowSpeedTurning = Math.max(0.0, 1.0 - Math.abs(vehSpeed) / refMaxSpeed);
                    if (canAccelerate || Math.abs(vehSpeed) > 0.0005 || isInWater) {
                        heading += currentSteer * 0.025 * dt * lowSpeedTurning * turnDir;
                    }
                }
            } else if (isControlledFlight) {
                // Controlled wing flight: bank & steer
                heading += currentSteer * 0.045 * dt;
            }

            // === 4. WHEEL SPIN ANGLE ===
            const isFlyingInAir = !!(isAirborne || boat.isFlying);
            if (!isFlyingInAir) {
                const wheelScale = typeof window.wheelScaleMultiplier === "number" ? window.wheelScaleMultiplier : 1.0;
                const wheelRadius = 0.16 * wheelScale;
                const distTraveled = vehSpeed * dt;
                boat.spinAngle = (boat.spinAngle || 0) + (distTraveled / wheelRadius);
                boat.frozenSpinAngle = boat.spinAngle;
            } else {
                if (boat.frozenSpinAngle === undefined) {
                    boat.frozenSpinAngle = boat.spinAngle || 0;
                }
                boat.spinAngle = boat.frozenSpinAngle;
            }

            // === 5. MOVEMENT VECTORS ===
            let speedRatio = vehSpeed / pSpeed;
            if (Math.abs(speedRatio) > 0.001) {
                moveNorthFactor = Math.cos(heading) * Math.sign(speedRatio);
                moveEastFactor  = Math.sin(heading) * Math.sign(speedRatio);
            } else if (moveForwardInput !== 0) {
                moveNorthFactor = Math.cos(heading) * moveForwardInput;
                moveEastFactor  = Math.sin(heading) * moveForwardInput;
            }
            currentSpeedVal = Math.abs(vehSpeed);
        } else {
            // Water-only boat (no wheels and no wings)
            let canRow = isInWater;
            if (canRow) {
                heading += -moveSidewaysInput * 0.05 * dt;
                moveNorthFactor = Math.cos(heading) * moveForwardInput;
                moveEastFactor  = Math.sin(heading) * moveForwardInput;
                const hasEngineActive = hasEngine && hasBattery;
                currentSpeedVal = hasEngineActive ? pSpeed * 5.0 : pSpeed * 1.5;
            } else {
                moveNorthFactor = 0;
                moveEastFactor = 0;
                currentSpeedVal = 0;
                if (allowHudNotice && (Math.abs(moveForwardInput) > 0.1 || Math.abs(moveSidewaysInput) > 0.1)) {
                    const nowTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
                    if (typeof showNotice === "function" && (!boat._lastLandNotice || nowTime - boat._lastLandNotice > 3000)) {
                        boat._lastLandNotice = nowTime;
                        showNotice("เรือต้องอยู่บนน้ำ หรือติดล้อไม้เพื่อวิ่งบนบก! (Attach Wooden Wheel to drive on land)");
                    }
                }
            }
        }

        return {
            heading,
            moveNorthFactor,
            moveEastFactor,
            currentSpeedVal
        };
      };

      function updateCollectibles(dt) {
        if (!collectibles || collectibles.length === 0) return;
        
        let needRefresh = false;
        let needMainRefresh = false;
        const gravityAccel = Physics.gravityAccel;

        // --- Active Floor Placement Preview Update ---
        const isInventoryOpen = document.getElementById("inventoryOverlay")?.classList.contains("open");
        if (isPlacingFloor && !isInventoryOpen) {
          const placingItemName = floorPlacementInfo && floorPlacementInfo.item ? floorPlacementInfo.item.name : "";
          const typeToPlace = placingItemName.startsWith("ROBOT_") ? placingItemName.toLowerCase()
            : placingItemName === "STONE_FLOOR" ? "stone_floor"
            : placingItemName === "WOOD_STAIRS" ? "wood_stairs"
            : placingItemName === "FOLDING_LADDER" ? "folding_ladder"
            : placingItemName === "CAMPFIRE" ? "campfire"
            : placingItemName === "WOOD_BOAT" ? "wood_boat"
            : placingItemName === "ELECTRIC_ENGINE" ? "electric_engine"
            : placingItemName === "BOAT_WING" ? "boat_wing"
            : placingItemName === "WOOD_WHEEL" ? "wood_wheel"
            : placingItemName === "WOOD_WALL" ? "wood_wall"
            : placingItemName === "WOOD_WINDOW" ? "wood_window"
            : placingItemName === "WOOD_DOOR" ? "wood_door"
            : placingItemName === "WOOD_ROOF" ? "wood_roof"
            : placingItemName === "WOOD_CHEST" ? "wood_chest"
            : placingItemName === "WOOD_BED" ? "wood_bed"
            : placingItemName === "WOOD_TABLE" ? "wood_table"
            : placingItemName === "WOOD_PLANTER_BOX" ? "wood_planter_box"
            : placingItemName === "WOOD_CHAIR" ? "wood_chair"
            : placingItemName === "LANTERN" ? "lantern"
            : placingItemName === "MEGANEURA" ? "meganeura_item"
            : placingItemName === "ISOPOD" ? "isopod_item"
            : (placingItemName === "OBSIDIAN_PAD_WARP" || placingItemName === "OBSIDIAN_COMPASS_PAD") ? "obsidian_pad_warp_item"
            : placingItemName === "THIN_WOOD_FLOOR" ? "thin_wood_floor"
            : "wood_floor";

          if (!floorPreviewCollectible || floorPreviewCollectible.type !== typeToPlace) {
            // Remove mismatched preview if it exists
            if (floorPreviewCollectible) {
              const idx = collectibles.indexOf(floorPreviewCollectible);
              if (idx !== -1) collectibles.splice(idx, 1);
            }
            floorPreviewCollectible = {
              type: typeToPlace,
              position: [0, 0, 0],
              normal: [0, 1, 0],
              R: [1, 0, 0],
              F: [0, 0, 1],
              U: [0, 1, 0],
              color: [0.95, 0.85, 0.45], // preview highlight color
              size: typeToPlace === "campfire" ? campfireSize : 0.25,
              active: true,
              isDynamic: false,
              isPreview: true,
              seed: Math.random()
            };
            collectibles.push(floorPreviewCollectible);
            floorPreviewCollectible = collectibles[collectibles.length - 1];
            window.floorPreviewCollectible = floorPreviewCollectible;
            if (typeToPlace === "wood_wall" || typeToPlace === "wood_window" || typeToPlace === "wood_door" || typeToPlace === "wood_chest" || typeToPlace === "wood_bed" || typeToPlace === "wood_table" || typeToPlace === "wood_planter_box" || typeToPlace === "wood_chair" || typeToPlace === "lantern" || typeToPlace === "meganeura_item" || typeToPlace === "isopod_item" || typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item" || typeToPlace === "wood_boat" || typeToPlace === "wood_wheel" || typeToPlace === "electric_engine" || typeToPlace === "boat_wing" || typeToPlace.startsWith("robot_")) {
              floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
            } else if (typeToPlace === "wood_floor" || typeToPlace === "thin_wood_floor" || typeToPlace === "wood_roof" || typeToPlace === "folding_ladder") {
              floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_FLOOR;
            } else if (typeToPlace === "stone_floor") {
              floorPreviewCollectible.layer = COLLISION_LAYERS.STONE_FLOOR;
            }
          }

          // Update position to float in front of player, conforming to the terrain/ground surface
          const sinTheta = Math.sin(charTheta);
          const cosTheta = Math.cos(charTheta);
          const sinPhi = Math.sin(charPhi);
          const cosPhi = Math.cos(charPhi);

          const nx = sinTheta * cosPhi;
          const ny = cosTheta;
          const nz = sinTheta * sinPhi;
          
          const sampleTerrainH = (typeof getVisualHeightOnSphere === "function") ? getVisualHeightOnSphere : getHeightOnSphere;
          let height = sampleTerrainH(charTheta, charPhi, globalSeed);
          let terrainRadius = RADIUS + height * HEIGHT_SCALE;
          let groundRadius = terrainRadius;
          
          const charScaleVal = (typeof playerScale !== 'undefined') ? playerScale : 0.1;
          const currentFeetRad = (typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null)
            ? (playerCenterRadius - 0.46 * charScaleVal)
            : terrainRadius;

          let playerCaveInfo = null;
          let isPlayerInCave = false;
          if (typeof getTerrainSurfaceAndCeiling === "function") {
            playerCaveInfo = getTerrainSurfaceAndCeiling(nx, ny, nz, currentFeetRad);
            if (playerCaveInfo && (playerCaveInfo.insideTunnel || currentFeetRad < playerCaveInfo.surfaceRadius - 0.35)) {
              isPlayerInCave = true;
              groundRadius = playerCaveInfo.ground;
              terrainRadius = playerCaveInfo.ground;
            }
          }

          const waterRadius = RADIUS + waterLevel * 0.15;
          if (!isPlayerInCave && waterEnabled && terrainRadius < waterRadius) {
              groundRadius = waterRadius;
          }

          const East = [-sinPhi, 0, cosPhi];
          const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];

          const snappedHeading = Math.round(charHeading / (Math.PI / 2)) * (Math.PI / 2);
          const cosH = Math.cos(snappedHeading);
          const sinH = Math.sin(snappedHeading);

          const F = [
            North[0] * cosH + East[0] * sinH,
            North[1] * cosH + East[1] * sinH,
            North[2] * cosH + East[2] * sinH,
          ];

          const cosAimH = Math.cos(charHeading);
          const sinAimH = Math.sin(charHeading);
          const aimF = [
            North[0] * cosAimH + East[0] * sinAimH,
            North[1] * cosAimH + East[1] * sinAimH,
            North[2] * cosAimH + East[2] * sinAimH,
          ];

          // Set a close forward offset in actual meters (using actionReachDistance with a minimum safety fallback to prevent clipping)
          const baseOffset = typeToPlace === "campfire" ? 0.20 : (typeToPlace === "lantern" ? 0.22 : 0.35);
          const forwardOffset = typeToPlace === "lantern"
            ? ((typeof actionReachDistance === "number" && actionReachDistance > 0.05) ? actionReachDistance : 0.25)
            : ((typeToPlace === "campfire" || typeToPlace === "wood_chest" || typeToPlace === "wood_bed" || typeToPlace === "wood_table" || typeToPlace === "wood_planter_box" || typeToPlace === "wood_chair" || typeToPlace.startsWith("robot_")) 
              ? Math.max(baseOffset, actionReachDistance) 
              : baseOffset); 
          const activePreviewF = (typeToPlace === "lantern") ? aimF : F;
          const activePlayerRad = (typeToPlace === "lantern" && currentFeetRad > groundRadius - 0.05) ? currentFeetRad : groundRadius;
          const playerPt = [nx * activePlayerRad, ny * activePlayerRad, nz * activePlayerRad];
          const previewDir = [
            playerPt[0] + activePreviewF[0] * forwardOffset,
            playerPt[1] + activePreviewF[1] * forwardOffset,
            playerPt[2] + activePreviewF[2] * forwardOffset
          ];
          const len = Math.sqrt(previewDir[0]*previewDir[0] + previewDir[1]*previewDir[1] + previewDir[2]*previewDir[2]);
          const pnx = previewDir[0] / (len || 1);
          const pny = previewDir[1] / (len || 1);
          const pnz = previewDir[2] / (len || 1);

          // Get exact height/ground radius at the preview position (so it floats along/conforms to the ground)
          let previewTheta = Math.acos(Math.max(-1.0, Math.min(1.0, pny)));
          let previewPhi = Math.atan2(pnz, pnx);

          let previewHeight = sampleTerrainH(previewTheta, previewPhi, globalSeed);
          let previewTerrainRadius = RADIUS + previewHeight * HEIGHT_SCALE;
          
          let isInCave = isPlayerInCave;
          if (typeof getTerrainSurfaceAndCeiling === "function") {
              const queryRad = isPlayerInCave ? groundRadius : (previewTerrainRadius - 0.2);
              const caveInfo = getTerrainSurfaceAndCeiling(pnx, pny, pnz, queryRad);
              if (caveInfo && (caveInfo.insideTunnel || isPlayerInCave || caveInfo.ground < previewTerrainRadius - 0.35)) {
                  previewTerrainRadius = caveInfo.ground;
                  isInCave = true;
              }
          }
          
          let previewGroundRadius = previewTerrainRadius;
          let isUnderWater = !isInCave && waterEnabled && previewTerrainRadius < waterRadius;
          if (isUnderWater) {
              previewGroundRadius = waterRadius;
          }
          
          // Calculate slope to prevent placing on too steep ground
          const eps = 0.01;
          const h1 = sampleTerrainH(previewTheta + eps, previewPhi, globalSeed);
          const h2 = sampleTerrainH(previewTheta, previewPhi + eps, globalSeed);
          const dhScale = HEIGHT_SCALE / (eps * Math.max(1, previewTerrainRadius));
          const slopeTheta = Math.abs(h1 - previewHeight) * dhScale;
          const slopePhi = Math.abs(h2 - previewHeight) * dhScale;
          const slopeVal = Math.sqrt(slopeTheta*slopeTheta + slopePhi*slopePhi);
          
          // Valid placement if not on water and not too steep (Stone Floor is valid everywhere, Wood Bed requires wooden floor, Lantern requires wooden table or wooden floor)
          const maxSlope = typeToPlace === "campfire" ? 2.0 : 0.8;
          floorPreviewCollectible.isValidPlacement = (typeToPlace === "wood_bed" || typeToPlace === "lantern") ? false : ((typeToPlace === "stone_floor") ? true : (!isUnderWater && (slopeVal < maxSlope)));
          
          const previewEast = [-Math.sin(previewPhi), 0, Math.cos(previewPhi)];
          const previewNorth = [-Math.cos(previewTheta) * Math.cos(previewPhi), Math.sin(previewTheta), -Math.cos(previewTheta) * Math.sin(previewPhi)];

          let pF = [
            previewNorth[0] * cosH + previewEast[0] * sinH,
            previewNorth[1] * cosH + previewEast[1] * sinH,
            previewNorth[2] * cosH + previewEast[2] * sinH,
          ];

          let pR = [
            previewEast[0] * cosH - previewNorth[0] * sinH,
            previewEast[1] * cosH - previewNorth[1] * sinH,
            previewEast[2] * cosH - previewNorth[2] * sinH,
          ];

          if (typeToPlace === "wood_roof") {
            // Roof rotation is manual via the Q key (placementRotationAngle), independent of camera heading
            const rotA = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
            const cosRot = Math.cos(rotA);
            const sinRot = Math.sin(rotA);
            pR = [
              previewEast[0] * cosRot + previewNorth[0] * sinRot,
              previewEast[1] * cosRot + previewNorth[1] * sinRot,
              previewEast[2] * cosRot + previewNorth[2] * sinRot,
            ];
            pF = [
              previewNorth[0] * cosRot - previewEast[0] * sinRot,
              previewNorth[1] * cosRot - previewEast[1] * sinRot,
              previewNorth[2] * cosRot - previewEast[2] * sinRot,
            ];
            floorPreviewCollectible.angle = 0.0;
          }

          let pN = [pnx, pny, pnz];

          // "ลอยสูงจากพื้นเสมอ" -> float slightly above the ground at the preview location
          const bobAmt = typeToPlace === "campfire" ? 0.005 : (typeToPlace === "wood_planter_box" ? 0.0 : (typeToPlace === "wood_chest" || typeToPlace === "wood_bed" || typeToPlace === "wood_table" || typeToPlace === "wood_chair" || typeToPlace === "lantern" || typeToPlace === "meganeura_item" || typeToPlace === "isopod_item" ? 0.015 : ((typeToPlace === "stone_floor") ? 0.03 : ((typeToPlace === "wood_floor" || typeToPlace === "thin_wood_floor" || typeToPlace === "wood_roof") ? 0.05 : 0.12))));
          let bob = typeToPlace === "campfire" ? 0.005 : (typeToPlace === "wood_planter_box" ? 0.0 : (Math.sin(Date.now() * 0.003) * 0.01 + bobAmt)); 
          if (typeToPlace === "robot_cockpit") bob = 0.14;
          else if (typeToPlace === "robot_left_leg" || typeToPlace === "robot_right_leg") bob = 0.14;
          else if (typeToPlace === "robot_stand") bob = 0.0;
          else if (typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item") bob = 0.002;
          else if (typeToPlace.startsWith("robot_")) bob = 0.35;

          const effectivePreviewRad = (typeToPlace === "lantern" && currentFeetRad > previewGroundRadius - 0.05)
              ? currentFeetRad
              : previewGroundRadius;
          let targetPos = [
              (effectivePreviewRad + bob) * pnx,
              (effectivePreviewRad + bob) * pny,
              (effectivePreviewRad + bob) * pnz
          ];

          // --- SNAPPING LOGIC ---
          let isSnapped = false;
          let bestSnapPos = null;
          let bestSnapDist = Infinity;
          let snapParent = null;
          let bestP_top = null;
          let bestP_bottom = null;
          let bestW_dir = null;
          let bestSlope_dir = null;

          const floorWidth = 0.3;
          const floorDepth = 0.3;

          if (typeToPlace === "wood_stairs") {
            // Snapping wood stairs to wood/stone floor edges
            for (let other of collectibles) {
              if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") && !other.isPreview) {
                const odx = other.position[0] - targetPos[0];
                const ody = other.position[1] - targetPos[1];
                const odz = other.position[2] - targetPos[2];
                if (odx*odx + ody*ody + odz*odz > 36.0) continue; // Skip distant floors (>6m)

                const isStone = other.type === "stone_floor";
                const w = isStone ? other.size * 12.0 : other.size * 1.2;
                const d = isStone ? other.size * 12.0 : other.size * 1.2;
                const hw = w / 2;
                const hd = d / 2;
                
                let rBase = other.R;
                let fBase = other.F;
                
                // Define the edges
                let edges = [];
                let floorHH = 0;
                if (other.type === "stone_floor") floorHH = other.size * 0.15 / 2;
                else if (other.type === "wood_floor") floorHH = (woodFloorHeight + other.size * 0.12) / 2;
                else if (other.type === "thin_wood_floor") floorHH = other.size * 0.04 / 2;
                
                const nx = other.normal[0] * floorHH;
                const ny = other.normal[1] * floorHH;
                const nz = other.normal[2] * floorHH;
                
                edges = [
                  { center: [other.position[0] + rBase[0] * hw + nx, other.position[1] + rBase[1] * hw + ny, other.position[2] + rBase[2] * hw + nz], T: [fBase[0], fBase[1], fBase[2]], slope: [rBase[0], rBase[1], rBase[2]], halfL: hd },
                  { center: [other.position[0] - rBase[0] * hw + nx, other.position[1] - rBase[1] * hw + ny, other.position[2] - rBase[2] * hw + nz], T: [fBase[0], fBase[1], fBase[2]], slope: [-rBase[0], -rBase[1], -rBase[2]], halfL: hd },
                  { center: [other.position[0] + fBase[0] * hd + nx, other.position[1] + fBase[1] * hd + ny, other.position[2] + fBase[2] * hd + nz], T: [rBase[0], rBase[1], rBase[2]], slope: [fBase[0], fBase[1], fBase[2]], halfL: hw },
                  { center: [other.position[0] - fBase[0] * hd + nx, other.position[1] - fBase[1] * hd + ny, other.position[2] - fBase[2] * hd + nz], T: [rBase[0], rBase[1], rBase[2]], slope: [-fBase[0], -fBase[1], -fBase[2]], halfL: hw }
                ];

                for (let edge of edges) {
                  let isOccupied = false;
                  for (let c of collectibles) {
                      if (!c.active || c.isPreview) continue;
                      if (c === other) continue;
                      
                      const dx = c.position[0] - edge.center[0];
                      const dy = c.position[1] - edge.center[1];
                      const dz = c.position[2] - edge.center[2];
                      if (dx*dx + dy*dy + dz*dz > 4.0) continue; // Skip distant collectibles (>2m)
                      
                      const outwardDist = dx * edge.slope[0] + dy * edge.slope[1] + dz * edge.slope[2];
                      const sidewaysDist = dx * edge.T[0] + dy * edge.T[1] + dz * edge.T[2];
                      const verticalDist = dx * other.normal[0] + dy * other.normal[1] + dz * other.normal[2];
                      
                      if (c.type === "wood_floor" || c.type === "thin_wood_floor") {
                          if (outwardDist > 0.05 && outwardDist < 0.25 && Math.abs(sidewaysDist) < 0.1 && Math.abs(verticalDist) < 0.1) {
                              isOccupied = true;
                              break;
                          }
                      } else if (c.type === "wood_stairs") {
                          if (outwardDist > 0.05 && outwardDist < 0.25 && Math.abs(sidewaysDist) < 0.1 && Math.abs(verticalDist) < 0.25) {
                              isOccupied = true;
                              break;
                          }
                      }
                  }
                  if (isOccupied) continue;
                  
                  // Find closest point on segment
                  const dx_vec = [
                    targetPos[0] - edge.center[0],
                    targetPos[1] - edge.center[1],
                    targetPos[2] - edge.center[2]
                  ];
                  const t = dx_vec[0] * edge.T[0] + dx_vec[1] * edge.T[1] + dx_vec[2] * edge.T[2];
                  let clampedT = Math.max(-edge.halfL + 0.05, Math.min(edge.halfL - 0.05, t));
                  // Snap the horizontal offset along the edge to a multiple of 0.3 for grid alignment
                  clampedT = Math.round(clampedT / 0.3) * 0.3;
                  
                  const P_top = [
                    edge.center[0] + edge.T[0] * clampedT,
                    edge.center[1] + edge.T[1] * clampedT,
                    edge.center[2] + edge.T[2] * clampedT
                  ];
                  const slope_dir = edge.slope;
                  const W_dir = edge.T;

                  // Calculate P_bottom along the slope direction on the planet ground
                  const L_horizontal = 0.3;
                  const P_temp = [
                    P_top[0] + slope_dir[0] * L_horizontal,
                    P_top[1] + slope_dir[1] * L_horizontal,
                    P_top[2] + slope_dir[2] * L_horizontal
                  ];
                  const len_temp = Math.sqrt(P_temp[0]*P_temp[0] + P_temp[1]*P_temp[1] + P_temp[2]*P_temp[2]) || 1;
                  const n_temp = [P_temp[0] / len_temp, P_temp[1] / len_temp, P_temp[2] / len_temp];
                  
                  const theta_temp = Math.acos(Math.max(-1.0, Math.min(1.0, n_temp[1])));
                  const phi_temp = Math.atan2(n_temp[2], n_temp[0]);
                  const height_temp = getHeightOnSphere(theta_temp, phi_temp, globalSeed);
                  let r_temp = RADIUS + height_temp * HEIGHT_SCALE;
                  
                  const top_r = P_top[0]*n_temp[0] + P_top[1]*n_temp[1] + P_top[2]*n_temp[2];
                  let maxFloorRadius = r_temp;
                  
                  for (let other of collectibles) {
                    if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor" || other.type === "stone_wall" || other.type === "wood_wall") && !other.isPreview) {
                      const ox = other.position[0];
                      const oy = other.position[1];
                      const oz = other.position[2];
                      const fdx = ox - P_temp[0];
                      const fdy = oy - P_temp[1];
                      const fdz = oz - P_temp[2];
                      if (fdx*fdx + fdy*fdy + fdz*fdz > 36.0) continue; // Skip distant structures (>6m)
                      
                      const verticalDist = ox*n_temp[0] + oy*n_temp[1] + oz*n_temp[2];
                      
                      let hw = 0.15;
                      if (other.type === "stone_floor") hw = 1.5;
                      
                      const dx = P_temp[0] - ox;
                      const dy = P_temp[1] - oy;
                      const dz = P_temp[2] - oz;
                      const localX = dx * other.R[0] + dy * other.R[1] + dz * other.R[2];
                      const localZ = dx * other.F[0] + dy * other.F[1] + dz * other.F[2];
                      
                      if (Math.abs(localX) <= hw + 0.05 && Math.abs(localZ) <= hw + 0.05 && verticalDist >= r_temp) {
                         let surface_r = verticalDist;
                         if (other.type.includes("wall")) {
                            surface_r += 0.125; 
                         } else if (other.type === "stone_floor") {
                            surface_r += other.size * 0.15 / 2;
                         } else if (other.type === "wood_floor") {
                            surface_r += (woodFloorHeight + other.size * 0.12) / 2;
                         } else if (other.type === "thin_wood_floor") {
                            surface_r += other.size * 0.04 / 2;
                         }
                         
                         if (surface_r > maxFloorRadius && surface_r < top_r - 0.05) {
                            maxFloorRadius = surface_r;
                         }
                      }
                    }
                  }
                  
                  r_temp = maxFloorRadius;
                  // Enforce a minimum vertical drop to ensure the stairs are never flat
                  if (top_r - r_temp < 0.22) {
                      r_temp = top_r - 0.25;
                  }
                  const P_bottom = [n_temp[0] * r_temp, n_temp[1] * r_temp, n_temp[2] * r_temp];

                  // Stair midpoint center
                  const P_mid = [
                    (P_top[0] + P_bottom[0]) / 2,
                    (P_top[1] + P_bottom[1]) / 2,
                    (P_top[2] + P_bottom[2]) / 2
                  ];

                  const dx = P_mid[0] - targetPos[0];
                  const dy = P_mid[1] - targetPos[1];
                  const dz = P_mid[2] - targetPos[2];
                  
                  // For stairs, give less weight to the vertical difference (distance from ground)
                  // since targetPos is constrained to the ground, but stairs can be snapped to 2nd floors.
                  const verticalDiff = dx * pN[0] + dy * pN[1] + dz * pN[2];
                  const horizontalDistSq = (dx*dx + dy*dy + dz*dz) - verticalDiff*verticalDiff;
                  let dist = Math.sqrt(horizontalDistSq + verticalDiff*verticalDiff * 0.1);

                  if (dist < bestSnapDist) {
                    bestSnapDist = dist;
                    bestSnapPos = P_mid;
                    snapParent = other;
                    bestP_top = P_top;
                    bestP_bottom = P_bottom;
                    bestW_dir = W_dir;
                    bestSlope_dir = slope_dir;
                  }
                }
              }
            }

            if (bestSnapPos && bestSnapDist < 0.6) {
              targetPos = bestSnapPos;
              pN = [snapParent.normal[0], snapParent.normal[1], snapParent.normal[2]];
              pR = [bestW_dir[0], bestW_dir[1], bestW_dir[2]];
              pF = [bestSlope_dir[0], bestSlope_dir[1], bestSlope_dir[2]];
              isSnapped = true;
              floorPreviewCollectible.isValidPlacement = true;

                            floorPreviewCollectible.stairTop = bestP_top;
              floorPreviewCollectible.stairBottom = bestP_bottom;
            } else {
              if (floorPreviewCollectible) {
                floorPreviewCollectible.wasSnappedToCave = false;
              }
              // Not snapped to floor edge: place stairs in front of player on the ground, going UP and AWAY (cave snapping disabled for wood_stairs).
              let cx = playerPt[0];
              let cy = playerPt[1];
              let cz = playerPt[2];
              const L_horizontal = 0.3;
              
              const dx = targetPos[0] - cx;
              const dy = targetPos[1] - cy;
              const dz = targetPos[2] - cz;
              
              const localX = dx * pR[0] + dy * pR[1] + dz * pR[2];
              const localZ = dx * pF[0] + dy * pF[1] + dz * pF[2];
              
              let gridX = Math.round(localX / 0.3);
              let gridZ = Math.round(localZ / 0.3);
              
              gridX = Math.max(-1, Math.min(1, gridX));
              gridZ = Math.max(1, Math.min(2, gridZ)); // Force it to be in front
              
              const P_bottom_start = [
                cx + pR[0] * (gridX * 0.3) + pF[0] * (gridZ * 0.3),
                cy + pR[1] * (gridX * 0.3) + pF[1] * (gridZ * 0.3),
                cz + pR[2] * (gridX * 0.3) + pF[2] * (gridZ * 0.3)
              ];

              const slope_dir = [pF[0], pF[1], pF[2]];

              // Calculate true ground height for P_bottom
              const len_b = Math.sqrt(P_bottom_start[0]*P_bottom_start[0] + P_bottom_start[1]*P_bottom_start[1] + P_bottom_start[2]*P_bottom_start[2]) || 1;
              const n_b = [P_bottom_start[0] / len_b, P_bottom_start[1] / len_b, P_bottom_start[2] / len_b];
              const theta_b = Math.acos(Math.max(-1.0, Math.min(1.0, n_b[1])));
              const phi_b = Math.atan2(n_b[2], n_b[0]);
              const height_b = getHeightOnSphere(theta_b, phi_b, globalSeed);
              let r_b = RADIUS + height_b * HEIGHT_SCALE;
              if (typeof getTerrainSurfaceAndCeiling === "function") {
                  const caveInfoB = getTerrainSurfaceAndCeiling(n_b[0], n_b[1], n_b[2], RADIUS - 0.5);
                  if (caveInfoB && caveInfoB.ground < r_b - 0.5) {
                      r_b = caveInfoB.ground;
                  }
              }
              
              for (let other of collectibles) {
                if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor" || other.type === "stone_wall" || other.type === "wood_wall") && !other.isPreview) {
                  const ox = other.position[0], oy = other.position[1], oz = other.position[2];
                  const verticalDist = ox*n_b[0] + oy*n_b[1] + oz*n_b[2];
                  
                  let hw = 0.15;
                  if (other.type === "stone_floor") hw = 1.5;
                  
                  const dx = P_bottom_start[0] - ox;
                  const dy = P_bottom_start[1] - oy;
                  const dz = P_bottom_start[2] - oz;
                  const localX = dx * other.R[0] + dy * other.R[1] + dz * other.R[2];
                  const localZ = dx * other.F[0] + dy * other.F[1] + dz * other.F[2];
                  
                  if (Math.abs(localX) <= hw + 0.05 && Math.abs(localZ) <= hw + 0.05 && verticalDist >= r_b) {
                     let surface_r = verticalDist;
                     if (other.type.includes("wall")) surface_r += 0.125; 
                     else if (other.type === "stone_floor") surface_r += other.size * 0.15 / 2;
                     else if (other.type === "wood_floor") surface_r += (woodFloorHeight + other.size * 0.12) / 2;
                     else if (other.type === "thin_wood_floor") surface_r += other.size * 0.04 / 2;
                     
                     if (surface_r > r_b) r_b = surface_r;
                  }
                }
              }
              const P_bottom = [n_b[0] * r_b, n_b[1] * r_b, n_b[2] * r_b];

              // Make stairs rigid and of a fixed size by default.
              let H_vertical = 0.25;
              let L_actual = L_horizontal;
              
              // If aiming downwards slightly, flip the stair so it builds down.
              const lookDownAngle = pnx*n_b[0] + pny*n_b[1] + pnz*n_b[2];
              if (lookDownAngle < -0.2) {
                 H_vertical = -0.25;
              }

              // Crucial: Enforce a minimum absolute height difference to guarantee the stairs are never horizontal/flat.
              if (Math.abs(H_vertical) < 0.22) {
                  H_vertical = (H_vertical >= 0) ? 0.22 : -0.22;
                  L_actual = Math.max(L_actual, Math.abs(H_vertical) * 0.6);
              }

              let P_top = [
                P_bottom[0] + slope_dir[0] * L_actual + n_b[0] * H_vertical,
                P_bottom[1] + slope_dir[1] * L_actual + n_b[1] * H_vertical,
                P_bottom[2] + slope_dir[2] * L_actual + n_b[2] * H_vertical
              ];

              targetPos = [
                (P_top[0] + P_bottom[0]) / 2,
                (P_top[1] + P_bottom[1]) / 2,
                (P_top[2] + P_bottom[2]) / 2
              ];

              floorPreviewCollectible.stairTop = P_top;
              floorPreviewCollectible.stairBottom = P_bottom;
              floorPreviewCollectible.isValidPlacement = !isUnderWater && (slopeVal < maxSlope);
            }
          } else if (typeToPlace === "folding_ladder") {
            // DEATH STRANDING EXTENDABLE FOLDING LADDER PLACEMENT
            // Requirement: Firmly anchored at player's feet, conforming naturally to terrain, slopes, cliffs, caves & holes
            // Descending down into drops/cave mouths naturally ("ตั้งลงไปตามธรรมชาติ")
            // Both ends (Head and Tail) MUST be anchored to solid ground/structure/rock.
            // Under NO circumstance can it be placed on water, underwater, or floating in empty air!

            const isPlayerInWater = (typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0.05) ||
                                    (typeof isDivingMode !== "undefined" && isDivingMode);

            // Use continuous charHeading (not 90-degree snapped) so ladder faces player's look direction
            const hCos = Math.cos(charHeading);
            const hSin = Math.sin(charHeading);
            const forwardUnsnapped = [
              North[0] * hCos + East[0] * hSin,
              North[1] * hCos + East[1] * hSin,
              North[2] * hCos + East[2] * hSin,
            ];
            const rightUnsnapped = [
              East[0] * hCos - North[0] * hSin,
              East[1] * hCos - North[1] * hSin,
              East[2] * hCos - North[2] * hSin,
            ];

            const rotA = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
            const cosRot = Math.cos(rotA);
            const sinRot = Math.sin(rotA);

            let ladderF = [
              forwardUnsnapped[0] * cosRot - rightUnsnapped[0] * sinRot,
              forwardUnsnapped[1] * cosRot - rightUnsnapped[1] * sinRot,
              forwardUnsnapped[2] * cosRot - rightUnsnapped[2] * sinRot,
            ];
            let ladderR = [
              rightUnsnapped[0] * cosRot + forwardUnsnapped[0] * sinRot,
              rightUnsnapped[1] * cosRot + forwardUnsnapped[1] * sinRot,
              rightUnsnapped[2] * cosRot + forwardUnsnapped[2] * sinRot,
            ];

            const lenF = Math.hypot(ladderF[0], ladderF[1], ladderF[2]) || 1;
            ladderF = [ladderF[0]/lenF, ladderF[1]/lenF, ladderF[2]/lenF];
            const lenR = Math.hypot(ladderR[0], ladderR[1], ladderR[2]) || 1;
            ladderR = [ladderR[0]/lenR, ladderR[1]/lenR, ladderR[2]/lenR];

            // Camera pitch detection: looking down into hole/slope vs looking forward/up
            const camPitch = (typeof rotationX === "number") ? rotationX : (typeof window.freeCamPitch === "number" ? window.freeCamPitch : 0.0);
            const isLookingDown = (camPitch > 0.05);
            const isLookingUp = (camPitch < -0.05);

            // 1. EXACT Player Feet Position in World Space
            const charScaleVal = (typeof playerScale !== 'undefined') ? playerScale : 0.1;
            const seedVal = (typeof globalSeed !== "undefined") ? globalSeed : ((typeof window !== "undefined" && window.globalSeed !== "undefined") ? window.globalSeed : 0);
            const pUp = [nx, ny, nz];

            const playerFeetRad = (typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null)
              ? (playerCenterRadius - 0.46 * charScaleVal)
              : groundRadius;
            const playerFeetPos = [nx * playerFeetRad, ny * playerFeetRad, nz * playerFeetRad];

            // Surface terrain radius directly at player
            const pTheta = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
            const pPhi = Math.atan2(nz, nx);
            const pSurfH = typeof getHeightOnSphere === "function" ? getHeightOnSphere(pTheta, pPhi, seedVal) : 0;
            const pSurfRad = RADIUS + pSurfH * HEIGHT_SCALE;
            const isPlayerUnderground = (playerFeetRad < pSurfRad - 0.35);

            // 2. Anchor 1 (Tail / Player Footing): firmly on the solid ground right at player's feet
            let testA1 = [
              playerFeetPos[0] + ladderF[0] * 0.16,
              playerFeetPos[1] + ladderF[1] * 0.16,
              playerFeetPos[2] + ladderF[2] * 0.16
            ];
            let lenA1 = Math.hypot(testA1[0], testA1[1], testA1[2]) || 1;
            let nA1 = [testA1[0]/lenA1, testA1[1]/lenA1, testA1[2]/lenA1];

            let rA1 = playerFeetRad;
            if (typeof getFloorTopRadiusAt === "function") {
              const fRad = getFloorTopRadiusAt(nA1[0], nA1[1], nA1[2], playerFeetRad);
              if (fRad > -Infinity && Math.abs(fRad - playerFeetRad) < 0.4) {
                rA1 = fRad;
              }
            } else if (!isPlayerUnderground) {
              const tA1 = Math.acos(Math.max(-1.0, Math.min(1.0, nA1[1])));
              const phiA1 = Math.atan2(nA1[2], nA1[0]);
              rA1 = RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(tA1, phiA1, seedVal) : 0) * HEIGHT_SCALE;
            } else if (typeof getTerrainSurfaceAndCeiling === "function") {
              const cData = getTerrainSurfaceAndCeiling(nA1[0], nA1[1], nA1[2], playerFeetRad);
              if (cData && cData.insideTunnel && cData.ground < pSurfRad - 0.15) {
                rA1 = cData.ground;
              }
            }
            const P_anchor1 = [nA1[0] * rA1, nA1[1] * rA1, nA1[2] * rA1];

            // Helper to test if a 3D point is submerged in water
            const wRadius = RADIUS + (typeof waterLevel !== "undefined" ? waterLevel : 0) * 0.15;
            function isPointInWater(pt) {
              if (typeof waterEnabled === "undefined" || !waterEnabled) return false;
              if (isPlayerUnderground) return false;
              const r = Math.hypot(pt[0], pt[1], pt[2]);
              return (r <= wRadius + 0.02);
            }

            // Helper to query solid surface radius at a unit normal direction
            function getSolidRadAt(nVec, approxR) {
              if (typeof getFloorTopRadiusAt === "function") {
                const fR = getFloorTopRadiusAt(nVec[0], nVec[1], nVec[2], approxR);
                if (fR > -Infinity) return fR;
              }
              const th = Math.acos(Math.max(-1.0, Math.min(1.0, nVec[1])));
              const ph = Math.atan2(nVec[2], nVec[0]);
              const sH = typeof getHeightOnSphere === "function" ? getHeightOnSphere(th, ph, seedVal) : 0;
              const sR = RADIUS + sH * HEIGHT_SCALE;

              if (typeof tunnels3D !== "undefined" && tunnels3D && tunnels3D.length > 0) {
                for (let ti = 0; ti < tunnels3D.length; ti++) {
                  const t = tunnels3D[ti];
                  const testP = [nVec[0] * approxR, nVec[1] * approxR, nVec[2] * approxR];
                  const dx = testP[0] - t.x, dy = testP[1] - t.y, dz = testP[2] - t.z;
                  if (dx*dx + dy*dy + dz*dz < (t.r * 2.5)*(t.r * 2.5)) {
                    const dot = nVec[0]*t.x + nVec[1]*t.y + nVec[2]*t.z;
                    const tSq = t.x*t.x + t.y*t.y + t.z*t.z;
                    const dSq = dot*dot - tSq + t.r*t.r*0.96;
                    if (dSq > 0) {
                      const cFloor = dot - Math.sqrt(dSq);
                      if (cFloor < sR - 0.2) {
                        return cFloor;
                      }
                    }
                  }
                }
              }
              return sR;
            }

            // 3. Check Cave Mouth Snapping FIRST for folding_ladder (บันไดพับ snap ปากถ้ำ)
            let snappedToCave = false;
            let P_cave_top = null;
            let P_cave_bottom = null;
            let wasSnapped = Boolean(typeof floorPreviewCollectible !== 'undefined' && floorPreviewCollectible && floorPreviewCollectible.wasSnappedToCave);

            if (!isPlayerInWater && typeof tunnels3D !== 'undefined' && tunnels3D && tunnels3D.length > 0) {
              let minDist = Infinity;
              let closestTunnel = null;

              for (let t of tunnels3D) {
                const dx1 = t.x - targetPos[0];
                const dy1 = t.y - targetPos[1];
                const dz1 = t.z - targetPos[2];
                const distSqTarget = dx1*dx1 + dy1*dy1 + dz1*dz1;

                const dx2 = t.x - playerFeetPos[0];
                const dy2 = t.y - playerFeetPos[1];
                const dz2 = t.z - playerFeetPos[2];
                const distSqFeet = dx2*dx2 + dy2*dy2 + dz2*dz2;

                const distSq = Math.min(distSqTarget, distSqFeet);

                const t_len = Math.sqrt(t.x*t.x + t.y*t.y + t.z*t.z) || 1;
                const theta_t = Math.acos(Math.max(-1.0, Math.min(1.0, t.y / t_len)));
                const phi_t = Math.atan2(t.z, t.x);
                const height_t = typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta_t, phi_t, seedVal) : 0;
                const maxTerrainRadius = RADIUS + height_t * HEIGHT_SCALE;

                const isMouth = (t_len + t.r * 1.25 >= maxTerrainRadius);
                const limitRadius = t.r * (wasSnapped ? 3.2 : 2.2);
                if (isMouth && distSq < limitRadius * limitRadius && distSq < minDist) {
                  minDist = distSq;
                  closestTunnel = t;
                }
              }

              if (closestTunnel) {
                snappedToCave = true;
                if (floorPreviewCollectible) {
                  floorPreviewCollectible.wasSnappedToCave = true;
                }

                const cx = closestTunnel.x;
                const cy = closestTunnel.y;
                const cz = closestTunnel.z;
                const bestTunnelRadius = closestTunnel.r;

                const t_len = Math.sqrt(cx*cx + cy*cy + cz*cz) || 1;
                const n_t = [cx / t_len, cy / t_len, cz / t_len];

                const theta_t = Math.acos(Math.max(-1.0, Math.min(1.0, n_t[1])));
                const phi_t = Math.atan2(n_t[2], n_t[0]);
                const height_t = typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta_t, phi_t, seedVal) : 0;
                const maxTerrainRadius = RADIUS + height_t * HEIGHT_SCALE;

                const P_surf_center = [n_t[0] * maxTerrainRadius, n_t[1] * maxTerrainRadius, n_t[2] * maxTerrainRadius];

                // Project ladderF onto cave tangent plane so ladder follows player look + Q rotation
                const dot_F_t = ladderF[0]*n_t[0] + ladderF[1]*n_t[1] + ladderF[2]*n_t[2];
                const forwardDir_t = [ladderF[0] - n_t[0]*dot_F_t, ladderF[1] - n_t[1]*dot_F_t, ladderF[2] - n_t[2]*dot_F_t];
                const forwardLen_t = Math.sqrt(forwardDir_t[0]*forwardDir_t[0] + forwardDir_t[1]*forwardDir_t[1] + forwardDir_t[2]*forwardDir_t[2]) || 1;
                const slope_dir = [forwardDir_t[0]/forwardLen_t, forwardDir_t[1]/forwardLen_t, forwardDir_t[2]/forwardLen_t];

                // Position top of ladder on the cave mouth rim/lip closest to the player
                const P_lip = [
                  P_surf_center[0] - slope_dir[0] * (bestTunnelRadius * 1.02),
                  P_surf_center[1] - slope_dir[1] * (bestTunnelRadius * 1.02),
                  P_surf_center[2] - slope_dir[2] * (bestTunnelRadius * 1.02)
                ];

                const len_lip = Math.sqrt(P_lip[0]*P_lip[0] + P_lip[1]*P_lip[1] + P_lip[2]*P_lip[2]) || 1;
                const n_lip = [P_lip[0]/len_lip, P_lip[1]/len_lip, P_lip[2]/len_lip];
                const theta_lip = Math.acos(Math.max(-1.0, Math.min(1.0, n_lip[1])));
                const phi_lip = Math.atan2(n_lip[2], n_lip[0]);
                const height_lip = typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta_lip, phi_lip, seedVal) : 0;
                let r_lip = RADIUS + height_lip * HEIGHT_SCALE;
                if (typeof getFloorTopRadiusAt === "function") {
                  const fRadLip = getFloorTopRadiusAt(n_lip[0], n_lip[1], n_lip[2], r_lip);
                  if (fRadLip > r_lip && fRadLip - r_lip < 0.6) {
                    r_lip = fRadLip;
                  }
                }
                P_cave_top = [n_lip[0]*r_lip, n_lip[1]*r_lip, n_lip[2]*r_lip];

                // Project bottom position onto the cave floor inside the cave mouth
                const L_horizontal = 0.35;
                const P_inward = [
                  P_cave_top[0] + slope_dir[0] * L_horizontal,
                  P_cave_top[1] + slope_dir[1] * L_horizontal,
                  P_cave_top[2] + slope_dir[2] * L_horizontal
                ];
                const len_inward = Math.sqrt(P_inward[0]*P_inward[0] + P_inward[1]*P_inward[1] + P_inward[2]*P_inward[2]) || 1;
                const n_inward = [P_inward[0]/len_inward, P_inward[1]/len_inward, P_inward[2]/len_inward];

                let r_floor = r_lip - 1.2;
                if (typeof getTerrainSurfaceAndCeiling === "function") {
                  const caveInfoTemp = getTerrainSurfaceAndCeiling(n_inward[0], n_inward[1], n_inward[2], r_lip - 0.5);
                  if (caveInfoTemp) {
                    r_floor = caveInfoTemp.ground;
                  }
                }
                const solidFloorR = getSolidRadAt(n_inward, r_lip - 0.5);
                if (solidFloorR < r_lip - 0.25 && solidFloorR < r_floor) {
                  r_floor = solidFloorR;
                }

                const minDrop = Math.max(0.6, bestTunnelRadius * 1.5);
                if (r_floor > r_lip - minDrop) {
                  r_floor = r_lip - minDrop;
                }
                if (r_floor < r_lip - 3.3) {
                  r_floor = r_lip - 3.3;
                }

                P_cave_bottom = [n_inward[0] * r_floor, n_inward[1] * r_floor, n_inward[2] * r_floor];
              }
            }

            if (!snappedToCave && floorPreviewCollectible) {
              floorPreviewCollectible.wasSnappedToCave = false;
            }

            // 4. Probing for Anchor 2 (Landing end) with Fast Directional Raymarching & Transform Caching (when not snapped to cave mouth)
            const nowTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
            const cache = floorPreviewCollectible._ladderCache;
            const timeDiff = cache ? (nowTime - (cache.time || 0)) : 999;
            const movedDist = cache ? Math.hypot(playerFeetPos[0]-cache.px, playerFeetPos[1]-cache.py, playerFeetPos[2]-cache.pz) : 999;
            const rotDiff = cache ? (Math.abs(charHeading - cache.heading) + Math.abs(camPitch - cache.pitch) + Math.abs(rotA - cache.rotA)) : 999;

            let P_anchor2 = null;
            let isValid = false;

            if (snappedToCave && P_cave_top && P_cave_bottom) {
              P_anchor2 = P_cave_bottom;
              isValid = true;
            } else if (cache && !cache.wasCaveSnap && ((timeDiff < 60 && movedDist < 0.12 && rotDiff < 0.12) || (movedDist < 0.04 && rotDiff < 0.04))) {
              P_anchor2 = cache.P_anchor2;
              isValid = cache.isValid;
            } else {
              const candidates = [];

              // Case A: DOWNWARD RAYS (Descent into hole, cave mouth, cliff face, ravine, steep drop)
              if (!isLookingUp) {
                const downAnglesDeg = isLookingDown ? [30, 58, 80] : [36, 65];
                for (let deg of downAnglesDeg) {
                  const rad = deg * (Math.PI / 180);
                  const dirDown = [
                    ladderF[0] * Math.cos(rad) - pUp[0] * Math.sin(rad),
                    ladderF[1] * Math.cos(rad) - pUp[1] * Math.sin(rad),
                    ladderF[2] * Math.cos(rad) - pUp[2] * Math.sin(rad)
                  ];
                  const lenD = Math.hypot(dirDown[0], dirDown[1], dirDown[2]) || 1;
                  dirDown[0] /= lenD; dirDown[1] /= lenD; dirDown[2] /= lenD;

                  let prevPt = [
                    P_anchor1[0] + dirDown[0] * 0.45,
                    P_anchor1[1] + dirDown[1] * 0.45,
                    P_anchor1[2] + dirDown[2] * 0.45
                  ];
                  let prevDens = -1.0;

                  // 6 lightweight steps (0.6m to 3.2m) with skipNoise=true
                  for (let st = 1; st <= 6; st++) {
                    const distT = 0.6 + (st - 1) * 0.52;
                    const pMarch = [
                      P_anchor1[0] + dirDown[0] * distT,
                      P_anchor1[1] + dirDown[1] * distT,
                      P_anchor1[2] + dirDown[2] * distT
                    ];
                    let dens = 0;
                    if (typeof getTerrainDensity === "function") {
                      dens = getTerrainDensity(pMarch[0], pMarch[1], pMarch[2], true);
                    } else {
                      const mR = Math.hypot(pMarch[0], pMarch[1], pMarch[2]);
                      const mN = [pMarch[0]/mR, pMarch[1]/mR, pMarch[2]/mR];
                      const sR = getSolidRadAt(mN, mR);
                      dens = sR - mR;
                    }

                    if (prevDens < 0.01 && dens >= 0.0) {
                      let pA = prevPt || P_anchor1;
                      let pB = pMarch;
                      for (let bi = 0; bi < 2; bi++) {
                        const pMid = [(pA[0]+pB[0])*0.5, (pA[1]+pB[1])*0.5, (pA[2]+pB[2])*0.5];
                        const dMid = (typeof getTerrainDensity === "function")
                          ? getTerrainDensity(pMid[0], pMid[1], pMid[2], true)
                          : (getSolidRadAt([pMid[0]/Math.hypot(pMid[0],pMid[1],pMid[2]), pMid[1]/Math.hypot(pMid[0],pMid[1],pMid[2]), pMid[2]/Math.hypot(pMid[0],pMid[1],pMid[2])], Math.hypot(pMid[0],pMid[1],pMid[2])) - Math.hypot(pMid[0],pMid[1],pMid[2]));
                        if (dMid >= 0) pB = pMid; else pA = pMid;
                      }
                      const hitPt = pB;
                      const hitDist = Math.hypot(hitPt[0]-P_anchor1[0], hitPt[1]-P_anchor1[1], hitPt[2]-P_anchor1[2]);
                      if (hitDist >= 0.85 && hitDist <= 3.5 && !isPointInWater(hitPt)) {
                        const vertDiff = (hitPt[0]-P_anchor1[0])*pUp[0] + (hitPt[1]-P_anchor1[1])*pUp[1] + (hitPt[2]-P_anchor1[2])*pUp[2];
                        candidates.push({
                          point: hitPt,
                          dist: hitDist,
                          type: 'downward',
                          vertDiff: vertDiff,
                          angleDeg: deg
                        });
                        break;
                      }
                    }
                    prevPt = pMarch;
                    prevDens = dens;
                  }
                }
              }

              // Case B: SURFACE / FORWARD SLOPE / BRIDGING RAYS
              const forwardDists = [1.5, 2.3, 3.1];
              for (let d of forwardDists) {
                const hPt = [
                  P_anchor1[0] + ladderF[0] * d,
                  P_anchor1[1] + ladderF[1] * d,
                  P_anchor1[2] + ladderF[2] * d
                ];
                const hLen = Math.hypot(hPt[0], hPt[1], hPt[2]) || 1;
                const hn = [hPt[0]/hLen, hPt[1]/hLen, hPt[2]/hLen];
                const solidRad = getSolidRadAt(hn, hLen);
                const surfacePt = [hn[0] * solidRad, hn[1] * solidRad, hn[2] * solidRad];

                let isSolid = true;
                if (typeof getTerrainDensity === "function") {
                  const dens = getTerrainDensity(surfacePt[0], surfacePt[1], surfacePt[2], true);
                  if (dens < -0.06) isSolid = false;
                }

                if (isSolid && !isPointInWater(surfacePt)) {
                  const sDist = Math.hypot(surfacePt[0]-P_anchor1[0], surfacePt[1]-P_anchor1[1], surfacePt[2]-P_anchor1[2]);
                  if (sDist >= 0.8 && sDist <= 3.5) {
                    const vertDiff = (surfacePt[0]-P_anchor1[0])*pUp[0] + (surfacePt[1]-P_anchor1[1])*pUp[1] + (surfacePt[2]-P_anchor1[2])*pUp[2];
                    candidates.push({
                      point: surfacePt,
                      dist: sDist,
                      type: 'slope',
                      vertDiff: vertDiff
                    });
                  }
                }
              }

              // Case C: UPWARD WALL / CLIFF RAYS (Leaning up against rock, cliff, or high ledge)
              if (!isLookingDown) {
                const upAnglesDeg = isLookingUp ? [30, 60] : [35];
                for (let deg of upAnglesDeg) {
                  const rad = deg * (Math.PI / 180);
                  const dirUp = [
                    ladderF[0] * Math.cos(rad) + pUp[0] * Math.sin(rad),
                    ladderF[1] * Math.cos(rad) + pUp[1] * Math.sin(rad),
                    ladderF[2] * Math.cos(rad) + pUp[2] * Math.sin(rad)
                  ];
                  const lenU = Math.hypot(dirUp[0], dirUp[1], dirUp[2]) || 1;
                  dirUp[0] /= lenU; dirUp[1] /= lenU; dirUp[2] /= lenU;

                  let prevPt = [
                    P_anchor1[0] + dirUp[0] * 0.45,
                    P_anchor1[1] + dirUp[1] * 0.45,
                    P_anchor1[2] + dirUp[2] * 0.45
                  ];
                  let prevDens = -1.0;
                  for (let st = 1; st <= 6; st++) {
                    const distT = 0.6 + (st - 1) * 0.52;
                    const pMarch = [
                      P_anchor1[0] + dirUp[0] * distT,
                      P_anchor1[1] + dirUp[1] * distT,
                      P_anchor1[2] + dirUp[2] * distT
                    ];
                    let dens = -1;
                    if (typeof getTerrainDensity === "function") {
                      dens = getTerrainDensity(pMarch[0], pMarch[1], pMarch[2], true);
                    }
                    if (prevDens < 0.01 && dens >= 0.0) {
                      let pA = prevPt || P_anchor1;
                      let pB = pMarch;
                      for (let bi = 0; bi < 2; bi++) {
                        const pMid = [(pA[0]+pB[0])*0.5, (pA[1]+pB[1])*0.5, (pA[2]+pB[2])*0.5];
                        const dMid = getTerrainDensity(pMid[0], pMid[1], pMid[2], true);
                        if (dMid >= 0) pB = pMid; else pA = pMid;
                      }
                      const hitPt = pB;
                      const hitDist = Math.hypot(hitPt[0]-P_anchor1[0], hitPt[1]-P_anchor1[1], hitPt[2]-P_anchor1[2]);
                      const vertDiff = (hitPt[0]-P_anchor1[0])*pUp[0] + (hitPt[1]-P_anchor1[1])*pUp[1] + (hitPt[2]-P_anchor1[2])*pUp[2];
                      if (hitDist >= 0.85 && hitDist <= 3.5 && vertDiff > 0.25 && !isPointInWater(hitPt)) {
                        candidates.push({
                          point: hitPt,
                          dist: hitDist,
                          type: 'wall',
                          vertDiff: vertDiff,
                          angleDeg: deg
                        });
                        break;
                      }
                    }
                    prevPt = pMarch;
                    prevDens = dens;
                  }
                }
              }

              // Check if terrain in front drops off sharply (cliff edge / hole mouth)
              let isAtCliffEdge = false;
              if (!isLookingUp && typeof getTerrainDensity === "function") {
                const testDropPt = [
                  P_anchor1[0] + ladderF[0] * 0.7 - pUp[0] * 0.35,
                  P_anchor1[1] + ladderF[1] * 0.7 - pUp[1] * 0.35,
                  P_anchor1[2] + ladderF[2] * 0.7 - pUp[2] * 0.35
                ];
                if (getTerrainDensity(testDropPt[0], testDropPt[1], testDropPt[2], true) < -0.05) {
                  isAtCliffEdge = true;
                }
              }

              // Candidate Scoring: Select the most natural landing point
              let bestCandidate = null;
              let bestScore = Infinity;
              const idealDist = 2.2;

              for (let c of candidates) {
                let score = Math.abs(c.dist - idealDist) * 1.5;

                if (c.type === 'downward') {
                  if (isLookingDown) {
                    score -= 10.0 * Math.min(2.0, camPitch * 3.5);
                  } else if (isAtCliffEdge) {
                    score -= 5.0;
                  } else {
                    score += 1.0;
                  }
                } else if (c.type === 'wall') {
                  if (isLookingUp) {
                    score -= 10.0 * Math.min(2.0, -camPitch * 3.5);
                  } else {
                    score -= 2.0;
                  }
                } else if (c.type === 'slope') {
                  if (isLookingDown && isAtCliffEdge) {
                    score += 5.0;
                  } else if (Math.abs(c.vertDiff) < 0.3) {
                    score -= 1.5;
                  }
                }

                if (score < bestScore) {
                  bestScore = score;
                  bestCandidate = c;
                }
              }

              if (bestCandidate) {
                P_anchor2 = bestCandidate.point;
                isValid = true;
              } else {
                // Natural fallback: rests angled downward from the player's feet (NEVER floating in mid-air!)
                const fallbackPitch = isLookingUp ? 0.6 : (isLookingDown ? -0.9 : -0.6);
                const fbDir = [
                  ladderF[0] * Math.cos(fallbackPitch) + pUp[0] * Math.sin(fallbackPitch),
                  ladderF[1] * Math.cos(fallbackPitch) + pUp[1] * Math.sin(fallbackPitch),
                  ladderF[2] * Math.cos(fallbackPitch) + pUp[2] * Math.sin(fallbackPitch)
                ];
                const fbLen = Math.hypot(fbDir[0], fbDir[1], fbDir[2]) || 1;
                P_anchor2 = [
                  P_anchor1[0] + (fbDir[0]/fbLen) * idealDist,
                  P_anchor1[1] + (fbDir[1]/fbLen) * idealDist,
                  P_anchor1[2] + (fbDir[2]/fbLen) * idealDist
                ];
                isValid = false; // Red hologram warning: no solid ground support reached
              }

              floorPreviewCollectible._ladderCache = {
                time: nowTime,
                px: playerFeetPos[0],
                py: playerFeetPos[1],
                pz: playerFeetPos[2],
                heading: charHeading,
                pitch: camPitch,
                rotA: rotA,
                P_anchor2: P_anchor2,
                isValid: isValid,
                wasCaveSnap: false
              };
            }

            // Assign P_top and P_bottom by elevation (or use cave-snapped endpoints directly)
            let P_top, P_bottom;
            if (snappedToCave && P_cave_top && P_cave_bottom) {
              P_top = P_cave_top;
              P_bottom = P_cave_bottom;
            } else {
              const r1 = Math.hypot(P_anchor1[0], P_anchor1[1], P_anchor1[2]);
              const r2 = Math.hypot(P_anchor2[0], P_anchor2[1], P_anchor2[2]);

              if (r1 >= r2) {
                P_top = P_anchor1;
                P_bottom = P_anchor2;
              } else {
                P_top = P_anchor2;
                P_bottom = P_anchor1;
              }
            }

            targetPos = [
              (P_top[0] + P_bottom[0]) * 0.5,
              (P_top[1] + P_bottom[1]) * 0.5,
              (P_top[2] + P_bottom[2]) * 0.5
            ];

            const dir_v = [P_top[0] - P_bottom[0], P_top[1] - P_bottom[1], P_top[2] - P_bottom[2]];
            const len_v = Math.hypot(dir_v[0], dir_v[1], dir_v[2]) || 1;
            const dir_un = [dir_v[0]/len_v, dir_v[1]/len_v, dir_v[2]/len_v];

            // Lateral rung axis (orthogonal to dir_un)
            let calcR = [
              ladderR[0] - dir_un[0] * (ladderR[0]*dir_un[0] + ladderR[1]*dir_un[1] + ladderR[2]*dir_un[2]),
              ladderR[1] - dir_un[1] * (ladderR[0]*dir_un[0] + ladderR[1]*dir_un[1] + ladderR[2]*dir_un[2]),
              ladderR[2] - dir_un[2] * (ladderR[0]*dir_un[0] + ladderR[1]*dir_un[1] + ladderR[2]*dir_un[2])
            ];
            const lenCalcR = Math.hypot(calcR[0], calcR[1], calcR[2]) || 1;
            calcR = [calcR[0]/lenCalcR, calcR[1]/lenCalcR, calcR[2]/lenCalcR];

            let calcN = [
              dir_un[1]*calcR[2] - dir_un[2]*calcR[1],
              dir_un[2]*calcR[0] - dir_un[0]*calcR[2],
              dir_un[0]*calcR[1] - dir_un[1]*calcR[0]
            ];
            const lenCalcN = Math.hypot(calcN[0], calcN[1], calcN[2]) || 1;
            calcN = [calcN[0]/lenCalcN, calcN[1]/lenCalcN, calcN[2]/lenCalcN];
            if (calcN[0]*pUp[0] + calcN[1]*pUp[1] + calcN[2]*pUp[2] < 0) {
              calcN = [-calcN[0], -calcN[1], -calcN[2]];
              calcR = [-calcR[0], -calcR[1], -calcR[2]];
            }

            floorPreviewCollectible.stairTop = P_top;
            floorPreviewCollectible.stairBottom = P_bottom;
            floorPreviewCollectible.normal = calcN;
            floorPreviewCollectible.R = calcR;
            floorPreviewCollectible.F = dir_un;

            pN = calcN;
            pR = calcR;
            pF = dir_un;
            isSnapped = true;

            const isWater = isPointInWater(P_bottom) || isPointInWater(P_top) || isPlayerInWater;
            floorPreviewCollectible.isValidPlacement = isValid && !isWater;
          } else if (typeToPlace === "wood_boat") {
             floorPreviewCollectible.size = 0.25;
             pN = [pnx, pny, pnz];
             pR = [previewEast[0] * cosH - previewNorth[0] * sinH, previewEast[1] * cosH - previewNorth[1] * sinH, previewEast[2] * cosH - previewNorth[2] * sinH];
             pF = [previewNorth[0] * cosH + previewEast[0] * sinH, previewNorth[1] * cosH + previewEast[1] * sinH, previewNorth[2] * cosH + previewEast[2] * sinH];

             if (isUnderWater) {
               floorPreviewCollectible.isValidPlacement = !isDivingMode;
               targetPos = [
                   pnx * (waterRadius - 0.04),
                   pny * (waterRadius - 0.04),
                   pnz * (waterRadius - 0.04)
               ];
             } else {
               // Land / Ground placement allowed!
               let boatRad = previewGroundRadius + 0.002;

               // Check if sitting on a constructed floor (stone_floor, wood_floor, thin_wood_floor)
               let nearestFloor = null;
               let nearestDist = Infinity;
               for (let other of collectibles) {
                 if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") && !other.isPreview) {
                   const dx = other.position[0] - (pnx * previewGroundRadius);
                   const dy = other.position[1] - (pny * previewGroundRadius);
                   const dz = other.position[2] - (pnz * previewGroundRadius);
                   const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                   if (dist < nearestDist) {
                     nearestDist = dist;
                     nearestFloor = other;
                   }
                 }
               }
               if (nearestFloor && nearestDist < 0.6) {
                 let floorHH = 0;
                 if (nearestFloor.type === "stone_floor") floorHH = nearestFloor.size * 0.15;
                 else if (nearestFloor.type === "wood_floor") floorHH = woodFloorHeight + nearestFloor.size * 0.12;
                 else if (nearestFloor.type === "thin_wood_floor") floorHH = nearestFloor.size * 0.04;
                 const fLen = Math.sqrt(nearestFloor.position[0]**2 + nearestFloor.position[1]**2 + nearestFloor.position[2]**2);
                 if (fLen > 0) {
                   boatRad = Math.max(boatRad, fLen + floorHH / 2 + 0.002);
                 }
               }

               floorPreviewCollectible.isValidPlacement = !isDivingMode && (slopeVal < 1.5);
               targetPos = [
                   pnx * boatRad,
                   pny * boatRad,
                   pnz * boatRad
               ];
             }
          } else if (typeToPlace === "wood_wheel" || typeToPlace === "electric_engine" || typeToPlace === "boat_wing") {
             let nearestBoat = null;
             let bestDist = Infinity;
             const boatCandidates = (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.queryRadius === "function")
               ? SpatialGrid.queryRadius(targetPos[0], targetPos[1], targetPos[2], 1.5)
               : collectibles;
             for (let i = 0; i < boatCandidates.length; i++) {
               const other = boatCandidates[i];
               if (other && other.active && other.type === "wood_boat" && !other.isPreview && !other.isGroundDrop && other.position) {
                 const dx = other.position[0] - targetPos[0];
                 const dy = other.position[1] - targetPos[1];
                 const dz = other.position[2] - targetPos[2];
                 const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                 if (dist < bestDist) {
                   bestDist = dist;
                   nearestBoat = other;
                 }
               }
             }

             if (nearestBoat && bestDist < 0.6) {
               const bP = nearestBoat.position;
               const bN = nearestBoat.normal || [0, 1, 0];
               const bR = nearestBoat.R || [1, 0, 0];
               const bF = nearestBoat.F || [0, 0, 1];

               targetPos = [bP[0], bP[1], bP[2]];
               pN = [bN[0], bN[1], bN[2]];
               pR = [bR[0], bR[1], bR[2]];
               pF = [bF[0], bF[1], bF[2]];
               isSnapped = true;
               floorPreviewCollectible.isValidPlacement = true;
               floorPreviewCollectible.isBoatSnapped = true;
               floorPreviewCollectible.targetBoat = nearestBoat;
               floorPreviewCollectible.size = 0.25;
             } else {
               floorPreviewCollectible.isValidPlacement = false;
               floorPreviewCollectible.isBoatSnapped = false;
               floorPreviewCollectible.size = 0.25;
               pN = [pnx, pny, pnz];
               pR = [previewEast[0] * cosH - previewNorth[0] * sinH, previewEast[1] * cosH - previewNorth[1] * sinH, previewEast[2] * cosH - previewNorth[2] * sinH];
               pF = [previewNorth[0] * cosH + previewEast[0] * sinH, previewNorth[1] * cosH + previewEast[1] * sinH, previewNorth[2] * cosH + previewEast[2] * sinH];
             }
          } else if (typeToPlace === "stone_floor") {
            const w = 0.25 * 12.0;
            const d = 0.25 * 12.0;
            const floorH = 0.25 * 0.15;
            
            // --- 0. Snap to nearby stone floors ---
            let nearestStone = null;
            let nearestDist = Infinity;
            for (let other of collectibles) {
                if (other.active && other.type === "stone_floor" && !other.isPreview) {
                    const dx = other.position[0] - targetPos[0];
                    const dy = other.position[1] - targetPos[1];
                    const dz = other.position[2] - targetPos[2];
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestStone = other;
                    }
                }
            }
            if (nearestStone && nearestDist < 5.0) { // Snap if close
                const sR = nearestStone.R;
                const sF = nearestStone.F;
                const sN = nearestStone.normal;
                const sP = nearestStone.position;
                
                const dx = targetPos[0] - sP[0];
                const dy = targetPos[1] - sP[1];
                const dz = targetPos[2] - sP[2];
                
                const localX = dx * sR[0] + dy * sR[1] + dz * sR[2];
                const localZ = dx * sF[0] + dy * sF[1] + dz * sF[2];
                
                let gridX = Math.round(localX / 3.0);
                let gridZ = Math.round(localZ / 3.0);
                
                // Snap to closest adjacent grid
                if (gridX > 1) gridX = 1; if (gridX < -1) gridX = -1;
                if (gridZ > 1) gridZ = 1; if (gridZ < -1) gridZ = -1;
                
                if (Math.abs(gridX) === 1 || Math.abs(gridZ) === 1) {
                    targetPos = [
                        sP[0] + gridX * 3.0 * sR[0] + gridZ * 3.0 * sF[0],
                        sP[1] + gridX * 3.0 * sR[1] + gridZ * 3.0 * sF[1],
                        sP[2] + gridX * 3.0 * sR[2] + gridZ * 3.0 * sF[2]
                    ];
                    floorPreviewCollectible.normal = [sN[0], sN[1], sN[2]];
                    floorPreviewCollectible.R = [sR[0], sR[1], sR[2]];
                    floorPreviewCollectible.F = [sF[0], sF[1], sF[2]];
                    if (nearestStone.angle !== undefined) {
                        floorPreviewCollectible.angle = nearestStone.angle;
                        placementRotationAngle = nearestStone.angle;
                    }
                    isSnapped = true;
                    pN = [sN[0], sN[1], sN[2]];
                    pR = [sR[0], sR[1], sR[2]];
                    pF = [sF[0], sF[1], sF[2]];
                }
            }
            
            // Ensure floorPreviewCollectible orientation vectors are updated for current frame
            floorPreviewCollectible.normal = [pN[0], pN[1], pN[2]];
            floorPreviewCollectible.R = [pR[0], pR[1], pR[2]];
            floorPreviewCollectible.F = [pF[0], pF[1], pF[2]];
            
            // Stone floor can be placed anywhere (terrain/slope/trees/rocks do not block it).
            floorPreviewCollectible.isValidPlacement = true;

            // Prevent overlapping with another stone floor placed at the exact same location
            for (let other of collectibles) {
                if (other.active && other.type === "stone_floor" && !other.isPreview) {
                    const ox = other.position[0] - targetPos[0];
                    const oy = other.position[1] - targetPos[1];
                    const oz = other.position[2] - targetPos[2];
                    if (ox*ox + oy*oy + oz*oz < 0.2) {
                        floorPreviewCollectible.isValidPlacement = false;
                        break;
                    }
                }
            }
            
            floorPreviewCollectible.size = 0.25;
          } else if (typeToPlace === "wood_floor") {
            // Find nearest stone_floor for grid snapping (Only placeable on stone floors)
            let nearestStone = null;
            let nearestDist = Infinity;
            for (let other of collectibles) {
                if (other.active && other.type === "stone_floor" && !other.isPreview) {
                    const dx = other.position[0] - targetPos[0];
                    const dy = other.position[1] - targetPos[1];
                    const dz = other.position[2] - targetPos[2];
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestStone = other;
                    }
                }
            }

            if (nearestStone) {
                const sW = typeof nearestStone.width === "number" ? nearestStone.width : 3.0;
                const sD = typeof nearestStone.depth === "number" ? nearestStone.depth : 3.0;
                const maxReachDist = Math.max(sW, sD) / 2 + 1.5;

                if (nearestDist < maxReachDist) {
                    const sR = nearestStone.R || [1, 0, 0];
                    const sF = nearestStone.F || [0, 0, 1];
                    const sN = nearestStone.normal || [0, 1, 0];
                    const sP = nearestStone.position;

                    // Project targetPos onto stone floor's plane
                    const dx = targetPos[0] - sP[0];
                    const dy = targetPos[1] - sP[1];
                    const dz = targetPos[2] - sP[2];

                    const localX = dx * sR[0] + dy * sR[1] + dz * sR[2];
                    const localZ = dx * sF[0] + dy * sF[1] + dz * sF[2];

                    // Check if projected point is within the bounds of stone floor
                    const halfW = sW / 2;
                    const halfD = sD / 2;
                    if (Math.abs(localX) <= halfW + 0.15 && Math.abs(localZ) <= halfD + 0.15) {
                        // Snap to exact 0.30m cell centers within [-halfW, +halfW] x [-halfD, +halfD]
                        // Matches both random house generation (-halfW + 0.15 + gx * 0.3) and 3.0m stone floors
                        const numCols = Math.max(1, Math.round(sW / 0.3));
                        const numRows = Math.max(1, Math.round(sD / 0.3));
                        let gx = Math.round((localX - (-halfW + 0.15)) / 0.3);
                        let gz = Math.round((localZ - (-halfD + 0.15)) / 0.3);
                        gx = Math.max(0, Math.min(numCols - 1, gx));
                        gz = Math.max(0, Math.min(numRows - 1, gz));

                        const snappedX = -halfW + 0.15 + gx * 0.3;
                        const snappedZ = -halfD + 0.15 + gz * 0.3;

                        floorPreviewCollectible.isValidPlacement = true;
                        floorPreviewCollectible.size = 0.25;

                        const sH = (nearestStone.size || 0.25) * 0.15; // stone floor height
                        const baseWfH = (typeof woodFloorHeight === "number") ? woodFloorHeight : ((typeof window !== "undefined" && typeof window.woodFloorHeight === "number") ? window.woodFloorHeight : 0.05);
                        const wH = baseWfH + 0.25 * 0.12;              // wood floor height

                        let normalOffset = (nearestStone.isHouse || nearestStone.isProceduralHouse)
                            ? (sH + wH / 2)
                            : (sH / 2 + wH / 2);

                        // If any wood_floor already sits on this stone_floor, match its exact vertical plane
                        for (let other of collectibles) {
                            if (other.active && other.type === "wood_floor" && !other.isPreview) {
                                const odx = other.position[0] - sP[0];
                                const ody = other.position[1] - sP[1];
                                const odz = other.position[2] - sP[2];
                                const olX = odx * sR[0] + ody * sR[1] + odz * sR[2];
                                const olZ = odx * sF[0] + ody * sF[1] + odz * sF[2];
                                const olN = odx * sN[0] + ody * sN[1] + odz * sN[2];
                                if (Math.abs(olX) <= halfW + 0.2 && Math.abs(olZ) <= halfD + 0.2 && olN > 0 && olN < 0.25) {
                                    normalOffset = olN;
                                    break;
                                }
                            }
                        }

                        targetPos = [
                            sP[0] + sR[0] * snappedX + sF[0] * snappedZ + sN[0] * normalOffset,
                            sP[1] + sR[1] * snappedX + sF[1] * snappedZ + sN[1] * normalOffset,
                            sP[2] + sR[2] * snappedX + sF[2] * snappedZ + sN[2] * normalOffset
                        ];

                        pN = [sN[0], sN[1], sN[2]];
                        pR = [sR[0], sR[1], sR[2]];
                        pF = [sF[0], sF[1], sF[2]];
                        isSnapped = true;

                        // Check if another wood_floor is already at this exact snapped position
                        for (let other of collectibles) {
                            if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor") && !other.isPreview) {
                                const ox = other.position[0] - targetPos[0];
                                const oy = other.position[1] - targetPos[1];
                                const oz = other.position[2] - targetPos[2];
                                if (ox*ox + oy*oy + oz*oz < 0.01) {
                                    floorPreviewCollectible.isValidPlacement = false;
                                }
                            }
                        }
                    } else {
                        floorPreviewCollectible.isValidPlacement = false;
                        floorPreviewCollectible.size = 0.25;
                    }
                } else {
                    floorPreviewCollectible.isValidPlacement = false;
                    floorPreviewCollectible.size = 0.25;
                }
            } else {
                // No stone floor found nearby or too far
                floorPreviewCollectible.isValidPlacement = false;
                floorPreviewCollectible.size = 0.25;
            }
          } else if (typeToPlace.startsWith("robot_")) {
            let robotSnapFound = false;

            if (typeToPlace === "robot_stand") {
              // Placing Robot Stand -> Snap directly under an unmounted Robot Cockpit
              let nearestCockpit = null;
              let bestCDist = Infinity;
              const cockpitCands = (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.queryRadius === "function")
                ? SpatialGrid.queryRadius(targetPos[0], targetPos[1], targetPos[2], 1.5)
                : collectibles;
              for (let i = 0; i < cockpitCands.length; i++) {
                const c = cockpitCands[i];
                if (c && c.active && !c.isPreview && c.type === "robot_cockpit" && c.position) {
                  const dx = c.position[0] - targetPos[0];
                  const dy = c.position[1] - targetPos[1];
                  const dz = c.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  if (dist < bestCDist) {
                    bestCDist = dist;
                    nearestCockpit = c;
                  }
                }
              }

              if (nearestCockpit && bestCDist < 0.6) {
                const updatedCPos = nearestCockpit.position;
                const cR = nearestCockpit.R || [1, 0, 0];
                const cN = nearestCockpit.normal || nearestCockpit.U || [0, 1, 0];
                const cF = nearestCockpit.F || [0, 0, 1];
                const clampOffsetN = 0.66;
                const clampOffsetF = 0.0;
                targetPos = [
                  updatedCPos[0] - cN[0] * clampOffsetN - cF[0] * clampOffsetF,
                  updatedCPos[1] - cN[1] * clampOffsetN - cF[1] * clampOffsetF,
                  updatedCPos[2] - cN[2] * clampOffsetN - cF[2] * clampOffsetF
                ];
                pN = [cN[0], cN[1], cN[2]];
                pR = [cR[0], cR[1], cR[2]];
                pF = [cF[0], cF[1], cF[2]];
                floorPreviewCollectible.isValidPlacement = true;
                floorPreviewCollectible.size = 0.25;
                isSnapped = true;
                robotSnapFound = true;
              }
            } else if (typeToPlace !== "robot_cockpit") {
              // Placing Leg, Arm, or other Robot Part -> Snap ONLY to Cockpit that is mounted on a Robot Stand
              let nearestCockpit = null;
              let bestCDist = Infinity;
              const cockpitCands = (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.queryRadius === "function")
                ? SpatialGrid.queryRadius(targetPos[0], targetPos[1], targetPos[2], 1.5)
                : collectibles;
              for (let i = 0; i < cockpitCands.length; i++) {
                const c = cockpitCands[i];
                if (c && c.active && !c.isPreview && c.type === "robot_cockpit" && c.position) {
                  const dx = c.position[0] - targetPos[0];
                  const dy = c.position[1] - targetPos[1];
                  const dz = c.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  if (dist < bestCDist) {
                    bestCDist = dist;
                    nearestCockpit = c;
                  }
                }
              }

              // Check if nearestCockpit is mounted on a Robot Stand
              let cockpitOnStand = false;
              if (nearestCockpit && bestCDist < 0.6) {
                const standCands = (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.queryRadius === "function")
                  ? SpatialGrid.queryRadius(nearestCockpit.position[0], nearestCockpit.position[1], nearestCockpit.position[2], 1.5)
                  : collectibles;
                for (let i = 0; i < standCands.length; i++) {
                  const s = standCands[i];
                  if (s && s.active && !s.isPreview && s.type === "robot_stand" && s.position) {
                    const sdx = s.position[0] - nearestCockpit.position[0];
                    const sdy = s.position[1] - nearestCockpit.position[1];
                    const sdz = s.position[2] - nearestCockpit.position[2];
                    const sdist = Math.sqrt(sdx*sdx + sdy*sdy + sdz*sdz);
                    if (sdist < 1.2) {
                      cockpitOnStand = true;
                      break;
                    }
                  }
                }
              }

              if (nearestCockpit && bestCDist < 0.6 && cockpitOnStand) {
                const updatedCPos = nearestCockpit.position;
                const cR = nearestCockpit.R || [1, 0, 0];
                const cN = nearestCockpit.normal || nearestCockpit.U || [0, 1, 0];
                const cF = nearestCockpit.F || [0, 0, 1];

                let rOff = 0, nOff = 0, fOff = 0;
                if (typeToPlace === "robot_left_leg") {
                  rOff = -0.030; nOff = -0.5025; fOff = 0.0;
                } else if (typeToPlace === "robot_right_leg") {
                  rOff = 0.030; nOff = -0.5025; fOff = 0.0;
                } else if (typeToPlace === "robot_left_arm") {
                  rOff = -0.1875; nOff = -0.16875; fOff = 0.0;
                } else if (typeToPlace === "robot_right_arm") {
                  rOff = 0.1875; nOff = -0.16875; fOff = 0.0;
                }

                targetPos = [
                  updatedCPos[0] + cR[0]*rOff + cN[0]*nOff + cF[0]*fOff,
                  updatedCPos[1] + cR[1]*rOff + cN[1]*nOff + cF[1]*fOff,
                  updatedCPos[2] + cR[2]*rOff + cN[2]*nOff + cF[2]*fOff
                ];

                pN = [cN[0], cN[1], cN[2]];
                pR = [cR[0], cR[1], cR[2]];
                pF = [cF[0], cF[1], cF[2]];

                floorPreviewCollectible.isValidPlacement = true;
                floorPreviewCollectible.size = 0.25;
                isSnapped = true;
                robotSnapFound = true;
              }
            } else {
              // Placing Cockpit -> Snap ONLY to placed Stand
              let nearestStand = null;
              let bestSDist = Infinity;
              const standCands = (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.queryRadius === "function")
                ? SpatialGrid.queryRadius(targetPos[0], targetPos[1], targetPos[2], 1.5)
                : collectibles;
              for (let i = 0; i < standCands.length; i++) {
                const c = standCands[i];
                if (c && c.active && !c.isPreview && c.type === "robot_stand" && c.position) {
                  const dx = c.position[0] - targetPos[0];
                  const dy = c.position[1] - targetPos[1];
                  const dz = c.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  if (dist < bestSDist) {
                    bestSDist = dist;
                    nearestStand = c;
                  }
                }
              }

              if (nearestStand && bestSDist < 0.6) {
                const sPos = nearestStand.position;
                const sR = nearestStand.R || [1, 0, 0];
                const sN = nearestStand.normal || nearestStand.U || [0, 1, 0];
                const sF = nearestStand.F || [0, 0, 1];
                const clampOffsetN = 0.66;
                const clampOffsetF = 0.0;
                targetPos = [
                  sPos[0] + sN[0] * clampOffsetN + sF[0] * clampOffsetF,
                  sPos[1] + sN[1] * clampOffsetN + sF[1] * clampOffsetF,
                  sPos[2] + sN[2] * clampOffsetN + sF[2] * clampOffsetF
                ];
                pN = [sN[0], sN[1], sN[2]];
                pR = [sR[0], sR[1], sR[2]];
                pF = [sF[0], sF[1], sF[2]];
                floorPreviewCollectible.isValidPlacement = true;
                floorPreviewCollectible.size = 0.25;
                isSnapped = true;
                robotSnapFound = true;
              }
            }

            if (!robotSnapFound) {
              if (typeToPlace !== "robot_stand") {
                floorPreviewCollectible.isValidPlacement = false;
                floorPreviewCollectible.size = 0.25;
              } else {
                // Standalone ground/floor placement
                let nearestFloor = null;
                let nearestDist = Infinity;
                const floorCands = (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.queryRadius === "function")
                  ? SpatialGrid.queryRadius(targetPos[0], targetPos[1], targetPos[2], 1.5)
                  : collectibles;
                for (let i = 0; i < floorCands.length; i++) {
                  const other = floorCands[i];
                  if (other && other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") && !other.isPreview && other.position) {
                    const dx = other.position[0] - targetPos[0];
                    const dy = other.position[1] - targetPos[1];
                    const dz = other.position[2] - targetPos[2];
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (dist < nearestDist) {
                      nearestDist = dist;
                      nearestFloor = other;
                    }
                  }
                }

                if (nearestFloor && nearestDist < 0.6) {
                  const sR = nearestFloor.R || [1, 0, 0];
                  const sF = nearestFloor.F || [0, 0, 1];
                  const sN = nearestFloor.normal || [0, 1, 0];
                  const sP = nearestFloor.position;

                  const dx = targetPos[0] - sP[0];
                  const dy = targetPos[1] - sP[1];
                  const dz = targetPos[2] - sP[2];

                  const localX = dx * sR[0] + dy * sR[1] + dz * sR[2];
                  const localZ = dx * sF[0] + dy * sF[1] + dz * sF[2];

                  if (Math.abs(localX) <= 0.35 && Math.abs(localZ) <= 0.35) {
                    let gridX = Math.round(localX / 0.15);
                    let gridZ = Math.round(localZ / 0.15);

                    floorPreviewCollectible.isValidPlacement = true;
                    floorPreviewCollectible.size = 0.25;

                    let floorHH = 0;
                    if (nearestFloor.type === "stone_floor") floorHH = nearestFloor.size * 0.15;
                    else if (nearestFloor.type === "wood_floor") floorHH = woodFloorHeight + nearestFloor.size * 0.12;
                    else if (nearestFloor.type === "thin_wood_floor") floorHH = nearestFloor.size * 0.04;

                    let floatOffset = typeToPlace === "robot_cockpit" ? 0.14 : ((typeToPlace === "robot_left_leg" || typeToPlace === "robot_right_leg") ? 0.14 : (typeToPlace === "robot_stand" ? 0.0 : 0.35));

                    targetPos = [
                      sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * (floorHH / 2 + floatOffset),
                      sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * (floorHH / 2 + floatOffset),
                      sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * (floorHH / 2 + floatOffset)
                    ];

                    pN = [sN[0], sN[1], sN[2]];
                    pR = [sR[0], sR[1], sR[2]];
                    pF = [sF[0], sF[1], sF[2]];
                    isSnapped = true;
                  } else {
                    floorPreviewCollectible.isValidPlacement = !isUnderWater && (slopeVal < 0.6);
                    floorPreviewCollectible.size = 0.25;
                  }
                } else {
                  floorPreviewCollectible.isValidPlacement = !isUnderWater && (slopeVal < 0.6);
                  floorPreviewCollectible.size = 0.25;
                }
              }
            }
          } else if (typeToPlace === "wood_roof") {
            floorPreviewCollectible.size = 0.25;
            floorPreviewCollectible.isValidPlacement = false;

            const curAngle = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : (floorPreviewCollectible.angle || 0.0);

            // Compute camera eye position and look direction for true 3D crosshair line-of-sight snapping
            let eyePos = null;
            let lookDir = null;
            if (typeof window !== "undefined" && window.cameraSpringArm && window.cameraSpringArm.eyePos && window.cameraSpringArm.targetPos) {
              eyePos = window.cameraSpringArm.eyePos;
              const tP = window.cameraSpringArm.targetPos;
              const ldx = tP[0] - eyePos[0];
              const ldy = tP[1] - eyePos[1];
              const ldz = tP[2] - eyePos[2];
              const lLen = Math.sqrt(ldx * ldx + ldy * ldy + ldz * ldz);
              if (lLen > 0.0001) {
                lookDir = [ldx / lLen, ldy / lLen, ldz / lLen];
              }
            }
            if (!eyePos || !lookDir) {
              eyePos = [playerPt[0] + (pN ? pN[0] * 0.2 : 0), playerPt[1] + (pN ? pN[1] * 0.2 : 0), playerPt[2] + (pN ? pN[2] * 0.2 : 0)];
              lookDir = pF || [0, 0, 1];
            }

            const maxReach = Math.max(6.5, (typeof actionReachDistance === "number" ? actionReachDistance * 4.0 : 6.5));

            // Roofs snap strictly to:
            // 1. Existing roofs (tile-to-tile / แผ่นต่อแผ่น: Slope Up, Slope Down, Left, Right, Ridge Peak, Gutter, Corners)
            // 2. Walls (wood_wall, wood_window, wood_door on top of the wall)

            const candidates = [];

            // 1. ROOF-TO-ROOF CANDIDATES (แผ่นต่อแผ่น)
            for (let other of collectibles) {
              if (other.active && other.type === "wood_roof" && !other.isPreview) {
                const oP = other.position;
                const oR = other.R || [1, 0, 0];
                const oF = other.F || [0, 0, 1];
                const oN = other.normal || [0, 1, 0];
                const oAngle = other.angle || 0.0;

                // Check player reach distance
                const rodx = oP[0] - playerPt[0];
                const rody = oP[1] - playerPt[1];
                const rodz = oP[2] - playerPt[2];
                if (rodx * rodx + rody * rody + rodz * rodz > (maxReach + 1.2) * (maxReach + 1.2)) continue;

                const cosOA = Math.cos(oAngle);
                const sinOA = Math.sin(oAngle);
                const roofR = [
                  oR[0] * cosOA + oF[0] * sinOA,
                  oR[1] * cosOA + oF[1] * sinOA,
                  oR[2] * cosOA + oF[2] * sinOA
                ];
                const roofF = [
                  oF[0] * cosOA - oR[0] * sinOA,
                  oF[1] * cosOA - oR[1] * sinOA,
                  oF[2] * cosOA - oR[2] * sinOA
                ];
                const roofN = oN;

                const addRotatedCandidates = (pos, step, type, baseAngle) => {
                  for (let rotStep = 0; rotStep < 4; rotStep++) {
                    const angle = (baseAngle + rotStep * Math.PI / 2) % (Math.PI * 2);
                    const cosA = Math.cos(angle);
                    const sinA = Math.sin(angle);
                    const wF = [
                      oF[0] * cosA - oR[0] * sinA,
                      oF[1] * cosA - oR[1] * sinA,
                      oF[2] * cosA - oR[2] * sinA
                    ];
                    candidates.push({
                      pos: [pos[0], pos[1], pos[2]],
                      R: oR, F: oF, normal: oN,
                      angle: angle,
                      worldF: wF,
                      step: step,
                      type: type,
                      rotStep: rotStep
                    });
                  }
                };

                // Angle difference between player's held rotation and this existing roof

                // a) Slope Up (+F, height +0.25 per step) -> ต่อลาดขึ้นไปเรื่อยๆ สูงขึ้นไปเรื่อยๆ ทะลุได้
                for (let step = 1; step <= 4; step++) {
                  addRotatedCandidates(
                    [
                      oP[0] + roofF[0] * (0.30 * step) + roofN[0] * (0.25 * step),
                      oP[1] + roofF[1] * (0.30 * step) + roofN[1] * (0.25 * step),
                      oP[2] + roofF[2] * (0.30 * step) + roofN[2] * (0.25 * step)
                    ],
                    step, 'roof_slope_up', oAngle
                  );
                }

                // b) Slope Down (-F, height -0.25 per step) -> ต่อลาดลงมาตามแนวเดิม
                for (let step = 1; step <= 2; step++) {
                  addRotatedCandidates(
                    [
                      oP[0] - roofF[0] * (0.30 * step) - roofN[0] * (0.25 * step),
                      oP[1] - roofF[1] * (0.30 * step) - roofN[1] * (0.25 * step),
                      oP[2] - roofF[2] * (0.30 * step) - roofN[2] * (0.25 * step)
                    ],
                    step, 'roof_slope_down', oAngle
                  );
                }

                // c) Side Extension Left/Right (+/- R) -> ขยายแผ่นข้างตามแนวเดิม
                for (let s of [-1, 1]) {
                  addRotatedCandidates(
                    [
                      oP[0] + roofR[0] * (0.30 * s),
                      oP[1] + roofR[1] * (0.30 * s),
                      oP[2] + roofR[2] * (0.30 * s)
                    ],
                    1, 'roof_side', oAngle
                  );
                }

                // d) A-Frame Ridge Peak (+F, opposing 180 deg angle, height 0.0) -> ประกบจั่วที่ยอด
                const oppAngle = (oAngle + Math.PI) % (Math.PI * 2);
                addRotatedCandidates(
                  [
                    oP[0] + roofF[0] * 0.30,
                    oP[1] + roofF[1] * 0.30,
                    oP[2] + roofF[2] * 0.30
                  ],
                  1, 'roof_peak', oppAngle
                );
              }
            }

            // 2. WALL TOP CANDIDATES (วางบนขอบบนของกำแพง)
            for (let other of collectibles) {
              if (other.active && (other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door") && !other.isPreview) {
                const wP = other.position;
                const wN = other.normal || [0, 1, 0];

                // Check player reach distance
                const wodx = wP[0] - playerPt[0];
                const wody = wP[1] - playerPt[1];
                const wodz = wP[2] - playerPt[2];
                if (wodx * wodx + wody * wody + wodz * wodz > (maxReach + 1.2) * (maxReach + 1.2)) continue;

                // Check if this wall has another wall directly above it (if so, it is not the top wall of the column)
                let hasWallAbove = false;
                for (let aboveCheck of collectibles) {
                  if (aboveCheck.active && (aboveCheck.type === "wood_wall" || aboveCheck.type === "wood_window" || aboveCheck.type === "wood_door") && !aboveCheck.isPreview && aboveCheck !== other) {
                    const adx = aboveCheck.position[0] - (wP[0] + wN[0] * 0.25);
                    const ady = aboveCheck.position[1] - (wP[1] + wN[1] * 0.25);
                    const adz = aboveCheck.position[2] - (wP[2] + wN[2] * 0.25);
                    if (adx * adx + ady * ady + adz * adz < 0.015) {
                      hasWallAbove = true;
                      break;
                    }
                  }
                }
                if (hasWallAbove) continue; // Only process the top-most wall in each column

                const wallTopCenter = [
                  wP[0] + wN[0] * 0.25,
                  wP[1] + wN[1] * 0.25,
                  wP[2] + wN[2] * 0.25
                ];

                const wR = other.R || [1, 0, 0];
                const wF = other.F || [0, 0, 1];
                const wAngle = other.angle || 0.0;
                const cosWA = Math.cos(wAngle);
                const sinWA = Math.sin(wAngle);
                const wallR_act = [
                  wR[0] * cosWA + wF[0] * sinWA,
                  wR[1] * cosWA + wF[1] * sinWA,
                  wR[2] * cosWA + wF[2] * sinWA
                ];
                const wallF_act = [
                  wF[0] * cosWA - wR[0] * sinWA,
                  wF[1] * cosWA - wR[1] * sinWA,
                  wF[2] * cosWA - wR[2] * sinWA
                ];

                // 4 orthogonal orientations on wall top:
                // 1) Eave on Wall: bottom eave sits flush on wallTopCenter, roof slopes up
                // 2) Ridge on Wall: top ridge sits flush on wallTopCenter, roof slopes down
                for (let rotStep = 0; rotStep < 4; rotStep++) {
                  const a = rotStep * (Math.PI / 2);
                  const cosA = Math.cos(a);
                  const sinA = Math.sin(a);
                  const dirF = [
                    wallF_act[0] * cosA - wallR_act[0] * sinA,
                    wallF_act[1] * cosA - wallR_act[1] * sinA,
                    wallF_act[2] * cosA - wallR_act[2] * sinA
                  ];

                  // 1. Eave on Wall: pos offset horizontally by +dirF * 0.15 so eave (pos - dirF*0.15) == wallTopCenter!
                  // No vertical offset, sits directly on wallTopCenter with zero gap!
                  candidates.push({
                    pos: [
                      wallTopCenter[0] + dirF[0] * 0.15,
                      wallTopCenter[1] + dirF[1] * 0.15,
                      wallTopCenter[2] + dirF[2] * 0.15
                    ],
                    R: wallR_act,
                    F: wallF_act,
                    normal: wN,
                    angle: a,
                    worldF: dirF,
                    rotStep: rotStep,
                    type: 'wall_eave'
                  });

                  // 2. Ridge on Wall: pos offset by -dirF * 0.15 and -wN * 0.25 so ridge (pos + dirF*0.15 + wN*0.25) == wallTopCenter!
                  candidates.push({
                    pos: [
                      wallTopCenter[0] - dirF[0] * 0.15 - wN[0] * 0.25,
                      wallTopCenter[1] - dirF[1] * 0.15 - wN[1] * 0.25,
                      wallTopCenter[2] - dirF[2] * 0.15 - wN[2] * 0.25
                    ],
                    R: wallR_act,
                    F: wallF_act,
                    normal: wN,
                    angle: a,
                    worldF: dirF,
                    rotStep: rotStep,
                    type: 'wall_ridge'
                  });
                }
              }
            }

            // 3. FLOOR CANDIDATES (วางบนพื้น ขอบล่างแนบพื้น 100% ไม่มีช่องว่าง)
            for (let other of collectibles) {
              if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") && !other.isPreview) {
                const fP = other.position;
                const fN = other.normal || [0, 1, 0];

                const fodx = fP[0] - playerPt[0];
                const fody = fP[1] - playerPt[1];
                const fodz = fP[2] - playerPt[2];
                if (fodx * fodx + fody * fody + fodz * fodz > (maxReach + 1.2) * (maxReach + 1.2)) continue;

                let floorHH = 0;
                if (other.type === "stone_floor") floorHH = (other.size * 0.15) / 2;
                else if (other.type === "thin_wood_floor") floorHH = (other.size * 0.04) / 2;
                else floorHH = (woodFloorHeight + (other.size || 0.25) * 0.12) / 2;

                const floorTopCenter = [
                  fP[0] + fN[0] * floorHH,
                  fP[1] + fN[1] * floorHH,
                  fP[2] + fN[2] * floorHH
                ];

                const fR = other.R || [1, 0, 0];
                const fF = other.F || [0, 0, 1];
                const fAngle = other.angle || 0.0;
                const cosFA = Math.cos(fAngle);
                const sinFA = Math.sin(fAngle);
                const floorR_act = [
                  fR[0] * cosFA + fF[0] * sinFA,
                  fR[1] * cosFA + fF[1] * sinFA,
                  fR[2] * cosFA + fF[2] * sinFA
                ];
                const floorF_act = [
                  fF[0] * cosFA - fR[0] * sinFA,
                  fF[1] * cosFA - fR[1] * sinFA,
                  fF[2] * cosFA - fR[2] * sinFA
                ];

                for (let rotStep = 0; rotStep < 4; rotStep++) {
                  const a = rotStep * (Math.PI / 2);
                  const cosA = Math.cos(a);
                  const sinA = Math.sin(a);
                  const dirF = [
                    floorF_act[0] * cosA - floorR_act[0] * sinA,
                    floorF_act[1] * cosA - floorR_act[1] * sinA,
                    floorF_act[2] * cosA - floorR_act[2] * sinA
                  ];

                  candidates.push({
                    pos: [
                      floorTopCenter[0],
                      floorTopCenter[1],
                      floorTopCenter[2]
                    ],
                    R: floorR_act,
                    F: floorF_act,
                    normal: fN,
                    angle: a,
                    worldF: dirF,
                    rotStep: rotStep,
                    type: 'floor'
                  });
                }
              }
            }

            // Filter out candidates that are already occupied by an identical roof (same pos AND same direction)
            // Piercing / opposing / intersecting roofs are ALLOWED!
            const nonOccupiedCandidates = [];
            for (let cand of candidates) {
              let isOccupied = false;
              const cWF = cand.worldF;
              for (let other of collectibles) {
                if (other.active && other.type === "wood_roof" && !other.isPreview) {
                  const dx = other.position[0] - cand.pos[0];
                  const dy = other.position[1] - cand.pos[1];
                  const dz = other.position[2] - cand.pos[2];
                  const distSq = dx * dx + dy * dy + dz * dz;

                  if (distSq < 0.008) {
                    const oAngle = other.angle || 0.0;
                    const cosO = Math.cos(oAngle);
                    const sinO = Math.sin(oAngle);
                    const oR = other.R || [1, 0, 0];
                    const oF = other.F || [0, 0, 1];
                    const oWF = [
                      oF[0] * cosO - oR[0] * sinO,
                      oF[1] * cosO - oR[1] * sinO,
                      oF[2] * cosO - oR[2] * sinO
                    ];
                    const dotF = cWF[0] * oWF[0] + cWF[1] * oWF[1] + cWF[2] * oWF[2];
                    // Only occupied if already filled by a roof facing the exact same direction
                    if (dotF > 0.8) {
                      isOccupied = true;
                      break;
                    }
                  }
                }
              }
              if (!isOccupied) {
                nonOccupiedCandidates.push(cand);
              }
            }

            // Score candidates based on camera crosshair line-of-sight & reach
            const currentQRotStep = Math.round(((curAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2)) % 4;

            const validCandidates = [];
            for (let cand of nonOccupiedCandidates) {
              const pdx = cand.pos[0] - playerPt[0];
              const pdy = cand.pos[1] - playerPt[1];
              const pdz = cand.pos[2] - playerPt[2];
              const pDist = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz);
              if (pDist > maxReach) continue;

              const vx = cand.pos[0] - eyePos[0];
              const vy = cand.pos[1] - eyePos[1];
              const vz = cand.pos[2] - eyePos[2];
              const proj = vx * lookDir[0] + vy * lookDir[1] + vz * lookDir[2];

              if (proj > 0.05) {
                const closeX = eyePos[0] + lookDir[0] * proj;
                const closeY = eyePos[1] + lookDir[1] * proj;
                const closeZ = eyePos[2] + lookDir[2] * proj;
                const rayDist = Math.sqrt((cand.pos[0] - closeX)**2 + (cand.pos[1] - closeY)**2 + (cand.pos[2] - closeZ)**2);
                const angularDist = rayDist / (proj * 0.6 + 0.4);

                if (rayDist <= 2.2 || angularDist <= 0.8) {
                  // Type prioritization: step 1 slope-up and lateral extension take natural priority
                  let typeBonus = 1.0;
                  
                  if (cand.rotStep !== undefined) {
                    const rotDiff = Math.abs(cand.rotStep - currentQRotStep);
                    const minRotDiff = Math.min(rotDiff, 4 - rotDiff);
                    if (minRotDiff !== 0) continue;
                  }

                  if (cand.type === 'roof_slope_up') {
                    typeBonus = 0.5 + (cand.step || 1) * 0.15; // Closer slope steps take priority
                  } else if (cand.type === 'roof_side') {
                    typeBonus = 0.65;
                  } else if (cand.type === 'roof_slope_down') {
                    typeBonus = 0.75 + (cand.step || 1) * 0.2;
                  } else if (cand.type === 'roof_peak') {
                    typeBonus = 0.8;
                  } else if (cand.type.startsWith('wall') || cand.type === 'floor') {
                    const roleBonus = (cand.type === 'wall_eave') ? 1.0 : (cand.type === 'floor' ? 1.1 : 1.25);
                    typeBonus = 0.8 * roleBonus;
                  }

                  const score = (angularDist * 2.5 + (pDist / maxReach) * 0.5) * typeBonus;
                  validCandidates.push({
                    ...cand,
                    score,
                    rayDist,
                    pDist
                  });
                }
              }
            }

            // Fallback: If camera ray didn't hit within angular threshold, check distance to targetPos
            if (validCandidates.length === 0) {
              for (let cand of nonOccupiedCandidates) {
                const cdx = targetPos[0] - cand.pos[0];
                const cdy = targetPos[1] - cand.pos[1];
                const cdz = targetPos[2] - cand.pos[2];
                const dist = Math.sqrt(cdx * cdx + cdy * cdy + cdz * cdz);
                if (dist < 1.4) {
                  if (cand.rotStep !== undefined) {
                    const rotDiff = Math.abs(cand.rotStep - currentQRotStep);
                    const minRotDiff = Math.min(rotDiff, 4 - rotDiff);
                    if (minRotDiff !== 0) continue;
                  }
                  
                  let typeBonus = 1.0;
                  if (cand.type.startsWith('wall') || cand.type === 'floor') {
                    typeBonus = 1.0;
                  }
                  validCandidates.push({
                    ...cand,
                    score: dist * 2.0 * typeBonus,
                    rayDist: dist,
                    pDist: dist
                  });
                }
              }
            }

            // Find best candidate with lowest score
            let bestCand = null;
            let bestScore = Infinity;
            for (let c of validCandidates) {
              if (c.score < bestScore) {
                bestScore = c.score;
                bestCand = c;
              }
            }

            // Snap if a valid candidate slot on wall or roof was selected
            if (bestCand) {
              targetPos = [bestCand.pos[0], bestCand.pos[1], bestCand.pos[2]];
              pN = [bestCand.normal[0], bestCand.normal[1], bestCand.normal[2]];
              pR = [bestCand.R[0], bestCand.R[1], bestCand.R[2]];
              pF = [bestCand.F[0], bestCand.F[1], bestCand.F[2]];
              floorPreviewCollectible.angle = bestCand.angle;
              isSnapped = true;
              floorPreviewCollectible.isValidPlacement = true;
            } else {
              isSnapped = false;
              floorPreviewCollectible.isValidPlacement = false;
            }

            // Final duplicate collision check: only reject if duplicate roof facing identical direction exists
            if (isSnapped && floorPreviewCollectible.isValidPlacement) {
              const curCos = Math.cos(floorPreviewCollectible.angle);
              const curSin = Math.sin(floorPreviewCollectible.angle);
              const curWF = [
                pF[0] * curCos - pR[0] * curSin,
                pF[1] * curCos - pR[1] * curSin,
                pF[2] * curCos - pR[2] * curSin
              ];

              for (let other of collectibles) {
                if (other.active && other.type === "wood_roof" && !other.isPreview) {
                  const ox = other.position[0] - targetPos[0];
                  const oy = other.position[1] - targetPos[1];
                  const oz = other.position[2] - targetPos[2];
                  const distSq = ox * ox + oy * oy + oz * oz;

                  if (distSq < 0.008) {
                    const oAngle = other.angle || 0.0;
                    const cosO = Math.cos(oAngle);
                    const sinO = Math.sin(oAngle);
                    const oR = other.R || [1, 0, 0];
                    const oF = other.F || [0, 0, 1];
                    const oWF = [
                      oF[0] * cosO - oR[0] * sinO,
                      oF[1] * cosO - oR[1] * sinO,
                      oF[2] * cosO - oR[2] * sinO
                    ];
                    const dot = curWF[0] * oWF[0] + curWF[1] * oWF[1] + curWF[2] * oWF[2];

                    if (dot > 0.8) {
                      floorPreviewCollectible.isValidPlacement = false;
                      break;
                    }
                  }
                }
              }
            }
          } else if (typeToPlace === "wood_wall" || typeToPlace === "wood_window" || typeToPlace === "wood_door" || typeToPlace === "thin_wood_floor" || typeToPlace === "wood_chest" || typeToPlace === "wood_bed" || typeToPlace === "wood_table" || typeToPlace === "wood_planter_box" || typeToPlace === "wood_chair" || typeToPlace === "lantern" || typeToPlace === "meganeura_item" || typeToPlace === "isopod_item" || typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item") {
            // Direct wall snap for wood_window and wood_door
            if (typeToPlace === "wood_window" || typeToPlace === "wood_door") {
              let nearestWall = null;
              let nearestWallDist = Infinity;
              const wallCands = (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.queryRadius === "function")
                ? SpatialGrid.queryRadius(targetPos[0], targetPos[1], targetPos[2], 2.2)
                : collectibles;
              for (let i = 0; i < wallCands.length; i++) {
                const other = wallCands[i];
                if (other && other.active && other.type === "wood_wall" && !other.isPreview && other.position) {
                  const dx = other.position[0] - targetPos[0];
                  const dy = other.position[1] - targetPos[1];
                  const dz = other.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                  if (dist < nearestWallDist && dist < 2.0) {
                    nearestWallDist = dist;
                    nearestWall = other;
                  }
                }
              }

              if (nearestWall) {
                let hasFixture = false;
                const fixCands = (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.queryRadius === "function")
                  ? SpatialGrid.queryRadius(nearestWall.position[0], nearestWall.position[1], nearestWall.position[2], 0.35)
                  : collectibles;
                for (let i = 0; i < fixCands.length; i++) {
                  const other = fixCands[i];
                  if (other && other.active && (other.type === "wood_window" || other.type === "wood_door") && !other.isPreview && other.position) {
                    const ox = other.position[0] - nearestWall.position[0];
                    const oy = other.position[1] - nearestWall.position[1];
                    const oz = other.position[2] - nearestWall.position[2];
                    if (ox * ox + oy * oy + oz * oz < 0.02) {
                      hasFixture = true;
                      break;
                    }
                  }
                }

                floorPreviewCollectible.isValidPlacement = !hasFixture;
                floorPreviewCollectible.size = 0.25;

                targetPos = [
                  nearestWall.position[0],
                  nearestWall.position[1],
                  nearestWall.position[2]
                ];

                pN = [nearestWall.normal[0], nearestWall.normal[1], nearestWall.normal[2]];
                pR = [nearestWall.R[0], nearestWall.R[1], nearestWall.R[2]];
                pF = [nearestWall.F[0], nearestWall.F[1], nearestWall.F[2]];

                const baseAngle = (nearestWall.angle !== undefined) ? nearestWall.angle : 0.0;
                const rotQ = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
                const flipAngle = Math.round(rotQ / Math.PI) * Math.PI;
                floorPreviewCollectible.angle = baseAngle + flipAngle;
                isSnapped = true;
              }
            }

            // Direct table snap for wood_chair (Snap chair neatly into table seating slots)
            if (!isSnapped && typeToPlace === "wood_chair") {
              let nearestTable = null;
              let nearestTableDist = Infinity;
              for (let other of collectibles) {
                if (other && other.active && !other.isPreview && other.type === "wood_table") {
                  const dx = other.position[0] - targetPos[0];
                  const dy = other.position[1] - targetPos[1];
                  const dz = other.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                  if (dist < nearestTableDist && dist < 0.48) {
                    nearestTableDist = dist;
                    nearestTable = other;
                  }
                }
              }

              if (nearestTable) {
                const tR = nearestTable.R || [1, 0, 0];
                const tF = nearestTable.F || [0, 0, 1];
                const tN = nearestTable.normal || [0, 1, 0];
                const tP = nearestTable.position;

                const tdx = targetPos[0] - tP[0];
                const tdy = targetPos[1] - tP[1];
                const tdz = targetPos[2] - tP[2];
                const localX = tdx * tR[0] + tdy * tR[1] + tdz * tR[2];
                const localZ = tdx * tF[0] + tdy * tF[1] + tdz * tF[2];
                const localY = tdx * tN[0] + tdy * tN[1] + tdz * tN[2];

                if (Math.abs(localY) < 0.35) {
                  // Table dimensions: width along tR is 0.12 (half 0.060), depth along tF is 0.092 (half 0.046)
                  // Chair width: 0.062 (half 0.031).
                  // Chair backrest is at -f * 0.0248, chair front faces +f.
                  // Front side (+tF): offset +0.064, chair faces -tF
                  // Back side (-tF): offset -0.064, chair faces +tF
                  // Left side (-tR): offset -0.076, chair faces +tR
                  // Right side (+tR): offset +0.076, chair faces -tR
                  // The table has only 2 openings (2 ช่องด้านหน้าและด้านหลัง ระหว่างขาโต๊ะ):
                  // 1) Front slot (ช่องหน้า กึ่งกลางระหว่างขาโต๊ะหน้า): x = 0, z = +0.050
                  // 2) Back slot (ช่องหลัง กึ่งกลางระหว่างขาโต๊ะหลัง): x = 0, z = -0.050
                  // Tucked in cleanly under the tabletop (เบาะเก้าอี้สอดเข้าใต้โต๊ะอย่างพอดี ไม่ยื่นล้น และอยู่ตรงกลางพอดี)
                  const tableSlots = [
                    {
                      name: "front",
                      x: 0.0,
                      z: 0.050,
                      dirF: [-tF[0], -tF[1], -tF[2]],
                      dirR: [-tR[0], -tR[1], -tR[2]],
                      baseAngle: Math.PI
                    },
                    {
                      name: "back",
                      x: 0.0,
                      z: -0.050,
                      dirF: [tF[0], tF[1], tF[2]],
                      dirR: [tR[0], tR[1], tR[2]],
                      baseAngle: 0.0
                    }
                  ];

                  let bestSlot = null;
                  let bestSlotScore = Infinity;

                  for (let s of tableSlots) {
                    const sWorldPos = [
                      tP[0] + tR[0] * s.x + tF[0] * s.z,
                      tP[1] + tR[1] * s.x + tF[1] * s.z,
                      tP[2] + tR[2] * s.x + tF[2] * s.z
                    ];

                    // Check if slot already has another chair placed
                    let isOccupied = false;
                    for (let other of collectibles) {
                      if (other && other.active && !other.isPreview && other.type === "wood_chair") {
                        const odx = other.position[0] - sWorldPos[0];
                        const ody = other.position[1] - sWorldPos[1];
                        const odz = other.position[2] - sWorldPos[2];
                        if (odx * odx + ody * ody + odz * odz < 0.0016) { // ~4cm
                          isOccupied = true;
                          break;
                        }
                      }
                    }

                    // Check if slot penetrates an existing wall
                    let isInsideWall = false;
                    for (let other of collectibles) {
                      if (other && other.active && !other.isPreview && (other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door")) {
                        const wdx = other.position[0] - sWorldPos[0];
                        const wdy = other.position[1] - sWorldPos[1];
                        const wdz = other.position[2] - sWorldPos[2];
                        if (wdx * wdx + wdy * wdy + wdz * wdz < 0.0036) { // ~6cm
                          isInsideWall = true;
                          break;
                        }
                      }
                    }

                    const dist2D = Math.sqrt((localX - s.x) * (localX - s.x) + (localZ - s.z) * (localZ - s.z));
                    let score = dist2D;
                    if (isOccupied) score += 5.0;
                    if (isInsideWall) score += 10.0;

                    if (score < bestSlotScore) {
                      bestSlotScore = score;
                      bestSlot = { ...s, worldPos: sWorldPos, isOccupied, isInsideWall, rawDist: dist2D };
                    }
                  }

                  if (bestSlot && bestSlot.rawDist < 0.28) {
                    targetPos = [bestSlot.worldPos[0], bestSlot.worldPos[1], bestSlot.worldPos[2]];
                    pN = [tN[0], tN[1], tN[2]];

                    // Allow rotating the chair at the table slot with Q key (placementRotationAngle)
                    const rotQ = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
                    const cosQ = Math.cos(rotQ);
                    const sinQ = Math.sin(rotQ);

                    pR = [
                      bestSlot.dirR[0] * cosQ - bestSlot.dirF[0] * sinQ,
                      bestSlot.dirR[1] * cosQ - bestSlot.dirF[1] * sinQ,
                      bestSlot.dirR[2] * cosQ - bestSlot.dirF[2] * sinQ
                    ];
                    pF = [
                      bestSlot.dirF[0] * cosQ + bestSlot.dirR[0] * sinQ,
                      bestSlot.dirF[1] * cosQ + bestSlot.dirR[1] * sinQ,
                      bestSlot.dirF[2] * cosQ + bestSlot.dirR[2] * sinQ
                    ];

                    floorPreviewCollectible.angle = bestSlot.baseAngle + rotQ;
                    floorPreviewCollectible.isValidPlacement = !bestSlot.isOccupied && !bestSlot.isInsideWall;
                    floorPreviewCollectible.size = 0.25;
                    isSnapped = true;
                  }
                }
              }
            }

            // Direct tabletop placement for lantern (วางตะเกียงบนโต๊ะไม้)
            if (!isSnapped && typeToPlace === "lantern") {
              const reachLim = Math.max((typeof actionReachDistance === "number" ? actionReachDistance : 0.25) + 0.22, 0.48);
              const aimOrigin = [nx * currentFeetRad, ny * currentFeetRad, nz * currentFeetRad];
              let bestTableMatch = null;
              let bestTableScore = Infinity;

              for (let other of collectibles) {
                if (other && other.active && !other.isPreview && other.type === "wood_table") {
                  const tR = other.R || [1, 0, 0];
                  const tF = other.F || [0, 0, 1];
                  const tN = other.normal || [0, 1, 0];
                  const tP = other.position;

                  // Vector from player's feet to table base center
                  const vdx = tP[0] - aimOrigin[0];
                  const vdy = tP[1] - aimOrigin[1];
                  const vdz = tP[2] - aimOrigin[2];
                  const localY = vdx * tN[0] + vdy * tN[1] + vdz * tN[2];
                  if (Math.abs(localY) > 0.35) continue;

                  // Forward distance along the white aim line (aimF)
                  const projF = vdx * aimF[0] + vdy * aimF[1] + vdz * aimF[2];

                  // 1) White line tip position in table local coordinates
                  const tdx = targetPos[0] - tP[0];
                  const tdy = targetPos[1] - tP[1];
                  const tdz = targetPos[2] - tP[2];
                  const tipLocalX = tdx * tR[0] + tdy * tR[1] + tdz * tR[2];
                  const tipLocalZ = tdx * tF[0] + tdy * tF[1] + tdz * tF[2];

                  // 2) Point along the white aim ray closest to the table's forward depth
                  const clampedProj = Math.max(0.04, Math.min(reachLim, projF));
                  const rayPtX = aimOrigin[0] + aimF[0] * clampedProj;
                  const rayPtY = aimOrigin[1] + aimF[1] * clampedProj;
                  const rayPtZ = aimOrigin[2] + aimF[2] * clampedProj;
                  const rdx = rayPtX - tP[0];
                  const rdy = rayPtY - tP[1];
                  const rdz = rayPtZ - tP[2];
                  const rayLocalX = rdx * tR[0] + rdy * tR[1] + rdz * tR[2];
                  const rayLocalZ = rdx * tF[0] + rdy * tF[1] + rdz * tF[2];

                  const isTipOnTable = (Math.abs(tipLocalX) <= 0.145 && Math.abs(tipLocalZ) <= 0.135);
                  const isRayOnTable = (projF > 0.02 && projF <= reachLim && Math.abs(rayLocalX) <= 0.120 && Math.abs(rayLocalZ) <= 0.108);

                  if (isTipOnTable || isRayOnTable) {
                    const score = Math.hypot(rayLocalX, rayLocalZ) + Math.hypot(tipLocalX, tipLocalZ) * 0.5;
                    if (score < bestTableScore) {
                      bestTableScore = score;
                      const useX = (Math.abs(tipLocalX) <= 0.060 && Math.abs(tipLocalZ) <= 0.046)
                        ? tipLocalX
                        : (rayLocalX * 0.65 + tipLocalX * 0.35);
                      const useZ = (Math.abs(tipLocalX) <= 0.060 && Math.abs(tipLocalZ) <= 0.046)
                        ? tipLocalZ
                        : (rayLocalZ * 0.65 + tipLocalZ * 0.35);
                      bestTableMatch = { table: other, localX: useX, localZ: useZ };
                    }
                  }
                }
              }

              if (bestTableMatch) {
                const nearestTable = bestTableMatch.table;
                const tR = nearestTable.R || [1, 0, 0];
                const tF = nearestTable.F || [0, 0, 1];
                const tN = nearestTable.normal || [0, 1, 0];
                const tP = nearestTable.position;

                // Tabletop top surface is at (0.134 + 0.011) * 0.46 = 0.0667
                const tableTopH = 0.145 * 0.46;
                const subStep = 0.015;
                let snapX = Math.round(bestTableMatch.localX / subStep) * subStep;
                let snapZ = Math.round(bestTableMatch.localZ / subStep) * subStep;
                // Clamp within tabletop bounds so lantern base (half-width 0.017) never overhangs the table edge
                snapX = Math.max(-0.040, Math.min(0.040, snapX));
                snapZ = Math.max(-0.026, Math.min(0.026, snapZ));

                const candPos = [
                  tP[0] + tR[0] * snapX + tF[0] * snapZ + tN[0] * tableTopH,
                  tP[1] + tR[1] * snapX + tF[1] * snapZ + tN[1] * tableTopH,
                  tP[2] + tR[2] * snapX + tF[2] * snapZ + tN[2] * tableTopH
                ];

                let isOverlapOnTable = false;
                for (let other of collectibles) {
                  if (other && other.active && !other.isPreview && other.type === "lantern") {
                    const odx = other.position[0] - candPos[0];
                    const ody = other.position[1] - candPos[1];
                    const odz = other.position[2] - candPos[2];
                    if (odx * odx + ody * ody + odz * odz < 0.0011) { // ~3.3cm
                      isOverlapOnTable = true;
                      break;
                    }
                  }
                }

                targetPos = candPos;
                pN = [tN[0], tN[1], tN[2]];

                const rotQ = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
                const cosQ = Math.cos(rotQ);
                const sinQ = Math.sin(rotQ);
                pR = [
                  tR[0] * cosQ - tF[0] * sinQ,
                  tR[1] * cosQ - tF[1] * sinQ,
                  tR[2] * cosQ - tF[2] * sinQ
                ];
                pF = [
                  tF[0] * cosQ + tR[0] * sinQ,
                  tF[1] * cosQ + tR[1] * sinQ,
                  tF[2] * cosQ + tR[2] * sinQ
                ];

                floorPreviewCollectible.angle = rotQ;
                floorPreviewCollectible.isValidPlacement = !isOverlapOnTable;
                floorPreviewCollectible.size = 0.25;
                isSnapped = true;
              }
            }

            // Find nearest wood_floor for grid snapping (Only placeable on wood floors)
            let nearestFloor = null;
            let nearestDist = Infinity;
            if (!isSnapped) {
              for (let other of collectibles) {
                const isAllowedFloor = (typeToPlace === "wood_bed" || typeToPlace === "lantern")
                  ? (other.type === "wood_floor" || other.type === "thin_wood_floor")
                  : (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor");
                if (other.active && isAllowedFloor && !other.isPreview) {
                  const dx = other.position[0] - targetPos[0];
                  const dy = other.position[1] - targetPos[1];
                  const dz = other.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestFloor = other;
                  }
                }
              }
            }

            const maxFloorDist = (typeToPlace === "thin_wood_floor" || typeToPlace === "wood_wall" || typeToPlace === "wood_window" || typeToPlace === "wood_door") ? 2.5 : ((typeToPlace === "wood_bed" || typeToPlace === "lantern") ? 1.2 : 0.6);
            if (nearestFloor && nearestDist < maxFloorDist) {
                const sR = nearestFloor.R || [1, 0, 0];
                const sF = nearestFloor.F || [0, 0, 1];
                const sN = nearestFloor.normal || [0, 1, 0];
                const sP = nearestFloor.position;

                // Project targetPos onto wood floor plane
                const dx = targetPos[0] - sP[0];
                const dy = targetPos[1] - sP[1];
                const dz = targetPos[2] - sP[2];

                const localX = dx * sR[0] + dy * sR[1] + dz * sR[2];
                const localZ = dx * sF[0] + dy * sF[1] + dz * sF[2];

                // If within expanded wood_floor bounds (generous snapping)
                let snapBound = (typeToPlace === "thin_wood_floor" && (nearestFloor.type === "thin_wood_floor" || nearestFloor.type === "wood_floor")) ? 0.65 : ((typeToPlace === "wood_bed" || typeToPlace === "lantern") ? 0.45 : 0.35);
                if (Math.abs(localX) <= snapBound && Math.abs(localZ) <= snapBound) {
                    // Snap localX and localZ to 0.15 grid (-0.15, 0.0, 0.15)
                    let gridX = Math.round(localX / 0.15);
                    let gridZ = Math.round(localZ / 0.15);

                    // Prevent center and corner placement for walls to avoid overlapping side-by-side, unless placing on thin_wood_floor which allows center placement, or if placing thin_wood_floor itself.
                    if (typeToPlace === "wood_chest" || typeToPlace === "wood_bed" || typeToPlace === "wood_table" || typeToPlace === "wood_planter_box" || typeToPlace === "wood_chair" || typeToPlace === "lantern" || typeToPlace === "meganeura_item" || typeToPlace === "isopod_item" || typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item" || typeToPlace.startsWith("robot_")) {
                        const isWoodFloor = (nearestFloor.type === "wood_floor" || nearestFloor.type === "thin_wood_floor");
                        let validPlace = (typeToPlace === "wood_bed" || typeToPlace === "lantern") ? isWoodFloor : true;
                        floorPreviewCollectible.size = 0.25;

                        let floorHH = 0;
                        if (nearestFloor.type === "stone_floor") floorHH = nearestFloor.size * 0.15;
                        else if (nearestFloor.type === "wood_floor") floorHH = woodFloorHeight + nearestFloor.size * 0.12;
                        else if (nearestFloor.type === "thin_wood_floor") floorHH = nearestFloor.size * 0.04;

                        let floatOffset = 0;
                        if (typeToPlace === "robot_cockpit") floatOffset = 0.14;
                        else if (typeToPlace === "robot_left_leg" || typeToPlace === "robot_right_leg") floatOffset = 0.14;
                        else if (typeToPlace === "robot_stand") floatOffset = 0.0;
                        else if (typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item") floatOffset = 0.002;
                        else if (typeToPlace.startsWith("robot_")) floatOffset = 0.35;

                        // Rotation angle & rotated 2D footprint half-extents (The Sims style)
                        const rotAngle = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
                        const cosA = Math.cos(rotAngle);
                        const sinA = Math.sin(rotAngle);

                        let halfW = 0.06, halfD = 0.06;
                        if (typeToPlace === "wood_bed") {
                            halfW = 0.075; // 0.32 * 0.46 / 2
                            halfD = 0.121; // 0.52 * 0.46 / 2
                        } else if (typeToPlace === "wood_chest") {
                            halfW = 0.058; // 0.25 * 0.45 / 2
                            halfD = 0.048; // 0.21 * 0.45 / 2
                        } else if (typeToPlace === "wood_table" || typeToPlace === "wood_planter_box") {
                            halfW = 0.060; // 0.26 * 0.46 / 2
                            halfD = 0.046; // 0.20 * 0.46 / 2
                        } else if (typeToPlace === "wood_chair") {
                            halfW = 0.032; // 0.135 * 0.46 / 2
                            halfD = 0.032; // 0.135 * 0.46 / 2
                        } else if (typeToPlace === "lantern") {
                            halfW = 0.018; // 0.074 * 0.46 / 2
                            halfD = 0.018; // 0.074 * 0.46 / 2
                        } else if (typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item") {
                            halfW = 0.085;
                            halfD = 0.085;
                        }
                        const extX = Math.abs(halfW * cosA) + Math.abs(halfD * sinA);
                        const extZ = Math.abs(halfW * sinA) + Math.abs(halfD * cosA);

                        // 1) Fine Sims-style sub-grid (0.025 step instead of 0.15 wall-edge jumps)
                        const subStep = 0.025;
                        let fX = Math.round(localX / subStep) * subStep;
                        let fZ = Math.round(localZ / subStep) * subStep;

                        // 2) Scan neighboring floors, walls, and placed furniture on the same story
                        let hasFloorNegX = false, hasFloorPosX = false, hasFloorNegZ = false, hasFloorPosZ = false;
                        const nearbyWalls = [];
                        const nearbyFurniture = [];

                        for (let other of collectibles) {
                            if (!other || !other.active || other.isPreview || other === nearestFloor) continue;
                            const odx = other.position[0] - sP[0];
                            const ody = other.position[1] - sP[1];
                            const odz = other.position[2] - sP[2];
                            const olX = odx * sR[0] + ody * sR[1] + odz * sR[2];
                            const olZ = odx * sF[0] + ody * sF[1] + odz * sF[2];
                            const olN = odx * sN[0] + ody * sN[1] + odz * sN[2];

                            if (Math.abs(olX) > 0.55 || Math.abs(olZ) > 0.55) continue;

                            // Check adjacent floors at the same height level so items don't overhang into mid-air
                            const isValidNeighborFloor = (typeToPlace === "wood_bed" || typeToPlace === "lantern")
                                ? (other.type === "wood_floor" || other.type === "thin_wood_floor")
                                : (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor");
                            if (isValidNeighborFloor && Math.abs(olN) < 0.08) {
                                if (olX < -0.20 && olX > -0.42 && Math.abs(olZ) < 0.15) hasFloorNegX = true;
                                if (olX >  0.20 && olX <  0.42 && Math.abs(olZ) < 0.15) hasFloorPosX = true;
                                if (olZ < -0.20 && olZ > -0.42 && Math.abs(olX) < 0.15) hasFloorNegZ = true;
                                if (olZ >  0.20 && olZ <  0.42 && Math.abs(olX) < 0.15) hasFloorPosZ = true;
                            }

                            // Check walls, windows, and doors at this floor story level
                            if ((other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door") && olN >= -0.05 && olN <= floorHH + 0.22) {
                                const wAngle = other.angle || 0.0;
                                const cosW = Math.cos(wAngle);
                                const sinW = Math.sin(wAngle);
                                const oR = other.R || sR;
                                const oF = other.F || sF;
                                const wallR0 = oR[0] * cosW + oF[0] * sinW;
                                const wallR1 = oR[1] * cosW + oF[1] * sinW;
                                const wallR2 = oR[2] * cosW + oF[2] * sinW;
                                const projRX = Math.abs(wallR0 * sR[0] + wallR1 * sR[1] + wallR2 * sR[2]);
                                const projRZ = Math.abs(wallR0 * sF[0] + wallR1 * sF[1] + wallR2 * sF[2]);
                                const wallHalfLen = 0.152;
                                const wallHalfThick = 0.024;
                                const wHalfX = projRX * wallHalfLen + projRZ * wallHalfThick;
                                const wHalfZ = projRZ * wallHalfLen + projRX * wallHalfThick;
                                nearbyWalls.push({ olX, olZ, wHalfX, wHalfZ });
                            }

                            // Check other placed furniture on this floor to prevent overlapping objects
                            const isFloorLevelLantern = (other.type === "lantern" && Math.abs(olN - (floorHH / 2)) < 0.035);
                            if ((other.type === "wood_bed" || other.type === "wood_chest" || other.type === "wood_table" || other.type === "wood_planter_box" || other.type === "wood_chair" || isFloorLevelLantern || other.type === "obsidian_pad_warp_item" || other.type === "obsidian_compass_pad_item") && Math.abs(olN - (floorHH / 2)) < 0.12) {
                                const oR = other.R || sR;
                                const oF = other.F || sF;
                                let oHalfW = 0.06, oHalfD = 0.06;
                                if (other.type === "wood_bed") { oHalfW = 0.075; oHalfD = 0.121; }
                                else if (other.type === "wood_chest") { oHalfW = 0.058; oHalfD = 0.048; }
                                else if (other.type === "wood_table" || other.type === "wood_planter_box") { oHalfW = 0.060; oHalfD = 0.046; }
                                else if (other.type === "wood_chair") { oHalfW = 0.032; oHalfD = 0.032; }
                                else if (other.type === "lantern") { oHalfW = 0.018; oHalfD = 0.018; }
                                else { oHalfW = 0.085; oHalfD = 0.085; }
                                const rDotX = Math.abs(oR[0] * sR[0] + oR[1] * sR[1] + oR[2] * sR[2]);
                                const fDotX = Math.abs(oF[0] * sR[0] + oF[1] * sR[1] + oF[2] * sR[2]);
                                const rDotZ = Math.abs(oR[0] * sF[0] + oR[1] * sF[1] + oR[2] * sF[2]);
                                const fDotZ = Math.abs(oF[0] * sF[0] + oF[1] * sF[1] + oF[2] * sF[2]);
                                nearbyFurniture.push({
                                    olX,
                                    olZ,
                                    oExtX: oHalfW * rDotX + oHalfD * fDotX,
                                    oExtZ: oHalfW * rDotZ + oHalfD * fDotZ
                                });
                            }
                        }

                        // 3) Clamp to floor edges (unless an adjacent floor continues in that direction)
                        let minX = hasFloorNegX ? -0.15 : (-0.15 + extX);
                        let maxX = hasFloorPosX ?  0.15 : ( 0.15 - extX);
                        let minZ = hasFloorNegZ ? -0.15 : (-0.15 + extZ);
                        let maxZ = hasFloorPosZ ?  0.15 : ( 0.15 - extZ);

                        // 4) Push back flush against tile-edge walls (The Sims wall-stop behavior)
                        for (let w of nearbyWalls) {
                            // Vertical wall running along Z (left/right edge of tile)
                            if (w.wHalfX < 0.06 && Math.abs(fZ - w.olZ) < (w.wHalfZ + extZ - 0.01)) {
                                if (w.olX < 0 && w.olX > -0.25) {
                                    minX = Math.max(minX, w.olX + w.wHalfX + extX);
                                } else if (w.olX > 0 && w.olX < 0.25) {
                                    maxX = Math.min(maxX, w.olX - w.wHalfX - extX);
                                }
                            }
                            // Horizontal wall running along X (front/back edge of tile)
                            if (w.wHalfZ < 0.06 && Math.abs(fX - w.olX) < (w.wHalfX + extX - 0.01)) {
                                if (w.olZ < 0 && w.olZ > -0.25) {
                                    minZ = Math.max(minZ, w.olZ + w.wHalfZ + extZ);
                                } else if (w.olZ > 0 && w.olZ < 0.25) {
                                    maxZ = Math.min(maxZ, w.olZ - w.wHalfZ - extZ);
                                }
                            }
                        }

                        if (minX <= maxX) {
                            fX = Math.max(minX, Math.min(maxX, fX));
                        } else {
                            fX = (minX + maxX) * 0.5;
                            validPlace = false;
                        }
                        if (minZ <= maxZ) {
                            fZ = Math.max(minZ, Math.min(maxZ, fZ));
                        } else {
                            fZ = (minZ + maxZ) * 0.5;
                            validPlace = false;
                        }

                        // 5) Iterative 2D AABB push-out for corner/perpendicular walls
                        for (let iter = 0; iter < 2; iter++) {
                            for (let w of nearbyWalls) {
                                const overlapX = (extX + w.wHalfX) - Math.abs(fX - w.olX);
                                const overlapZ = (extZ + w.wHalfZ) - Math.abs(fZ - w.olZ);
                                if (overlapX > 0 && overlapZ > 0) {
                                    if (overlapX < overlapZ) {
                                        fX += (fX >= w.olX ? overlapX : -overlapX);
                                    } else {
                                        fZ += (fZ >= w.olZ ? overlapZ : -overlapZ);
                                    }
                                }
                            }
                            if (minX <= maxX) fX = Math.max(minX, Math.min(maxX, fX));
                            if (minZ <= maxZ) fZ = Math.max(minZ, Math.min(maxZ, fZ));
                        }

                        // 6) Final strict overlap check against walls and other furniture
                        for (let w of nearbyWalls) {
                            const overlapX = (extX + w.wHalfX - 0.004) - Math.abs(fX - w.olX);
                            const overlapZ = (extZ + w.wHalfZ - 0.004) - Math.abs(fZ - w.olZ);
                            if (overlapX > 0 && overlapZ > 0) {
                                validPlace = false;
                                break;
                            }
                        }
                        if (validPlace) {
                            for (let fn of nearbyFurniture) {
                                const overlapX = (extX + fn.oExtX - 0.006) - Math.abs(fX - fn.olX);
                                const overlapZ = (extZ + fn.oExtZ - 0.006) - Math.abs(fZ - fn.olZ);
                                if (overlapX > 0 && overlapZ > 0) {
                                    validPlace = false;
                                    break;
                                }
                            }
                        }

                        floorPreviewCollectible.isValidPlacement = validPlace;
                        targetPos = [
                            sP[0] + sR[0] * fX + sF[0] * fZ + sN[0] * (floorHH / 2 + floatOffset),
                            sP[1] + sR[1] * fX + sF[1] * fZ + sN[1] * (floorHH / 2 + floatOffset),
                            sP[2] + sR[2] * fX + sF[2] * fZ + sN[2] * (floorHH / 2 + floatOffset)
                        ];

                        pN = [sN[0], sN[1], sN[2]];
                        pR = [sR[0] * cosA - sF[0] * sinA, sR[1] * cosA - sF[1] * sinA, sR[2] * cosA - sF[2] * sinA];
                        pF = [sF[0] * cosA + sR[0] * sinA, sF[1] * cosA + sR[1] * sinA, sF[2] * cosA + sR[2] * sinA];
                        isSnapped = true;
                    } else {
                        if (gridX === 0 && gridZ === 0) {
                        if (nearestFloor.type !== "thin_wood_floor" && typeToPlace !== "thin_wood_floor") {
                            if (Math.abs(localX) > Math.abs(localZ)) {
                                gridX = localX > 0 ? 1 : -1;
                            } else {
                                gridZ = localZ > 0 ? 1 : -1;
                            }
            }
          } else {
                        if (typeToPlace === "thin_wood_floor") {
                            // Thin wood floor must align with full tiles (0 or +/-2)
                            gridX = Math.round(gridX / 2) * 2;
                            gridZ = Math.round(gridZ / 2) * 2;
                            gridX = Math.max(-2, Math.min(2, gridX));
                            gridZ = Math.max(-2, Math.min(2, gridZ));
                        } else {
                            gridX = Math.max(-1, Math.min(1, gridX));
                            gridZ = Math.max(-1, Math.min(1, gridZ));
                        }
                        
                        if (Math.abs(gridX) >= 1 && Math.abs(gridZ) >= 1) {
                            if (Math.abs(localX) > Math.abs(localZ)) {
                                gridZ = 0;
                            } else {
                                gridX = 0;
                            }
                        }
                    }

                    floorPreviewCollectible.isValidPlacement = true;
                    floorPreviewCollectible.size = 0.25;

                    const floorThickness = (typeof window !== "undefined" && window.getFloorThickness) 
                      ? window.getFloorThickness(nearestFloor) 
                      : (nearestFloor.type === "stone_floor" 
                        ? (nearestFloor.size || 0.25) * 0.15 
                        : (nearestFloor.type === "thin_wood_floor" 
                          ? (nearestFloor.size || 0.25) * 0.04 
                          : ((typeof window !== "undefined" && window.woodFloorHeight !== undefined ? window.woodFloorHeight : 0.05) + (nearestFloor.size || 0.25) * 0.12)));
                    const floorTopOffset = floorThickness / 2;

                    // Center the wall relative to the floor plane but offset up on the floor normal
                    targetPos = [
                        sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * floorTopOffset,
                        sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * floorTopOffset,
                        sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * floorTopOffset
                    ];

                    pN = [sN[0], sN[1], sN[2]];
                    pR = [sR[0], sR[1], sR[2]];
                    pF = [sF[0], sF[1], sF[2]];
                    floorPreviewCollectible.angle = (gridX !== 0) ? Math.PI / 2 : 0.0;
                    isSnapped = true;

                    // Clean column structures collection
                    const columnStructures = [];
                    
                    for (let other of collectibles) {
                      if (other.active && (other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door" || other.type === "thin_wood_floor") && !other.isPreview) {
                        const odx = other.position[0] - sP[0];
                        const ody = other.position[1] - sP[1];
                        const odz = other.position[2] - sP[2];
                        
                        const olX = odx * sR[0] + ody * sR[1] + odz * sR[2];
                        const olZ = odx * sF[0] + ody * sF[1] + odz * sF[2];
                        const olN = odx * sN[0] + ody * sN[1] + odz * sN[2];
                        
                        if (Math.abs(olX) <= 0.35 && Math.abs(olZ) <= 0.35) {
                          const ogX = Math.round(olX / 0.15);
                          const ogZ = Math.round(olZ / 0.15);
                          if (ogX === gridX && ogZ === gridZ) {
                            const oLevel = Math.round((olN - floorTopOffset) / 0.25);
                            columnStructures.push({
                              type: other.type,
                              level: oLevel,
                              item: other
                            });
                          }
                        }
                      }
                    }

                    if (typeToPlace === "wood_wall") {
                      // Stacking: find first level >= 0 that does NOT have a wood_wall, wood_window, or wood_door
                      let targetLevel = 0;
                      while (true) {
                        const hasWallAtLevel = columnStructures.some(s => (s.type === "wood_wall" || s.type === "wood_window" || s.type === "wood_door") && s.level === targetLevel);
                        if (!hasWallAtLevel) {
                          break;
                        }
                        targetLevel++;
                      }

                      if (targetLevel < 10) {
                        floorPreviewCollectible.isValidPlacement = true;
                        floorPreviewCollectible.size = 0.25;
                        
                        targetPos = [
                          sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * (floorTopOffset + targetLevel * 0.25),
                          sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * (floorTopOffset + targetLevel * 0.25),
                          sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * (floorTopOffset + targetLevel * 0.25)
                        ];
                        
                        pN = [sN[0], sN[1], sN[2]];
                        pR = [sR[0], sR[1], sR[2]];
                        pF = [sF[0], sF[1], sF[2]];

                        const lowerWall = columnStructures.find(s => (s.type === "wood_wall" || s.type === "wood_window" || s.type === "wood_door") && s.level === targetLevel - 1);
                        if (lowerWall && lowerWall.item && lowerWall.item.angle !== undefined) {
                          floorPreviewCollectible.angle = lowerWall.item.angle;
                        } else {
                          floorPreviewCollectible.angle = (gridX !== 0) ? Math.PI / 2 : 0.0;
                        }

                        // Prevent building a wall directly through existing furniture (bed/chest) on the floor
                        if (targetLevel === 0) {
                          const wCenterX = gridX * 0.15;
                          const wCenterZ = gridZ * 0.15;
                          const wHalfX = (gridX !== 0) ? 0.022 : 0.15;
                          const wHalfZ = (gridX !== 0) ? 0.15 : 0.022;
                          for (let other of collectibles) {
                            if (other && other.active && !other.isPreview && (other.type === "wood_bed" || other.type === "wood_chest" || other.type === "wood_table" || other.type === "wood_chair")) {
                              const odx = other.position[0] - sP[0];
                              const ody = other.position[1] - sP[1];
                              const odz = other.position[2] - sP[2];
                              const olX = odx * sR[0] + ody * sR[1] + odz * sR[2];
                              const olZ = odx * sF[0] + ody * sF[1] + odz * sF[2];
                              const olN = odx * sN[0] + ody * sN[1] + odz * sN[2];
                              if (Math.abs(olN - floorTopOffset) < 0.14) {
                                const oR = other.R || sR;
                                const oF = other.F || sF;
                                const oHalfW = (other.type === "wood_bed") ? 0.073 : (other.type === "wood_table" ? 0.058 : (other.type === "wood_chair" ? 0.030 : 0.056));
                                const oHalfD = (other.type === "wood_bed") ? 0.119 : (other.type === "wood_table" ? 0.044 : (other.type === "wood_chair" ? 0.030 : 0.046));
                                const rDotX = Math.abs(oR[0] * sR[0] + oR[1] * sR[1] + oR[2] * sR[2]);
                                const fDotX = Math.abs(oF[0] * sR[0] + oF[1] * sR[1] + oF[2] * sR[2]);
                                const rDotZ = Math.abs(oR[0] * sF[0] + oR[1] * sF[1] + oR[2] * sF[2]);
                                const fDotZ = Math.abs(oF[0] * sF[0] + oF[1] * sF[1] + oF[2] * sF[2]);
                                const oExtX = oHalfW * rDotX + oHalfD * fDotX;
                                const oExtZ = oHalfW * rDotZ + oHalfD * fDotZ;
                                if (Math.abs(wCenterX - olX) < (wHalfX + oExtX - 0.004) && Math.abs(wCenterZ - olZ) < (wHalfZ + oExtZ - 0.004)) {
                                  floorPreviewCollectible.isValidPlacement = false;
                                  break;
                                }
                              }
                            }
                          }
                        }

                        isSnapped = true;
                      } else {
                        floorPreviewCollectible.isValidPlacement = false;
                        floorPreviewCollectible.size = 0.25;
                      }
                    } else if (typeToPlace === "thin_wood_floor") {
                      // Floor grid coordinates (multiples of 2 for 0.15 grid = 0.3 steps)
                      let fgX = Math.round(localX / 0.3) * 2;
                      let fgZ = Math.round(localZ / 0.3) * 2;
                      
                      // Find if there's a wall under this fgX, fgZ
                      let maxWallLevel = -1;
                      
                      for (let other of collectibles) {
                          if (other.active && (other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door") && !other.isPreview) {
                              const odx = other.position[0] - sP[0];
                              const ody = other.position[1] - sP[1];
                              const odz = other.position[2] - sP[2];
                              
                              const olX = odx * sR[0] + ody * sR[1] + odz * sR[2];
                              const olZ = odx * sF[0] + ody * sF[1] + odz * sF[2];
                              const olN = odx * sN[0] + ody * sN[1] + odz * sN[2];
                              
                              const ogX = Math.round(olX / 0.15);
                              const ogZ = Math.round(olZ / 0.15);
                              
                              // Check if this wall is on the edge of our fgX, fgZ floor tile
                              if ((ogX === fgX - 1 && ogZ === fgZ) ||
                                  (ogX === fgX + 1 && ogZ === fgZ) ||
                                  (ogX === fgX && ogZ === fgZ - 1) ||
                                  (ogX === fgX && ogZ === fgZ + 1) ||
                                  (ogX === fgX && ogZ === fgZ)) {
                                  
                                  const oLevel = Math.round((olN - floorTopOffset) / 0.25);
                                  if (oLevel > maxWallLevel) maxWallLevel = oLevel;
                              }
                          }
                      }
                      
                      if (maxWallLevel >= 0) {
                        floorPreviewCollectible.isValidPlacement = true;
                        floorPreviewCollectible.size = 0.25;
                        
                        // Centered on full floor grid, elevated to top of wall
                        const targetLevel = maxWallLevel + 1;
                        targetPos = [
                          sP[0] + sR[0] * (fgX * 0.15) + sF[0] * (fgZ * 0.15) + sN[0] * (floorTopOffset + targetLevel * 0.25),
                          sP[1] + sR[1] * (fgX * 0.15) + sF[1] * (fgZ * 0.15) + sN[1] * (floorTopOffset + targetLevel * 0.25),
                          sP[2] + sR[2] * (fgX * 0.15) + sF[2] * (fgZ * 0.15) + sN[2] * (floorTopOffset + targetLevel * 0.25)
                        ];
                        pN = [sN[0], sN[1], sN[2]];
                        pR = [sR[0], sR[1], sR[2]];
                        pF = [sF[0], sF[1], sF[2]];
                        isSnapped = true;
                      } else {
                        // Allow extending horizontally from an adjacent thin_wood_floor or wood_roof
                        let adjacentThinFloor = null;
                        for (let other of collectibles) {
                          if (other.active && (other.type === "thin_wood_floor" || other.type === "wood_roof") && !other.isPreview) {
                             const odx = other.position[0] - sP[0];
                             const ody = other.position[1] - sP[1];
                             const odz = other.position[2] - sP[2];
                             const olX = odx * sR[0] + ody * sR[1] + odz * sR[2];
                             const olZ = odx * sF[0] + ody * sF[1] + odz * sF[2];
                             const ogX = Math.round(olX / 0.15);
                             const ogZ = Math.round(olZ / 0.15);
                             
                             if ((ogX === fgX - 2 && ogZ === fgZ) ||
                                 (ogX === fgX + 2 && ogZ === fgZ) ||
                                 (ogX === fgX && ogZ === fgZ - 2) ||
                                 (ogX === fgX && ogZ === fgZ + 2) ||
                                 (ogX === fgX && ogZ === fgZ)) {
                                 adjacentThinFloor = other;
                                 break;
                             }
                          }
                        }
                        
                        if (adjacentThinFloor) {
                            floorPreviewCollectible.isValidPlacement = true;
                            floorPreviewCollectible.size = 0.25;
                            
                            const odx = adjacentThinFloor.position[0] - sP[0];
                            const ody = adjacentThinFloor.position[1] - sP[1];
                            const odz = adjacentThinFloor.position[2] - sP[2];
                            const olN = odx * sN[0] + ody * sN[1] + odz * sN[2];

                            targetPos = [
                              sP[0] + sR[0] * (fgX * 0.15) + sF[0] * (fgZ * 0.15) + sN[0] * olN,
                              sP[1] + sR[1] * (fgX * 0.15) + sF[1] * (fgZ * 0.15) + sN[1] * olN,
                              sP[2] + sR[2] * (fgX * 0.15) + sF[2] * (fgZ * 0.15) + sN[2] * olN
                            ];
                            pN = [sN[0], sN[1], sN[2]];
                            pR = [sR[0], sR[1], sR[2]];
                            pF = [sF[0], sF[1], sF[2]];
                            isSnapped = true;
                            
                            // Check if another floor is already here
                            for (let other of collectibles) {
                              if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor") && !other.isPreview) {
                                  const ox = other.position[0] - targetPos[0];
                                  const oy = other.position[1] - targetPos[1];
                                  const oz = other.position[2] - targetPos[2];
                                  if (ox*ox + oy*oy + oz*oz < 0.005) {
                                      floorPreviewCollectible.isValidPlacement = false;
                                  }
                              }
                            }
                        } else {
                            floorPreviewCollectible.isValidPlacement = false;
                        }
                      }
                    } else {
                      // For wood_window or wood_door: must co-locate with a wood_wall at the targeted aim level
                      const localN = dx * sN[0] + dy * sN[1] + dz * sN[2];
                      const aimLevel = Math.max(0, Math.round((localN - floorTopOffset) / 0.25));
                      
                      const targetWall = columnStructures.find(s => s.type === "wood_wall" && s.level === aimLevel);
                      const hasFixtureAtAimLevel = columnStructures.some(s => (s.type === "wood_window" || s.type === "wood_door") && s.level === aimLevel);
                      
                      if (targetWall && !hasFixtureAtAimLevel) {
                        floorPreviewCollectible.isValidPlacement = true;
                        floorPreviewCollectible.size = 0.25;
                        
                        targetPos = [
                          targetWall.item.position[0],
                          targetWall.item.position[1],
                          targetWall.item.position[2]
                        ];
                        
                        pN = [targetWall.item.normal[0], targetWall.item.normal[1], targetWall.item.normal[2]];
                        pR = [targetWall.item.R[0], targetWall.item.R[1], targetWall.item.R[2]];
                        pF = [targetWall.item.F[0], targetWall.item.F[1], targetWall.item.F[2]];
                        const baseAngle = (targetWall.item.angle !== undefined) ? targetWall.item.angle : 0.0;
                        const rotQ = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
                        const flipAngle = Math.round(rotQ / Math.PI) * Math.PI;
                        floorPreviewCollectible.angle = baseAngle + flipAngle;
                        isSnapped = true;
                      } else {
                        floorPreviewCollectible.isValidPlacement = false;
                        floorPreviewCollectible.size = 0.25;
                        
                        if (targetWall) {
                          targetPos = [
                            targetWall.item.position[0],
                            targetWall.item.position[1],
                            targetWall.item.position[2]
                          ];
                          pN = [targetWall.item.normal[0], targetWall.item.normal[1], targetWall.item.normal[2]];
                          pR = [targetWall.item.R[0], targetWall.item.R[1], targetWall.item.R[2]];
                          pF = [targetWall.item.F[0], targetWall.item.F[1], targetWall.item.F[2]];
                          const baseAngle = (targetWall.item.angle !== undefined) ? targetWall.item.angle : 0.0;
                          const rotQ = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
                          const flipAngle = Math.round(rotQ / Math.PI) * Math.PI;
                          floorPreviewCollectible.angle = baseAngle + flipAngle;
                        } else {
                          targetPos = [
                            sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * (floorTopOffset + aimLevel * 0.25),
                            sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * (floorTopOffset + aimLevel * 0.25),
                            sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * (floorTopOffset + aimLevel * 0.25)
                          ];
                          pN = [sN[0], sN[1], sN[2]];
                          pR = [sR[0], sR[1], sR[2]];
                          pF = [sF[0], sF[1], sF[2]];
                          floorPreviewCollectible.angle = (gridX !== 0) ? Math.PI / 2 : 0.0;
                        }
                        isSnapped = true;
                      }
                    }
            }
          } else {
                    if (!isSnapped && (typeToPlace === "wood_chest" || typeToPlace === "wood_table" || typeToPlace === "wood_planter_box" || typeToPlace === "wood_chair" || typeToPlace === "meganeura_item" || typeToPlace === "isopod_item" || typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item" || typeToPlace.startsWith("robot_"))) {
                        floorPreviewCollectible.isValidPlacement = !isUnderWater && (slopeVal < 0.6);
                        floorPreviewCollectible.size = 0.25;
                        const rotAngleG = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
                        const cosHG = Math.cos(snappedHeading + rotAngleG);
                        const sinHG = Math.sin(snappedHeading + rotAngleG);
                        pN = [pnx, pny, pnz];
                        pR = [previewEast[0] * cosHG - previewNorth[0] * sinHG, previewEast[1] * cosHG - previewNorth[1] * sinHG, previewEast[2] * cosHG - previewNorth[2] * sinHG];
                        pF = [previewNorth[0] * cosHG + previewEast[0] * sinHG, previewNorth[1] * cosHG + previewEast[1] * sinHG, previewNorth[2] * cosHG + previewEast[2] * sinHG];
                    } else if (!isSnapped && (typeToPlace === "wood_bed" || typeToPlace === "lantern")) {
                        floorPreviewCollectible.isValidPlacement = false;
                        floorPreviewCollectible.size = 0.25;
                        pN = [pnx, pny, pnz];
                        pR = [previewEast[0] * cosH - previewNorth[0] * sinH, previewEast[1] * cosH - previewNorth[1] * sinH, previewEast[2] * cosH - previewNorth[2] * sinH];
                        pF = [previewNorth[0] * cosH + previewEast[0] * sinH, previewNorth[1] * cosH + previewEast[1] * sinH, previewNorth[2] * cosH + previewEast[2] * sinH];
                    } else if (!isSnapped) {
                        floorPreviewCollectible.isValidPlacement = false;
                        floorPreviewCollectible.size = 0.25;
                    }
            }
          } else {
                // No wood floor found nearby or too far
                if (!isSnapped && (typeToPlace === "wood_chest" || typeToPlace === "wood_table" || typeToPlace === "wood_planter_box" || typeToPlace === "wood_chair" || typeToPlace === "meganeura_item" || typeToPlace === "isopod_item" || typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item" || typeToPlace.startsWith("robot_"))) {
                    floorPreviewCollectible.isValidPlacement = !isUnderWater && (slopeVal < 0.6);
                    floorPreviewCollectible.size = 0.25;
                    const rotAngleG = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
                    const cosHG = Math.cos(snappedHeading + rotAngleG);
                    const sinHG = Math.sin(snappedHeading + rotAngleG);
                    pN = [pnx, pny, pnz];
                    pR = [previewEast[0] * cosHG - previewNorth[0] * sinHG, previewEast[1] * cosHG - previewNorth[1] * sinHG, previewEast[2] * cosHG - previewNorth[2] * sinHG];
                    pF = [previewNorth[0] * cosHG + previewEast[0] * sinHG, previewNorth[1] * cosHG + previewEast[1] * sinHG, previewNorth[2] * cosHG + previewEast[2] * sinHG];
                } else if (!isSnapped && (typeToPlace === "wood_bed" || typeToPlace === "lantern")) {
                    floorPreviewCollectible.isValidPlacement = false;
                    floorPreviewCollectible.size = 0.25;
                    pN = [pnx, pny, pnz];
                    pR = [previewEast[0] * cosH - previewNorth[0] * sinH, previewEast[1] * cosH - previewNorth[1] * sinH, previewEast[2] * cosH - previewNorth[2] * sinH];
                    pF = [previewNorth[0] * cosH + previewEast[0] * sinH, previewNorth[1] * cosH + previewEast[1] * sinH, previewNorth[2] * cosH + previewEast[2] * sinH];
                } else if (!isSnapped) {
                    floorPreviewCollectible.isValidPlacement = false;
                    floorPreviewCollectible.size = 0.25;
                }
            }
          }

          floorPreviewCollectible.isFloorSnapped = isSnapped;
          // Smooth interpolation (instant if snapped or placing ladder/planter box to prevent lag/misalignment)
          const interpSpeed = (isSnapped || typeToPlace === "folding_ladder" || typeToPlace === "wood_planter_box") ? 1.0 : 0.3;
          floorPreviewCollectible.position[0] = floorPreviewCollectible.position[0] * (1 - interpSpeed) + targetPos[0] * interpSpeed;
          floorPreviewCollectible.position[1] = floorPreviewCollectible.position[1] * (1 - interpSpeed) + targetPos[1] * interpSpeed;
          floorPreviewCollectible.position[2] = floorPreviewCollectible.position[2] * (1 - interpSpeed) + targetPos[2] * interpSpeed;

          if (typeToPlace !== "folding_ladder") {
            floorPreviewCollectible.normal[0] = pN[0];
            floorPreviewCollectible.normal[1] = pN[1];
            floorPreviewCollectible.normal[2] = pN[2];

            floorPreviewCollectible.R[0] = pR[0];
            floorPreviewCollectible.R[1] = pR[1];
            floorPreviewCollectible.R[2] = pR[2];

            floorPreviewCollectible.F[0] = pF[0];
            floorPreviewCollectible.F[1] = pF[1];
            floorPreviewCollectible.F[2] = pF[2];
          }

          if (typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item") {
            const maxPads = (typeof window !== "undefined" && typeof window.MAX_OBSIDIAN_PADS === "number") ? window.MAX_OBSIDIAN_PADS : 5;
            if (typeof window !== "undefined" && typeof window.getPlacedObsidianPadsInOrder === "function") {
              if (window.getPlacedObsidianPadsInOrder().length >= maxPads) {
                floorPreviewCollectible.isValidPlacement = false;
              }
            }
          }

          if (floorPreviewCollectible.isValidPlacement === false) {
              floorPreviewCollectible.color = [0.8, 0.2, 0.2]; // red if invalid
          } else {
              floorPreviewCollectible.color = [0.95, 0.85, 0.45]; // yellow if valid
          }
          window.floorPreviewCollectible = floorPreviewCollectible;

          refreshCollectiblesVBO('preview');
        } else {
          // If NOT placing or inventory is open, hide/remove preview
          if (floorPreviewCollectible) {
            const idx = collectibles.indexOf(floorPreviewCollectible);
            if (idx !== -1) collectibles.splice(idx, 1);
            floorPreviewCollectible = null;
            window.floorPreviewCollectible = null;
            refreshCollectiblesVBO('preview');
          }
        }

        // Player reference position for render distance checks
        let pPos = (typeof window !== "undefined" && window.player3DPos && window.player3DPos.length >= 3)
          ? window.player3DPos
          : (typeof eyePos !== "undefined" && eyePos && eyePos.length >= 3 ? eyePos : null);

        if (!pPos && typeof charTheta !== "undefined" && typeof charPhi !== "undefined") {
          const sT = Math.sin(charTheta), cT = Math.cos(charTheta);
          const sP = Math.sin(charPhi), cP = Math.cos(charPhi);
          const rBase = (typeof RADIUS !== "undefined" ? RADIUS : 8.0);
          pPos = [rBase * sT * cP, rBase * cT, rBase * sT * sP];
        }

        const isRenderDistOn = (typeof renderDistEnabled !== "undefined"
          ? renderDistEnabled
          : (typeof window !== "undefined" && typeof window.renderDistEnabled !== "undefined" ? window.renderDistEnabled : true));

        const curObjectDist = typeof objectRenderDistValue !== "undefined"
          ? objectRenderDistValue
          : (typeof window !== "undefined" && typeof window.objectRenderDistValue !== "undefined"
            ? window.objectRenderDistValue
            : 5.0);

        const maxDistLimit = curObjectDist + 1.0;
        const maxDistSq = maxDistLimit * maxDistLimit;
        let cachedCoreRadius = null;

        for (let c of collectibles) {
          if (!c.active || !c.isDynamic) continue;
          // Settled ground drops sleep at 0 CPU / 0 GPU upload cost!
          if (c._dropSettled) continue;

          // Check if dynamic collectible is outside the object render distance
          let isOutOfRenderDist = false;
          if (isRenderDistOn && pPos && c.position) {
            const dx = c.position[0] - pPos[0];
            const dy = c.position[1] - pPos[1];
            const dz = c.position[2] - pPos[2];
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq > maxDistSq) {
              isOutOfRenderDist = true;
            }
          }

          if ((typeof activeRidingBoat !== "undefined" && c === activeRidingBoat) || 
              (typeof window !== "undefined" && typeof window.isBoatRiddenByAnyClone === "function" && window.isBoatRiddenByAnyClone(c)) ||
              (typeof activeRidingMech !== "undefined" && activeRidingMech && (c === activeRidingMech || (activeRidingMech.attachedParts && activeRidingMech.attachedParts.some(ep => ep.item === c))))) {
            isOutOfRenderDist = false;
            c.vel = [0, 0, 0];
            continue;
          }

          // If outside render distance, put simulation to sleep and do not trigger dynamic VBO refresh
          if (isOutOfRenderDist) {
            c._wasOutOfRange = true;
            continue;
          } else {
            // If entering range, refresh once to ensure up-to-date position in dynamic buffer
            if (c._wasOutOfRange) {
              c._wasOutOfRange = false;
              needRefresh = true;
            }
          }

          // Early skip for sleeping parked boats on land until structures change
          if (c.type === "wood_boat" && !c.isGroundDrop && c._isSleeping && !c.isInWater && !c.isFlying && !c.isAirborne && !c.isGliding) {
            const wakeTick = window._boatSleepCheckTick || 0;
            if (c._sleepWakeTick === wakeTick) {
              continue;
            }
            c._isSleeping = false;
          }

          // Throttle parked boats gently bobbing on water (~15 Hz instead of every frame)
          const frameDtSec = (typeof dt === "number" && dt > 0 && dt < 0.25) ? dt : (1 / 60);
          if (c.type === "wood_boat" && !c.isGroundDrop && c.isInWater && c._waterSettled && !c.isFlying && !c.isAirborne && !c.isGliding) {
            c._waterBobTimer = (c._waterBobTimer || 0) + frameDtSec;
            if (c._waterBobTimer < 0.066) {
              continue;
            }
            c._waterBobTimer = 0;
          }

          const _oldP = c.position ? [c.position[0], c.position[1], c.position[2]] : null;
          const _oldR = c.R ? [c.R[0], c.R[1], c.R[2]] : null;

          if (c.type === "arrow" && !c.isGroundDrop) {
             if (c.attachedToNPC) {
                 const npc = c.attachedToNPC;
                 const isNpcValid = typeof amphibians !== "undefined" && amphibians && amphibians.includes(npc);
                 if (!isNpcValid) {
                     c.attachedToNPC = null;
                     c.active = false;
                 } else {
                     const tf = (typeof window.getNPCTransform === "function") ? window.getNPCTransform(npc) : {
                         pos: (npc.ragdollEnabled && npc.ragdollPos) ? npc.ragdollPos : (npc.position || [0,0,0]),
                         R: npc.R || [1, 0, 0],
                         N: npc.N || [0, 1, 0],
                         F: npc.F || [0, 0, 1]
                     };
                     const nPos = tf.pos;
                     const nR = tf.R;
                     const nN = tf.N;
                     const nF = tf.F;
                     
                     if (c.relLocal) {
                         c.position[0] = nPos[0] + nR[0] * c.relLocal[0] + nN[0] * c.relLocal[1] + nF[0] * c.relLocal[2];
                         c.position[1] = nPos[1] + nR[1] * c.relLocal[0] + nN[1] * c.relLocal[1] + nF[1] * c.relLocal[2];
                         c.position[2] = nPos[2] + nR[2] * c.relLocal[0] + nN[2] * c.relLocal[1] + nF[2] * c.relLocal[2];
                         
                         if (c.relLocalF) {
                             c.F = [
                                 nR[0] * c.relLocalF[0] + nN[0] * c.relLocalF[1] + nF[0] * c.relLocalF[2],
                                 nR[1] * c.relLocalF[0] + nN[1] * c.relLocalF[1] + nF[1] * c.relLocalF[2],
                                 nR[2] * c.relLocalF[0] + nN[2] * c.relLocalF[1] + nF[2] * c.relLocalF[2]
                             ];
                         }
                         if (c.relLocalR) {
                             c.R = [
                                 nR[0] * c.relLocalR[0] + nN[0] * c.relLocalR[1] + nF[0] * c.relLocalR[2],
                                 nR[1] * c.relLocalR[0] + nN[1] * c.relLocalR[1] + nF[1] * c.relLocalR[2],
                                 nR[2] * c.relLocalR[0] + nN[2] * c.relLocalR[1] + nF[2] * c.relLocalR[2]
                             ];
                         }
                         if (c.relLocalNormal) {
                             c.normal = [
                                 nR[0] * c.relLocalNormal[0] + nN[0] * c.relLocalNormal[1] + nF[0] * c.relLocalNormal[2],
                                 nR[1] * c.relLocalNormal[0] + nN[1] * c.relLocalNormal[1] + nF[1] * c.relLocalNormal[2],
                                 nR[2] * c.relLocalNormal[0] + nN[2] * c.relLocalNormal[1] + nF[2] * c.relLocalNormal[2]
                             ];
                         }
                     }
                 }
                 window.pendingDynamicCollectibleRefresh = true;
                 continue;
             }

             if (c.isStuck) {
                 continue;
             }

             const p = c.position;
             const r_dist = Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2);
             const nx = p[0] / (r_dist || 1);
             const ny = p[1] / (r_dist || 1);
             const nz = p[2] / (r_dist || 1);
             let speed = Math.sqrt(c.vel[0]**2 + c.vel[1]**2 + c.vel[2]**2);
             
             // HYBRID ANIMATION + PHYSICS SYSTEM:
             // 1) Animation launch phase: Straight barrel clearance without gravity or player snag
             if (c.animPhaseActive) {
                 c.animElapsed = (c.animElapsed || 0) + (1.0 / 60.0);
                 p[0] += c.animDir[0] * c.animSpeed;
                 p[1] += c.animDir[1] * c.animSpeed;
                 p[2] += c.animDir[2] * c.animSpeed;
                 
                 c.F = [c.animDir[0], c.animDir[1], c.animDir[2]];
                 c.vel = [c.animDir[0] * c.animSpeed, c.animDir[1] * c.animSpeed, c.animDir[2] * c.animSpeed];
                 speed = c.animSpeed;
                 
                 const localUp = [nx, ny, nz];
                 let right = [
                     c.F[1]*localUp[2] - c.F[2]*localUp[1],
                     c.F[2]*localUp[0] - c.F[0]*localUp[2],
                     c.F[0]*localUp[1] - c.F[1]*localUp[0]
                 ];
                 const lenR = Math.sqrt(right[0]**2 + right[1]**2 + right[2]**2);
                 c.R = (lenR > 0.001) ? [right[0]/lenR, right[1]/lenR, right[2]/lenR] : [1, 0, 0];
                 c.normal = [
                     c.R[1]*c.F[2] - c.R[2]*c.F[1],
                     c.R[2]*c.F[0] - c.R[0]*c.F[2],
                     c.R[0]*c.F[1] - c.R[1]*c.F[0]
                 ];
                 
                 // If animation exit duration reached, seamlessly switch to full physics
                 if (c.animElapsed >= (c.animMaxTime || 0.25)) {
                     c.animPhaseActive = false;
                 }
             } else {
                 // 2) Physics phase: Gravity towards planet center + velocity integration
                 const gravityPower = 0.0008 * (typeof playerScale !== 'undefined' ? playerScale : 0.1); 
                 Physics.applyGravity(c.vel, nx, ny, nz, 1.0, gravityPower);
                 
                 p[0] += c.vel[0];
                 p[1] += c.vel[1];
                 p[2] += c.vel[2];
                 
                 speed = Math.sqrt(c.vel[0]**2 + c.vel[1]**2 + c.vel[2]**2);
                 if (speed > 0.0001) {
                     c.F = [c.vel[0] / speed, c.vel[1] / speed, c.vel[2] / speed];
                     const localUp = [nx, ny, nz];
                     let right = [
                         c.F[1]*localUp[2] - c.F[2]*localUp[1],
                         c.F[2]*localUp[0] - c.F[0]*localUp[2],
                         c.F[0]*localUp[1] - c.F[1]*localUp[0]
                     ];
                     const lenR = Math.sqrt(right[0]**2 + right[1]**2 + right[2]**2);
                     if (lenR > 0.001) {
                         c.R = [right[0]/lenR, right[1]/lenR, right[2]/lenR];
                     } else {
                         c.R = [1, 0, 0];
                     }
                     c.normal = [
                         c.R[1]*c.F[2] - c.R[2]*c.F[1],
                         c.R[2]*c.F[0] - c.R[0]*c.F[2],
                         c.R[0]*c.F[1] - c.R[1]*c.F[0]
                     ];
                 }
             }
             
             // 4) Check collision with amphibians (NPCs) - Universal Mesh-Direct Sticking System
             let hitNPC = false;
             if (typeof amphibians !== "undefined" && amphibians) {
                 const sScale = typeof playerScale !== "undefined" ? playerScale : 0.1;
                 const arrowL = 1.12 * sScale; // 0.112m
                 const halfL = arrowL * 0.5;   // 0.056m
                 const arrowTipOffset = halfL + 0.04 * sScale; // Tip is ~0.060m forward from arrow center

                 let arrowF = c.F ? [c.F[0], c.F[1], c.F[2]] : (c.vel ? [c.vel[0], c.vel[1], c.vel[2]] : [0, 0, 1]);
                 const fLen = Math.hypot(arrowF[0], arrowF[1], arrowF[2]);
                 if (fLen > 0.001) {
                     arrowF[0] /= fLen; arrowF[1] /= fLen; arrowF[2] /= fLen;
                 } else {
                     arrowF = [0, 0, 1];
                 }

                 const currTip = [p[0] + arrowF[0] * arrowTipOffset, p[1] + arrowF[1] * arrowTipOffset, p[2] + arrowF[2] * arrowTipOffset];
                 const prevP = _oldP || [p[0] - arrowF[0] * speed, p[1] - arrowF[1] * speed, p[2] - arrowF[2] * speed];
                 const prevTip = [prevP[0] + arrowF[0] * arrowTipOffset, prevP[1] + arrowF[1] * arrowTipOffset, prevP[2] + arrowF[2] * arrowTipOffset];

                 for (let npc of amphibians) {
                     // Get NPC position and orthonormal orientation basis
                     const tf = (typeof window.getNPCTransform === "function") ? window.getNPCTransform(npc) : {
                         pos: (npc.ragdollEnabled && npc.ragdollPos) ? npc.ragdollPos : (npc.position || [0, 0, 0]),
                         R: npc.R || [1, 0, 0],
                         N: npc.N || [0, 1, 0],
                         F: npc.F || [0, 0, 1]
                     };
                     const nPos = tf.pos;
                     const nR = tf.R;
                     const nN = tf.N;
                     const nF = tf.F;

                     const npcCenter = (typeof window.getNPCTargetPoint === "function" ? window.getNPCTargetPoint(npc) : null) || nPos;
                     const hitRadius = npc.type === "meganeura" ? 0.25 : (npc.type === "isopod" ? 0.20 : (npc.type === "placoderm" ? 0.45 : (npc.type === "georgiacetus" ? 0.55 : (npc.type === "human" ? 0.35 : 0.35))));

                     // Find closest point on arrow trajectory segment to the NPC model center
                     const segX = currTip[0] - prevTip[0];
                     const segY = currTip[1] - prevTip[1];
                     const segZ = currTip[2] - prevTip[2];
                     const segLenSq = segX * segX + segY * segY + segZ * segZ;

                     const toNpcX = npcCenter[0] - prevTip[0];
                     const toNpcY = npcCenter[1] - prevTip[1];
                     const toNpcZ = npcCenter[2] - prevTip[2];

                     let tSeg = segLenSq > 0.00001 ? (toNpcX * segX + toNpcY * segY + toNpcZ * segZ) / segLenSq : 0;
                     tSeg = Math.max(0, Math.min(1, tSeg));

                     const closestX = prevTip[0] + segX * tSeg;
                     const closestY = prevTip[1] + segY * tSeg;
                     const closestZ = prevTip[2] + segZ * tSeg;

                     const distSq = (closestX - npcCenter[0]) ** 2 + (closestY - npcCenter[1]) ** 2 + (closestZ - npcCenter[2]) ** 2;

                     if (distSq <= hitRadius * hitRadius) {
                         c.animPhaseActive = false;
                         const isIronBullet = (c.ammoType === "IRON_BULLET");
                         const isOwnerPlayer = !c.ownerActor || c.ownerActor.isPlayer !== false;
                         // Arrow Immunity Check: Arrows cannot damage obsidian_cube, but Spherical Iron Bullet CAN damage obsidian_cube!
                         const isImmuneToArrows = (!isIronBullet) && ((npc.type === "obsidian_cube") || (npc.immuneToArrows) || (window.NpcRegistry && window.NpcRegistry[npc.type] && window.NpcRegistry[npc.type].immuneToArrows));
                         if (isImmuneToArrows) {
                             if (isOwnerPlayer && typeof showNotice === "function") {
                                 showNotice("🛡️ ลูกธนูเด้งสะท้อน! ศิลาออบซิเดียนทนทานต่อธนู 100% (Immune to arrows!)");
                             }
                             c.vel[0] = -c.vel[0] * 0.45 + (Math.random() - 0.5) * 0.04;
                             c.vel[1] = -c.vel[1] * 0.45 + (Math.random() - 0.5) * 0.04;
                             c.vel[2] = -c.vel[2] * 0.45 + (Math.random() - 0.5) * 0.04;
                             hitNPC = true;
                             break;
                         }

                         // Spherical Iron Bullet deals 3 HP damage, Arrow deals 1 HP!
                         const damage = isIronBullet ? 3 : 1;
                         if (npc.hp === undefined) {
                             const regHp = (window.NpcRegistry && window.NpcRegistry[npc.type]) ? window.NpcRegistry[npc.type].maxHp : 1;
                             npc.hp = regHp;
                             npc.maxHp = regHp;
                         }

                         if (npc.hp > 0) {
                             npc.hp = Math.max(0, npc.hp - damage);
                             let hpHearts = "";
                             for (let i = 0; i < npc.maxHp; i++) {
                                 hpHearts += i < npc.hp ? "🔴" : "⚪";
                             }
                             const weaponName = false ? "⚫ ลูกบอลออบซิเดียน" : (isIronBullet ? "⚪ กระสุนเหล็กทรงกลม" : ((c.isCannonShot || c.sourceWeapon === "WOODEN_ARM_CANNON") ? "🪵🦾 ปืนไม้ติดแขน" : "🏹 ลูกธนู"));
                             if (isOwnerPlayer && typeof showNotice === "function") {
                                 showNotice("🎯 " + weaponName + " ยิงเข้าเป้า! ลดดาเมจ -" + damage + " " + hpHearts + " [HP: " + npc.hp + "/" + npc.maxHp + "]");
                             }
                             
                             if (npc.hp <= 0) {
                                 npc.ragdollEnabled = true;
                                 if (!isOwnerPlayer && !npc._cloneLooted && typeof window.grantNpcKillLootToActor === "function") {
                                     window.grantNpcKillLootToActor(c.ownerActor, npc);
                                 }
                                 if (isOwnerPlayer && typeof showNotice === "function") {
                                     showNotice("💀 กำจัดเป้าหมายสำเร็จ! (Target eliminated!)");
                                 }
                             }
                         } else {
                             const weaponName = false ? "ลูกบอลออบซิเดียน" : (isIronBullet ? "กระสุนเหล็ก" : "ลูกธนู");
                             if (isOwnerPlayer && typeof showNotice === "function") {
                                 showNotice("🎯 " + weaponName + "ปักโดนร่างเป้าหมาย!");
                             }
                         }
                         
                         if (npc.ragdollEnabled && npc.ragdollVel) {
                             npc.ragdollVel[0] = (c.vel[0] || 0) * 0.25;
                             npc.ragdollVel[1] = (c.vel[1] || 0) * 0.25;
                             npc.ragdollVel[2] = (c.vel[2] || 0) * 0.25;
                         }
                         
                         if (typeof playSplashSound === "function") {
                             playSplashSound(1.0);
                         }
                         
                         // Transform impact point into NPC local coordinate space
                         const toImpact = [closestX - nPos[0], closestY - nPos[1], closestZ - nPos[2]];
                         let lx = toImpact[0] * nR[0] + toImpact[1] * nR[1] + toImpact[2] * nR[2];
                         let ly = toImpact[0] * nN[0] + toImpact[1] * nN[1] + toImpact[2] * nN[2];
                         let lz = toImpact[0] * nF[0] + toImpact[1] * nF[1] + toImpact[2] * nF[2];

                         let ldx = arrowF[0] * nR[0] + arrowF[1] * nR[1] + arrowF[2] * nR[2];
                         let ldy = arrowF[0] * nN[0] + arrowF[1] * nN[1] + arrowF[2] * nN[2];
                         let ldz = arrowF[0] * nF[0] + arrowF[1] * nF[1] + arrowF[2] * nF[2];
                         const ldLen = Math.hypot(ldx, ldy, ldz) || 1;
                         ldx /= ldLen; ldy /= ldLen; ldz /= ldLen;

                         // Snap impact point directly onto the true 3D surface of the model mesh
                         if (npc.type === "human") {
                             ly = Math.max(-0.16, Math.min(0.16, ly));
                             const rBody = ly > 0.08 ? 0.055 : (ly >= -0.03 ? 0.075 : 0.055);
                             const dHoriz = Math.hypot(lx, lz);
                             if (dHoriz > rBody && dHoriz > 0.001) {
                                 lx = (lx / dHoriz) * rBody;
                                 lz = (lz / dHoriz) * rBody;
                             }
                         } else if (npc.type === "isopod") {
                             lz = Math.max(-0.10, Math.min(0.10, lz));
                             const dShell = Math.hypot(lx, ly);
                             if (dShell > 0.07 && dShell > 0.001) {
                                 lx = (lx / dShell) * 0.07;
                                 ly = (ly / dShell) * 0.07;
                             }
                         } else if (npc.type === "placoderm") {
                             lz = Math.max(-0.40, Math.min(0.18, lz));
                             const rFish = Math.max(0.04, 0.12 * (1.0 - Math.abs(lz + 0.1) / 0.35));
                             const dFish = Math.hypot(lx, ly);
                             if (dFish > rFish && dFish > 0.001) {
                                 lx = (lx / dFish) * rFish;
                                 ly = (ly / dFish) * rFish;
                             }
                         } else if (npc.type === "georgiacetus") {
                             lz = Math.max(-0.48, Math.min(0.25, lz));
                             const rGeo = Math.max(0.05, 0.14 * (1.0 - Math.abs(lz + 0.1) / 0.40));
                             const dGeo = Math.hypot(lx, ly);
                             if (dGeo > rGeo && dGeo > 0.001) {
                                 lx = (lx / dGeo) * rGeo;
                                 ly = (ly / dGeo) * rGeo;
                             }
                         } else if (npc.type === "meganeura") {
                             lz = Math.max(-0.12, Math.min(0.08, lz));
                             const dBug = Math.hypot(lx, ly);
                             if (dBug > 0.05 && dBug > 0.001) {
                                 lx = (lx / dBug) * 0.05;
                                 ly = (ly / dBug) * 0.05;
                             }
                         }

                         // User requirement: Embed arrow deep, half of the arrow length (50%) buried into mesh
                         const penetration = halfL; // 0.056m
                         const centerOffset = arrowTipOffset - penetration; // 0.004m

                         c.relLocal = [
                             lx - ldx * centerOffset,
                             ly - ldy * centerOffset,
                             lz - ldz * centerOffset
                         ];

                         c.relLocalF = [ldx, ldy, ldz];

                         const cR = (c.R && Math.hypot(c.R[0], c.R[1], c.R[2]) > 0.5) ? c.R : [1, 0, 0];
                         c.relLocalR = [
                             cR[0] * nR[0] + cR[1] * nR[1] + cR[2] * nR[2],
                             cR[0] * nN[0] + cR[1] * nN[1] + cR[2] * nN[2],
                             cR[0] * nF[0] + cR[1] * nF[1] + cR[2] * nF[2]
                         ];

                         const cN = (c.normal && Math.hypot(c.normal[0], c.normal[1], c.normal[2]) > 0.5) ? c.normal : [0, 1, 0];
                         c.relLocalNormal = [
                             cN[0] * nR[0] + cN[1] * nR[1] + cN[2] * nR[2],
                             cN[0] * nN[0] + cN[1] * nN[1] + cN[2] * nN[2],
                             cN[0] * nF[0] + cN[1] * nF[1] + cN[2] * nF[2]
                         ];

                         c.attachedToNPC = npc;
                         c.vel = [0, 0, 0];
                         c.animPhaseActive = false;
                         c.isDynamic = true;
                         c.active = true;
                         c.isStuck = false;

                         // Compute and update immediate world coordinates
                         c.position = [
                             nPos[0] + nR[0] * c.relLocal[0] + nN[0] * c.relLocal[1] + nF[0] * c.relLocal[2],
                             nPos[1] + nR[1] * c.relLocal[0] + nN[1] * c.relLocal[1] + nF[1] * c.relLocal[2],
                             nPos[2] + nR[2] * c.relLocal[0] + nN[2] * c.relLocal[1] + nF[2] * c.relLocal[2]
                         ];
                         c.F = [
                             nR[0] * c.relLocalF[0] + nN[0] * c.relLocalF[1] + nF[0] * c.relLocalF[2],
                             nR[1] * c.relLocalF[0] + nN[1] * c.relLocalF[1] + nF[1] * c.relLocalF[2],
                             nR[2] * c.relLocalF[0] + nN[2] * c.relLocalF[1] + nF[2] * c.relLocalF[2]
                         ];
                         c.R = [
                             nR[0] * c.relLocalR[0] + nN[0] * c.relLocalR[1] + nF[0] * c.relLocalR[2],
                             nR[1] * c.relLocalR[0] + nN[1] * c.relLocalR[1] + nF[1] * c.relLocalR[2],
                             nR[2] * c.relLocalR[0] + nN[2] * c.relLocalR[1] + nF[2] * c.relLocalR[2]
                         ];
                         c.normal = [
                             nR[0] * c.relLocalNormal[0] + nN[0] * c.relLocalNormal[1] + nF[0] * c.relLocalNormal[2],
                             nR[1] * c.relLocalNormal[0] + nN[1] * c.relLocalNormal[1] + nF[1] * c.relLocalNormal[2],
                             nR[2] * c.relLocalNormal[0] + nN[2] * c.relLocalNormal[1] + nF[2] * c.relLocalNormal[2]
                         ];

                         window.pendingDynamicCollectibleRefresh = true;
                         hitNPC = true;
                         break;
                     }
                 }
             }
             
             if (hitNPC) {
                 window.pendingDynamicCollectibleRefresh = true;
                 continue;
             }
             
             // 5) Check ground/terrain collision
             const theta_coords = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
             const phi_coords = Math.atan2(p[2], p[0]);
             const terrainH = getHeightOnSphere(theta_coords, phi_coords, globalSeed);
             const terrainRad = RADIUS + terrainH * HEIGHT_SCALE;
             
             const current_dist = Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2);
             if (cachedCoreRadius === null) {
                 const coreCollectible = collectibles.find(item => item && item.type === "planet_core");
                 cachedCoreRadius = coreCollectible ? coreCollectible.radius : 2.0;
             }
             const coreRadius = cachedCoreRadius;
             if (current_dist <= coreRadius) {
                 c.animPhaseActive = false;
                 p[0] = nx * (coreRadius + 0.001);
                 p[1] = ny * (coreRadius + 0.001);
                 p[2] = nz * (coreRadius + 0.001);
                 c.vel = [0, 0, 0];
                 c.isStuck = true;
                 c._groundDropAgeSec = 0;
                 
                 if (typeof playPlaceSound === "function") {
                     playPlaceSound();
                 }
                 window.pendingDynamicCollectibleRefresh = true;
                 continue;
             }
             
             if (current_dist <= terrainRad) {
                 // Stick into ground
                 c.animPhaseActive = false;
                 p[0] = nx * (terrainRad + 0.001);
                 p[1] = ny * (terrainRad + 0.001);
                 p[2] = nz * (terrainRad + 0.001);
                 
                 c.vel = [0, 0, 0];
                 c.isStuck = true;
                 c._groundDropAgeSec = 0;
                 
                 if (typeof playPlaceSound === "function") {
                     playPlaceSound();
                 }
                 window.pendingDynamicCollectibleRefresh = true;
                 continue;
             }
             
             if (c.isDynamic !== false) {
                 window.pendingDynamicCollectibleRefresh = true;
             }
             continue;
          }

          if (c.type === "plank") {
            const sinTheta = Math.sin(charTheta);
            const cosTheta = Math.cos(charTheta);
            const sinPhi = Math.sin(charPhi);
            const cosPhi = Math.cos(charPhi);

            const nx = sinTheta * cosPhi;
            const ny = cosTheta;
            const nz = sinTheta * sinPhi;
            
            let height = getHeightOnSphere(charTheta, charPhi, globalSeed);
            let terrainRadius = RADIUS + height * HEIGHT_SCALE;
            let groundRadius = terrainRadius;
            const waterRadius = RADIUS + waterLevel * 0.15;
            if (waterEnabled && terrainRadius < waterRadius) {
                groundRadius = waterRadius;
            }
            
            const East = [-sinPhi, 0, cosPhi];
            const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];

            const cosH = Math.cos(charHeading);
            const sinH = Math.sin(charHeading);

            const F = [
              North[0] * cosH + East[0] * sinH,
              North[1] * cosH + East[1] * sinH,
              North[2] * cosH + East[2] * sinH,
            ];

            const R = [
              East[0] * cosH - North[0] * sinH,
              East[1] * cosH - North[1] * sinH,
              East[2] * cosH - North[2] * sinH,
            ];

            const dropDist = 0.5; // distance in front
            const bob = Math.sin(Date.now() * 0.003) * 0.05 + 0.15; // float above ground
            const targetPos = [
                (groundRadius + bob) * nx + F[0] * dropDist,
                (groundRadius + bob) * ny + F[1] * dropDist,
                (groundRadius + bob) * nz + F[2] * dropDist
            ];

            c.position[0] = c.position[0] * 0.85 + targetPos[0] * 0.15;
            c.position[1] = c.position[1] * 0.85 + targetPos[1] * 0.15;
            c.position[2] = c.position[2] * 0.85 + targetPos[2] * 0.15;

            c.normal[0] = c.normal[0] * 0.85 + nx * 0.15;
            c.normal[1] = c.normal[1] * 0.85 + ny * 0.15;
            c.normal[2] = c.normal[2] * 0.85 + nz * 0.15;

            c.R[0] = c.R[0] * 0.85 + R[0] * 0.15;
            c.R[1] = c.R[1] * 0.85 + R[1] * 0.15;
            c.R[2] = c.R[2] * 0.85 + R[2] * 0.15;

            c.F[0] = c.F[0] * 0.85 + F[0] * 0.15;
            c.F[1] = c.F[1] * 0.85 + F[1] * 0.15;
            c.F[2] = c.F[2] * 0.85 + F[2] * 0.15;

            needRefresh = true;
            continue;
          }
          
          const isItemDrop = (typeof window !== "undefined" && window.GroundDropSystem)
            ? window.GroundDropSystem.isGroundDrop(c)
            : (c.type === "log" || c.type === "branch" || c.type === "rock" || c.type === "big_rock" || c.type === "dirt" || c.type === "iron_ore" || c.type === "gold_ore" || c.type === "glow_ore" || c.type === "dragon_fruit" || c.type === "cotton_plant" || c.type === "crown_flower" || c.type === "grass" || c.type === "cloth" || c.type === "rubber_block" || c.type === "tough_meat" || c.type === "leather" || c.type === "hide");

          if (!c.vel) {
            // initial velocity outward from spawn point
            const vOut = 0.002 + Math.random() * 0.003;
            const vUp = 0.003 + Math.random() * 0.005;
            const cf = c.F || [1, 0, 0];
            const cn = c.normal || [0, 1, 0];
            c.vel = [
              cf[0] * vOut + cn[0] * vUp,
              cf[1] * vOut + cn[1] * vUp,
              cf[2] * vOut + cn[2] * vUp,
            ];
          }

          // Throttle floating wooden drops gently bobbing in water (~12Hz instead of 60Hz VBO rebuilds)
          if (isItemDrop && c._waterDropSettled) {
            c._waterBobTimer = (c._waterBobTimer || 0) + frameDtSec;
            if (c._waterBobTimer < 0.083) {
              continue;
            }
            c._waterBobTimer = 0;
          }

          const r = Math.sqrt(
            c.position[0] ** 2 + c.position[1] ** 2 + c.position[2] ** 2,
          );
          
          let isAirborneWingedBoat = false;
          let preTerrainRadius = null;
          let preCaveData = null;
          let preWaterRadius = (typeof Physics !== "undefined" && typeof Physics.getCanonicalWaterRadius === "function")
            ? Physics.getCanonicalWaterRadius(RADIUS, waterLevel, HEIGHT_SCALE)
            : (RADIUS + waterLevel * (typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE * 0.25 : 0.15));
          let preInWater = false;
          
          if (r > 0.001) {
            const nx = c.position[0] / r;
            const ny = c.position[1] / r;
            const nz = c.position[2] / r;

            let force = gravityAccel;
            
            // Single terrain + water lookup per frame (reused for ground collision below)
            preCaveData = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx, ny, nz, r) : null;
            if (preCaveData) {
              preTerrainRadius = preCaveData.ground;
            } else {
              let theta = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
              let phi = Math.atan2(nz, nx);
              let height = (typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, globalSeed) : (typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta, phi, globalSeed) : 0));
              preTerrainRadius = RADIUS + height * HEIGHT_SCALE;
            }
            const terrainRadius = preTerrainRadius;
            const waterRadius = preWaterRadius;
            
            let inWater = false;
            if (waterEnabled && terrainRadius < waterRadius) {
                if (preCaveData && preCaveData.insideTunnel) {
                    const wRadiusLocal = typeof getWaterRadiusAt === "function"
                      ? getWaterRadiusAt(c.position[0], c.position[1], c.position[2], preCaveData)
                      : waterRadius;
                    inWater = (wRadiusLocal > terrainRadius);
                } else {
                    inWater = true;
                }
            }
            preInWater = inWater;
            
            let isLogFloat = ((c.type === "log" || c.type === "branch" || c.type === "plank" || c.type === "wood_floor" || c.type === "thin_wood_floor" || (c.type === "wood_boat" && !c.isGroundDrop)) && inWater && r <= waterRadius + 0.1);

            const hasWingBoat = (c.type === "wood_boat" && !c.isGroundDrop) && !!(c.hasWing || c.hasWings);
            const isWheeledBoat = (c.type === "wood_boat" && !c.isGroundDrop) && !!(c.hasWheel || c.hasWheels || (c.wheelCount && c.wheelCount > 0));
            const groundRadCheck = inWater ? (waterRadius - 0.04) : terrainRadius;
            isAirborneWingedBoat = hasWingBoat && !inWater && (c.isFlying || c.isGliding || (r - groundRadCheck > 0.15));

            if (isLogFloat) {
                // Buoyant force counters gravity and pushes it up to the surface
                const depth = waterRadius - r;
                // Target radius for the log to float is slightly below the water surface so it looks half-submerged
                let targetR = waterRadius - 0.005; 
                if (c.type === "wood_boat" && !c.isGroundDrop) {
                    let wpx = c.position[0], wpy = c.position[1], wpz = c.position[2];
                    let rLen = Math.sqrt(wpx*wpx + wpy*wpy + wpz*wpz) || 1;
                    const wave = getWaterWave(wpx/rLen*waterRadius, wpy/rLen*waterRadius, wpz/rLen*waterRadius, waterAnimTime, waveStrength);
                    // The boat has gravity pulling it down. Under the spring force, it settles at targetR - 0.07.
                    // To make it float properly we adjust the targetR slightly below the water surface.
                    targetR = waterRadius + wave - 0.02;
                }
                const bobOffset = Math.sin(Date.now() * 0.002 + c.seed * 100) * 0.0003;
                force = gravityAccel - (targetR - r) * 0.05 - bobOffset;
                
                // Extra damping for water
                Physics.applyFriction(c.vel, 0.90);
                c.spinSpeed *= 0.85;

                // Gradually align normal to point up so the log lies flat on the water
                c.normal[0] = c.normal[0] * 0.9 + nx * 0.1;
                c.normal[1] = c.normal[1] * 0.9 + ny * 0.1;
                c.normal[2] = c.normal[2] * 0.9 + nz * 0.1;
                const nLen = Math.sqrt(c.normal[0]**2 + c.normal[1]**2 + c.normal[2]**2);
                c.normal[0] /= nLen;
                c.normal[1] /= nLen;
                c.normal[2] /= nLen;

                // Re-orthogonalize R and F
                let dot = c.R[0]*c.normal[0] + c.R[1]*c.normal[1] + c.R[2]*c.normal[2];
                c.R[0] -= dot * c.normal[0];
                c.R[1] -= dot * c.normal[1];
                c.R[2] -= dot * c.normal[2];
                let rLen = Math.sqrt(c.R[0]**2 + c.R[1]**2 + c.R[2]**2);
                if (rLen > 0.001) {
                    c.R[0] /= rLen; c.R[1] /= rLen; c.R[2] /= rLen;
                } else {
                    // Fallback
                    c.R = [c.normal[1], -c.normal[0], 0];
                }
                c.F = [
                  c.R[1]*c.normal[2] - c.R[2]*c.normal[1],
                  c.R[2]*c.normal[0] - c.R[0]*c.normal[2],
                  c.R[0]*c.normal[1] - c.R[1]*c.normal[0]
                ];
            } else if (isAirborneWingedBoat) {
                // === Realistically glide & sink down just like the condition when not pressing W ===
                const dt = typeof window.timeScale !== "undefined" ? window.timeScale : 1.0;
                const glideSinkRate = -0.010;
                c.verticalVel = Math.max(glideSinkRate, (c.verticalVel || -0.002) - 0.0008 * dt);
                c.pitchGrade = (c.pitchGrade || 0) * 0.95 - 0.04 * Math.min(1.0, 0.06 * dt);
                const coastFriction = Math.pow(0.995, dt);
                c.vehicleSpeed = (typeof c.vehicleSpeed === "number" ? c.vehicleSpeed : 0) * coastFriction;
                if (Math.abs(c.vehicleSpeed) < 0.00001) c.vehicleSpeed = 0;

                // Gradually level bank angle back to 0
                if (c.bankAngle) {
                    c.bankAngle *= Math.pow(0.92, dt);
                    if (Math.abs(c.bankAngle) < 0.001) c.bankAngle = 0;
                }

                // Aerodynamic attitude stabilization relative to sphere normal
                let currN = c.normal || [nx, ny, nz];
                let airNx = currN[0] + (nx - currN[0]) * Math.min(1.0, 0.06 * dt);
                let airNy = currN[1] + (ny - currN[1]) * Math.min(1.0, 0.06 * dt);
                let airNz = currN[2] + (nz - currN[2]) * Math.min(1.0, 0.06 * dt);
                let airLen = Math.sqrt(airNx*airNx + airNy*airNy + airNz*airNz) || 1;
                c.normal = [airNx / airLen, airNy / airLen, airNz / airLen];

                // Ensure F and R remain strictly orthonormal
                if (!c.F) c.F = [1, 0, 0];
                let fDot = c.F[0]*c.normal[0] + c.F[1]*c.normal[1] + c.F[2]*c.normal[2];
                let newF = [c.F[0] - fDot*c.normal[0], c.F[1] - fDot*c.normal[1], c.F[2] - fDot*c.normal[2]];
                let lenF = Math.sqrt(newF[0]**2 + newF[1]**2 + newF[2]**2);
                if (lenF > 0.001) { c.F = [newF[0]/lenF, newF[1]/lenF, newF[2]/lenF]; }
                if (!c.R) c.R = [0, 1, 0];
                c.R = [c.normal[1]*c.F[2] - c.normal[2]*c.F[1], c.normal[2]*c.F[0] - c.normal[0]*c.F[2], c.normal[0]*c.F[1] - c.normal[1]*c.F[0]];
                let lenR = Math.sqrt(c.R[0]**2 + c.R[1]**2 + c.R[2]**2);
                if (lenR > 0.001) { c.R = [c.R[0]/lenR, c.R[1]/lenR, c.R[2]/lenR]; }

                // Velocity vector: forward along F + sinking along normal (towards core)
                c.vel[0] = c.F[0] * c.vehicleSpeed + nx * c.verticalVel;
                c.vel[1] = c.F[1] * c.vehicleSpeed + ny * c.verticalVel;
                c.vel[2] = c.F[2] * c.vehicleSpeed + nz * c.verticalVel;

                c.spinSpeed = 0;
            } else {
                // Air friction (dampen quickly to land smoothly)
                Physics.applyFriction(c.vel, 0.82);
                c.vel[0] -= nx * force;
                c.vel[1] -= ny * force;
                c.vel[2] -= nz * force;
            }
          }

          c.position[0] += c.vel[0];
          c.position[1] += c.vel[1];
          c.position[2] += c.vel[2];
          
          // Random tumbling rotation logic for the logs
          if (!c.spinAxis) {
              if (c.type === "wood_boat" && !c.isGroundDrop) {
                  c.spinAxis = [0, 1, 0];
                  c.spinSpeed = 0;
              } else {
                  const ax = Math.random() - 0.5;
                  const ay = Math.random() - 0.5;
                  const az = Math.random() - 0.5;
                  const alen = Math.sqrt(ax*ax + ay*ay + az*az) || 1;
                  c.spinAxis = [ax/alen, ay/alen, az/alen];
                  c.spinSpeed = (Math.random() - 0.5) * 0.2;
              }
          }
          
          // Ground collision (reuses single terrain lookup above — saves 50% terrain height queries!)
          const rAfter = Math.sqrt(
            c.position[0] * c.position[0] + c.position[1] * c.position[1] + c.position[2] * c.position[2]
          ) || 1;
          const nx_c = c.position[0] / rAfter;
          const ny_c = c.position[1] / rAfter;
          const nz_c = c.position[2] / rAfter;
          
          let terrainRadius = preTerrainRadius;
          if (terrainRadius === null) {
            let caveDataForCol = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx_c, ny_c, nz_c, rAfter) : null;
            if (caveDataForCol) {
              terrainRadius = caveDataForCol.ground;
            } else {
              let theta = Math.acos(Math.max(-1.0, Math.min(1.0, ny_c)));
              let phi = Math.atan2(nz_c, nx_c);
              let height = (typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, globalSeed) : (typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta, phi, globalSeed) : 0));
              terrainRadius = RADIUS + height * HEIGHT_SCALE;
            }
          }
          
          const waterRadius = preWaterRadius;
          let groundRadius = preInWater ? waterRadius : terrainRadius;
          let isInWater = preInWater;
          
          let isWoodBoat = (c.type === "wood_boat" && !c.isGroundDrop);
          let collisionRadius = groundRadius + (isWoodBoat ? (isInWater ? -0.04 : 0.002) : (isItemDrop ? 0.001 : (c.size ? c.size * 0.5 : 0)));
          if (isWoodBoat && !isInWater) {
             const cPos = c.position;
             if (typeof Physics !== "undefined" && typeof Physics.getFloorSurfaceRadiusAt === "function") {
               collisionRadius = Physics.getFloorSurfaceRadiusAt(cPos[0], cPos[1], cPos[2], collisionRadius);
             }
          }
          let pitchGrade = 0;
          let rollGrade = 0;
          
          let isWheeledBoat = isWoodBoat && (c.hasWheel || c.hasWheels || (c.wheelCount && c.wheelCount > 0));

          if (isWheeledBoat && !isInWater) {
              const nx = c.position[0] / (r || 1);
              const ny = c.position[1] / (r || 1);
              const nz = c.position[2] / (r || 1);

              const isRidden = (typeof activeRidingBoat !== "undefined" && activeRidingBoat === c);

              if (c._isSleeping && !isRidden) {
                  collisionRadius = c._cachedCollisionRadius || groundRadius;
                  pitchGrade = 0;
                  rollGrade = 0;
              } else {
                  const vehicleTransform = Physics.calculateLandBoatTransform({
                      position: c.position,
                      nx, ny, nz,
                      F: c.F,
                      R: c.R,
                      baseRadius: groundRadius,
                      waterEnabled,
                      waterLevel,
                      waterAnimTime,
                      waveStrength,
                      hasWheels: true,
                      isInWater: false
                  });

                  collisionRadius = vehicleTransform.targetGroundRadius;
                  c._cachedCollisionRadius = collisionRadius;
                  if (!isAirborneWingedBoat) {
                      pitchGrade = vehicleTransform.pitchGrade;
                      rollGrade = vehicleTransform.rollGrade;
                      c.normal = vehicleTransform.normal;
                      c.F = vehicleTransform.F;
                      c.R = vehicleTransform.R;
                  }
              }
          } else if (isInWater) {
              // Wood boat keeps exact original water depth (-0.04), item drops settle at ground/water
              collisionRadius = isWoodBoat ? (waterRadius - 0.04) : (terrainRadius + (isItemDrop ? 0.001 : (c.size ? c.size * 0.5 : 0)));
          }
          
          if (rAfter < collisionRadius) {
            // Hit ground/water
            const nx = nx_c;
            const ny = ny_c;
            const nz = nz_c;
            
            c.position[0] = nx * collisionRadius;
            c.position[1] = ny * collisionRadius;
            c.position[2] = nz * collisionRadius;
            c.isFlying = false;
            c.isGliding = false;
            c.verticalVel = 0;
            
            // bounce and friction (soft realistic bounce for ground drops so they settle quickly!)
            const dot = c.vel[0] * nx + c.vel[1] * ny + c.vel[2] * nz;
            if (dot < 0) {
                let restitution = (isWheeledBoat || isWoodBoat) ? 0.0 : (isItemDrop ? 0.28 : 0.45);
                c.vel[0] -= dot * nx * (1.0 + restitution);
                c.vel[1] -= dot * ny * (1.0 + restitution);
                c.vel[2] -= dot * nz * (1.0 + restitution);
            }
            let friction = 0.6;
            if (isWheeledBoat && !isInWater) {
                friction = 1.0; // Speed is handled by vehSpeed instead of c.vel friction
                c.spinSpeed = 0; // Wheeled boats align to terrain instead of spinning

                const bF = c.F, bR_vec = c.R;
                
                let pSpeed = typeof window.playerSpeed !== "undefined" ? window.playerSpeed : 0.005;
                let vehSpeed = typeof c.vehicleSpeed !== "undefined" ? c.vehicleSpeed : 0;
                let dt = typeof window.timeScale !== "undefined" ? window.timeScale : 1.0;

                const isRidden = (typeof activeRidingBoat !== "undefined" && activeRidingBoat === c) || (typeof window !== "undefined" && window.activeRidingBoat === c);

                if (!isRidden) {
                    if (c._isSleeping) {
                        vehSpeed = 0;
                        c.vehicleSpeed = 0;
                        c.vel[0] = 0; c.vel[1] = 0; c.vel[2] = 0;
                    } else {
                        // 1. Apply gravity to vehSpeed
                        const pitchGrade = c.pitchGrade || 0;
                        let gravityRollPower = pitchGrade * pSpeed * 0.5 * dt;
                        vehSpeed -= gravityRollPower;

                        // 2. Apply coast friction
                        vehSpeed *= Math.pow(0.96, dt);
                        if (Math.abs(vehSpeed) < 0.0005) {
                            vehSpeed = 0;
                            c._isSleeping = true;
                            c._sleepWakeTick = window._boatSleepCheckTick || 0;
                        }
                        c.vehicleSpeed = vehSpeed;

                        // 3. Move along forward vector
                        c.vel[0] = (bF ? bF[0] : 0) * vehSpeed;
                        c.vel[1] = (bF ? bF[1] : 0) * vehSpeed;
                        c.vel[2] = (bF ? bF[2] : 0) * vehSpeed;

                        // 4. Update wheel spin visually
                        if (Math.abs(vehSpeed) > 0.0001) {
                            const wheelScale = typeof window.wheelScaleMultiplier === "number" ? window.wheelScaleMultiplier : 1.0;
                            const wheelRadius = 0.16 * wheelScale;
                            const distTraveled = vehSpeed * dt;
                            c.spinAngle = (c.spinAngle || 0) + (distTraveled / wheelRadius);
                        }
                    }
                }
            }
            Physics.applyFriction(c.vel, friction);
            
            c.spinSpeed *= friction;

            // Stop moving if very slow
            const speedSq = c.vel[0]**2 + c.vel[1]**2 + c.vel[2]**2;
            if (isWoodBoat) {
              c.isInWater = isInWater;
              if (isInWater && Math.abs(collisionRadius - r) < 0.015 && speedSq < 0.0002) {
                c._waterSettled = true;
              } else {
                c._waterSettled = false;
              }
            }

            if (isWoodBoat && !isInWater && !isWheeledBoat) {
                // Non-wheeled boat on land cannot move (completely static and stable)
                c.vel[0] = 0;
                c.vel[1] = 0;
                c.vel[2] = 0;
                c.spinSpeed = 0;
                c._isSleeping = true;
                c._sleepWakeTick = window._boatSleepCheckTick || 0;
            } else if (isWheeledBoat && !isInWater && (!activeRidingBoat || activeRidingBoat !== c)) {
                if (speedSq < 0.0004 && Math.abs(c.vehicleSpeed || 0) < 0.0005) {
                    c.vel[0] = 0;
                    c.vel[1] = 0;
                    c.vel[2] = 0;
                    c.spinSpeed = 0;
                    c.vehicleSpeed = 0;
                    c._isSleeping = true;
                    c._sleepWakeTick = window._boatSleepCheckTick || 0;
                }
            } else if (!isWoodBoat) {
                c._settleFrames = (c._settleFrames || 0) + 1;
                if ((speedSq < 0.00018 && Math.abs(c.spinSpeed || 0) < 0.03) || c._settleFrames >= 16) {
                  // Snap cleanly to ground surface and put drop to sleep (0 CPU / 0 VBO rebuild cost!)
                  c.vel[0] = 0;
                  c.vel[1] = 0;
                  c.vel[2] = 0;
                  c.spinSpeed = 0;

                  // Align normal to the surface (right-handed basis R = normal x F)
                  c.normal = [nx, ny, nz];
                  const oldF = c.F || [1, 0, 0];
                  let fDot = oldF[0] * nx + oldF[1] * ny + oldF[2] * nz;
                  let newF = [oldF[0] - fDot * nx, oldF[1] - fDot * ny, oldF[2] - fDot * nz];
                  let lenF = Math.sqrt(newF[0] * newF[0] + newF[1] * newF[1] + newF[2] * newF[2]);
                  if (lenF > 0.001) {
                    c.F = [newF[0] / lenF, newF[1] / lenF, newF[2] / lenF];
                  } else {
                    if (Math.abs(ny) < 0.9) {
                      c.F = [-nz, 0, nx];
                    } else {
                      c.F = [1, 0, 0];
                    }
                    let len = Math.sqrt(c.F[0] * c.F[0] + c.F[1] * c.F[1] + c.F[2] * c.F[2]) || 1;
                    c.F = [c.F[0] / len, c.F[1] / len, c.F[2] / len];
                  }
                  c.R = [
                    c.normal[1] * c.F[2] - c.normal[2] * c.F[1],
                    c.normal[2] * c.F[0] - c.normal[0] * c.F[2],
                    c.normal[0] * c.F[1] - c.normal[1] * c.F[0]
                  ];
                  c.U = c.normal;

                  if (isItemDrop) {
                    const isFloatingWood = (c.type === "log" || c.type === "branch") && isInWater;
                    if (isFloatingWood) {
                      c._waterDropSettled = true;
                    } else {
                      c._dropSettled = true;
                    }
                    needRefresh = true;
                  }
                }
            }
          } else {
             // apply spin
             if (!isWoodBoat) {
                 const sAngle = c.spinSpeed;
                 const sCos = Math.cos(sAngle);
                 const sSin = Math.sin(sAngle);
                 const ax = c.spinAxis[0], ay = c.spinAxis[1], az = c.spinAxis[2];
                 
                 const rotateVec = (v) => {
                     const dot = v[0]*ax + v[1]*ay + v[2]*az;
                     return [
                         v[0]*sCos + (ay*v[2] - az*v[1])*sSin + ax*dot*(1-sCos),
                         v[1]*sCos + (az*v[0] - ax*v[2])*sSin + ay*dot*(1-sCos),
                         v[2]*sCos + (ax*v[1] - ay*v[0])*sSin + az*dot*(1-sCos)
                     ];
                 };
                 
                 c.R = rotateVec(c.R);
                 c.F = rotateVec(c.F);
                 c.normal = rotateVec(c.normal);
             } else {
                 // Keep boat upright towards planet normal
                 const upN = [nx_c, ny_c, nz_c];
                 c.normal = upN;
                 if (c.F) {
                     const dotF = c.F[0]*upN[0] + c.F[1]*upN[1] + c.F[2]*upN[2];
                     c.F = [c.F[0] - dotF*upN[0], c.F[1] - dotF*upN[1], c.F[2] - dotF*upN[2]];
                     const fLen = Math.sqrt(c.F[0]*c.F[0] + c.F[1]*c.F[1] + c.F[2]*c.F[2]) || 1;
                     c.F = [c.F[0]/fLen, c.F[1]/fLen, c.F[2]/fLen];
                     c.R = [
                         c.normal[1]*c.F[2] - c.normal[2]*c.F[1],
                         c.normal[2]*c.F[0] - c.normal[0]*c.F[2],
                         c.normal[0]*c.F[1] - c.normal[1]*c.F[0]
                     ];
                 }
             }
          }
          
          if (isWoodBoat && c.isInWater && c._waterSettled) {
            const refP = c._lastVboPos || _oldP;
            const refR = c._lastVboR || _oldR;
            const posMoved = refP && (Math.abs(c.position[0] - refP[0]) > 0.0008 || Math.abs(c.position[1] - refP[1]) > 0.0008 || Math.abs(c.position[2] - refP[2]) > 0.0008);
            const rotMoved = refR && c.R && (Math.abs(c.R[0] - refR[0]) > 0.002 || Math.abs(c.R[1] - refR[1]) > 0.002 || Math.abs(c.R[2] - refR[2]) > 0.002);
            if (posMoved || rotMoved) {
              needRefresh = true;
              c._lastVboPos = [c.position[0], c.position[1], c.position[2]];
              if (c.R) c._lastVboR = [c.R[0], c.R[1], c.R[2]];
            }
          } else {
            if (_oldP && (Math.abs(c.position[0]-_oldP[0])>1e-6 || Math.abs(c.position[1]-_oldP[1])>1e-6 || Math.abs(c.position[2]-_oldP[2])>1e-6)) needRefresh = true;
            if (_oldR && c.R && (Math.abs(c.R[0]-_oldR[0])>1e-6 || Math.abs(c.R[1]-_oldR[1])>1e-6 || Math.abs(c.R[2]-_oldR[2])>1e-6)) needRefresh = true;
          }
        }
        
        if (typeof window !== "undefined" && window.GroundDropSystem && typeof window.GroundDropSystem.processExpiredDrops === "function") {
            const sweepDt = (typeof dt === "number" && dt > 0 && dt < 0.25) ? dt : (1 / 60);
            window.GroundDropSystem.processExpiredDrops(sweepDt, collectibles);
        }

        if (activeRidingBoat && activeRidingBoat._moved) {
            activeRidingBoat._moved = false;
        }

        if (needMainRefresh) {
            window.pendingCollectibleRefresh = true;
        }
        if (needRefresh) {
            window.pendingDynamicCollectibleRefresh = true;
        }
      }

      function clearActiveCollectibles() {
        collectibles.length = 0;
        if (window.collectibles) window.collectibles.length = 0;
        if (typeof SpatialGrid !== "undefined") SpatialGrid.clear();
        window.pendingCollectibleRefresh = true;
        window.pendingDynamicCollectibleRefresh = true;
      }
      window.clearActiveCollectibles = clearActiveCollectibles;
      window.buildCollectibles = buildCollectibles;
      window.rebuildCollectibles = function(count, seed) {
        buildCollectibles(count || 50, seed || (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 12345));
      };

      // ============================================
      // ระบบข้อมูลไอเทมหลังบ้าน (Backend Item System & Registry)
      // แบ่งไอเทมออกเป็น 3 หมวดหมู่หลัก:
      // 1. PRE_PLACE : ไอเทม พรี-วาง (สิ่งก่อสร้าง/กล่อง/เรือ/กองไฟ/ชิ้นส่วนหุ่นยนต์)
      // 2. HOLDABLE  : ไอเทมถือ (อาวุธ/เครื่องมือ/ของกิน/ของถือในมือ)
      // 3. NONE      : ไอเทมที่ไม่ใช่ทั้งพรี-วางและถือ (วัตถุดิบ/แร่/ทรัพยากร/ลูกธนู/แบตเตอรี่)
      // ============================================

      const ITEM_CATEGORIES = {
        PRE_PLACE: "PRE_PLACE", // ไอเทม พรี-วาง
        HOLDABLE: "HOLDABLE",   // ไอเทมถือ
        NONE: "NONE",            // ไม่ใช่ทั้ง พรี-วาง และ ถือ
        VEHICLE: "VEHICLE"      // ยานพาหนะ
      };
      window.ITEM_CATEGORIES = ITEM_CATEGORIES;

      // ระดับ/ชนิดที่มาของไอเทม (Item Rarity / Acquisition Type)
      // 1. COMMON     : ไอเทมทั่วไป
      // 2. RARE       : ไอเทมหายาก
      // 3. CRAFT_ONLY : ไอเทมคราฟเท่านั้น
      // 4. SYSTEM     : ไอเทมระบบ (ไม่สุ่มในกล่องสุ่ม)
      const ITEM_RARITIES = {
        COMMON: "COMMON",         // ไอเทมทั่วไป
        RARE: "RARE",             // ไอเทมหายาก
        CRAFT_ONLY: "CRAFT_ONLY", // ไอเทมคราฟเท่านั้น
        SYSTEM: "SYSTEM"          // ไอเทมระบบ
      };
      window.ITEM_RARITIES = ITEM_RARITIES;

      const ITEM_RARITY_LABELS = {
        COMMON:     { th: "ไอเทมทั่วไป",       en: "Common",      ja: "一般アイテム" },
        RARE:       { th: "ไอเทมหายาก",        en: "Rare",        ja: "レアアイテム" },
        CRAFT_ONLY: { th: "ไอเทมคราฟเท่านั้น", en: "Craft Only",  ja: "クラフト限定" },
        SYSTEM:     { th: "ไอเทมระบบ",         en: "System Item", ja: "システムアイテム" }
      };
      window.ITEM_RARITY_LABELS = ITEM_RARITY_LABELS;

      const ITEM_DEFINITIONS = {
        // --- 1. หมวดไอเทม พรี-วาง (PRE_PLACE) ---
        "STONE_FLOOR": {
          id: "STONE_FLOOR",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "พื้นหิน",
          name_en: "Stone Floor",
          icon: "🪨",
          actionType: "PLACE_STRUCTURE",
          placeType: "stone_floor",
          usage_th: "พรี-วางเป็นแผ่นพื้นหินแข็งแรงทนทาน ใช้เป็นฐานรากสิ่งปลูกสร้าง",
          usage_en: "Pre-place on terrain to build durable stone foundation.",
          maxStack: 30
        },
        "WOOD_FLOOR": {
          id: "WOOD_FLOOR",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "พื้นไม้",
          name_en: "Wood Floor",
          icon: "🪵",
          actionType: "PLACE_STRUCTURE",
          placeType: "wood_floor",
          usage_th: "พรี-วางเป็นแผ่นพื้นไม้สำหรับสร้างบ้าน ทางเดิน และระเบียง",
          usage_en: "Pre-place to construct wooden floors, paths, and decks.",
          maxStack: 30
        },
        "THIN_WOOD_FLOOR": {
          id: "THIN_WOOD_FLOOR",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "พื้นไม้บาง",
          name_en: "Thin Wood Floor",
          icon: "🪵",
          actionType: "PLACE_STRUCTURE",
          placeType: "thin_wood_floor",
          usage_th: "พรี-วางเป็นแผ่นไม้แบบบาง สำหรับปูพื้นเพดานหรือตกแต่งภายใน",
          usage_en: "Pre-place as thin wooden plank for ceilings or interior flooring.",
          maxStack: 30
        },
        "WOOD_STAIRS": {
          id: "WOOD_STAIRS",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "บันไดไม้",
          name_en: "Wood Stairs",
          icon: "🪜",
          actionType: "PLACE_STRUCTURE",
          placeType: "wood_stairs",
          usage_th: "พรี-วางเป็นบันไดไม้สำหรับเชื่อมต่อต่างระดับและปีนขึ้นที่สูง",
          usage_en: "Pre-place to construct wooden stairs connecting heights and floors.",
          maxStack: 30
        },
        "FOLDING_LADDER": {
          id: "FOLDING_LADDER",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "บันไดพับ",
          name_en: "Folding Ladder",
          icon: "🪜",
          actionType: "PLACE_STRUCTURE",
          placeType: "folding_ladder",
          usage_th: "บันไดพับสไตล์ Death Stranding สำหรับวางพาดได้อย่างอิสระ ทั้งบนพื้นและในถ้ำ พาดขึ้นหน้าผา ผนังถ้ำ ปากถ้ำ หรือพาดข้ามเหว",
          usage_en: "Death Stranding style extendable folding ladder to lean on cliffs, cave walls, cave entrances, or bridge chasms freely.",
          maxStack: 30
        },
        "WOOD_WALL": {
          id: "WOOD_WALL",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "กำแพงไม้",
          name_en: "Wood Wall",
          icon: "🧱",
          actionType: "PLACE_STRUCTURE",
          placeType: "wood_wall",
          usage_th: "พรี-วางเป็นผนังห้อง กำแพงบ้าน หรือแนวป้องกัน",
          usage_en: "Pre-place to build wooden walls and room enclosures.",
          maxStack: 30
        },
        "WOOD_WINDOW": {
          id: "WOOD_WINDOW",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "หน้าต่างไม้",
          name_en: "Wood Window",
          icon: "🪟",
          actionType: "PLACE_STRUCTURE",
          placeType: "wood_window",
          usage_th: "พรี-วางเป็นผนังไม้พร้อมช่องกระจกหน้าต่างรับแสง",
          usage_en: "Pre-place to build wooden wall with glass window opening.",
          maxStack: 30
        },
        "WOOD_DOOR": {
          id: "WOOD_DOOR",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "ประตูไม้",
          name_en: "Wood Door",
          icon: "🚪",
          actionType: "PLACE_STRUCTURE",
          placeType: "wood_door",
          usage_th: "พรี-วางเป็นบานประตูไม้สำหรับเข้าออกบ้าน สามารถเปิด-ปิดได้",
          usage_en: "Pre-place as functional openable/closeable wooden door.",
          maxStack: 30
        },
        "WOOD_ROOF": {
          id: "WOOD_ROOF",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "หลังคาไม้",
          name_en: "Wood Roof",
          icon: "🛖",
          actionType: "PLACE_STRUCTURE",
          placeType: "wood_roof",
          usage_th: "พรี-วางเป็นหลังคาทรงจั่วด้านบนสิ่งปลูกสร้าง",
          usage_en: "Pre-place to build sloped wooden roof atop structures.",
          maxStack: 30
        },
        "WOOD_CHEST": {
          id: "WOOD_CHEST",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "กล่องไม้",
          name_en: "Wooden Chest",
          icon: "📦",
          actionType: "PLACE_FURNITURE",
          placeType: "wood_chest",
          usage_th: "พรี-วางเป็นหีบเก็บของความจุ 20 ช่องสำหรับเก็บไอเทมถาวร",
          usage_en: "Pre-place as a 20-slot storage chest to store items safely.",
          maxStack: 30
        },
        "WOOD_BED": {
          id: "WOOD_BED",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "เตียงไม้พร้อมฟูก",
          name_en: "Wooden Bed with Mattress",
          icon: "🛏️",
          actionType: "PLACE_FURNITURE",
          placeType: "wood_bed",
          usage_th: "พรี-วางเป็นเตียงไม้พร้อมฟูกนุ่มจากฝ้าย (สามารถวางบนพื้นไม้เท่านั้น)",
          usage_en: "Pre-place as a cozy wooden bed with soft cotton mattress (can only be placed on wooden floors).",
          maxStack: 30
        },
        "WOOD_TABLE": {
          id: "WOOD_TABLE",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "โต๊ะไม้",
          name_en: "Wooden Table",
          icon: "🪑",
          actionType: "PLACE_FURNITURE",
          placeType: "wood_table",
          usage_th: "พรี-วางเป็นโต๊ะไม้โลโพลีสำหรับตกแต่งบ้านหรือพื้นที่พักอาศัย คราฟต์จากท่อนไม้ 1 อัน",
          usage_en: "Pre-place as a low-poly wooden table for furnishing your home or camp. Crafted from 1 Wood Log.",
          maxStack: 30
        },
        "WOOD_PLANTER_BOX": {
          id: "WOOD_PLANTER_BOX",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "กล่องไม้ใส่ดิน",
          name_en: "Wooden Planter Box",
          name_ja: "木製プランター（土入り）",
          icon: "🪴",
          actionType: "PLACE_FURNITURE",
          placeType: "wood_planter_box",
          usage_th: "พรี-วางเป็นกระบะกล่องไม้ใส่ดินโลโพลีสำหรับปลูกพืชและตกแต่ง คราฟต์จากท่อนไม้ 1 อัน และดิน 1 อัน",
          usage_en: "Pre-place as a low-poly wooden planter box filled with soil. Crafted from 1 Wood Log and 1 Dirt.",
          maxStack: 30
        },
        "WOOD_CHAIR": {
          id: "WOOD_CHAIR",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "เก้าอี้ไม้",
          name_en: "Wooden Chair",
          icon: "🪑",
          actionType: "PLACE_FURNITURE",
          placeType: "wood_chair",
          usage_th: "พรี-วางเป็นเก้าอี้ไม้มีพนักพิงสไตล์โลโพลีสำหรับตกแต่งคู่กับโต๊ะไม้ คราฟต์จากท่อนไม้ 1 อัน",
          usage_en: "Pre-place as a low-poly wooden chair with backrest. Crafted from 1 Wood Log.",
          maxStack: 30
        },
        "LANTERN": {
          id: "LANTERN",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "ตะเกียง",
          name_en: "Lantern",
          icon: "🏮",
          actionType: "PLACE_FURNITURE",
          placeType: "lantern",
          usage_th: "พรี-วางเป็นตะเกียงหินเรืองแสงโลโพลีเพื่อให้แสงสว่างและตกแต่งบ้าน (วางได้บนโต๊ะไม้และพื้นไม้) คราฟต์จากหินเรืองแสง 1 และแร่เหล็ก 1",
          usage_en: "Pre-place as a low-poly glowing ore lantern for light and decoration (can be placed on wooden tables and wooden floors). Crafted from 1 Glowing Ore and 1 Iron Ore.",
          maxStack: 30
        },
        "CAMPFIRE": {
          id: "CAMPFIRE",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "กองไฟ",
          name_en: "Campfire",
          icon: "🔥",
          actionType: "PLACE_FURNITURE",
          placeType: "campfire",
          usage_th: "พรี-วางบนพื้นเพื่อให้แสงสว่างและเปิดเมนูปรุงอาหาร (Cooking)",
          usage_en: "Pre-place to provide light and open campfire cooking menu.",
          maxStack: 30
        },
        "WOOD_BOAT": {
          id: "WOOD_BOAT",
          category: [ITEM_CATEGORIES.PRE_PLACE, ITEM_CATEGORIES.VEHICLE],
          name_th: "เรือไม้",
          name_en: "Wood Boat",
          icon: "🛶",
          actionType: "PLACE_VEHICLE",
          placeType: "wood_boat",
          usage_th: "พรี-วางลงบนน้ำหรือพื้นดินเพื่อใช้เป็นยานพาหนะขับขี่เดินทาง",
          usage_en: "Pre-place on water or land to drive and explore the planet.",
          maxStack: 30
        },
        "WOOD_WHEEL": {
          id: "WOOD_WHEEL",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "ล้อไม้",
          name_en: "Wooden Wheel",
          icon: "������",
          actionType: "PLACE_COMPONENT",
          placeType: "wood_wheel",
          usage_th: "พรี-วางติดตั้งประกอบเข้ากับเรือไม้ ทำให้เรือวิ่งบนบกได้อย่างคล่องตัว",
          usage_en: "Pre-place to attach wheels to boat, enabling land traversal.",
          maxStack: 30
        },
        "ELECTRIC_ENGINE": {
          id: "ELECTRIC_ENGINE",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "เครื่องยนต์ไฟฟ้า",
          name_en: "Electric Engine",
          icon: "🔋",
          actionType: "PLACE_COMPONENT",
          placeType: "electric_engine",
          usage_th: "พรี-วางติดตั้งประกอบเข้ากับเรือไม้ เพิ่มความเร็วและแรงบิด (ใช้ไฟจากแบตเตอรี่)",
          usage_en: "Pre-place to attach motor engine to boat for high-speed propulsion.",
          maxStack: 30
        },
        "BOAT_WING": {
          id: "BOAT_WING",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "ปีกเรือ",
          name_en: "Boat Wing",
          icon: "🪽",
          actionType: "PLACE_COMPONENT",
          placeType: "boat_wing",
          usage_th: "พรี-วางติดตั้งประกอบเข้ากับเรือไม้เพื่อปลดล็อกการบิน (ต้องมีเครื่องยนต์ไฟฟ้า, กด Shift เพื่อเปิดโหมดบิน)",
          usage_en: "Attach biplane wings to boat to enable flight mode (Requires Electric Engine, press Shift to fly).",
          maxStack: 30
        },
        "MEGANEURA": {
          id: "MEGANEURA",
          category: ITEM_CATEGORIES.NONE,
          name_th: "แมลงยักษ์",
          name_en: "Meganeura",
          icon: "🦟",
          actionType: "MATERIAL",
          usage_th: "ใช้เป็นวัตถุดิบปรุงอาหาร (เช่น แมลงทอด FRIED_BUG) หรือคราฟต์",
          usage_en: "Used as cooking ingredient (e.g. Fried Bug) and crafting material.",
          maxStack: 30
        },
        "ISOPOD": {
          id: "ISOPOD",
          category: ITEM_CATEGORIES.NONE,
          name_th: "ไอโซพอด",
          name_en: "Isopod",
          icon: "🦐",
          actionType: "MATERIAL",
          usage_th: "ใช้เป็นวัตถุดิบและอาหาร หรือคราฟต์",
          usage_en: "Used as food ingredient and crafting material.",
          maxStack: 30
        },
        "OBSIDIAN_CUBE": {
          id: "OBSIDIAN_CUBE",
          category: ITEM_CATEGORIES.NONE,
          name_th: "ศิลาออบซิเดียน",
          name_en: "Obsidian Cube",
          icon: "🔶",
          actionType: "MATERIAL",
          usage_th: "ศิลาออบซิเดียนลายทองคำที่เก็บได้จากซากศิลาออบซิเดียน ใช้เป็นวัตถุดิบหรือไอเทมสะสม",
          usage_en: "Gilded obsidian stone collected from defeated Obsidian Monolith. Used as material or collectible.",
          maxStack: 30
        },
        "OBSIDIAN_PAD_WARP": {
          id: "OBSIDIAN_PAD_WARP",
          category: ITEM_CATEGORIES.PRE_PLACE,
          rarity: ITEM_RARITIES.CRAFT_ONLY,
          name_th: "แท่นวาร์ปออบซิเดียน",
          name_en: "OBSIDIAN PAD Warp",
          icon: "🧭",
          actionType: "PLACE_STRUCTURE",
          placeType: "obsidian_pad_warp_item",
          usage_th: "แท่นวาร์ปออบซิเดียนลายทองคำสกัดพลังงานหินเรืองแสง สามารถวางประดับบนพื้นโลกได้",
          usage_en: "Gilded obsidian warp pad platform infused with Glow Ore energy. Can be placed on planet ground.",
          maxStack: 30
        },
        "ROBOT_STAND": {
          id: "ROBOT_STAND",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "ฐานตั้งหุ่นยนต์",
          name_en: "Robot Stand",
          icon: "🏗️",
          actionType: "PLACE_STRUCTURE",
          placeType: "robot_stand",
          usage_th: "พรี-วางเป็นแท่นโครงสร้างสำหรับประกอบชิ้นส่วนหุ่นยนต์",
          usage_en: "Pre-place as assembly stand platform for modular robot parts.",
          maxStack: 30
        },
        "ROBOT_COCKPIT": {
          id: "ROBOT_COCKPIT",
          category: [ITEM_CATEGORIES.PRE_PLACE, ITEM_CATEGORIES.VEHICLE],
          name_th: "ห้องนักบินหุ่นยนต์",
          name_en: "Robot Cockpit",
          icon: "🤖",
          actionType: "PLACE_STRUCTURE",
          placeType: "robot_cockpit",
          usage_th: "พรี-วางประกอบเป็นห้องควบคุมหุ่นยนต์บนแท่นประกอบ",
          usage_en: "Pre-place as central cockpit module on robot frame.",
          maxStack: 30
        },
        "ROBOT_LEFT_ARM": {
          id: "ROBOT_LEFT_ARM",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "แขนซ้ายหุ่นยนต์",
          name_en: "Robot Left Arm",
          icon: "🦾",
          actionType: "PLACE_STRUCTURE",
          placeType: "robot_left_arm",
          usage_th: "พรี-วางประกอบเป็นแขนซ้ายของหุ่นยนต์",
          usage_en: "Pre-place to attach left arm module to robot cockpit.",
          maxStack: 30
        },
        "ROBOT_RIGHT_ARM": {
          id: "ROBOT_RIGHT_ARM",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "แขนขวาหุ่นยนต์",
          name_en: "Robot Right Arm",
          icon: "🦾",
          actionType: "PLACE_STRUCTURE",
          placeType: "robot_right_arm",
          usage_th: "พรี-วางประกอบเป็นแขนขวาของหุ่นยนต์",
          usage_en: "Pre-place to attach right arm module to robot cockpit.",
          maxStack: 30
        },
        "ROBOT_LEFT_LEG": {
          id: "ROBOT_LEFT_LEG",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "ขาซ้ายหุ่นยนต์",
          name_en: "Robot Left Leg",
          icon: "🦿",
          actionType: "PLACE_STRUCTURE",
          placeType: "robot_left_leg",
          usage_th: "พรี-วางประกอบเป็นขาซ้ายของหุ่นยนต์",
          usage_en: "Pre-place to attach left leg module to robot frame.",
          maxStack: 30
        },
        "ROBOT_RIGHT_LEG": {
          id: "ROBOT_RIGHT_LEG",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "ขาขวาหุ่นยนต์",
          name_en: "Robot Right Leg",
          icon: "🦿",
          actionType: "PLACE_STRUCTURE",
          placeType: "robot_right_leg",
          usage_th: "พรี-วางประกอบเป็นขาขวาของหุ่นยนต์",
          usage_en: "Pre-place to attach right leg module to robot frame.",
          maxStack: 30
        },

        // --- 2. หมวดไอเทมถือ (HOLDABLE) ---
        "AXE": {
          id: "AXE",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ขวาน",
          name_en: "Axe",
          icon: "🪓",
          actionType: "TOOL_CHOP",
          toolType: "AXE",
          targetTypes: ["tree"],
          animDuration: 1.0,
          damage: 2,
          usage_th: "ถือในมือ คลิกซ้ายใช้ตัดต้นไม้เพื่อเก็บท่อนไม้ และใช้โจมตีทำดาเมจ 2 จุด",
          usage_en: "Hold in hand. Left-click to chop trees for logs and attack for 2 DMG.",
          maxStack: 1
        },
        "PICKAXE": {
          id: "PICKAXE",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "อีเตอร์",
          name_en: "Pickaxe",
          icon: "⛏️",
          actionType: "TOOL_MINE",
          toolType: "PICKAXE",
          targetTypes: ["rock", "iron_ore", "gold_ore", "glow_ore"],
          animDuration: 1.0,
          damage: 2,
          usage_th: "ถือในมือ คลิกซ้ายใช้ขุดเจาะหินและแร่ธาตุ และใช้โจมตีทำดาเมจ 2 จุด",
          usage_en: "Hold in hand. Left-click to mine rocks and ores, and attack for 2 DMG.",
          maxStack: 1
        },
        "AEGIS_SHIFT": {
          id: "AEGIS_SHIFT",
          category: ITEM_CATEGORIES.HOLDABLE,
          rarity: ITEM_RARITIES.CRAFT_ONLY,
          name_th: "อีเตอร์ดาบใหญ่",
          name_en: "Aegis-Shift",
          name_ja: "イージスシフト",
          icon: "⛏️⚔️",
          actionType: "TOOL_MULTI",
          toolType: "AEGIS_SHIFT",
          targetTypes: ["tree", "rock", "iron_ore", "gold_ore", "glow_ore"],
          animDuration: 1.0,
          damage: 2,
          npcHitConfig: {
            dmg: 2,
            label: "⛏️⚡ ฟาดด้วย Aegis-Shift!",
            useUnifiedMeleeReach: true,
            coneCos: 0.45,
            maxVert: 0.65
          },
          usage_th: "คลิกซ้ายใช้ขุดหิน/แร่ (อีเตอร์) หรือตัดต้นไม้ (พับคมด้านหนึ่งเป็นขวานอัตโนมัติ) คลิกขวาแปลงเป็นดาบใหญ่พุ่งฟันทำดาเมจ 2 HP (ไม่เสียความหิว) แล้วแบกบนบ่าจนกว่าจะเดิน",
          usage_en: "Left-click auto-shifts between Pickaxe (rocks/ores) and folded-blade Axe (trees). Right-click shifts to Greatsword dash slash for 2 DMG (0 hunger) and rests on shoulder until walking.",
          maxStack: 1
        },
        "SHOVEL": {
          id: "SHOVEL",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "พลั่ว",
          name_en: "Shovel",
          icon: "🥄",
          actionType: "TOOL_DIG",
          toolType: "SHOVEL",
          animDuration: 1.0,
          damage: 1,
          digConfig: {
            delta: -0.35,
            altRadius: 0.05,
            dropItem: { name: "DIRT", icon: "🟫", count: 1, label: "DIRT" }
          },
          usage_th: "ถือในมือ คลิกซ้ายขุดปรับแต่งระดับภูมิประเทศหลุม/คูน้ำ และใช้โจมตีทำดาเมจ 1 จุด",
          usage_en: "Hold in hand. Left-click to dig/terraform terrain and attack for 1 DMG.",
          maxStack: 1
        },
        "IRON_BUCKET": {
          id: "IRON_BUCKET",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ถังเหล็ก",
          name_en: "Iron Bucket",
          name_ja: "鉄のバケツ",
          icon: "🪣",
          actionType: "TOOL_BUCKET",
          usage_th: "ถังน้ำเหล็กหล่อโลโพลี ใช้ตักน้ำและถือใช้งาน คราฟต์จากแร่เหล็ก 1 อัน",
          usage_en: "Low-poly forged iron water bucket. Crafted from 1 Iron Ore.",
          maxStack: 30
        },
        "WATER_BUCKET": {
          id: "WATER_BUCKET",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ถังใส่น้ำ",
          name_en: "Water Bucket",
          name_ja: "水入りバケツ",
          icon: "🪣💧",
          actionType: "TOOL_WATER_BUCKET",
          usage_th: "ถังเหล็กที่มีน้ำบรรจุเต็มถัง ได้จากการใช้ถังเหล็กตักน้ำ",
          usage_en: "Iron bucket filled with water. Obtained by scooping water with an Iron Bucket.",
          maxStack: 30
        },
        "BOW": {
          id: "BOW",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ธนู",
          name_en: "Bow",
          icon: "🏹",
          actionType: "WEAPON_RANGED",
          toolType: "BOW",
          animDuration: 1.4,
          damage: 1.5,
          isDisabled: true,
          disabledNotice: "🚫 คันธนูถูกปิดใช้งาน กรุณาใช้ปืนไม้ติดแขน (ARM CANNON) แทน!",
          usage_th: "ถือในมือ เล็งและคลิกซ้ายยิงลูกธนูระยะไกล (ต้องมีลูกธนู ARROW ในกระเป๋า)",
          usage_en: "Hold in hand. Aim and left-click to shoot arrows (requires ARROW in inventory).",
          maxStack: 1
        },
        "WOODEN_ARM_CANNON": {
          id: "WOODEN_ARM_CANNON",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ปืนไม้ติดแขน",
          name_en: "Wooden Arm Cannon",
          icon: "🪵🦾",
          actionType: "WEAPON_RANGED",
          toolType: "WOODEN_ARM_CANNON",
          animDuration: 1.07,
          ammoTypes: ["IRON_BULLET", "ARROW"],
          noAmmoNotice: "🚫 ไม่พบกระสุนในกระเป๋า! กรุณาคราฟ ลูกธนู หรือ กระสุนเหล็ก ทรงกลม",
          damage: 2.5,
          usage_th: "สวมครอบแขน เล็งและคลิกซ้ายยิงลูกธนูพลังสูง (ต้องมีลูกธนู ARROW ในกระเป๋า)",
          usage_en: "Mounted on arm. Aim and left-click to shoot high-velocity arrows (requires ARROW in inventory).",
          maxStack: 1
        },
        "ARM_CANNON": {
          id: "WOODEN_ARM_CANNON",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ปืนไม้ติดแขน",
          name_en: "Wooden Arm Cannon",
          icon: "🪵🦾",
          actionType: "WEAPON_RANGED",
          toolType: "WOODEN_ARM_CANNON",
          animDuration: 1.07,
          ammoTypes: ["IRON_BULLET", "ARROW"],
          noAmmoNotice: "🚫 ไม่พบกระสุนในกระเป๋า! กรุณาคราฟ ลูกธนู หรือ กระสุนเหล็ก ทรงกลม",
          damage: 2.5,
          usage_th: "สวมครอบแขน เล็งและคลิกซ้ายยิงลูกธนูพลังสูง (ต้องมีลูกธนู ARROW ในกระเป๋า)",
          usage_en: "Mounted on arm. Aim and left-click to shoot high-velocity arrows (requires ARROW in inventory).",
          maxStack: 1
        },
        "BRANCH": {
          id: "BRANCH",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "กิ่งไม้",
          name_en: "Branch",
          icon: "🌿",
          actionType: "WEAPON_MELEE",
          toolType: "BRANCH",
          animDuration: 1.0,
          damage: 1,
          consumeOnNpcHit: true,
          breakNotice: "🌿 กิ่งไม้ฟาดโดนเป้าหมายจนหักพังแล้ว! (Branch hit target and broke!)",
          usage_th: "ถือในมือ ใช้ฟาดโจมตีระยะประชิด ทำดาเมจ 1 จุด (กิ่งไม้จะหักเมื่อฟาดโดนเป้าหมาย)",
          usage_en: "Hold in hand. Swing to melee attack for 1 DMG (breaks upon successful hit).",
          maxStack: 30
        },
        "TANTO": {
          id: "TANTO",
          category: ITEM_CATEGORIES.HOLDABLE,
          rarity: ITEM_RARITIES.CRAFT_ONLY,
          name_th: "ทันโตะ",
          name_en: "Tanto",
          name_ja: "短刀",
          icon: "🗡️",
          actionType: "WEAPON_MELEE",
          toolType: "TANTO",
          targetTypes: ["tree"],
          animDuration: 1.0,
          damage: 3,
          npcHitConfig: {
            dmg: 3,
            label: "🗡️💥 ฟันด้วยทันโตะ!",
            useUnifiedMeleeReach: true,
            coneCos: 0.45,
            maxVert: 0.65
          },
          usage_th: "มีดตันโตะออบซิเดียนเรืองแสง ใช้งานเป็นมีดทั่วไปสำหรับฟันโจมตีระยะประชิด (3 DMG) และตัดฟันเก็บเกี่ยวทั่วไปโดยไม่พัง (คราฟต์จาก ศิลาออบซิเดียน 1, แร่หินเรืองแสง 1, แร่เหล็ก 1)",
          usage_en: "Glowing obsidian tanto knife. General knife for melee slashing (3 DMG) and everyday cutting without breaking (crafted from 1 Obsidian Cube, 1 Glow Ore, 1 Iron Ore).",
          maxStack: 1
        },
        "FRIED_BUG": {
          id: "FRIED_BUG",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "แมลงทอด",
          name_en: "Fried Bug",
          icon: "🍤",
          actionType: "CONSUMABLE_FOOD",
          restoreHunger: 3,
          healHP: 2,
          eatNotice: "กินแมลงทอด! ฟื้นฟูความหิว +3 ช่อง และ HP +2 ช่อง (Ate fried bug! Hunger +3, HP +2)",
          usage_th: "ถือในมือ/คลิกใช้ รับประทานเพื่อฟื้นฟูความหิว +3 และพลังชีวิต HP +2 ช่อง",
          usage_en: "Hold or use to eat and restore Hunger +3 and HP +2.",
          maxStack: 30
        },
        "DRAGON_FRUIT": {
          id: "DRAGON_FRUIT",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "แก้วมังกร",
          name_en: "Dragon Fruit",
          icon: "🐉",
          actionType: "CONSUMABLE_FOOD",
          restoreHunger: 2,
          healHP: 1,
          eatNotice: "กินแก้วมังกร! ฟื้นฟูความหิว +2 ช่อง และ HP +1 ช่อง (Ate dragon fruit! Hunger +2, HP +1)",
          usage_th: "รับประทานฟื้นฟูความหิว +2 และ HP +1 หรือถือในมือเพื่อนำไปปลูกในกล่องไม้ใส่ดิน (WOOD PLANTER BOX) ได้ต้นไม้ใบขาวแดง/ขาวทอง",
          usage_en: "Eat to restore Hunger +2 and HP +1, or hold to plant inside a Wooden Planter Box to grow a white-and-red leaved tree.",
          maxStack: 30
        },
        "COTTON_PLANT": {
          id: "COTTON_PLANT",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ต้นฝ้าย (นุ่น)",
          name_en: "Cotton Plant",
          icon: "☁️",
          actionType: "RAW_MATERIAL",
          usage_th: "พืชธรรมชาติ ถือในมือเพื่อนำไปปลูกในกล่องไม้ใส่ดิน (WOOD PLANTER BOX) หรือใช้เป็นวัตถุดิบเส้นใยและสิ่งทอ",
          usage_en: "Natural fiber plant. Hold to plant inside a Wooden Planter Box or use for textile crafting.",
          maxStack: 30
        },
        "CROWN_FLOWER": {
          id: "CROWN_FLOWER",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ต้นรัก",
          name_en: "Crown Flower",
          name_ja: "クラウンフラワー",
          icon: "💮",
          actionType: "RAW_MATERIAL",
          usage_th: "พุ่มดอกรักธรรมชาติ ถือในมือเพื่อนำไปปลูกในกล่องไม้ใส่ดิน (WOOD PLANTER BOX)",
          usage_en: "Natural Crown Flower bush. Hold to plant inside a Wooden Planter Box.",
          maxStack: 30
        },
        "GRASS": {
          id: "GRASS",
          category: ITEM_CATEGORIES.NONE,
          name_th: "หญ้า",
          name_en: "Grass",
          name_ja: "草",
          icon: "🌱",
          actionType: "RAW_MATERIAL",
          usage_th: "หญ้าธรรมชาติ ได้จากการใช้มีดตันโตะ (Tanto) ตัดกอหญ้าบนพื้นดาว",
          usage_en: "Natural grass obtained by cutting grass tufts on the ground with a Tanto knife.",
          maxStack: 30
        },
        "CLOTH": {
          id: "CLOTH",
          category: ITEM_CATEGORIES.NONE,
          name_th: "ผ้า",
          name_en: "Cloth",
          name_ja: "布",
          icon: "⬜",
          actionType: "RAW_MATERIAL",
          usage_th: "ผ้าทอสีขาวที่ได้จากการคราฟต์ด้วยต้นฝ้าย (นุ่น) 50 ชิ้น และหญ้า 50 ชิ้น (ครั้งละ 10 ชิ้น) ใช้เป็นวัตถุดิบสำหรับสิ่งทอและสิ่งประดิษฐ์",
          usage_en: "White woven cloth crafted from 50 Cotton Plants and 50 Grass (yields 10). Used as a textile crafting material.",
          maxStack: 30
        },
        "RUBBER_BLOCK": {
          id: "RUBBER_BLOCK",
          category: ITEM_CATEGORIES.NONE,
          name_th: "ก้อนยาง",
          name_en: "Rubber Block",
          name_ja: "ゴムブロック",
          icon: "⬛",
          actionType: "RAW_MATERIAL",
          usage_th: "ก้อนยางสีดำที่ได้จากการคราฟต์ด้วยต้นรัก (Crown Flower) 10 ต้น ต่อก้อนยาง 1 ก้อน",
          usage_en: "Dense black rubber block crafted from 10 Crown Flowers (yields 1).",
          maxStack: 30
        },
        "TOUGH_MEAT": {
          id: "TOUGH_MEAT",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "เนื้อเหนียว",
          name_en: "Tough Meat",
          name_ja: "硬い肉",
          icon: "🥩",
          actionType: "CONSUMABLE_FOOD",
          restoreHunger: 2,
          healHP: 1,
          eatNotice: "กินเนื้อเหนียว! ฟื้นฟูความหิว +2 ช่อง และ HP +1 ช่อง (Ate Tough Meat! Hunger +2, HP +1)",
          usage_th: "เนื้อเหนียวที่ได้จากการใช้มีดตันโตะ (Tanto) ฟันแล่ซาก Georgiacetus สามารถรับประทานฟื้นฟูความหิว +2 และ HP +1 หรือเก็บเป็นวัตถุดิบได้",
          usage_en: "Tough whale meat harvested by slashing a defeated Georgiacetus corpse with a Tanto knife. Eat to restore Hunger +2 and HP +1.",
          maxStack: 30
        },
        "LEATHER": {
          id: "LEATHER",
          category: ITEM_CATEGORIES.NONE,
          name_th: "หนัง",
          name_en: "Leather",
          name_ja: "革",
          icon: "🟫",
          actionType: "RAW_MATERIAL",
          usage_th: "แผ่นหนังที่ได้จากการใช้มีดตันโตะ (Tanto) ฟันแล่ซาก Georgiacetus ใช้เป็นวัตถุดิบสำหรับงานประดิษฐ์",
          usage_en: "Thick hide leather harvested by slashing a defeated Georgiacetus corpse with a Tanto knife. Used as a crafting material.",
          maxStack: 30
        },

        // --- 3. หมวดไอเทมที่ไม่ใช่ทั้ง พรี-วาง และ ถือ (NONE) ---
        "ROCK": {
          id: "ROCK",
          category: ITEM_CATEGORIES.NONE,
          name_th: "หิน",
          name_en: "Rock",
          icon: "🪨",
          actionType: "RAW_MATERIAL",
          usage_th: "วัตถุดิบธรรมชาติ เก็บจากพื้น ใช้สำหรับคราฟต์ขวาน อีเตอร์ และกองไฟ",
          usage_en: "Natural material picked from ground. Used to craft Axe, Pickaxe, and Campfire.",
          maxStack: 30
        },
        "BIG_ROCK": {
          id: "BIG_ROCK",
          category: ITEM_CATEGORIES.NONE,
          name_th: "หินใหญ่",
          name_en: "Big Rock",
          icon: "🪨",
          actionType: "RAW_MATERIAL",
          usage_th: "วัตถุดิบก้อนหิน ได้จากการขุดหิน ใช้สำหรับคราฟต์พลั่ว ลูกธนู และพื้นหิน",
          usage_en: "Large rock mined from stone nodes. Used to craft Shovel, Arrows, and Stone Floor.",
          maxStack: 30
        },
        "DIRT": {
          id: "DIRT",
          category: ITEM_CATEGORIES.NONE,
          name_th: "ดิน",
          name_en: "Dirt",
          icon: "🟫",
          actionType: "RAW_MATERIAL",
          usage_th: "ดินที่ได้จากการขุดหลุมด้วยพลั่ว",
          usage_en: "Soil obtained from digging holes with a shovel.",
          maxStack: 30
        },
        "LOG": {
          id: "LOG",
          category: ITEM_CATEGORIES.NONE,
          name_th: "ท่อนไม้",
          name_en: "Wood Log",
          icon: "🪵",
          actionType: "RAW_MATERIAL",
          usage_th: "วัตถุดิบท่อนไม้หลักจากการตัดต้นไม้ ใช้สำหรับคราฟต์สิ่งปลูกสร้าง โครงสร้าง และเรือ",
          usage_en: "Primary wood resource from trees. Used to craft structures, buildings, and boats.",
          maxStack: 30
        },
        "IRON_ORE": {
          id: "IRON_ORE",
          category: ITEM_CATEGORIES.NONE,
          name_th: "แร่เหล็ก",
          name_en: "Iron Ore",
          icon: "🟥",
          actionType: "ORE_RESOURCE",
          usage_th: "วัตถุดิบแร่เหล็ก ได้จากการขุดสายแร่ ใช้สำหรับคราฟต์ล้อไม้และเครื่องยนต์ไฟฟ้า",
          usage_en: "Iron mineral ore. Used to craft Wooden Wheels and Electric Engines.",
          maxStack: 30
        },
        "GOLD_ORE": {
          id: "GOLD_ORE",
          category: ITEM_CATEGORIES.NONE,
          name_th: "แร่ทองคำ",
          name_en: "Gold Ore",
          icon: "🪙",
          actionType: "ORE_RESOURCE",
          usage_th: "วัตถุดิบแร่ทองคำมีค่า หายาก ได้จากการขุดสายแร่ทองคำ ใช้สำหรับงานประดิษฐ์ชั้นสูง",
          usage_en: "Precious gold ore mined from veins. Used for advanced crafting and technology.",
          maxStack: 30
        },
        "GLOW_ORE": {
          id: "GLOW_ORE",
          category: ITEM_CATEGORIES.NONE,
          name_th: "แร่หินเรืองแสง",
          name_en: "Glow Ore",
          icon: "✨",
          actionType: "ORE_RESOURCE",
          usage_th: "วัตถุดิบแร่หินเรืองแสงพลังงานสูง ได้จากการขุดสายแร่ ใช้คราฟต์แบตเตอรี่เรืองแสง",
          usage_en: "Luminescent energy ore. Used to craft Glowing Battery rods.",
          maxStack: 30
        },
        "GLOW_BATTERY": {
          id: "GLOW_BATTERY",
          category: ITEM_CATEGORIES.NONE,
          name_th: "หินเรืองแสงอัดแท่ง(แบต)",
          name_en: "Glowing Battery Rod",
          icon: "🔋",
          actionType: "ENERGY_SOURCE",
          usage_th: "แหล่งพลังงานไฟฟ้าสำหรับขับเคลื่อนเครื่องยนต์เรือ (จ่ายไฟอัตโนมัติจากในกระเป๋า)",
          usage_en: "Automated power cell stored in inventory to power electric boat engines.",
          maxStack: 30
        },
        "GLOW_BATTERY_EMPTY": {
          id: "GLOW_BATTERY_EMPTY",
          category: ITEM_CATEGORIES.NONE,
          name_th: "แบตเตอรี่เรืองแสง(หมดพลังงาน)",
          name_en: "Empty Glowing Battery",
          icon: "🪫",
          actionType: "ENERGY_SOURCE_EMPTY",
          usage_th: "แบตเตอรี่ที่หมดพลังงานแล้ว จะทำการชาร์จไฟอัตโนมัติเมื่ออยู่ในกระเป๋า (ใช้เวลา 5 นาที)",
          usage_en: "Empty power cell. It will automatically recharge while in your inventory (takes 5 mins).",
          maxStack: 30
        },
        "ARROW": {
          id: "ARROW",
          category: ITEM_CATEGORIES.NONE,
          name_th: "ลูกธนู",
          name_en: "Arrow",
          icon: "🏹",
          actionType: "AMMO",
          usage_th: "กระสุนลูกธนูในกระเป๋า สำหรับใช้งานยิงร่วมกับธนู (BOW)",
          usage_en: "Ammunition stored in inventory, consumed when firing the Bow.",
          maxStack: 30
        },
        "IRON_BULLET": {
          id: "IRON_BULLET",
          category: ITEM_CATEGORIES.NONE,
          name_th: "กระสุนเหล็ก ทรงกลม",
          name_en: "Spherical Iron Bullet",
          icon: "⚪",
          actionType: "AMMO",
          usage_th: "กระสุนเหล็กทรงกลมสำหรับใช้เป็นเครื่องกระสุนยิงปืน/ปืนติดแขน (สร้างดาเมจ 3 HP / เจาะทำลายศิลาออบซิเดียนได้) คราฟต์จากแร่เหล็ก 1 อันได้ 5 นัด",
          usage_en: "Spherical iron ammunition dealing 3 HP damage (capable of damaging Obsidian Cubes). Crafted from 1 Iron Ore = 5 Bullets.",
          maxStack: 30
        },
        "OBSIDIAN_FLUX": {
          id: "OBSIDIAN_FLUX",
          category: ITEM_CATEGORIES.HOLDABLE,
          rarity: ITEM_RARITIES.CRAFT_ONLY,
          name_th: "ออบซิเดียนฟลักซ์",
          name_en: "Obsidian Flux",
          icon: "⚫",
          actionType: "WARP_ITEM",
          usage_th: "ไอเทมวาร์ปออบซิเดียนฟลักซ์ ใส่ในช่อง UI แอคชั่นแล้วกดใช้งานเพื่อเปิดหน้าต่างวาร์ปไปยังแท่นวาร์ป (Obsidian Pad) ที่วางไว้ตามลำดับ (การวาร์ป 1 ครั้งจะทำลาย Obsidian Flux 1 อัน)",
          usage_en: "Obsidian Flux warp item. Equip in Action UI and use to open the Warp UI and teleport to any placed Obsidian Pad in placement order (consumes 1 Obsidian Flux per warp).",
          maxStack: 30
        },
        "WHITE_BODYSUIT_TOP": {
          id: "WHITE_BODYSUIT_TOP",
          category: ITEM_CATEGORIES.HOLDABLE,
          rarity: ITEM_RARITIES.SYSTEM,
          isSystemItem: true,
          equipSlot: "shirt",
          name_th: "เสื้อบอดี้สูทแขนสั้นสีขาว",
          name_en: "White Short-Sleeve Bodysuit Top",
          icon: "👕",
          actionType: "EQUIP_SHIRT",
          usage_th: "เสื้อบอดี้สูทแขนสั้นสีขาวแบบแนบเนื้อ สวมใส่ในช่องเสื้อของตัวละคร (เมื่อใส่คู่กับกางเกงขาสั้นบอดี้สูทสีขาวจะเชื่อมต่อกันเนียนเป็นเนื้อเดียวกัน)",
          usage_en: "Form-fitting white short-sleeve bodysuit top. Equips in the character Shirt slot (seamlessly merges into a single continuous bodysuit when worn with the White Bodysuit Shorts).",
          maxStack: 1
        },
        "WHITE_BODYSUIT_SHORTS": {
          id: "WHITE_BODYSUIT_SHORTS",
          category: ITEM_CATEGORIES.HOLDABLE,
          rarity: ITEM_RARITIES.SYSTEM,
          isSystemItem: true,
          equipSlot: "pants",
          name_th: "กางเกงขาสั้นบอดี้สูทสีขาว",
          name_en: "White Bodysuit Shorts",
          icon: "🩳",
          actionType: "EQUIP_PANTS",
          usage_th: "กางเกงขาสั้นบอดี้สูทสีขาวแบบแนบเนื้อพร้อมตะเข็บเว้าทรงวี สวมใส่ในช่องกางเกง/กระโปรงของตัวละคร (เมื่อใส่คู่กับเสื้อบอดี้สูทแขนสั้นสีขาวจะเชื่อมต่อกันเนียนเป็นเนื้อเดียวกัน)",
          usage_en: "Form-fitting white bodysuit shorts with V-hip seams. Equips in the character Pants/Skirt slot (seamlessly merges into a single continuous bodysuit when worn with the White Bodysuit Top).",
          maxStack: 1
        },
        "TRAVELER_HOODIE": {
          id: "TRAVELER_HOODIE",
          category: ITEM_CATEGORIES.HOLDABLE,
          equipSlot: "accessory",
          name_th: "เสื้อฮูดผ้าคลุมนักเดินทาง",
          name_en: "Traveler Hoodie Cloak",
          icon: "🧥",
          actionType: "EQUIP_ACCESSORY",
          usage_th: "เสื้อฮูดผ้าคลุมนักเดินทางสีครีม-ลายข้าวหลามตัดสีดำพร้อมเข็มกลัดดอกไม้ทองคำ สวมใส่ในช่องของตกแต่งตัวละคร",
          usage_en: "Cream and black diamond-patterned traveler hoodie cloak with a golden flower brooch. Equips in the character Accessory slot.",
          maxStack: 1
        },
        "TRAVELER_BOOTS": {
          id: "TRAVELER_BOOTS",
          category: ITEM_CATEGORIES.HOLDABLE,
          equipSlot: "shoes",
          name_th: "รองเท้าบูทนักเดินทาง",
          name_en: "Traveler Ankle Boots",
          icon: "🥾",
          actionType: "EQUIP_SHOES",
          usage_th: "รองเท้าบูทหุ้มข้อสีเข้มขอบครีมของชุดนักเดินทาง สวมใส่ในช่องรองเท้าของตัวละคร",
          usage_en: "Dark ankle boots with cream folded cuffs from the traveler outfit. Equips in the character Shoes slot.",
          maxStack: 1
        },
        "OXFORD_SHOES": {
          id: "OXFORD_SHOES",
          category: ITEM_CATEGORIES.HOLDABLE,
          equipSlot: "shoes",
          name_th: "รองเท้าหนังอ็อกซ์ฟอร์ด",
          name_en: "Cap-Toe Oxford Shoes",
          icon: "👞",
          actionType: "EQUIP_SHOES",
          usage_th: "รองเท้าหนังแท้สีดำเงาทรง Cap-Toe Oxford ซับในหนังสีน้ำตาลแทน ส้นไม้ซ้อนชั้นแบบคลาสสิก สวมใส่ในช่องรองเท้าของตัวละคร",
          usage_en: "Classic polished black cap-toe Oxford dress shoes with warm tan leather lining, closed lacing, and stacked heel. Equips in the character Shoes slot.",
          maxStack: 1
        },
        "DRESS_BOOTS": {
          id: "DRESS_BOOTS",
          category: ITEM_CATEGORIES.HOLDABLE,
          equipSlot: "shoes",
          name_th: "รองเท้าบูทหนัง",
          name_en: "Cap-Toe Dress Boots",
          icon: "🥾",
          actionType: "EQUIP_SHOES",
          usage_th: "รองเท้าบูทหนังแท้สีดำเงาทรง Cap-Toe Balmoral Dress Boots หุ้มข้อสูงร้อยเชือกแบบปิด 7 ชั้นบนพื้นฐานรองเท้า Oxford พร้อมขอบเย็บและส้นไม้ซ้อนชั้น สวมใส่ในช่องรองเท้าของตัวละคร",
          usage_en: "High-shaft polished black cap-toe Balmoral dress boots built on the Oxford last, featuring 7-bar closed lacing, stitched quarter piping, tan lining, Goodyear welt, and stacked heel. Equips in the character Shoes slot.",
          maxStack: 1
        },
        "WHITE_SHIRT_SHORT": {
          id: "WHITE_SHIRT_SHORT",
          category: ITEM_CATEGORIES.HOLDABLE,
          equipSlot: "shirt",
          name_th: "เสื้อเชิ้ตสีขาวแขนสั้น",
          name_en: "White Short-Sleeve Shirt",
          icon: "👔",
          actionType: "EQUIP_SHIRT",
          usage_th: "เสื้อเชิ้ตสีขาวแขนสั้นแบบคอปกติดกระดุมหน้า สวมใส่ในช่องเสื้อของตัวละคร",
          usage_en: "Crisp white short-sleeve collared button-up shirt. Equips in the character Shirt slot.",
          maxStack: 1
        },
        "BLACK_PLEATED_SKIRT": {
          id: "BLACK_PLEATED_SKIRT",
          category: ITEM_CATEGORIES.HOLDABLE,
          equipSlot: "pants",
          name_th: "กระโปรงพลีทสีดำ",
          name_en: "Black Pleated Skirt",
          icon: "👗",
          actionType: "EQUIP_PANTS",
          usage_th: "กระโปรงจีบพลีทสีดำเอวสูงทรงเอพร้อมผ้าพลิ้วและกันจม สวมใส่ในช่องกางเกง/กระโปรงของตัวละคร",
          usage_en: "High-waisted A-line black knife-pleated mini skirt with dynamic cloth simulation. Equips in the character Pants/Skirt slot.",
          maxStack: 1
        },
        "BLACK_LEGGINGS": {
          id: "BLACK_LEGGINGS",
          category: ITEM_CATEGORIES.HOLDABLE,
          equipSlot: "accessory",
          name_th: "กางเกงเลกกิ้งสีดำ",
          name_en: "Black Leggings",
          icon: "👖",
          actionType: "EQUIP_ACCESSORY",
          usage_th: "กางเกงเลกกิ้งสีดำรัดรูปขายาวแบบแนบเนื้อ ใส่คู่กับกระโปรงหรือเสื้อได้หลายสไตล์ สวมใส่ในช่องของตกแต่ง (ของเสริม) ของตัวละคร",
          usage_en: "Matte black form-fitting full-length leggings. Equips in a character Accessory slot so it can be layered under skirts.",
          maxStack: 1
        },
        "DOUBLE_BREASTED_SUIT": {
          id: "DOUBLE_BREASTED_SUIT",
          category: ITEM_CATEGORIES.HOLDABLE,
          equipSlot: "accessory",
          name_th: "สูท",
          name_en: "Suit",
          name_ja: "スーツ",
          icon: "🧥",
          actionType: "EQUIP_ACCESSORY",
          usage_th: "เสื้อสูทกระดุมสองแถวสีเทาชาร์โคลลายทางแนวตั้งพร้อมปกแหลมและกระดุมสีอำพัน (เฉพาะตัวเสื้อสูท สวมใส่ในช่องของตกแต่ง และไม่สามารถใส่ทับพร้อมเสื้อฮูดผ้าคลุมได้)",
          usage_en: "Charcoal pinstripe double-breasted suit jacket with wide peak lapels and tortoiseshell buttons (outer jacket only. Equips in an Accessory slot and cannot be worn simultaneously with the Traveler Hoodie).",
          maxStack: 1
        },
        "BLACK_SLACKS": {
          id: "BLACK_SLACKS",
          category: ITEM_CATEGORIES.HOLDABLE,
          equipSlot: "pants",
          name_th: "กางเกงสแล็ค",
          name_en: "Black Dress Slacks",
          icon: "👖",
          actionType: "EQUIP_PANTS",
          usage_th: "กางเกงสแล็คขายาวทรงตรงสีกรมท่าเข้ม-ดำพร้อมขอบเอว หูเข็มขัด และรอยจีบหน้าขาแบบเนี้ยบ สวมใส่ในช่องกางเกง/กระโปรงของตัวละคร",
          usage_en: "Tailored straight-leg dark charcoal-navy dress slacks with belt loops and crisp front press creases. Equips in the character Pants/Skirt slot.",
          maxStack: 1
        },
        "OPERA_CAPE": {
          id: "OPERA_CAPE",
          category: ITEM_CATEGORIES.HOLDABLE,
          equipSlot: "accessory",
          name_th: "ผ้าคลุมไหล่โอเปร่า",
          name_en: "Opera Cape",
          icon: "🧛",
          actionType: "EQUIP_ACCESSORY",
          usage_th: "ผ้าคลุมไหล่ข้างเดียวสีดำสนิทซับในสีเขียวมรกตมืด พร้อมปกคอตั้ง สายรัดคอโลหะโค้ง และหัวเข็มขัดทรงโล่เงิน สวมใส่ในช่องของตกแต่งคู่กับเสื้อสูทได้",
          usage_en: "Asymmetric one-shoulder jet-black Opera Cape with dark emerald-teal lining, standing collar, curved metallic collar strap, and silver shield clasp. Equips in a character Accessory slot and pairs with the Double-Breasted Suit.",
          maxStack: 1
        }
      };

      // ตารางจัดกลุ่มชนิดไอเทมทั้ง 3 ระดับ (แก้ไข/ย้ายหมวดได้จากจุดเดียว)
      const ITEM_RARITY_GROUPS = {
        // ไอเทมคราฟเท่านั้น (CRAFT_ONLY)
        CRAFT_ONLY: [
          "AEGIS_SHIFT",
          "TANTO",
          "OBSIDIAN_PAD_WARP",
          "OBSIDIAN_FLUX",
          "ROBOT_STAND",
          "ROBOT_COCKPIT",
          "ROBOT_LEFT_ARM",
          "ROBOT_RIGHT_ARM",
          "ROBOT_LEFT_LEG",
          "ROBOT_RIGHT_LEG",
          "ELECTRIC_ENGINE",
          "BOAT_WING",
          "WOODEN_ARM_CANNON",
          "ARM_CANNON",
          "GLOW_BATTERY",
          "GLOW_BATTERY_EMPTY",
          "IRON_BULLET",
          "FOLDING_LADDER",
          "LANTERN",
          "TRAVELER_BOOTS",
          "OXFORD_SHOES",
          "DRESS_BOOTS",
          "WHITE_SHIRT_SHORT",
          "BLACK_PLEATED_SKIRT",
          "BLACK_LEGGINGS",
          "DOUBLE_BREASTED_SUIT",
          "BLACK_SLACKS",
          "OPERA_CAPE"
        ],
        // ไอเทมหายาก (RARE)
        RARE: [
          "GOLD_ORE",
          "GLOW_ORE",
          "OBSIDIAN_CUBE",
          "DRAGON_FRUIT",
          "CROWN_FLOWER",
          "TOUGH_MEAT",
          "LEATHER",
          "MEGANEURA",
          "ISOPOD",
          "TRAVELER_HOODIE"
        ],
        // ไอเทมระบบ (SYSTEM - ไม่นำมาสุ่มในกล่อง)
        SYSTEM: [
          "WHITE_BODYSUIT_TOP",
          "WHITE_BODYSUIT_SHORTS"
        ],
        // ไอเทมทั่วไป (COMMON)
        COMMON: [
          "STONE_FLOOR",
          "WOOD_FLOOR",
          "THIN_WOOD_FLOOR",
          "WOOD_STAIRS",
          "WOOD_WALL",
          "WOOD_WINDOW",
          "WOOD_DOOR",
          "WOOD_ROOF",
          "WOOD_CHEST",
          "WOOD_BED",
          "WOOD_TABLE",
          "WOOD_PLANTER_BOX",
          "WOOD_CHAIR",
          "CAMPFIRE",
          "WOOD_BOAT",
          "WOOD_WHEEL",
          "AXE",
          "PICKAXE",
          "SHOVEL",
          "IRON_BUCKET",
          "WATER_BUCKET",
          "BOW",
          "BRANCH",
          "FRIED_BUG",
          "COTTON_PLANT",
          "GRASS",
          "CLOTH",
          "RUBBER_BLOCK",
          "ROCK",
          "BIG_ROCK",
          "DIRT",
          "LOG",
          "IRON_ORE",
          "ARROW"
        ]
      };
      window.ITEM_RARITY_GROUPS = ITEM_RARITY_GROUPS;

      Object.keys(ITEM_RARITY_GROUPS).forEach(tierKey => {
        const list = ITEM_RARITY_GROUPS[tierKey];
        for (let i = 0; i < list.length; i++) {
          const def = ITEM_DEFINITIONS[list[i]];
          if (def && !def.rarity) {
            def.rarity = ITEM_RARITIES[tierKey];
          }
        }
      });
      Object.keys(ITEM_DEFINITIONS).forEach(k => {
        if (ITEM_DEFINITIONS[k] && !ITEM_DEFINITIONS[k].rarity) {
          ITEM_DEFINITIONS[k].rarity = ITEM_RARITIES.COMMON;
        }
      });

      window.ITEM_DEFINITIONS = ITEM_DEFINITIONS;
      if (window.ItemRegistry && typeof window.ItemRegistry === "object") {
        Object.assign(window.ItemRegistry, ITEM_DEFINITIONS);
      } else {
        window.ItemRegistry = Object.assign({}, ITEM_DEFINITIONS);
      }

      // Helper functions for Backend Item System
      const _ITEM_DEF_ALIASES = {
        CHEST: "WOOD_CHEST",
        PLANK: "WOOD_FLOOR",
        MEGANEURA_ITEM: "MEGANEURA",
        ISOPOD_ITEM: "ISOPOD",
        DRAGONFRUIT: "DRAGON_FRUIT",
        OBSIDIAN_CUBE_ITEM: "OBSIDIAN_CUBE",
        OBSIDIAN_PAD_WARP_ITEM: "OBSIDIAN_PAD_WARP",
        OBSIDIAN_COMPASS_PAD: "OBSIDIAN_PAD_WARP",
        OBSIDIAN_COMPASS_PAD_ITEM: "OBSIDIAN_PAD_WARP",
        OBSIDIAN_FLUX_ITEM: "OBSIDIAN_FLUX",
        HIDE: "LEATHER",
        HOODIE_CLOAK: "TRAVELER_HOODIE",
        HOODIE_BOOTS: "TRAVELER_BOOTS"
      };

      function getItemDefinition(itemOrName) {
        if (!itemOrName) return null;
        let key = typeof itemOrName === "string" ? itemOrName : (itemOrName.name || itemOrName.id || itemOrName.label || itemOrName.type || "");
        key = String(key).trim().toUpperCase();
        if (_ITEM_DEF_ALIASES[key]) key = _ITEM_DEF_ALIASES[key];
        return ITEM_DEFINITIONS[key] || null;
      }
      window.getItemDefinition = getItemDefinition;

      function getItemRarity(itemOrName) {
        if (typeof itemOrName === "string") {
          const up = itemOrName.trim().toUpperCase();
          if (ITEM_RARITIES[up]) return ITEM_RARITIES[up];
        }
        const def = getItemDefinition(itemOrName);
        if (def && def.rarity && ITEM_RARITIES[def.rarity]) {
          return def.rarity;
        }
        return ITEM_RARITIES.COMMON;
      }
      window.getItemRarity = getItemRarity;

      function isCommonItem(itemOrName) {
        return getItemRarity(itemOrName) === ITEM_RARITIES.COMMON;
      }
      window.isCommonItem = isCommonItem;

      function isRareItem(itemOrName) {
        return getItemRarity(itemOrName) === ITEM_RARITIES.RARE;
      }
      window.isRareItem = isRareItem;

      function isCraftOnlyItem(itemOrName) {
        return getItemRarity(itemOrName) === ITEM_RARITIES.CRAFT_ONLY;
      }
      window.isCraftOnlyItem = isCraftOnlyItem;

      function isSystemItem(itemOrName) {
        const def = getItemDefinition(itemOrName);
        if (def && def.isSystemItem) return true;
        return getItemRarity(itemOrName) === ITEM_RARITIES.SYSTEM;
      }
      window.isSystemItem = isSystemItem;

      // สุ่มของในกล่องสุ่มตามระดับไอเทม (1 กล่องสุ่มไม่เกิน 3 ไอเทม, จำนวนชิ้นไม่เกิน 3 อัน, ไม่สุ่มไอเทมคราฟเท่านั้นและไอเทมระบบ)
      function generateRandomLootChestStorage(rngFn) {
        const rand = typeof rngFn === "function" ? rngFn : Math.random;
        const storage = Array(20).fill(null);
        const defs = (typeof window !== "undefined" && window.ITEM_DEFINITIONS) ? window.ITEM_DEFINITIONS : ITEM_DEFINITIONS;
        const rarities = (typeof window !== "undefined" && window.ITEM_RARITIES) ? window.ITEM_RARITIES : ITEM_RARITIES;
        if (!defs || !rarities) return storage;

        const commonPool = [];
        const rarePool = [];
        const seenIds = new Set();

        const keys = Object.keys(defs);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const def = defs[k];
          if (!def || !def.id || def.id !== k) continue;
          if (seenIds.has(def.id)) continue;
          if (def.isSystemItem || def.isDisabled) continue;
          const r = def.rarity || rarities.COMMON;
          if (r === rarities.CRAFT_ONLY || r === rarities.SYSTEM) continue;
          seenIds.add(def.id);
          if (r === rarities.RARE) {
            rarePool.push(def);
          } else {
            commonPool.push(def);
          }
        }

        if (commonPool.length === 0 && rarePool.length === 0) return storage;

        // 1..3 items per chest (25% -> 1 item, 45% -> 2 items, 30% -> 3 items)
        const countRoll = rand();
        const numItems = countRoll < 0.25 ? 1 : (countRoll < 0.70 ? 2 : 3);
        const pickedIds = new Set();

        for (let slotIdx = 0; slotIdx < numItems; slotIdx++) {
          // 22% chance for RARE, 78% chance for COMMON
          let useRare = rarePool.length > 0 && (commonPool.length === 0 || rand() < 0.22);
          let pool = useRare ? rarePool : commonPool;
          let available = pool.filter(d => !pickedIds.has(d.id));
          if (available.length === 0) {
            pool = useRare ? commonPool : rarePool;
            available = pool.filter(d => !pickedIds.has(d.id));
          }
          if (available.length === 0) break;

          const chosen = available[Math.floor(rand() * available.length)];
          pickedIds.add(chosen.id);

          const maxQty = Math.min(3, Math.max(1, chosen.maxStack || 30));
          const qty = maxQty <= 1 ? 1 : (1 + Math.floor(rand() * maxQty));

          storage[slotIdx] = {
            name: chosen.id,
            icon: chosen.icon || "📦",
            count: qty,
            label: chosen.id
          };
        }

        return storage;
      }
      window.generateRandomLootChestStorage = generateRandomLootChestStorage;

      function getItemRarityLabel(itemOrNameOrRarity, lang) {
        const rarity = getItemRarity(itemOrNameOrRarity);
        const curLang = lang || (typeof window.getGameLanguage === "function" ? window.getGameLanguage() : (window.gameLanguage || getStoredLanguageFallback()));
        const entry = ITEM_RARITY_LABELS[rarity] || ITEM_RARITY_LABELS.COMMON;
        if (curLang === "seedian") {
          return (window.Seedian && typeof window.Seedian.toSeedian === "function") ? window.Seedian.toSeedian(entry.th) : entry.th;
        }
        if (curLang === "th") return entry.th;
        if (curLang === "ja") return entry.ja || entry.en;
        return entry.en;
      }
      window.getItemRarityLabel = getItemRarityLabel;

      function getItemCategory(itemOrName, actor = null) {
        const def = getItemDefinition(itemOrName);
        let cat = def ? def.category : ITEM_CATEGORIES.NONE;
        
        // ถ้ากำลังขับขี่ยานพาหนะ ไอเทมที่เป็น PRE_PLACE จะถูกปรับสภาพเป็น NONE ชั่วคราวทั้งหมด
        const isRiding = actor
          ? (typeof actor.isRiding === "function" ? actor.isRiding() : !!(actor.ridingBoat || actor.ridingMech))
          : ((typeof activeRidingBoat !== "undefined" && activeRidingBoat) ||
             (typeof activeRidingMech !== "undefined" && activeRidingMech));
                         
        if (isRiding) {
          const isPrePlace = Array.isArray(cat) ? cat.includes(ITEM_CATEGORIES.PRE_PLACE) : (cat === ITEM_CATEGORIES.PRE_PLACE);
          if (isPrePlace) {
            return ITEM_CATEGORIES.NONE;
          }
        }
        
        return cat;
      }
      window.getItemCategory = getItemCategory;
      
      function hasItemCategory(itemOrName, targetCategory, actor = null) {
        const cat = getItemCategory(itemOrName, actor);
        if (Array.isArray(cat)) {
          return cat.includes(targetCategory);
        }
        return cat === targetCategory;
      }
      window.hasItemCategory = hasItemCategory;

      function isPlaceableItem(itemOrName, actor = null) {
        return hasItemCategory(itemOrName, ITEM_CATEGORIES.PRE_PLACE, actor);
      }
      window.isPlaceableItem = isPlaceableItem;

      function isHoldableItem(itemOrName, actor = null) {
        return hasItemCategory(itemOrName, ITEM_CATEGORIES.HOLDABLE, actor);
      }
      window.isHoldableItem = isHoldableItem;

      function isNoneItem(itemOrName, actor = null) {
        return hasItemCategory(itemOrName, ITEM_CATEGORIES.NONE, actor);
      }
      window.isNoneItem = isNoneItem;

      function getStoredLanguageFallback() {
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            const raw = window.localStorage.getItem("seedplanet_options_config");
            if (raw) {
              const obj = JSON.parse(raw);
              if (obj && obj.language) return obj.language;
            }
          }
        } catch (_) {}
        return "en";
      }

      function getItemDisplayName(itemOrName, lang) {
        const curLang = lang || (typeof window.getGameLanguage === "function" ? window.getGameLanguage() : (window.gameLanguage || getStoredLanguageFallback()));
        const def = getItemDefinition(itemOrName);
        const rawKey = (def && def.id)
          ? def.id
          : (typeof itemOrName === "string" ? itemOrName : (itemOrName?.name || itemOrName?.type || ""));
        const cleanKey = "item_" + String(rawKey).toUpperCase();
        const i18nDict = (typeof window !== "undefined" && window.I18N_DICTIONARY) ? window.I18N_DICTIONARY : null;

        if (curLang === "seedian") {
          const raw = (i18nDict && i18nDict.th && i18nDict.th[cleanKey])
            || (def && (def.name_th || def.name_en))
            || (typeof itemOrName === "string" ? itemOrName : (itemOrName?.label || itemOrName?.name || "ITEM"));
          return (window.Seedian && typeof window.Seedian.toSeedian === "function") ? window.Seedian.toSeedian(raw) : raw;
        }

        if (i18nDict && i18nDict[curLang] && i18nDict[curLang][cleanKey]) {
          return i18nDict[curLang][cleanKey];
        }

        if (def) {
          if (curLang === "th") return def.name_th || def.name_en;
          if (curLang === "ja") return def.name_ja || def.name_en || def.name_th;
          return def.name_en || def.name_th;
        }

        if (typeof window.t === "function") {
          const translated = window.t(cleanKey);
          if (translated && translated !== cleanKey) return translated;
        }
        if (typeof itemOrName === "string") {
          return itemOrName;
        }
        return itemOrName?.label || itemOrName?.name || "ITEM";
      }
      window.getItemDisplayName = getItemDisplayName;

      function getItemUsage(itemOrName, lang) {
        const curLang = lang || (typeof window.getGameLanguage === "function" ? window.getGameLanguage() : (window.gameLanguage || getStoredLanguageFallback()));
        const def = getItemDefinition(itemOrName);
        if (def) {
          if (curLang === "th") return def.usage_th || def.usage_en;
          if (curLang === "seedian") {
            const raw = def.usage_th || def.usage_en;
            return (window.Seedian && typeof window.Seedian.toSeedian === "function") ? window.Seedian.toSeedian(raw) : raw;
          }
          return def.usage_en || def.usage_th;
        }
        return "";
      }
      window.getItemUsage = getItemUsage;

      // Shared NPC kill loot helper for PlayerClones / ActorCore
      window.grantNpcKillLootToActor = function(actorOrEntity, npc) {
        if (!actorOrEntity || !npc || npc._cloneLooted) return false;
        const actor = (typeof window.ActorCore !== "undefined") ? window.ActorCore.resolveActor(actorOrEntity) : null;
        if (!actor || actor.isPlayer) return false;
        npc._cloneLooted = true;
        if (npc.type === "isopod") {
          actor.addItem({ name: "ISOPOD", icon: "🦐", count: 1 }, false, false);
        } else if (npc.type === "meganeura") {
          actor.addItem({ name: "MEGANEURA", icon: "🦟", count: 1 }, false, false);
        } else if (npc.type === "obsidian_cube") {
          actor.addItem({ name: "OBSIDIAN_CUBE", icon: "🟪", count: 1 }, false, false);
        } else {
          actor.addItem({ name: "ISOPOD", icon: "🦐", count: 1 }, false, false);
        }
        actor.setExpression("(^o^)");
        return true;
      };