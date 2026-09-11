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

function displaySongs(songs, selectedSongIndex = null) {
  clearTerminal();
  console.log('🎵 TERMINAL MUSIC PLAYER');
  console.log();

  if (songs === null) {
    console.log('❌ Songs directory not found.');
    console.log('Please create a songs/ directory and add MP3 files.');
    return;
  }

  if (songs.length === 0) {
    console.log('❌ No MP3 songs found.');
    console.log('Please add some .mp3 files to the songs/ directory.');
    return;
  }

  songs.forEach((song, index) => {
    const selectionMarker = index === selectedSongIndex ? '>' : ' ';
    console.log(`${selectionMarker} ${song}`);
  });
}

let currentSpeaker = null;
let playbackRequestId = 0;

function stopCurrentSong() {
  playbackRequestId += 1;

  if (currentSpeaker !== null) {
    currentSpeaker.end();
    currentSpeaker = null;
  }
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

async function playSong(song) {
  stopCurrentSong();
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
    const speaker = new Speaker({
      channels: decodedAudio.channelData.length,
      bitDepth: 16,
      sampleRate: decodedAudio.sampleRate,
    });

    speaker.on('error', (error) => {
      console.error(`Audio playback error: ${error.message}`);
      if (currentSpeaker === speaker) {
        currentSpeaker = null;
      }
    });

    speaker.on('close', () => {
      if (currentSpeaker === speaker) {
        currentSpeaker = null;
      }
    });

    currentSpeaker = speaker;
    speaker.end(pcmBuffer);
  } catch (error) {
    console.error(`Unable to play ${song}: ${error.message}`);
  }
}

function startTerminalUi() {
  const songs = loadSongs();

  if (songs === null || songs.length === 0) {
    displaySongs(songs);
    return;
  }

  let selectedSongIndex = 0;

  const render = () => {
    displaySongs(songs, selectedSongIndex);
  };

  render();

  if (!process.stdin.isTTY) {
    return;
  }

  const exitTerminalUi = () => {
    stopCurrentSong();
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write('\n');
  };

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  process.stdin.on('keypress', (_input, key) => {
    if (key.ctrl && key.name === 'c') {
      exitTerminalUi();
      return;
    }

    if (key.name === 'q') {
      exitTerminalUi();
      return;
    }

    if (key.name === 'return') {
      playSong(songs[selectedSongIndex]);
      return;
    }

    if (key.name === 'space') {
      console.log('Space was pressed.');
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
  });
}

startTerminalUi();