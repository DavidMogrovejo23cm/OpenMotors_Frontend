/** Lector local de códigos: identifica una etiqueta, nunca registra movimientos. */
export const INVENTORY_BARCODE_FORMATS = [
  'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar',
] as const;

type Barcode = { rawValue: string };
export interface BarcodeDetectorConstructor {
  new (options: { formats: string[] }): { detect(source: HTMLVideoElement): Promise<Barcode[]> };
  getSupportedFormats(): Promise<string[]>;
}
interface ScannerEnvironment {
  secureContext: boolean;
  Detector?: BarcodeDetectorConstructor;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel: (id: ReturnType<typeof setTimeout>) => void;
}

export function barcodeCameraError(error: unknown): string {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Permite el acceso a la cámara en los ajustes del navegador y vuelve a intentar.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No se encontró una cámara en este dispositivo.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'La cámara está ocupada. Cierra otras aplicaciones que la estén usando e inténtalo otra vez.';
  return error instanceof Error ? error.message : 'No se pudo iniciar la cámara. Puedes escribir el código manualmente.';
}

export function startBarcodeScanner(
  video: HTMLVideoElement,
  onRead: (code: string) => void,
  onError: (error: unknown) => void,
  overrides: Partial<ScannerEnvironment> = {},
) {
  const env: ScannerEnvironment = {
    secureContext: globalThis.isSecureContext === true,
    Detector: (globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector,
    getUserMedia: globalThis.navigator?.mediaDevices?.getUserMedia?.bind(globalThis.navigator.mediaDevices),
    schedule: (fn, delay) => setTimeout(fn, delay), cancel: id => clearTimeout(id), ...overrides,
  };
  let stopped = false;
  let stream: MediaStream | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    stopped = true;
    if (timer !== undefined) env.cancel(timer);
    stream?.getTracks().forEach(track => track.stop());
    if (stream && video.srcObject === stream) { video.pause(); video.srcObject = null; }
    stream = undefined;
  };
  const ready = (async () => {
    try {
      if (!env.secureContext) throw new Error('Abre la aplicación mediante HTTPS para usar la cámara del teléfono.');
      if (!env.Detector || !env.getUserMedia) throw new Error('Este navegador no admite el lector de cámara. Prueba con Chrome actualizado en Android o escribe el código manualmente.');
      const supported = await env.Detector.getSupportedFormats();
      if (stopped) return;
      const formats = INVENTORY_BARCODE_FORMATS.filter(format => supported.includes(format));
      if (!formats.length) throw new Error('Este dispositivo no admite los formatos de código de barras del inventario. Puedes escribir el código manualmente.');
      const detector = new env.Detector({ formats });
      const acquired = await env.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      if (stopped) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired;
      video.srcObject = stream;
      await video.play();
      if (stopped) return;
      const scan = async () => {
        if (stopped) return;
        try {
          if (video.readyState >= 2) {
            const results = await detector.detect(video);
            if (stopped) return;
            const code = results.map(result => result.rawValue?.trim()).find(Boolean);
            if (code) { stop(); onRead(code); return; }
          }
          timer = env.schedule(() => { void scan(); }, 180);
        } catch (error) {
          if (!stopped) { stop(); onError(error); }
        }
      };
      void scan();
    } catch (error) {
      if (!stopped) { stop(); throw error; }
    }
  })();
  return { stop, ready };
}
