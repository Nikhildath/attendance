import * as faceapi from 'face-api.js';

export const loadModels = async () => {
  const MODEL_URL = '/models';
  try {
    console.log("Loading face-api models locally...");
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    console.log("Face-api models loaded successfully.");
  } catch (error) {
    console.error("Error loading face-api models:", error);
    throw error;
  }
};

export const getFaceDescriptor = async (videoElement: HTMLVideoElement) => {
  // Use TinyFaceDetector with higher input size for better accuracy on mobile
  const options = new faceapi.TinyFaceDetectorOptions({ 
    inputSize: 512, // Increased from 416 for better accuracy
    scoreThreshold: 0.5 
  });
  
  const result = await faceapi
    .detectSingleFace(videoElement, options)
    .withFaceLandmarks()
    .withFaceDescriptor();
    
  return result?.descriptor || null;
};

export const compareFaces = (descriptor1: Float32Array, descriptor2: Float32Array, threshold = 0.62) => {
  const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
  console.log("Face distance:", distance, "Threshold:", threshold);
  return {
    isMatch: distance < threshold,
    distance
  };
};
