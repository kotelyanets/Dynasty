/**
 * AudioVisualizer.tsx — WebGL Audio Visualizer (Siri Sphere)
 * ─────────────────────────────────────────────────────────────
 * A Three.js pulsating sphere that reacts to audio frequencies.
 * The sphere morphs its shape based on bass, mids, and treble,
 * creating a Siri-like visual effect.
 *
 * Activated by tapping the album art on the NowPlaying screen.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { getAnalyserNode } from '@/audio/audioContext';

interface AudioVisualizerProps {
  /** Whether the visualizer is visible */
  active: boolean;
  /** Container size in pixels */
  size?: number;
}

export function AudioVisualizer({ active, size = 300 }: AudioVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const animFrameRef = useRef<number>(0);
  const originalPositionsRef = useRef<Float32Array | null>(null);
  const [initialized, setInitialized] = useState(false);

  const initScene = useCallback(() => {
    if (!containerRef.current || initialized) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 2.5;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Sphere geometry
    const geometry = new THREE.IcosahedronGeometry(1, 4);
    const material = new THREE.MeshPhongMaterial({
      color: 0xfc3c44,
      emissive: 0xfc3c44,
      emissiveIntensity: 0.3,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    sphereRef.current = sphere;

    // Store original vertex positions for morphing
    const positions = geometry.getAttribute('position');
    originalPositionsRef.current = new Float32Array(positions.array);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xfc3c44, 2, 10);
    pointLight.position.set(2, 2, 2);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0x6366f1, 1.5, 10);
    pointLight2.position.set(-2, -2, 2);
    scene.add(pointLight2);

    setInitialized(true);
  }, [size, initialized]);

  // Initialize scene when activated
  useEffect(() => {
    if (active) {
      initScene();
    }
  }, [active, initScene]);

  // Animation loop
  useEffect(() => {
    if (!active || !initialized) return;

    const analyser = getAnalyserNode();
    const dataArray = analyser
      ? new Uint8Array(analyser.frequencyBinCount)
      : new Uint8Array(32);

    let time = 0;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      time += 0.01;

      const sphere = sphereRef.current;
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const originalPositions = originalPositionsRef.current;

      if (!sphere || !renderer || !scene || !camera || !originalPositions) return;

      // Get frequency data
      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
      }

      // Calculate average frequency bands
      const bass = dataArray.slice(0, 4).reduce((a, b) => a + b, 0) / (4 * 255);
      const mid = dataArray.slice(4, 12).reduce((a, b) => a + b, 0) / (8 * 255);
      const treble = dataArray.slice(12).reduce((a, b) => a + b, 0) / (Math.max(1, dataArray.length - 12) * 255);

      // Morph sphere based on frequency
      const geometry = sphere.geometry as THREE.BufferGeometry;
      const positions = geometry.getAttribute('position');
      const posArray = positions.array as Float32Array;

      for (let i = 0; i < posArray.length; i += 3) {
        const ox = originalPositions[i];
        const oy = originalPositions[i + 1];
        const oz = originalPositions[i + 2];

        // Calculate displacement based on position and frequency
        const noise = Math.sin(ox * 3 + time * 2) * Math.cos(oy * 3 + time * 1.5) * Math.sin(oz * 3 + time);
        const displacement = 1 + (bass * 0.3 + mid * 0.15 + treble * 0.1) + noise * 0.08 * (1 + bass);

        posArray[i] = ox * displacement;
        posArray[i + 1] = oy * displacement;
        posArray[i + 2] = oz * displacement;
      }
      positions.needsUpdate = true;

      // Rotate slowly
      sphere.rotation.x += 0.003;
      sphere.rotation.y += 0.005;

      // Update material color based on frequency
      const material = sphere.material as THREE.MeshPhongMaterial;
      const hue = 0.98 + mid * 0.1; // Shift from red toward purple with mids
      const color = new THREE.Color();
      color.setHSL(hue % 1, 0.8, 0.5 + bass * 0.2);
      material.color = color;
      material.emissive = color;
      material.emissiveIntensity = 0.2 + bass * 0.5;
      material.opacity = 0.6 + bass * 0.4;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [active, initialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.domElement.remove();
      }
    };
  }, []);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center"
      style={{ width: size, height: size }}
    />
  );
}
