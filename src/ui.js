const terminalWidth = 56;
const contentWidth = terminalWidth - 2;

export function clearTerminal() {
  process.stdout.write('\x1b[2J\x1b[H');
}

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

export function displayHeader() {
  console.log(`╔${'═'.repeat(contentWidth)}╗`);
  console.log(`║${centerText('TERMINAL MUSIC PLAYER')}║`);
  console.log(`║${centerText('YOUR MUSIC • COMMAND LINE EDITION')}║`);
  console.log(`╚${'═'.repeat(contentWidth)}╝`);
}

export function displayLoadingMessage() {
  clearTerminal();
  displayHeader();
  console.log();
  displayBoxTitle('MUSIC LIBRARY');
  console.log(formatBoxLine('♪  Loading your music library...'));
  displayBoxEnd();
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

export function displaySongs(songs, selectedSongIndex = null) {
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

  songs.forEach((song, songIndex) => {
    const selectionMarker = songIndex === selectedSongIndex ? '▶' : ' ';
    const trackNumber = String(songIndex + 1).padStart(2, '0');
    const displayName = truncateSongName(song, contentWidth - 11);
    console.log(formatBoxLine(`${selectionMarker}  ${trackNumber}  ${displayName}`));
  });

  displayBoxEnd();
}

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

export function displayPlaybackInfo(playbackInfo, lastErrorMessage = null) {
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

export function displayStartupError(message) {
  clearTerminal();
  displayHeader();
  console.log();
  displayBoxTitle('⚠  ERROR');
  console.log(formatBoxLine(message));
  displayBoxEnd();
}
