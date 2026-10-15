/* Real photos from Cue Point Pool Parlour (public/media/gallery). Resized to
   ≤1600px and stripped of camera metadata. `w`/`h` keep the grid from
   jumping while images load. */

export interface GalleryPhoto {
  src: string;
  alt: string;
  w: number;
  h: number;
}

const g = (name: string, alt: string, w: number, h: number): GalleryPhoto => ({
  src: `/media/gallery/${name}.jpg`,
  alt,
  w,
  h,
});

export const GALLERY: GalleryPhoto[] = [
  g("logo-wall-shot", "A player lines up a shot in front of the Cue Point neon sign", 1448, 1086),
  g("neon-break", "A player breaks under the glowing Cue Point logo", 1205, 1600),
  g("the-room", "The Cue Point room with its tables, pendant lights and framed pool art", 1280, 964),
  g("doubles", "Friends playing doubles by the window", 1448, 1086),
  g("full-rack", "A player down on a shot with a full rack spread across the table", 1203, 1600),
  g("king-table-shot", "A long pot on the 9-foot King Model international table", 1448, 1086),
  g("neon-table", "Two players at a table lit in neon blue", 963, 1280),
  g("break-off", "A player cueing up while a friend watches", 1448, 1086),
  g("group-night", "A group of friends gathered around a table at night", 964, 1280),
  g("couple-game", "Two players sharing a game under the pendant lights", 1280, 964),
  g("long-pot", "A player stretched along the rail for a long pot", 1448, 1086),
  g("cut-shot", "A player playing a cut shot into the corner", 1203, 1600),
  g("logo-table", "A table racked and ready beneath the Cue Point sign", 964, 1280),
  g("waiting-turn", "A player leaning on a cue, waiting their turn", 1202, 1600),
  g("table-row", "A tournament-grade table under a row of pendant lamps", 964, 1280),
  g("under-the-lamp", "A player studying the table under the lamp", 1202, 1600),
  g("blue-table", "A blue-cloth table framed by pool art on the walls", 964, 1280),
  g("late-night", "A late-night shot along the rail", 862, 1279),
  g("cue-rack-wall", "Tables, cue racks and artwork across the room", 964, 1280),
];

/** Wide shots used as page backdrops. */
export const BACKDROPS = {
  room: "/media/gallery/the-room.jpg",
  logoWall: "/media/gallery/logo-wall-shot.jpg",
  breakOff: "/media/gallery/break-off.jpg",
  doubles: "/media/gallery/doubles.jpg",
  couple: "/media/gallery/couple-game.jpg",
  kingTable: "/media/gallery/king-table-shot.jpg",
  longPot: "/media/gallery/long-pot.jpg",
} as const;
