
"use strict";

// BookMySeat — Five Cinema Programming
//
// Default: preview without database changes.
// To create missing records: node setupFiveCinemas.js --apply
//
// Existing movies, theatres, screens, showtimes and bookings
// are preserved. No existing records are overwritten.

require("dotenv").config();

const mongoose = require("mongoose");
const Movie = require("./models/Movie");
const Theatre = require("./models/Theatre");
const Screen = require("./models/Screen");
const Show = require("./models/Show");

const APPLY = process.argv.includes("--apply");

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// =====================================================
// TEN MISSING MOVIES
// =====================================================

// Images and video clips come from the existing
// frontend/public/trailers/optimized folder.

const NEW_MOVIES = [
  {
    title: "Godzilla vs. Kong",
    key: "godzilla-vs-kong",
    genre: "Action, Adventure, Science Fiction",
    duration: 113,
    year: 2021,
    description:
      "Two legendary Titans collide in a spectacular monster adventure.",
  },
  {
    title: "Spider-Man: Brand New Day",
    key: "spider-man-brand-new-day",
    genre: "Action, Adventure, Superhero",
    duration: 145,
    year: 2026,
    description:
      "Peter Parker begins a new chapter of his life as Spider-Man.",
  },
  {
    title: "Fast & Furious 9",
    key: "fast-and-furious-9",
    genre: "Action, Adventure, Crime",
    duration: 143,
    year: 2021,
    description:
      "Dominic Toretto and his crew return for another high-stakes mission.",
  },
  {
    title: "Eternals",
    key: "eternals",
    genre: "Action, Adventure, Fantasy",
    duration: 156,
    year: 2021,
    description:
      "Ancient heroes reunite to protect humanity from a looming threat.",
  },
  {
    title: "Star Wars: Episode IX",
    key: "star-wars-episode-ix",
    genre: "Action, Adventure, Science Fiction",
    duration: 142,
    year: 2019,
    description:
      "The Skywalker saga reaches its final chapter.",
  },
  {
    title: "Captain Marvel",
    key: "captain-marvel",
    genre: "Action, Adventure, Science Fiction",
    duration: 124,
    year: 2019,
    description:
      "Carol Danvers discovers her powers and becomes one of the galaxy's strongest heroes.",
  },
  {
    title: "Spider-Man: No Way Home",
    key: "spider-man-no-way-home",
    genre: "Action, Adventure, Superhero",
    duration: 148,
    year: 2021,
    description:
      "Peter Parker faces extraordinary consequences when his identity is revealed.",
  },
  {
    title: "Mortal Kombat",
    key: "mortal-kombat",
    genre: "Action, Fantasy",
    duration: 110,
    year: 2021,
    description:
      "Fighters with remarkable abilities prepare for an epic tournament.",
  },
  {
    title: "Avatar: Fire and Ash",
    key: "avatar-fire-and-ash",
    genre: "Action, Adventure, Science Fiction",
    duration: 195,
    year: 2025,
    description:
      "Return to Pandora for another chapter in the story of Jake Sully and his family.",
  },
  {
    title: "Cruella",
    key: "cruella",
    genre: "Comedy, Crime, Drama",
    duration: 134,
    year: 2021,
    description:
      "A bold young designer makes her mark on the world of fashion.",
  },
];

// =====================================================
// CINEMA LOCATIONS AND FILM DISTRIBUTION
// =====================================================

const CINEMAS = [
  {
    name: "Grand Galleria Mall",
    slug: "grand-galleria-lower-parel-mumbai",
    city: "Mumbai",
    area: "Lower Parel",
    street: "Senapati Bapat Marg",
    state: "Maharashtra",
    image: "lower-parel.jpg",

    movies: [
      "Drishyam: The Conclusion",
      "Verity",
      "The Odyssey",
      "Eternals",
      "The Saga of Rashtriya Rifles",
    ],
  },
  {
    name: "Phoenix Marketcity",
    slug: "phoenix-marketcity-kurla-mumbai",
    city: "Mumbai",
    area: "Kurla West",
    street: "LBS Marg",
    state: "Maharashtra",
    image: "kurla.jpg",

    movies: [
      "Godzilla vs. Kong",
      "Avatar: Fire and Ash",
      "Project Hail Mary",
      "Fast & Furious 9",
      "Captain Marvel",
    ],
  },
  {
    name: "Inorbit Mall",
    slug: "inorbit-mall-malad-mumbai",
    city: "Mumbai",
    area: "Malad West",
    street: "Link Road",
    state: "Maharashtra",
    image: "malad.jpg",

    movies: [
      "Toy Story 5",
      "Cruella",
      "Spider-Man: Brand New Day",
      "Mr Bhaarath",
      "Baththa",
    ],
  },
  {
    name: "R City Mall",
    slug: "r-city-mall-ghatkopar-mumbai",
    city: "Mumbai",
    area: "Ghatkopar West",
    street: "LBS Marg",
    state: "Maharashtra",
    image: "ghatkopar.jpg",

    movies: [
      "Mortal Kombat",
      "Digger",
      "Lucky Strike",
      "Spider-Man: No Way Home",
      "Star Wars: Episode IX",
    ],
  },
  {
    name: "Viviana Mall",
    slug: "viviana-mall-thane",
    city: "Thane",
    area: "Thane",
    street: "Eastern Express Highway",
    state: "Maharashtra",
    image: "thane.jpg",

    movies: [
      "Dhasal",
      "Toy Story 5",
      "Spider-Man: No Way Home",
      "Godzilla vs. Kong",
      "The Odyssey",
    ],
  },
];

// =====================================================
// SEAT LAYOUT — 72 SEATS PER AUDITORIUM
// =====================================================

function buildSeats() {
  const seats = [];
  const rows = "ABCDEF";

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    for (let seatNumber = 1; seatNumber <= 12; seatNumber++) {
      const seatType =
        rowIndex < 2
          ? "REGULAR"
          : rowIndex < 4
            ? "PREMIUM"
            : "RECLINER";

      seats.push({
        seatId: `${rows[rowIndex]}${seatNumber}`,
        row: rows[rowIndex],
        number: seatNumber,

        // Central walking aisle between seats 6 and 7.
        column:
          seatNumber <= 6
            ? seatNumber
            : seatNumber + 1,

        type: seatType,
        isActive: true,
      });
    }
  }

  return seats;
}

// =====================================================
// MOVIE DURATION
// =====================================================

function durationMinutes(movie) {
  const value = String(movie.duration || "").toLowerCase();

  const hours = value.match(/(\d+)\s*(?:h|hour)/);
  const minutes = value.match(/(\d+)\s*(?:m|min)/);

  if (hours) {
    return (
      Number(hours[1]) * 60 +
      Number(minutes?.[1] || 0)
    );
  }

  const colon = value.match(/^(\d+):(\d{1,2})$/);

  if (colon) {
    return (
      Number(colon[1]) * 60 +
      Number(colon[2])
    );
  }

  const numeric = parseInt(value, 10);

  return Number.isFinite(numeric) &&
    numeric >= 45 &&
    numeric <= 300
    ? numeric
    : 150;
}

// =====================================================
// INDIAN LOCAL SHOWTIME
// =====================================================

function indiaDate(daysAhead, hour, minute) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [
        part.type,
        part.value,
      ])
  );

  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day) + daysAhead,
      hour - 5,
      minute - 30
    )
  );
}

// =====================================================
// CREATE CINEMA IF MISSING
// =====================================================

async function getOrCreateTheatre(info) {
  const existing = await Theatre.findOne({
    $or: [
      { slug: info.slug },
      {
        name: info.name,
        city: info.city,
      },
    ],
  });

  if (existing) {
    return existing;
  }

  const image = `/images/cinemas/${info.image}`;

  return Theatre.create({
    name: info.name,
    slug: info.slug,
    city: info.city,

    address: {
      street: info.street,
      area: info.area,
      city: info.city,
      state: info.state,
      country: "India",
    },

    coverImage: image,

    gallery: [
      {
        url: image,
        alt: "Illustrative cinema interior",
      },
    ],

    description:
      "A BookMySeat cinema destination with curated film programming.",

    amenities: [],
    isActive: true,
  });
}

// =====================================================
// CREATE AUDITORIUM IF MISSING
// =====================================================

async function getOrCreateScreen(theatre, number) {
  const existing = await Screen.findOne({
    theatre: theatre._id,
    screenNumber: number,
  });

  if (existing) {
    return existing;
  }

  return Screen.create({
    theatre: theatre._id,

    name: `Auditorium ${String(number).padStart(2, "0")}`,
    screenNumber: number,

    format: "STANDARD",

    audio:
      number === 2
        ? "DOLBY_7_1"
        : "STANDARD",

    seats: buildSeats(),
    isActive: true,
  });
}

// =====================================================
// CREATE FUTURE SCREENINGS
// =====================================================

async function addScreenings(theatre, screens, movie, position) {
  // Preserve existing future shows for this cinema/movie.
  const existing = await Show.exists({
    theatre: theatre._id,
    movie: movie._id,
    status: "SCHEDULED",
    isActive: { $ne: false },
    startTime: { $gt: new Date() },
  });

  if (existing) {
    return 0;
  }

  const screen = screens[position % screens.length];

  if (
    !screen ||
    !screen.isActive ||
    !screen.seats?.length
  ) {
    console.log(
      `Skipped ${movie.title}: no active screen with seats.`
    );
    return 0;
  }

  const slots = [
    [12, 15],
    [15, 30],
    [18, 0],
    [20, 0],
    [14, 0],
  ];

  const [hour, minute] = slots[position];

  const minutes = durationMinutes(movie);

  const pricing = [
    {
      seatType: "REGULAR",
      price: 260,
    },
    {
      seatType: "PREMIUM",
      price: 360,
    },
    {
      seatType: "RECLINER",
      price: 520,
    },
  ];

  let created = 0;

  // Two screenings per film on different dates.
  for (const daysAhead of [
    1 + position,
    8 + position,
  ]) {
    const startTime = indiaDate(
      daysAhead,
      hour,
      minute
    );

    const endTime = new Date(
      startTime.getTime() +
      (minutes + 20) * 60000
    );

    // Never overlap screenings on the same screen.
    const collision = await Show.exists({
      screen: screen._id,

      isActive: { $ne: false },
      status: { $ne: "CANCELLED" },

      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    });

    if (collision) {
      console.log(
        `Skipped occupied slot: ${movie.title}, ${startTime.toISOString()}`
      );
      continue;
    }

    await Show.create({
      movie: movie._id,
      theatre: theatre._id,
      screen: screen._id,

      startTime,
      endTime,

      language: movie.language || "Original",
      format: screen.format,

      pricing,
      price: 260,

      status: "SCHEDULED",
      isActive: true,
    });

    created++;
  }

  return created;
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.MONGODB_URL;

  if (!uri) {
    throw new Error(
      "MongoDB connection URL not found."
    );
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    const movies = await Movie.find({}).lean();

    const byTitle = new Map(
      movies.map((movie) => [
        normalize(movie.title),
        movie,
      ])
    );

    const missing = NEW_MOVIES.filter(
      (movie) => !byTitle.has(normalize(movie.title))
    );

    console.log(
      `\nBookMySeat — ${APPLY ? "APPLY" : "PREVIEW ONLY"}`
    );

    console.log(
      `Current movies: ${movies.length}`
    );

    console.log(
      `New movie records needed: ${missing.length}`
    );

    console.log(
      `Movies after addition: ${movies.length + missing.length}`
    );

    console.log(
      `Selected cinema locations: ${CINEMAS.length}\n`
    );

    // Show the distribution before making changes.
    for (const location of CINEMAS) {
      const existing = await Theatre.findOne({
        $or: [
          { slug: location.slug },
          {
            name: location.name,
            city: location.city,
          },
        ],
      }).lean();

      console.log(
        `${location.name} — ${
          existing ? "already exists" : "new cinema"
        }`
      );

      location.movies.forEach((title, index) => {
        console.log(
          `  ${index + 1}. ${title}`
        );
      });
    }

    // Verify all planned titles exist or can be created.
    const unavailable = CINEMAS
      .flatMap((cinema) => cinema.movies)
      .filter(
        (title) =>
          !byTitle.has(normalize(title)) &&
          !NEW_MOVIES.some(
            (movie) =>
              normalize(movie.title) === normalize(title)
          )
      );

    if (unavailable.length) {
      throw new Error(
        `Unknown movie titles: ${
          [...new Set(unavailable)].join(", ")
        }`
      );
    }

    // ===============================================
    // PREVIEW MODE — NO DATABASE CHANGES
    // ===============================================

    if (!APPLY) {
      console.log(
        "\nNo records changed."
      );

      console.log(
        "Review the allocation above before running with --apply."
      );

      return;
    }

    // ===============================================
    // CREATE ONLY MISSING MOVIES
    // ===============================================

    let newMovies = 0;
    let newShows = 0;

    for (const movie of missing) {
      const poster =
        `/trailers/optimized/${movie.key}.jpg`;

      const created = await Movie.create({
        title: movie.title,
        description: movie.description,
        genre: movie.genre,
        duration: `${movie.duration} min`,

        language: "English",
        rating: "",

        poster,
        banner: poster,

        trailer:
          `/trailers/optimized/${movie.key}.mp4`,

        releaseYear: movie.year,
        listingStatus: "ACTIVE",
      });

      byTitle.set(
        normalize(movie.title),
        created
      );

      newMovies++;

      console.log(
        `Added movie: ${movie.title}`
      );
    }

    // ===============================================
    // CREATE CINEMAS, SCREENS AND SHOWS
    // ===============================================

    for (const location of CINEMAS) {
      const theatre = await getOrCreateTheatre(
        location
      );

      if (!theatre.isActive) {
        console.log(
          `Inactive cinema skipped: ${theatre.name}`
        );
        continue;
      }

      const screens = [
        await getOrCreateScreen(theatre, 1),
        await getOrCreateScreen(theatre, 2),
      ];

      for (
        const [position, title]
        of location.movies.entries()
      ) {
        const movie = byTitle.get(normalize(title));

        if (
          !movie ||
          movie.listingStatus === "HIDDEN" ||
          movie.listingStatus === "COMING_SOON"
        ) {
          console.log(
            `Not scheduled: ${title}`
          );
          continue;
        }

        newShows += await addScreenings(
          theatre,
          screens,
          movie,
          position
        );
      }

      console.log(
        `Programmed cinema: ${theatre.name}`
      );
    }

    // ===============================================
    // SUMMARY
    // ===============================================

    console.log(
      `\nComplete. Added ${newMovies} movies and ${newShows} showtimes.`
    );

    console.log(
      "Existing movies, bookings, shows, screens and theatre IDs were preserved."
    );
  } finally {
    await mongoose.disconnect();
  }
}

// =====================================================
// EXECUTION
// =====================================================

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
