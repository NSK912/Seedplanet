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
      toggle_fullscreen: "เปิด/ปิด เต็มจอ",
      fps_counter: "FPS: ",

      // Settings Modal
      language_label: "ภาษา (Language)",
      lang_th: "ภาษาไทย",
      lang_en: "English",
      sfx_volume: "ระดับเสียงรวม",
      render_scale: "สเกลความละเอียดเรนเดอร์",
      fps_limit: "จำกัดเฟรมเรต",
      mouse_sensitivity: "ความไวเมาส์",
      screen_mode: "โหมดแสดงผล",
      mode_windowed: "โหมดหน้าต่าง",
      mode_fullscreen: "เต็มจอ",
      fps_display_toggle: "แสดงตัวนับ FPS",
      shadow_quality: "คุณภาพเงา",
      taau_label: "TAAU (เพิ่มความคมชัด)",
      taau_sub: "(เพิ่มความคมชัดภาพ)",
      key_bindings: "ตั้งค่าปุ่มควบคุม",
      restore_defaults: "คืนค่าเริ่มต้น",
      defaults_restored: "🔄 คืนค่าเริ่มต้นเรียบร้อยแล้ว!",
      main_menu: "กลับไปหน้าเริ่มเกม",

      // Key Bindings
      key_forward: "เดินหน้า",
      key_backward: "ถอยหลัง",
      key_left: "เดินซ้าย",
      key_right: "เดินขวา",
      key_interact: "สำรวจ / เก็บของ",
      key_inventory: "กระเป๋าเก็บของ",
      key_diveDown: "ดำน้ำลง",
      key_diveUp: "ว่ายน้ำขึ้น",
      key_toggleMouse: "เปิด/ปิด เมาส์จำลอง",
      key_action1: "ช่องแอคชั่น 1",
      key_action2: "ช่องแอคชั่น 2",
      key_action3: "ช่องแอคชั่น 3",
      key_action4: "ช่องแอคชั่น 4",
      key_rotate: "หมุนสิ่งก่อสร้าง",
      key_demolish: "รื้อถอนสิ่งก่อสร้าง",
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
      item_BRANCH: "กิ่งไม้",
      item_AXE: "ขวาน",
      item_PICKAXE: "อีเตอร์",
      item_LOG: "ท่อนไม้",
      item_BOW: "ธนู",
      item_ARROW: "ลูกธนู",
      item_WOOD_FLOOR: "พื้นไม้",
      item_THIN_WOOD_FLOOR: "พื้นไม้บาง",
      item_STONE_FLOOR: "พื้นหิน",
      item_WOOD_STAIRS: "บันไดไม้",
      item_CAMPFIRE: "กองไฟ",
      item_WOOD_BOAT: "เรือไม้",
      item_WOOD_WHEEL: "ล้อไม้",
      item_ELECTRIC_ENGINE: "เครื่องยนต์ไฟฟ้า",
      item_WOOD_WALL: "กำแพงไม้",
      item_WOOD_WINDOW: "หน้าต่างไม้",
      item_WOOD_DOOR: "ประตูไม้",
      item_WOOD_ROOF: "หลังคาไม้",
      item_WOOD_CHEST: "กล่องไม้",
      item_MEGANEURA: "แมลงปอยักษ์",
      item_ISOPOD: "ไอโซพอด",
      item_FRIED_BUG: "แมลงทอด",
      item_SHOVEL: "พลั่ว",
      item_ROBOT_STAND: "แท่นประกอบหุ่นยนต์",
      item_ROBOT_COCKPIT: "ห้องคนขับหุ่นยนต์",
      item_ROBOT_LEFT_ARM: "แขนซ้ายหุ่นยนต์",
      item_ROBOT_RIGHT_ARM: "แขนขวาหุ่นยนต์",
      item_ROBOT_LEFT_LEG: "ขาซ้ายหุ่นยนต์",
      item_ROBOT_RIGHT_LEG: "ขาขวาหุ่นยนต์",
      item_PLANET_CORE: "แกนกลางดวงดาว",

      // Settings & Toggles
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
      toggle_fullscreen: "Toggle Fullscreen",
      fps_counter: "FPS: ",

      // Settings Modal
      language_label: "Language",
      lang_th: "Thai",
      lang_en: "English",
      sfx_volume: "Master SFX Volume",
      render_scale: "Render Scale",
      fps_limit: "FPS Limit",
      mouse_sensitivity: "Mouse Sensitivity",
      screen_mode: "Screen Mode",
      mode_windowed: "Windowed",
      mode_fullscreen: "Fullscreen",
      fps_display_toggle: "FPS Counter",
      shadow_quality: "Shadow Quality",
      taau_label: "TAAU (Temporal Upsampling)",
      taau_sub: "(Enhanced Clarity)",
      key_bindings: "Key Bindings",
      restore_defaults: "Restore Defaults",
      defaults_restored: "🔄 Defaults Restored!",
      main_menu: "Return to Main Menu",

      // Key Bindings
      key_forward: "Move Forward",
      key_backward: "Move Backward",
      key_left: "Move Left",
      key_right: "Move Right",
      key_interact: "Interact / Gather",
      key_inventory: "Inventory",
      key_diveDown: "Dive Down",
      key_diveUp: "Swim Up",
      key_toggleMouse: "Toggle Virtual Cursor",
      key_action1: "Action Slot 1",
      key_action2: "Action Slot 2",
      key_action3: "Action Slot 3",
      key_action4: "Action Slot 4",
      key_rotate: "Rotate Structure",
      key_demolish: "Demolish Structure",
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
      item_BRANCH: "Branch",
      item_AXE: "Axe",
      item_PICKAXE: "Pickaxe",
      item_LOG: "Wood Log",
      item_BOW: "Bow",
      item_ARROW: "Arrow",
      item_WOOD_FLOOR: "Wood Floor",
      item_THIN_WOOD_FLOOR: "Thin Wood Floor",
      item_STONE_FLOOR: "Stone Floor",
      item_WOOD_STAIRS: "Wood Stairs",
      item_CAMPFIRE: "Campfire",
      item_WOOD_BOAT: "Wood Boat",
      item_WOOD_WHEEL: "Wooden Wheel",
      item_ELECTRIC_ENGINE: "Electric Engine",
      item_WOOD_WALL: "Wood Wall",
      item_WOOD_WINDOW: "Wood Window",
      item_WOOD_DOOR: "Wood Door",
      item_WOOD_ROOF: "Wooden Roof",
      item_WOOD_CHEST: "Wooden Chest",
      item_MEGANEURA: "Meganeura",
      item_ISOPOD: "Giant Isopod",
      item_FRIED_BUG: "Fried Bug",
      item_SHOVEL: "Shovel",
      item_ROBOT_STAND: "Robot Stand",
      item_ROBOT_COCKPIT: "Robot Cockpit",
      item_ROBOT_LEFT_ARM: "Robot Left Arm",
      item_ROBOT_RIGHT_ARM: "Robot Right Arm",
      item_ROBOT_LEFT_LEG: "Robot Left Leg",
      item_ROBOT_RIGHT_LEG: "Robot Right Leg",
      item_PLANET_CORE: "Planet Core",

      // Settings & Toggles
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
    }
  };

  let currentLang = "en";

  // Pre-load language from storage
  try {
    const savedOpts = localStorage.getItem("seedplanet_options_config");
    if (savedOpts) {
      const parsed = JSON.parse(savedOpts);
      if (parsed && (parsed.language === "th" || parsed.language === "en")) {
        currentLang = parsed.language;
      }
    } else {
      const savedSettings = localStorage.getItem("seedplanet_settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed && (parsed.language === "th" || parsed.language === "en")) {
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
    const dict = DICTIONARY[currentLang] || DICTIONARY.en;
    let text = dict[key] || (DICTIONARY.en && DICTIONARY.en[key]) || (DICTIONARY.th && DICTIONARY.th[key]) || key;
    if (params && typeof params === "object") {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      }
    }
    return text;
  }

  function getItemDisplayName(itemName) {
    if (!itemName) return "";
    const cleanKey = "item_" + String(itemName).toUpperCase();
    const translated = t(cleanKey);
    if (translated && translated !== cleanKey) {
      return translated;
    }
    return itemName;
  }

  function updateUILanguage() {
    // Update all text nodes with data-i18n attribute
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        el.textContent = t(key);
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
    if (langThBtn && langEnBtn) {
      if (currentLang === "th") {
        langThBtn.style.background = "rgba(223, 183, 108, 0.15)";
        langThBtn.style.borderColor = "#dfb76c";
        langThBtn.style.color = "#dfb76c";
        langThBtn.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";

        langEnBtn.style.background = "rgba(255, 255, 255, 0.05)";
        langEnBtn.style.borderColor = "rgba(255, 255, 255, 0.2)";
        langEnBtn.style.color = "rgba(255, 255, 255, 0.6)";
        langEnBtn.style.textShadow = "none";
      } else {
        langEnBtn.style.background = "rgba(223, 183, 108, 0.15)";
        langEnBtn.style.borderColor = "#dfb76c";
        langEnBtn.style.color = "#dfb76c";
        langEnBtn.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";

        langThBtn.style.background = "rgba(255, 255, 255, 0.05)";
        langThBtn.style.borderColor = "rgba(255, 255, 255, 0.2)";
        langThBtn.style.color = "rgba(255, 255, 255, 0.6)";
        langThBtn.style.textShadow = "none";
      }
    }

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
  }

  function setGameLanguage(lang, save = true) {
    if (lang !== "th" && lang !== "en") return;
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
  window.t = t;
  window.getItemDisplayName = getItemDisplayName;
  window.updateUILanguage = updateUILanguage;
  window.gameLanguage = currentLang;

  document.addEventListener("DOMContentLoaded", () => {
    updateUILanguage();

    // Hook up language buttons
    const langThBtn = document.getElementById("langThBtn");
    const langEnBtn = document.getElementById("langEnBtn");
    if (langThBtn) {
      langThBtn.addEventListener("click", () => setGameLanguage("th", true));
    }
    if (langEnBtn) {
      langEnBtn.addEventListener("click", () => setGameLanguage("en", true));
    }
  });
})();
