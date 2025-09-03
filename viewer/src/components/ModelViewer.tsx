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
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // trigger re-run of loader
  const [lastUrl, setLastUrl] = useState<string>('');

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

    // on resize
    const onWindowResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', onWindowResize);

    // set up orbit controls for camera interaction
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

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
    setLastUrl(modelUrl);

    // reset error + show spinner
    setError(null);
    setIsLoading(true);
    setProgress(0);

    // Shared progress handler for both loaders (produces 0..99 until success)
    const handleProgress = (e?: ProgressEvent<EventTarget>) => {
      let next: number | null = null;
      if (
        e &&
        'loaded' in e &&
        'total' in e &&
        typeof (e as ProgressEvent<EventTarget>).loaded === 'number' &&
        typeof (e as ProgressEvent<EventTarget>).total === 'number' &&
        (e as ProgressEvent<EventTarget>).total > 0
      ) {
        const loaded = (e as ProgressEvent<EventTarget>).loaded;
        const total = (e as ProgressEvent<EventTarget>).total;
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
        (err) => {
          console.error('Error loading PLY model:', err);
          setIsLoading(false);
          setProgress(null);
          setError('Failed to load model (PLY). Please check the URL or file.');
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
        (err) => {
          console.error('Error loading GLTF model:', err);
          setIsLoading(false);
          setProgress(null);
          setError(
            'Failed to load model (GLB/GLTF). Please check the URL or file.'
          );
        }
      );
    } else {
      console.error('Unsupported file extension:', ext);
      setIsLoading(false);
      setProgress(null);
      setError(`Unsupported file type: ${ext ?? '(unknown)'}`);
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

    // Cleanup on unmount
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      renderer.dispose();
      window.removeEventListener('resize', onWindowResize);
      if (container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [reloadKey]);

  // Retry: re-run the effect by bumping the key

  const handleRetry = () => {
    setError(null);
    setReloadKey((k) => k + 1);
  };

  // Dismiss: send bridge message (if in WKWebView) then hide banner
  const handleDismiss = () => {
    const viewerHandler = (
      window as Window & {
        webkit?: {
          messageHandlers?: {
            viewer?: {
              postMessage?: (msg: unknown) => void;
            };
          };
        };
      }
    )?.webkit?.messageHandlers?.viewer;
    try {
      if (viewerHandler && typeof viewerHandler.postMessage === 'function') {
        viewerHandler.postMessage({
          type: 'viewerError',
          error,
          url: lastUrl || null,
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      // no-op: fail silently if not in WKWebView
    }
    setError(null);
  };

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
      {error && (
        <div className="error-banner" role="alert" aria-live="polite">
          <span className="error-banner__text">{error}</span>
          <div className="error-banner__actions">
            <button
              type="button"
              className="error-banner__retry"
              onClick={handleRetry}
            >
              Retry
            </button>
            <button
              type="button"
              className="error-banner__close"
              aria-label="Dismiss error"
              onClick={handleDismiss}
            >
              ×
            </button>
          </div>
        </div>
      )}
      {isLoading && (
        <div className="spinner-overlay">
          <div className="spinner"></div>
          {label != null && (
            <>
              <div className="spinner-text">{label}%</div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ ['--progress-width' as string]: `${label}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelViewer;
