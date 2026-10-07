import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Building2,
  MapPin,
  Search,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import axios from "axios";
import toast from "react-hot-toast";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

// =====================================================
// HELPERS
// =====================================================

const formatAddress = (
  address
) => {
  if (!address) {
    return "";
  }

  if (
    typeof address ===
    "string"
  ) {
    return address;
  }

  return [
    address.street,
    address.area,
    address.city,
    address.state,
    address.postalCode ||
      address.pincode,
  ]
    .filter(Boolean)
    .join(", ");
};

// =====================================================
// PAGE
// =====================================================

const Cinemas = () => {
  const navigate =
    useNavigate();

  const [
    theatres,
    setTheatres,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    selectedCity,
    setSelectedCity,
  ] =
    useState("");

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState("");

  // ===================================================
  // LOAD CINEMAS
  // ===================================================

  useEffect(() => {
    const loadTheatres =
      async () => {
        setLoading(true);

        try {
          const response =
            await axios.get(
              `${API_URL}/api/theatres`
            );

          const data =
            response.data
              ?.theatres ||
            response.data ||
            [];

          const activeTheatres =
            Array.isArray(data)
              ? data.filter(
                  (theatre) =>
                    theatre.isActive !==
                    false
                )
              : [];

          setTheatres(
            activeTheatres
          );

          // -------------------------------------------
          // CITY DEFAULT
          // -------------------------------------------

          const cities = [
            ...new Set(
              activeTheatres
                .map(
                  (theatre) =>
                    theatre.city
                )
                .filter(Boolean)
            ),
          ];

          const savedCity =
            localStorage.getItem(
              "bookmyseat_city"
            );

          if (
            savedCity &&
            cities.includes(
              savedCity
            )
          ) {
            setSelectedCity(
              savedCity
            );
          } else if (
            cities.length >
            0
          ) {
            setSelectedCity(
              cities[0]
            );
          }
        } catch (error) {
          console.error(
            "Load cinemas:",
            error
          );

          toast.error(
            error.response
              ?.data
              ?.message ||
              "Could not load cinemas."
          );
        } finally {
          setLoading(false);
        }
      };

    loadTheatres();
  }, []);

  // ===================================================
  // CITIES
  // ===================================================

  const cities =
    useMemo(() => {
      return [
        ...new Set(
          theatres
            .map(
              (theatre) =>
                theatre.city
            )
            .filter(Boolean)
        ),
      ];
    }, [theatres]);

  // ===================================================
  // FILTER THEATRES
  // ===================================================

  const visibleTheatres =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      return theatres.filter(
        (theatre) => {
          const cityMatches =
            !selectedCity ||
            theatre.city ===
              selectedCity;

          if (!cityMatches) {
            return false;
          }

          if (!query) {
            return true;
          }

          const searchable =
            [
              theatre.name,
              theatre.city,
              formatAddress(
                theatre.address
              ),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return searchable.includes(
            query
          );
        }
      );
    }, [
      theatres,
      selectedCity,
      searchQuery,
    ]);

  // ===================================================
  // SELECT CINEMA
  // ===================================================

  const selectTheatre =
    (theatre) => {
      if (!theatre?._id) {
        toast.error(
          "Cinema information is incomplete."
        );

        return;
      }

      // -----------------------------------------------
      // Save REAL MongoDB theatre details.
      // -----------------------------------------------

      localStorage.setItem(
        "bookmyseat_theatre",
        theatre._id
      );

      localStorage.setItem(
        "bookmyseat_theatre_name",
        theatre.name ||
          ""
      );

      localStorage.setItem(
        "bookmyseat_city",
        theatre.city ||
          ""
      );

      // -----------------------------------------------
      // IMPORTANT:
      //
      // Leading "/" makes this an absolute route.
      //
      // Correct:
      // /movies
      //
      // Wrong:
      // /cinemas/movies
      // -----------------------------------------------

      navigate(
        `/movies?theatre=${theatre._id}&city=${encodeURIComponent(
          theatre.city ||
            ""
        )}`
      );
    };

  // ===================================================
  // PAGE
  // ===================================================

  return (
    <div className="min-h-screen pb-20 pt-24">

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ===========================================
            HEADER
        ============================================ */}

        <div>

          <p className="text-sm text-zinc-500">
            Step 1
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Choose a Cinema
          </h1>

          <p className="mt-3 text-zinc-500">
            Select your city and cinema to see movies currently playing there.
          </p>

        </div>

        {/* ===========================================
            CITY SELECTOR
        ============================================ */}

        {!loading &&
          cities.length >
            0 && (
            <div className="mt-8">

              <p className="mb-3 text-xs uppercase tracking-wider text-zinc-600">
                City
              </p>

              <div className="flex flex-wrap gap-2">

                {cities.map(
                  (city) => (
                    <button
                      key={
                        city
                      }
                      type="button"
                      onClick={() => {
                        setSelectedCity(
                          city
                        );

                        localStorage.setItem(
                          "bookmyseat_city",
                          city
                        );
                      }}
                      className={`rounded-lg border px-4 py-2 text-sm ${
                        selectedCity ===
                        city
                          ? "border-red-500 bg-red-600 text-white"
                          : "border-white/10 bg-zinc-900 text-zinc-400"
                      }`}
                    >
                      {city}
                    </button>
                  )
                )}

              </div>

            </div>
          )}

        {/* ===========================================
            SEARCH
        ============================================ */}

        <div className="relative mt-7 max-w-md">

          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />

          <input
            type="text"
            value={
              searchQuery
            }
            onChange={(
              event
            ) =>
              setSearchQuery(
                event.target
                  .value
              )
            }
            placeholder="Search cinemas..."
            className="w-full rounded-lg border border-white/10 bg-zinc-900 py-3 pl-10 pr-4 outline-none focus:border-red-500"
          />

        </div>

        {/* ===========================================
            LOADING
        ============================================ */}

        {loading && (
          <div className="py-24 text-center text-zinc-500">
            Loading cinemas...
          </div>
        )}

        {/* ===========================================
            CINEMA GRID
        ============================================ */}

        {!loading &&
          visibleTheatres.length >
            0 && (
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">

              {visibleTheatres.map(
                (theatre) => (
                  <button
                    key={
                      theatre._id
                    }
                    type="button"
                    onClick={() =>
                      selectTheatre(
                        theatre
                      )
                    }
                    className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900 text-left"
                  >

                    {/* COVER */}

                    <div className="aspect-[16/8] overflow-hidden bg-zinc-800">

                      {theatre.coverImage ? (
                        <img
                          src={
                            theatre.coverImage
                          }
                          alt={
                            theatre.name
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">

                          <Building2 className="h-12 w-12 text-zinc-700" />

                        </div>
                      )}

                    </div>

                    {/* DETAILS */}

                    <div className="p-5">

                      <div className="flex items-start gap-3">

                        <MapPin className="mt-1 h-5 w-5 shrink-0 text-red-500" />

                        <div className="min-w-0">

                          <h2 className="text-lg font-semibold">
                            {
                              theatre.name
                            }
                          </h2>

                          <p className="mt-1 text-sm text-zinc-500">
                            {
                              theatre.city
                            }
                          </p>

                        </div>

                      </div>

                      {theatre.address && (
                        <p className="mt-4 line-clamp-2 text-sm text-zinc-500">
                          {formatAddress(
                            theatre.address
                          )}
                        </p>
                      )}

                      {/* AMENITIES */}

                      {Array.isArray(
                        theatre.amenities
                      ) &&
                        theatre
                          .amenities
                          .length >
                          0 && (
                          <div className="mt-4 flex flex-wrap gap-2">

                            {theatre.amenities
                              .slice(
                                0,
                                4
                              )
                              .map(
                                (
                                  amenity
                                ) => (
                                  <span
                                    key={
                                      amenity
                                    }
                                    className="rounded bg-white/5 px-2 py-1 text-xs text-zinc-500"
                                  >
                                    {
                                      amenity
                                    }
                                  </span>
                                )
                              )}

                          </div>
                        )}

                      <div className="mt-5 rounded-lg bg-red-600 py-3 text-center text-sm font-semibold text-white">
                        View Movies
                      </div>

                    </div>

                  </button>
                )
              )}

            </div>
          )}

        {/* ===========================================
            EMPTY
        ============================================ */}

        {!loading &&
          visibleTheatres.length ===
            0 && (
            <div className="mt-10 rounded-xl border border-white/10 py-20 text-center">

              <Building2 className="mx-auto h-10 w-10 text-zinc-700" />

              <h2 className="mt-4 text-xl font-semibold">
                No cinemas found
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                No active cinemas are available for this city.
              </p>

            </div>
          )}

      </div>

    </div>
  );
};

export default Cinemas;