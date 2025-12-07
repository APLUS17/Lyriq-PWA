/**
 * Scrubbing Service
 * Handles interactive scrubbing/seeking on waveform
 */

// Pixels per second constant for time-to-pixel conversion
export const PIXELS_PER_SECOND = 100;

/**
 * Converts pixel position to time in seconds
 * @param pixelX - The X pixel position
 * @param containerLeft - The left offset of the container
 * @param scrollLeft - The scroll position (if scrollable)
 * @returns Time in seconds
 */
export function pixelToTime(
    pixelX: number,
    containerLeft: number = 0,
    scrollLeft: number = 0
): number {
    const totalPixels = pixelX - containerLeft + scrollLeft;
    return Math.max(0, totalPixels / PIXELS_PER_SECOND);
}

/**
 * Converts time in seconds to pixel position
 * @param time - Time in seconds
 * @returns Pixel position
 */
export function timeToPixel(time: number): number {
    return time * PIXELS_PER_SECOND;
}

/**
 * Calculates time from a mouse/touch event on a waveform element
 * @param event - Mouse or Touch event
 * @param waveformElement - The waveform container element
 * @param duration - Total audio duration in seconds
 * @returns Calculated time in seconds, clamped to duration
 */
export function getTimeFromEvent(
    event: MouseEvent | TouchEvent,
    waveformElement: HTMLElement,
    duration: number
): number {
    const rect = waveformElement.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;

    // Calculate relative position within the element (0 to 1)
    const relativeX = (clientX - rect.left) / rect.width;

    // Convert to time
    const time = relativeX * duration;

    // Clamp between 0 and duration
    return Math.max(0, Math.min(duration, time));
}

/**
 * Extracts X coordinate from mouse or touch event
 * @param event - Mouse or Touch event
 * @returns X coordinate
 */
export function getPointerX(event: MouseEvent | TouchEvent): number {
    return 'touches' in event ? event.touches[0].clientX : event.clientX;
}
