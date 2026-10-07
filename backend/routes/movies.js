const express =
  require("express");

const mongoose =
  require("mongoose");

const Movie =
  require("../models/Movie");

const User =
  require("../models/User");

const {
  auth,
  adminAuth,
} =
  require("../middleware/auth");

const router =
  express.Router();

// =====================================================
// CONSTANTS
// =====================================================

const MOVIE_STATUSES =
  new Set([
    "ACTIVE",
    "COMING_SOON",
    "HIDDEN",
  ]);

const EDITABLE_FIELDS = [
  "title",
  "description",
  "genre",
  "duration",
  "language",
  "rating",
  "poster",
  "banner",
  "trailer",
  "cast",
  "director",
  "producer",
  "releaseYear",
  "releaseDate",
  "avgRating",
  "listingStatus",
];

// =====================================================
// HELPERS
// =====================================================

const escapeRegex = (
  value
) =>
  String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

const buildMoviePayload =
  (
    body = {}
  ) => {
    const payload = {};

    EDITABLE_FIELDS.forEach(
      (field) => {
        if (
          Object.prototype.hasOwnProperty.call(
            body,
            field
          )
        ) {
          payload[field] =
            body[field];
        }
      }
    );

    // -----------------------------------------------
    // STRINGS
    // -----------------------------------------------

    [
      "title",
      "description",
      "genre",
      "duration",
      "language",
      "rating",
      "poster",
      "banner",
      "trailer",
      "director",
      "producer",
    ].forEach(
      (field) => {
        if (
          typeof payload[
            field
          ] === "string"
        ) {
          payload[field] =
            payload[field].trim();
        }
      }
    );

    // -----------------------------------------------
    // NUMBERS
    // -----------------------------------------------

    if (
      payload.releaseYear !==
        undefined &&
      payload.releaseYear !==
        ""
    ) {
      payload.releaseYear =
        Number(
          payload.releaseYear
        );
    }

    if (
      payload.avgRating !==
        undefined &&
      payload.avgRating !==
        ""
    ) {
      payload.avgRating =
        Number(
          payload.avgRating
        );
    }

    // -----------------------------------------------
    // RELEASE DATE
    // -----------------------------------------------

    if (
      payload.releaseDate ===
      ""
    ) {
      payload.releaseDate =
        null;
    }

    // -----------------------------------------------
    // STATUS
    // -----------------------------------------------

    if (
      payload.listingStatus
    ) {
      payload.listingStatus =
        String(
          payload.listingStatus
        ).toUpperCase();
    }

    return payload;
  };

const validatePayload =
  (
    payload,
    {
      creating = false,
    } = {}
  ) => {
    if (creating) {
      const required = [
        "title",
        "description",
        "genre",
        "duration",
        "poster",
      ];

      const missing =
        required.filter(
          (field) =>
            !String(
              payload[field] ||
                ""
            ).trim()
        );

      if (
        missing.length
      ) {
        return `${missing.join(
          ", "
        )} ${
          missing.length ===
          1
            ? "is"
            : "are"
        } required.`;
      }
    }

    if (
      payload.listingStatus &&
      !MOVIE_STATUSES.has(
        payload.listingStatus
      )
    ) {
      return "Invalid movie listing status.";
    }

    if (
      payload.releaseYear !==
        undefined &&
      (
        !Number.isInteger(
          payload.releaseYear
        ) ||
        payload.releaseYear <
          1888 ||
        payload.releaseYear >
          2100
      )
    ) {
      return "Release year is invalid.";
    }

    if (
      payload.avgRating !==
        undefined &&
      (
        !Number.isFinite(
          payload.avgRating
        ) ||
        payload.avgRating <
          0 ||
        payload.avgRating >
          5
      )
    ) {
      return "Average rating must be between 0 and 5.";
    }

    if (
      payload.cast !==
        undefined &&
      !Array.isArray(
        payload.cast
      )
    ) {
      return "Cast must be an array.";
    }

    return null;
  };

// =====================================================
// GET /api/movies
//
// PUBLIC MOVIE CATALOGUE
//
// HIDDEN movies never appear here.
// =====================================================

router.get(
  "/",

  async (
    req,
    res
  ) => {
    try {
      const {
        status,
        search,
      } =
        req.query;

      const filter = {
        listingStatus: {
          $ne:
            "HIDDEN",
        },
      };

      // Existing legacy movies may not yet have
      // listingStatus stored in MongoDB.
      //
      // $ne HIDDEN includes those records safely.

      if (status) {
        const normalizedStatus =
          String(
            status
          ).toUpperCase();

        if (
          ![
            "ACTIVE",
            "COMING_SOON",
          ].includes(
            normalizedStatus
          )
        ) {
          return res
            .status(400)
            .json({
              error:
                "Invalid movie status.",
            });
        }

        filter.listingStatus =
          normalizedStatus;
      }

      if (
        search?.trim()
      ) {
        const expression =
          new RegExp(
            escapeRegex(
              search.trim()
            ),
            "i"
          );

        filter.$or = [
          {
            title:
              expression,
          },

          {
            genre:
              expression,
          },

          {
            language:
              expression,
          },

          {
            director:
              expression,
          },
        ];
      }

      const movies =
        await Movie.find(
          filter
        ).sort({
          releaseDate: -1,
          createdAt: -1,
        });

      return res.json({
        success: true,

        count:
          movies.length,

        movies,
      });
    } catch (error) {
      console.error(
        "Get movies:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to fetch movies.",
        });
    }
  }
);

// =====================================================
// GET /api/movies/admin/all
//
// ADMIN ONLY.
//
// Includes ACTIVE, COMING_SOON and HIDDEN.
// =====================================================

router.get(
  "/admin/all",

  auth,
  adminAuth,

  async (
    req,
    res
  ) => {
    try {
      const movies =
        await Movie.find(
          {}
        ).sort({
          createdAt: -1,
        });

      return res.json({
        success: true,

        count:
          movies.length,

        movies,
      });
    } catch (error) {
      console.error(
        "Admin movies:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to fetch movies.",
        });
    }
  }
);

// =====================================================
// GET USER FAVORITES
//
// MUST STAY BEFORE /:id
// =====================================================

router.get(
  "/favorites/list",

  auth,

  async (
    req,
    res
  ) => {
    try {
      const user =
        await User.findById(
          req.userId
        ).populate({
          path:
            "favorites",

          match: {
            listingStatus: {
              $ne:
                "HIDDEN",
            },
          },
        });

      if (!user) {
        return res
          .status(404)
          .json({
            error:
              "User not found.",
          });
      }

      return res.json({
        favorites:
          user.favorites ||
          [],
      });
    } catch (error) {
      console.error(
        "Favorites:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to fetch favorites.",
        });
    }
  }
);

// =====================================================
// POST /api/movies
//
// ADMIN CREATE
// =====================================================

router.post(
  "/",

  auth,
  adminAuth,

  async (
    req,
    res
  ) => {
    try {
      const payload =
        buildMoviePayload(
          req.body
        );

      const validationError =
        validatePayload(
          payload,
          {
            creating: true,
          }
        );

      if (
        validationError
      ) {
        return res
          .status(400)
          .json({
            error:
              validationError,
          });
      }

      const existing =
        await Movie.findOne({
          title: {
            $regex:
              `^${escapeRegex(
                payload.title
              )}$`,

            $options:
              "i",
          },
        });

      if (existing) {
        return res
          .status(409)
          .json({
            error:
              "A movie with this title already exists.",
          });
      }

      const movie =
        await Movie.create(
          payload
        );

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Movie created.",

          movie,
        });
    } catch (error) {
      console.error(
        "Create movie:",
        error
      );

      if (
        error.name ===
        "ValidationError"
      ) {
        return res
          .status(400)
          .json({
            error:
              error.message,
          });
      }

      return res
        .status(500)
        .json({
          error:
            "Failed to create movie.",
        });
    }
  }
);

// =====================================================
// PUT /api/movies/:id
//
// ADMIN UPDATE
// =====================================================

router.put(
  "/:id",

  auth,
  adminAuth,

  async (
    req,
    res
  ) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid movie ID.",
          });
      }

      const payload =
        buildMoviePayload(
          req.body
        );

      const validationError =
        validatePayload(
          payload
        );

      if (
        validationError
      ) {
        return res
          .status(400)
          .json({
            error:
              validationError,
          });
      }

      if (
        payload.title
      ) {
        const duplicate =
          await Movie.findOne({
            _id: {
              $ne:
                req.params.id,
            },

            title: {
              $regex:
                `^${escapeRegex(
                  payload.title
                )}$`,

              $options:
                "i",
            },
          });

        if (duplicate) {
          return res
            .status(409)
            .json({
              error:
                "A movie with this title already exists.",
            });
        }
      }

      const movie =
        await Movie.findByIdAndUpdate(
          req.params.id,

          {
            $set:
              payload,
          },

          {
            new: true,
            runValidators: true,
          }
        );

      if (!movie) {
        return res
          .status(404)
          .json({
            error:
              "Movie not found.",
          });
      }

      return res.json({
        success: true,

        message:
          "Movie updated.",

        movie,
      });
    } catch (error) {
      console.error(
        "Update movie:",
        error
      );

      if (
        error.name ===
        "ValidationError"
      ) {
        return res
          .status(400)
          .json({
            error:
              error.message,
          });
      }

      return res
        .status(500)
        .json({
          error:
            "Failed to update movie.",
        });
    }
  }
);

// =====================================================
// DELETE /api/movies/:id
//
// SOFT DELETE.
//
// Movies can be referenced by shows/bookings,
// so physically deleting them is unsafe.
// =====================================================

router.delete(
  "/:id",

  auth,
  adminAuth,

  async (
    req,
    res
  ) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid movie ID.",
          });
      }

      const movie =
        await Movie.findByIdAndUpdate(
          req.params.id,

          {
            $set: {
              listingStatus:
                "HIDDEN",
            },
          },

          {
            new: true,
            runValidators: true,
          }
        );

      if (!movie) {
        return res
          .status(404)
          .json({
            error:
              "Movie not found.",
          });
      }

      return res.json({
        success: true,

        message:
          "Movie hidden from public listings.",

        movie,
      });
    } catch (error) {
      console.error(
        "Hide movie:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to hide movie.",
        });
    }
  }
);

// =====================================================
// GET SINGLE MOVIE
//
// HIDDEN movies are not publicly accessible.
// =====================================================

router.get(
  "/:id",

  async (
    req,
    res
  ) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid movie ID.",
          });
      }

      const movie =
        await Movie.findOne({
          _id:
            req.params.id,

          listingStatus: {
            $ne:
              "HIDDEN",
          },
        });

      if (!movie) {
        return res
          .status(404)
          .json({
            error:
              "Movie not found.",
          });
      }

      return res.json({
        movie,
      });
    } catch (error) {
      console.error(
        "Get movie:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to fetch movie.",
        });
    }
  }
);

// =====================================================
// TOGGLE FAVORITE
// =====================================================

router.post(
  "/:id/favorite",

  auth,

  async (
    req,
    res
  ) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid movie ID.",
          });
      }

      const movie =
        await Movie.findOne({
          _id:
            req.params.id,

          listingStatus: {
            $ne:
              "HIDDEN",
          },
        });

      if (!movie) {
        return res
          .status(404)
          .json({
            error:
              "Movie not found.",
          });
      }

      const user =
        await User.findById(
          req.userId
        );

      if (!user) {
        return res
          .status(404)
          .json({
            error:
              "User not found.",
          });
      }

      const movieId =
        req.params.id;

      const isFavorite =
        user.favorites.some(
          (id) =>
            id.toString() ===
            movieId
        );

      if (isFavorite) {
        user.favorites =
          user.favorites.filter(
            (id) =>
              id.toString() !==
              movieId
          );
      } else {
        user.favorites.push(
          movieId
        );
      }

      await user.save();

      return res.json({
        message:
          isFavorite
            ? "Removed from favorites"
            : "Added to favorites",

        isFavorite:
          !isFavorite,
      });
    } catch (error) {
      console.error(
        "Favorite movie:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to update favorites.",
        });
    }
  }
);

module.exports =
  router;