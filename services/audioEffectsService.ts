/**
 * Audio Effects Service
 * Handles studio-quality vocal effects: Room Reverb, Width (Doubler), and Grit (Distortion).
 */

export interface EffectChain {
    inputNode: GainNode;
    outputNode: GainNode;
    reverbGain: GainNode;
    widthGain: GainNode;
    gritGain: GainNode;
}

/**
 * Creates a synthetic impulse response for a "Room" reverb.
 * Room reverbs are shorter (0.5s - 1.0s) and tighter than hallucinations.
 */
function createRoomImpulseResponse(context: AudioContext): AudioBuffer {
    const rate = context.sampleRate;
    const length = rate * 0.8; // 0.8 seconds decay (Room size)
    const decay = 4.0;
    const impulse = context.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        // Logarithmic decay
        const n = length - i;
        const envelope = Math.pow(n / length, decay);

        // Add some noise
        left[i] = (Math.random() * 2 - 1) * envelope;
        right[i] = (Math.random() * 2 - 1) * envelope;
    }

    return impulse;
}

/**
 * Creates a distortion curve for the "Grit" effect.
 * Uses a soft saturation function to add warmth/harmonics.
 */
function makeDistortionCurve(amount: number = 50): Float32Array {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        // Soft clipping formula
        curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
    }
    return curve;
}

/**
 * Creates the "Studio Rack" effect chain.
 * Source -> [Distortion] -> [Chorus] -> [Reverb] -> Destination
 * Uses parallel wet/dry chains for each effect.
 */
export function createVocalEffectChain(context: AudioContext): EffectChain {
    const inputNode = context.createGain(); // Master Input
    const outputNode = context.createGain(); // Master Output

    // 1. Grit (Distortion) Stage
    const gritNode = context.createWaveShaper();
    gritNode.curve = makeDistortionCurve(400); // Moderate drive
    gritNode.oversample = '4x';
    const gritGain = context.createGain();
    const gritDry = context.createGain();

    // Connect Distortion
    inputNode.connect(gritNode);
    gritNode.connect(gritGain);
    inputNode.connect(gritDry); // Dry signal bypass

    const gritMerge = context.createGain();
    gritGain.connect(gritMerge);
    gritDry.connect(gritMerge);

    // 2. Width (Chorus/Doubler) Stage
    // We use a short delay and pan it to create width
    const delayNodeLeft = context.createDelay();
    const delayNodeRight = context.createDelay();
    delayNodeLeft.delayTime.value = 0.025; // 25ms (Haas effect)
    delayNodeRight.delayTime.value = 0.030; // 30ms difference

    const merger = context.createChannelMerger(2);
    delayNodeLeft.connect(merger, 0, 0);
    delayNodeRight.connect(merger, 0, 1);

    const widthGain = context.createGain();
    const widthDry = context.createGain();

    // Connect Width
    gritMerge.connect(delayNodeLeft);
    gritMerge.connect(delayNodeRight);
    merger.connect(widthGain);
    gritMerge.connect(widthDry);

    const widthMerge = context.createGain();
    widthGain.connect(widthMerge);
    widthDry.connect(widthMerge);

    // 3. Space (Room Reverb) Stage
    const convolver = context.createConvolver();
    convolver.buffer = createRoomImpulseResponse(context);
    const reverbGain = context.createGain();
    const reverbDry = context.createGain();

    // Connect Reverb
    widthMerge.connect(convolver);
    convolver.connect(reverbGain);
    widthMerge.connect(reverbDry);

    // Final Merge to Output
    reverbGain.connect(outputNode);
    reverbDry.connect(outputNode);

    // Initialize Levels (Defaults)
    gritGain.gain.value = 0;
    gritDry.gain.value = 1;

    widthGain.gain.value = 0;
    widthDry.gain.value = 1;

    reverbGain.gain.value = 0;
    reverbDry.gain.value = 1;

    // Helper to update dry/wet mix for a stage
    // We attach a custom function to the gain node for easy access? 
    // No, we'll just return the gain nodes and let the UI drive them.
    // Ideally, increasing Wet should decrease Dry to maintain volume, 
    // but for simple "Send" style effects, keeping Dry at 100% is often preferred for vocals.
    // Let's keep Dry fixed at 1.0 for now (Sends) unless user wants "Inserts".
    // For Distortion, Insert style is better. For Reverb/Delay, Send style is standard.

    return {
        inputNode,
        outputNode,
        reverbGain,
        widthGain,
        gritGain
    };
}

/**
 * Updates the wet/dry balance for an effect.
 * @param wetNode - The gain node for the effect
 * @param amount - 0 to 100
 */
export function setEffectLevel(wetNode: GainNode, amount: number) {
    // Smooth transition
    const value = Math.max(0, Math.min(100, amount)) / 100;
    wetNode.gain.setTargetAtTime(value, wetNode.context.currentTime, 0.1);
}
