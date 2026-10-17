// The coins Pac-Man holds, shared by every layer: picked up in the arcade hall, spent in the cabinet. Kept in
// memory only (a reload starts fresh), like the coins already taken from the hall floor.
import { COINS } from './config.js';

const wallet = { coins: COINS.start, taken: new Set() };

export const coins = () => wallet.coins;

export function addCoin(key) {
  wallet.coins += 1;
  if (key) wallet.taken.add(key);
}

// Spend one game's worth; false if there aren't enough.
export function spendCoin() {
  if (wallet.coins < COINS.perGame) return false;
  wallet.coins -= COINS.perGame;
  return true;
}

// Back to a fresh page load (the playtest bots run many games in one process).
export function resetWallet() {
  wallet.coins = COINS.start;
  wallet.taken.clear();
}

export const coinTaken = (key) => wallet.taken.has(key);
