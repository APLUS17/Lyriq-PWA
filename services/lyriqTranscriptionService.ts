import { GoogleGenAI, Type } from '@google/genai';
import { TimedWord, TimedLine } from '../types';

/**
 * Lyriq Transcription Service
 * Handles AI-powered vocal transcription with word-level timestamps
 * and auto-scrolling sync functionality.
 */

const MAX_PAUSE_BETWEEN_WORDS = 0.5; // seconds - pause threshold for line breaks

/**
 * Groups individual timed words into lines based on pauses between words.
 * This is crucial for smooth auto-scrolling (line-by-line is smoother than word-by-word).
 * 
 * @param words - Array of timed words with start/end timestamps
 * @returns Array of timed lines grouped by natural pauses
 */
export function groupWordsIntoLines(words: TimedWord[]): TimedLine[] {
    if (!words || words.length === 0) return [];

    const lines: TimedLine[] = [];
    let currentLine: TimedWord[] = [];

    words.forEach((word) => {
        if (currentLine.length === 0) {
            currentLine.push(word);
        } else {
            const previousWord = currentLine[currentLine.length - 1];
            const pause = word.start - previousWord.end;

            if (pause < MAX_PAUSE_BETWEEN_WORDS) {
                currentLine.push(word);
            } else {
                // Push completed line
                lines.push({
                    text: currentLine.map(w => w.word).join(' '),
                    start: currentLine[0].start,
                    end: currentLine[currentLine.length - 1].end,
                });
                currentLine = [word];
            }
        }
    });

    // Add remaining words as final line
    if (currentLine.length > 0) {
        lines.push({
            text: currentLine.map(w => w.word).join(' '),
            start: currentLine[0].start,
            end: currentLine[currentLine.length - 1].end,
        });
    }

    return lines;
}

/**
 * Transcribes audio to timed words using Gemini AI.
 * Returns word-level timestamps for karaoke-style sync.
 * 
 * @param audioBlob - The recorded audio as a Blob
 * @returns Promise resolving to array of timed words
 */
export async function transcribeAudioToTimedWords(audioBlob: Blob): Promise<TimedWord[]> {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY as string });

    // Convert blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const prompt = `You are an expert Speech-to-Text processor specializing in musical vocals. Your task is to analyze the provided audio and produce a highly accurate, word-for-word transcription with precise timing.

Follow these rules strictly:
1.  Transcribe the sung vocals in the audio.
2.  Format the entire output as a single, clean JSON array of objects.
3.  Each object in the array represents a single word.
4.  Each object MUST contain three keys:
    - "word": The transcribed word as a string.
    - "start": The start time of the word in seconds (float).
    - "end": The end time of the word in seconds (float).
5.  Do NOT include any additional commentary, text, or formatting outside of the final JSON array. The response must be only the JSON.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: audioBlob.type || 'audio/webm',
                            data: base64Audio
                        }
                    }
                ]
            }
        ],
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        word: { type: Type.STRING },
                        start: { type: Type.NUMBER },
                        end: { type: Type.NUMBER }
                    },
                    required: ['word', 'start', 'end']
                }
            }
        }
    });

    const jsonText = response.text?.trim();
    if (!jsonText) {
        throw new Error('No transcription response received');
    }

    const timedWords: TimedWord[] = JSON.parse(jsonText);
    return timedWords;
}

/**
 * Full transcription pipeline: audio -> timed words -> grouped lines
 * 
 * @param audioBlob - The recorded audio as a Blob
 * @returns Promise resolving to { words, lines } for sync rendering
 */
export async function transcribeAndGroupAudio(audioBlob: Blob): Promise<{
    words: TimedWord[];
    lines: TimedLine[];
}> {
    const words = await transcribeAudioToTimedWords(audioBlob);
    const lines = groupWordsIntoLines(words);
    return { words, lines };
}

/**
 * Find the line index that contains the given time.
 * Uses binary search for efficiency with large lyric sets.
 * 
 * @param time - Current playback time in seconds
 * @param lines - Array of timed lines
 * @returns Index of the active line, or -1 if none found
 */
export function findLineIndexAtTime(time: number, lines: TimedLine[]): number {
    if (!lines || lines.length === 0) return -1;

    for (let i = 0; i < lines.length; i++) {
        if (time >= lines[i].start && time <= lines[i].end) {
            return i;
        }
        // If we're between lines, return the previous line
        if (i > 0 && time > lines[i - 1].end && time < lines[i].start) {
            return i - 1;
        }
    }

    // If past all lines, return last line
    if (time > lines[lines.length - 1].end) {
        return lines.length - 1;
    }

    return 0;
}

/**
 * Lookahead constant for responsive highlighting.
 * Adding this to currentTime makes the UI feel more responsive.
 */
export const HIGHLIGHT_LOOKAHEAD = 0.15; // seconds
