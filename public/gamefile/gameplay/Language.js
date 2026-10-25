// === SEEDPLANET MODULE: JS/I18N.JS ===

(function() {
  const DICTIONARY = {
    th: {
      // General & Common
      app_title: "SeedPlanet",
      back: "ย้อนกลับ",
      cancel: "ยกเลิก",
      confirm: "ยืนยัน",
      delete: "ลบ",
      delete_save: "ลบเซฟ",
      confirm_delete: "ยืนยันลบ?",
      on: "เปิด",
      off: "ปิด",
      low: "ต่ำ",
      medium: "ปานกลาง",
      high: "สูง",
      ultra: "อัลตร้า",
      loading: "กำลังโหลด...",

      // Start Screen
      start_game: "เริ่มเล่น",
      settings: "ตั้งค่า",
      dev_mode: "โหมดผู้พัฒนา",
      donate: "สนับสนุน",

      // Save Slots
      select_save_slot: "📂 เลือกข้อมูลเซฟ",
      save_slot_n: "เซฟช่องที่ {n}",
      slot_empty: "[ ว่าง / เกมใหม่ ]",
      slot_loaded: "[ มีข้อมูลเซฟ ]",
      slot_empty_desc: "สร้างดวงดาวใหม่ด้วยขนาดและข้อมูลเริ่มต้น",
      slot_loaded_desc: "ขนาด: {size} | Seed: {seed} | หิน: {rock}, กิ่งไม้: {branch}",
      delete_save: "ลบเซฟ",
      confirm_delete: "ยืนยันลบ?",

      // Tabs & HUD Headers
      tab_crafting: "คราฟต์ไอเทม",
      tab_inventory: "กระเป๋าเก็บของ",
      tab_items_list: "รายการไอเทม",
      tab_settings: "ตั้งค่า",
      tab_cooking: "ทำอาหาร",
      actions_label: "⚡ แอคชั่น",
      open_inventory: "เปิดกระเป๋า",
      close_inventory: "ปิดกระเป๋า",
      demolish_active_title: "ปิดโหมดรื้อถอน (คลิกเพื่อปิด)",
      demolish_mode_title: "โหมดรื้อถอน",
      demolish_prompt_hold: "กด {action} ค้าง เพื่อรื้อถอน {item}",
      demolish_prompt_click: "กด {action} เพื่อรื้อถอน {item}",
      demolish_distance: "ระยะห่าง: {dist}m",
      prompt_open_chest: "กด [{button}] ค้าง เพื่อเปิด{item}",
      prompt_cook: "กด [{button}] ค้าง เพื่อทำอาหาร",
      touch_demolish: "รื้อถอน",
      toggle_fullscreen: "เปิด/ปิด เต็มจอ",
      fps_counter: "FPS: ",

      // Settings Modal
      language_label: "ภาษา (Language)",
      lang_th: "ภาษาไทย",
      lang_en: "English",
      lang_ja: "ภาษาญี่ปุ่น",
      lang_sd: "ภาษาซีเดียน (Seedian)",
      sfx_volume: "ระดับเสียงรวม",
      render_scale: "สเกลความละเอียดเรนเดอร์",
      fps_limit: "จำกัดเฟรมเรต",
      mouse_sensitivity: "ความไวเมาส์",
      rstick_sensitivity: "ความไวอนาล็อกขวา (RS)",
      screen_mode: "โหมดแสดงผล",
      mode_windowed: "โหมดหน้าต่าง",
      mode_fullscreen: "เต็มจอ",
      fps_display_toggle: "แสดงตัวนับ FPS",
      shadow_quality: "คุณภาพเงา",
      fxaa_label: "FXAA (ลดรอยหยัก)",
      fxaa_sub: "(ลดรอยหยักขอบภาพ)",
      taau_label: "FXAA (ลดรอยหยัก)",
      taau_sub: "(ลดรอยหยักขอบภาพ)",
      key_bindings: "ตั้งค่าปุ่มควบคุม",
      gamepad_bindings: "ตั้งค่าปุ่มจอย (Gamepad)",
      restore_defaults: "คืนค่าเริ่มต้น",
      defaults_restored: "🔄 คืนค่าเริ่มต้นเรียบร้อยแล้ว!",
      main_menu: "กลับไปหน้าเริ่มเกม",

      // Bottom Inventory Buttons
      bottom_btn_action: "⚡ แอคชั่น UI",
      bottom_btn_split: "แบ่งจำนวนไอเทม",
      bottom_btn_destroy: "ทำลายไอเทม",

      // Key Bindings
      key_move: "เดิน / เคลื่อนที่",
      key_camera: "หมุนมุมกล้อง",
      key_attack: "โจมตี / ใช้อาวุธ / วางของ",
      key_terrainMod: "ขุดดิน / ถมดิน",
      key_flightThrottle: "เรือติดปีก: เร่งเครื่อง",
      key_flightPitch: "เรือติดปีก: บินขึ้น / บินลง",
      key_interact: "สำรวจ / เก็บของ / ขี่",
      key_rotate: "หมุนโครงสร้าง / ว่ายขึ้น",
      key_jump: "กระโดด",
      key_cancel: "ยกเลิก / ปิดเมนู",
      key_demolish: "แอคชั่นด่วน / รื้อถอน",
      key_bottomShortcut: "ลัดไป 3 ปุ่มล่างในกระเป๋า",
      key_inventory: "กระเป๋า / เมนู",
      key_action1: "ช่องแอคชั่น 1",
      key_action2: "ช่องแอคชั่น 2",
      key_action3: "ช่องแอคชั่น 3",
      key_action4: "ช่องแอคชั่น 4",
      key_sprint: "วิ่งเร็ว / บูสต์",
      key_resetCam: "รีเซ็ตมุมกล้อง",
      key_forward: "เดินหน้า",
      key_backward: "ถอยหลัง",
      key_left: "เดินซ้าย",
      key_right: "เดินขวา",
      key_diveDown: "ดำน้ำลง",
      key_diveUp: "ว่ายน้ำขึ้น",
      key_toggleMouse: "ซ่อน/แสดง เมาส์จำลอง",
      key_press_key: "กดปุ่ม...",

      // Chest Overlay
      chest_storage: "กล่องเก็บของ",
      chest_take_all: "เก็บทั้งหมด",
      your_inventory: "กระเป๋าเดินทาง",

      // Crafting & Cooking
      craft_button: "คราฟต์",
      cook_button: "ปรุงอาหาร",
      required_ingredients: "วัตถุดิบที่ต้องการ:",
      insufficient_materials: "วัตถุดิบไม่พอ",

      // Confirm Modals
      destroy_item: "ทำลายไอเทม?",
      hold_delete: "กดค้างเพื่อทำลาย",
      antialias_title: "ลดรอยหยัก เปิด-ปิด",
      antialias_sub: "(ต้องการรีโหลดเกม)",
      confirm_reload: "ตกลง (รีโหลด)",
      kill_npc: "กำจัด NPC",
      unconscious_title: "หมดสติ...",

      // Items
      item_ROCK: "หิน",
      item_BIG_ROCK: "หินใหญ่",
      item_IRON_ORE: "แร่เหล็ก",
      item_GOLD_ORE: "แร่ทองคำ",
      item_GLOW_ORE: "แร่หินเรืองแสง",
      item_GLOW_BATTERY: "หินเรืองแสงอัดแท่ง(แบต)",
      item_GLOW_BATTERY_EMPTY: "แบตเตอรี่เรืองแสง(หมดพลังงาน)",
      item_BRANCH: "กิ่งไม้",
      item_AXE: "ขวาน",
      item_PICKAXE: "อีเตอร์",
      item_LOG: "ท่อนไม้",
      item_BOW: "ธนู",
      item_ARROW: "ลูกธนู",
      item_IRON_BULLET: "กระสุนเหล็ก ทรงกลม",
      item_WOODEN_ARM_CANNON: "ปืนไม้ติดแขน",
      item_ARM_CANNON: "ปืนไม้ติดแขน",
      item_WOOD_FLOOR: "พื้นไม้",
      item_THIN_WOOD_FLOOR: "พื้นไม้บาง",
      item_STONE_FLOOR: "พื้นหิน",
      item_WOOD_STAIRS: "บันไดไม้",
      item_FOLDING_LADDER: "บันไดพับ",
      item_CAMPFIRE: "กองไฟ",
      item_WOOD_BOAT: "เรือไม้",
      item_WOOD_WHEEL: "ล้อไม้",
      item_BOAT_WING: "ปีกเรือ (Boat Wing)",
      item_ELECTRIC_ENGINE: "เครื่องยนต์ไฟฟ้า",
      item_WOOD_WALL: "กำแพงไม้",
      item_WOOD_WINDOW: "หน้าต่างไม้",
      item_WOOD_DOOR: "ประตูไม้",
      item_WOOD_ROOF: "หลังคาไม้",
      item_WOOD_CHEST: "กล่องไม้",
      item_WOOD_BED: "เตียงไม้พร้อมฟูก",
      item_WOOD_TABLE: "โต๊ะไม้",
      item_WOOD_CHAIR: "เก้าอี้ไม้",
      item_MEGANEURA: "แมลงปอยักษ์",
      item_ISOPOD: "ไอโซพอด",
      item_FRIED_BUG: "แมลงทอด",
      item_DRAGON_FRUIT: "แก้วมังกร",
      item_SHOVEL: "พลั่ว",
      item_ROBOT_STAND: "แท่นประกอบหุ่นยนต์",
      item_ROBOT_COCKPIT: "ห้องคนขับหุ่นยนต์",
      item_ROBOT_LEFT_ARM: "แขนซ้ายหุ่นยนต์",
      item_ROBOT_RIGHT_ARM: "แขนขวาหุ่นยนต์",
      item_ROBOT_LEFT_LEG: "ขาซ้ายหุ่นยนต์",
      item_ROBOT_RIGHT_LEG: "ขาขวาหุ่นยนต์",
      item_PLANET_CORE: "แกนกลางดวงดาว",
      item_OBSIDIAN_CUBE: "ศิลาออบซิเดียน",
      item_OBSIDIAN_PAD_WARP: "แท่นวาร์ปออบซิเดียน",
      item_OBSIDIAN_FLUX: "ออบซิเดียนฟลักซ์ (Obsidian Flux)",
      warp_ui_title: "Obsidian Flux",
      warp_pad_prefix: "แท่นวาร์ป #",
      no_warp_pads_notice: "🚫 ยังไม่มีแท่นวาร์ป (Obsidian Pad) ที่วางไว้บนดาวดวงนี้!",
      max_warp_pads_notice: "🚫 วาง Obsidian Pad ได้สูงสุดไม่เกิน 5 อัน! (Max 5 Obsidian Pads)",

      // Mech Stand System
      robot_stand_title: "ระบบฐานตั้งหุ่นยนต์ (ROBOT STAND)",
      mech_stand_title: "ระบบฐานตั้งหุ่นยนต์ (ROBOT STAND)",
      mech_slot_equipped: "✔ ประกอบแล้ว",
      mech_slot_empty: "✚ ว่าง",
      mech_slot_empty_title: "ช่องว่าง (คลิกเพื่อประกอบชิ้นส่วน)",
      mech_slot_dismantle_title: "คลิกเพื่อถอด {part}",
      mech_part_cockpit: "ห้องนักบิน",
      mech_part_left_arm: "แขนซ้าย",
      mech_part_right_arm: "แขนขวา",
      mech_part_left_leg: "ขาซ้าย",
      mech_part_right_leg: "ขาขวา",
      mech_part_stand: "ฐานตั้ง",
      mech_part_core: "คอร์พลังงาน",
      mech_part_module: "โมดูลเสริม",
      mech_part_generic: "ชิ้นส่วนหุ่นยนต์",
      mech_cannot_remove_stand: "ไม่สามารถถอดฐานตั้งขณะใช้งาน UI ได้!",
      mech_dismantle_success: "ถอด {part} เรียบร้อย!",
      mech_inventory_full: "กระเป๋าเต็ม! ไม่สามารถถอดได้",
      mech_require_cockpit: "ต้องประกอบห้องนักบิน (Cockpit) ก่อนประกอบแขนหรือขา!",
      mech_no_parts_to_equip: "ไม่มีชิ้นส่วนใหม่ที่สามารถประกอบได้!",
      mech_equip_success: "ประกอบ {part} สำเร็จ!",
      mech_missing_parts_warn: "⚠️ หุ่นยังประกอบไม่ครบ (ขาด: {missing}) — วางชิ้นส่วนใส่หุ่นยนต์ให้ครบ 4 ชิ้นก่อนจึงจะขับได้",
      mech_need_4_parts: "⚠️ ต้องประกอบชิ้นส่วนหุ่นยนต์ให้ครบ 4 ชิ้น (ขาซ้าย, ขาขวา, แขนซ้าย, แขนขวา) ก่อนจึงจะขับได้!",
      mech_docked_notice: "⚙️ กลับเข้าสู่โหมดประกอบกับฐานตั้งแล้ว",

      // Settings & Toggles
      binding_keyboard: "คีย์บอร์ด",
      binding_gamepad: "จอยสติ๊ก",
      touch_fly: "เร่งเครื่อง",
      touch_swim_up: "ว่ายขึ้น",
      touch_rotate: "หมุน",
      touch_swim_down: "ดำน้ำ",
      touch_interact: "สำรวจ / ขี่",
      touch_dig_fill: "ขุด-ถม",
      touch_attack_use: "โจมตี / ใช้",
      input_touch: "โหมดอินพุต: จอสัมผัส (Touch)",
      input_keyboard: "โหมดอินพุต: คีย์บอร์ด/เมาส์ (Keyboard/Mouse)",
      input_auto: "โหมดอินพุต: อัตโนมัติ (Auto)",
      toggle_hitboxes: "แสดงโครงสร้างการชน (Show Hitboxes)",
      frustum_culling: "Frustum Culling (คัดออกวัตถุนอกจอ)",
      cave_water: "น้ำในถ้ำ (Cave Water)",
      action_reach: "แสดงวงระยะทำการ",
      water: "ระบบน้ำ",
      render_dist_limit: "จำกัดระยะเรนเดอร์",
      atmosphere: "บรรยากาศ",
      god_rays: "ลำแสงเทวทูต (God Rays)",
      space_sky: "ท้องฟ้าอวกาศ",
      clouds: "เมฆกลุ่มก๊าซ",
      ragdoll_mode: "โหมด Ragdoll",
      grass_toggle: "หญ้า",

      // Dynamic Notices
      craft_success: "คราฟต์สำเร็จ",
      cook_success: "ปรุงสำเร็จ",
      summon_success: "เสกสำเร็จ: ได้รับ",
      inventory_full: "กระเป๋าเต็มแล้ว!",
      chest_full: "กล่องเต็มแล้ว!"
    },
    en: {
      // General & Common
      app_title: "SeedPlanet",
      back: "Back",
      cancel: "Cancel",
      confirm: "Confirm",
      delete: "Delete",
      delete_save: "Delete Save",
      confirm_delete: "Confirm Delete?",
      on: "On",
      off: "Off",
      low: "Low",
      medium: "Medium",
      high: "High",
      ultra: "Ultra",
      loading: "Loading...",

      // Start Screen
      start_game: "Start Game",
      settings: "Settings",
      dev_mode: "Dev Mode",
      donate: "Donate",

      // Save Slots
      select_save_slot: "📂 Select Save Slot",
      save_slot_n: "Save Slot {n}",
      slot_empty: "[ Empty / New Game ]",
      slot_loaded: "[ Saved Game ]",
      slot_empty_desc: "Create a new planet with default settings",
      slot_loaded_desc: "Size: {size} | Seed: {seed} | Rock: {rock}, Branch: {branch}",
      delete_save: "Delete Save",
      confirm_delete: "Confirm Delete?",

      // Tabs & HUD Headers
      tab_crafting: "CRAFTING",
      tab_inventory: "INVENTORY",
      tab_items_list: "ITEMS LIST",
      tab_settings: "SETTINGS",
      tab_cooking: "COOKING",
      actions_label: "⚡ ACTIONS",
      open_inventory: "Open Inventory",
      close_inventory: "Close Inventory",
      demolish_active_title: "Demolish Mode Active (Click to Close)",
      demolish_mode_title: "DEMOLISH MODE",
      demolish_prompt_hold: "Hold {action} to demolish {item}",
      demolish_prompt_click: "Press {action} to demolish {item}",
      demolish_distance: "Distance: {dist}m",
      prompt_open_chest: "Hold [{button}] to open {item}",
      prompt_cook: "Hold [{button}] to cook",
      touch_demolish: "Demolish",
      toggle_fullscreen: "Toggle Fullscreen",
      fps_counter: "FPS: ",

      // Settings Modal
      language_label: "Language",
      lang_th: "Thai",
      lang_en: "English",
      lang_ja: "Japanese",
      lang_sd: "Seedian",
      sfx_volume: "Master SFX Volume",
      render_scale: "Render Scale",
      fps_limit: "FPS Limit",
      mouse_sensitivity: "Mouse Sensitivity",
      rstick_sensitivity: "Right Stick Sensitivity (RS)",
      screen_mode: "Screen Mode",
      mode_windowed: "Windowed",
      mode_fullscreen: "Fullscreen",
      fps_display_toggle: "FPS Counter",
      shadow_quality: "Shadow Quality",
      fxaa_label: "FXAA (Anti-Aliasing)",
      fxaa_sub: "(Smooth Jagged Edges)",
      taau_label: "FXAA (Anti-Aliasing)",
      taau_sub: "(Smooth Jagged Edges)",
      key_bindings: "Key Bindings",
      gamepad_bindings: "Gamepad Bindings",
      restore_defaults: "Restore Defaults",
      defaults_restored: "🔄 Defaults Restored!",
      main_menu: "Return to Main Menu",

      // Bottom Inventory Buttons
      bottom_btn_action: "⚡ ACTION UI",
      bottom_btn_split: "SPLIT STACK",
      bottom_btn_destroy: "DESTROY ITEM",

      // Key Bindings
      key_move: "Move",
      key_camera: "Camera Look",
      key_attack: "Attack / Place",
      key_terrainMod: "Dig / Fill Terrain",
      key_flightThrottle: "Flight Throttle",
      key_flightPitch: "Flight Pitch",
      key_interact: "Interact / Ride",
      key_rotate: "Rotate / Swim Up",
      key_jump: "Jump",
      key_cancel: "Cancel / Close Menu",
      key_demolish: "Quick Action / Demolish",
      key_bottomShortcut: "Bottom Shortcut",
      key_inventory: "Inventory / Menu",
      key_action1: "Action Slot 1",
      key_action2: "Action Slot 2",
      key_action3: "Action Slot 3",
      key_action4: "Action Slot 4",
      key_sprint: "Sprint / Boost",
      key_resetCam: "Center Camera View",
      key_forward: "Move Forward",
      key_backward: "Move Backward",
      key_left: "Move Left",
      key_right: "Move Right",
      key_diveDown: "Dive Down",
      key_diveUp: "Swim Up",
      key_toggleMouse: "Toggle Virtual Cursor",
      key_press_key: "Press key...",

      // Chest Overlay
      chest_storage: "CHEST STORAGE",
      chest_take_all: "Take All",
      your_inventory: "YOUR INVENTORY",

      // Crafting & Cooking
      craft_button: "Craft",
      cook_button: "Cook",
      required_ingredients: "Required Ingredients:",
      insufficient_materials: "Insufficient Materials",

      // Confirm Modals
      destroy_item: "DESTROY ITEM?",
      hold_delete: "HOLD TO DELETE",
      antialias_title: "ANTI-ALIASING ON/OFF",
      antialias_sub: "(Requires Reload)",
      confirm_reload: "RELOAD",
      kill_npc: "Kill NPC",
      unconscious_title: "Unconscious...",

      // Items
      item_ROCK: "Rock",
      item_BIG_ROCK: "Big Rock",
      item_IRON_ORE: "Iron Ore",
      item_GOLD_ORE: "Gold Ore",
      item_GLOW_ORE: "Glowing Ore",
      item_GLOW_BATTERY: "Glowing Battery Rod",
      item_GLOW_BATTERY_EMPTY: "Empty Glowing Battery",
      item_BRANCH: "Branch",
      item_AXE: "Axe",
      item_PICKAXE: "Pickaxe",
      item_LOG: "Wood Log",
      item_BOW: "Bow",
      item_ARROW: "Arrow",
      item_IRON_BULLET: "Spherical Iron Bullet",
      item_WOODEN_ARM_CANNON: "Wooden Arm Cannon",
      item_ARM_CANNON: "Wooden Arm Cannon",
      item_WOOD_FLOOR: "Wood Floor",
      item_THIN_WOOD_FLOOR: "Thin Wood Floor",
      item_STONE_FLOOR: "Stone Floor",
      item_WOOD_STAIRS: "Wood Stairs",
      item_FOLDING_LADDER: "Folding Ladder",
      item_CAMPFIRE: "Campfire",
      item_WOOD_BOAT: "Wood Boat",
      item_WOOD_WHEEL: "Wooden Wheel",
      item_BOAT_WING: "Boat Wing",
      item_ELECTRIC_ENGINE: "Electric Engine",
      item_WOOD_WALL: "Wood Wall",
      item_WOOD_WINDOW: "Wood Window",
      item_WOOD_DOOR: "Wood Door",
      item_WOOD_ROOF: "Wooden Roof",
      item_WOOD_CHEST: "Wooden Chest",
      item_WOOD_BED: "Wooden Bed with Mattress",
      item_WOOD_TABLE: "Wooden Table",
      item_WOOD_CHAIR: "Wooden Chair",
      item_MEGANEURA: "Meganeura",
      item_ISOPOD: "Giant Isopod",
      item_FRIED_BUG: "Fried Bug",
      item_DRAGON_FRUIT: "Dragon Fruit",
      item_SHOVEL: "Shovel",
      item_ROBOT_STAND: "Robot Stand",
      item_ROBOT_COCKPIT: "Robot Cockpit",
      item_ROBOT_LEFT_ARM: "Robot Left Arm",
      item_ROBOT_RIGHT_ARM: "Robot Right Arm",
      item_ROBOT_LEFT_LEG: "Robot Left Leg",
      item_ROBOT_RIGHT_LEG: "Robot Right Leg",
      item_PLANET_CORE: "Planet Core",
      item_OBSIDIAN_CUBE: "Obsidian Cube",
      item_OBSIDIAN_PAD_WARP: "OBSIDIAN PAD Warp",
      item_OBSIDIAN_FLUX: "Obsidian Flux",
      warp_ui_title: "Obsidian Flux",
      warp_pad_prefix: "OBSIDIAN PAD #",
      no_warp_pads_notice: "🚫 No Obsidian Pads placed on this planet yet!",
      max_warp_pads_notice: "🚫 Cannot place more than 5 Obsidian Pads! (Max 5)",

      // Mech Stand System
      robot_stand_title: "ROBOT STAND SYSTEM",
      mech_stand_title: "ROBOT STAND SYSTEM",
      mech_slot_equipped: "✔ EQUIPPED",
      mech_slot_empty: "✚ EMPTY",
      mech_slot_empty_title: "Empty Slot (Click to Equip Part)",
      mech_slot_dismantle_title: "Click to dismantle {part}",
      mech_part_cockpit: "Cockpit",
      mech_part_left_arm: "Left Arm",
      mech_part_right_arm: "Right Arm",
      mech_part_left_leg: "Left Leg",
      mech_part_right_leg: "Right Leg",
      mech_part_stand: "Stand",
      mech_part_core: "Power Core",
      mech_part_module: "Module",
      mech_part_generic: "Robot Part",
      mech_cannot_remove_stand: "Cannot remove stand while active!",
      mech_dismantle_success: "Dismantled {part} successfully!",
      mech_inventory_full: "Inventory full! Cannot dismantle",
      mech_require_cockpit: "Must equip Cockpit before arms or legs!",
      mech_no_parts_to_equip: "No new parts to equip!",
      mech_equip_success: "Equipped {part} successfully!",
      mech_missing_parts_warn: "⚠️ Mech incomplete (Missing: {missing}) — Assemble all 4 parts before piloting",
      mech_need_4_parts: "⚠️ Must assemble all 4 parts (Left Leg, Right Leg, Left Arm, Right Arm) before piloting!",
      mech_docked_notice: "⚙️ Docked to Robot Stand",

      // Settings & Toggles
      binding_keyboard: "Keyboard",
      binding_gamepad: "Gamepad",
      touch_fly: "Fly / Throttle",
      touch_swim_up: "Swim Up",
      touch_rotate: "Rotate",
      touch_swim_down: "Swim Down",
      touch_interact: "Interact / Ride",
      touch_dig_fill: "Dig / Fill",
      touch_attack_use: "Attack / Use",
      input_touch: "Input Mode: Touch",
      input_keyboard: "Input Mode: Keyboard/Mouse",
      input_auto: "Input Mode: Auto",
      toggle_hitboxes: "Show Hitboxes",
      frustum_culling: "Frustum Culling",
      cave_water: "Cave Water",
      action_reach: "Show Action Reach",
      water: "Water",
      render_dist_limit: "Render Distance Limit",
      atmosphere: "Atmosphere",
      god_rays: "God Rays",
      space_sky: "Space Sky",
      clouds: "Clouds",
      ragdoll_mode: "Ragdoll Mode",
      grass_toggle: "Grass",

      // Dynamic Notices
      craft_success: "Crafted Successfully",
      cook_success: "Cooked Successfully",
      summon_success: "Spawned: Received",
      inventory_full: "Inventory Full!",
      chest_full: "Chest Full!"
    },

    ja: {
      // General & Common
      app_title: "SeedPlanet",
      back: "戻る",
      cancel: "キャンセル",
      confirm: "確定",
      delete: "削除",
      delete_save: "セーブ削除",
      confirm_delete: "本当に削除しますか？",
      on: "オン",
      off: "オフ",
      low: "低",
      medium: "中",
      high: "高",
      ultra: "ウルトラ",
      loading: "読み込み中...",

      // Start Screen
      start_game: "ゲーム開始",
      settings: "設定",
      dev_mode: "開発者モード",
      donate: "支援・寄付",

      // Save Slots
      select_save_slot: "📂 セーブデータ選択",
      save_slot_n: "スロット {n}",
      slot_empty: "[ 空き / 新規作成 ]",
      slot_loaded: "[ セーブデータあり ]",
      slot_empty_desc: "初期設定で新しい惑星を作成します",
      slot_loaded_desc: "サイズ: {size} | シード: {seed} | 岩: {rock}, 枝: {branch}",
      delete_save: "セーブ削除",
      confirm_delete: "削除しますか？",

      // Tabs & HUD Headers
      tab_crafting: "クラフト",
      tab_inventory: "インベントリ",
      tab_items_list: "アイテム一覧",
      tab_settings: "設定",
      tab_cooking: "料理",
      actions_label: "⚡ アクション",
      open_inventory: "インベントリを開く",
      close_inventory: "インベントリを閉じる",
      demolish_active_title: "解体モード（クリックで終了）",
      demolish_mode_title: "解体モード",
      demolish_prompt_hold: "{action} 長押しで {item} を解体",
      demolish_prompt_click: "{action} で {item} を解体",
      demolish_distance: "距離: {dist}m",
      prompt_open_chest: "[{button}] 長押しで {item} を開く",
      prompt_cook: "[{button}] 長押しで調理する",
      touch_demolish: "解体",
      toggle_fullscreen: "全画面切り替え",
      fps_counter: "FPS: ",

      // Settings Modal
      language_label: "言語 (Language)",
      lang_th: "タイ語",
      lang_en: "英語",
      lang_ja: "日本語",
      lang_sd: "シーディアン語",
      sfx_volume: "効果音音量",
      render_scale: "描画スケール",
      fps_limit: "フレームレート制限",
      mouse_sensitivity: "マウス感度",
      rstick_sensitivity: "右スティック感度 (RS)",
      screen_mode: "画面モード",
      mode_windowed: "ウィンドウ",
      mode_fullscreen: "フルスクリーン",
      fps_display_toggle: "FPS表示",
      shadow_quality: "影の品質",
      fxaa_label: "FXAA (アンチエイリアス)",
      fxaa_sub: "(輪郭のギザギザを軽減)",
      taau_label: "FXAA (アンチエイリアス)",
      taau_sub: "(輪郭のギザギザを軽減)",
      key_bindings: "キー配置設定",
      gamepad_bindings: "ゲームパッド設定",
      restore_defaults: "初期設定に戻す",
      defaults_restored: "🔄 初期設定を復元しました！",
      main_menu: "メインメニューに戻る",

      // Bottom Inventory Buttons
      bottom_btn_action: "⚡ アクションUI",
      bottom_btn_split: "スタック分割",
      bottom_btn_destroy: "アイテム破棄",

      // Key Bindings
      key_move: "移動",
      key_camera: "カメラ操作",
      key_attack: "攻撃 / 配置",
      key_terrainMod: "地形採掘 / 補正",
      key_flightThrottle: "飛行加速",
      key_flightPitch: "飛行ピッチ角",
      key_interact: "調べる / 乗る",
      key_rotate: "回転 / 浮上",
      key_jump: "ジャンプ",
      key_cancel: "キャンセル / 閉じる",
      key_demolish: "クイックアクション / 解体",
      key_bottomShortcut: "下部ショートカット",
      key_inventory: "インベントリ / メニュー",
      key_action1: "アクションスロット 1",
      key_action2: "アクションスロット 2",
      key_action3: "アクションスロット 3",
      key_action4: "アクションスロット 4",
      key_sprint: "ダッシュ / ブースト",
      key_resetCam: "カメラリセット",
      key_forward: "前進",
      key_backward: "後退",
      key_left: "左移動",
      key_right: "右移動",
      key_diveDown: "潜水",
      key_diveUp: "浮上",
      key_toggleMouse: "カーソル表示切り替え",
      key_press_key: "キーを押してください...",

      // Chest Overlay
      chest_storage: "チェスト収納",
      chest_take_all: "すべて取る",
      your_inventory: "所持インベントリ",

      // Crafting & Cooking
      craft_button: "クラフト",
      cook_button: "調理",
      required_ingredients: "必要素材:",
      insufficient_materials: "素材不足",

      // Confirm Modals
      destroy_item: "アイテムを破棄しますか？",
      hold_delete: "長押しで削除",
      antialias_title: "アンチエイリアス オン/オフ",
      antialias_sub: "(再読み込みが必要)",
      confirm_reload: "再読み込み",
      kill_npc: "NPCを倒す",
      unconscious_title: "気絶中...",

      // Items
      item_ROCK: "小石",
      item_BIG_ROCK: "大きな岩",
      item_IRON_ORE: "鉄鉱石",
      item_GOLD_ORE: "金鉱石",
      item_GLOW_ORE: "発光鉱石",
      item_GLOW_BATTERY: "発光バッテリーロッド",
      item_GLOW_BATTERY_EMPTY: "空の発光バッテリー",
      item_BRANCH: "木の枝",
      item_AXE: "斧",
      item_PICKAXE: "ツルハシ",
      item_LOG: "丸太",
      item_BOW: "弓",
      item_ARROW: "矢",
      item_IRON_BULLET: "鉄の丸弾",
      item_WOODEN_ARM_CANNON: "木製アームキャノン",
      item_ARM_CANNON: "木製アームキャノン",
      item_WOOD_FLOOR: "木の床",
      item_THIN_WOOD_FLOOR: "薄い木の床",
      item_STONE_FLOOR: "石の床",
      item_WOOD_STAIRS: "木の階段",
      item_FOLDING_LADDER: "折りたたみハシゴ",
      item_CAMPFIRE: "焚き火",
      item_WOOD_BOAT: "木製ボート",
      item_WOOD_WHEEL: "木製車輪",
      item_BOAT_WING: "ボートの翼",
      item_ELECTRIC_ENGINE: "電動エンジン",
      item_WOOD_WALL: "木の壁",
      item_WOOD_WINDOW: "木の窓",
      item_WOOD_DOOR: "木のドア",
      item_WOOD_ROOF: "木の屋根",
      item_WOOD_CHEST: "木製チェスト",
      item_WOOD_BED: "マットレス付き木製ベッド",
      item_WOOD_TABLE: "木製テーブル",
      item_WOOD_CHAIR: "木製椅子",
      item_MEGANEURA: "メガネウラ",
      item_ISOPOD: "ダイオウグソクムシ",
      item_FRIED_BUG: "昆虫の素揚げ",
      item_DRAGON_FRUIT: "ドラゴンフルーツ",
      item_SHOVEL: "スコップ",
      item_ROBOT_STAND: "ロボット台座",
      item_ROBOT_COCKPIT: "ロボットコクピット",
      item_ROBOT_LEFT_ARM: "ロボット左腕",
      item_ROBOT_RIGHT_ARM: "ロボット右腕",
      item_ROBOT_LEFT_LEG: "ロボット左脚",
      item_ROBOT_RIGHT_LEG: "ロボット右脚",
      item_PLANET_CORE: "惑星のコア",
      item_OBSIDIAN_CUBE: "黒曜石キューブ",
      item_OBSIDIAN_PAD_WARP: "黒曜石ワープパッド",
      item_OBSIDIAN_FLUX: "黒曜石フラックス",
      warp_ui_title: "黒曜石フラックス",
      warp_pad_prefix: "黒曜石パッド #",
      no_warp_pads_notice: "🚫 この惑星にはまだワープパッドが配置されていません！",
      max_warp_pads_notice: "🚫 ワープパッドは最大5個までしか配置できません！",

      // Mech Stand System
      robot_stand_title: "ロボット台座システム",
      mech_stand_title: "ロボット台座システム",
      mech_slot_equipped: "✔ 装着済み",
      mech_slot_empty: "✚ 未装着",
      mech_slot_empty_title: "空きスロット（クリックでパーツ装着）",
      mech_slot_dismantle_title: "クリックで {part} を取り外す",
      mech_part_cockpit: "コクピット",
      mech_part_left_arm: "左腕",
      mech_part_right_arm: "右腕",
      mech_part_left_leg: "左脚",
      mech_part_right_leg: "右脚",
      mech_part_stand: "台座",
      mech_part_core: "パワーコア",
      mech_part_module: "モジュール",
      mech_part_generic: "ロボットパーツ",
      mech_cannot_remove_stand: "起動中は台座を取り外せません！",
      mech_dismantle_success: "{part} を取り外しました！",
      mech_inventory_full: "インベントリがいっぱいです！取り外せません",
      mech_require_cockpit: "腕や脚の前にコクピットを装着してください！",
      mech_no_parts_to_equip: "装着できるパーツがありません！",
      mech_equip_success: "{part} を装着しました！",
      mech_missing_parts_warn: "⚠️ ロボット未完成（不足: {missing}） — 操縦前に4パーツすべて組み立ててください",
      mech_need_4_parts: "⚠️ 操縦前に4パーツ（左脚、右脚、左腕、右腕）すべてを組み立ててください！",
      mech_docked_notice: "⚙️ ロボット台座にドッキング中",

      // Settings & Toggles
      binding_keyboard: "キーボード",
      binding_gamepad: "ゲームパッド",
      touch_fly: "飛行 / 加速",
      touch_swim_up: "浮上",
      touch_rotate: "回転",
      touch_swim_down: "潜水",
      touch_interact: "調べる / 乗る",
      touch_dig_fill: "掘る / 埋める",
      touch_attack_use: "攻撃 / 使用",
      input_touch: "入力モード: タッチ",
      input_keyboard: "入力モード: キーボード/マウス",
      input_auto: "入力モード: 自動",
      toggle_hitboxes: "ヒットボックス表示",
      frustum_culling: "視界外描画カリング",
      cave_water: "洞窟の水面",
      action_reach: "アクション届く範囲を表示",
      water: "水面描画",
      render_dist_limit: "描画距離制限",
      atmosphere: "大気エフェクト",
      god_rays: "ゴッドレイ（光線）",
      space_sky: "宇宙の空",
      clouds: "雲",
      ragdoll_mode: "ラグドール物理",
      grass_toggle: "草の描画",

      // Dynamic Notices
      craft_success: "クラフト完了",
      cook_success: "調理完了",
      summon_success: "生成完了",
      inventory_full: "インベントリがいっぱいです！",
      chest_full: "チェストがいっぱいです！"
    }
  };

  // Build Seedian dictionary based on Thai text translated via Seedian Script
  DICTIONARY.seedian = {};
  if (typeof window !== "undefined") {
    const toSeedianFn = (text) => {
      if (window.Seedian && typeof window.Seedian.toSeedian === "function") {
        return window.Seedian.toSeedian(text);
      }
      return text;
    };
    for (const [k, v] of Object.entries(DICTIONARY.th)) {
      if (typeof v === "string") {
        DICTIONARY.seedian[k] = toSeedianFn(v);
      }
    }
    DICTIONARY.seedian.lang_th = "ภาษาไทย";
    DICTIONARY.seedian.lang_en = "English";
    DICTIONARY.seedian.lang_sd = toSeedianFn("ภาษาซีเดียน") + " (Seedian)";
  }

  let currentLang = "en";

  // Pre-load language from storage
  try {
    const savedOpts = localStorage.getItem("seedplanet_options_config");
    if (savedOpts) {
      const parsed = JSON.parse(savedOpts);
      if (parsed && (parsed.language === "th" || parsed.language === "en" || parsed.language === "seedian" || parsed.language === "ja")) {
        currentLang = parsed.language;
      }
    } else {
      const savedSettings = localStorage.getItem("seedplanet_settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed && (parsed.language === "th" || parsed.language === "en" || parsed.language === "seedian" || parsed.language === "ja")) {
          currentLang = parsed.language;
        }
      }
    }
  } catch (e) {
    console.error("I18N: Failed to read saved language:", e);
  }

  function getGameLanguage() {
    return currentLang;
  }

  function t(key, params) {
    // Lazy populate seedian if needed
    if (currentLang === "seedian" && (!DICTIONARY.seedian || Object.keys(DICTIONARY.seedian).length === 0)) {
      const toSeedianFn = (text) => {
        if (window.Seedian && typeof window.Seedian.toSeedian === "function") {
          return window.Seedian.toSeedian(text);
        }
        return text;
      };
      DICTIONARY.seedian = {};
      const sourceDict = DICTIONARY.th || DICTIONARY.en;
      for (const [k, v] of Object.entries(sourceDict)) {
        if (typeof v === "string") {
          DICTIONARY.seedian[k] = toSeedianFn(v);
        }
      }
      // Ensure keys from EN that might not be in TH are also translated
      if (DICTIONARY.en) {
        for (const [k, v] of Object.entries(DICTIONARY.en)) {
          if (!DICTIONARY.seedian[k] && typeof v === "string") {
            DICTIONARY.seedian[k] = toSeedianFn(v);
          }
        }
      }
      DICTIONARY.seedian.lang_th = "ภาษาไทย";
      DICTIONARY.seedian.lang_en = "English";
      DICTIONARY.seedian.lang_ja = "日本語";
      DICTIONARY.seedian.lang_sd = toSeedianFn("ภาษาซีเดียน") + " (Seedian)";
    }

    const dict = DICTIONARY[currentLang] || DICTIONARY.en;
    let text = dict[key] || (DICTIONARY.en && DICTIONARY.en[key]) || (DICTIONARY.th && DICTIONARY.th[key]) || key;
    if (params && typeof params === "object") {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      }
    }
    return text;
  }

  function getItemDisplayName(itemName, lang) {
    if (!itemName) return "";
    const curLang = lang || (typeof getGameLanguage === "function" ? getGameLanguage() : currentLang) || "en";
    if (typeof window.getItemDefinition === "function") {
      const def = window.getItemDefinition(itemName);
      if (def) {
        if (curLang === "th") return def.name_th || def.name_en;
        if (curLang === "ja") return def.name_ja || def.name_en || def.name_th;
        if (curLang === "seedian") {
          const baseName = def.name_th || def.name_en;
          return (window.Seedian && typeof window.Seedian.toSeedian === "function")
            ? window.Seedian.toSeedian(baseName)
            : baseName;
        }
        return def.name_en || def.name_th;
      }
    }
    const rawName = typeof itemName === "string" ? itemName : (itemName.name || itemName.type || "");
    const cleanKey = "item_" + String(rawName).toUpperCase();
    const translated = t(cleanKey);
    if (translated && translated !== cleanKey) {
      return translated;
    }
    const fallbackName = typeof itemName === "string" ? itemName : (itemName.label || itemName.name || "");
    if (curLang === "seedian" && window.Seedian && typeof window.Seedian.toSeedian === "function") {
      return window.Seedian.toSeedian(fallbackName);
    }
    return fallbackName;
  }

  function updateUILanguage() {
    if (typeof document !== "undefined" && document.body) {
      if (currentLang === "seedian") {
        document.body.classList.add("lang-seedian");
      } else {
        document.body.classList.remove("lang-seedian");
      }
    }

    // Clear cached seedian dictionary when language is updated
    if (DICTIONARY) {
      DICTIONARY.seedian = null;
    }

    // Update all text nodes with data-i18n attribute
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        const val = t(key);
        if (typeof val === "string" && (val.includes("<svg") || val.includes("<span") || currentLang === "seedian")) {
          el.innerHTML = val;
        } else {
          el.textContent = val;
        }
      }
    });

    // Update titles with data-i18n-title
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      if (key) {
        el.title = t(key);
      }
    });

    // Update placeholders with data-i18n-placeholder
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) {
        el.placeholder = t(key);
      }
    });

    // Update Language Buttons styling in Settings
    const langThBtn = document.getElementById("langThBtn");
    const langEnBtn = document.getElementById("langEnBtn");
    const langJaBtn = document.getElementById("langJaBtn");
    const langSdBtn = document.getElementById("langSdBtn");

    const activeStyle = {
      background: "rgba(223, 183, 108, 0.15)",
      borderColor: "#dfb76c",
      color: "#dfb76c",
      textShadow: "0 0 6px rgba(223, 183, 108, 0.4)"
    };
    const inactiveStyle = {
      background: "rgba(255, 255, 255, 0.05)",
      borderColor: "rgba(255, 255, 255, 0.2)",
      color: "rgba(255, 255, 255, 0.6)",
      textShadow: "none"
    };

    const applyStyle = (btn, isActive) => {
      if (!btn) return;
      const st = isActive ? activeStyle : inactiveStyle;
      btn.style.background = st.background;
      btn.style.borderColor = st.borderColor;
      btn.style.color = st.color;
      btn.style.textShadow = st.textShadow;
    };

    applyStyle(langThBtn, currentLang === "th");
    applyStyle(langEnBtn, currentLang === "en");
    applyStyle(langJaBtn, currentLang === "ja");
    applyStyle(langSdBtn, currentLang === "seedian");

    // Re-render dynamic components if functions exist
    if (typeof window.updateSettingsTogglesUI === "function") {
      window.updateSettingsTogglesUI();
    }
    if (typeof window.renderKeyBindingsUI === "function") {
      window.renderKeyBindingsUI();
    }
    if (typeof window.renderInventory === "function") {
      window.renderInventory();
    }
    if (typeof window.renderActionSlots === "function") {
      window.renderActionSlots();
    }
    if (typeof window.renderCrafting === "function") {
      window.renderCrafting();
    }
    if (typeof window.renderCooking === "function") {
      window.renderCooking();
    }
    if (typeof window.renderItemsList === "function") {
      window.renderItemsList();
    }
    if (typeof window.renderSaveSlots === "function") {
      const saveOverlay = document.getElementById("saveSelectOverlay");
      if (saveOverlay && saveOverlay.style.display !== "none") {
        window.renderSaveSlots();
      }
    }
    if (typeof window.updateShadowMapUI === "function") {
      window.updateShadowMapUI();
    }
    if (typeof window.syncInputDeviceSettingsUI === "function") {
      window.syncInputDeviceSettingsUI();
    }
    if (typeof window.renderMechStandUI === "function" && typeof window._lastActiveStand !== "undefined" && window._lastActiveStand) {
      window.renderMechStandUI(window._lastActiveStand, window._lastAttachedCollectibles);
    }

    // Refresh start screen title SVG if present
    const titleSvg = document.querySelector(".main-screen-thai-svg");
    if (titleSvg && typeof window.getThaiTitleLogoSVG === "function") {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = window.getThaiTitleLogoSVG();
      const newSvg = tempDiv.firstElementChild;
      if (newSvg) {
        titleSvg.replaceWith(newSvg);
      }
    }
  }

  function setElementTextOrHTML(el, str) {
    if (!el) return;
    const val = String(str || "");
    if (val.includes("<svg") || val.includes("<span") || currentLang === "seedian") {
      el.innerHTML = val;
    } else {
      el.textContent = val;
    }
  }

  function setGameLanguage(lang, save = true) {
    if (lang !== "th" && lang !== "en" && lang !== "seedian" && lang !== "ja") return;
    currentLang = lang;
    window.gameLanguage = currentLang;

    updateUILanguage();

    if (save) {
      if (typeof window.saveSettingsToLocalStorage === "function") {
        window.saveSettingsToLocalStorage();
      } else {
        try {
          const opts = JSON.parse(localStorage.getItem("seedplanet_options_config") || "{}");
          opts.language = currentLang;
          localStorage.setItem("seedplanet_options_config", JSON.stringify(opts));
        } catch (e) {}
      }
    }
  }

  window.I18N_DICTIONARY = DICTIONARY;
  window.getGameLanguage = getGameLanguage;
  window.setGameLanguage = setGameLanguage;
  window.setElementTextOrHTML = setElementTextOrHTML;
  window.t = t;
  window.getItemDisplayName = getItemDisplayName;
  window.updateUILanguage = updateUILanguage;
  window.gameLanguage = currentLang;

  document.addEventListener("DOMContentLoaded", () => {
    updateUILanguage();

    // Hook up language buttons
    const langThBtn = document.getElementById("langThBtn");
    const langEnBtn = document.getElementById("langEnBtn");
    const langJaBtn = document.getElementById("langJaBtn");
    const langSdBtn = document.getElementById("langSdBtn");
    if (langThBtn) {
      langThBtn.addEventListener("click", () => setGameLanguage("th", true));
    }
    if (langEnBtn) {
      langEnBtn.addEventListener("click", () => setGameLanguage("en", true));
    }
    if (langJaBtn) {
      langJaBtn.addEventListener("click", () => setGameLanguage("ja", true));
    }
    if (langSdBtn) {
      langSdBtn.removeAttribute("title");
      let pressTimer = null;
      let isLongPress = false;

      const startPress = (e) => {
        isLongPress = false;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          isLongPress = true;
          if (navigator.vibrate) {
            try { navigator.vibrate(35); } catch(_) {}
          }
          if (window.Seedian && typeof window.Seedian.openModal === "function") {
            window.Seedian.openModal();
          }
        }, 420);
      };

      const cancelPress = () => {
        clearTimeout(pressTimer);
      };

      const endPress = (e) => {
        clearTimeout(pressTimer);
        if (!isLongPress) {
          setGameLanguage("seedian", true);
        }
      };

      langSdBtn.addEventListener("pointerdown", startPress);
      langSdBtn.addEventListener("pointerup", endPress);
      langSdBtn.addEventListener("pointerleave", cancelPress);
      langSdBtn.addEventListener("pointercancel", cancelPress);
      langSdBtn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (window.Seedian && typeof window.Seedian.openModal === "function") {
          window.Seedian.openModal();
        }
      });
    }
  });
})();
