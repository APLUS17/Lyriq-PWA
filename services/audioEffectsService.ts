/**
 * Audio Effects Service
 * Handles studio-quality vocal effects: Room Reverb, Width (Doubler), and Delay.
 */

export interface EffectChain {
    inputNode: GainNode;
    outputNode: GainNode;
    reverbGain: GainNode;
    widthGain: GainNode;
    delayGain: GainNode;
    delayNode: DelayNode;
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
 * Creates the "Studio Rack" effect chain.
 * Source -> [Delay] -> [Chorus] -> [Reverb] -> Destination
 * Uses parallel wet/dry chains for each effect.
 */
export function createVocalEffectChain(context: AudioContext): EffectChain {
    const inputNode = context.createGain(); // Master Input
    const outputNode = context.createGain(); // Master Output

    // 1. Delay Stage (Replacing Distortion)
    const delayNode = context.createDelay(2.0); // 2 second max delay
    delayNode.delayTime.value = 0.4; // 400ms default
    const delayFeedback = context.createGain();
    delayFeedback.gain.value = 0.4; // 40% feedback loop
    const delayGain = context.createGain(); // Wet level
    const delayDry = context.createGain(); // Dry level

    // Connect Delay with Feedback
    inputNode.connect(delayDry);
    inputNode.connect(delayNode);
    delayNode.connect(delayGain);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode); // Feedback loop

    const delayMerge = context.createGain();
    delayGain.connect(delayMerge);
    delayDry.connect(delayMerge);

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
    delayMerge.connect(delayNodeLeft);
    delayMerge.connect(delayNodeRight);
    merger.connect(widthGain);
    delayMerge.connect(widthDry);

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
    delayGain.gain.value = 0;
    delayDry.gain.value = 1;

    widthGain.gain.value = 0;
    widthDry.gain.value = 1;

    reverbGain.gain.value = 0;
    reverbDry.gain.value = 1;

    return {
        inputNode,
        outputNode,
        reverbGain,
        widthGain,
        delayGain,
        delayNode
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
