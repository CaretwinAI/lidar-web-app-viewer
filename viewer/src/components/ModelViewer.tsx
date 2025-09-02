import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './ModelViewer.css';

const ModelViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const ModelViewerStyleObj = {
    width: '100%',
    height: '100%',
  };

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // on resize (you already have width/height reads elsewhere)
    window.addEventListener('resize', () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    // set up orbit controls for camera interaction
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    // controls.dampingFactor = 0.25;
    // controls.screenSpacePanning = false;
    // controls.maxPolarAngle = Math.PI / 2;

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
          // Adjust camera to fit the loaded model
          const box = new THREE.Box3().setFromObject(mesh);
          const sphere = box.getBoundingSphere(new THREE.Sphere());
          if (sphere) {
            const center = sphere.center;
            const radius = sphere.radius;
            camera.position.set(center.x, center.y, center.z + radius * 2);
            camera.lookAt(center);
            if (camera instanceof THREE.PerspectiveCamera) {
              camera.updateProjectionMatrix();
            }
            controls.target.copy(center);
            controls.update();
          }
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
          // Adjust camera to fit the loaded model
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const sphere = box.getBoundingSphere(new THREE.Sphere());
          if (sphere) {
            const center = sphere.center;
            const radius = sphere.radius;
            camera.position.set(center.x, center.y, center.z + radius * 2);
            camera.lookAt(center);
            if (camera instanceof THREE.PerspectiveCamera) {
              camera.updateProjectionMatrix();
            }
            controls.target.copy(center);
            controls.update();
          }
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
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Update camera and renderer on window resize
    const onWindowResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', onWindowResize);

    // Cleanup on unmount
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      renderer.dispose();
      window.removeEventListener('resize', onWindowResize);
      if (container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="model-viewer-container"
      style={ModelViewerStyleObj}
    />
  );
};

export default ModelViewer;
