import { capitalize } from "./string";

const adjectives = [
  "happy",
  "sad",
  "angry",
  "funny",
  "serious",
  "colorful",
  "boring",
  "fast",
  "slow",
  "loud",
].map(capitalize);

const nouns = [
  "dog",
  "cat",
  "bird",
  "fish",
  "lion",
  "tiger",
  "bear",
  "elephant",
  "giraffe",
  "whale",
].map(capitalize);

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export default function generateRandomString() {
  const randomNumber = Math.floor(Math.random() * 1000) + 1;

  const randomAdjective = getRandomElement(adjectives);
  const randomNoun = getRandomElement(nouns);

  return `${randomAdjective}${randomNoun}${randomNumber}`;
}
