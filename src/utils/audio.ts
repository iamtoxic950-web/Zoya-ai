export function pcmToBase64(pcmData: Float32Array): string {
  const buffer = new ArrayBuffer(pcmData.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < pcmData.length; i++) {
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Downsamples arbitrary AudioContext sample rate to 16000Hz and normalizes soft speech levels
 * so normal/quiet conversational voice is always clear and in standard 16kHz mono PCM WAV format.
 */
export function pcmToWavBase64(pcmData: Float32Array, inputSampleRate = 16000): string {
  const targetSampleRate = 16000;
  let processedData = pcmData;

  if (inputSampleRate > 0 && inputSampleRate !== targetSampleRate) {
    const ratio = inputSampleRate / targetSampleRate;
    const newLength = Math.max(1, Math.round(pcmData.length / ratio));
    const resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(pcmData.length, Math.floor((i + 1) * ratio));
      if (end > start) {
        let sum = 0;
        for (let j = start; j < end; j++) {
          sum += pcmData[j];
        }
        resampled[i] = sum / (end - start);
      } else {
        resampled[i] = pcmData[Math.min(start, pcmData.length - 1)] || 0;
      }
    }
    processedData = resampled;
  }

  // Peak detection to gently boost quiet microphones without clipping loud speech
  let peak = 0;
  for (let i = 0; i < processedData.length; i++) {
    const abs = Math.abs(processedData[i]);
    if (abs > peak) peak = abs;
  }
  const gain = peak > 0.015 && peak < 0.5 ? Math.min(6.0, 0.75 / peak) : 1.0;

  const numSamples = processedData.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true);  // NumChannels (1 = mono)
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true);  // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, processedData[i] * gain));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

export function base64ToPcm(base64: string): Float32Array {
  if (!base64 || typeof base64 !== 'string') return new Float32Array(0);
  const binary = atob(base64);
  const len = binary.length;
  if (len < 2) return new Float32Array(0);

  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // If the audio buffer begins with a 44-byte RIFF/WAVE header, skip the header bytes
  const hasRiffHeader =
    bytes.length >= 44 &&
    bytes[0] === 0x52 && // 'R'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46 && // 'F'
    bytes[3] === 0x46;   // 'F'
  const byteOffset = hasRiffHeader ? 44 : 0;
  const usableByteLength = bytes.length - byteOffset;
  const sampleCount = Math.floor(usableByteLength / 2);
  if (sampleCount <= 0) return new Float32Array(0);

  // Create an aligned ArrayBuffer to avoid any subarray offset or alignment discrepancies
  const alignedBuffer = bytes.slice(byteOffset, byteOffset + sampleCount * 2).buffer;
  const view = new DataView(alignedBuffer);
  const pcm = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    pcm[i] = view.getInt16(i * 2, true) / 32768.0;
  }

  // Micro fade-in and fade-out (64 samples ~= 2.6ms at 24kHz) to eliminate audio clicks,
  // radio static bursts, and digital pop artifacts at chunk boundaries and speech termination.
  const fadeLength = Math.min(64, Math.floor(sampleCount / 4));
  for (let i = 0; i < fadeLength; i++) {
    const factor = 0.5 * (1 - Math.cos((Math.PI * i) / fadeLength));
    pcm[i] *= factor;
    pcm[sampleCount - 1 - i] *= factor;
  }

  return pcm;
}
