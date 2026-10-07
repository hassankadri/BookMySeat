const express = require("express");
const mongoose = require("mongoose");

const Theatre = require("../models/Theatre");

const {
  adminAuth,
} = require("../middleware/auth");

const router = express.Router();

// =====================================================
// HELPERS
// =====================================================

/**
 * Convert text into a URL-friendly slug.
 *
 * Example:
 *
 * "PVR Phoenix Palladium"
 *
 * becomes:
 *
 * "pvr-phoenix-palladium"
 */
const slugify = (value = "") =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Escape special RegExp characters.
 *
 * This prevents user search text from accidentally being
 * interpreted as a regular expression.
 */
const escapeRegex = (value = "") =>
  value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

/**
 * Generate a unique slug.
 *
 * Example:
 *
 * pvr-phoenix-mumbai
 *
 * If it already exists:
 *
 * pvr-phoenix-mumbai-1
 * pvr-phoenix-mumbai-2
 */
const generateUniqueSlug = async (
  name,
  city,
  excludeId = null
) => {
  const baseSlug = slugify(
    `${name}-${city}`
  );

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = {
      slug,
    };

    /**
     * While editing a theatre, ignore the current theatre's
     * own ID when checking whether the slug already exists.
     */
    if (excludeId) {
      query._id = {
        $ne: excludeId,
      };
    }

    const existing =
      await Theatre.findOne(query)
        .select("_id")
        .lean();

    if (!existing) {
      return slug;
    }

    slug =
      `${baseSlug}-${counter}`;

    counter += 1;
  }
};

// =====================================================
// GET ALL THEATRES
//
// GET /api/theatres
//
// Optional:
// ?city=Mumbai
// ?search=PVR
// =====================================================

router.get(
  "/",
  async (req, res) => {
    try {
      const {
        city,
        search,
      } = req.query;

      const filter = {
        isActive: true,
      };

      if (city) {
        filter.city = {
          $regex:
            `^${escapeRegex(city)}$`,

          $options: "i",
        };
      }

      if (search) {
        filter.name = {
          $regex:
            escapeRegex(search),

          $options: "i",
        };
      }

      const theatres =
        await Theatre.find(filter)
          .sort({
            city: 1,
            name: 1,
          })
          .lean();

      res.json({
        success: true,

        count:
          theatres.length,

        theatres,
      });
    } catch (error) {
      console.error(
        "Get theatres error:",
        error
      );

      res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch theatres.",
        });
    }
  }
);

// =====================================================
// GET SINGLE THEATRE
//
// GET /api/theatres/:id
// =====================================================

router.get(
  "/:id",
  async (req, res) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid theatre ID.",
          });
      }

      const theatre =
        await Theatre.findOne({
          _id:
            req.params.id,

          isActive: true,
        }).lean();

      if (!theatre) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Theatre not found.",
          });
      }

      res.json({
        success: true,
        theatre,
      });
    } catch (error) {
      console.error(
        "Get theatre error:",
        error
      );

      res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch theatre.",
        });
    }
  }
);

// =====================================================
// CREATE THEATRE
//
// POST /api/theatres
//
// ADMIN ONLY
// =====================================================

router.post(
  "/",
  adminAuth,
  async (req, res) => {
    try {
      const {
        name,
        city,
        address,
        location,
        coverImage,
        gallery,
        amenities,
        contact,
        description,
      } = req.body;

      // -----------------------------------------------
      // Basic validation
      // -----------------------------------------------

      if (
        !name ||
        !city ||
        !address
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Name, city and address are required.",
          });
      }

      /**
       * Our Theatre model uses structured addresses.
       *
       * At minimum we need:
       * street
       * city
       * state
       */
      if (
        !address.street ||
        !address.city ||
        !address.state
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Theatre address requires street, city and state.",
          });
      }

      const slug =
        await generateUniqueSlug(
          name,
          city
        );

      const theatre =
        await Theatre.create({
          name,
          slug,
          city,
          address,
          location,
          coverImage,
          gallery,
          amenities,
          contact,
          description,
        });

      res
        .status(201)
        .json({
          success: true,

          message:
            "Theatre created successfully.",

          theatre,
        });
    } catch (error) {
      console.error(
        "Create theatre error:",
        error
      );

      res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Failed to create theatre.",
        });
    }
  }
);

// =====================================================
// UPDATE THEATRE
//
// PUT /api/theatres/:id
//
// ADMIN ONLY
// =====================================================

router.put(
  "/:id",
  adminAuth,
  async (req, res) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid theatre ID.",
          });
      }

      const theatre =
        await Theatre.findById(
          req.params.id
        );

      if (!theatre) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Theatre not found.",
          });
      }

      /**
       * Only these fields can be edited.
       *
       * This prevents clients from injecting arbitrary
       * fields into the MongoDB document.
       */
      const allowedFields = [
        "name",
        "city",
        "address",
        "location",
        "coverImage",
        "gallery",
        "amenities",
        "contact",
        "description",
        "isActive",
      ];

      allowedFields.forEach(
        (field) => {
          if (
            req.body[field] !==
            undefined
          ) {
            theatre[field] =
              req.body[field];
          }
        }
      );

      /**
       * If the theatre name or city changes,
       * regenerate its URL slug.
       */
      if (
        req.body.name ||
        req.body.city
      ) {
        theatre.slug =
          await generateUniqueSlug(
            theatre.name,
            theatre.city,
            theatre._id
          );
      }

      await theatre.save();

      res.json({
        success: true,

        message:
          "Theatre updated successfully.",

        theatre,
      });
    } catch (error) {
      console.error(
        "Update theatre error:",
        error
      );

      res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Failed to update theatre.",
        });
    }
  }
);

// =====================================================
// DEACTIVATE THEATRE
//
// DELETE /api/theatres/:id
//
// ADMIN ONLY
// =====================================================

router.delete(
  "/:id",
  adminAuth,
  async (req, res) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid theatre ID.",
          });
      }

      const theatre =
        await Theatre.findById(
          req.params.id
        );

      if (!theatre) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Theatre not found.",
          });
      }

      /**
       * Soft-delete instead of permanently deleting.
       *
       * Why?
       *
       * Old shows/bookings may still reference this theatre.
       * Removing the document completely would damage history.
       */
      theatre.isActive =
        false;

      await theatre.save();

      res.json({
        success: true,

        message:
          "Theatre deactivated successfully.",
      });
    } catch (error) {
      console.error(
        "Deactivate theatre error:",
        error
      );

      res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to deactivate theatre.",
        });
    }
  }
);

module.exports = router;