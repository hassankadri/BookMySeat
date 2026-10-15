
"use strict";

// =====================================================
// BOOKMYSEAT — CINEMA INVENTORY & DISTRIBUTION
// =====================================================
//
// READ-ONLY SCRIPT
//
// 1. Counts all movies in MongoDB.
// 2. Prints every movie title.
// 3. Checks which of the 11 trailer movies exist.
// 4. Distributes eligible movies across five cinemas.
// 5. Checks existing theatres and future showtimes.
//
// IMPORTANT:
// This script does NOT modify MongoDB.
// No existing shows, bookings, or payments are changed.
// =====================================================

require("dotenv").config();

const mongoose = require("mongoose");

const Movie = require("./models/Movie");
const Theatre = require("./models/Theatre");
const Show = require("./models/Show");

// =====================================================
// FIVE SELECTED CINEMAS
// =====================================================

const DESTINATIONS = [
  {
    name: "Grand Galleria Mall",
    city: "Mumbai",
    area: "Lower Parel",
    terms: ["grand galleria", "lower parel"],
    tastes: ["drama", "thriller", "mystery"],
  },
  {
    name: "Phoenix Marketcity",
    city: "Mumbai",
    area: "Kurla West",
    terms: ["phoenix marketcity", "kurla"],
    tastes: [
      "action",
      "adventure",
      "sci-fi",
      "science fiction",
    ],
  },
  {
    name: "Inorbit Mall",
    city: "Mumbai",
    area: "Malad West",
    terms: ["inorbit", "malad"],
    tastes: [
      "family",
      "comedy",
      "animation",
      "romance",
    ],
  },
  {
    name: "R City Mall",
    city: "Mumbai",
    area: "Ghatkopar West",
    terms: ["r city", "ghatkopar"],
    tastes: ["action", "horror", "thriller"],
  },
  {
    name: "Viviana Mall",
    city: "Thane",
    area: "Thane",
    terms: ["viviana", "thane"],
    tastes: [
      "adventure",
      "family",
      "fantasy",
      "drama",
    ],
  },
];

// =====================================================
// ELEVEN HOMEPAGE TRAILER MOVIES
// =====================================================

const TRAILER_TITLES = [
  "Godzilla vs. Kong",
  "The Odyssey",
  "Spider-Man: Brand New Day",
  "Fast & Furious 9",
  "Eternals",
  "Star Wars: Episode IX",
  "Captain Marvel",
  "Spider-Man: No Way Home",
  "Mortal Kombat",
  "Avatar: Fire and Ash",
  "Cruella",
];

// =====================================================
// HELPERS
// =====================================================

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const idOf = (value) =>
  String(value?._id || value || "");

const movieGenres = (movie) => {
  const values =
    movie.genre ||
    movie.genres ||
    [];

  return (
    Array.isArray(values)
      ? values
      : [values]
  )
    .map((value) =>
      normalize(
        typeof value === "object" && value !== null
          ? value.name
          : value
      )
    )
    .filter(Boolean);
};

const isEligible = (movie) => {
  if (movie.isActive === false) {
    return false;
  }

  const status = String(
    movie.listingStatus ||
    movie.status ||
    "ACTIVE"
  ).toUpperCase();

  return ![
    "HIDDEN",
    "COMING_SOON",
    "INACTIVE",
    "ARCHIVED",
    "DELETED",
  ].includes(status);
};

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log(
    "\nStarting BookMySeat cinema inventory...\n"
  );

  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.MONGODB_URL;

  if (!uri) {
    throw new Error(
      "MongoDB connection URL is missing. No changes made."
    );
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log("MongoDB connected successfully.");

  // ===============================================
  // FETCH DATABASE RECORDS
  // ===============================================

  const [movies, theatres, shows] =
    await Promise.all([
      Movie.find({})
        .select(
          "_id title genre genres listingStatus status isActive"
        )
        .lean(),

      Theatre.find({
        isActive: { $ne: false },
      })
        .select(
          "_id name city address slug"
        )
        .lean(),

      Show.find({
        startTime: {
          $gte: new Date(),
        },
        isActive: {
          $ne: false,
        },
      })
        .select(
          "movie theatre startTime status"
        )
        .lean(),
    ]);

  // ===============================================
  // CLASSIFY MOVIES
  // ===============================================

  const eligible = movies
    .filter(isEligible)
    .sort((a, b) =>
      String(a.title || "").localeCompare(
        String(b.title || "")
      )
    );

  const existingShows = shows.filter(
    (show) =>
      ![
        "CANCELLED",
        "EXPIRED",
        "COMPLETED",
      ].includes(
        String(show.status || "").toUpperCase()
      )
  );

  // ===============================================
  // PRINT INVENTORY
  // ===============================================

  console.log(
    "\n========== MOVIE INVENTORY ==========\n"
  );

  console.log(
    `Total movies in MongoDB: ${movies.length}`
  );

  console.log(
    `Eligible movies: ${eligible.length}`
  );

  console.log(
    `Other movies: ${
      movies.length - eligible.length
    }`
  );

  console.log(
    `Active theatre records: ${theatres.length}`
  );

  console.log(
    `Future show records: ${existingShows.length}`
  );

  // ===============================================
  // PRINT ALL MOVIE TITLES
  // ===============================================

  console.log(
    "\n========== ALL MOVIES ==========\n"
  );

  movies
    .sort((a, b) =>
      String(a.title || "").localeCompare(
        String(b.title || "")
      )
    )
    .forEach((movie, index) => {
      const status =
        movie.listingStatus ||
        movie.status ||
        (movie.isActive === false
          ? "INACTIVE"
          : "unspecified");

      console.log(
        `${String(index + 1).padStart(2, "0")}. ${
          movie.title
        } [${status}]`
      );
    });

  // ===============================================
  // CHECK TRAILER MOVIES
  // ===============================================

  console.log(
    "\n========== TRAILER MOVIE CHECK ==========\n"
  );

  const missingTrailers =
    TRAILER_TITLES.filter(
      (title) =>
        !movies.some(
          (movie) =>
            normalize(movie.title) ===
            normalize(title)
        )
    );

  console.log(
    `Homepage trailers: ${TRAILER_TITLES.length}`
  );

  console.log(
    `Matching movie records: ${
      TRAILER_TITLES.length -
      missingTrailers.length
    }`
  );

  if (missingTrailers.length === 0) {
    console.log(
      "All trailer movies exist in MongoDB."
    );
  } else {
    console.log(
      "\nTrailer titles without matching movie records:"
    );

    missingTrailers.forEach((title) =>
      console.log(` - ${title}`)
    );
  }

  // ===============================================
  // CREATE FIVE DISTRIBUTION BUCKETS
  // ===============================================

  const buckets = DESTINATIONS.map(
    (destination) => ({
      ...destination,
      movies: [],
      genreCounts: new Map(),
    })
  );

  const assignedIds = new Set();

  // Distribute all eligible movies at least once.
  // Prefer matching genres and balanced film counts.

  for (const movie of eligible) {
    const genres = movieGenres(movie);

    const choices = buckets.map(
      (bucket, index) => {
        const affinity =
          genres.filter((genre) =>
            bucket.tastes.some((taste) =>
              genre.includes(taste)
            )
          ).length;

        const repeatedGenres =
          genres.reduce(
            (count, genre) =>
              count +
              (bucket.genreCounts.get(genre) || 0),
            0
          );

        const score =
          bucket.movies.length * 10 +
          repeatedGenres * 2 -
          affinity * 3;

        return {
          bucket,
          index,
          score,
        };
      }
    );

    choices.sort(
      (a, b) =>
        a.score - b.score ||
        a.index - b.index
    );

    const selectedBucket =
      choices[0].bucket;

    selectedBucket.movies.push(movie);

    assignedIds.add(idOf(movie._id));

    genres.forEach((genre) => {
      selectedBucket.genreCounts.set(
        genre,
        (selectedBucket.genreCounts.get(genre) || 0) + 1
      );
    });
  }

  // ===============================================
  // ENSURE VARIETY
  // ===============================================

  // If enough movies exist, give each cinema
  // at least three films.
  // Selected movies may appear at multiple cinemas.

  if (eligible.length >= 3) {
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];

      let cursor = i;

      while (bucket.movies.length < 3) {
        const movie =
          eligible[cursor % eligible.length];

        const alreadyPresent =
          bucket.movies.some(
            (existing) =>
              idOf(existing._id) ===
              idOf(movie._id)
          );

        if (!alreadyPresent) {
          bucket.movies.push(movie);
        }

        cursor++;
      }
    }
  }

  // ===============================================
  // PRINT FIVE-CINEMA DISTRIBUTION
  // ===============================================

  console.log(
    "\n========== CINEMA DISTRIBUTION =========="
  );

  for (const bucket of buckets) {
    const theatre = theatres.find(
      (item) => {
        const combined = normalize(
          `${item.name || ""} ${
            item.address?.area || ""
          } ${
            item.address?.street || ""
          }`
        );

        return (
          normalize(item.city) ===
            normalize(bucket.city) &&
          bucket.terms.some((term) =>
            combined.includes(
              normalize(term)
            )
          )
        );
      }
    );

    const showCount = theatre
      ? existingShows.filter(
          (show) =>
            idOf(show.theatre) ===
            idOf(theatre._id)
        ).length
      : 0;

    console.log(
      `\n----------------------------------------`
    );

    console.log(
      `${bucket.name}`
    );

    console.log(
      `${bucket.area}, ${bucket.city}`
    );

    console.log(
      `----------------------------------------`
    );

    console.log(
      `Theatre record: ${
        theatre
          ? `${theatre.name} (${theatre._id})`
          : "NOT FOUND"
      }`
    );

    console.log(
      `Future shows: ${showCount}`
    );

    console.log(
      `Assigned movies: ${bucket.movies.length}`
    );

    bucket.movies.forEach(
      (movie, index) => {
        console.log(
          `  ${String(index + 1).padStart(2, "0")}. ${
            movie.title
          }`
        );
      }
    );
  }

  // ===============================================
  // SUMMARY
  // ===============================================

  console.log(
    "\n========== SUMMARY ==========\n"
  );

  console.log(
    `Total database movies: ${movies.length}`
  );

  console.log(
    `Eligible movies: ${eligible.length}`
  );

  console.log(
    `Movies assigned at least once: ${assignedIds.size}`
  );

  console.log(
    `Trailer titles missing from DB: ${missingTrailers.length}`
  );

  console.log(
    `Selected cinema locations: ${DESTINATIONS.length}`
  );

  console.log(
    "\nREAD-ONLY PREVIEW COMPLETE."
  );

  console.log(
    "No movies, theatres, screens, shows, bookings, or payments were modified.\n"
  );
}

// =====================================================
// EXECUTION
// =====================================================

main()
  .catch((error) => {
    console.error(
      "Cinema inventory failed:",
      error.message
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
