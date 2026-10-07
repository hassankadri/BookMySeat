const express = require("express");
const mongoose = require("mongoose");

const Show = require("../models/Show");
const Theatre = require("../models/Theatre");

const router = express.Router();

const CINEMA_TIMEZONE = "Asia/Kolkata";
const MAX_RESULTS = 8;

// =====================================================
// CONSTANTS
// =====================================================

const TIME_OF_DAY_VALUES = new Set([
  "any",
  "morning",
  "afternoon",
  "evening",
  "night",
]);

const SORT_VALUES = new Set([
  "relevant",
  "earliest",
  "cheapest",
]);

const INTENT_FIELDS = new Set([
  "movieTitle",
  "language",
  "genre",
  "format",
  "date",
  "dateIntent",
  "timeOfDay",
  "maxPrice",
  "sort",
]);

// Words people naturally use instead of exact genres.
const MOOD_GENRES = [
  {
    words: [
      "funny",
      "funnier",
      "funniest",
      "laugh",
      "laughing",
      "comedy",
      "comedies",
    ],

    genre:
      "Comedy",
  },

  {
    words: [
      "sad",
      "emotional",
      "emotional movie",
      "cry",
      "crying",
      "tearjerker",
      "heartbreaking",
    ],

    genre:
      "Drama",
  },

  {
    words: [
      "scary",
      "horror",
      "spooky",
      "creepy",
      "terrifying",
      "frightening",
    ],

    genre:
      "Horror",
  },

  {
    words: [
      "romantic",
      "romance",
      "love story",
      "date movie",
      "date night",
    ],

    genre:
      "Romance",
  },

  {
    words: [
      "thriller",
      "thrilling",
      "suspense",
      "suspenseful",
      "tense",
    ],

    genre:
      "Thriller",
  },

  {
    words: [
      "action",
      "fight",
      "fighting",
      "explosions",
    ],

    genre:
      "Action",
  },

  {
    words: [
      "family",
      "kids",
      "children",
      "kid friendly",
    ],

    genre:
      "Family",
  },

  {
    words: [
      "animated",
      "animation",
      "cartoon",
    ],

    genre:
      "Animation",
  },
];

// If exact genre inventory is empty, these are reasonable
// nearby categories we may offer WITHOUT pretending they
// are the requested genre.
const GENRE_ALTERNATIVES = {
  Horror: [
    "Thriller",
    "Mystery",
  ],

  Romance: [
    "Drama",
  ],

  Family: [
    "Animation",
    "Comedy",
  ],
};

// =====================================================
// BASIC HELPERS
// =====================================================

const cleanText = (
  value
) =>
  String(value || "")
    .trim()
    .toLowerCase();

const containsPhrase = (
  text,
  phrase
) =>
  cleanText(text).includes(
    cleanText(phrase)
  );

const getDateKey = (
  value
) =>
  new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        CINEMA_TIMEZONE,

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  ).format(
    new Date(value)
  );

const getHour = (
  value
) => {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          CINEMA_TIMEZONE,

        hour:
          "2-digit",

        hourCycle:
          "h23",
      }
    ).formatToParts(
      new Date(value)
    );

  return Number(
    parts.find(
      (part) =>
        part.type ===
        "hour"
    )?.value || 0
  );
};

const getTimeParts = (
  value
) => {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          CINEMA_TIMEZONE,

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23",
      }
    ).formatToParts(
      new Date(value)
    );

  return {
    hour:
      Number(
        parts.find(
          (part) =>
            part.type ===
            "hour"
        )?.value
      ),

    minute:
      Number(
        parts.find(
          (part) =>
            part.type ===
            "minute"
        )?.value
      ),
  };
};

const getMinPrice = (
  show
) => {
  if (
    Array.isArray(
      show.pricing
    ) &&
    show.pricing.length
  ) {
    const prices =
      show.pricing
        .map(
          (item) =>
            Number(
              item.price
            )
        )
        .filter(
          Number.isFinite
        );

    if (
      prices.length
    ) {
      return Math.min(
        ...prices
      );
    }
  }

  const legacy =
    Number(
      show.price || 0
    );

  return Number.isFinite(
    legacy
  )
    ? legacy
    : 0;
};

const normalizeFormat = (
  value
) => {
  if (!value) {
    return null;
  }

  const normalized =
    String(value)
      .trim()
      .toUpperCase()
      .replace(
        /\s+/g,
        "_"
      )
      .replace(
        /-/g,
        "_"
      );

  if (
    normalized ===
    "IMAX3D"
  ) {
    return "IMAX_3D";
  }

  if (
    normalized ===
    "DOLBY"
  ) {
    return "DOLBY_CINEMA";
  }

  return normalized;
};

const matchesTimeOfDay = (
  startTime,
  timeOfDay
) => {
  if (
    !timeOfDay ||
    timeOfDay ===
      "any"
  ) {
    return true;
  }

  const hour =
    getHour(
      startTime
    );

  switch (
    timeOfDay
  ) {
    case "morning":
      return (
        hour >= 5 &&
        hour < 12
      );

    case "afternoon":
      return (
        hour >= 12 &&
        hour < 17
      );

    case "evening":
      return (
        hour >= 17 &&
        hour < 21
      );

    case "night":
      return (
        hour >= 21 ||
        hour < 5
      );

    default:
      return true;
  }
};

// =====================================================
// INTENT
// =====================================================

const emptyIntent =
  () => ({
    movieTitle:
      null,

    language:
      null,

    genre:
      null,

    format:
      null,

    date:
      null,

    dateIntent:
      null,

    timeOfDay:
      "any",

    maxPrice:
      null,

    sort:
      "relevant",
  });

const sanitizeIntent = (
  input = {}
) => {
  const intent =
    emptyIntent();

  if (
    typeof input.movieTitle ===
      "string" &&
    input.movieTitle.trim()
  ) {
    intent.movieTitle =
      input.movieTitle
        .trim()
        .slice(
          0,
          120
        );
  }

  if (
    typeof input.language ===
      "string" &&
    input.language.trim()
  ) {
    intent.language =
      input.language
        .trim()
        .slice(
          0,
          50
        );
  }

  if (
    typeof input.genre ===
      "string" &&
    input.genre.trim()
  ) {
    intent.genre =
      input.genre
        .trim()
        .slice(
          0,
          80
        );
  }

  if (
    typeof input.format ===
      "string" &&
    input.format.trim()
  ) {
    intent.format =
      normalizeFormat(
        input.format
      );
  }

  if (
    typeof input.date ===
      "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      input.date
    )
  ) {
    intent.date =
      input.date;
  }

  if (
    [
      "today",
      "tomorrow",
    ].includes(
      input.dateIntent
    )
  ) {
    intent.dateIntent =
      input.dateIntent;
  }

  if (
    TIME_OF_DAY_VALUES.has(
      input.timeOfDay
    )
  ) {
    intent.timeOfDay =
      input.timeOfDay;
  }

  if (
    input.maxPrice !==
      null &&
    input.maxPrice !==
      undefined &&
    input.maxPrice !==
      ""
  ) {
    const price =
      Number(
        input.maxPrice
      );

    if (
      Number.isFinite(
        price
      ) &&
      price >= 0
    ) {
      intent.maxPrice =
        price;
    }
  }

  if (
    SORT_VALUES.has(
      input.sort
    )
  ) {
    intent.sort =
      input.sort;
  }

  if (
    intent.date
  ) {
    intent.dateIntent =
      null;
  }

  return intent;
};

const clearIntentField = (
  intent,
  field
) => {
  if (
    !INTENT_FIELDS.has(
      field
    )
  ) {
    return;
  }

  intent[field] =
    emptyIntent()[
      field
    ];

  if (
    field ===
    "date"
  ) {
    intent.dateIntent =
      null;
  }

  if (
    field ===
    "dateIntent"
  ) {
    intent.date =
      null;
  }
};

const resolveDate = (
  intent
) => {
  if (
    intent.date
  ) {
    return intent.date;
  }

  if (
    intent.dateIntent ===
    "today"
  ) {
    return getDateKey(
      new Date()
    );
  }

  if (
    intent.dateIntent ===
    "tomorrow"
  ) {
    return getDateKey(
      new Date(
        Date.now() +
          24 *
            60 *
            60 *
            1000
      )
    );
  }

  return null;
};

// =====================================================
// MOOD / NATURAL LANGUAGE HELPERS
// =====================================================

const detectMoodGenre = (
  message
) => {
  const q =
    cleanText(
      message
    );

  for (
    const rule
    of MOOD_GENRES
  ) {
    if (
      rule.words.some(
        (word) =>
          q.includes(
            cleanText(
              word
            )
          )
      )
    ) {
      return rule.genre;
    }
  }

  return null;
};

const applyMoodToIntent = (
  message,
  intent
) => {
  const detectedGenre =
    detectMoodGenre(
      message
    );

  if (
    detectedGenre
  ) {
    return {
      ...intent,

      genre:
        detectedGenre,
    };
  }

  return intent;
};

// =====================================================
// QUICK NORMAL CONVERSATION
// =====================================================

const directConversationReply = (
  message,
  cinema
) => {
  const q =
    cleanText(
      message
    );

  if (
    /^(hi+|hello+|hey+|yo+|sup|hii+|heyy+|heyyy+|good morning|good afternoon|good evening)[!?.\s]*$/i.test(
      q
    )
  ) {
    return `Hey 👋 What are you in the mood for today? Comedy, action, something emotional... anything works.`;
  }

  if (
    /^(thanks|thank you|thx|ty|cool|nice|okay|ok|got it|alright)[!?.\s]*$/i.test(
      q
    )
  ) {
    return "Anytime 😄 Just tell me what you're feeling like watching.";
  }

  if (
    q.includes(
      "how are you"
    )
  ) {
    return "Doing good 😄 How about you? And whenever you're ready, we can find something worth watching.";
  }

  if (
    q.includes(
      "what can you do"
    ) ||
    q.includes(
      "what do you do"
    ) ||
    q === "help" ||
    q.includes(
      "how does this work"
    )
  ) {
    return `I can help you pick something from the real shows at ${cinema.name} — by mood, genre, language, price, time or format. You can also say things like “cheaper”, “tomorrow instead” or “book the second one”.`;
  }

  return null;
};

// =====================================================
// FALLBACK PARSER
// =====================================================

const fallbackParse = (
  message,
  previousIntent = {}
) => {
  const q =
    cleanText(
      message
    );

  let next =
    sanitizeIntent(
      previousIntent
    );

  // ---------------------------------------------------
  // RESET
  // ---------------------------------------------------

  if (
    q === "reset" ||
    q.includes(
      "start over"
    ) ||
    q.includes(
      "clear search"
    )
  ) {
    return {
      action:
        "SEARCH",

      intent:
        emptyIntent(),

      selection:
        null,

      recommendationBasis:
        null,
    };
  }

  // ---------------------------------------------------
  // RECOMMEND / COMPARE EXISTING RESULTS
  // ---------------------------------------------------

  if (
    /\b(which|what)\b.*\b(best|better|highest rated|top)\b/i.test(
      q
    ) ||
    q.includes(
      "which one should i watch"
    ) ||
    q.includes(
      "what should i watch"
    )
  ) {
    return {
      action:
        "RECOMMEND",

      intent:
        next,

      selection:
        null,

      recommendationBasis:
        q.includes(
          "rated"
        )
          ? "rating"
          : "overall",
    };
  }

  if (
    q.includes(
      "according to reviews"
    ) ||
    q.includes(
      "based on reviews"
    ) ||
    q.includes(
      "best reviews"
    )
  ) {
    return {
      action:
        "RECOMMEND",

      intent:
        next,

      selection:
        null,

      recommendationBasis:
        "reviews",
    };
  }

  if (
    q.includes(
      "which is funniest"
    ) ||
    q.includes(
      "which one is funniest"
    )
  ) {
    return {
      action:
        "RECOMMEND",

      intent:
        next,

      selection:
        null,

      recommendationBasis:
        "funniest",
    };
  }

  if (
    q.includes(
      "which is cheapest"
    ) ||
    q.includes(
      "which one is cheapest"
    )
  ) {
    return {
      action:
        "RECOMMEND",

      intent:
        next,

      selection:
        null,

      recommendationBasis:
        "cheapest",
    };
  }

  if (
    q.includes(
      "which is earliest"
    ) ||
    q.includes(
      "which one is earliest"
    )
  ) {
    return {
      action:
        "RECOMMEND",

      intent:
        next,

      selection:
        null,

      recommendationBasis:
        "earliest",
    };
  }

  // ---------------------------------------------------
  // SELECT RESULT NUMBER
  // ---------------------------------------------------

  const ordinalMatch =
    q.match(
      /\b(?:book|select|choose)\s+(?:the\s+)?(first|second|third|fourth|fifth|[1-9]\d*)\b/
    );

  if (
    ordinalMatch
  ) {
    const words = {
      first: 1,
      second: 2,
      third: 3,
      fourth: 4,
      fifth: 5,
    };

    return {
      action:
        "SELECT_SHOW",

      intent:
        next,

      selection: {
        resultIndex:
          words[
            ordinalMatch[1]
          ] ||
          Number(
            ordinalMatch[1]
          ),

        requestedTime:
          null,
      },

      recommendationBasis:
        null,
    };
  }

  // ---------------------------------------------------
  // SELECT TIME
  // ---------------------------------------------------

  const timeMatch =
    q.match(
      /\b(?:book|select|choose)\s+(?:the\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/
    );

  if (
    timeMatch
  ) {
    let hour =
      Number(
        timeMatch[1]
      );

    const minute =
      Number(
        timeMatch[2] ||
        0
      );

    if (
      timeMatch[3] ===
        "pm" &&
      hour < 12
    ) {
      hour += 12;
    }

    if (
      timeMatch[3] ===
        "am" &&
      hour === 12
    ) {
      hour = 0;
    }

    return {
      action:
        "SELECT_SHOW",

      intent:
        next,

      selection: {
        resultIndex:
          null,

        requestedTime:
          `${String(
            hour
          ).padStart(
            2,
            "0"
          )}:${String(
            minute
          ).padStart(
            2,
            "0"
          )}`,
      },

      recommendationBasis:
        null,
    };
  }

  // ---------------------------------------------------
  // MOOD
  // ---------------------------------------------------

  next =
    applyMoodToIntent(
      message,
      next
    );

  // ---------------------------------------------------
  // LANGUAGE
  // ---------------------------------------------------

  if (
    q.includes(
      "any language"
    )
  ) {
    next.language =
      null;
  } else if (
    q.includes(
      "hindi"
    )
  ) {
    next.language =
      "Hindi";
  } else if (
    q.includes(
      "english"
    )
  ) {
    next.language =
      "English";
  } else if (
    q.includes(
      "marathi"
    )
  ) {
    next.language =
      "Marathi";
  } else if (
    q.includes(
      "tamil"
    )
  ) {
    next.language =
      "Tamil";
  } else if (
    q.includes(
      "telugu"
    )
  ) {
    next.language =
      "Telugu";
  }

  // ---------------------------------------------------
  // PRICE
  // ---------------------------------------------------

  if (
    q.includes(
      "remove the price"
    ) ||
    q.includes(
      "no price limit"
    ) ||
    q.includes(
      "any price"
    )
  ) {
    next.maxPrice =
      null;
  } else {
    const priceMatch =
      q.match(
        /(?:under|below|max|less than|₹|rs\.?|rupees?)\s*([0-9]{2,6})/i
      );

    if (
      priceMatch
    ) {
      next.maxPrice =
        Number(
          priceMatch[1]
        );
    }
  }

  // ---------------------------------------------------
  // DATE
  // ---------------------------------------------------

  if (
    q.includes(
      "tonight"
    )
  ) {
    next.date =
      null;

    next.dateIntent =
      "today";

    next.timeOfDay =
      "night";
  } else if (
    q.includes(
      "tomorrow"
    )
  ) {
    next.date =
      null;

    next.dateIntent =
      "tomorrow";
  } else if (
    q.includes(
      "today"
    )
  ) {
    next.date =
      null;

    next.dateIntent =
      "today";
  }

  // ---------------------------------------------------
  // DAY PART
  // ---------------------------------------------------

  if (
    q.includes(
      "morning"
    )
  ) {
    next.timeOfDay =
      "morning";
  } else if (
    q.includes(
      "afternoon"
    )
  ) {
    next.timeOfDay =
      "afternoon";
  } else if (
    q.includes(
      "evening"
    )
  ) {
    next.timeOfDay =
      "evening";
  } else if (
    q.includes(
      "night"
    )
  ) {
    next.timeOfDay =
      "night";
  }

  // ---------------------------------------------------
  // SORT
  // ---------------------------------------------------

  if (
    q.includes(
      "cheaper"
    ) ||
    q.includes(
      "cheapest"
    )
  ) {
    next.sort =
      "cheapest";
  }

  if (
    q.includes(
      "earlier"
    ) ||
    q.includes(
      "earliest"
    )
  ) {
    next.sort =
      "earliest";
  }

  // ---------------------------------------------------
  // DOES THIS LOOK LIKE A SEARCH?
  // ---------------------------------------------------

  const looksLikeSearch =
    /\b(movie|movies|show|shows|showtime|showtimes|watch|watching|playing|available|book|ticket|tickets|hindi|english|marathi|tamil|telugu|imax|3d|4dx|dolby|today|tomorrow|tonight|morning|afternoon|evening|night|cheaper|cheapest|earlier|earliest|under|below|comedy|funny|sad|emotional|horror|scary|romance|romantic|thriller|action|family|animation)\b/i.test(
      q
    );

  if (
    !looksLikeSearch
  ) {
    return {
      action:
        "CHAT",

      intent:
        next,

      selection:
        null,

      recommendationBasis:
        null,

      reply:
        "I'm with you 😄 Tell me what kind of movie you're feeling like watching.",
    };
  }

  return {
    action:
      "SEARCH",

    intent:
      sanitizeIntent(
        next
      ),

    selection:
      null,

    recommendationBasis:
      null,
  };
};

// =====================================================
// GROQ INTENT PARSER
// =====================================================

const parseConversation =
  async ({
    message,
    currentIntent,
    results,
    cinema,
  }) => {
    if (
      !process.env
        .GROQ_API_KEY
    ) {
      return {
        ...fallbackParse(
          message,
          currentIntent
        ),

        aiUsed:
          false,
      };
    }

    const today =
      getDateKey(
        new Date()
      );

    const resultSummary =
      results
        .slice(
          0,
          MAX_RESULTS
        )
        .map(
          (
            result,
            index
          ) => ({
            number:
              index + 1,

            movie:
              result.movie
                ?.title,

            genre:
              result.movie
                ?.genre,

            rating:
              result.movie
                ?.avgRating,

            time:
              result.startTime,

            language:
              result.language,

            format:
              result.format,

            price:
              result.minPrice,
          })
        );

    try {
      const response =
        await fetch(
          "https://api.groq.com/openai/v1/chat/completions",

          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${process.env.GROQ_API_KEY}`,
            },

            body:
              JSON.stringify({
                model:
                  process.env
                    .GROQ_MODEL ||
                  "openai/gpt-oss-20b",

                temperature:
                  0,

                messages: [
                  {
                    role:
                      "system",

                    content: `
You are the intent engine behind a friendly movie booking assistant called BookMySeat.

You are NOT responsible for inventing recommendations or inventory.
MongoDB is the source of truth.

Selected cinema:
${cinema.name}, ${cinema.city}

The cinema is LOCKED.
Never switch cinema because of the user's message.

Today:
${today}

Timezone:
${CINEMA_TIMEZONE}

Current search filters:
${JSON.stringify(
  currentIntent
)}

Current REAL results shown to the user:
${JSON.stringify(
  resultSummary
)}

Understand natural conversation and classify it as:

CHAT
SEARCH
SELECT_SHOW
RECOMMEND
RESET

Examples:

"hi"
→ CHAT

"I'm happy today"
→ CHAT

"thanks"
→ CHAT

"show me movies"
→ SEARCH

"suggest something funny"
→ SEARCH, genre=Comedy

"I want something sad"
→ SEARCH, genre=Drama

"something scary"
→ SEARCH, genre=Horror

"romantic movies"
→ SEARCH, genre=Romance

"Hindi movies tomorrow"
→ SEARCH

"cheaper"
→ SEARCH and preserve old filters, sort=cheapest

"which one is the best?"
→ RECOMMEND, basis=overall

"which is highest rated?"
→ RECOMMEND, basis=rating

"which is cheapest?"
→ RECOMMEND, basis=cheapest

"which one is funniest?"
→ RECOMMEND, basis=funniest

"funniest according to reviews?"
→ RECOMMEND, basis=reviews

"book the second one"
→ SELECT_SHOW, resultIndex=2

"book 9 pm"
→ SELECT_SHOW, requestedTime="21:00"

Important rules:

- Never invent a movie.
- Never invent a rating.
- Never invent reviews.
- Never invent a cinema.
- Never invent a showtime.
- Never invent a price.
- We currently have a stored avgRating field but DO NOT have review text or review counts.
- "sad" normally means Drama.
- "funny" normally means Comedy.
- "scary" normally means Horror.
- "romantic" normally means Romance.
- RECOMMEND refers to the existing results unless the user clearly starts a new search.
- CHAT responses should be short and natural.

Return ONLY JSON.

{
  "action": "CHAT" | "SEARCH" | "SELECT_SHOW" | "RECOMMEND" | "RESET",

  "reply": string | null,

  "updates": {
    "movieTitle": string | null,
    "language": string | null,
    "genre": string | null,
    "format": string | null,
    "date": string | null,
    "dateIntent": "today" | "tomorrow" | null,
    "timeOfDay": "any" | "morning" | "afternoon" | "evening" | "night" | null,
    "maxPrice": number | null,
    "sort": "relevant" | "earliest" | "cheapest" | null
  },

  "fieldsToClear": [],

  "resultIndex": number | null,

  "requestedTime": string | null,

  "recommendationBasis": "overall" | "rating" | "reviews" | "funniest" | "cheapest" | "earliest" | null
}
`,
                  },

                  {
                    role:
                      "user",

                    content:
                      message,
                  },
                ],
              }),
          }
        );

      const body =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          body?.error
            ?.message ||
            "Groq request failed."
        );
      }

      let output =
        body?.choices?.[0]
          ?.message
          ?.content;

      if (
        !output
      ) {
        throw new Error(
          "Groq returned no response."
        );
      }

      output =
        output
          .replace(
            /^```json/i,
            ""
          )
          .replace(
            /^```/,
            ""
          )
          .replace(
            /```$/,
            ""
          )
          .trim();

      const parsed =
        JSON.parse(
          output
        );

      // -----------------------------------------------
      // CHAT
      // -----------------------------------------------

      if (
        parsed.action ===
        "CHAT"
      ) {
        return {
          action:
            "CHAT",

          intent:
            sanitizeIntent(
              currentIntent
            ),

          selection:
            null,

          recommendationBasis:
            null,

          reply:
            String(
              parsed.reply ||
                "I'm with you 😄 What are you in the mood to watch?"
            )
              .trim()
              .slice(
                0,
                300
              ),

          aiUsed:
            true,
        };
      }

      // -----------------------------------------------
      // RESET
      // -----------------------------------------------

      if (
        parsed.action ===
        "RESET"
      ) {
        return {
          action:
            "SEARCH",

          intent:
            emptyIntent(),

          selection:
            null,

          recommendationBasis:
            null,

          aiUsed:
            true,
        };
      }

      // -----------------------------------------------
      // RECOMMEND
      // -----------------------------------------------

      if (
        parsed.action ===
        "RECOMMEND"
      ) {
        return {
          action:
            "RECOMMEND",

          intent:
            sanitizeIntent(
              currentIntent
            ),

          selection:
            null,

          recommendationBasis:
            parsed.recommendationBasis ||
            "overall",

          aiUsed:
            true,
        };
      }

      // -----------------------------------------------
      // SELECT
      // -----------------------------------------------

      if (
        parsed.action ===
        "SELECT_SHOW"
      ) {
        return {
          action:
            "SELECT_SHOW",

          intent:
            sanitizeIntent(
              currentIntent
            ),

          selection: {
            resultIndex:
              Number(
                parsed.resultIndex
              ) ||
              null,

            requestedTime:
              typeof parsed.requestedTime ===
              "string"
                ? parsed.requestedTime
                : null,
          },

          recommendationBasis:
            null,

          aiUsed:
            true,
        };
      }

      // -----------------------------------------------
      // SEARCH / REFINE
      // -----------------------------------------------

      let nextIntent =
        sanitizeIntent(
          currentIntent
        );

      const updates =
        parsed.updates ||
        {};

      Object.entries(
        updates
      ).forEach(
        ([
          key,
          value,
        ]) => {
          if (
            !INTENT_FIELDS.has(
              key
            ) ||
            value ===
              null ||
            value ===
              undefined
          ) {
            return;
          }

          nextIntent[
            key
          ] =
            value;

          if (
            key ===
            "dateIntent"
          ) {
            nextIntent.date =
              null;
          }

          if (
            key ===
            "date"
          ) {
            nextIntent.dateIntent =
              null;
          }
        }
      );

      const fieldsToClear =
        Array.isArray(
          parsed.fieldsToClear
        )
          ? parsed.fieldsToClear
          : [];

      fieldsToClear.forEach(
        (field) => {
          clearIntentField(
            nextIntent,
            field
          );
        }
      );

      // Extra deterministic mood detection so even if
      // the model misses "sad", "funny", etc., the app
      // still behaves naturally.
      nextIntent =
        applyMoodToIntent(
          message,
          nextIntent
        );

      return {
        action:
          "SEARCH",

        intent:
          sanitizeIntent(
            nextIntent
          ),

        selection:
          null,

        recommendationBasis:
          null,

        aiUsed:
          true,
      };
    } catch (
      error
    ) {
      console.error(
        "Groq parsing fallback:",
        error.message
      );

      return {
        ...fallbackParse(
          message,
          currentIntent
        ),

        aiUsed:
          false,
      };
    }
  };

// =====================================================
// CINEMA
// =====================================================

const getCinema = async (
  theatreId
) => {
  const id =
    String(
      theatreId ||
      ""
    ).trim();

  if (
    !mongoose.Types.ObjectId.isValid(
      id
    )
  ) {
    const error =
      new Error(
        "Choose a cinema before using the booking assistant."
      );

    error.statusCode =
      400;

    throw error;
  }

  const cinema =
    await Theatre.findOne({
      _id:
        id,

      isActive:
        true,
    })
      .select(
        "_id name city address"
      )
      .lean();

  if (
    !cinema
  ) {
    const error =
      new Error(
        "That cinema isn't available right now. Choose another one and I'll continue from there."
      );

    error.statusCode =
      404;

    throw error;
  }

  return cinema;
};

// =====================================================
// SERIALIZE SHOW
// =====================================================

const serializeShow = (
  show,
  extras = {}
) => ({
  showId:
    String(
      show._id
    ),

  startTime:
    show.startTime,

  endTime:
    show.endTime,

  language:
    show.language,

  format:
    show.format,

  minPrice:
    getMinPrice(
      show
    ),

  pricing:
    show.pricing ||
    [],

  showCount:
    extras.showCount ||
    1,

  movie: {
    id:
      String(
        show.movie
          ?._id ||
          ""
      ),

    title:
      show.movie
        ?.title,

    poster:
      show.movie
        ?.poster,

    genre:
      show.movie
        ?.genre,

    duration:
      show.movie
        ?.duration,

    rating:
      show.movie
        ?.rating,

    avgRating:
      Number(
        show.movie
          ?.avgRating ||
        0
      ),
  },

  theatre: {
    id:
      String(
        show.theatre
          ?._id ||
          ""
      ),

    name:
      show.theatre
        ?.name,

    city:
      show.theatre
        ?.city,
  },

  screen: {
    id:
      String(
        show.screen
          ?._id ||
          ""
      ),

    name:
      show.screen
        ?.name,

    screenNumber:
      show.screen
        ?.screenNumber,

    format:
      show.screen
        ?.format,

    audio:
      show.screen
        ?.audio,
  },
});

// =====================================================
// QUERY BASE
// =====================================================

const buildBookableFilter = (
  theatreId
) => {
  const now =
    new Date();

  return {
    theatre:
      theatreId,

    status:
      "SCHEDULED",

    isActive:
      true,

    startTime: {
      $gt:
        now,
    },

    $and: [
      {
        $or: [
          {
            bookingOpensAt:
              null,
          },

          {
            bookingOpensAt: {
              $exists:
                false,
            },
          },

          {
            bookingOpensAt: {
              $lte:
                now,
            },
          },
        ],
      },

      {
        $or: [
          {
            bookingClosesAt:
              null,
          },

          {
            bookingClosesAt: {
              $exists:
                false,
            },
          },

          {
            bookingClosesAt: {
              $gt:
                now,
            },
          },
        ],
      },
    ],
  };
};

// =====================================================
// LOAD REAL INVENTORY
// =====================================================

const loadInventory = async (
  theatreId
) =>
  Show.find(
    buildBookableFilter(
      theatreId
    )
  )
    .populate({
      path:
        "movie",

      match: {
        listingStatus:
          "ACTIVE",
      },

      select:
        "title poster genre duration language rating avgRating listingStatus",
    })
    .populate({
      path:
        "theatre",

      match: {
        isActive:
          true,
      },

      select:
        "name city address isActive",
    })
    .populate({
      path:
        "screen",

      match: {
        isActive:
          true,
      },

      select:
        "name screenNumber format audio totalSeats isActive",
    })
    .sort({
      startTime:
        1,
    })
    .limit(
      500
    )
    .lean();

// =====================================================
// FILTER INVENTORY
// =====================================================

const filterShows = (
  shows,
  intent
) => {
  const desiredDate =
    resolveDate(
      intent
    );

  return shows.filter(
    (show) => {
      if (
        !show.movie ||
        !show.theatre ||
        !show.screen
      ) {
        return false;
      }

      if (
        intent.movieTitle &&
        !cleanText(
          show.movie
            .title
        ).includes(
          cleanText(
            intent.movieTitle
          )
        )
      ) {
        return false;
      }

      if (
        intent.language &&
        !cleanText(
          show.language
        ).includes(
          cleanText(
            intent.language
          )
        )
      ) {
        return false;
      }

      if (
        intent.genre
      ) {
        const genres =
          Array.isArray(
            show.movie
              .genre
          )
            ? show.movie.genre.join(
                " "
              )
            : show.movie
                .genre;

        if (
          !cleanText(
            genres
          ).includes(
            cleanText(
              intent.genre
            )
          )
        ) {
          return false;
        }
      }

      if (
        intent.format &&
        normalizeFormat(
          show.format
        ) !==
          normalizeFormat(
            intent.format
          )
      ) {
        return false;
      }

      if (
        desiredDate &&
        getDateKey(
          show.startTime
        ) !==
          desiredDate
      ) {
        return false;
      }

      if (
        !matchesTimeOfDay(
          show.startTime,
          intent.timeOfDay
        )
      ) {
        return false;
      }

      if (
        intent.maxPrice !==
          null &&
        getMinPrice(
          show
        ) >
          intent.maxPrice
      ) {
        return false;
      }

      return true;
    }
  );
};

// =====================================================
// MOVIE DISCOVERY OR EXACT SHOWS?
//
// Genre searches such as "comedy movies" should return
// unique MOVIES, not the same title repeated for every
// date.
//
// Once the user asks for a date/time, we return SHOWS.
// =====================================================

const isMovieDiscovery = (
  intent
) =>
  !intent.movieTitle &&
  !resolveDate(
    intent
  ) &&
  (
    !intent.timeOfDay ||
    intent.timeOfDay ===
      "any"
  );

// =====================================================
// FORMAT SEARCH RESULTS
// =====================================================

const formatInventoryResults = (
  filtered,
  intent
) => {
  let sorted =
    [
      ...filtered,
    ];

  if (
    intent.sort ===
    "cheapest"
  ) {
    sorted.sort(
      (
        first,
        second
      ) => {
        const priceDifference =
          getMinPrice(
            first
          ) -
          getMinPrice(
            second
          );

        if (
          priceDifference !==
          0
        ) {
          return priceDifference;
        }

        return (
          new Date(
            first.startTime
          ) -
          new Date(
            second.startTime
          )
        );
      }
    );
  } else {
    sorted.sort(
      (
        first,
        second
      ) =>
        new Date(
          first.startTime
        ) -
        new Date(
          second.startTime
        )
    );
  }

  // ---------------------------------------------------
  // UNIQUE MOVIE CARDS
  // ---------------------------------------------------

  if (
    isMovieDiscovery(
      intent
    )
  ) {
    const map =
      new Map();

    sorted.forEach(
      (show) => {
        const movieId =
          String(
            show.movie
              ._id
          );

        if (
          !map.has(
            movieId
          )
        ) {
          map.set(
            movieId,
            {
              show,
              count: 1,
            }
          );
        } else {
          map.get(
            movieId
          ).count +=
            1;
        }
      }
    );

    return {
      resultKind:
        "MOVIES",

      results:
        Array.from(
          map.values()
        )
          .slice(
            0,
            MAX_RESULTS
          )
          .map(
            ({
              show,
              count,
            }) =>
              serializeShow(
                show,
                {
                  showCount:
                    count,
                }
              )
          ),
    };
  }

  // ---------------------------------------------------
  // SPECIFIC SHOWS
  // ---------------------------------------------------

  return {
    resultKind:
      "SHOWS",

    results:
      sorted
        .slice(
          0,
          MAX_RESULTS
        )
        .map(
          (show) =>
            serializeShow(
              show
            )
        ),
  };
};

// =====================================================
// SEARCH INVENTORY
// =====================================================

const searchInventory =
  async ({
    intent,
    theatreId,
  }) => {
    const shows =
      await loadInventory(
        theatreId
      );

    const filtered =
      filterShows(
        shows,
        intent
      );

    return formatInventoryResults(
      filtered,
      intent
    );
  };

// =====================================================
// ALTERNATIVE GENRE SEARCH
// =====================================================

const searchGenreAlternatives =
  async ({
    intent,
    theatreId,
  }) => {
    const requested =
      intent.genre;

    const alternatives =
      GENRE_ALTERNATIVES[
        requested
      ] ||
      [];

    if (
      !alternatives.length
    ) {
      return {
        results: [],
        resultKind:
          "MOVIES",
        genres: [],
      };
    }

    const shows =
      await loadInventory(
        theatreId
      );

    const combined =
      [];

    const genresUsed =
      [];

    for (
      const genre
      of alternatives
    ) {
      const alternativeIntent = {
        ...intent,

        genre,
      };

      const filtered =
        filterShows(
          shows,
          alternativeIntent
        );

      if (
        filtered.length
      ) {
        genresUsed.push(
          genre
        );

        combined.push(
          ...filtered
        );
      }
    }

    if (
      !combined.length
    ) {
      return {
        results: [],
        resultKind:
          "MOVIES",
        genres: [],
      };
    }

    const formatted =
      formatInventoryResults(
        combined,
        {
          ...intent,

          genre:
            null,
        }
      );

    // Remove duplicate movies.
    const seen =
      new Set();

    const results =
      formatted.results
        .filter(
          (result) => {
            const id =
              result.movie
                ?.id;

            if (
              !id ||
              seen.has(
                id
              )
            ) {
              return false;
            }

            seen.add(
              id
            );

            return true;
          }
        )
        .slice(
          0,
          MAX_RESULTS
        );

    return {
      results,

      resultKind:
        "MOVIES",

      genres:
        genresUsed,
    };
  };

// =====================================================
// PREVIOUS RESULTS
// =====================================================

const sanitizePreviousResults = (
  results,
  theatreId
) => {
  if (
    !Array.isArray(
      results
    )
  ) {
    return [];
  }

  return results
    .slice(
      0,
      MAX_RESULTS
    )
    .filter(
      (result) =>
        mongoose.Types.ObjectId.isValid(
          result
            ?.showId
        ) &&
        String(
          result
            ?.theatre
            ?.id ||
            ""
        ) ===
          String(
            theatreId
          )
    )
    .map(
      (result) => ({
        showId:
          String(
            result.showId
          ),

        startTime:
          result.startTime,

        endTime:
          result.endTime,

        language:
          result.language,

        format:
          result.format,

        minPrice:
          Number(
            result.minPrice ||
            0
          ),

        showCount:
          Number(
            result.showCount ||
            1
          ),

        movie: {
          id:
            String(
              result.movie
                ?.id ||
                ""
            ),

          title:
            result.movie
              ?.title ||
            "",

          genre:
            result.movie
              ?.genre ||
            "",

          avgRating:
            Number(
              result.movie
                ?.avgRating ||
              0
            ),
        },

        theatre: {
          id:
            String(
              result.theatre
                ?.id ||
                ""
            ),

          name:
            result.theatre
              ?.name ||
            "",

          city:
            result.theatre
              ?.city ||
            "",
        },
      }))
    .filter(
      (result) =>
        result.movie.id
    );
};

// =====================================================
// SELECT RESULT
// =====================================================

const selectResult = (
  results,
  selection
) => {
  if (
    !Array.isArray(
      results
    ) ||
    !results.length
  ) {
    return null;
  }

  if (
    selection
      ?.resultIndex
  ) {
    const index =
      Number(
        selection
          .resultIndex
      ) - 1;

    if (
      Number.isInteger(
        index
      ) &&
      index >= 0 &&
      results[
        index
      ]
    ) {
      return results[
        index
      ];
    }
  }

  if (
    selection
      ?.requestedTime
  ) {
    const [
      targetHour,
      targetMinute,
    ] =
      String(
        selection
          .requestedTime
      )
        .split(":")
        .map(Number);

    if (
      Number.isFinite(
        targetHour
      )
    ) {
      return (
        results.find(
          (result) => {
            const {
              hour,
              minute,
            } =
              getTimeParts(
                result
                  .startTime
              );

            return (
              hour ===
                targetHour &&
              (
                !Number.isFinite(
                  targetMinute
                ) ||
                minute ===
                  targetMinute
              )
            );
          }
        ) ||
        null
      );
    }
  }

  return null;
};

// =====================================================
// CANONICAL SHOW
// =====================================================

const getCanonicalShow =
  async ({
    showId,
    theatreId,
  }) => {
    if (
      !mongoose.Types.ObjectId.isValid(
        showId
      )
    ) {
      return null;
    }

    const show =
      await Show.findOne({
        ...buildBookableFilter(
          theatreId
        ),

        _id:
          showId,
      })
        .populate({
          path:
            "movie",

          match: {
            listingStatus:
              "ACTIVE",
          },

          select:
            "title poster genre duration language rating avgRating listingStatus",
        })
        .populate({
          path:
            "theatre",

          match: {
            isActive:
              true,
          },

          select:
            "name city address isActive",
        })
        .populate({
          path:
            "screen",

          match: {
            isActive:
              true,
          },

          select:
            "name screenNumber format audio totalSeats isActive",
        })
        .lean();

    if (
      !show?.movie ||
      !show?.theatre ||
      !show?.screen
    ) {
      return null;
    }

    return serializeShow(
      show
    );
  };

// =====================================================
// UNIQUE MOVIES
// =====================================================

const uniqueMovies = (
  results
) => {
  const seen =
    new Set();

  return results.filter(
    (result) => {
      const id =
        result.movie
          ?.id;

      if (
        !id ||
        seen.has(
          id
        )
      ) {
        return false;
      }

      seen.add(
        id
      );

      return true;
    }
  );
};

// =====================================================
// RECOMMEND FROM EXISTING RESULTS
// =====================================================

const buildRecommendationReply = ({
  results,
  basis,
}) => {
  const movies =
    uniqueMovies(
      results
    );

  if (
    !movies.length
  ) {
    return "I don't have a current movie list to compare yet 😅 Ask me for some movies first, then I can help you pick one.";
  }

  // ---------------------------------------------------
  // REVIEWS
  // ---------------------------------------------------

  if (
    basis ===
    "reviews"
  ) {
    const rated =
      movies
        .filter(
          (item) =>
            Number(
              item.movie
                ?.avgRating
            ) > 0
        )
        .sort(
          (
            first,
            second
          ) =>
            Number(
              second.movie
                ?.avgRating
            ) -
            Number(
              first.movie
                ?.avgRating
            )
        );

    if (
      rated.length
    ) {
      const top =
        rated[0];

      return `I don't have actual audience review text or review counts yet, so I can't honestly rank these “according to reviews” 😅 Based on the rating stored in BookMySeat though, ${top.movie.title} is highest at ${top.movie.avgRating}/5.`;
    }

    return "I don't have audience review data for these movies yet, so I'd be making it up if I ranked them by reviews 😅 I can compare them by price, showtime, genre or stored rating instead.";
  }

  // ---------------------------------------------------
  // FUNNIEST
  // ---------------------------------------------------

  if (
    basis ===
    "funniest"
  ) {
    const comedy =
      movies.filter(
        (item) =>
          cleanText(
            item.movie
              ?.genre
          ).includes(
            "comedy"
          )
      );

    if (
      !comedy.length
    ) {
      return "None of these are actually tagged as Comedy, so I wouldn't call one the funniest just to make something up 😭 Want me to search proper comedy movies instead?";
    }

    const ratedComedy =
      comedy
        .filter(
          (item) =>
            Number(
              item.movie
                ?.avgRating
            ) > 0
        )
        .sort(
          (
            first,
            second
          ) =>
            Number(
              second.movie
                ?.avgRating
            ) -
            Number(
              first.movie
                ?.avgRating
            )
        );

    if (
      ratedComedy.length
    ) {
      const top =
        ratedComedy[0];

      return `I can't measure “funniest” objectively 😭 but among the comedy options, ${top.movie.title} is probably the safest pick from the data I have — it's rated ${top.movie.avgRating}/5 in BookMySeat.`;
    }

    return `I've got ${comedy.length} comedy option${comedy.length === 1 ? "" : "s"}, but I don't have a comedy score or review data to honestly say which is funniest 😅 Pick one by rating, price or showtime and I can narrow it down.`;
  }

  // ---------------------------------------------------
  // CHEAPEST
  // ---------------------------------------------------

  if (
    basis ===
    "cheapest"
  ) {
    const cheapest =
      [...movies].sort(
        (
          first,
          second
        ) =>
          Number(
            first.minPrice
          ) -
          Number(
            second.minPrice
          )
      )[0];

    return `${cheapest.movie.title} is the cheapest option here — tickets start from ₹${cheapest.minPrice} 👍`;
  }

  // ---------------------------------------------------
  // EARLIEST
  // ---------------------------------------------------

  if (
    basis ===
    "earliest"
  ) {
    const earliest =
      [...results].sort(
        (
          first,
          second
        ) =>
          new Date(
            first.startTime
          ) -
          new Date(
            second.startTime
          )
      )[0];

    return `${earliest.movie.title} has the earliest available show from this list. If you want, just say “book it” or select it below.`;
  }

  // ---------------------------------------------------
  // RATING / OVERALL
  // ---------------------------------------------------

  const rated =
    movies
      .filter(
        (item) =>
          Number(
            item.movie
              ?.avgRating
          ) > 0
      )
      .sort(
        (
          first,
          second
        ) =>
          Number(
            second.movie
              ?.avgRating
          ) -
          Number(
            first.movie
              ?.avgRating
          )
      );

  if (
    rated.length
  ) {
    const top =
      rated[0];

    const tied =
      rated.filter(
        (item) =>
          Number(
            item.movie
              ?.avgRating
          ) ===
          Number(
            top.movie
              ?.avgRating
          )
      );

    if (
      tied.length ===
      1
    ) {
      return `I'd go with ${top.movie.title} 👀 It's the highest-rated option in this list at ${top.movie.avgRating}/5.`;
    }

    return `${top.movie.title} is one of the highest-rated choices here at ${top.movie.avgRating}/5. A few are tied though, so genre or showtime would be the better tiebreaker.`;
  }

  return "I can't honestly call one objectively “best” from the data I have 😅 There isn't enough rating information. I can still pick the cheapest, earliest, or the one that best matches your mood.";
};

// =====================================================
// FRIENDLY SEARCH RESPONSE - FALLBACK
// =====================================================

const fallbackSearchReply = ({
  message,
  cinema,
  intent,
  results,
  alternativeGenres = [],
}) => {
  const q =
    cleanText(
      message
    );

  if (
    !results.length
  ) {
    if (
      intent.genre
    ) {
      return `Looks like ${cinema.name} doesn't have any ${intent.genre} movies scheduled right now 😕 Want me to try another genre?`;
    }

    if (
      intent.language
    ) {
      return `No ${intent.language} shows matched that one 😕 We can loosen the filters or try another language.`;
    }

    return "Hmm, nothing matched that combination 😕 Try loosening the time, price or language and I'll check again.";
  }

  if (
    alternativeGenres
      .length
  ) {
    return `No ${intent.genre} movies are playing right now 😭 but I found a few ${alternativeGenres.join(
      " / "
    )} options that are probably the closest vibe.`;
  }

  if (
    intent.genre ===
    "Comedy" ||
    q.includes(
      "funny"
    )
  ) {
    return `Yep 😄 Comedy is available. I found ${results.length} option${results.length === 1 ? "" : "s"} worth checking out.`;
  }

  if (
    intent.genre ===
    "Drama" &&
    (
      q.includes(
        "sad"
      ) ||
      q.includes(
        "emotional"
      )
    )
  ) {
    return `If you're in an emotional-movie mood 🥲, I've got a few Drama options for you.`;
  }

  if (
    intent.genre ===
    "Horror"
  ) {
    return `Found some Horror options 👀 Pick whichever one looks like the right amount of bad decisions for tonight.`;
  }

  return `Found a few solid options 😄 Have a look at these.`;
};

// =====================================================
// GROUNDED FRIENDLY RESPONSE
//
// This is the missing step in the old architecture.
//
// Groq sees ONLY the real MongoDB results and turns
// them into a natural short answer.
//
// It cannot add movies that aren't present.
// =====================================================

const generateSearchReply =
  async ({
    message,
    cinema,
    intent,
    results,
    alternativeGenres = [],
  }) => {
    const fallback =
      fallbackSearchReply({
        message,
        cinema,
        intent,
        results,
        alternativeGenres,
      });

    if (
      !process.env
        .GROQ_API_KEY
    ) {
      return fallback;
    }

    const facts =
      results
        .slice(
          0,
          MAX_RESULTS
        )
        .map(
          (
            result,
            index
          ) => ({
            number:
              index + 1,

            title:
              result.movie
                ?.title,

            genre:
              result.movie
                ?.genre,

            rating:
              result.movie
                ?.avgRating,

            language:
              result.language,

            format:
              result.format,

            price:
              result.minPrice,

            startTime:
              result.startTime,
          })
        );

    try {
      const response =
        await fetch(
          "https://api.groq.com/openai/v1/chat/completions",

          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${process.env.GROQ_API_KEY}`,
            },

            body:
              JSON.stringify({
                model:
                  process.env
                    .GROQ_MODEL ||
                  "openai/gpt-oss-20b",

                temperature:
                  0.5,

                messages: [
                  {
                    role:
                      "system",

                    content: `
You are BookMySeat's friendly movie buddy.

Write a SHORT natural response to the user after a real database search.

Tone:
- casual
- friendly
- human
- slightly playful
- not corporate
- not robotic
- usually 1 to 3 sentences
- at most one emoji unless it genuinely fits

IMPORTANT:
- ONLY use the database facts supplied below.
- Never invent movies.
- Never invent ratings.
- Never invent reviews.
- Never invent popularity.
- Never invent showtimes.
- Never invent prices.
- Do NOT say "I found 8 matching shows" like an API.
- The result cards are displayed directly below your message, so don't list every result.
- You may casually mention 1 or 2 real titles if helpful.
- If there are zero results, respond naturally and suggest what the user could change.
- If alternatives are supplied, CLEARLY say the requested genre was unavailable and the cards are alternatives.
- BookMySeat does NOT currently store real audience review text/counts.

Cinema:
${cinema.name}

Search intent:
${JSON.stringify(
  intent
)}

Alternative genres:
${JSON.stringify(
  alternativeGenres
)}

REAL database results:
${JSON.stringify(
  facts
)}
`,
                  },

                  {
                    role:
                      "user",

                    content:
                      message,
                  },
                ],
              }),
          }
        );

      const body =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          body?.error
            ?.message ||
            "Groq reply failed."
        );
      }

      const reply =
        body?.choices?.[0]
          ?.message
          ?.content
          ?.trim();

      if (
        !reply
      ) {
        return fallback;
      }

      return reply.slice(
        0,
        450
      );
    } catch (
      error
    ) {
      console.error(
        "Friendly AI reply:",
        error.message
      );

      return fallback;
    }
  };

// =====================================================
// POST /api/ai/assistant
// =====================================================

router.post(
  "/assistant",

  async (
    req,
    res
  ) => {
    try {
      const message =
        String(
          req.body
            ?.message ||
          ""
        ).trim();

      if (
        !message
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Message is required.",
          });
      }

      if (
        message.length >
        300
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Message is too long.",
          });
      }

      // -----------------------------------------------
      // CINEMA
      // -----------------------------------------------

      const cinema =
        await getCinema(
          req.body
            ?.theatreId
        );

      const theatreId =
        String(
          cinema._id
        );

      // -----------------------------------------------
      // CURRENT CONTEXT
      // -----------------------------------------------

      const currentIntent =
        sanitizeIntent(
          req.body
            ?.intent ||
          {}
        );

      const previousResults =
        sanitizePreviousResults(
          req.body
            ?.results,
          theatreId
        );

      // -----------------------------------------------
      // QUICK CHAT
      // -----------------------------------------------

      const directReply =
        directConversationReply(
          message,
          cinema
        );

      if (
        directReply
      ) {
        return res.json({
          success:
            true,

          aiUsed:
            false,

          action:
            "CHAT",

          intent:
            currentIntent,

          cinema: {
            id:
              theatreId,

            name:
              cinema.name,

            city:
              cinema.city,
          },

          results:
            previousResults,

          message:
            directReply,
        });
      }

      // -----------------------------------------------
      // UNDERSTAND USER
      // -----------------------------------------------

      const parsed =
        await parseConversation({
          message,

          currentIntent,

          results:
            previousResults,

          cinema,
        });

      // ===============================================
      // CHAT
      // ===============================================

      if (
        parsed.action ===
        "CHAT"
      ) {
        return res.json({
          success:
            true,

          aiUsed:
            parsed.aiUsed,

          action:
            "CHAT",

          intent:
            parsed.intent,

          cinema: {
            id:
              theatreId,

            name:
              cinema.name,

            city:
              cinema.city,
          },

          results:
            previousResults,

          message:
            parsed.reply ||
            "I'm with you 😄 What are you feeling like watching?",
        });
      }

      // ===============================================
      // RECOMMEND / COMPARE CURRENT RESULTS
      // ===============================================

      if (
        parsed.action ===
        "RECOMMEND"
      ) {
        const reply =
          buildRecommendationReply({
            results:
              previousResults,

            basis:
              parsed.recommendationBasis ||
              "overall",
          });

        return res.json({
          success:
            true,

          aiUsed:
            parsed.aiUsed,

          action:
            "RECOMMEND",

          intent:
            currentIntent,

          cinema: {
            id:
              theatreId,

            name:
              cinema.name,

            city:
              cinema.city,
          },

          results:
            previousResults,

          message:
            reply,
        });
      }

      // ===============================================
      // SELECT RESULT
      // ===============================================

      if (
        parsed.action ===
        "SELECT_SHOW"
      ) {
        const candidate =
          selectResult(
            previousResults,
            parsed.selection
          );

        if (
          !candidate
        ) {
          return res.json({
            success:
              true,

            aiUsed:
              parsed.aiUsed,

            action:
              "CHAT",

            intent:
              currentIntent,

            results:
              previousResults,

            message:
              "I lost track of which one you meant 😅 Try saying something like “book the second one”.",
          });
        }

        const selectedShow =
          await getCanonicalShow({
            showId:
              candidate
                .showId,

            theatreId,
          });

        if (
          !selectedShow
        ) {
          return res.json({
            success:
              true,

            aiUsed:
              parsed.aiUsed,

            action:
              "CHAT",

            intent:
              currentIntent,

            results: [],

            message:
              "Ah, that show isn't available anymore 😕 Search again and I'll grab the latest schedule.",
          });
        }

        return res.json({
          success:
            true,

          aiUsed:
            parsed.aiUsed,

          action:
            "SELECT_SHOW",

          intent:
            currentIntent,

          cinema: {
            id:
              theatreId,

            name:
              cinema.name,

            city:
              cinema.city,
          },

          selectedShow,

          message:
            `Good pick 😄 Opening seats for ${selectedShow.movie.title}.`,
        });
      }

      // ===============================================
      // SEARCH
      // ===============================================

      const search =
        await searchInventory({
          intent:
            parsed.intent,

          theatreId,
        });

      let finalResults =
        search.results;

      let resultKind =
        search.resultKind;

      let alternativeGenres =
        [];

      // -------------------------------------------------
      // FRIENDLY ALTERNATIVES
      //
      // Example:
      // Horror unavailable → offer Thriller/Mystery.
      // -------------------------------------------------

      if (
        !finalResults.length &&
        parsed.intent
          ?.genre &&
        GENRE_ALTERNATIVES[
          parsed.intent.genre
        ]
      ) {
        const alternatives =
          await searchGenreAlternatives({
            intent:
              parsed.intent,

            theatreId,
          });

        if (
          alternatives
            .results
            .length
        ) {
          finalResults =
            alternatives.results;

          resultKind =
            alternatives.resultKind;

          alternativeGenres =
            alternatives.genres;
        }
      }

      // -------------------------------------------------
      // NATURAL GROUNDED RESPONSE
      // -------------------------------------------------

      const responseMessage =
        await generateSearchReply({
          message,

          cinema,

          intent:
            parsed.intent,

          results:
            finalResults,

          alternativeGenres,
        });

      return res.json({
        success:
          true,

        aiUsed:
          parsed.aiUsed,

        action:
          "SEARCH",

        intent:
          parsed.intent,

        resolvedDate:
          resolveDate(
            parsed.intent
          ),

        resultKind,

        alternatives:
          alternativeGenres,

        cinema: {
          id:
            theatreId,

          name:
            cinema.name,

          city:
            cinema.city,
        },

        count:
          finalResults.length,

        message:
          responseMessage,

        results:
          finalResults,
      });
    } catch (
      error
    ) {
      console.error(
        "AI assistant:",
        error
      );

      return res
        .status(
          error.statusCode ||
          500
        )
        .json({
          success:
            false,

          message:
            error.statusCode
              ? error.message
              : "Something went wrong while I was checking the cinema schedule.",
        });
    }
  }
);

// =====================================================
// LEGACY /api/ai/search
// =====================================================

router.post(
  "/search",

  async (
    req,
    res
  ) => {
    try {
      const message =
        String(
          req.body
            ?.query ||
          ""
        ).trim();

      if (
        !message
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Query is required.",
          });
      }

      const cinema =
        await getCinema(
          req.body
            ?.theatreId
        );

      const theatreId =
        String(
          cinema._id
        );

      const parsed =
        await parseConversation({
          message,

          currentIntent:
            emptyIntent(),

          results:
            [],

          cinema,
        });

      if (
        parsed.action ===
        "CHAT"
      ) {
        return res.json({
          success:
            true,

          action:
            "CHAT",

          count:
            0,

          results:
            [],

          message:
            parsed.reply,
        });
      }

      const search =
        await searchInventory({
          intent:
            parsed.intent,

          theatreId,
        });

      const reply =
        await generateSearchReply({
          message,

          cinema,

          intent:
            parsed.intent,

          results:
            search.results,
        });

      return res.json({
        success:
          true,

        aiUsed:
          parsed.aiUsed,

        intent:
          parsed.intent,

        resultKind:
          search.resultKind,

        count:
          search.results
            .length,

        message:
          reply,

        results:
          search.results,
      });
    } catch (
      error
    ) {
      console.error(
        "AI search:",
        error
      );

      return res
        .status(
          error.statusCode ||
          500
        )
        .json({
          success:
            false,

          message:
            error.statusCode
              ? error.message
              : "I couldn't check the movie schedule right now.",
        });
    }
  }
);

module.exports =
  router;