/**
 * Audio Sync Service
 * Handles synchronization between beat and vocal tracks
 */

export interface DualTrackState {
    beatPlayer: HTMLAudioElement | null;
    vocalPlayer: HTMLAudioElement | null;
    isSyncing: boolean;
}

/**
 * Synchronizes two audio tracks by setting them to the same playback position
 * @param beatPlayer - The master beat track audio element
 * @param vocalPlayer - The slave vocal track audio element
 */
export function syncTracks(beatPlayer: HTMLAudioElement, vocalPlayer: HTMLAudioElement): void {
    if (!beatPlayer || !vocalPlayer) return;

    // Force vocal track to match beat track's current time
    vocalPlayer.currentTime = beatPlayer.currentTime;
}

/**
 * Plays both tracks simultaneously with sync
 * @param beatPlayer - The master beat track audio element
 * @param vocalPlayer - The slave vocal track audio element (optional)
 * @returns Promise that resolves when both tracks start playing
 */
export async function playBothTracks(
    beatPlayer: HTMLAudioElement | null,
    vocalPlayer: HTMLAudioElement | null
): Promise<void> {
    if (!beatPlayer && (!vocalPlayer || !vocalPlayer.src)) return;

    // Sync before playing if both exist
    if (beatPlayer && vocalPlayer && vocalPlayer.src) {
        syncTracks(beatPlayer, vocalPlayer);
    }

    // Play available tracks with AbortError handling
    const safePlay = async (player: HTMLAudioElement) => {
        try {
            await player.play();
        } catch (err: any) {
            // Ignore AbortError (happens when pausing while loading/playing)
            if (err.name !== 'AbortError') {
                console.error('Audio playback error:', err);
            }
        }
    };

    const promises: Promise<void>[] = [];
    if (beatPlayer && beatPlayer.src) promises.push(safePlay(beatPlayer));
    if (vocalPlayer && vocalPlayer.src) promises.push(safePlay(vocalPlayer));

    await Promise.all(promises);
}

/**
 * Pauses both tracks
 * @param beatPlayer - The master beat track audio element
 * @param vocalPlayer - The slave vocal track audio element (optional)
 */
export function pauseBothTracks(
    beatPlayer: HTMLAudioElement,
    vocalPlayer: HTMLAudioElement | null
): void {
    if (beatPlayer) beatPlayer.pause();
    if (vocalPlayer) vocalPlayer.pause();
}

/**
 * Seeks both tracks to a specific time
 * @param time - The time in seconds to seek to
 * @param beatPlayer - The master beat track audio element
 * @param vocalPlayer - The slave vocal track audio element (optional)
 */
export function seekBothTracks(
    time: number,
    beatPlayer: HTMLAudioElement,
    vocalPlayer: HTMLAudioElement | null
): void {
    if (beatPlayer) beatPlayer.currentTime = time;
    if (vocalPlayer && vocalPlayer.src) vocalPlayer.currentTime = time;
}

/**
 * Sets volume for a specific track
 * @param player - The audio element to adjust
 * @param volume - Volume level (0.0 to 1.0)
 */
export function setTrackVolume(player: HTMLAudioElement | null, volume: number): void {
    if (!player) return;
    player.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
}
