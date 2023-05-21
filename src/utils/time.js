/**
 * Converts seconds into minutes and seconds
 * convertSecondsToMinutesAndSeconds(90) -> "1:30"
 */
export function convertSecondsToMinutesAndSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
}
