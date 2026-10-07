require("dotenv").config();

const mongoose =
  require("mongoose");

// =====================================================
// MIGRATE MOVIE LIFECYCLE
// =====================================================

const run =
  async () => {
    try {
      const mongoUrl =
        process.env.MONGO_URL;

      const dbName =
        process.env.DB_NAME;

      if (
        !mongoUrl ||
        !dbName
      ) {
        throw new Error(
          "MONGO_URL or DB_NAME is missing from .env"
        );
      }

      // Must use the exact same database
      // configuration as server.js.
      await mongoose.connect(
        `${mongoUrl.replace(
          /\/$/,
          ""
        )}/${dbName}`
      );

      console.log(
        `✓ Connected to ${mongoose.connection.name}`
      );

      const movies =
        mongoose.connection.collection(
          "movies"
        );

      // -------------------------------------------------
      // Existing movies created before listingStatus
      // should become ACTIVE.
      //
      // Existing COMING_SOON / HIDDEN values are preserved.
      // -------------------------------------------------

      const statusResult =
        await movies.updateMany(
          {
            listingStatus: {
              $exists:
                false,
            },
          },

          {
            $set: {
              listingStatus:
                "ACTIVE",
            },
          }
        );

      // -------------------------------------------------
      // Remove obsolete OTT-style fields.
      // -------------------------------------------------

      const trendingResult =
        await movies.updateMany(
          {},

          {
            $unset: {
              trending: "",
              trendingRank: "",
            },
          }
        );

      console.log(
        `✓ Status migrated: ${statusResult.modifiedCount}`
      );

      console.log(
        `✓ Trending fields removed: ${trendingResult.modifiedCount}`
      );

      console.log(
        "✓ Movie lifecycle migration complete"
      );
    } catch (error) {
      console.error(
        "Migration failed:",
        error
      );

      process.exitCode =
        1;
    } finally {
      await mongoose.disconnect();
    }
  };

run();