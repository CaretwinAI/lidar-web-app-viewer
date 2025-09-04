import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './ModelViewer.css';

const ModelViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastUrl, setLastUrl] = useState<string>('');
  const abortController = useRef<AbortController | null>(null);

  const ModelViewerStyleObj: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current; // Capture ref value

    const scene = new THREE.Scene();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = 'block'; // avoid inline-canvas baseline gaps
    containerRef.current.appendChild(renderer.domElement);

    const onWindowResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', onWindowResize);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    const params = new URLSearchParams(window.location.search);
    const modelUrl =
      params.get('fileUrl') ||
      'https://raw.githubusercontent.com/kelvinwatson/glb-files/main/DamagedHelmet.glb';
    const ext = modelUrl.split('.').pop()?.toLowerCase();
    setLastUrl(modelUrl);

    setError(null);
    setIsLoading(true);
    setProgress(0);

    abortController.current?.abort();
    abortController.current = new AbortController();

    const handleProgress = (e?: ProgressEvent<EventTarget>) => {
      let next: number | null = null;
      if (e && 'loaded' in e && 'total' in e) {
        const loaded = (e as ProgressEvent).loaded;
        const total = (e as ProgressEvent).total;
        if (total > 0) {
          const pct = (loaded / total) * 100;
          if (Number.isFinite(pct)) next = Math.min(Math.round(pct), 99);
        }
      }
      setProgress((prev) => {
        if (next !== null) return next;
        const fallback = prev == null ? 10 : Math.min(prev + 5, 95);
        return Number.isFinite(fallback) ? fallback : 0;
      });
    };

    if (ext === 'ply') {
      new PLYLoader().load(
        modelUrl,
        (geometry) => {
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
          const mesh = new THREE.Mesh(geometry, material);
          scene.add(mesh);

          const box = new THREE.Box3().setFromObject(mesh);
          const sphere = box.getBoundingSphere(new THREE.Sphere());
          if (sphere) {
            const { center, radius } = sphere;
            camera.position.set(center.x, center.y, center.z + radius * 2);
            camera.lookAt(center);
            camera.updateProjectionMatrix();
            controls.target.copy(center);
            controls.update();
          }

          setProgress(100);
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
      new GLTFLoader().load(
        modelUrl,
        (gltf) => {
          scene.add(gltf.scene);

          const box = new THREE.Box3().setFromObject(gltf.scene);
          const sphere = box.getBoundingSphere(new THREE.Sphere());
          if (sphere) {
            const { center, radius } = sphere;
            camera.position.set(center.x, center.y, center.z + radius * 2);
            camera.lookAt(center);
            camera.updateProjectionMatrix();
            controls.target.copy(center);
            controls.update();
          }

          setProgress(100);
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

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      renderer.dispose();
      window.removeEventListener('resize', onWindowResize);
      if (container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [reloadKey]);

  const handleRetry = () => {
    setError(null);
    setReloadKey((k) => k + 1);
  };

  const handleDismiss = () => {
    abortController.current?.abort();
    interface WebkitWindow extends Window {
      webkit?: {
        messageHandlers?: {
          viewer?: {
            postMessage?: (msg: unknown) => void;
          };
        };
      };
    }
    const viewerHandler = (window as WebkitWindow).webkit?.messageHandlers
      ?.viewer;
    viewerHandler?.postMessage?.({
      type: 'viewerError',
      error,
      url: lastUrl || null,
    });
    setError(null);
  };

  const handleCancel = () => {
    abortController.current?.abort();
    setIsLoading(false);
    setProgress(null);
    interface WebkitWindow extends Window {
      webkit?: {
        messageHandlers?: {
          viewer?: {
            postMessage?: (msg: unknown) => void;
          };
        };
      };
    }
    const viewerHandler = (window as WebkitWindow).webkit?.messageHandlers
      ?.viewer;
    viewerHandler?.postMessage?.({
      type: 'viewerCanceled',
      url: lastUrl || null,
    });
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
                <div className="progress-fill" style={{ width: `${label}%` }} />
              </div>
            </>
          )}
          <button
            type="button"
            className="cancel-button"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default ModelViewer;
