// Just a mental scratchpad to confirm bin math
const sampleRate = 16000;
const fftSize = 256;
const bins = fftSize / 2;
const hzPerBin = (sampleRate / 2) / bins;
console.log("Hz per bin:", hzPerBin);
console.log("300Hz bin:", Math.floor(300 / hzPerBin));
console.log("3000Hz bin:", Math.floor(3000 / hzPerBin));
