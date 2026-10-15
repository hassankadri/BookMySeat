
// Every string on the homepage lives here.
//
// Claims policy:
// This page only states things the frontend
// demonstrably does.
//
// Each message has exactly one home:
//   choosing a cinema ........ opening
//   current films ............ programme
//   size of the schedule ..... nextSevenDays
//   upcoming films ........... nextOnScreen
//   help deciding ............ ask
//   accounts ................. account

const plural = (n, one, many) =>
  n === 1 ? one : many;

const copy = {
  opening: {
    headline: "Start with your cinema. End with your seat.",

    subline:
      "See only what is scheduled at the cinema you choose, then pick the exact seat you want.",

    finder: {
      city: "City",
      cinema: "Cinema",
      cityPlaceholder: "Select city",
      cinemaPlaceholder: "Select cinema",
      submit: "See what's playing here",
      noCinemas: "Choose a cinema",
    },

    caption: {
      playingNow: "Playing now",
      playingAt: (name) => `Playing at ${name}`,
      showtimes: "View showtimes",
      emptyTitle: "No shows scheduled yet",
      emptyBody:
        "New schedules appear here as soon as a cinema publishes them.",
      pick: (title) => `Show ${title}`,
      pickerLabel: "Films on the screen",
    },
  },

  programme: {
    heading: "Playing now",
    headingAt: (name) => `Playing at ${name}`,
    indexLabel: "Films playing",
    showAll: "Show all cinemas",
    showtimes: "View showtimes",

    counts: (film) => {
      const shows =
        `${film.showCount} ` +
        plural(film.showCount, "show", "shows");

      const places =
        film.theatreCount > 0
          ? ` across ${film.theatreCount} ${plural(
              film.theatreCount,
              "cinema",
              "cinemas"
            )}`
          : "";

      return `${shows}${places}`;
    },

    empty: {
      all: {
        title: "No upcoming shows yet",
        action: "Browse cinemas",
      },

      scoped: {
        title: "Nothing scheduled at this cinema yet",
        action: "Show all cinemas",
      },
    },
  },

  nextSevenDays: {
    heading: "The next seven days",
    scope: "across all cinemas",
    films: (n) => plural(n, "film", "films"),
    shows: (n) => plural(n, "show", "shows"),
    cinemas: (n) => plural(n, "cinema", "cinemas"),
  },

  nextOnScreen: {
    heading: "Next on screen",
    dateFallback: "Date to be announced",
    play: (title) => `Play the trailer for ${title}`,
    closeTrailer: "Close trailer",
    trailerTitle: (title) => `${title} trailer`,
    filmPage: "View film",
  },

  ask: {
    heading: "Can't decide? Describe it.",

    // Example prompts used by AiSearch.jsx.
    prompts: [
      "Show me movies",
      "Suggest a comedy",
      "Hindi movies tomorrow",
      "Anything under ₹300",
    ],

    action: "Open the assistant",
  },

  account: {
    signedOut: {
      heading:
        "One account for your bookings and tickets.",

      body:
        "Browsing is open to everyone. You need an account to book seats.",

      action: "Sign in or create an account",
    },

    signedIn: {
      heading: "Your bookings and tickets.",
      bookings: "My bookings",
    },
  },

  footer: {
    tagline: "Cinema booking, seat by seat.",

    groups: {
      explore: "Explore",
      account: "Account",
      help: "Help",
    },

    links: {
      cinemas: "Cinemas",
      movies: "Movies",
      assistant: "Assistant",
      contact: "Contact",
      signIn: "Sign in",
      myBookings: "My bookings",
    },

    rights: (year) =>
      `\u00A9 ${year} BookMySeat`,
  },

  errors: {
    scheduleTitle:
      "We could not load the schedule.",

    scheduleBody:
      "Check your connection and try again.",

    retry: "Try again",
  },
};

export default copy;
