"use strict";

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const envCandidates = [
  path.resolve(__dirname, "../.env"),
  path.resolve(process.cwd(), ".env"),
];

const envPath = envCandidates.find(fs.existsSync);

require("dotenv").config(
  envPath ? { path: envPath } : undefined
);

const Show = require("../models/Show");
const Movie = require("../models/Movie");
const Theatre = require("../models/Theatre");
const Booking = require("../models/Booking");
const BookedSeat = require("../models/BookedSeat");

const APPLY = process.argv.includes("--apply");

const PROGRAMME_THEATRES = [
  "Grand Galleria Mall",
  "Phoenix Marketcity",
  "Inorbit Mall",
  "R City Mall",
  "Viviana Mall",
];

const CHANGES = [
  {
    theatre: "Inorbit Mall",
    date: "2026-11-09",
    from: "Fast & Furious 9",
    to: "Anaconda",
  },
  {
    theatre: "Viviana Mall",
    date: "2026-11-05",
    from: "Toy Story 5",
    to: "Border 2",
  },
  {
    theatre: "Viviana Mall",
    date: "2026-11-06",
    from: "Spider-Man: No Way Home",
    to: "Dhurandhar",
  },
  {
    theatre: "Viviana Mall",
    date: "2026-11-07",
    from: "Godzilla vs. Kong",
    to: "Godzilla x Kong",
  },
  {
    theatre: "Viviana Mall",
    date: "2026-11-08",
    from: "The Odyssey",
    to: "Mardaani 3",
  },
];

function getDayRange(date) {
  return {
    start: new Date(`${date}T00:00:00.000Z`),
    end: new Date(`${date}T23:59:59.999Z`),
  };
}

function parseDurationMinutes(value) {
  if (typeof value === "number" && value > 0) {
    return value;
  }

  const text = String(value || "").toLowerCase().trim();

  if (!text) {
    throw new Error("Movie duration is missing.");
  }

  const hoursMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/
  );

  const minutesMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/
  );

  if (hoursMatch || minutesMatch) {
    const hours = hoursMatch
      ? Number(hoursMatch[1])
      : 0;

    const minutes = minutesMatch
      ? Number(minutesMatch[1])
      : 0;

    const total = hours * 60 + minutes;

    if (total > 0 && total <= 600) {
      return total;
    }
  }

  // Support duration stored as a plain numeric string in minutes.
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const total = Number(text);

    if (total > 0 && total <= 600) {
      return total;
    }
  }

  throw new Error(
    `Unsupported movie duration format: "${value}"`
  );
}

async function main() {
  if (!process.env.MONGO_URL || !process.env.DB_NAME) {
    throw new Error(
      "MONGO_URL or DB_NAME missing from backend/.env"
    );
  }

  await mongoose.connect(process.env.MONGO_URL, {
    dbName: process.env.DB_NAME,
  });

  console.log("Connected to MongoDB:", process.env.DB_NAME);
  console.log(APPLY ? "MODE: APPLY" : "MODE: DRY RUN");

  const changes = [];
  const theatreCache = new Map();

  // STEP 1: Validate the five replacements.
  for (const item of CHANGES) {
    let theatre = theatreCache.get(item.theatre);

    if (!theatre) {
      theatre = await Theatre.findOne({
        name: item.theatre,
        isActive: true,
      }).lean();

      if (!theatre) {
        throw new Error(
          `Active theatre not found: ${item.theatre}`
        );
      }

      theatreCache.set(item.theatre, theatre);
    }

    const oldMovie = await Movie.findOne({
      title: item.from,
      listingStatus: "ACTIVE",
    }).lean();

    const newMovie = await Movie.findOne({
      title: item.to,
      listingStatus: "ACTIVE",
    }).lean();

    if (!oldMovie) {
      throw new Error(`Movie not found: ${item.from}`);
    }

    if (!newMovie) {
      throw new Error(
        `Replacement movie missing or not ACTIVE: ${item.to}`
      );
    }

    const durationMinutes = parseDurationMinutes(
      newMovie.duration
    );

    const { start, end } = getDayRange(item.date);

    const matchingShows = await Show.find({
      theatre: theatre._id,
      movie: oldMovie._id,
      status: "SCHEDULED",
      isActive: true,
      startTime: {
        $gte: start,
        $lte: end,
      },
    }).lean();

    if (matchingShows.length !== 1) {
      throw new Error(
        `Expected exactly one show for ${item.theatre} | ${item.from} | ${item.date}; found ${matchingShows.length}.`
      );
    }

    const show = matchingShows[0];

    const bookingCount = await Booking.countDocuments({
      show: show._id,
    });

    const bookedSeatCount = await BookedSeat.countDocuments({
      show: show._id,
    });

    if (
      bookingCount > 0 ||
      bookedSeatCount > 0 ||
      (show.bookedSeats || []).length > 0
    ) {
      throw new Error(
        `Booking history or booked seats exist for ${item.theatre} | ${item.from}. No changes made.`
      );
    }

    const newEndTime = new Date(
      new Date(show.startTime).getTime() +
      durationMinutes * 60 * 1000
    );

    changes.push({
      ...item,
      theatreId: theatre._id,
      showId: show._id,
      screenId: show.screen,
      oldMovieId: oldMovie._id,
      newMovieId: newMovie._id,
      startTime: new Date(show.startTime),
      oldEndTime: new Date(show.endTime),
      newEndTime,
      durationMinutes,
      originalShow: show,
    });
  }

  // STEP 2: Load all five cinemas.
  const programmeTheatres = await Theatre.find({
    name: { $in: PROGRAMME_THEATRES },
    isActive: true,
  })
    .select("_id name")
    .lean();

  if (programmeTheatres.length !== 5) {
    throw new Error(
      `Expected 5 active cinemas, found ${programmeTheatres.length}.`
    );
  }

  // STEP 3: Load all 26 future shows.
  const theatreIds = programmeTheatres.map(
    (theatre) => theatre._id
  );

  const allShows = await Show.find({
    theatre: { $in: theatreIds },
    status: "SCHEDULED",
    isActive: true,
    startTime: {
      $gte: new Date("2026-11-04T00:00:00.000Z"),
      $lt: new Date("2026-11-10T00:00:00.000Z"),
    },
  })
    .populate("movie", "title")
    .lean();

  if (allShows.length !== 26) {
    throw new Error(
      `Expected 26 shows across five cinemas, found ${allShows.length}. No changes made.`
    );
  }

  // STEP 4: Validate that all final movie titles are unique.
  const replacements = new Map(
    changes.map((item) => [
      String(item.showId),
      item.to,
    ])
  );

  const finalTitles = allShows.map((show) => {
    return (
      replacements.get(String(show._id)) ||
      show.movie?.title
    );
  });

  if (finalTitles.some((title) => !title)) {
    throw new Error("A show has a missing movie reference.");
  }

  const uniqueTitles = new Set(
    finalTitles.map((title) => title.toLowerCase().trim())
  );

  if (uniqueTitles.size !== 26) {
    throw new Error(
      `Duplicate titles remain: ${uniqueTitles.size} unique titles across 26 shows.`
    );
  }

  // STEP 5: Check that the new show durations do not overlap
  // with another show on the same screen.
  for (const item of changes) {
    const conflict = await Show.findOne({
      _id: { $ne: item.showId },
      screen: item.screenId,
      status: { $ne: "CANCELLED" },
      isActive: true,
      startTime: { $lt: item.newEndTime },
      endTime: { $gt: item.startTime },
    }).lean();

    if (conflict) {
      throw new Error(
        `Screen-time conflict for ${item.theatre} | ${item.to}. No changes made.`
      );
    }
  }

  // STEP 6: Print the complete plan.
  console.log("\nPlanned replacements:");

  for (const item of changes) {
    console.log(
      `- ${item.theatre}: ${item.from} -> ${item.to} (${item.durationMinutes} minutes)`
    );

    console.log(
      `  New end time: ${item.newEndTime.toISOString()}`
    );
  }

  console.log("\nFinal validation:");
  console.log("Active cinemas:", programmeTheatres.length);
  console.log("Total shows:", allShows.length);
  console.log("Unique movie titles:", uniqueTitles.size);
  console.log("Booking checks: passed");
  console.log("Screen conflict checks: passed");

  if (!APPLY) {
    console.log("\nDRY RUN PASSED.");
    console.log("Database unchanged.");
    console.log(
      "Run with --apply to apply the five replacements."
    );

    return;
  }

  // STEP 7: Back up the complete original show documents.
  const backupDir = path.resolve(
    __dirname,
    "../backups"
  );

  fs.mkdirSync(backupDir, { recursive: true });

  const backupName =
    `duplicate-movie-reassignment-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;

  const backupPath = path.join(
    backupDir,
    backupName
  );

  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      changes.map((item) => item.originalShow),
      null,
      2
    ),
    "utf8"
  );

  console.log("\nBackup created:", backupPath);

  // STEP 8: Update only the five selected show records.
  const updated = [];

  try {
    for (const item of changes) {
      const result = await Show.updateOne(
        {
          _id: item.showId,
          movie: item.oldMovieId,
          status: "SCHEDULED",
          isActive: true,
        },
        {
          $set: {
            movie: item.newMovieId,
            endTime: item.newEndTime,
          },
        }
      );

      if (result.matchedCount !== 1) {
        throw new Error(
          `Unexpected show change: ${item.theatre} | ${item.from}`
        );
      }

      updated.push(item);

      console.log(
        `UPDATED: ${item.theatre} | ${item.from} -> ${item.to}`
      );
    }
  } catch (error) {
    console.error("\nUpdate failed. Rolling back...");

    for (const item of [...updated].reverse()) {
      await Show.updateOne(
        {
          _id: item.showId,
          movie: item.newMovieId,
        },
        {
          $set: {
            movie: item.oldMovieId,
            endTime: item.oldEndTime,
          },
        }
      );
    }

    throw error;
  }

  console.log("\nSUCCESS!");
  console.log("Five duplicate assignments replaced.");
  console.log("All 26 shows have unique movie titles.");
  console.log("Replacement durations applied.");
  console.log("Original show timings and screens preserved.");
  console.log("No booking or movie records were modified.");
}

main()
  .catch((error) => {
    console.error("\nFAILED:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });