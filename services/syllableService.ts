// A helper function to strip HTML tags from a string
function stripHtml(html: string): string {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

// This is a heuristic-based syllable counter. It's not 100% accurate but works for many common English words.
function countSyllables(word: string): number {
    word = word.toLowerCase().trim();
    if (word.length === 0) return 0;
    if (word.length <= 3) return 1;
    
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    
    const vowelGroups = word.match(/[aeiouy]{1,2}/g);
    
    if (!vowelGroups) return 1;

    // A special case for words ending in 'le' if the preceding consonant is not l
    if (word.length > 2 && word.endsWith('le') && !'aeiouy'.includes(word.charAt(word.length - 3)) && word.charAt(word.length-3) !== 'l') {
        return vowelGroups.length + 1;
    }
    
    return vowelGroups.length > 0 ? vowelGroups.length : 1;
}

export function getSyllableCount(html: string): number | null {
    const line = stripHtml(html);
    if (!line || line.trim() === '') {
        return null;
    }
    return line
        .trim()
        .split(/[\s-]+/)
        .filter(word => word.length > 0)
        .reduce((total, word) => total + countSyllables(word.replace(/[^a-z']/gi, '')), 0);
}


// New function to handle visually wrapped lines
function getWordsWithPositions(element: HTMLElement): { word: string, top: number }[] {
    const words: { word: string, top: number }[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

    // Get the element's bounding rect to calculate relative positions
    const elementRect = element.getBoundingClientRect();

    let node;
    while ((node = walker.nextNode())) {
        const text = node.textContent;
        if (!text) continue;

        const wordsInNode = text.match(/\S+/g);
        if (!wordsInNode) continue;

        let searchIndex = 0;
        for (const word of wordsInNode) {
            const range = document.createRange();
            const wordIndex = text.indexOf(word, searchIndex);
            if (wordIndex === -1) continue;

            range.setStart(node, wordIndex);
            range.setEnd(node, wordIndex + word.length);
            const rect = range.getBoundingClientRect();

            if (rect.width > 0 && rect.height > 0) {
                // Use relative position instead of absolute viewport position
                // This makes the calculation stable across scrolling and viewport changes
                const relativeTop = rect.top - elementRect.top;
                words.push({ word, top: relativeTop });
            }
            searchIndex = wordIndex + word.length;
        }
    }
    return words;
}

export function getSyllableCountsForWrappedLines(element: HTMLElement): number[] | null {
    if (!element || !element.textContent || element.textContent.trim() === '') {
        return null;
    }

    const wordsWithPositions = getWordsWithPositions(element);
    if (wordsWithPositions.length === 0) {
        return null;
    }

    // Calculate dynamic tolerance based on element's line height for better mobile support
    const computedStyle = window.getComputedStyle(element);
    const lineHeight = parseFloat(computedStyle.lineHeight);
    const fontSize = parseFloat(computedStyle.fontSize);
    // Use 30% of line height or font size as tolerance (whichever is available)
    const tolerance = !isNaN(lineHeight) ? lineHeight * 0.3 : (!isNaN(fontSize) ? fontSize * 0.3 : 8);

    const linesByTop = new Map<number, string[]>();
    const uniqueTops: number[] = [];

    for (const { word, top } of wordsWithPositions) {
        // Find a representative 'top' value for this line to group words
        // that are vertically very close. This handles sub-pixel variations.
        const lineTop = uniqueTops.find(t => Math.abs(t - top) < tolerance);

        if (lineTop !== undefined) {
            linesByTop.get(lineTop)!.push(word);
        } else {
            uniqueTops.push(top);
            linesByTop.set(top, [word]);
        }
    }

    // Sort the lines by their vertical position to ensure correct order
    uniqueTops.sort((a, b) => a - b);
    
    const linesOfWords = uniqueTops.map(top => linesByTop.get(top)!);

    return linesOfWords.map(lineWords => {
        const lineText = lineWords.join(' ');
        return lineText
            .trim()
            .split(/[\s-]+/)
            .filter(word => word.length > 0)
            .reduce((total, word) => total + countSyllables(word.replace(/[^a-z']/gi, '')), 0);
    });
}