import { Track, Album, Artist } from '@/types/music';

// Gradient cover generator using inline SVG data URIs
function svgCover(title: string, h1: number, h2: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${h1},80%,40%)"/>
      <stop offset="100%" style="stop-color:hsl(${h2},70%,25%)"/>
    </linearGradient></defs>
    <rect width="300" height="300" fill="url(#g)"/>
    <text x="150" y="140" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="24" fill="rgba(255,255,255,0.9)">${escapeXml(title.length > 18 ? title.substring(0, 16) + '…' : title)}</text>
    <text x="150" y="175" text-anchor="middle" font-family="system-ui,sans-serif" font-size="50" fill="rgba(255,255,255,0.3)">♪</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Artists & Albums ──────────────────────────────────────────

const artistsData: { name: string; albums: { title: string; year: number; genre: string; h1: number; h2: number; tracks: { title: string; duration: number }[] }[] }[] = [
  {
    name: 'Midnight Echoes',
    albums: [
      {
        title: 'Neon Horizons', year: 2023, genre: 'Synthwave', h1: 280, h2: 320,
        tracks: [
          { title: 'Electric Dawn', duration: 234 },
          { title: 'Chrome Skyline', duration: 198 },
          { title: 'Neon Rain', duration: 267 },
          { title: 'Digital Pulse', duration: 212 },
          { title: 'Velocity', duration: 189 },
          { title: 'After Midnight', duration: 301 },
          { title: 'Synth Cathedral', duration: 256 },
          { title: 'Hologram', duration: 223 },
          { title: 'Retrograde', duration: 278 },
          { title: 'Endless Highway', duration: 315 },
        ]
      },
      {
        title: 'Shadow Protocol', year: 2021, genre: 'Synthwave', h1: 200, h2: 260,
        tracks: [
          { title: 'Protocol Zero', duration: 245 },
          { title: 'Dark Matter', duration: 312 },
          { title: 'Binary Sunset', duration: 198 },
          { title: 'Ghost Signal', duration: 276 },
          { title: 'Cipher', duration: 203 },
          { title: 'Data Stream', duration: 189 },
          { title: 'Quantum Leap', duration: 334 },
          { title: 'Blackout', duration: 267 },
        ]
      }
    ]
  },
  {
    name: 'Amber Waves',
    albums: [
      {
        title: 'Golden Hour', year: 2024, genre: 'Indie Folk', h1: 35, h2: 15,
        tracks: [
          { title: 'Sunrise Over Fields', duration: 224 },
          { title: 'Harvest Moon', duration: 198 },
          { title: 'Wildflower', duration: 256 },
          { title: 'Dusty Roads', duration: 312 },
          { title: 'Amber Light', duration: 187 },
          { title: 'River Song', duration: 245 },
          { title: 'Firefly Night', duration: 278 },
          { title: 'Home Again', duration: 234 },
          { title: 'Last Summer', duration: 301 },
        ]
      },
      {
        title: 'Paper Wings', year: 2022, genre: 'Indie Folk', h1: 50, h2: 30,
        tracks: [
          { title: 'Origami Hearts', duration: 213 },
          { title: 'Paper Planes', duration: 187 },
          { title: 'Whisper Wind', duration: 298 },
          { title: 'Lantern Glow', duration: 234 },
          { title: 'Featherweight', duration: 167 },
          { title: 'Kite Strings', duration: 256 },
          { title: 'Soft Landing', duration: 312 },
        ]
      }
    ]
  },
  {
    name: 'Crystal Method',
    albums: [
      {
        title: 'Prism', year: 2023, genre: 'Electronic', h1: 180, h2: 220,
        tracks: [
          { title: 'Refraction', duration: 287 },
          { title: 'Spectrum', duration: 345 },
          { title: 'Kaleidoscope', duration: 256 },
          { title: 'Diamond Eyes', duration: 198 },
          { title: 'Glass Ocean', duration: 312 },
          { title: 'Luminance', duration: 267 },
          { title: 'Shatter', duration: 189 },
          { title: 'Crystal Clear', duration: 234 },
          { title: 'Iridescent', duration: 301 },
          { title: 'Reflection Pool', duration: 278 },
          { title: 'Light Bender', duration: 223 },
        ]
      }
    ]
  },
  {
    name: 'Nova Drift',
    albums: [
      {
        title: 'Stardust', year: 2024, genre: 'Dream Pop', h1: 260, h2: 300,
        tracks: [
          { title: 'Cosmic Dust', duration: 289 },
          { title: 'Nebula', duration: 234 },
          { title: 'Gravity Well', duration: 312 },
          { title: 'Solar Wind', duration: 198 },
          { title: 'Event Horizon', duration: 356 },
          { title: 'Astral Plane', duration: 267 },
          { title: 'Starlight', duration: 223 },
          { title: 'Supernova', duration: 189 },
          { title: 'Wormhole', duration: 301 },
        ]
      },
      {
        title: 'Oceanic', year: 2022, genre: 'Dream Pop', h1: 190, h2: 230,
        tracks: [
          { title: 'Deep Blue', duration: 267 },
          { title: 'Tidal', duration: 234 },
          { title: 'Coral Reef', duration: 198 },
          { title: 'Bioluminescent', duration: 312 },
          { title: 'Undertow', duration: 256 },
          { title: 'Mariana', duration: 289 },
          { title: 'Siren Song', duration: 223 },
          { title: 'Driftwood', duration: 178 },
        ]
      },
      {
        title: 'Terraform', year: 2020, genre: 'Ambient', h1: 120, h2: 160,
        tracks: [
          { title: 'New Earth', duration: 345 },
          { title: 'Atmosphere', duration: 298 },
          { title: 'Biodome', duration: 267 },
          { title: 'Genesis', duration: 312 },
          { title: 'Seedling', duration: 234 },
          { title: 'Canopy', duration: 289 },
        ]
      }
    ]
  },
  {
    name: 'The Velvet Wire',
    albums: [
      {
        title: 'Voltage', year: 2024, genre: 'Alternative Rock', h1: 0, h2: 30,
        tracks: [
          { title: 'Spark', duration: 212 },
          { title: 'Wire & Flame', duration: 234 },
          { title: 'Overdrive', duration: 189 },
          { title: 'Static Heart', duration: 267 },
          { title: 'Feedback Loop', duration: 198 },
          { title: 'Amplified', duration: 256 },
          { title: 'Short Circuit', duration: 223 },
          { title: 'Unplugged', duration: 312 },
          { title: 'Resonance', duration: 245 },
          { title: 'Grounded', duration: 287 },
          { title: 'Live Wire', duration: 198 },
          { title: 'Blackout Curtains', duration: 334 },
        ]
      }
    ]
  },
  {
    name: 'Luna Park',
    albums: [
      {
        title: 'Carousel', year: 2023, genre: 'Pop', h1: 310, h2: 350,
        tracks: [
          { title: 'Spinning Around', duration: 198 },
          { title: 'Cotton Candy', duration: 212 },
          { title: 'Ferris Wheel', duration: 234 },
          { title: 'Neon Lights', duration: 187 },
          { title: 'Summer Night', duration: 256 },
          { title: 'Carousel', duration: 278 },
          { title: 'Ticket to Ride', duration: 201 },
          { title: 'Fun House', duration: 223 },
          { title: 'Last Dance', duration: 312 },
        ]
      },
      {
        title: 'Moonrise', year: 2021, genre: 'Pop', h1: 240, h2: 280,
        tracks: [
          { title: 'Crescent', duration: 234 },
          { title: 'Twilight Zone', duration: 198 },
          { title: 'Phase Shift', duration: 267 },
          { title: 'Lunar Eclipse', duration: 289 },
          { title: 'Dark Side', duration: 312 },
          { title: 'Moonbeam', duration: 178 },
          { title: 'Selenophile', duration: 245 },
        ]
      }
    ]
  },
  {
    name: 'Desert Mirage',
    albums: [
      {
        title: 'Oasis', year: 2024, genre: 'Psychedelic', h1: 25, h2: 55,
        tracks: [
          { title: 'Heat Shimmer', duration: 334 },
          { title: 'Sand Dunes', duration: 256 },
          { title: 'Mirage', duration: 289 },
          { title: 'Oasis', duration: 312 },
          { title: 'Caravan', duration: 267 },
          { title: 'Scorched', duration: 198 },
          { title: 'Sandstorm', duration: 234 },
          { title: 'Nomad', duration: 301 },
          { title: 'Starlit Desert', duration: 378 },
        ]
      }
    ]
  },
  {
    name: 'Jade Circuit',
    albums: [
      {
        title: 'Mainframe', year: 2023, genre: 'Tech House', h1: 140, h2: 180,
        tracks: [
          { title: 'Boot Sequence', duration: 287 },
          { title: 'Neural Net', duration: 312 },
          { title: 'Packet Loss', duration: 234 },
          { title: 'Firewall', duration: 198 },
          { title: 'Root Access', duration: 267 },
          { title: 'Compile', duration: 245 },
          { title: 'Stack Overflow', duration: 301 },
          { title: 'Kernel Panic', duration: 189 },
          { title: 'Debug Mode', duration: 356 },
          { title: 'Clean Exit', duration: 223 },
        ]
      }
    ]
  }
];

// Build the full data structures
let trackIdCounter = 0;
let albumIdCounter = 0;
let artistIdCounter = 0;

export const allArtists: Artist[] = [];
export const allAlbums: Album[] = [];
export const allTracks: Track[] = [];

for (const artistData of artistsData) {
  const artistId = `artist-${++artistIdCounter}`;
  const artistAlbums: Album[] = [];
  let artistTrackCount = 0;

  for (const albumData of artistData.albums) {
    const albumId = `album-${++albumIdCounter}`;
    const coverUrl = svgCover(albumData.title, albumData.h1, albumData.h2);
    const albumTracks: Track[] = [];

    for (let i = 0; i < albumData.tracks.length; i++) {
      const t = albumData.tracks[i];
      const trackId = `track-${++trackIdCounter}`;
      const track: Track = {
        id: trackId,
        title: t.title,
        artist: artistData.name,
        artistId,
        album: albumData.title,
        albumId,
        duration: t.duration,
        trackNumber: i + 1,
        genre: albumData.genre,
        year: albumData.year,
        coverUrl,
      };
      albumTracks.push(track);
      allTracks.push(track);
    }

    artistTrackCount += albumTracks.length;

    const album: Album = {
      id: albumId,
      title: albumData.title,
      artist: artistData.name,
      artistId,
      year: albumData.year,
      genre: albumData.genre,
      coverUrl,
      trackCount: albumTracks.length,
      tracks: albumTracks,
    };
    artistAlbums.push(album);
    allAlbums.push(album);
  }

  const artist: Artist = {
    id: artistId,
    name: artistData.name,
    imageUrl: svgCover(artistData.name, artistData.albums[0].h1 + 30, artistData.albums[0].h2 + 30),
    albumCount: artistAlbums.length,
    trackCount: artistTrackCount,
    albums: artistAlbums,
  };
  allArtists.push(artist);
}

// Helper lookups
export function getTrackById(id: string): Track | undefined {
  return allTracks.find(t => t.id === id);
}

export function getAlbumById(id: string): Album | undefined {
  return allAlbums.find(a => a.id === id);
}

export function getArtistById(id: string): Artist | undefined {
  return allArtists.find(a => a.id === id);
}

export function searchTracks(query: string): Track[] {
  const q = query.toLowerCase();
  return allTracks.filter(t =>
    t.title.toLowerCase().includes(q) ||
    t.artist.toLowerCase().includes(q) ||
    t.album.toLowerCase().includes(q)
  );
}

export function searchAlbums(query: string): Album[] {
  const q = query.toLowerCase();
  return allAlbums.filter(a =>
    a.title.toLowerCase().includes(q) ||
    a.artist.toLowerCase().includes(q)
  );
}

export function searchArtists(query: string): Artist[] {
  const q = query.toLowerCase();
  return allArtists.filter(a => a.name.toLowerCase().includes(q));
}
