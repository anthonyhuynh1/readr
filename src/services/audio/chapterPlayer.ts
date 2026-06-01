import { Audio, type AVPlaybackStatus } from 'expo-av';
import { audioToVisualMs, visualToAudioMs } from '../../utils/syncAsset';

let audioModeReady = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  audioModeReady = true;
}

export interface ChapterPlayerOptions {
  uri: string;
  headers?: Record<string, string>;
  audioOffsetMs: number;
  onVisualPosition: (visualMs: number) => void;
  onDuration: (visualDurationMs: number) => void;
  onEnded: () => void;
  onError: (message: string) => void;
}

export class ChapterAudioPlayer {
  private sound: Audio.Sound | null = null;
  private audioOffsetMs = 0;
  private visualDurationMs = 0;
  private onVisualPosition: (visualMs: number) => void = () => {};
  private onDuration: (visualDurationMs: number) => void = () => {};
  private onEnded: () => void = () => {};
  private onError: (message: string) => void = () => {};
  private loadedUri: string | null = null;

  private handleStatus = (status: AVPlaybackStatus): void => {
    if (!status.isLoaded) {
      if (status.error) {
        this.onError(status.error);
      }
      return;
    }

    const visualMs = audioToVisualMs(status.positionMillis, this.audioOffsetMs);
    this.onVisualPosition(visualMs);

    const duration = audioToVisualMs(status.durationMillis ?? 0, this.audioOffsetMs);
    if (duration > 0 && duration !== this.visualDurationMs) {
      this.visualDurationMs = duration;
      this.onDuration(duration);
    }

    if (status.didJustFinish) {
      this.onEnded();
    }
  };

  async load(options: ChapterPlayerOptions): Promise<void> {
    await ensureAudioMode();
    await this.unload();

    this.audioOffsetMs = options.audioOffsetMs;
    this.onVisualPosition = options.onVisualPosition;
    this.onDuration = options.onDuration;
    this.onEnded = options.onEnded;
    this.onError = options.onError;
    this.visualDurationMs = 0;

    const source = options.headers
      ? { uri: options.uri, headers: options.headers }
      : { uri: options.uri };

    const { sound } = await Audio.Sound.createAsync(
      source,
      { shouldPlay: false, progressUpdateIntervalMillis: 50 },
      this.handleStatus,
    );

    this.sound = sound;
    this.loadedUri = options.uri;

    const status = await sound.getStatusAsync();
    if (status.isLoaded && status.durationMillis) {
      const visualDuration = audioToVisualMs(status.durationMillis, this.audioOffsetMs);
      this.visualDurationMs = visualDuration;
      this.onDuration(visualDuration);
    }
  }

  async play(): Promise<void> {
    if (!this.sound) return;
    await this.sound.playAsync();
  }

  async pause(): Promise<void> {
    if (!this.sound) return;
    await this.sound.pauseAsync();
  }

  async setRate(rate: number): Promise<void> {
    if (!this.sound) return;
    await this.sound.setRateAsync(rate, true);
  }

  async seekVisualMs(visualMs: number): Promise<void> {
    if (!this.sound) return;
    const audioMs = visualToAudioMs(Math.max(0, visualMs), this.audioOffsetMs);
    await this.sound.setPositionAsync(audioMs);
    this.onVisualPosition(Math.max(0, visualMs));
  }

  async skipVisualMs(deltaMs: number): Promise<void> {
    const current = await this.getVisualPositionMs();
    const max = this.visualDurationMs > 0 ? this.visualDurationMs : current + Math.abs(deltaMs);
    await this.seekVisualMs(Math.max(0, Math.min(current + deltaMs, max)));
  }

  async getVisualPositionMs(): Promise<number> {
    if (!this.sound) return 0;
    const status = await this.sound.getStatusAsync();
    if (!status.isLoaded) return 0;
    return audioToVisualMs(status.positionMillis, this.audioOffsetMs);
  }

  getVisualDurationMs(): number {
    return this.visualDurationMs;
  }

  isLoaded(): boolean {
    return this.sound !== null;
  }

  async unload(): Promise<void> {
    if (!this.sound) return;
    await this.sound.unloadAsync();
    this.sound = null;
    this.loadedUri = null;
    this.visualDurationMs = 0;
  }
}

export const chapterAudioPlayer = new ChapterAudioPlayer();
