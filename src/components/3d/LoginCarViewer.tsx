import { useEffect, useRef } from 'react';

const model = 'add7e3b87833433ab32d92ec97906172';
const options = {
  autostart: 1,
  camera: 0,
  transparent: 1,
  ui_theme: 'dark',
  ui_controls: 0,
  ui_general_controls: 0,
  ui_infos: 0,
  ui_hint: 0,
  ui_stop: 0,
  ui_inspector: 0,
  ui_annotations: 0,
  ui_animations: 0,
  ui_ar: 0,
  ui_vr: 0,
  ui_fullscreen: 0,
  ui_settings: 0,
  ui_help: 0,
  ui_watermark: 0,
  ui_watermark_link: 0,
};

type CameraPoint = [number, number, number];

type Viewer = {
  addEventListener(event: 'viewerready', callback: () => void): void;
  getCameraLookAt(callback: (error: unknown, camera: {
    position: CameraPoint;
    target: CameraPoint;
  }) => void): void;
  setCameraLookAt(position: CameraPoint, target: CameraPoint, duration: number): void;
};

type SketchfabClient = new (iframe: HTMLIFrameElement) => {
  init(id: string, config: typeof options & {
    success: (api: Viewer) => void;
    error: () => void;
  }): void;
};

let sdk: Promise<SketchfabClient> | undefined;

function loadViewer() {
  sdk ??= new Promise<SketchfabClient>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js';
    script.onload = () => {
      const client = (window as Window & { Sketchfab?: SketchfabClient }).Sketchfab;
      if (client) resolve(client);
      else reject(new Error('Sketchfab Viewer API no disponible'));
    };
    script.onerror = () => reject(new Error('No se pudo cargar Sketchfab'));
    document.head.append(script);
  });
  return sdk;
}

export default function LoginCarViewer() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let active = true;
    let initialZoomApplied = false;

    const fallback = () => {
      if (!active) return;
      const query = new URLSearchParams(
        Object.entries(options).map(([key, value]) => [key, String(value)]),
      );
      iframe.src = `https://sketchfab.com/models/${model}/embed?${query}`;
    };

    void loadViewer().then((Client) => {
      if (!active) return;
      new Client(iframe).init(model, {
        ...options,
        success: (api) => api.addEventListener('viewerready', () => {
          if (!active || initialZoomApplied) return;
          initialZoomApplied = true;
          api.getCameraLookAt((error, camera) => {
            if (error || !active) return;
            const { position, target } = camera;
            const distanceFactor = 1.8;
            const closerPosition: CameraPoint = [
              target[0] + (position[0] - target[0]) * distanceFactor,
              target[1] + (position[1] - target[1]) * distanceFactor,
              target[2] + (position[2] - target[2]) * distanceFactor,
            ];
            api.setCameraLookAt(closerPosition, target, 0);
          });
        }),
        error: fallback,
      });
    }).catch(fallback);

    return () => { active = false; };
  }, []);

  return (
    <div className="login-gallery">
      <iframe ref={iframeRef} title="Toyota Supra en 3D" allow="autoplay" />
    </div>
  );
}
