"use strict";

/**
 * Restore BookMySeat's original cinema-wise movie programme.
 *
 * - Creates one new future show for each existing cinema/movie assignment.
 * - Reuses the earliest existing show as the template for screen, language,
 *   format, pricing and timing.
 * - Does NOT modify or delete historical shows, movies, theatres or bookings.
 * - Safe to re-run: an existing show for that cinema/movie on the target date
 *   is skipped, and screen overlaps are checked before insert.
 *
 * Default mode is DRY RUN. Add --apply to insert the new show documents.
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const envCandidates = [
  path.resolve(__dirname, "../.env"),
  path.resolve(process.cwd(), ".env"),
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));

require("dotenv").config(
  envPath ? { path: envPath } : undefined
);

const Show = require("../models/Show");
const Movie = require("../models/Movie");
const Theatre = require("../models/Theatre");
const Screen = require("../models/Screen");

const APPLY = process.argv.includes("--apply");

// Next complete Wednesday-Sunday cycle after October 30, 2026.
const BASE_DATES = [
  "2026-11-04",
  "2026-11-05",
  "2026-11-06",
  "2026-11-07",
  "2026-11-08",
];

const CINEMA_PROGRAMME = [
  {
    theatre: "Grand Galleria Mall",
    movies: [
      "Drishyam: The Conclusion",
      "Verity",
      "The Odyssey",
      "Eternals",
      "The Saga of Rashtriya Rifles",
    ],
  },
  {
    theatre: "Phoenix Marketcity",
    movies: [
      "Godzilla vs. Kong",
      "Avatar: Fire and Ash",
      "Project Hail Mary",
      "Fast & Furious 9",
      "Captain Marvel",
    ],
  },
  {
    theatre: "Inorbit Mall",
    movies: [
      "Toy Story 5",
      "Cruella",
      "Spider-Man: Brand New Day",
      "Mr Bhaarath",
      "Baththa",
      "Fast & Furious 9",
    ],
  },
  {
    theatre: "R City Mall",
    movies: [
      "Mortal Kombat",
      "Digger",
      "Lucky Strike",
      "Spider-Man: No Way Home",
      "Star Wars: Episode IX",
    ],
  },
  {
    theatre: "Viviana Mall",
    movies: [
      "Dhasal",
      "Toy Story 5",
      "Spider-Man: No Way Home",
      "Godzilla vs. Kong",
      "The Odyssey",
    ],
  },
];

function makeTargetStart(templateStart, targetDate) {
  const source = new Date(templateStart);

  if (Number.isNaN(source.getTime())) {
    throw new Error(`Invalid template start time: ${templateStart}`);
  }

  const [year, month, day] = targetDate.split("-").map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      source.getUTCHours(),
      source.getUTCMinutes(),
      source.getUTCSeconds(),
      source.getUTCMilliseconds()
    )
  );
}

function parseMovieDuration(value) {
  if (typeof value !== "string") return null;

  const hours = Number(value.match(/(\d+)\s*h/i)?.[1] || 0);
  const minutes = Number(value.match(/(\d+)\s*m/i)?.[1] || 0);

  const milliseconds =
    (hours * 60 + minutes) * 60 * 1000;

  return milliseconds > 0 ? milliseconds : null;
}

function shiftedBookingWindow(value, oldStart, newStart) {
  if (!value) return null;

  const oldValue = new Date(value);

  if (Number.isNaN(oldValue.getTime())) {
    return null;
  }

  return new Date(
    newStart.getTime() + oldValue.getTime() - oldStart.getTime()
  );
}

async function main() {
  if (!process.env.MONGO_URL || !process.env.DB_NAME) {
    throw new Error(
      "MONGO_URL or DB_NAME is missing. Make sure backend/.env exists and contains both values."
    );
  }

  await mongoose.connect(process.env.MONGO_URL, {
    dbName: process.env.DB_NAME,
  });

  console.log(
    `Connected to MongoDB database: ${process.env.DB_NAME}`
  );

  console.log(
    APPLY
      ? "MODE: APPLY (will insert new shows)"
      : "MODE: DRY RUN (no database changes)"
  );

  console.log(
    "Target dates: Nov 4-8, 2026; Inorbit extra Fast & Furious 9: Nov 9, 2026\n"
  );

  const plan = [];
  const missing = [];

  for (const cinema of CINEMA_PROGRAMME) {
    const theatre = await Theatre.findOne({
      name: cinema.theatre,
      isActive: true,
    }).lean();

    if (!theatre) {
      missing.push(
        `Active theatre not found: ${cinema.theatre}`
      );
      continue;
    }

    for (
      let index = 0;
      index < cinema.movies.length;
      index += 1
    ) {
      const movieTitle = cinema.movies[index];

      const movie = await Movie.findOne({
        title: movieTitle,
        listingStatus: "ACTIVE",
      }).lean();

      if (!movie) {
        missing.push(
          `Active movie not found: ${movieTitle} (${cinema.theatre})`
        );
        continue;
      }

      const template = await Show.findOne({
        theatre: theatre._id,
        movie: movie._id,
        status: "SCHEDULED",
        isActive: true,
      })
        .sort({ startTime: 1 })
        .lean();

      if (!template) {
        missing.push(
          `No existing scheduled-show template: ${movieTitle} (${cinema.theatre})`
        );
        continue;
      }

      const targetDate =
        cinema.theatre === "Inorbit Mall" &&
        movieTitle === "Fast & Furious 9"
          ? "2026-11-09"
          : BASE_DATES[index];

      const startTime = makeTargetStart(
        template.startTime,
        targetDate
      );

      const oldStart = new Date(template.startTime);

      const oldDuration =
        new Date(template.endTime).getTime() -
        oldStart.getTime();

      const movieDuration = parseMovieDuration(
        movie.duration
      );

      // Avoid accidentally copying the seven-hour duration
      // from the existing Inorbit Fast & Furious 9 record.
      const durationMs =
        oldDuration > 4 * 60 * 60 * 1000 && movieDuration
          ? movieDuration
          : oldDuration;

      if (
        !Number.isFinite(durationMs) ||
        durationMs <= 0
      ) {
        missing.push(
          `Invalid show duration: ${movieTitle} (${cinema.theatre})`
        );
        continue;
      }

      if (
        !template.screen ||
        !Array.isArray(template.pricing) ||
        template.pricing.length === 0
      ) {
        missing.push(
          `Template missing screen or pricing: ${movieTitle} (${cinema.theatre})`
        );
        continue;
      }

      const screen = await Screen.findOne({
        _id: template.screen,
        theatre: theatre._id,
        isActive: true,
      }).lean();

      if (!screen) {
        missing.push(
          `Template screen missing/inactive: ${movieTitle} (${cinema.theatre})`
        );
        continue;
      }

      plan.push({
        theatre,
        movie,
        template,
        screen,
        targetDate,
        startTime,
        endTime: new Date(
          startTime.getTime() + durationMs
        ),
      });
    }
  }

  if (missing.length) {
    console.error(
      "\nCannot safely restore the complete programme:"
    );

    missing.forEach((item) => {
      console.error(` - ${item}`);
    });

    throw new Error(
      "Preflight failed. No shows were inserted."
    );
  }

  console.log(`Prepared ${plan.length} show(s):`);

  plan.forEach((item) => {
    console.log(
      ` - ${item.theatre.name} | ${item.movie.title} | ${item.startTime.toISOString()} | ${item.screen.name}`
    );
  });

  if (plan.length !== 26) {
    throw new Error(
      `Expected 26 show records, but prepared ${plan.length}. No shows were inserted.`
    );
  }

  if (!APPLY) {
    console.log(
      "\nDry run complete. No database records were changed."
    );

    console.log(
      "Run with --apply to create the 26 new show records."
    );

    return;
  }

  // Check target dates and screen overlaps before writing.
  const pending = [];
  let skipped = 0;

  for (const item of plan) {
    const dayStart = new Date(
      `${item.targetDate}T00:00:00.000Z`
    );

    const dayEnd = new Date(
      `${item.targetDate}T23:59:59.999Z`
    );

    const sameMovieSameDay = await Show.findOne({
      theatre: item.theatre._id,
      movie: item.movie._id,
      status: "SCHEDULED",
      isActive: true,
      startTime: {
        $gte: dayStart,
        $lte: dayEnd,
      },
    }).lean();

    if (sameMovieSameDay) {
      console.log(
        `SKIP (already scheduled): ${item.theatre.name} | ${item.movie.title} | ${item.targetDate}`
      );

      skipped += 1;
      continue;
    }

    const overlap = await Show.findOne({
      screen: item.screen._id,
      status: { $ne: "CANCELLED" },
      isActive: { $ne: false },
      startTime: { $lt: item.endTime },
      endTime: { $gt: item.startTime },
    }).lean();

    if (overlap) {
      throw new Error(
        `Screen overlap detected. No new shows were inserted: ${item.theatre.name} | ${item.movie.title} | ${item.startTime.toISOString()} (conflicts with show ${overlap._id}).`
      );
    }

    pending.push(item);
  }

  // Check that the proposed shows do not overlap one another.
  for (let i = 0; i < pending.length; i += 1) {
    for (let j = i + 1; j < pending.length; j += 1) {
      const first = pending[i];
      const second = pending[j];

      if (
        String(first.screen._id) ===
          String(second.screen._id) &&
        first.startTime < second.endTime &&
        first.endTime > second.startTime
      ) {
        throw new Error(
          `Proposed shows overlap on ${first.screen.name}. No new shows were inserted.`
        );
      }
    }
  }

  if (pending.length === 0) {
    console.log(
      "\nAll target shows already exist. Nothing to insert."
    );

    return;
  }

  // Back up existing show records before inserting anything.
  const theatreIds = [
    ...new Set(
      plan.map((item) => String(item.theatre._id))
    ),
  ];

  const existingShows = await Show.find({
    theatre: { $in: theatreIds },
  }).lean();

  const backupDir = path.resolve(
    __dirname,
    "../backups"
  );

  fs.mkdirSync(backupDir, {
    recursive: true,
  });

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const backupPath = path.join(
    backupDir,
    `shows-before-restoration-${timestamp}.json`
  );

  fs.writeFileSync(
    backupPath,
    JSON.stringify(existingShows, null, 2),
    "utf8"
  );

  console.log(`\nBackup created: ${backupPath}`);

  console.log(
    `Existing show records backed up: ${existingShows.length}`
  );

  let created = 0;

  for (const item of pending) {
    const oldStart = new Date(
      item.template.startTime
    );

    const show = new Show({
      movie: item.movie._id,
      theatre: item.theatre._id,
      screen: item.screen._id,
      startTime: item.startTime,
      endTime: item.endTime,

      language:
        item.template.language ||
        item.movie.language ||
        "Original",

      format:
        item.template.format ||
        "STANDARD",

      pricing: item.template.pricing.map((price) => ({
        seatType: price.seatType,
        price: price.price,
      })),

      price: item.template.price,

      bookedSeats: [],

      bookingOpensAt: shiftedBookingWindow(
        item.template.bookingOpensAt,
        oldStart,
        item.startTime
      ),

      bookingClosesAt: shiftedBookingWindow(
        item.template.bookingClosesAt,
        oldStart,
        item.startTime
      ),

      status: "SCHEDULED",
      isActive: true,

      createdBy:
        item.template.createdBy || null,
    });

    await show.save();

    created += 1;

    console.log(
      `CREATED: ${item.theatre.name} | ${item.movie.title} | ${item.startTime.toISOString()}`
    );
  }

  console.log("\nRestoration complete.");

  console.log(`New shows created: ${created}`);

  console.log(
    `Already-existing shows skipped: ${skipped}`
  );

  console.log(
    "Historical shows, movies, theatres and bookings were not modified or deleted."
  );
}

main()
  .catch((error) => {
    console.error(
      "\nRESTORATION FAILED:",
      error.message
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });