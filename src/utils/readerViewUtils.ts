/** Whether the active paragraph row should render word-level karaoke. */
export function shouldShowWordKaraoke(
  karaokeEnabled: boolean,
  isPlaying: boolean,
  sentenceIndex: number,
  activeSentenceIndex: number,
): boolean {
  return karaokeEnabled && isPlaying && sentenceIndex === activeSentenceIndex;
}
