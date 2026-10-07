const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");

const Movie = require("../models/Movie");
const Theatre = require("../models/Theatre");
const Screen = require("../models/Screen");
const Show = require("../models/Show");

// =====================================================
// CONFIG
// =====================================================

const THEATRE_NAME = "BookMySeat Test Cinema";
const CITY = "Mumbai";
const TIMEZONE = "Asia/Kolkata";
const DAYS_TO_GENERATE = 7;

// =====================================================
// DEMO MOVIES
// =====================================================

const MOVIES = [
  {
    title: "Drishyam: The Conclusion",
    description:
      "Vijay Salgaonkar and his family face another dangerous investigation when the past returns.",
    genre: "Crime, Drama, Mystery, Thriller",
    duration: "2h 35m",
    rating: "U/A",
    language: "Hindi",
    releaseYear: 2026,
    avgRating: 4.7,
    director: "Abhishek Pathak",
  },

  {
    title: "Udta Teer",
    description:
      "A fast-paced comedy adventure filled with unexpected trouble, chaos and unlikely partnerships.",
    genre: "Comedy, Adventure",
    duration: "2h 14m",
    rating: "U/A",
    language: "Hindi",
    releaseYear: 2026,
    avgRating: 4.3,
    director: "",
  },

  {
    title: "The Saga of Rashtriya Rifles",
    description:
      "A military drama following courage, sacrifice and determination inside the Rashtriya Rifles.",
    genre: "Action, Drama, History",
    duration: "2h 20m",
    rating: "U/A",
    language: "Hindi",
    releaseYear: 2026,
    avgRating: 4.4,
    director: "",
  },

  {
    title: "Dhasal",
    description:
      "A biographical drama inspired by a powerful life, social change and artistic rebellion.",
    genre: "Biography, Drama",
    duration: "2h 08m",
    rating: "U/A",
    language: "Marathi",
    releaseYear: 2026,
    avgRating: 4.2,
    director: "",
  },

  {
    title: "Baththa",
    description:
      "An intense action drama involving conflict, family and difficult choices.",
    genre: "Action, Drama",
    duration: "2h 24m",
    rating: "U/A",
    language: "Tamil",
    releaseYear: 2026,
    avgRating: 4.3,
    director: "",
  },

  {
    title: "Mr Bhaarath",
    description:
      "A light-hearted comedy following a man whose ordinary life quickly becomes anything but ordinary.",
    genre: "Comedy, Drama",
    duration: "2h 06m",
    rating: "U",
    language: "Tamil",
    releaseYear: 2026,
    avgRating: 4.1,
    director: "",
  },

  {
    title: "Digger",
    description:
      "A powerful man finds himself caught in a strange crisis that forces him to rethink everything around him.",
    genre: "Comedy, Drama",
    duration: "2h 08m",
    rating: "U/A",
    language: "English",
    releaseYear: 2026,
    avgRating: 4.4,
    director: "Alejandro G. Iñárritu",
  },

  {
    title: "Verity",
    description:
      "A writer discovers disturbing secrets while finishing the work of a mysterious bestselling author.",
    genre: "Crime, Drama, Mystery, Thriller",
    duration: "1h 58m",
    rating: "A",
    language: "English",
    releaseYear: 2026,
    avgRating: 4.3,
    director: "Michael Showalter",
  },

  {
    title: "Lucky Strike",
    description:
      "An action thriller where one dangerous mission turns into a fight for survival.",
    genre: "Action, Drama, Thriller",
    duration: "2h 02m",
    rating: "U/A",
    language: "English",
    releaseYear: 2026,
    avgRating: 4.2,
    director: "",
  },

  {
    title: "Project Hail Mary",
    description:
      "A lone astronaut wakes in deep space and discovers his mission may be humanity's final chance to survive.",
    genre: "Adventure, Sci-Fi",
    duration: "2h 30m",
    rating: "U/A",
    language: "English",
    releaseYear: 2026,
    avgRating: 4.7,
    director: "",
  },

  {
    title: "Toy Story 5",
    description:
      "Woody, Buzz and their friends face a new challenge as technology changes how children play.",
    genre: "Animation, Adventure, Comedy",
    duration: "1h 45m",
    rating: "U",
    language: "English",
    releaseYear: 2026,
    avgRating: 4.5,
    director: "",
  },

  {
    title: "The Odyssey",
    description:
      "Odysseus begins a dangerous journey home through war, monsters and ancient mythology.",
    genre: "Action, Adventure, Fantasy",
    duration: "2h 50m",
    rating: "U/A",
    language: "English",
    releaseYear: 2026,
    avgRating: 4.8,
    director: "Christopher Nolan",
  },
];

// =====================================================
// HELPERS
// =====================================================

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const placeholderPoster = (title) =>
  `https://placehold.co/600x900/111111/ffffff?text=${encodeURIComponent(
    title
  )}`;

const placeholderBanner = (title) =>
  `https://placehold.co/1600x700/111111/ffffff?text=${encodeURIComponent(
    title
  )}`;

// =====================================================
// DATABASE
//
// IMPORTANT:
//
// Must match server.js EXACTLY.
//
// server.js uses:
// MONGO_URL + "/" + DB_NAME
// =====================================================

const connectDatabase = async () => {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME;

  if (!mongoUrl || !dbName) {
    throw new Error(
      "MONGO_URL or DB_NAME is missing from backend/.env"
    );
  }

  const connectionString =
    `${mongoUrl.replace(/\/$/, "")}/${dbName}`;

  await mongoose.connect(connectionString);

  console.log("✓ MongoDB connected");
  console.log(`✓ Database: ${mongoose.connection.name}`);
};

// =====================================================
// SEAT LAYOUT
// =====================================================

const makeRow = (row, seatType, count = 8) => {
  const seats = [];

  for (let number = 1; number <= count; number += 1) {
    // Centre aisle after seat 4.
    const column =
      number <= 4
        ? number
        : number + 1;

    seats.push({
      seatId: `${row}${number}`,
      row,
      number,
      column,
      type: seatType,
      isActive: true,
    });
  }

  return seats;
};

const createSeatLayout = () => [
  ...makeRow("A", "REGULAR"),
  ...makeRow("B", "REGULAR"),
  ...makeRow("C", "PREMIUM"),
  ...makeRow("D", "PREMIUM"),
  ...makeRow("E", "RECLINER"),
];

// =====================================================
// THEATRE
// =====================================================

const ensureTheatre = async () => {
  const matchingTheatres =
    await Theatre.find({
      name: {
        $regex: `^${escapeRegex(THEATRE_NAME)}$`,
        $options: "i",
      },
    }).sort({
      createdAt: 1,
    });

  let theatre =
    matchingTheatres[0];

  // ---------------------------------------------------
  // CREATE ONLY IF NONE EXISTS
  // ---------------------------------------------------

  if (!theatre) {
    theatre =
      await Theatre.create({
        name: THEATRE_NAME,

        slug:
          "bookmyseat-test-cinema-mumbai",

        city: CITY,

        address: {
          street: "Test Road",
          area: "Andheri West",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400053",
          country: "India",
        },

        location: {
          type: "Point",
          coordinates: [
            72.8296,
            19.1363,
          ],
        },

        description:
          "Test cinema used for BookMySeat booking flow development.",

        coverImage: "",

        gallery: [],

        amenities: [
          "Parking",
          "Food & Beverages",
          "Dolby Atmos",
          "Air Conditioning",
          "Wheelchair Accessible",
        ],

        contact: {
          phone: "",
          email: "",
          whatsapp: "",
        },

        isActive: true,
      });

    console.log(
      `+ Theatre created: ${theatre.name}`
    );

    return theatre;
  }

  // ---------------------------------------------------
  // REPAIR PRIMARY THEATRE
  // ---------------------------------------------------

  theatre.isActive = true;

  theatre.city =
    theatre.city || CITY;

  theatre.slug =
    theatre.slug ||
    slugify(
      `${theatre.name}-${theatre.city}`
    );

  await theatre.save();

  console.log(
    `✓ Using theatre: ${theatre.name}`
  );

  console.log(
    `✓ Theatre ID: ${theatre._id}`
  );

  // ---------------------------------------------------
  // DEACTIVATE DUPLICATE DEMO THEATRES
  //
  // We do not delete them because old bookings may
  // still reference them.
  // ---------------------------------------------------

  if (
    matchingTheatres.length >
    1
  ) {
    const duplicates =
      matchingTheatres.slice(1);

    for (
      const duplicate
      of duplicates
    ) {
      if (
        duplicate.isActive
      ) {
        duplicate.isActive =
          false;

        await duplicate.save();

        console.log(
          `- Deactivated duplicate theatre: ${duplicate._id}`
        );
      }
    }
  }

  return theatre;
};

// =====================================================
// SCREENS
// =====================================================

const SCREEN_CONFIG = [
  {
    name: "Screen 1",
    screenNumber: 1,
    format: "DOLBY_CINEMA",
    audio: "DOLBY_ATMOS",
  },

  {
    name: "Screen 2",
    screenNumber: 2,
    format: "IMAX",
    audio: "DOLBY_ATMOS",
  },

  {
    name: "Screen 3",
    screenNumber: 3,
    format: "STANDARD",
    audio: "DOLBY_ATMOS",
  },
];

const ensureScreens = async (
  theatre
) => {
  const screens = [];

  for (
    const config
    of SCREEN_CONFIG
  ) {
    let screen =
      await Screen.findOne({
        theatre: theatre._id,
        screenNumber:
          config.screenNumber,
      });

    const seats =
      createSeatLayout();

    if (!screen) {
      screen =
        await Screen.create({
          theatre:
            theatre._id,

          name:
            config.name,

          screenNumber:
            config.screenNumber,

          format:
            config.format,

          audio:
            config.audio,

          seats,

          totalSeats:
            seats.length,

          isActive:
            true,
        });

      console.log(
        `+ Screen created: ${screen.name} (${seats.length} seats)`
      );
    } else {
      // Existing screens may already have bookings.
      //
      // Do NOT replace the physical seat layout if
      // it already exists.

      screen.name =
        config.name;

      screen.format =
        config.format;

      screen.audio =
        config.audio;

      screen.isActive =
        true;

      if (
        !Array.isArray(
          screen.seats
        ) ||
        screen.seats.length ===
          0
      ) {
        screen.seats =
          seats;

        screen.totalSeats =
          seats.length;
      }

      await screen.save();

      console.log(
        `✓ Screen ready: ${screen.name} (${screen.totalSeats} seats)`
      );
    }

    screens.push(screen);
  }

  return screens;
};

// =====================================================
// MOVIES
// =====================================================

const ensureMovies = async () => {
  const prepared = [];

  for (
    const data
    of MOVIES
  ) {
    let movie =
      await Movie.findOne({
        title: {
          $regex:
            `^${escapeRegex(
              data.title
            )}$`,

          $options: "i",
        },
      });

    if (!movie) {
      movie =
        await Movie.create({
          title:
            data.title,

          description:
            data.description,

          genre:
            data.genre,

          duration:
            data.duration,

          rating:
            data.rating,

          poster:
            placeholderPoster(
              data.title
            ),

          banner:
            placeholderBanner(
              data.title
            ),

          trailer: "",

          cast: [],

          director:
            data.director ||
            "",

          producer: "",

          releaseYear:
            data.releaseYear,

          avgRating:
            data.avgRating,

          releaseDate:
            new Date(),

          // Legacy fields.
          // We are removing these from product logic.
          trending: false,
          trendingRank: 0,
        });

      console.log(
        `+ Movie created: ${movie.title}`
      );
    } else {
      console.log(
        `✓ Movie exists: ${movie.title}`
      );
    }

    prepared.push({
      movie,
      language:
        data.language,
    });
  }

  return prepared;
};

// =====================================================
// PRICING
// =====================================================

const getPricing = (
  screen
) => {
  switch (
    screen.format
  ) {
    case "IMAX":
      return [
        {
          seatType:
            "REGULAR",
          price: 300,
        },

        {
          seatType:
            "PREMIUM",
          price: 420,
        },

        {
          seatType:
            "RECLINER",
          price: 600,
        },
      ];

    case "DOLBY_CINEMA":
      return [
        {
          seatType:
            "REGULAR",
          price: 280,
        },

        {
          seatType:
            "PREMIUM",
          price: 390,
        },

        {
          seatType:
            "RECLINER",
          price: 560,
        },
      ];

    default:
      return [
        {
          seatType:
            "REGULAR",
          price: 220,
        },

        {
          seatType:
            "PREMIUM",
          price: 320,
        },

        {
          seatType:
            "RECLINER",
          price: 480,
        },
      ];
  }
};

// =====================================================
// DURATION
// =====================================================

const durationInMinutes = (
  duration
) => {
  const value =
    String(
      duration || ""
    ).toLowerCase();

  const hours =
    Number(
      value.match(
        /(\d+)\s*h/
      )?.[1] || 0
    );

  const minutes =
    Number(
      value.match(
        /(\d+)\s*m/
      )?.[1] || 0
    );

  const total =
    hours * 60 +
    minutes;

  return total || 140;
};

// =====================================================
// DATE HELPERS
// =====================================================

const getTodayIST = () =>
  new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(
    new Date()
  );

const addDays = (
  dateKey,
  days
) => {
  const [
    year,
    month,
    day,
  ] =
    dateKey
      .split("-")
      .map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day + days
    )
  )
    .toISOString()
    .slice(0, 10);
};

const createISTDate = (
  dateKey,
  time
) =>
  new Date(
    `${dateKey}T${time}:00+05:30`
  );

// =====================================================
// SHOW SLOTS
// =====================================================

const SHOW_SLOTS = [
  "09:30",
  "13:30",
  "17:30",
  "21:30",
];

// =====================================================
// CREATE SHOWS
// =====================================================

const createShows = async ({
  theatre,
  screens,
  movies,
}) => {
  const today =
    getTodayIST();

  let created = 0;
  let skipped = 0;

  for (
    let dayOffset = 1;
    dayOffset <=
    DAYS_TO_GENERATE;
    dayOffset += 1
  ) {
    const dateKey =
      addDays(
        today,
        dayOffset
      );

    for (
      let index = 0;
      index <
      movies.length;
      index += 1
    ) {
      const movieInfo =
        movies[index];

      const screenIndex =
        Math.floor(
          index /
            SHOW_SLOTS.length
        ) %
        screens.length;

      const slotIndex =
        index %
        SHOW_SLOTS.length;

      const screen =
        screens[
          screenIndex
        ];

      const time =
        SHOW_SLOTS[
          slotIndex
        ];

      const startTime =
        createISTDate(
          dateKey,
          time
        );

      const runtime =
        durationInMinutes(
          movieInfo.movie
            .duration
        );

      const endTime =
        new Date(
          startTime.getTime() +
            runtime *
              60 *
              1000
        );

      // -------------------------------------------------
      // EXACT DEMO SHOW ALREADY EXISTS
      // -------------------------------------------------

      const existing =
        await Show.findOne({
          movie:
            movieInfo.movie
              ._id,

          theatre:
            theatre._id,

          screen:
            screen._id,

          startTime,
        });

      if (existing) {
        skipped += 1;
        continue;
      }

      // -------------------------------------------------
      // OVERLAP PROTECTION
      // -------------------------------------------------

      const conflict =
        await Show.findOne({
          screen:
            screen._id,

          isActive: {
            $ne: false,
          },

          status: {
            $ne:
              "CANCELLED",
          },

          startTime: {
            $lt: endTime,
          },

          endTime: {
            $gt: startTime,
          },
        });

      if (conflict) {
        console.log(
          `! Slot occupied: ${screen.name} ${dateKey} ${time}`
        );

        skipped += 1;
        continue;
      }

      const pricing =
        getPricing(
          screen
        );

      const cheapest =
        Math.min(
          ...pricing.map(
            (item) =>
              item.price
          )
        );

      await Show.create({
        movie:
          movieInfo.movie
            ._id,

        theatre:
          theatre._id,

        screen:
          screen._id,

        startTime,

        endTime,

        // Legacy compatibility fields.
        date:
          startTime,

        time,

        language:
          movieInfo.language,

        format:
          screen.format,

        pricing,

        price:
          cheapest,

        bookingOpensAt:
          new Date(),

        bookingClosesAt:
          new Date(
            startTime.getTime() -
              15 *
                60 *
                1000
          ),

        bookedSeats: [],

        status:
          "SCHEDULED",

        isActive:
          true,
      });

      created += 1;

      console.log(
        `+ Show: ${movieInfo.movie.title} | ${dateKey} ${time} | ${screen.name}`
      );
    }
  }

  return {
    created,
    skipped,
  };
};

// =====================================================
// SUMMARY
// =====================================================

const printSummary = ({
  theatre,
  screens,
  movies,
  shows,
}) => {
  console.log(
    "\n========================================"
  );

  console.log(
    "BOOKMYSEAT DEMO READY"
  );

  console.log(
    "========================================"
  );

  console.log(
    `Database: ${mongoose.connection.name}`
  );

  console.log(
    `Cinema: ${theatre.name}`
  );

  console.log(
    `Theatre ID: ${theatre._id}`
  );

  console.log(
    `Slug: ${theatre.slug}`
  );

  console.log(
    `City: ${theatre.city}`
  );

  console.log(
    `Screens: ${screens.length}`
  );

  console.log(
    `Movies: ${movies.length}`
  );

  console.log(
    `New shows created: ${shows.created}`
  );

  console.log(
    `Existing/skipped shows: ${shows.skipped}`
  );

  console.log(
    `Schedule: next ${DAYS_TO_GENERATE} days`
  );

  console.log(
    "========================================\n"
  );

  console.log(
    "✓ Demo inventory is ready."
  );
};

// =====================================================
// RUN
// =====================================================

const run = async () => {
  try {
    console.log(
      "\nBookMySeat Complete Demo Seeder\n"
    );

    await connectDatabase();

    const theatre =
      await ensureTheatre();

    const screens =
      await ensureScreens(
        theatre
      );

    const movies =
      await ensureMovies();

    const shows =
      await createShows({
        theatre,
        screens,
        movies,
      });

    printSummary({
      theatre,
      screens,
      movies,
      shows,
    });
  } catch (error) {
    console.error(
      "\nSeeder failed:\n"
    );

    console.error(
      error
    );

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();