import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface CameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

export function CameraScanner({ isOpen, onClose, onScan }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasScanned, setHasScanned] = useState(false);

  // Stop camera tracks cleanly
  function stopCamera() {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }

  // Start video stream from selected camera
  async function startCamera() {
    stopCamera();
    setCameraError(null);
    setIsInitializing(true);
    setHasScanned(false);

    // Check if mediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported by your browser or environment. You can upload a QR image instead.');
      setIsInitializing(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play();
        setIsInitializing(false);
        requestScanFrame();
      }
    } catch (err) {
      setIsInitializing(false);
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setCameraError('Camera permission was denied. Please allow camera access in your browser or upload a QR image.');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setCameraError('No camera found on this device. You can upload a QR image below.');
      } else {
        setCameraError('Unable to open camera stream. Please check permissions or use image upload.');
      }
    }
  }

  // Frame processing loop
  function requestScanFrame() {
    if (!isOpen || hasScanned) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data && code.data.trim()) {
          setHasScanned(true);
          // Haptic feedback if available on mobile
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate?.([60, 40, 60]);
            } catch {
              // ignore vibration error
            }
          }
          stopCamera();
          onScan(code.data.trim());
          onClose();
          return;
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(requestScanFrame);
  }

  // Switch between front and back camera
  function toggleCamera() {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  }

  // File upload fallback: reads and decodes image using jsQR
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCameraError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, img.width, img.height);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code && code.data && code.data.trim()) {
            stopCamera();
            onScan(code.data.trim());
            onClose();
          } else {
            setCameraError('No valid QR code could be found in the uploaded image. Please try a clearer image.');
          }
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <div
      className="scanner-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-modal-title"
    >
      <div className="scanner-modal-content">
        <header className="scanner-modal-header">
          <div>
            <h2 id="scanner-modal-title">Live QR Camera Scanner</h2>
            <p>Point your camera at a UPI QR code to scan and verify instantly</p>
          </div>
          <button
            type="button"
            className="scanner-close-button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Close camera scanner"
          >
            ✕
          </button>
        </header>

        {cameraError ? (
          <div className="scanner-error-container">
            <p className="scanner-error-text">{cameraError}</p>
            <div className="scanner-fallback-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => fileInputRef.current?.click()}
              >
                📁 Upload QR Image Instead
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={startCamera}
              >
                ↻ Try Camera Again
              </button>
            </div>
          </div>
        ) : (
          <div className="scanner-viewfinder-container">
            <video
              ref={videoRef}
              className="scanner-video-feed"
              playsInline
              muted
              autoPlay
            />
            {/* Hidden canvas for jsQR frame decoding */}
            <canvas ref={canvasRef} className="scanner-hidden-canvas" />

            {/* Viewfinder Reticle Overlay */}
            <div className="scanner-reticle" aria-hidden="true">
              <div className="reticle-corner top-left" />
              <div className="reticle-corner top-right" />
              <div className="reticle-corner bottom-left" />
              <div className="reticle-corner bottom-right" />
              <div className="scanner-laser" />
            </div>

            {isInitializing && (
              <div className="scanner-status-pill">Starting camera feed...</div>
            )}
            {!isInitializing && !hasScanned && (
              <div className="scanner-status-pill scanning">
                Align QR code within frame
              </div>
            )}
          </div>
        )}

        <footer className="scanner-modal-footer">
          <button
            type="button"
            className="secondary-button scanner-action-btn"
            onClick={toggleCamera}
            disabled={Boolean(cameraError)}
            title="Switch between front and back camera"
          >
            🔄 Switch Camera
          </button>

          <button
            type="button"
            className="secondary-button scanner-action-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload an image file containing a QR code"
          >
            📁 Upload Image
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
        </footer>
      </div>
    </div>
  );
}
