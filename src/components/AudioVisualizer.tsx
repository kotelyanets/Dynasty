/**
 * AudioVisualizer.tsx — WebGL Audio Visualizer (Siri Sphere)
 * ─────────────────────────────────────────────────────────────
 * A Three.js pulsating sphere that reacts to audio frequencies.
 * The sphere morphs its shape based on bass, mids, and treble,
 * creating a Siri-like visual effect.
 *
 * Activated by tapping the album art on the NowPlaying screen.
 *
 * Performance optimisations (mobile-first):
 *   • Geometry detail 2 (162 vertices vs 2562 at detail 4)
 *   • MeshBasicMaterial (no lighting calculations needed for wireframe)
 *   • Antialias disabled, pixel ratio capped at 1.5
 *   • Rendering throttled to ~30 fps
 *   • Pauses entirely when the browser tab is hidden
 *   • Reuses Color object to avoid GC pressure
 *   • Full dispose of geometry / material / renderer on cleanup
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

/** Target interval between frames (~30 fps). */
const FRAME_INTERVAL_MS = 1000 / 30;

export function AudioVisualizer({ active, size = 300 }: AudioVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const animFrameRef = useRef<number>(0);
  const originalPositionsRef = useRef<Float32Array | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Reusable Color object — avoids allocation every frame
  const tmpColorRef = useRef(new THREE.Color());

  const initScene = useCallback(() => {
    if (!containerRef.current || initialized) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 2.5;
    cameraRef.current = camera;

    // Renderer — antialias off & lower pixel ratio for mobile perf
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Sphere geometry — detail 2 gives 162 vertices (vs 2562 at 4)
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0xfc3c44,
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

    setInitialized(true);
  }, [size, initialized]);

  // Initialize scene when activated
  useEffect(() => {
    if (active) {
      initScene();
    }
  }, [active, initScene]);

  // Animation loop — throttled to ~30 fps, pauses when tab hidden
  useEffect(() => {
    if (!active || !initialized) return;

    const analyser = getAnalyserNode();
    const dataArray = analyser
      ? new Uint8Array(analyser.frequencyBinCount)
      : new Uint8Array(32);

    let time = 0;
    let lastFrame = 0;
    let paused = false;

    const onVisibility = () => {
      paused = document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);

    const animate = (now: number) => {
      animFrameRef.current = requestAnimationFrame(animate);

      // Skip frames to stay ≤ 30 fps & skip entirely when tab hidden
      if (paused || now - lastFrame < FRAME_INTERVAL_MS) return;
      lastFrame = now;

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

      // Calculate average frequency bands (inline sums — no .slice())
      let bassSum = 0;
      for (let i = 0; i < 4; i++) bassSum += dataArray[i] ?? 0;
      const bass = bassSum / (4 * 255);

      let midSum = 0;
      for (let i = 4; i < 12; i++) midSum += dataArray[i] ?? 0;
      const mid = midSum / (8 * 255);

      let trebleSum = 0;
      const trebleLen = Math.max(1, dataArray.length - 12);
      for (let i = 12; i < dataArray.length; i++) trebleSum += dataArray[i] ?? 0;
      const treble = trebleSum / (trebleLen * 255);

      // Morph sphere based on frequency
      const geometry = sphere.geometry as THREE.BufferGeometry;
      const positions = geometry.getAttribute('position');
      const posArray = positions.array as Float32Array;

      for (let i = 0; i < posArray.length; i += 3) {
        const ox = originalPositions[i];
        const oy = originalPositions[i + 1];
        const oz = originalPositions[i + 2];

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

      // Update material color — reuse tmpColor to avoid allocation
      const material = sphere.material as THREE.MeshBasicMaterial;
      const hue = (0.98 + mid * 0.1) % 1;
      tmpColorRef.current.setHSL(hue, 0.8, 0.5 + bass * 0.2);
      material.color.copy(tmpColorRef.current);
      material.opacity = 0.6 + bass * 0.4;

      renderer.render(scene, camera);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [active, initialized]);

  // Full cleanup on unmount — dispose geometry, material, renderer
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      const sphere = sphereRef.current;
      if (sphere) {
        sphere.geometry.dispose();
        (sphere.material as THREE.Material).dispose();
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.domElement.remove();
        rendererRef.current = null;
      }

      sceneRef.current = null;
      cameraRef.current = null;
      sphereRef.current = null;
      originalPositionsRef.current = null;
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
