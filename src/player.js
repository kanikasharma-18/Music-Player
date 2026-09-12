import fs from 'node:fs';
import path from 'node:path';
import decodeMp3 from '@audio/decode-mp3';
import Speaker from 'speaker';

export const playbackStates = {
  STOPPED: 'stopped',
  PLAYING: 'playing',
  PAUSED: 'paused',
};

export function loadSongs(songsDirectoryPath) {
  try {
    const directoryEntries = fs.readdirSync(songsDirectoryPath, {
      withFileTypes: true,
    });

    return directoryEntries
      .filter(
        (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp3'),
      )
      .map((entry) => entry.name);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export function createPlayer(songsDirectoryPath) {
  let currentPlayback = null;
  let playbackState = playbackStates.STOPPED;
  let playbackRequestId = 0;
  let playbackInfoInterval = null;
  let refreshUi = () => {};
  let lastErrorMessage = null;

  function stopPlaybackInfoUpdates() {
    if (playbackInfoInterval !== null) {
      clearInterval(playbackInfoInterval);
      playbackInfoInterval = null;
    }
  }

  function startPlaybackInfoUpdates() {
    stopPlaybackInfoUpdates();
    playbackInfoInterval = setInterval(refreshUi, 250);
  }

  function getPlaybackInfo() {
    if (currentPlayback === null) {
      return {
        song: null,
        state: playbackState,
        currentSeconds: 0,
        totalSeconds: 0,
      };
    }

    let currentSeconds = currentPlayback.positionSeconds;

    if (
      playbackState === playbackStates.PLAYING &&
      currentPlayback.positionStartedAt !== null
    ) {
      currentSeconds +=
        (performance.now() - currentPlayback.positionStartedAt) / 1000;
    }

    return {
      song: currentPlayback.song,
      state: playbackState,
      currentSeconds: Math.min(currentSeconds, currentPlayback.totalSeconds),
      totalSeconds: currentPlayback.totalSeconds,
    };
  }

  function stopCurrentSong() {
    playbackRequestId += 1;
    stopPlaybackInfoUpdates();

    if (currentPlayback !== null) {
      currentPlayback.stopped = true;
      if (currentPlayback.speaker !== null) {
        currentPlayback.speaker.close(false);
      }
      currentPlayback = null;
    }

    playbackState = playbackStates.STOPPED;
    refreshUi();
  }

  function handlePlaybackError(song, error) {
    const reason =
      error?.message || 'The audio file may be corrupted or unsupported.';
    lastErrorMessage = `Error: Unable to play "${song}". ${reason}`;
    stopCurrentSong();
    refreshUi();
  }

  function createPcmBuffer(channelData) {
    const channelCount = channelData.length;
    const frameCount = channelData[0].length;
    const pcmBuffer = Buffer.alloc(frameCount * channelCount * 2);

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      for (
        let channelIndex = 0;
        channelIndex < channelCount;
        channelIndex += 1
      ) {
        const sample = Math.max(
          -1,
          Math.min(1, channelData[channelIndex][frameIndex]),
        );
        const pcmSample = Math.round(sample * 32767);
        const bufferOffset =
          (frameIndex * channelCount + channelIndex) * 2;
        pcmBuffer.writeInt16LE(pcmSample, bufferOffset);
      }
    }

    return pcmBuffer;
  }

  function writeNextAudioChunk() {
    if (
      currentPlayback === null ||
      currentPlayback.stopped ||
      playbackState !== playbackStates.PLAYING
    ) {
      return;
    }

    const { speaker, pcmBuffer } = currentPlayback;
    // Keep each write below speaker's 0.5-second CoreAudio FIFO capacity.
    const chunkSize = speaker.channels * 2 * speaker.samplesPerFrame * 16;

    if (currentPlayback.bufferOffset >= pcmBuffer.length) {
      speaker.end();
      return;
    }

    const chunk = pcmBuffer.subarray(
      currentPlayback.bufferOffset,
      currentPlayback.bufferOffset + chunkSize,
    );
    currentPlayback.bufferOffset += chunk.length;

    speaker.write(chunk, (error) => {
      if (error) {
        if (
          currentPlayback?.speaker !== speaker ||
          playbackState !== playbackStates.PLAYING
        ) {
          return;
        }

        handlePlaybackError(currentPlayback.song, error);
        return;
      }

      writeNextAudioChunk();
    });
  }

  function startSpeaker() {
    if (
      currentPlayback === null ||
      currentPlayback.stopped ||
      playbackState !== playbackStates.PLAYING
    ) {
      return;
    }

    const playback = currentPlayback;
    const speaker = new Speaker({
      channels: playback.channelCount,
      bitDepth: 16,
      sampleRate: playback.sampleRate,
    });

    speaker.on('error', (error) => {
      if (
        currentPlayback?.speaker !== speaker ||
        playbackState !== playbackStates.PLAYING
      ) {
        return;
      }

      handlePlaybackError(currentPlayback.song, error);
    });

    speaker.on('flush', () => {
      if (
        currentPlayback?.speaker === speaker &&
        playbackState === playbackStates.PLAYING
      ) {
        currentPlayback.naturalEnd = true;
      }
    });

    speaker.on('close', () => {
      if (currentPlayback?.speaker === speaker && !currentPlayback.stopped) {
        const finishedPlayback = currentPlayback;
        currentPlayback = null;
        playbackState = playbackStates.STOPPED;
        stopPlaybackInfoUpdates();
        refreshUi();

        // The callback advances to the next song only after the speaker closes naturally.
        if (finishedPlayback.naturalEnd) {
          finishedPlayback.onNaturalEnd?.();
        }
      }
    });

    playback.speaker = speaker;
    playback.positionStartedAt = performance.now();
    writeNextAudioChunk();
  }

  async function playSong(song, onNaturalEnd = null) {
    stopCurrentSong();
    lastErrorMessage = null;
    const requestId = ++playbackRequestId;
    const songPath = path.join(songsDirectoryPath, song);

    try {
      const mp3Buffer = fs.readFileSync(songPath);
      const decodedAudio = await decodeMp3(mp3Buffer);

      if (
        requestId !== playbackRequestId ||
        decodedAudio.channelData.length === 0 ||
        decodedAudio.sampleRate === 0
      ) {
        if (requestId === playbackRequestId) {
          throw new Error('The file does not contain readable MP3 audio.');
        }
        return;
      }

      const pcmBuffer = createPcmBuffer(decodedAudio.channelData);
      currentPlayback = {
        speaker: null,
        song,
        channelCount: decodedAudio.channelData.length,
        sampleRate: decodedAudio.sampleRate,
        pcmBuffer,
        bufferOffset: 0,
        positionSeconds: 0,
        positionStartedAt: null,
        totalSeconds:
          decodedAudio.channelData[0].length / decodedAudio.sampleRate,
        onNaturalEnd,
        naturalEnd: false,
        stopped: false,
      };
      playbackState = playbackStates.PLAYING;
      startSpeaker();
      startPlaybackInfoUpdates();
      refreshUi();
    } catch (error) {
      handlePlaybackError(song, error);
    }
  }

  function pauseSong() {
    if (playbackState === playbackStates.PLAYING && currentPlayback !== null) {
      currentPlayback.positionSeconds = getPlaybackInfo().currentSeconds;
      currentPlayback.positionStartedAt = null;
      const speaker = currentPlayback.speaker;
      currentPlayback.speaker = null;
      playbackState = playbackStates.PAUSED;
      stopPlaybackInfoUpdates();
      refreshUi();

      if (speaker !== null) {
        speaker.close(false);
      }
    }
  }

  function resumeSong() {
    if (playbackState === playbackStates.PAUSED && currentPlayback !== null) {
      try {
        playbackState = playbackStates.PLAYING;
        startSpeaker();
        startPlaybackInfoUpdates();
        refreshUi();
      } catch (error) {
        handlePlaybackError(currentPlayback?.song || 'current song', error);
      }
    }
  }

  return {
    getPlaybackInfo,
    getLastErrorMessage: () => lastErrorMessage,
    playSong,
    pauseSong,
    resumeSong,
    stopCurrentSong,
    setRefreshUi: (callback) => {
      refreshUi = callback;
    },
  };
}
