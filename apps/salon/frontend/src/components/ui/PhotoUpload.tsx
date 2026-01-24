import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

interface Props {
  currentUrl?: string | null;
  onUpload: (url: string) => void;
  color?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PhotoUpload({ currentUrl, onUpload, color = '#D4A5A5', name = '', size = 'md' }: Props) {
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 400, height: 400 },
      });
      setStream(mediaStream);
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error('Camera access denied:', err);
      alert('Could not access camera. Please check permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
    setCapturedImage(null);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(dataUrl);
      }
    }
  }, []);

  const usePhoto = useCallback(() => {
    if (capturedImage) {
      onUpload(capturedImage);
      stopCamera();
    }
  }, [capturedImage, onUpload, stopCamera]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          onUpload(result);
        };
        reader.readAsDataURL(file);
      }
    },
    [onUpload]
  );

  const removePhoto = useCallback(() => {
    onUpload('');
  }, [onUpload]);

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        {/* Avatar Display */}
        <div
          className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center text-white font-medium relative group`}
          style={{ backgroundColor: currentUrl ? undefined : color }}
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className={size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm'}>
              {initials || '?'}
            </span>
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 bg-white rounded-full hover:bg-gray-100"
              title="Upload photo"
            >
              <Upload className="w-4 h-4 text-warm-700" />
            </button>
            <button
              onClick={startCamera}
              className="p-1 bg-white rounded-full hover:bg-gray-100"
              title="Take photo"
            >
              <Camera className="w-4 h-4 text-warm-700" />
            </button>
            {currentUrl && (
              <button
                onClick={removePhoto}
                className="p-1 bg-white rounded-full hover:bg-gray-100"
                title="Remove photo"
              >
                <X className="w-4 h-4 text-red-500" />
              </button>
            )}
          </div>
        </div>

        {/* Upload/Camera buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            Upload
          </button>
          <span className="text-warm-300">|</span>
          <button
            onClick={startCamera}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            Camera
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Camera Modal */}
      <Modal isOpen={showCamera} onClose={stopCamera} title="Take Photo">
        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden aspect-square max-w-md mx-auto">
            {!capturedImage ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <div className="flex justify-center gap-3">
            {!capturedImage ? (
              <>
                <Button variant="secondary" onClick={stopCamera}>
                  Cancel
                </Button>
                <Button onClick={capturePhoto}>
                  <Camera className="w-4 h-4 mr-2" />
                  Capture
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setCapturedImage(null)}>
                  Retake
                </Button>
                <Button onClick={usePhoto}>Use Photo</Button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
