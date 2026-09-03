import React, { useState, useEffect, useRef } from 'react';
import { Upload, Box, Play, RefreshCw, CheckCircle2, Image as ImageIcon, Cpu } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stage, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';

const PIPELINE_STEPS = [
  "จับจุดที่ตรงกันในแต่ละภาพ (Feature Matching)",
  "คำนวณตำแหน่งกล้อง (Camera Pose Estimation)",
  "คำนวณความลึก (Depth Estimation)",
  "สร้าง Point Cloud (Point Cloud Generation)",
  "สร้าง Mesh (Mesh Reconstruction)",
  "ใส่พื้นผิว Texture (Texturing)"
];

// Generate a mock point cloud
const pointCount = 5000;
const positions = new Float32Array(pointCount * 3);
for (let i = 0; i < pointCount; i++) {
  // A simple capsule/chibi shape distribution
  const y = (Math.random() - 0.5) * 4;
  const radius = y > 1 ? 1 : 0.6; // head is wider
  const theta = Math.random() * 2 * Math.PI;
  const x = Math.cos(theta) * radius * Math.random();
  const z = Math.sin(theta) * radius * Math.random();
  positions[i * 3] = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;
}

function MockPointCloud() {
  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial transparent color="#818cf8" size={0.05} sizeAttenuation={true} depthWrite={false} />
    </Points>
  );
}

function MockMesh({ textured }: { textured: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* A simple placeholder geometry representing a character base */}
      <capsuleGeometry args={[0.8, 2, 32, 32]} />
      {textured ? (
        <meshStandardMaterial color="#fcd34d" roughness={0.4} metalness={0.1} wireframe={false} />
      ) : (
        <meshStandardMaterial color="#94a3b8" wireframe={true} />
      )}
    </mesh>
  );
}


export default function DevGame() {
  const [images, setImages] = useState({
    front: null as string | null,
    side: null as string | null,
    back: null as string | null,
    top: null as string | null
  });

  const [status, setStatus] = useState<'idle' | 'processing' | 'completed'>('idle');
  const [currentStep, setCurrentStep] = useState(0);

  const handleImageUpload = (view: keyof typeof images) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImages(prev => ({ ...prev, [view]: url }));
    }
  };

  const startProcessing = () => {
    if (!images.front && !images.side && !images.back && !images.top) {
      alert("กรุณาอัปโหลดรูปภาพอย่างน้อย 1 มุมมอง");
      return;
    }
    
    setStatus('processing');
    setCurrentStep(0);
    
    // Simulate pipeline progression
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= PIPELINE_STEPS.length) {
        clearInterval(interval);
        setStatus('completed');
      } else {
        setCurrentStep(step);
      }
    }, 1500); // 1.5 seconds per step
  };

  const reset = () => {
    setStatus('idle');
    setCurrentStep(0);
  };

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">3D Model Pipeline</h1>
          <p className="text-slate-400 text-sm">สร้าง 3D Model จากภาพ 4 มุมมอง ด้วย Photogrammetry / Neural Rendering</p>
        </div>
        {status === 'idle' ? (
          <button 
            onClick={startProcessing}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Play size={16} /> เริ่มประมวลผล
          </button>
        ) : (
          <button 
            onClick={reset}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw size={16} /> เริ่มใหม่
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Image Inputs & Pipeline Status */}
        <div className="flex flex-col gap-6 overflow-y-auto pr-2 pb-4">
          <div className="bg-[#121215] border border-white/5 rounded-xl p-5">
            <h2 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
              <ImageIcon size={16} className="text-indigo-400"/>
              1. นำเข้าภาพต้นแบบ (Reference Images)
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <ImageUploadSlot label="ภาพด้านหน้า (Front)" image={images.front} onChange={handleImageUpload('front')} />
              <ImageUploadSlot label="ภาพด้านข้าง (Side)" image={images.side} onChange={handleImageUpload('side')} />
              <ImageUploadSlot label="ภาพด้านหลัง (Back)" image={images.back} onChange={handleImageUpload('back')} />
              <ImageUploadSlot label="ภาพด้านบน (Top)" image={images.top} onChange={handleImageUpload('top')} />
            </div>
          </div>

          <div className="bg-[#121215] border border-white/5 rounded-xl p-5 flex-1">
             <h2 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
              <Cpu size={16} className="text-indigo-400"/>
              2. สถานะการประมวลผล (Processing Pipeline)
            </h2>
            <div className="flex flex-col gap-1">
              {PIPELINE_STEPS.map((stepName, idx) => {
                const isActive = status === 'processing' && currentStep === idx;
                const isCompleted = (status === 'processing' && currentStep > idx) || status === 'completed';
                const isPending = status === 'idle' || (status === 'processing' && currentStep < idx);

                return (
                  <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isActive ? 'bg-indigo-500/10 border-indigo-500/30' : 
                    isCompleted ? 'bg-white/5 border-white/5' : 
                    'border-transparent opacity-50'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 size={18} className="text-emerald-400" />
                    ) : isActive ? (
                      <RefreshCw size={18} className="text-indigo-400 animate-spin" />
                    ) : (
                      <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-600" />
                    )}
                    <span className={`text-sm ${isActive ? 'text-indigo-300 font-medium' : isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>
                      {stepName}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column: 3D Preview */}
        <div className="bg-[#121215] border border-white/5 rounded-xl overflow-hidden relative flex flex-col">
          <div className="p-4 border-b border-white/5 bg-[#161619] flex justify-between items-center z-10 relative shadow-md">
            <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Box size={16} className="text-indigo-400"/>
              พรีวิว 3D Model
            </h2>
            {status !== 'idle' && (
              <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md border border-indigo-500/20">
                {status === 'processing' ? 'Generating...' : 'Ready'}
              </span>
            )}
          </div>
          
          <div className="flex-1 relative bg-gradient-to-b from-[#1a1a1f] to-[#0c0c0e]">
            {status === 'idle' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                 <Box size={48} className="mb-4 opacity-20" />
                 <p className="text-sm">อัปโหลดภาพแล้วกด "เริ่มประมวลผล" เพื่อสร้าง 3D Model</p>
              </div>
            ) : (
              <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
                 <color attach="background" args={['#0f0f13']} />
                 <ambientLight intensity={0.5} />
                 <directionalLight position={[10, 10, 5]} intensity={1} />
                 
                 <OrbitControls makeDefault autoRotate={status === 'completed'} autoRotateSpeed={2} />
                 
                 <Stage environment="city" intensity={0.5}>
                    {currentStep === 3 && (
                      <group key="pointcloud">
                         <MockPointCloud />
                      </group>
                    )}
                    
                    {currentStep === 4 && (
                      <group key="mesh-wire">
                         <MockMesh textured={false} />
                      </group>
                    )}

                    {currentStep >= 5 && (
                      <group key="mesh-textured">
                         <MockMesh textured={true} />
                      </group>
                    )}
                 </Stage>
              </Canvas>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function ImageUploadSlot({ label, image, onChange }: { label: string, image: string | null, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="relative group">
       <input 
         type="file" 
         accept="image/*"
         onChange={onChange}
         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
       />
       <div className={`h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-colors relative overflow-hidden ${
         image ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-700 bg-zinc-900 group-hover:border-slate-500 group-hover:bg-zinc-800'
       }`}>
          {image ? (
            <>
              <img src={image} alt={label} className="absolute inset-0 w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <span className="text-white text-xs font-medium px-2 py-1 bg-black/60 rounded">เปลี่ยนภาพ</span>
              </div>
            </>
          ) : (
            <>
              <Upload size={20} className="text-slate-500 mb-2 group-hover:text-slate-300 transition-colors" />
              <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors">{label}</span>
            </>
          )}
       </div>
    </div>
  );
}
