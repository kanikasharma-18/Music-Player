import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
  displayPlaybackInfo,
  displaySongs,
  displayStartupError,
  displayLoadingMessage,
} from './ui.js';
import {
  createPlayer,
  loadSongs,
  playbackStates,
} from './player.js';

export { loadSongs } from './player.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectoryPath = path.dirname(currentFilePath);
const songsDirectoryPath = path.join(currentDirectoryPath, '..', 'songs');

function startTerminalUi() {
  let songs;

  displayLoadingMessage();

  try {
    songs = loadSongs(songsDirectoryPath);
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
  const player = createPlayer(songsDirectoryPath);

  const playSelectedSong = () => {
    if (selectedSongIndex < 0 || selectedSongIndex >= songs.length) {
      return;
    }

    player.playSong(songs[selectedSongIndex], () => {
      if (selectedSongIndex < songs.length - 1) {
        selectedSongIndex += 1;
        playSelectedSong();
      }
    });
  };

  const render = () => {
    displaySongs(songs, selectedSongIndex);
    displayPlaybackInfo(
      player.getPlaybackInfo(),
      player.getLastErrorMessage(),
    );
  };

  player.setRefreshUi(render);
  render();

  if (!process.stdin.isTTY) {
    return;
  }

  const exitTerminalUi = () => {
    process.stdin.removeListener('keypress', handleKeypress);
    player.stopCurrentSong();
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write('\n');
    process.exit(0);
  };

  try {
    // Raw mode lets readline report individual navigation and control keys.
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
      if (player.getPlaybackInfo().state === playbackStates.PLAYING) {
        player.pauseSong();
      } else if (player.getPlaybackInfo().state === playbackStates.PAUSED) {
        player.resumeSong();
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
