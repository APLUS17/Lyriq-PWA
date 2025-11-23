
export interface AudioTake {
  id: string;
  url: string; // From URL.createObjectURL
  data: string; // base64 encoded data
  mimeType: string;
  duration: number; // in seconds
  timestamp: number;
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