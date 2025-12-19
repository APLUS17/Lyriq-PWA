import { GoogleGenAI, Type } from '@google/genai';
import { TimedWord, TimedLine } from '../types';

/**
 * Lyriq Transcription Service
 * Handles AI-powered vocal transcription with word-level timestamps
 * and auto-scrolling sync functionality.
 */

const MAX_PAUSE_BETWEEN_WORDS = 0.5; // seconds - pause threshold for line breaks
const TRANSCRIPTION_MODEL = 'gemini-3-flash-preview'; // AI model for transcription
const SUPPORTED_AUDIO_FORMATS = [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg'
];

/**
 * Type guard to validate TimedWord objects at runtime
 */
function isTimedWord(obj: any): obj is TimedWord {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        typeof obj.word === 'string' &&
        typeof obj.start === 'number' &&
        typeof obj.end === 'number' &&
        !isNaN(obj.start) &&
        !isNaN(obj.end) &&
        obj.start >= 0 &&
        obj.end >= obj.start
    );
}

/**
 * Validates an array of timed words
 */
function validateTimedWords(data: any): data is TimedWord[] {
    if (!Array.isArray(data)) {
        return false;
    }
    return data.every(isTimedWord);
}

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

            if (pause <= MAX_PAUSE_BETWEEN_WORDS) {
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
 * @throws Error if API key is missing, audio format is unsupported, or transcription fails
 */
export async function transcribeAudioToTimedWords(audioBlob: Blob): Promise<TimedWord[]> {
    // WARNING: API key is exposed in client-side bundle (VITE_ prefix)
    // TODO: Move transcription to backend API endpoint for production security
    const apiKey = import.meta.env.VITE_TRANSCRIPTION_API_KEY;
    if (!apiKey) {
        throw new Error("Transcription API Key is missing. Please check your .env file and restart the development server.");
    }

    // Validate audio format
    const mimeType = audioBlob.type || 'audio/webm';
    if (!SUPPORTED_AUDIO_FORMATS.some(format => mimeType.startsWith(format.split(';')[0]))) {
        throw new Error(`Unsupported audio format: ${mimeType}. Supported formats: ${SUPPORTED_AUDIO_FORMATS.join(', ')}`);
    }

    const ai = new GoogleGenAI({ apiKey });

    // Convert blob to base64 efficiently
    const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
    });

    const prompt = `Transcribe these lyrics with word-level timestamps. 
Return ONLY a JSON array of objects: [{"word": "string", "start": float, "end": float}, ...]. 
No commentary. No markdown formatting. Just raw JSON array.`;

    const response = await ai.models.generateContent({
        model: TRANSCRIPTION_MODEL,
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType,
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
        throw new Error('No transcription response received from AI model');
    }

    // Parse and validate the response
    let parsedData: any;
    try {
        parsedData = JSON.parse(jsonText);
    } catch (parseError) {
        console.error('Failed to parse transcription response:', { jsonText, parseError });
        throw new Error(`Invalid JSON response from transcription service: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
    }

    // Validate the structure matches our expected format
    if (!validateTimedWords(parsedData)) {
        console.error('Invalid transcription data structure:', parsedData);
        throw new Error('Transcription response does not match expected format. Each word must have: word (string), start (number), end (number)');
    }

    return parsedData;
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
 * Uses linear search to find the active line.
 *
 * @param time - Current playback time in seconds
 * @param lines - Array of timed lines
 * @returns Index of the active line, or -1 if none found
 */
export function findLineIndexAtTime(time: number, lines: TimedLine[]): number {
    if (!lines || lines.length === 0) return -1;

    // Search backwards for efficiency (usually searching near current position)
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].start <= time) {
            // If the line has an explicit end time and we passed it, skip
            if (lines[i].end && time > lines[i].end) {
                continue;
            }
            return i;
        }
    }

    return -1;
}

/**
 * Lookahead constant for responsive highlighting.
 * Adding this to currentTime makes the UI feel more responsive.
 */
export const HIGHLIGHT_LOOKAHEAD = 0.15; // seconds
