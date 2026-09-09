import fs from 'node:fs';
import path from 'node:path';
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

function displaySongs() {
  const songs = loadSongs();

  console.log('🎵 Terminal Music Player');
  console.log();
  console.log('Available Songs:');
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
    console.log(`${index + 1}. ${song}`);
  });
}

displaySongs();