import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import './ModelViewer.css';

const ModelViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Three.js scene
    const scene = new THREE.Scene();

    // Set up camera
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);

    // Set up renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    containerRef.current.appendChild(renderer.domElement);

    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // Determine model URL from query params (default to a sample GLB if not provided)
    const params = new URLSearchParams(window.location.search);
    const modelUrl =
      params.get('fileUrl') ||
      'https://raw.githubusercontent.com/kelvinwatson/glb-files/main/DamagedHelmet.glb';
    const ext = modelUrl.split('.').pop()?.toLowerCase();

    // Load model based on file extension
    if (ext === 'ply') {
      const plyLoader = new PLYLoader();
      plyLoader.load(
        modelUrl,
        (geometry) => {
          geometry.computeVertexNormals(); // ensure lighting works
          const material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
          const mesh = new THREE.Mesh(geometry, material);
          scene.add(mesh);
          // (Camera positioning will be handled in a later story)
        },
        undefined,
        (error) => {
          console.error('Error loading PLY model:', error);
        }
      );
    } else if (ext === 'gltf' || ext === 'glb') {
      const gltfLoader = new GLTFLoader();
      gltfLoader.load(
        modelUrl,
        (gltf) => {
          scene.add(gltf.scene);
          // (Camera positioning will be handled in a later story)
        },
        undefined,
        (error) => {
          console.error('Error loading GLTF model:', error);
        }
      );
    } else {
      console.error('Unsupported file extension:', ext);
    }

    // Animation loop (renders the scene on each frame)
    let frameId: number;
    const container = containerRef.current; // Capture the ref value

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup on unmount
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      renderer.dispose();
      if (container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="model-viewer-container" />;
};

export default ModelViewer;
