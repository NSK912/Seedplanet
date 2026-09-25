// =========================================================================
// ภาษาซีเดียน (Seedian Script & Language System)
// Complete Custom Pure Geometric Glyph System (เรขาคณิตแท้ 100% สร้างขึ้นเอง)
// =========================================================================

(function(global) {
  // 1. Complete Thai Consonant, Vowel, Tone Mark, Number, and Punctuation Mappings
  // Purely geometric, faceted, angular glyphs with 100% equal cap-height & zero foreign alphabet references
  const SEEDIAN_ALPHABET = {
    // === พยัญชนะไทย 44 ตัว (Thai Consonants - Pure Geometric Custom Glyphs) ===
    "ก": "⊓", // K - Square Arch / Portal
    "ข": "⊐", // Kh - Open-Right Square Bracket
    "ฃ": "⊏", // Kh (Rare) - Open-Left Square Bracket
    "ค": "⊞", // Kh - Squared Orthogonal Cross Matrix
    "ฅ": "⊠", // Kh (Rare) - Squared Diagonal X Matrix
    "ฆ": "⌸", // Kh - Square Pedestal Matrix
    "ง": "⟐", // Ng - Diamond Cross Matrix (◇ + + Overlaid Reticle)
    "จ": "◇", // Ch - Faceted Diamond Core
    "ฉ": "◈", // Ch - Concentric Faceted Inscribed Diamond
    "ช": "⬖", // Ch - Split Geometric Prism (Left)
    "ซ": "⬗", // S - Split Geometric Prism (Right)
    "ฌ": "⧖", // Ch - Horizontal Geometric Hourglass
    "ญ": "⊔", // Y - Square Deep Basin / Vessel
    "ฎ": "◬", // D - Delta Triangle with Center Vertical Axis
    "ฏ": "⧎", // T - Delta Triangle with Base Pillar Beam
    "ฐ": "⌹", // Th - Multi-Grid Square Core
    "ฑ": "◇◆", // Th - Connected Diamond Vector (Open Diamond, Solid Diamond)
    "ฒ": "◆◇", // Th - Connected Diamond Vector (Solid Diamond, Open Diamond)
    "ณ": "⍁", // N - Diamond-Inscribed Square Frame
    "ด": "△", // D - Delta Peak Triangle
    "ต": "▲", // T - Solid Apex Triangle
    "ถ": "▽", // Th - Inverted Delta Triangle
    "ท": "▼", // Th - Solid Inverted Apex Triangle
    "ธ": "⧗", // Th - Vertical Faceted Hourglass Prism
    "น": "⬡", // N - Hexagonal Cell Prism
    "บ": "□", // B - Clean Square Frame
    "ป": "■", // P - Solid Monolith Block
    "ผ": "⋈", // Ph - Geometric Bowtie Core
    "ฝ": "⋉", // F - Geometric Left Wing Nexus
    "พ": "⋊", // Ph - Geometric Right Wing Nexus
    "ฟ": "⋋", // F - Geometric Splay Matrix
    "ภ": "▣", // Ph - Concentric Inscribed Square Box
    "ม": "⬢", // M - Solid Hexagonal Prism
    "ย": "⌑", // Y - Rotated Square Diamond Lozenge
    "ร": "⊺", // R - Intercalate Pivot Vector
    "ล": "⊻", // L - Angular Chevron Vertex
    "ว": "⊽", // W - Inverted Angular Chevron Vertex
    "ศ": "⊡", // S - Square with Centered Focus Dot
    "ษ": "◧", // S - Bisected High-Contrast Square (Left Half Solid)
    "ส": "◨", // S - Bisected High-Contrast Square (Right Half Solid)
    "ห": "⍁", // H - Square with Clean Inscribed Diamond Core
    "ฬ": "⊼", // L - Geometric Inverted Vertex Nexus (Angular NAND Bar)
    "อ": "⬠", // O - Pure Geometric Polygon Core (Pentagon Prism)
    "ฮ": "⌗", // H - Dual-Beam Matrix Grid

    // === สระไทยและเครื่องหมาย (Vowels & Diacritics - Compact Single & Combining Glyphs) ===
    "ะ": "∶", // Short a - Compact Single Two-Dot (U+2236)
    "า": "∣", // Long aa - Compact Sleek Thin Pillar (U+2223)
    "ำ": "⋄∣", // Am - Compact Faceted Diamond on Pillar (U+22C4 + U+2223)
    "ิ": "\u0302", // i - Combining Sharp Apex
    "ี": "\u0304", // ii - Combining Horizontal Beam
    "ึ": "\u030A", // ue - Combining Orb Ring
    "ื": "\u0308", // uee - Combining Dual Orb
    "ุ": "\u032D", // u - Combining Lower Apex
    "ู": "\u0333", // uu - Combining Lower Double Beam
    "เ": "∣", // e - Compact Front Beam (U+2223)
    "แ": "∥", // ae - Compact Parallel Double Beam (U+2225)
    "โ": "┌", // o - Compact Top Corner Beam (U+250C)
    "ใ": "⌜", // ai (Mai Muan) - Compact Quadrant Corner (U+231C)
    "ไ": "⎾", // ai (Mai Malai) - Compact Stepped Angle (U+23BE)
    "ฤ": "⊩", // Rue - Double Beam Pivot
    "ฦ": "⊫", // Lue - Triple Beam Pivot
    "็": "\u0307", // Mai Tai Khu - Combining Crown Dot
    "ั": "\u0302", // Mai Han-Akat - Combining Apex
    "์": "\u0301", // Thanthakhat / Garan - Combining Slash Ray
    "ํ": "\u030A", // Nikhahit - Combining Apex Ring
    "ฺ": "\u0323", // Phinthu - Combining Center Dot
    "ฯ": "∣", // Paiyan Noi - Pillar Divider
    "ๆ": "‖", // Mai Yamok - Twin Geometric Pillars
    "฿": "⟡", // Baht Symbol - Astral Diamond Matrix
    "๏": "⬪", // Fongman - Small Diamond Core
    "๚": "⫽", // Angkhankhu - Twin Slashed Cosmic Pillars
    "๛": "⧫", // Khomut - Angular Faceted Lozenge

    // === วรรณยุกต์ (Tone Marks - Combining Diacritics for Zero Width Overhead Placement) ===
    "่": "\u0300", // Mai Ek - Combining Sharp Grave Accent
    "้": "\u0303", // Mai Tho - Combining Sharp Tilde Accent
    "๊": "\u030C", // Mai Tri - Combining Sharp Caron Inverted Apex
    "๋": "\u0311", // Mai Chattawa - Combining Inverted Breve Accent

    // === ตัวเลขไทยและเลขอารบิก (Numbers) ===
    "๐": "0", "0": "0",
    "๑": "1", "1": "1",
    "๒": "2", "2": "2",
    "๓": "3", "3": "3",
    "๔": "4", "4": "4",
    "๕": "5", "5": "5",
    "๖": "6", "6": "6",
    "๗": "7", "7": "7",
    "๘": "8", "8": "8",
    "๙": "9", "9": "9"
  };

  // English letters mapped purely to geometric Seedian runes
  const EN_SEEDIAN_MAP = {
    "a": "△", "b": "⊐", "c": "⊏", "d": "◈", "e": "⊞",
    "f": "⌸", "g": "⟐", "h": "▦", "i": "│", "j": "◇─◆",
    "k": "⊓", "l": "⊻", "m": "⬢", "n": "⬡", "o": "⬠",
    "p": "■", "q": "◇", "r": "⊺", "s": "▥", "t": "▲",
    "u": "⊔", "v": "▽", "w": "⋈", "x": "⊠", "y": "⌑", "z": "⧗"
  };

  // Transliterate standard text to Seedian script
  function toSeedian(text) {
    if (!text || typeof text !== "string") return "";
    let out = "";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (SEEDIAN_ALPHABET[ch]) {
        out += SEEDIAN_ALPHABET[ch];
      } else {
        const lower = ch.toLowerCase();
        if (EN_SEEDIAN_MAP[lower]) {
          out += EN_SEEDIAN_MAP[lower];
        } else {
          out += ch;
        }
      }
    }
    return out;
  }

  // Special Title Formatter for Game Title: All characters white except 'ด' (△) in red
  function getSeedianTitleHTML(text) {
    if (!text || typeof text !== "string") return "";
    let raw = toSeedian(text);
    let html = "";
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === "△") {
        html += `<span class="title-accent-red">△</span>`;
      } else {
        html += ch;
      }
    }
    return html;
  }

  // 2. High-Resolution Vector Title SVG Subtitle Renderer (SEEDPLANET Subtitle)
  function getThaiTitleLogoSVG() {
    return `<svg class="main-screen-thai-svg" viewBox="0 0 320 28" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMid meet" aria-label="SEEDPLANET">
      <defs>
        <linearGradient id="seedianRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ff7b85" />
          <stop offset="50%" stop-color="#ff3b47" />
          <stop offset="100%" stop-color="#cc2531" />
        </linearGradient>
        <linearGradient id="seedianGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff5db" />
          <stop offset="50%" stop-color="#dfb76c" />
          <stop offset="100%" stop-color="#a87d30" />
        </linearGradient>
        <filter id="seedianGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.95" />
        </filter>
      </defs>
      <text x="320" y="21" text-anchor="end" filter="url(#seedianGlow)" font-family="'Playfair Display', Georgia, serif" font-size="16" font-weight="900" letter-spacing="0.14em">
        <tspan fill="#ffffff">SEED</tspan><tspan fill="url(#seedianGoldGrad)">PLANET</tspan>
      </text>
    </svg>`;
  }

  // 3. Complete Lexicon & Character Chart Modal Component (Game UI Cut-Corner Style)
  function createSeedianModalDOM() {
    let existing = document.getElementById("seedianLexiconModal");
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement("div");
    overlay.id = "seedianLexiconModal";
    overlay.className = "seedian-modal-overlay";

    // Thai Consonants Organized by 7 Geometric Archetype Families
    const consonantGroups = [
      { name: "กลุ่มสี่เหลี่ยม (Square Archetypes)", glyphs: "□ ■ ▣ ⊡ ◧ ◨ ⍁ ⊞ ⊠ ⌗", items: ["บ","ป","ภ","ศ","ษ","ส","ห","ค","ฅ","ฐ","ฮ","ฆ"] },
      { name: "กลุ่มเพชร (Diamond Archetypes)", glyphs: "◇ ◈ ⬖ ⬗ ⟐", items: ["จ","ฉ","ช","ซ","ง","ย","ณ","ฑ","ฒ"] },
      { name: "กลุ่มสามเหลี่ยม (Triangle Archetypes)", glyphs: "△ ▲ ▽ ▼ ◬ ⧎", items: ["ด","ต","ถ","ท","ฎ","ฏ"] },
      { name: "กลุ่มหกเหลี่ยม / พหุเหลี่ยม (Hexagon / Polygon)", glyphs: "⬡ ⬢ ⬠", items: ["น","ม","อ"] },
      { name: "กลุ่ม Bowtie (Bowtie Family)", glyphs: "⋈ ⋉ ⋊ ⋋", items: ["ผ","ฝ","พ","ฟ"] },
      { name: "กลุ่ม Hourglass (Hourglass Family)", glyphs: "⧖ ⧗", items: ["ฌ","ธ"] },
      { name: "กลุ่มรูปเฉพาะทาง / เวกเตอร์ (Specialized Brackets)", glyphs: "⊓ ⊐ ⊏ ⊔", items: ["ก","ข","ฃ","ญ","ร","ล","ฬ","ว"] }
    ];

    // Vowels & Special Marks
    const vowels = ["ะ","า","ำ","ิ","ี","ึ","ื","ุ","ู","เ","แ","โ","ใ","ไ","ฤ","ฦ","็","ั","์","ฯ","ๆ","฿","๏","๚","๛"];
    // Tone Marks
    const tones = ["่","้","๊","๋"];
    // Digits
    const numbers = ["0","1","2","3","4","5","6","7","8","9"];

    const renderCards = (list) => {
      return list.map(ch => {
        let sd = toSeedian(ch);
        // If the Seedian character is a combining diacritic mark, render it over a dotted circle placeholder
        if (/^[\u0300-\u036f]/.test(sd)) {
          sd = "◌" + sd;
        }
        let displayTh = ch;
        if (/^[\u0e31\u0e34-\u0e3a\u0e47-\u0e4e]/.test(ch)) {
          displayTh = "◌" + ch;
        }
        return `<div class="seedian-card"><span class="th-char">${displayTh}</span><span style="color: rgba(223,183,108,0.4); font-size: 11px;">➔</span><span class="sd-char">${sd}</span></div>`;
      }).join("");
    };

    const renderConsonantGroups = () => {
      return consonantGroups.map(grp => {
        return `
          <div style="margin-top: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(223,183,108,0.15); border-left: 3px solid #dfb76c; padding: 10px 12px; --cut: 6px; clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut)));">
            <div style="font-size: 12px; font-weight: 700; color: #dfb76c; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
              <span>✦ ${grp.name}</span>
              <span style="color: rgba(255,255,255,0.4); font-size: 11px; font-family: monospace;">[ ${grp.glyphs} ]</span>
            </div>
            <div class="seedian-grid">
              ${renderCards(grp.items)}
            </div>
          </div>
        `;
      }).join("");
    };

    overlay.innerHTML = `
      <div class="seedian-modal-box" style="position: relative;">
        <!-- Scrollable Body -->
        <div class="seedian-modal-body" style="padding-top: 20px;">
          <!-- Live Interactive Translator -->
          <div style="background: rgba(223,183,108,0.05); border: 1px solid rgba(223,183,108,0.25); --cut: 10px; clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut))); padding: 14px;">
            <div style="font-size: 13px; font-weight: 700; color: #dfb76c; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; font-family: 'Playfair Display', Georgia, serif; letter-spacing: 0.08em; text-shadow: 0 0 6px rgba(223,183,108,0.3);">
              <span>✦</span> ${toSeedian("ทดลองพิมพ์ข้อความ")}
            </div>
            <div style="display: flex; gap: 10px; flex-direction: column;">
              <input
                id="seedianLiveInput"
                type="text"
                placeholder="พิมพ์ข้อความที่นี่..."
                value="ดาวเคราะห์แห่งเมล็ดพันธุ์"
                style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); padding: 8px 12px; color: #ffffff; font-size: 13px; font-family: 'Google Sans', sans-serif; outline: none; --cut: 6px; clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut)));"
              />
              <div style="background: rgba(0,0,0,0.7); border: 1px solid #dfb76c; padding: 12px 14px; min-height: 42px; display: flex; align-items: center; justify-content: space-between; gap: 10px; --cut: 6px; clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut)));">
                <div id="seedianLiveOutput" style="font-size: 18px; font-weight: 700; color: #dfb76c; font-family: 'Playfair Display', 'Google Sans', Georgia, serif; letter-spacing: 0.1em; word-break: break-all; text-shadow: 0 0 8px rgba(223,183,108,0.4);">
                  ${toSeedian("ดาวเคราะห์แห่งเมล็ดพันธุ์")}
                </div>
              </div>
            </div>
          </div>

          <!-- Section 1: Thai Consonants Organized by 7 Geometric Families -->
          <div>
            <div style="font-size: 14px; font-weight: 700; color: #dfb76c; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; font-family: 'Playfair Display', Georgia, serif; letter-spacing: 0.08em; text-shadow: 0 0 6px rgba(223,183,108,0.3);">
              <span>✦</span> ${toSeedian("พยัญชนะไทย 44 ตัว (7 กลุ่มเรขาคณิต)")}
            </div>
            ${renderConsonantGroups()}
          </div>

          <!-- Section 2: Vowels & Symbols -->
          <div>
            <div style="font-size: 14px; font-weight: 700; color: #dfb76c; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; font-family: 'Playfair Display', Georgia, serif; letter-spacing: 0.08em; text-shadow: 0 0 6px rgba(223,183,108,0.3);">
              <span>✦</span> ${toSeedian("สระและเครื่องหมาย")}
            </div>
            <div class="seedian-grid">
              ${renderCards(vowels)}
            </div>
          </div>

          <!-- Section 3: Tone Marks & Numbers -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <div>
              <div style="font-size: 14px; font-weight: 700; color: #dfb76c; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; font-family: 'Playfair Display', Georgia, serif; letter-spacing: 0.08em; text-shadow: 0 0 6px rgba(223,183,108,0.3);">
                <span>✦</span> ${toSeedian("วรรณยุกต์")}
              </div>
              <div class="seedian-grid" style="grid-template-columns: repeat(2, 1fr);">
                ${renderCards(tones)}
              </div>
            </div>
            <div>
              <div style="font-size: 14px; font-weight: 700; color: #dfb76c; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; font-family: 'Playfair Display', Georgia, serif; letter-spacing: 0.08em; text-shadow: 0 0 6px rgba(223,183,108,0.3);">
                <span>✦</span> ${toSeedian("ตัวเลข")}
              </div>
              <div class="seedian-grid" style="grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));">
                ${renderCards(numbers)}
              </div>
            </div>
          </div>
        </div>

        <!-- Footer with Game-Style Cut-Corner Close Button -->
        <div class="seedian-modal-footer">
          <button id="bottomCloseSeedianBtn" class="seedian-footer-btn" style="letter-spacing: 0.12em; font-family: 'Playfair Display', Georgia, serif;">
            ${toSeedian("ปิดหน้าต่าง")}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    const bottomCloseBtn = overlay.querySelector("#bottomCloseSeedianBtn");
    if (bottomCloseBtn) {
      bottomCloseBtn.addEventListener("click", closeSeedianModal);
    }

    // Do NOT close on background click per user request
    const input = overlay.querySelector("#seedianLiveInput");
    const output = overlay.querySelector("#seedianLiveOutput");
    if (input && output) {
      input.addEventListener("input", () => {
        output.textContent = toSeedian(input.value) || "(พิมพ์ข้อความเพื่อแปล)";
      });
    }

    return overlay;
  }

  function openSeedianModal() {
    const modal = createSeedianModalDOM();
    if (modal) {
      modal.classList.add("active");
    }
  }

  function closeSeedianModal() {
    const modal = document.getElementById("seedianLexiconModal");
    if (modal) {
      modal.classList.remove("active");
    }
  }

  // 4. Dynamic UI Bumper & Auto-Fit Scaling System
  function autoFitMainScreenTitle() {
    const wrappers = document.querySelectorAll(".main-screen-title-wrapper");
    wrappers.forEach(wrapper => {
      const parent = wrapper.parentElement;
      if (!parent) return;
      
      wrapper.style.transform = "none";
      const availableWidth = Math.min(window.innerWidth - 32, (parent.clientWidth || window.innerWidth) - 24);
      const titleWidth = wrapper.scrollWidth;
      
      if (titleWidth > availableWidth && availableWidth > 0) {
        const scale = Math.max(0.35, Math.min(1.0, (availableWidth / titleWidth) * 0.96));
        wrapper.style.transform = `scale(${scale.toFixed(4)})`;
        wrapper.style.transformOrigin = "center center";
      } else {
        wrapper.style.transform = "none";
      }
    });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("resize", autoFitMainScreenTitle);
    window.addEventListener("DOMContentLoaded", () => {
      setTimeout(autoFitMainScreenTitle, 100);
      setTimeout(autoFitMainScreenTitle, 500);
    });
    // Periodic check during initialization
    let fitAttempts = 0;
    const fitInterval = setInterval(() => {
      autoFitMainScreenTitle();
      fitAttempts++;
      if (fitAttempts > 15) clearInterval(fitInterval);
    }, 400);
  }

  // Handle ESC key to close modal
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeSeedianModal();
      }
    });
  }

  // Export module
  global.Seedian = {
    ALPHABET: SEEDIAN_ALPHABET,
    toSeedian: toSeedian,
    getSeedianTitleHTML: getSeedianTitleHTML,
    transliterate: toSeedian,
    getThaiTitleLogoSVG: getThaiTitleLogoSVG,
    openModal: openSeedianModal,
    closeModal: closeSeedianModal,
    autoFitTitle: autoFitMainScreenTitle
  };

  global.getThaiTitleLogoSVG = getThaiTitleLogoSVG;
  global.toSeedian = toSeedian;
  global.getSeedianTitleHTML = getSeedianTitleHTML;
  global.openSeedianModal = openSeedianModal;
  global.closeSeedianModal = closeSeedianModal;
  global.autoFitMainScreenTitle = autoFitMainScreenTitle;
})(typeof window !== "undefined" ? window : this);
