/**
 * Types for the Pin Folder feature
 */

/**
 * Represents a single pin in the pin folder
 */
export interface Pin {
  id: string;
  name: string;
  description: string;
  duration: number;
  lat: number;
  lng: number;
  addedAt: string; // ISO date string
}

/**
 * Represents a user's pin folder
 */
export interface PinFolder {
  userId: string;
  pins: Pin[];
  updatedAt: string; // ISO date string
}