import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

export function HandGestureController({ onGesture }: { onGesture: (gesture: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [model, setModel] = useState<any>(null);

  useEffect(() => {
    async function loadModel() {
      await tf.ready();
      try {
        const loadedModel = await handpose.load();
        setModel(loadedModel);
      } catch (err) {
        console.warn("Failed to load handpose model", err);
      }
    }
    loadModel();
  }, []);

  useEffect(() => {
    if (!model || !videoRef.current) return;

    let animationFrame: number;
    const video = videoRef.current;

    async function setupCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser API navigator.mediaDevices.getUserMedia not available');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: 320, height: 240 },
      });
      video.srcObject = stream;
      
      return new Promise((resolve) => {
        video.onloadedmetadata = () => {
          resolve(video);
        };
      });
    }

    async function detect() {
      if (video.readyState >= 2) {
        const predictions = await model.estimateHands(video);
        if (predictions.length > 0) {
          const landmarks = predictions[0].landmarks;
          detectGesture(landmarks);
        }
      }
      animationFrame = requestAnimationFrame(detect);
    }

    function detectGesture(landmarks: any) {
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];
      const pinkyTip = landmarks[20];
      
      const thumbBase = landmarks[2];
      
      const dist = (p1: any, p2: any) => Math.hypot(p1[0]-p2[0], p1[1]-p2[1], p1[2]-p2[2]);
      
      const pinchDist = dist(thumbTip, indexTip);
      const isPinch = pinchDist < 30;
      
      const isFist = dist(indexTip, thumbBase) < 50 && dist(middleTip, thumbBase) < 50;
      const isOpenPalm = dist(indexTip, thumbBase) > 100 && dist(middleTip, thumbBase) > 100 && dist(pinkyTip, thumbBase) > 100;
      
      if (isPinch) onGesture('PINCH');
      else if (isFist) onGesture('FIST');
      else if (isOpenPalm) onGesture('PALM');
      else onGesture('NONE');
    }

    setupCamera().then(() => {
      video.play();
      detect();
    }).catch(err => {
      console.warn('Camera not available for gestures:', err);
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [model, onGesture]);

  return (
    <video
      ref={videoRef}
      style={{ display: 'none' }}
      playsInline
      muted
    />
  );
}
