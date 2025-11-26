import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { Song, Section, Lyric, AudioTake } from './types';
import { getSyllableCount, getSyllableCountsForWrappedLines } from './services/syllableService';
import { UnderlineIcon, SyllableCountIcon, PlusIcon, TrashIcon, GeminiIcon, MicrophoneIcon, MusicNoteIcon } from './components/Icons';
import SectionModal from './components/SectionModal';
import GeminiActionModal from './components/GeminiActionModal';
import { GoogleGenAI, Type } from "@google/genai";
import RhymePopup from './components/RhymePopup';
import AudioRecorder from './components/AudioRecorder';
import BottomTakesPlayer from './components/BottomTakesPlayer';
import InitialControls from './components/InitialControls';
import MasterPlayer from './components/MasterPlayer';
import SplashScreen from './components/SplashScreen';


const initialSectionId = crypto.randomUUID();
const initialSong: Song = {
    sections: [
        { id: initialSectionId, title: 'Intro', lyrics: [], takes: [] }
    ],
};

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]); // remove the data URI prefix
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const getAudioDuration = (blob: Blob): Promise<number> => {
    const url = URL.createObjectURL(blob);
    return new Promise(resolve => {
        const audio = document.createElement('audio');
        audio.muted = true;
        audio.src = url;
        audio.addEventListener('loadedmetadata', () => {
            resolve(audio.duration);
            URL.revokeObjectURL(url);
        });
    });
};

const App: React.FC = () => {
    const [song, setSong] = useState<Song>(initialSong);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUnstructured, setIsUnstructured] = useState(true);
    const [showSyllableCount, setShowSyllableCount] = useState(false);
    const sectionEditorRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const [activeSectionId, setActiveSectionId] = useState<string | null>(initialSectionId);
    const [geminiModalSectionId, setGeminiModalSectionId] = useState<string | null>(null);
    const geminiIconRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

    // Syllable count state for wrapped lines
    const [lineCountsBySection, setLineCountsBySection] = useState<Record<string, (number[] | null)[]>>({});

    // Master beat state
    const [beat, setBeat] = useState<{ url: string; file: File } | null>(null);

    // Rhyme popup state
    const [rhymePopup, setRhymePopup] = useState<{
        word: string;
        position: { top: number; left: number };
        rhymes: string[];
        isLoading: boolean;
    } | null>(null);
    const rhymeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Swipe-to-delete state
    const [dragState, setDragState] = useState<{
        sectionId: string;
        startX: number;
        isDragging: boolean;
        translateX: number;
    } | null>(null);
    const [deletingSections, setDeletingSections] = useState<Set<string>>(new Set());
    const deleteTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Drag-and-drop reorder state
    const [reorderState, setReorderState] = useState<{
        sectionId: string;
        startIndex: number;
        initialY: number;
        currentY: number;
        draggedElHeight: number;
    } | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sectionContainerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Audio Recording State
    const [recordingState, setRecordingState] = useState<{ status: 'idle' | 'recording'; targetSectionId: string | null; startTime: number | null }>({ status: 'idle', targetSectionId: null, startTime: null });
    const [activePlayerSectionId, setActivePlayerSectionId] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    const [showSplash, setShowSplash] = useState(true);


    const isInitialState = beat === null;

    useEffect(() => {
        document.execCommand('defaultParagraphSeparator', false, 'div');



        const timeouts = deleteTimeouts.current;
        return () => {
            timeouts.forEach(clearTimeout);
        };
    }, []);

    const handleSplashComplete = () => {
        setShowSplash(false);
    };



    useLayoutEffect(() => {
        // First, ensure inactive editors are populated correctly before measurement
        song.sections.forEach(section => {
            if (section.id === activeSectionId) return;
            const editorNode = sectionEditorRefs.current[section.id];
            if (editorNode) {
                const newHtml = generateHtmlForSection(section.lyrics);
                if (editorNode.innerHTML !== newHtml) {
                    editorNode.innerHTML = newHtml;
                }
            }
        });

        const calculateVisualLineCounts = () => {
            if (!showSyllableCount) {
                setLineCountsBySection({});
                return;
            }

            const newCountsBySection: Record<string, (number[] | null)[]> = {};

            for (const section of song.sections) {
                const editorDiv = sectionEditorRefs.current[section.id];
                if (!editorDiv) continue;

                const sectionCounts: (number[] | null)[] = [];

                if (section.id === activeSectionId) {
                    const lineDivs = editorDiv.children;
                    for (let i = 0; i < lineDivs.length; i++) {
                        sectionCounts.push(getSyllableCountsForWrappedLines(lineDivs[i] as HTMLDivElement));
                    }
                } else {
                    for (const lyric of section.lyrics) {
                        const lyricDiv = editorDiv.querySelector(`[data-lyric-id="${lyric.id}"]`) as HTMLDivElement;
                        sectionCounts.push(lyricDiv ? getSyllableCountsForWrappedLines(lyricDiv) : null);
                    }
                }
                newCountsBySection[section.id] = sectionCounts;
            }

            setLineCountsBySection(prevCounts => {
                if (JSON.stringify(prevCounts) === JSON.stringify(newCountsBySection)) return prevCounts;
                return newCountsBySection;
            });
        };

        // Use double requestAnimationFrame + small delay for mobile browsers
        let rafId1: number, rafId2: number, timeoutId: number;
        rafId1 = requestAnimationFrame(() => {
            rafId2 = requestAnimationFrame(() => {
                // Additional 10ms delay ensures mobile layout is complete
                timeoutId = setTimeout(calculateVisualLineCounts, 10) as any;
            });
        });

        const debounce = (fn: Function, ms = 150) => {
            let timeoutId: ReturnType<typeof setTimeout>;
            return function (this: any, ...args: any[]) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => fn.apply(this, args), ms);
            };
        };

        const debouncedResizeHandler = debounce(calculateVisualLineCounts);
        window.addEventListener('resize', debouncedResizeHandler);

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', debouncedResizeHandler);
        }

        return () => {
            cancelAnimationFrame(rafId1);
            cancelAnimationFrame(rafId2);
            clearTimeout(timeoutId);
            window.removeEventListener('resize', debouncedResizeHandler);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', debouncedResizeHandler);
            }
        };

    }, [song, showSyllableCount, activeSectionId]);


    const clearRhymePopupAndTimeout = useCallback(() => {
        if (rhymeTimeoutRef.current) clearTimeout(rhymeTimeoutRef.current);
        rhymeTimeoutRef.current = null;
        setRhymePopup(null);
    }, []);

    const deleteSection = useCallback((sectionId: string) => {
        setSong(prevSong => ({
            ...prevSong,
            sections: prevSong.sections.filter(s => s.id !== sectionId)
        }));
        deleteTimeouts.current.delete(sectionId);
    }, []);

    const handleGestureStart = useCallback((e: React.MouseEvent | React.TouchEvent, sectionId: string) => {
        if (isUnstructured || reorderState) return;
        clearRhymePopupAndTimeout();

        const target = e.target as HTMLElement;
        if (target.isContentEditable || target.closest('[contenteditable="true"]') || target.closest('button')) {
            return;
        }

        const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        if (longPressTimeout.current) {
            clearTimeout(longPressTimeout.current);
        }

        longPressTimeout.current = setTimeout(() => {
            const startIndex = song.sections.findIndex(s => s.id === sectionId);
            const draggedElHeight = sectionContainerRefs.current[sectionId]?.offsetHeight || 0;

            if (startIndex !== -1) {
                setReorderState({
                    sectionId,
                    startIndex,
                    initialY: startY,
                    currentY: startY,
                    draggedElHeight,
                });
                setDropIndex(startIndex);
                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'grabbing';
            }
            setDragState(null);
            longPressTimeout.current = null;
        }, 300);

        setDragState({
            sectionId,
            startX,
            isDragging: true,
            translateX: 0,
        });
    }, [isUnstructured, song.sections, reorderState, clearRhymePopupAndTimeout]);

    const handleGestureMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (reorderState) {
            e.preventDefault();
            const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            setReorderState(prev => prev ? { ...prev, currentY } : null);

            let newDropIndex = reorderState.startIndex;
            const { startIndex } = reorderState;
            for (let i = 0; i < song.sections.length; i++) {
                if (i === startIndex) continue;
                const sectionId = song.sections[i].id;
                const ref = sectionContainerRefs.current[sectionId];
                if (ref) {
                    const rect = ref.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (startIndex < i && currentY > midY) {
                        newDropIndex = i;
                    }
                    if (startIndex > i && currentY < midY) {
                        newDropIndex = i;
                        break;
                    }
                }
            }
            setDropIndex(newDropIndex);
            return;
        }

        if (!dragState || !dragState.isDragging) return;

        if ('touches' in e) {
            e.preventDefault();
        }

        const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const diff = currentX - dragState.startX;

        if (Math.abs(diff) > 5 && longPressTimeout.current) {
            clearTimeout(longPressTimeout.current);
            longPressTimeout.current = null;
        }

        if (longPressTimeout.current) return;

        const translateX = Math.min(0, diff);
        setDragState(prev => prev ? { ...prev, translateX } : null);
    }, [dragState, reorderState, song.sections]);

    const handleGestureEnd = useCallback(() => {
        if (longPressTimeout.current) {
            clearTimeout(longPressTimeout.current);
            longPressTimeout.current = null;
        }

        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        if (reorderState && dropIndex !== null) {
            const { startIndex } = reorderState;
            if (startIndex !== dropIndex) {
                setSong(prevSong => {
                    const newSections = [...prevSong.sections];
                    const [removed] = newSections.splice(startIndex, 1);
                    newSections.splice(dropIndex, 0, removed);
                    return { ...prevSong, sections: newSections };
                });
            }
        }
        setReorderState(null);
        setDropIndex(null);

        if (!dragState) return;
        const { sectionId, translateX } = dragState;
        const SWIPE_THRESHOLD = -window.innerWidth / 3.5;

        if (translateX < SWIPE_THRESHOLD) {
            setDeletingSections(prev => new Set(prev).add(sectionId));
            const timeoutId = setTimeout(() => {
                deleteSection(sectionId);
            }, 500);
            deleteTimeouts.current.set(sectionId, timeoutId);
        }

        setDragState(null);
    }, [dragState, deleteSection, reorderState, dropIndex]);

    useEffect(() => {
        const isInteracting = dragState?.isDragging || !!reorderState;
        if (isInteracting) {
            window.addEventListener('mousemove', handleGestureMove);
            window.addEventListener('touchmove', handleGestureMove, { passive: false });
            window.addEventListener('mouseup', handleGestureEnd);
            window.addEventListener('touchend', handleGestureEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleGestureMove);
            window.removeEventListener('touchmove', handleGestureMove);
            window.removeEventListener('mouseup', handleGestureEnd);
            window.removeEventListener('touchend', handleGestureEnd);
        };
    }, [dragState?.isDragging, reorderState, handleGestureMove, handleGestureEnd]);

    const parseLyricsFromDom = (node: HTMLDivElement): Lyric[] => {
        const lyrics: Lyric[] = [];
        if (node.innerText.trim() === '' && node.innerHTML.trim() === '') {
            return [];
        }

        const processHtmlContent = (html: string) => {
            if (html.toLowerCase().trim() === '<br>') {
                lyrics.push({ id: crypto.randomUUID(), html: '' });
            } else {
                html.split(/<br\s*\/?>/i).forEach(lineHtml => {
                    lyrics.push({ id: crypto.randomUUID(), html: lineHtml });
                });
            }
        };

        const blocks = Array.from(node.children).filter(el => ['DIV', 'P'].includes(el.nodeName));

        if (blocks.length > 0) {
            blocks.forEach(block => {
                processHtmlContent((block as HTMLElement).innerHTML);
            });
        } else {
            processHtmlContent(node.innerHTML);
        }

        return lyrics;
    };


    const handleLyricsInput = (sectionId: string, editorNode: HTMLDivElement) => {
        clearRhymePopupAndTimeout();
        const newLyrics = parseLyricsFromDom(editorNode);
        setSong(prevSong => ({
            ...prevSong,
            sections: prevSong.sections.map(s =>
                s.id === sectionId ? { ...s, lyrics: newLyrics } : s
            )
        }));
    };

    const updateSectionTitle = (sectionId: string, newTitle: string) => {
        setSong(prevSong => ({
            ...prevSong,
            sections: prevSong.sections.map(section => section.id === sectionId ? { ...section, title: newTitle } : section)
        }));
    };

    const addSection = (title: string) => {
        const newSection: Section = { id: crypto.randomUUID(), title: title, lyrics: [], takes: [] };
        setSong(prevSong => ({ ...prevSong, sections: [...prevSong.sections, newSection] }));
        setActiveSectionId(newSection.id);
        setIsModalOpen(false);
    }

    const generateHtmlForSection = (lyrics: Lyric[]) => {
        if (lyrics.length === 0) return '';
        return lyrics.map(l => `<div data-lyric-id="${l.id}">${l.html || '<br>'}</div>`).join('');
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        clearRhymePopupAndTimeout();
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    };

    const handleTitlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain').replace(/(\r\n|\n|\r)/gm, ' ');
        document.execCommand('insertText', false, text);
    };

    const handleGeminiIconClick = (e: React.MouseEvent<HTMLButtonElement>, sectionId: string) => {
        e.stopPropagation();
        setGeminiModalSectionId(prevId => (prevId === sectionId ? null : sectionId));
    };

    const handleGeminiAction = (action: 'suggest' | 'rhyme' | 'rewrite') => {
        if (geminiModalSectionId) {
            console.log(`Action: ${action} on section: ${geminiModalSectionId}`);
        }
    };

    const fetchRhymes = async (word: string, context: string) => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Given the lyric line "${context}", provide a list of up to 10 contextual rhyming words for "${word}". The rhymes should fit the mood and meaning of the line. Only return single words.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            rhymes: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            }
                        },
                        required: ['rhymes']
                    }
                }
            });

            const jsonText = response.text.trim();
            const result = JSON.parse(jsonText);
            const filteredRhymes = (result.rhymes || []).filter((r: unknown) => typeof r === 'string' && !r.includes(' '));


            if (filteredRhymes.length > 0) {
                setRhymePopup(prev => prev ? { ...prev, rhymes: filteredRhymes, isLoading: false } : null);
            } else {
                setRhymePopup(prev => prev ? { ...prev, isLoading: false, rhymes: ['No rhymes found.'] } : null);
            }
        } catch (error) {
            console.error("Error fetching rhymes:", error);
            setRhymePopup(prev => prev ? { ...prev, isLoading: false, rhymes: ['Error.'] } : null);
        }
    };

    const handleSelection = () => {
        if (rhymeTimeoutRef.current) clearTimeout(rhymeTimeoutRef.current);

        rhymeTimeoutRef.current = setTimeout(() => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
                setRhymePopup(null); return;
            }

            const range = selection.getRangeAt(0);
            const editorNode = (range.startContainer.parentElement as HTMLElement)?.closest('.lyric-editor');
            if (!editorNode) {
                setRhymePopup(null); return;
            }

            const selectedText = selection.toString().trim();

            if (selectedText && !selectedText.includes(' ') && selectedText.length > 1) {
                if (rhymePopup && rhymePopup.word === selectedText) return;

                const rect = range.getBoundingClientRect();
                const lineElement = (range.startContainer.nodeType === Node.TEXT_NODE
                    ? range.startContainer.parentElement
                    : range.startContainer as HTMLElement
                )?.closest('div');
                const context = lineElement ? lineElement.textContent || '' : '';

                setRhymePopup({
                    word: selectedText,
                    position: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX },
                    rhymes: [],
                    isLoading: true,
                });
                fetchRhymes(selectedText, context);
            } else {
                setRhymePopup(null);
            }
        }, 750);
    };

    // Recording Logic
    const handleStopRecording = async (save: boolean) => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.onstop = async () => {
                try {
                    if (save && recordingState.targetSectionId) {
                        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType });

                        if (audioBlob.size > 0) {
                            const base64Data = await blobToBase64(audioBlob);
                            const duration = await getAudioDuration(audioBlob);

                            const newTake: AudioTake = {
                                id: `take_${Date.now()}`,
                                url: URL.createObjectURL(audioBlob),
                                data: base64Data,
                                mimeType: audioBlob.type,
                                duration: duration,
                                timestamp: Date.now()
                            };

                            setSong(prevSong => ({
                                ...prevSong,
                                sections: prevSong.sections.map(s =>
                                    s.id === recordingState.targetSectionId
                                        ? { ...s, takes: [...s.takes, newTake] }
                                        : s
                                )
                            }));
                        }
                    }
                } catch (error) {
                    console.error("Error processing audio take:", error);
                } finally {
                    audioChunksRef.current = [];
                    mediaRecorderRef.current = null;
                    if (streamRef.current) {
                        streamRef.current.getTracks().forEach(track => track.stop());
                        streamRef.current = null;
                    }
                    setRecordingState({ status: 'idle', targetSectionId: null, startTime: null });
                }
            };
            mediaRecorderRef.current.stop();
        }
    };

    const handleRecordClick = async (sectionId: string) => {
        if (recordingState.status === 'recording') return;
        setActivePlayerSectionId(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/mp4',
                'audio/aac',
                'audio/webm'
            ];

            let selectedMimeType = '';
            for (const type of mimeTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    selectedMimeType = type;
                    break;
                }
            }

            const options = selectedMimeType ? { mimeType: selectedMimeType } : undefined;
            mediaRecorderRef.current = new MediaRecorder(stream, options);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.start();
            setRecordingState({ status: 'recording', targetSectionId: sectionId, startTime: Date.now() });
        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Could not access microphone. Please ensure permissions are granted.");
        }
    };

    const handleDeleteTake = (takeId: string, sectionId: string) => {
        const section = song.sections.find(s => s.id === sectionId);
        const takeToDelete = section?.takes.find(t => t.id === takeId);

        if (takeToDelete) {
            URL.revokeObjectURL(takeToDelete.url);
        }

        const updatedSections = song.sections.map(s => {
            if (s.id === sectionId) {
                const updatedTakes = s.takes.filter(t => t.id !== takeId);
                if (updatedTakes.length === 0) {
                    setActivePlayerSectionId(null);
                }
                return { ...s, takes: updatedTakes };
            }
            return s;
        });

        setSong(prevSong => ({ ...prevSong, sections: updatedSections }));
    };

    const handleAddBeat = (file: File) => {
        const url = URL.createObjectURL(file);
        setBeat({ url, file });
    };

    const handleRemoveBeat = () => {
        if (beat) {
            URL.revokeObjectURL(beat.url);
            setBeat(null);
        }
    };

    const anchorEl = geminiModalSectionId ? geminiIconRefs.current[geminiModalSectionId] : null;
    const activePlayerSection = song.sections.find(s => s.id === activePlayerSectionId);

    return (
        <div className={`h-[100dvh] flex flex-col lyriq-player-view ${isInitialState ? 'empty-state' : ''}`}>
            {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

            <main className="flex-grow py-8 max-w-screen-xl mx-auto px-4 w-full h-full relative">
                {/* Glass Container for the Notepad */}
                <div className="h-full flex flex-col overflow-hidden relative">

                    {/* Header / Toolbar */}
                    <div className="relative flex items-center justify-between px-6 py-5 flex-shrink-0 z-10">
                        <h2 className="text-3xl font-brand font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-200 to-gray-400 tracking-tight">Lyriq</h2>
                        <div className="flex items-center space-x-2">
                            <button
                                type="button"
                                onClick={() => setIsUnstructured(prev => !prev)}
                                aria-label="Toggle unstructured view"
                                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                            >
                                <UnderlineIcon active={isUnstructured} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowSyllableCount(prev => !prev)}
                                aria-label="Toggle syllable count"
                                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                            >
                                <SyllableCountIcon active={showSyllableCount} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                aria-label="Add section"
                                className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
                            >
                                <PlusIcon />
                            </button>
                        </div>
                        <SectionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAddSection={addSection} />
                    </div>

                    <div className="flex-grow overflow-y-auto custom-scrollbar" onScroll={clearRhymePopupAndTimeout}>
                        <div className="pt-6 px-4 md:px-8 pb-32">
                            {song.sections.map((section, index) => {
                                const isDeleting = deletingSections.has(section.id);
                                const currentTranslateX = (dragState?.sectionId === section.id) ? dragState.translateX : 0;

                                const isBeingDragged = reorderState?.sectionId === section.id;
                                let containerStyle = {};
                                let containerClasses = `transition-transform duration-300 ease-in-out`;

                                if (reorderState) {
                                    const { startIndex, currentY, initialY, draggedElHeight } = reorderState;
                                    const finalDropIndex = dropIndex ?? startIndex;

                                    if (isBeingDragged) {
                                        containerStyle = {
                                            transform: `translateY(${currentY - initialY}px)`,
                                            zIndex: 50,
                                            cursor: 'grabbing',
                                        };
                                        containerClasses = '';
                                    } else {
                                        let shiftAmount = 0;
                                        if (startIndex < finalDropIndex && index > startIndex && index <= finalDropIndex) {
                                            shiftAmount = -draggedElHeight - (isUnstructured ? 24 : 32);
                                        } else if (startIndex > finalDropIndex && index < startIndex && index >= finalDropIndex) {
                                            shiftAmount = draggedElHeight + (isUnstructured ? 24 : 32);
                                        }
                                        if (shiftAmount !== 0) {
                                            containerStyle = { transform: `translateY(${shiftAmount}px)` };
                                        }
                                    }
                                }

                                return (
                                    <div key={section.id}>
                                        <div
                                            className={`transition-all duration-500 ease-in-out ${isUnstructured ? 'mb-0' : 'mb-8'} ${isDeleting ? 'max-h-0 opacity-0 !mb-0' : 'max-h-[600px]'}`}
                                        >
                                            <div
                                                ref={el => { sectionContainerRefs.current[section.id] = el; }}
                                                className={`relative ${containerClasses}`}
                                                style={containerStyle}
                                                onMouseDown={(e) => handleGestureStart(e, section.id)}
                                                onTouchStart={(e) => handleGestureStart(e, section.id)}
                                            >
                                                <div className={`absolute inset-0 rounded-xl flex justify-end items-center pr-8 pointer-events-none ${!isUnstructured ? 'bg-red-900/50' : ''}`}>
                                                    {!isUnstructured && <TrashIcon />}
                                                </div>

                                                <div
                                                    style={{ transform: `translateX(${currentTranslateX}px)` }}
                                                    className={`relative transition-all duration-500 ease-in-out will-change-[padding,background-color,border,box-shadow] ${dragState?.sectionId === section.id && dragState?.isDragging ? '!duration-0' : ''}
                                                    ${isUnstructured
                                                            ? 'bg-transparent border-l-2 border-transparent pl-4 hover:border-white/10 mb-6'
                                                            : 'bg-[#18181b] border border-white/5 rounded-xl p-6 shadow-lg hover:border-white/10 hover:shadow-xl'
                                                        }
                                                    ${isBeingDragged ? 'shadow-2xl scale-[1.02] z-50 bg-zinc-800' : ''}
                                                    ${activeSectionId === section.id && !isUnstructured ? 'ring-1 ring-white/10 bg-[#1c1c1f]' : ''}
                                                    `}
                                                >
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3 group">
                                                            <h3
                                                                contentEditable
                                                                suppressContentEditableWarning
                                                                dir="ltr"
                                                                spellCheck={false}
                                                                onInput={(e) => updateSectionTitle(section.id, e.currentTarget.innerText)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLHeadingElement).blur(); } }}
                                                                onPaste={handleTitlePaste}
                                                                className={`w-fit font-bold tracking-wide text-xs uppercase outline-none rounded-sm px-1 -ml-1 transition-colors
                                                                    ${isUnstructured ? 'text-gray-500 focus:text-gray-300' : 'text-gray-400 bg-white/5 py-0.5 px-2'}`}
                                                            >{section.title}</h3>
                                                            <button
                                                                ref={el => { geminiIconRefs.current[section.id] = el; }}
                                                                type="button"
                                                                aria-label="Gemini Actions"
                                                                onClick={(e) => handleGeminiIconClick(e, section.id)}
                                                                className={`transition-all duration-300 ease-in-out text-blue-400 hover:text-blue-300 ${activeSectionId === section.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'}`}
                                                                tabIndex={activeSectionId === section.id ? 0 : -1}
                                                            >
                                                                <GeminiIcon className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        {!isUnstructured && (
                                                            <div className="flex items-center space-x-1">
                                                                {section.takes.length > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setActivePlayerSectionId(section.id)}
                                                                        className="bg-zinc-800/80 border border-white/5 rounded-full flex items-center space-x-1.5 px-3 py-1 text-xs font-medium text-gray-300 hover:bg-zinc-700 hover:text-white transition-all"
                                                                        aria-label={`Show ${section.takes.length} audio takes`}
                                                                    >
                                                                        <MusicNoteIcon />
                                                                        <span>{section.takes.length}</span>
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    aria-label="Record audio"
                                                                    onClick={() => handleRecordClick(section.id)}
                                                                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-all"
                                                                >
                                                                    <MicrophoneIcon />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-start">
                                                        <div
                                                            ref={el => { sectionEditorRefs.current[section.id] = el; }}
                                                            contentEditable
                                                            data-placeholder="Start writing..."
                                                            data-section-id={section.id}
                                                            onFocus={() => { clearRhymePopupAndTimeout(); setActiveSectionId(section.id); }}
                                                            onBlur={clearRhymePopupAndTimeout}
                                                            onMouseDown={clearRhymePopupAndTimeout}
                                                            onTouchStart={clearRhymePopupAndTimeout}
                                                            onMouseUp={handleSelection}
                                                            onTouchEnd={handleSelection}
                                                            onInput={e => handleLyricsInput(section.id, e.currentTarget as HTMLDivElement)}
                                                            onPaste={handlePaste}
                                                            className="lyric-editor flex-grow outline-none text-gray-200 text-lg leading-relaxed tracking-normal"
                                                        />
                                                        {/* Syllable Count Column */}
                                                        <div className={`pl-4 w-14 text-right transition-opacity duration-300 flex flex-col items-end gap-[0px] ${showSyllableCount ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                                                            {section.lyrics.map((lyric, lineIndex) => {
                                                                const counts = (lineCountsBySection[section.id] || [])[lineIndex];

                                                                const renderPill = (val: number | null) => (
                                                                    <div className="text-lg leading-relaxed flex items-center justify-end h-[1.75em]">
                                                                        {val !== null && val > 0 && (
                                                                            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 text-[10px] font-mono font-medium text-gray-400 bg-white/5 border border-white/5 rounded-full tabular-nums">
                                                                                {val}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );

                                                                if (!lyric.html.trim()) {
                                                                    return <div key={lyric.id} className="text-lg leading-relaxed">{'\u00A0'}</div>;
                                                                }

                                                                if (counts && counts.length > 1) {
                                                                    return (
                                                                        <div key={lyric.id}>
                                                                            {counts.map((count, wrapIndex) => (
                                                                                <React.Fragment key={wrapIndex}>
                                                                                    {renderPill(count)}
                                                                                </React.Fragment>
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                }

                                                                const fallbackCount = getSyllableCount(lyric.html);
                                                                const singleCount = (counts && counts.length === 1) ? counts[0] : fallbackCount;
                                                                return (
                                                                    <React.Fragment key={lyric.id}>
                                                                        {renderPill(singleCount)}
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals and Overlays */}
            {geminiModalSectionId && anchorEl && (
                <GeminiActionModal
                    anchorEl={anchorEl}
                    onClose={() => setGeminiModalSectionId(null)}
                    onAction={handleGeminiAction}
                />
            )}
            {rhymePopup && <RhymePopup {...rhymePopup} />}
            {recordingState.status === 'recording' && recordingState.startTime && (
                <AudioRecorder
                    startTime={recordingState.startTime}
                    onSave={() => handleStopRecording(true)}
                    onCancel={() => handleStopRecording(false)}
                />
            )}
            {activePlayerSection && (
                <BottomTakesPlayer
                    className="takes-player-overlay"
                    section={activePlayerSection}
                    onClose={() => setActivePlayerSectionId(null)}
                    onDeleteTake={handleDeleteTake}
                />
            )}
            {isInitialState && recordingState.status !== 'recording' && <InitialControls onAddBeat={handleAddBeat} />}

            {beat && (
                <MasterPlayer beat={beat} onRemoveBeat={handleRemoveBeat} />
            )}
        </div>
    );
};

export default App;