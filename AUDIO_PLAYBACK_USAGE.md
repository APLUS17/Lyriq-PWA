# Enhanced Audio Playback UI - Usage Guide

## Components Created

### 1. `hooks/useAudioPlayback.ts`
Core hook for managing audio playback state with enhanced features.

**Features:**
- HTML5 Audio element management
- Play/Pause/Seek controls  
- Playback speed control (0.25x - 2x)
- Progress tracking
- Timestamp markers with notes

**Basic Usage:**
```typescript
import { useAudioPlayback } from '../hooks/useAudioPlayback';

const {
  isPlaying,
  position,
  duration,
  progress,
  playbackSpeed,
  markers,
  togglePlayPause,
  seekToProgress,
  setSpeed,
  addMarker,
  seekToMarker,
} = useAudioPlayback(audioUrl);
```

### 2. `components/WaveformPlayer.tsx`
Enhanced audio player component with waveform visualization.

**Features:**
- Waveform visualization (using existing `canvasWaveformService`)
- Interactive scrubbing (click/drag to seek)
- Speed control buttons (0.5x, 1x, 1.5x, 2x)
- Timestamp markers with visual indicators
- Marker management (add, remove, seek)
- Responsive design matching LYRIQ dark theme

**Usage:**
```tsx
import WaveformPlayer from '../components/WaveformPlayer';

<WaveformPlayer
  audioUrl={audioObject.url}
  audioFile={audioObject.file}
  onRemove={() => handleRemoveAudio()}
  title="Voice Memo - Take 3"
/>
```

## Integration Points

### Replacing MasterPlayer
The `WaveformPlayer` can be used as a drop-in replacement for `MasterPlayer`:

```tsx
// Before
<MasterPlayer beat={beat} onRemoveBeat={handleRemove} />

// After  
<WaveformPlayer 
  audioUrl={beat.url} 
  audioFile={beat.file}
  onRemove={handleRemove}
  title="Master Beat"
/>
```

### Replacing BottomTakesPlayer
For the takes player, you can integrate the hook:

```tsx
const TakesPlayerEnhanced = ({ section }) => {
  const currentTake = section.takes[currentTakeIndex];
  const audioUrl = currentTake.data; // base64 or blob URL
  
  // Convert base64 to File/Blob for waveform
  const audioFile = useMemo(() => {
    // Convert base64 to blob/file
    return createFileFromBase64(audioUrl);
  }, [audioUrl]);
  
  return (
    <WaveformPlayer
      audioUrl={audioUrl}
      audioFile={audioFile}
      title={section.name}
    />
  );
};
```

## Features Demo

### Speed Control
- Click speed buttons (0.5x, 1x, 1.5x, 2x) to change playback speed
- Current speed is highlighted with green (#52FF00) background
- Speed changes apply instantly during playback

### Scrubbing
- Click anywhere on the waveform to jump to that position
- Drag across the waveform to scrub through audio
- Works during playback and when paused

### Timestamp Markers
- Click "🏷️ Marker" button to add a marker at current position
- Markers appear as green dots on the waveform
- Click a marker to jump to that timestamp
- Hover over marker to see note (if added)
- Markers listed below player with timestamps
- Click × on marker chip to remove

## Styling

The component uses LYRIQ's dark theme:
- Background: `#1c1c1e`
- Accents: `#52FF00` (neon green)
- Glass effects: `black/20`, `white/5`, `white/10`
- Font: IBM Plex Mono (monospace)
- Responsive touch/mouse interactions

## Next Steps (Future Enhancements)

### Persistence
Add marker persistence to database:
```typescript
// In FlowScreen or App state
const saveMarkers = (takeId: string, markers: AudioMarker[]) => {
  // Save to localStorage or backend
  localStorage.setItem(`markers-${takeId}`, JSON.stringify(markers));
};
```

### Loop Region
Add loop region selection:
```typescript
interface LoopRegion {
  start: number;
  end: number;
}

// In useAudioPlayback hook
const setLoopRegion = (region: LoopRegion) => {
  // Check on timeupdate if position > region.end
  // If so, seek to region.start
};
```

### Editable Marker Notes
Allow editing marker notes:
```tsx
<input
  type="text"
  value={marker.note}
  onChange={(e) => updateMarkerNote(marker.id, e.target.value)}
  className="bg-black/30 rounded px-2 py-1"
/>
```

## Browser Compatibility

- Uses HTML5 Audio API (all modern browsers)
- Uses Web Audio API for waveform (all modern browsers)
- Touch events for mobile support
- Mouse events for desktop support

## Performance Notes

- Waveform is decoded once per audio file
- Canvas rendering is efficient (redraws on progress change)
- Markers are stored in memory (consider limit for large files)
- Audio playback uses native browser controls
