import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './ModelViewer.css';

const ModelViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null); // 0–100 while loading
  // TODO: error state to be added

  const ModelViewerStyleObj: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
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

    setIsLoading(true); // show spinner immediately before any network requests
    setProgress(0); // start progress at 0%

    // Shared progress handler for both loaders
    // Always produce a sane 0..99 value during load
    const handleProgress = (e?: ProgressEvent<EventTarget>) => {
      let next: number | null = null;
      if (
        e &&
        typeof e.loaded === 'number' &&
        typeof e.total === 'number' &&
        e.total > 0
      ) {
        const loaded = e.loaded;
        const total = e.total;
        const pct = (loaded / total) * 100;
        if (Number.isFinite(pct)) next = Math.min(Math.round(pct), 99);
      }
      setProgress((prev) => {
        if (next !== null) return next;
        const fallback = prev == null ? 10 : Math.min(prev + 5, 95);
        return Number.isFinite(fallback) ? fallback : 0;
      });
    };

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
          setProgress(100);
          // small delay so 100% is visible for a beat
          setTimeout(() => {
            setIsLoading(false);
            setProgress(null);
          }, 120);
        },
        handleProgress,
        (error) => {
          console.error('Error loading PLY model:', error);
          setIsLoading(false);
          setProgress(null);
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
          setProgress(100);
          // small delay so 100% is visible for a beat
          setTimeout(() => {
            setIsLoading(false);
            setProgress(null);
          }, 100);
        },
        handleProgress,
        (error) => {
          console.error('Error loading GLTF model:', error);
          setIsLoading(false);
          setProgress(null);
        }
      );
    } else {
      console.error('Unsupported file extension:', ext);
      setIsLoading(false);
      setProgress(null);
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

  const label =
    progress == null
      ? null
      : Number.isFinite(progress)
      ? Math.round(progress)
      : 0;

  return (
    <div
      ref={containerRef}
      className="model-viewer-container"
      style={ModelViewerStyleObj}
    >
      {isLoading && (
        <div className="spinner-overlay">
          <div className="spinner"></div>
          {label != null && (
            <>
              <div className="spinner-text">{label}%</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${label}%` }} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelViewer;
