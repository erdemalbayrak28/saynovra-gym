import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';
import { Label } from './ui';

type CameraState = 'starting' | 'running' | 'denied' | 'unavailable';

const SCAN_INTERVAL_MS = 150;
/** Frames are downscaled before decoding; a phone QR held at the camera stays readable. */
const DECODE_WIDTH = 640;

const STATE_TEXT: Record<Exclude<CameraState, 'running'>, string> = {
  starting: 'Kamera açılıyor',
  denied: 'Kamera izni verilmedi. Adres çubuğundaki kamera simgesinden izin verin.',
  unavailable: 'Kamera bulunamadı. Bu sayfa kamerayı yalnızca localhost üzerinden kullanabilir.',
};

/**
 * Reads QR codes from the default camera. `paused` stops decoding without releasing the camera,
 * so the preview stays live while a result is on screen.
 */
export function QrScanner({ onCode, paused, short = false }: { onCode: (text: string) => void; paused: boolean; short?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const pausedRef = useRef(paused);
  const [state, setState] = useState<CameraState>('starting');

  useEffect(() => {
    onCodeRef.current = onCode;
    pausedRef.current = paused;
  });

  useEffect(() => {
    let stream: MediaStream | undefined;
    let frame = 0;
    let lastDecode = 0;
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const decode = (video: HTMLVideoElement) => {
      if (!context || video.videoWidth === 0) return;
      const scale = Math.min(1, DECODE_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
      if (result?.data) onCodeRef.current(result.data);
    };

    const tick = (time: number) => {
      const video = videoRef.current;
      if (video && !pausedRef.current && time - lastDecode >= SCAN_INTERVAL_MS) {
        lastDecode = time;
        decode(video);
      }
      frame = requestAnimationFrame(tick);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err) {
        setState(err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'unavailable');
        return;
      }
      const video = videoRef.current;
      if (cancelled || !video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay of a muted inline video is allowed; a rejection here means the element went away.
      }
      if (cancelled) return;
      setState('running');
      frame = requestAnimationFrame(tick);
    };

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line bg-black ${short ? 'aspect-video' : 'aspect-[4/3]'}`}>
      <video ref={videoRef} className="h-full w-full -scale-x-100 object-cover" muted playsInline />

      {state === 'running' ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative aspect-square h-[62%]">
            {(['left-0 top-0 border-l-4 border-t-4', 'right-0 top-0 border-r-4 border-t-4', 'bottom-0 left-0 border-b-4 border-l-4', 'bottom-0 right-0 border-b-4 border-r-4'] as const).map(
              (corner) => (
                <span key={corner} className={`absolute size-10 rounded-sm border-lime ${corner}`} />
              ),
            )}
            {!paused && <span className="absolute inset-x-3 h-0.5 animate-scan bg-lime shadow-[0_0_12px_#c8f031]" />}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 grid place-items-center p-8 text-center">
          <p className="max-w-xs text-sm text-muted">{STATE_TEXT[state]}</p>
        </div>
      )}

      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-black/70 px-2.5 py-1 backdrop-blur">
        <span className={`size-2 rounded-full ${state === 'running' ? 'animate-pulse bg-ok' : 'bg-muted'}`} />
        <Label className="text-text">{state === 'running' ? 'Kamera açık' : 'Kamera kapalı'}</Label>
      </div>
    </div>
  );
}
