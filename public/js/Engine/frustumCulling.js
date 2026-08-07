// === SEEDPLANET FRUSTUM CULLING - SPHERICAL PLANET SUPPORT ===
// รองรับดาวทรงกลม - แก้ปัญหาเมฆ/วัตถุไกลๆ ถูกตัดก่อนขอบจอ

(function(global) {
  'use strict';

  // ==================== CONFIG ====================
  const CFG = {
    nearPlane: 0.001,
    radius: 8.0,
    maxDistance: 500,
    surfaceThickness: 2.0,
    
    // === PADDING ===
    frustumPadding: 1.8,
    radiusPadding: 3.0,
    
    // === FAR OBJECT FIX ===
    farObjectDistance: 200,
    farObjectRadiusMultiplier: 3.0,
    maxFarRadius: 100,
    
    // === SCREEN SIZE COMPENSATION ===
    useScreenSizeCompensation: true,
    minScreenSize: 0.01,
    
    // === SPHERICAL PLANET ===
    planetRadius: 8.0,          // รัศมีดาว
    useSphericalTerrain: true,   // ใช้ระบบทรงกลม
    gravityCenter: [0, 0, 0]    // ศูนย์กลางดาว
  };

  let frustumPlanes = null;
  let lastVP = null;

  // ==================== AUTO DETECT PLANET RADIUS ====================
  function detectPlanetRadius() {
    if (typeof global.RADIUS === 'number' && global.RADIUS > 0) {
      return global.RADIUS;
    }
    if (typeof global.planetRadius === 'number' && global.planetRadius > 0) {
      return global.planetRadius;
    }
    if (global.planet && typeof global.planet.radius === 'number' && global.planet.radius > 0) {
      return global.planet.radius;
    }
    if (global.seedplanet && typeof global.seedplanet.radius === 'number' && global.seedplanet.radius > 0) {
      return global.seedplanet.radius;
    }
    if (global.terrain) {
      if (typeof global.terrain.radius === 'number' && global.terrain.radius > 0) {
        return global.terrain.radius;
      }
      if (typeof global.terrain.size === 'number' && global.terrain.size > 0) {
        return global.terrain.size / 2;
      }
    }
    return CFG.planetRadius || 8.0;
  }

  // ==================== HEIGHT MAP (SPHERICAL) ====================
  const heightCache = new Map();
  
  // คำนวณความสูงบนพื้นผิวทรงกลม
  function getSphericalHeight(pos) {
    if (!pos || pos.length < 3) return 0;
    
    const [x, y, z] = pos;
    const [cx, cy, cz] = CFG.gravityCenter;
    
    // ระยะจากศูนย์กลางดาว
    const dx = x - cx;
    const dy = y - cy;
    const dz = z - cz;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    // รัศมีพื้นผิว (ออโต้)
    const surfaceRadius = detectPlanetRadius();
    
    // ความสูง = ระยะจากพื้นผิว (ติดลบ = ใต้พื้นผิว)
    return dist - surfaceRadius;
  }

  function getTerrainHeight(x, z) {
    // สำหรับ spherical terrain ใช้ getSphericalHeight แทน
    if (CFG.useSphericalTerrain) {
      const pos = [x, 0, z];
      return getSphericalHeight(pos);
    }
    
    // ระบบ flat terrain (เดิม)
    const key = Math.round(x * 5) + ',' + Math.round(z * 5);
    if (heightCache.has(key)) return heightCache.get(key);
    
    const R = detectPlanetRadius();
    const dist = Math.sqrt(x*x + z*z);
    let h = 0;
    if (dist < R) {
      h = Math.sqrt(Math.max(0, R*R - dist*dist));
    }
    
    if (heightCache.size < 2000) {
      heightCache.set(key, h);
    }
    return h;
  }

  // ==================== PLANE EXTRACTION ====================
  function getFrustumPlanes(vp) {
    if (!vp || vp.length < 16) return null;
    
    if (lastVP === vp && frustumPlanes) {
      return frustumPlanes;
    }
    lastVP = vp;
    
    const m = vp;
    const planes = new Float32Array(24);
    
    planes[0] = m[3] + m[0];
    planes[1] = m[7] + m[4];
    planes[2] = m[11] + m[8];
    planes[3] = m[15] + m[12];
    
    planes[4] = m[3] - m[0];
    planes[5] = m[7] - m[4];
    planes[6] = m[11] - m[8];
    planes[7] = m[15] - m[12];
    
    planes[8] = m[3] + m[1];
    planes[9] = m[7] + m[5];
    planes[10] = m[11] + m[9];
    planes[11] = m[15] + m[13];
    
    planes[12] = m[3] - m[1];
    planes[13] = m[7] - m[5];
    planes[14] = m[11] - m[9];
    planes[15] = m[15] - m[13];
    
    planes[16] = m[3] + m[2];
    planes[17] = m[7] + m[6];
    planes[18] = m[11] + m[10];
    planes[19] = m[15] + m[14];
    
    planes[20] = m[3] - m[2];
    planes[21] = m[7] - m[6];
    planes[22] = m[11] - m[10];
    planes[23] = m[15] - m[12];
    
    for (let i = 0; i < 6; i++) {
      const o = i * 4;
      const a = planes[o];
      const b = planes[o + 1];
      const c = planes[o + 2];
      const len = Math.sqrt(a * a + b * b + c * c);
      if (len > 0.001) {
        planes[o] /= len;
        planes[o + 1] /= len;
        planes[o + 2] /= len;
        planes[o + 3] /= len;
      }
    }
    
    frustumPlanes = planes;
    return planes;
  }

  // AUTO SCREEN SIZE (ไม่สามารถตั้งค่าจากภายนอกได้ - อัพเดทอัตโนมัติเฉพาะเมื่อมีการเปลี่ยนแปลง)
  let screenWidth = 0;
  let screenHeight = 0;

  // ==================== AUTO DETECT SCREEN SIZE ====================
  function updateScreenSize() {
    let w = 0, h = 0;
    
    // 1. ดึงจาก canvas element ของเกม
    if (typeof document !== 'undefined') {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          w = rect.width;
          h = rect.height;
        } else if (canvas.width > 0 && canvas.height > 0) {
          w = canvas.width;
          h = canvas.height;
        }
      }
    }
    
    // 2. ดึงจาก WebGL renderer
    if ((!w || !h) && typeof global.renderer !== 'undefined' && global.renderer && global.renderer.domElement) {
      const rect = global.renderer.domElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        w = rect.width;
        h = rect.height;
      }
    }
    
    // 3. ดึงจาก window
    if ((!w || !h) && typeof window !== 'undefined') {
      w = window.innerWidth || 0;
      h = window.innerHeight || 0;
    }
    
    // อัพเดทเฉพาะเมื่อมีการเปลี่ยนแปลงขนาด
    if (w > 0 && h > 0) {
      if (w !== screenWidth || h !== screenHeight) {
        screenWidth = w;
        screenHeight = h;
      }
    }
  }

  // Auto update on window resize
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateScreenSize);
    setTimeout(updateScreenSize, 50);
  }

  // ==================== FAR OBJECT DETECTION ====================
  function isFarObject(pos) {
    if (!pos || pos.length < 3) return false;
    const eye = global.eyePos;
    if (!eye || eye.length < 3) return false;
    
    const dx = pos[0] - eye[0];
    const dy = pos[1] - eye[1];
    const dz = pos[2] - eye[2];
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    return dist > CFG.farObjectDistance;
  }

  function getAdjustedRadius(obs, pos, baseRadius) {
    if (!pos || pos.length < 3) return baseRadius;
    
    let radius = baseRadius;
    const eye = global.eyePos;
    
    // 1. ถ้าวัตถุอยู่ไกล → ขยายรัศมี
    if (isFarObject(pos)) {
      const multiplier = CFG.farObjectRadiusMultiplier;
      radius = Math.min(baseRadius * multiplier, CFG.maxFarRadius);
    }
    
    // 2. ชดเชยตามขนาดบนจอ (ใช้ auto screen size)
    if (CFG.useScreenSizeCompensation && eye) {
      // อัพเดทขนาดจออัตโนมัติเฉพาะเมื่อมีความเปลี่ยนแปลง
      updateScreenSize();

      const dx = pos[0] - eye[0];
      const dy = pos[1] - eye[1];
      const dz = pos[2] - eye[2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      if (dist > 0.1 && screenWidth > 0 && screenHeight > 0) {
        const fov = 60 * Math.PI / 180;
        const aspect = screenWidth / screenHeight;
        const f = 1 / Math.tan(fov / 2);
        const screenSize = (baseRadius / dist) * f * aspect;
        
        if (screenSize < CFG.minScreenSize) {
          const neededSize = CFG.minScreenSize * 2;
          const ratio = neededSize / Math.max(screenSize, 0.001);
          radius = Math.max(radius, baseRadius * Math.min(ratio, 10));
        }
      }
    }
    
    // 3. วัตถุที่มีขนาดใหญ่จริงๆ (เมฆ) → ขยายเพิ่ม
    if (obs.isCloud || obs.type === 'cloud' || obs.name?.includes('cloud')) {
      radius = Math.max(radius, baseRadius * 4);
    }
    
    return Math.max(radius, baseRadius);
  }

  // ==================== BOUNDING RADIUS ====================
  function getBoundingRadius(obs) {
    if (!obs) return 1.0;
    if (obs._cRadius && !obs._isFar) return obs._cRadius;
    
    let r = 1.0;
    if (typeof obs.radius === 'number' && obs.radius > 0) r = obs.radius;
    else if (typeof obs.boundingRadius === 'number' && obs.boundingRadius > 0) r = obs.boundingRadius;
    else if (typeof obs.size === 'number' && obs.size > 0) r = obs.size * 2.5;
    else if (typeof obs.scale === 'number' && obs.scale > 0) r = obs.scale * 2;
    else if (Array.isArray(obs.extents) && obs.extents.length) {
      r = Math.max(...obs.extents.map(Math.abs));
    }
    
    const pos = obs.position || obs.pos;
    if (pos && pos.length >= 3) {
      r = getAdjustedRadius(obs, pos, r);
    }
    
    obs._cRadius = Math.max(r, 0.5);
    obs._isFar = isFarObject(pos);
    return obs._cRadius;
  }

  // ==================== SPHERICAL OCCLUSION ====================
  function isUndergroundAuto(pos, radius) {
    if (!pos || pos.length < 3) return false;
    
    const [x, y, z] = pos;
    const r = radius || 0.5;
    
    if (CFG.useSphericalTerrain) {
      const planetRadius = detectPlanetRadius();
      // ระบบทรงกลม
      const [cx, cy, cz] = CFG.gravityCenter;
      const dx = x - cx;
      const dy = y - cy;
      const dz = z - cz;
      const distFromCenter = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      // อยู่ใต้พื้นผิว
      if (distFromCenter + r < planetRadius - CFG.surfaceThickness) {
        return true;
      }
      
      // ตรวจสอบระยะไกล
      const eye = global.eyePos;
      if (eye && eye.length >= 3) {
        const ex = eye[0] - cx;
        const ey = eye[1] - cy;
        const ez = eye[2] - cz;
        const eyeDist = Math.sqrt(ex*ex + ey*ey + ez*ez);
        
        // ถ้าตาผู้เล่นอยู่ไกลจากพื้นผิวมาก
        if (eyeDist > planetRadius + 50) {
          // ตรวจสอบว่าวัตถุอยู่ด้านไกลของดาวหรือไม่
          const dot = (dx*ex + dy*ey + dz*ez) / (distFromCenter * eyeDist);
          if (dot < -0.3) { // อยู่ฝั่งตรงข้าม
            return true;
          }
        }
      }
      
      return false;
    } else {
      // ระบบ flat terrain (เดิม)
      const terrainY = getTerrainHeight(x, z);
      
      if (y + r < terrainY - CFG.surfaceThickness) {
        return true;
      }
      
      const eye = global.eyePos;
      if (eye && eye.length >= 3 && y < terrainY) {
        const dx = x - eye[0], dy = y - eye[1], dz = z - eye[2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist > 30) {
          return true;
        }
      }
      
      return false;
    }
  }

  function isHorizonOccluded(pos, radius) {
    if (!pos || pos.length < 3) return false;
    const eye = global.eyePos;
    if (!eye || eye.length < 3) return false;
    
    // ถ้าวัตถุอยู่ไกลมาก → ไม่ต้องเช็ค
    const dx = pos[0] - eye[0];
    const dy = pos[1] - eye[1];
    const dz = pos[2] - eye[2];
    const dist = dx*dx + dy*dy + dz*dz;
    if (dist > 40000) return false;
    
    const d = Math.sqrt(dist);
    if (d < 5) return false;
    
    const steps = Math.min(15, Math.ceil(d / 3));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = eye[0] + dx * t;
      const py = eye[1] + dy * t;
      const pz = eye[2] + dz * t;
      
      const terrainY = getTerrainHeight(px, pz);
      
      if (CFG.useSphericalTerrain) {
        const planetRadius = detectPlanetRadius();
        // ระบบทรงกลม: ตรวจสอบว่าจุดอยู่ใต้พื้นผิวหรือไม่
        const [cx, cy, cz] = CFG.gravityCenter;
        const dx1 = px - cx;
        const dy1 = py - cy;
        const dz1 = pz - cz;
        const distFromCenter = Math.sqrt(dx1*dx1 + dy1*dy1 + dz1*dz1);
        
        if (distFromCenter < planetRadius) {
          const d1 = (px-eye[0])*(px-eye[0]) + (py-eye[1])*(py-eye[1]) + (pz-eye[2])*(pz-eye[2]);
          if (d1 < dist) {
            return true;
          }
        }
      } else {
        // ระบบ flat terrain
        if (py < terrainY) {
          const d1 = (px-eye[0])*(px-eye[0]) + (py-eye[1])*(py-eye[1]) + (pz-eye[2])*(pz-eye[2]);
          if (d1 < dist) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  // ==================== MAIN CULLING ====================
  function isSphereInFrustum(planes, pos, radius) {
    if (!planes || !pos || pos.length < 3) return true;
    
    const [x, y, z] = pos;
    const r = (radius || 1.0) + CFG.radiusPadding;
    const threshold = -r * CFG.frustumPadding;
    
    const p = planes;
    if (p[0]*x + p[1]*y + p[2]*z + p[3] < threshold) return false;
    if (p[4]*x + p[5]*y + p[6]*z + p[7] < threshold) return false;
    if (p[8]*x + p[9]*y + p[10]*z + p[11] < threshold) return false;
    if (p[12]*x + p[13]*y + p[14]*z + p[15] < threshold) return false;
    if (p[16]*x + p[17]*y + p[18]*z + p[19] < threshold) return false;
    if (p[20]*x + p[21]*y + p[22]*z + p[23] < threshold) return false;
    
    // ตรวจสอบ occlusion
    if (isUndergroundAuto(pos, radius)) return false;
    if (isHorizonOccluded(pos, radius)) return false;
    
    return true;
  }

  // ==================== GET VISIBLE RANGES ====================
  function getVisibleIndexRanges(obstacles, planes) {
    if (!obstacles || !obstacles.length || !planes) return [];
    
    const ranges = [];
    
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (!obs) continue;
      
      const start = obs.meshStart ?? obs.start ?? obs.offset;
      const end = obs.meshEnd ?? obs.end ?? (start + (obs.count || obs.length || 0));
      if (start === undefined || end === undefined || end <= start) continue;
      
      const pos = obs.position || obs.pos;
      if (!pos || pos.length < 3) continue;
      
      const radius = getBoundingRadius(obs);
      
      if (isSphereInFrustum(planes, pos, radius)) {
        ranges.push({ start, end });
      }
    }
    
    if (!ranges.length) return [];
    
    ranges.sort((a, b) => a.start - b.start);
    
    const merged = [];
    let cur = { start: ranges[0].start, end: ranges[0].end };
    const GAP = 72;
    
    for (let i = 1; i < ranges.length; i++) {
      const next = ranges[i];
      if (next.start <= cur.end + GAP) {
        cur.end = Math.max(cur.end, next.end);
      } else {
        merged.push(cur);
        cur = { start: next.start, end: next.end };
      }
    }
    merged.push(cur);
    
    return merged;
  }

  // ==================== UPDATE ====================
  function updateFrustumPlanes(viewProj, cullingEnabled = true) {
    if (cullingEnabled && viewProj) {
      frustumPlanes = getFrustumPlanes(viewProj);
    } else {
      frustumPlanes = null;
    }
    global.frustumPlanes = frustumPlanes;
    return frustumPlanes;
  }

  // ==================== SET GRAVITY CENTER ====================
  function setGravityCenter(x, y, z) {
    CFG.gravityCenter = [x, y, z];
  }

  // ==================== EXPORT ====================
  const API = {
    getFrustumPlanes,
    isSphereInFrustum,
    getBoundingRadius,
    getVisibleIndexRanges,
    updateFrustumPlanes,
    getTerrainHeight,
    getSphericalHeight,
    detectPlanetRadius,
    getPlanetRadius: () => detectPlanetRadius(),
    updateScreenSize,
    getScreenSize: () => ({ width: screenWidth, height: screenHeight }),
    setNearPlane: (v) => { CFG.nearPlane = v; },
    setSurfaceThickness: (v) => { CFG.surfaceThickness = v; },
    setFrustumPadding: (v) => { CFG.frustumPadding = v; },
    setFarObjectDistance: (v) => { CFG.farObjectDistance = v; },
    setFarObjectRadiusMultiplier: (v) => { CFG.farObjectRadiusMultiplier = v; },
    setMinScreenSize: (v) => { CFG.minScreenSize = v; },
    setGravityCenter,
    setSphericalMode: (enabled) => { CFG.useSphericalTerrain = enabled; },
    config: CFG,
    clearHeightCache: () => heightCache.clear()
  };

  // Export
  global.FrustumCullingSystem = API;
  global.getFrustumPlanes = getFrustumPlanes;
  global.isSphereInFrustum = isSphereInFrustum;
  global.getBoundingRadius = getBoundingRadius;
  global.getVisibleIndexRanges = getVisibleIndexRanges;
  global.updateFrustumPlanes = updateFrustumPlanes;

  console.log('✅ SPHERICAL PLANET FRUSTUM CULLING (AUTO PLANET RADIUS)');
  console.log('   - Auto planet radius: ' + detectPlanetRadius());
  console.log('   - Spherical mode: ' + CFG.useSphericalTerrain);
  console.log('   - Far objects: ' + CFG.farObjectDistance + ' units');
  console.log('   - Radius multiplier: ' + CFG.farObjectRadiusMultiplier + 'x');

})(typeof window !== 'undefined' ? window : this);