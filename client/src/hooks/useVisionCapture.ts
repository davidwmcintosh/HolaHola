import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * useVisionCapture — opt-in webcam + screen share for Daniela.
 *
 * Captures frames at 0.5fps (one frame every 2 seconds) and forwards them
 * as base64 JPEG via the GL sendRealtimeInput video channel.  The model
 * decides what to do with what it sees — no scripting here.
 *
 * Gemini guidance (June 2026 audit):
 *  - 640×480 webcam / 1280×720 screen is the sweet spot for quality vs. cost
 *  - 0.5fps ≈ 7,500 vision tokens/min (vs. audio-only baseline)
 *  - Separate sendRealtimeInput calls from audio to avoid TCP head-of-line blocking
 *  - JPEG quality 0.6 — sufficient for emotional sensing, robust against compression
 */
export function useVisionCapture(
  sendVideoFrame: ((data: string, source: string) => void) | undefined,
  isConnected: boolean
) {
  const [webcamActive, setWebcamActive] = useState(false);
  const [screenActive, setScreenActive]   = useState(false);
  const webcamStreamRef   = useRef<MediaStream | null>(null);
  const screenStreamRef   = useRef<MediaStream | null>(null);
  const webcamVideoRef    = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef    = useRef<HTMLVideoElement | null>(null);
  const webcamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const screenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureCanvasRef  = useRef<HTMLCanvasElement | null>(null);

  const captureFrame = useCallback((videoEl: HTMLVideoElement, source: 'webcam' | 'screen') => {
    if (!videoEl.videoWidth || !videoEl.videoHeight || !sendVideoFrame) return;
    if (!captureCanvasRef.current) captureCanvasRef.current = document.createElement('canvas');
    const canvas = captureCanvasRef.current;
    canvas.width  = source === 'screen' ? 1280 : 640;
    canvas.height = Math.round(canvas.width * videoEl.videoHeight / videoEl.videoWidth);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      const base64  = dataUrl.split(',')[1];
      if (base64) sendVideoFrame(base64, source);
    } catch {
      // Cross-origin canvas restriction — ignore silently
    }
  }, [sendVideoFrame]);

  const stopWebcam = useCallback(() => {
    if (webcamIntervalRef.current) { clearInterval(webcamIntervalRef.current); webcamIntervalRef.current = null; }
    webcamStreamRef.current?.getTracks().forEach(t => t.stop());
    webcamStreamRef.current  = null;
    webcamVideoRef.current   = null;
    setWebcamActive(false);
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenIntervalRef.current) { clearInterval(screenIntervalRef.current); screenIntervalRef.current = null; }
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current  = null;
    screenVideoRef.current   = null;
    setScreenActive(false);
  }, []);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      webcamStreamRef.current = stream;
      const video = document.createElement('video');
      video.srcObject  = stream;
      video.muted      = true;
      video.playsInline = true;
      await video.play();
      webcamVideoRef.current = video;
      stream.getVideoTracks()[0].addEventListener('ended', stopWebcam);
      webcamIntervalRef.current = setInterval(() => {
        if (webcamVideoRef.current) captureFrame(webcamVideoRef.current, 'webcam');
      }, 2000);
      setWebcamActive(true);
    } catch (err) {
      console.error('[Vision] Webcam access denied or unavailable:', err);
    }
  }, [captureFrame, stopWebcam]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { width: 1280, height: 720 },
      });
      screenStreamRef.current = stream;
      const video = document.createElement('video');
      video.srcObject   = stream;
      video.muted       = true;
      video.playsInline = true;
      await video.play();
      screenVideoRef.current = video;
      // User can also end share via the browser's native "Stop sharing" UI
      stream.getVideoTracks()[0].addEventListener('ended', stopScreenShare);
      screenIntervalRef.current = setInterval(() => {
        if (screenVideoRef.current) captureFrame(screenVideoRef.current, 'screen');
      }, 2000);
      setScreenActive(true);
    } catch (err) {
      console.error('[Vision] Screen share denied or unavailable:', err);
    }
  }, [captureFrame, stopScreenShare]);

  // Stop everything when the session disconnects
  useEffect(() => {
    if (!isConnected) {
      stopWebcam();
      stopScreenShare();
    }
  }, [isConnected, stopWebcam, stopScreenShare]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopWebcam();
      stopScreenShare();
    };
  }, [stopWebcam, stopScreenShare]);

  return {
    webcamActive,
    screenActive,
    toggleWebcam:       webcamActive ? stopWebcam      : startWebcam,
    toggleScreen:       screenActive ? stopScreenShare : startScreenShare,
    isVisionSupported:  !!(navigator.mediaDevices?.getUserMedia),
  };
}
