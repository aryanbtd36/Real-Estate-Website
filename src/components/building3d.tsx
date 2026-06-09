'use client';

import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stage, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// 3D Skyscraper mesh representing a modern luxury building
function Skyscraper({ autoRotate = false, interactive = false, activeFloor = 1, onSelectFloor }: {
  autoRotate?: boolean;
  interactive?: boolean;
  activeFloor?: number;
  onSelectFloor?: (floor: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);

  // Slow rotation for Hero section
  useFrame((state) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.15;
    }
  });

  const totalFloors = 8;
  const floorHeight = 0.55;

  return (
    <group ref={groupRef}>
      {/* Foundation Base */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[2.5, 0.2, 2.5]} />
        <meshStandardMaterial color="#161616" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Stacked Floors */}
      {Array.from({ length: totalFloors }).map((_, index) => {
        const floorNumber = index + 1;
        const posY = index * floorHeight + floorHeight / 2;
        const isSelected = activeFloor === floorNumber;
        const isHovered = hoveredFloor === floorNumber;

        // Custom styling for floors
        let floorColor = '#1e1e1e';
        let emissiveColor = '#000000';
        let emissiveIntensity = 0;

        if (isSelected) {
          floorColor = '#D4AF37';
          emissiveColor = '#D4AF37';
          emissiveIntensity = 0.8;
        } else if (isHovered && interactive) {
          floorColor = '#F5D67B';
          emissiveColor = '#F5D67B';
          emissiveIntensity = 0.4;
        }

        return (
          <group key={floorNumber} position={[0, posY, 0]}>
            {/* Core Concrete structure */}
            <mesh>
              <boxGeometry args={[1.5, floorHeight - 0.05, 1.5]} />
              <meshStandardMaterial
                color={floorColor}
                roughness={0.2}
                metalness={0.9}
                emissive={new THREE.Color(emissiveColor)}
                emissiveIntensity={emissiveIntensity}
              />
            </mesh>

            {/* Glass panels surround */}
            <mesh>
              <boxGeometry args={[1.52, floorHeight - 0.08, 1.52]} />
              <meshPhysicalMaterial
                color="#88ccff"
                transparent
                opacity={0.3}
                roughness={0.1}
                metalness={0.9}
                transmission={0.6}
                ior={1.5}
              />
            </mesh>

            {/* Clickable bounding box for interactive selection */}
            {interactive && (
              <mesh
                visible={false}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectFloor) onSelectFloor(floorNumber);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredFloor(floorNumber);
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  setHoveredFloor(null);
                }}
              >
                <boxGeometry args={[1.7, floorHeight, 1.7]} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Modern Roof Crown */}
      <mesh position={[0, totalFloors * floorHeight + 0.15, 0]}>
        <cylinderGeometry args={[0, 0.7, 0.4, 4]} />
        <meshStandardMaterial color="#D4AF37" roughness={0.1} metalness={0.8} />
      </mesh>
      {/* Tall Spire */}
      <mesh position={[0, totalFloors * floorHeight + 0.6, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

// 3D Canvas component for Hero Page
export function HeroCanvas() {
  return (
    <div className="w-full h-full relative min-h-[450px]">
      <Canvas shadows gl={{ antialias: true }}>
        <PerspectiveCamera makeDefault position={[3.5, 4, 6]} fov={45} />
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <pointLight position={[-10, 5, -10]} intensity={0.5} />
        <directionalLight position={[0, 10, 0]} intensity={1.0} />

        <Skyscraper autoRotate />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-[10px] tracking-widest uppercase text-white/40 pointer-events-none flex items-center gap-2">
        <span>Drag to rotate</span>
      </div>
    </div>
  );
}

// 3D Canvas component for Floor Selection Showcase
export function ShowcaseCanvas({ activeFloor, onSelectFloor }: {
  activeFloor: number;
  onSelectFloor: (floor: number) => void;
}) {
  return (
    <div className="w-full h-full relative min-h-[500px]">
      <Canvas shadows gl={{ antialias: true }}>
        <PerspectiveCamera makeDefault position={[4, 3, 5]} fov={50} />
        <ambientLight intensity={0.5} />
        <pointLight position={[8, 8, 8]} intensity={1.5} castShadow />
        <pointLight position={[-8, 4, -8]} intensity={0.5} />
        <directionalLight position={[0, 10, 0]} intensity={0.8} />

        <Skyscraper
          interactive
          activeFloor={activeFloor}
          onSelectFloor={onSelectFloor}
        />

        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={3}
          maxDistance={8}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-[10px] tracking-widest uppercase text-white/40 pointer-events-none flex flex-col items-center gap-1">
        <span>Click floor to select</span>
        <span>Scroll to Zoom</span>
      </div>
    </div>
  );
}
