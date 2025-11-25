export type AutoTuneMode = 'auto' | 'manual' | 'disabled';

export interface AutoTuneSettings {
  key: string;
  scale: string;
}

export interface AudioTake {
  id: string;
  url: string; // From URL.createObjectURL
  data: string; // base64 encoded data
  mimeType: string;
  duration: number; // in seconds
  timestamp: number;
  processedUrl?: string; // Auto-tuned version URL
  processedData?: string; // Auto-tuned base64 data
  autotuneSettings?: AutoTuneSettings; // Settings used for processing
}

export interface Lyric {
  id: string;
  html: string;
}

export interface Section {
  id: string;
  title: string;
  lyrics: Lyric[];
  takes: AudioTake[];
}

export interface Song {
  sections: Section[];
}

export interface AppSettings {
  autoTuneMode: AutoTuneMode;
  autoTuneKey: string;
  autoTuneScale: string;
}
