(function() {
  document.write('<link rel="stylesheet" href="style.css">');

  const scripts = [
    // --- UI Layout & Settings ---
    'gamefile/Language.js',
    'gamefile/ui-layout.js',
    'gamefile/gameplay/settings.js',

    // --- Audio System ---
    'gamefile/audio/audio.js',
    'gamefile/audio/wooden_wheels_sound.js',

    // --- Core Engine & Utilities ---
    'gamefile/Engine/utils.js',
    'gamefile/Engine/SpacesMap.js',
    'gamefile/Engine/terrain.js',
    'gamefile/Engine/debugLog.js',
    'gamefile/Engine/collision.js',
    'gamefile/Engine/physics.js',
    'gamefile/Engine/camera.js',
    'gamefile/Engine/frustumCulling.js',
    'gamefile/Engine/world_3d_ui.js',

    // --- Environment ---
    'gamefile/Environment/surface.js',
    'gamefile/Environment/tree.js',
    'gamefile/Environment/Grass.js',
    'gamefile/Environment/cave.js',
    'gamefile/Environment/water.js',
    'gamefile/Environment/ore.js',
    'gamefile/Environment/Clouds3D.js',
    'gamefile/Environment/UnderwaterPlants.js',

    // --- Gameplay Modules ---
    'gamefile/gameplay/compass.js',

    // --- Items ---
    'gamefile/items/collectibles.js',
    'gamefile/items/registry.js',
    'gamefile/items/rock.js',
    'gamefile/items/planet_core.js',
    'gamefile/items/branch.js',
    'gamefile/items/arrow.js',
    'gamefile/items/log.js',
    'gamefile/items/stone_floor.js',
    'gamefile/items/wood_floor.js',
    'gamefile/items/wood_stairs.js',
    'gamefile/items/wood_wall.js',
    'gamefile/items/wood_door.js',
    'gamefile/items/wood_roof.js',
    'gamefile/items/meganeura_item.js',
    'gamefile/items/isopod_item.js',
    'gamefile/items/wood_chest.js',
    'gamefile/items/campfire.js',
    'gamefile/items/wood_boat.js',
    'gamefile/items/wood_wheel.js',
    'gamefile/items/electric_engine.js',
    'gamefile/items/axe.js',
    'gamefile/items/pickaxe.js',
    'gamefile/items/shovel.js',
    'gamefile/items/robot_parts.js',
    'gamefile/items/robot_stand.js',
    'gamefile/items/fried_bug.js',

    // --- NPCs ---
    'gamefile/gameplay/hairstyles.js',
    'gamefile/npcs/registry.js',
    'gamefile/npcs/meganeura.js',
    'gamefile/npcs/georgiacetus.js',
    'gamefile/npcs/placoderm.js',
    'gamefile/npcs/isopod.js',
    'gamefile/npcs/human.js',
    'gamefile/npcs/npc.js',

    // --- Gameplay Core & System ---
    'gamefile/gameplay/inventory.js',
    'gamefile/gameplay/player.js',
    'gamefile/Engine/shaders.js',
    'gamefile/Engine/renderer.js',
    'gamefile/gameplay/ui.js',
    'devgame.js',
    'gamefile/gameplay/savesplyer_not_Developer.js',
    'gamefile/gameplay/Start.js'
  ];

  scripts.forEach(src => document.write(`<script src="${src}"><\/script>`));
})();
