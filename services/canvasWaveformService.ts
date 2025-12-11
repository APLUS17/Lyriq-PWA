// This service contains functions for drawing audio waveforms on a <canvas> element.

/**
 * Draws a static waveform preview for an entire audio buffer.
 * Renders the waveform in two colors to indicate playback progress.
 * @param ctx The 2D rendering context of the canvas.
 * @param buffer The decoded AudioBuffer containing the audio data.
 * @param progress The playback progress, a value between 0 and 1.
 */
export function drawStaticWaveform(ctx: CanvasRenderingContext2D, buffer: AudioBuffer, progress: number): void {
    if (!ctx) return;
    const data = buffer.getChannelData(0);
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;
    const step = Math.ceil(data.length / width);
    const amp = height / 2;
    const progressPixels = width * progress;

    // Reset transform to ensure we draw in physical pixels
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const drawBars = (from: number, to: number, color: string) => {
        ctx.fillStyle = color;
        for (let i = from; i < to; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }
    };

    // Draw background (unplayed part) - darker gray for new theme
    drawBars(0, width, '#3f3f46'); // zinc-700

    // Draw foreground (played part) - accent yellow
    drawBars(0, Math.floor(progressPixels), '#facc15'); // yellow-400

    // Draw playhead
    ctx.fillStyle = '#fefce8'; // yellow-50 (bright white-yellow)
    ctx.fillRect(progressPixels, 0, 2, height);
}

/**
 * Draws a centered waveform with progress indication for FlowScreen.
 * This version shows the waveform in the center with played/unplayed states.
 * @param ctx The 2D rendering context of the canvas.
 * @param buffer The decoded AudioBuffer containing the audio data.
 * @param progress The playback progress, a value between 0 and 1.
 */
export function drawCenteredWaveform(ctx: CanvasRenderingContext2D, buffer: AudioBuffer, progress: number): void {
    if (!ctx || !buffer) return;

    const data = buffer.getChannelData(0);
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;
    const step = Math.ceil(data.length / width);
    const centerY = height / 2;
    const progressPixels = width * progress;

    // Reset transform to ensure we draw in physical pixels
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Draw waveform bars centered vertically
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;

        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }

        const barHeight = Math.max(1, (max - min) * centerY * 0.8);
        const isPlayed = i < progressPixels;

        // Color: pink for played, zinc for unplayed
        ctx.fillStyle = isPlayed ? '#ec4899' : '#52525b'; // pink-500 : zinc-600
        ctx.fillRect(i, centerY - barHeight / 2, 1, barHeight);
    }

    // Draw playhead indicator
    ctx.fillStyle = '#ef4444'; // red-500
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fillRect(progressPixels - 1, 0, 2, height);
    ctx.shadowBlur = 0;
}

/**
 * Decodes an audio file URL to an AudioBuffer for waveform rendering.
 * @param audioUrl The URL of the audio file.
 * @param audioContext The AudioContext instance.
 * @returns Promise resolving to the decoded AudioBuffer.
 */
export async function decodeAudioFromUrl(audioUrl: string, audioContext: AudioContext): Promise<AudioBuffer> {
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Draws a live dynamic waveform from AnalyserNode data.
 * Optimized for real-time visualization during recording.
 */
export function drawLiveWaveform(
    ctx: CanvasRenderingContext2D,
    dataArray: Uint8Array,
    bufferLength: number,
    color: string = '#ec4899' // pink-500
): void {
    if (!ctx) return;

    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.beginPath();

    const sliceWidth = width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // Normalize 0-255 to 0-2 (1 is center)
        const y = v * height / 2; // Map to canvas height

        // Draw centered
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
}