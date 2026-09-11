import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
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

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  process.stdin.on('keypress', (_input, key) => {
    if (key.ctrl && key.name === 'c') {
      process.stdin.setRawMode(false);
      process.stdin.pause();
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