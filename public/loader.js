(function() {
  document.write('<link rel="stylesheet" href="public/style.css">');

  const scripts = [
    // --- UI Layout & Settings ---
    'public/gamefile/ui-layout.js',
    'public/gamefile/gameplay/settings.js',

    // --- Core Engine & Utilities ---
    'public/gamefile/Engine/utils.js',
    'public/gamefile/Engine/audio.js',
    'public/gamefile/Engine/terrain.js',
    'public/gamefile/Engine/debugLog.js',
    'public/gamefile/Engine/collision.js',
    'public/gamefile/Engine/physics.js',
    'public/gamefile/Engine/camera.js',
    'public/gamefile/Engine/frustumCulling.js',

    // --- Environment ---
    'public/gamefile/Environment/surface.js',
    'public/gamefile/Environment/tree.js',
    'public/gamefile/Environment/Grass.js',
    'public/gamefile/Environment/cave.js',
    'public/gamefile/Environment/water.js',
    'public/gamefile/Environment/ore.js',
    'public/gamefile/Environment/Clouds3D.js',
    'public/gamefile/Environment/UnderwaterPlants.js',

    // --- Gameplay Modules ---
    'public/gamefile/gameplay/compass.js',

    // --- Items ---
    'public/gamefile/items/collectibles.js',
    'public/gamefile/items/registry.js',
    'public/gamefile/items/rock.js',
    'public/gamefile/items/planet_core.js',
    'public/gamefile/items/branch.js',
    'public/gamefile/items/arrow.js',
    'public/gamefile/items/log.js',
    'public/gamefile/items/stone_floor.js',
    'public/gamefile/items/wood_floor.js',
    'public/gamefile/items/wood_stairs.js',
    'public/gamefile/items/wood_wall.js',
    'public/gamefile/items/wood_door.js',
    'public/gamefile/items/meganeura_item.js',
    'public/gamefile/items/wood_chest.js',
    'public/gamefile/items/campfire.js',
    'public/gamefile/items/wood_boat.js',
    'public/gamefile/items/axe.js',
    'public/gamefile/items/pickaxe.js',
    'public/gamefile/items/shovel.js',
    'public/gamefile/items/robot_parts.js',
    'public/gamefile/items/fried_bug.js',

    // --- NPCs ---
    'public/gamefile/npcs/registry.js',
    'public/gamefile/npcs/meganeura.js',
    'public/gamefile/npcs/georgiacetus.js',
    'public/gamefile/npcs/human.js',
    'public/gamefile/npcs/npc.js',

    // --- Gameplay Core & System ---
    'public/gamefile/gameplay/inventory.js',
    'public/gamefile/gameplay/player.js',
    'public/gamefile/Engine/shaders.js',
    'public/gamefile/Engine/renderer.js',
    'public/gamefile/gameplay/ui.js',
    'public/devtool.js',
    'public/gamefile/gameplay/savesplyer_not_Developer.js',
    'public/gamefile/gameplay/Start.js'
  ];

  scripts.forEach(src => document.write(`<script src="${src}"><\/script>`));
})();
