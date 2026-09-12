import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import decodeMp3 from '@audio/decode-mp3';
import Speaker from 'speaker';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectoryPath = path.dirname(currentFilePath);
const songsDirectoryPath = path.join(currentDirectoryPath, '..', 'songs');

export function loadSongs() {
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

function clearTerminal() {
  process.stdout.write('\x1b[2J\x1b[H');
}

const terminalWidth = 56;
const contentWidth = terminalWidth - 2;

function centerText(text) {
  const trimmedText = text.slice(0, contentWidth);
  const leftPadding = Math.floor((contentWidth - trimmedText.length) / 2);
  return `${' '.repeat(leftPadding)}${trimmedText}${' '.repeat(
    contentWidth - leftPadding - trimmedText.length,
  )}`;
}

function formatBoxLine(text = '') {
  const maximumTextLength = Math.max(0, contentWidth - 1);
  const trimmedText = text.slice(0, maximumTextLength);
  const paddingLength = Math.max(
    0,
    contentWidth - trimmedText.length - 1,
  );

  return `║ ${trimmedText}${' '.repeat(paddingLength)}║`;
}

function displayHeader() {
  console.log(`╔${'═'.repeat(contentWidth)}╗`);
  console.log(`║${centerText('TERMINAL MUSIC PLAYER')}║`);
  console.log(`║${centerText('YOUR MUSIC • COMMAND LINE EDITION')}║`);
  console.log(`╚${'═'.repeat(contentWidth)}╝`);
}

function displayBoxTitle(title) {
  console.log(`╔${'═'.repeat(contentWidth)}╗`);
  console.log(`║ ${title.padEnd(contentWidth - 1)}║`);
}

function displayBoxEnd() {
  console.log(`╚${'═'.repeat(contentWidth)}╝`);
}

function truncateSongName(song, maximumLength) {
  const displayName = song.replace(/\.mp3$/i, '');

  if (displayName.length <= maximumLength) {
    return displayName;
  }

  return `${displayName.slice(0, maximumLength - 3)}...`;
}

function displaySongs(songs, selectedSongIndex = null) {
  clearTerminal();
  displayHeader();
  console.log();

  if (songs === null) {
    displayBoxTitle('MUSIC LIBRARY');
    console.log(formatBoxLine());
    console.log(formatBoxLine('⚠  Songs folder not found.'));
    console.log(formatBoxLine('   Create songs/ and add MP3 files to continue.'));
    displayBoxEnd();
    return;
  }

  if (songs.length === 0) {
    displayBoxTitle('MUSIC LIBRARY');
    console.log(formatBoxLine());
    console.log(formatBoxLine('⚠  No MP3 files found.'));
    console.log(formatBoxLine('   Add .mp3 files to the songs/ folder.'));
    displayBoxEnd();
    return;
  }

  displayBoxTitle(`LIBRARY  •  ${selectedSongIndex + 1} / ${songs.length} TRACKS`);
  console.log(formatBoxLine());

  songs.forEach((song, index) => {
    const selectionMarker = index === selectedSongIndex ? '▶' : ' ';
    const trackNumber = String(index + 1).padStart(2, '0');
    const displayName = truncateSongName(song, contentWidth - 11);
    console.log(formatBoxLine(`${selectionMarker}  ${trackNumber}  ${displayName}`));
  });

  displayBoxEnd();
}

const playbackStates = {
  STOPPED: 'stopped',
  PLAYING: 'playing',
  PAUSED: 'paused',
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds,
  ).padStart(2, '0')}`;
}

function createProgressBar(currentSeconds, totalSeconds) {
  const barWidth = 20;

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return `[${'-'.repeat(barWidth)}]`;
  }

  const progress = Math.max(0, Math.min(1, currentSeconds / totalSeconds));
  const filledWidth = Math.floor(progress * barWidth);

  return `[${'█'.repeat(filledWidth)}${'░'.repeat(
    barWidth - filledWidth,
  )}]`;
}

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

function displayPlaybackInfo(playbackInfo) {
  const statusLabels = {
    playing: '▶  PLAYING',
    paused: '⏸  PAUSED',
    stopped: '■  STOPPED',
  };
  const displayState = statusLabels[playbackInfo.state] || '■  STOPPED';
  const displaySong = playbackInfo.song
    ? truncateSongName(playbackInfo.song, contentWidth - 5)
    : 'Nothing selected';

  console.log();
  displayBoxTitle('NOW PLAYING');
  console.log(formatBoxLine());
  console.log(formatBoxLine(`♪  ${displaySong}`));
  console.log(formatBoxLine());
  console.log(formatBoxLine(`Status   ${displayState}`));
  console.log(
    formatBoxLine(
      `${formatTime(playbackInfo.currentSeconds)}  ${createProgressBar(
        playbackInfo.currentSeconds,
        playbackInfo.totalSeconds,
      )}  ${formatTime(playbackInfo.totalSeconds)}`,
    ),
  );
  displayBoxEnd();

  if (lastErrorMessage !== null) {
    console.log();
    displayBoxTitle('⚠  ERROR');
    console.log(formatBoxLine(lastErrorMessage.replace(/^Error:\s*/, '')));
    displayBoxEnd();
  }

  console.log();
  displayBoxTitle('CONTROLS');
  console.log(formatBoxLine('↑ ↓  Navigate     Enter  Play'));
  console.log(formatBoxLine('Space  Pause/Resume     Q  Quit'));
  console.log(formatBoxLine('Ctrl+C  Exit'));
  displayBoxEnd();
}

function displayStartupError(message) {
  clearTerminal();
  displayHeader();
  console.log();
  displayBoxTitle('⚠  ERROR');
  console.log(formatBoxLine(message));
  displayBoxEnd();
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
  const reason = error?.message || 'The audio file may be corrupted or unsupported.';
  lastErrorMessage = `Error: Unable to play "${song}". ${reason}`;
  stopCurrentSong();
  refreshUi();
}

function createPcmBuffer(channelData) {
  const channelCount = channelData.length;
  const frameCount = channelData[0].length;
  const pcmBuffer = Buffer.alloc(frameCount * channelCount * 2);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(
        -1,
        Math.min(1, channelData[channelIndex][frameIndex]),
      );
      const pcmSample = Math.round(sample * 32767);
      const bufferOffset = (frameIndex * channelCount + channelIndex) * 2;
      pcmBuffer.writeInt16LE(pcmSample, bufferOffset);
    }
  }

  return pcmBuffer;
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

      if (finishedPlayback.naturalEnd) {
        finishedPlayback.onNaturalEnd?.();
      }
    }
  });

  playback.speaker = speaker;
  playback.positionStartedAt = performance.now();
  writeNextAudioChunk();
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

function startTerminalUi() {
  let songs;

  clearTerminal();
  displayHeader();
  console.log();
  displayBoxTitle('MUSIC LIBRARY');
  console.log(formatBoxLine('♪  Loading your music library...'));
  displayBoxEnd();

  try {
    songs = loadSongs();
  } catch (error) {
    displayStartupError(
      `Unable to read songs folder. ${error.message || 'Please check its permissions.'}`,
    );
    return;
  }

  if (songs === null || songs.length === 0) {
    displaySongs(songs);
    return;
  }

  let selectedSongIndex = 0;

  const playSelectedSong = () => {
    if (selectedSongIndex < 0 || selectedSongIndex >= songs.length) {
      return;
    }

    playSong(songs[selectedSongIndex], () => {
      if (selectedSongIndex < songs.length - 1) {
        selectedSongIndex += 1;
        playSelectedSong();
      }
    });
  };

  const render = () => {
    displaySongs(songs, selectedSongIndex);
    displayPlaybackInfo(getPlaybackInfo());
  };

  refreshUi = render;

  render();

  if (!process.stdin.isTTY) {
    return;
  }

  const exitTerminalUi = () => {
    process.stdin.removeListener('keypress', handleKeypress);
    stopCurrentSong();
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write('\n');
    process.exit(0);
  };

  try {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
  } catch (error) {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    displayStartupError(
      `Unable to enable keyboard input. ${error.message || 'Please use a TTY.'}`,
    );
    return;
  }

  const handleKeypress = (_input, key) => {
    if (!key || typeof key.name !== 'string') {
      return;
    }

    if (key.ctrl && key.name === 'c') {
      exitTerminalUi();
      return;
    }

    if (key.name === 'q') {
      exitTerminalUi();
      return;
    }

    if (key.name === 'return') {
      playSelectedSong();
      return;
    }

    if (key.name === 'space') {
      if (playbackState === playbackStates.PLAYING) {
        pauseSong();
      } else if (playbackState === playbackStates.PAUSED) {
        resumeSong();
      }
      return;
    }

    if (key.name === 'up' && selectedSongIndex > 0) {
      selectedSongIndex -= 1;
      render();
    }

    if (key.name === 'down' && selectedSongIndex < songs.length - 1) {
      selectedSongIndex += 1;
      render();
    }
  };

  process.stdin.on('keypress', handleKeypress);
}

startTerminalUi();