import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Eye,
  EyeOff,
  Film,
  Pencil,
  Plus,
  Save,
  Search,
  Star,
  X,
} from "lucide-react";

import axios from "axios";
import toast from "react-hot-toast";

import {
  useAuth,
} from "../../context/AuthContext";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

// =====================================================
// CONSTANTS
// =====================================================

const STATUS_OPTIONS = [
  {
    value:
      "ACTIVE",

    label:
      "Active",
  },

  {
    value:
      "COMING_SOON",

    label:
      "Coming Soon",
  },

  {
    value:
      "HIDDEN",

    label:
      "Hidden",
  },
];

const createEmptyForm =
  () => ({
    title: "",

    description: "",

    genre: "",

    duration: "",

    language: "",

    rating: "U/A",

    releaseYear:
      new Date()
        .getFullYear(),

    releaseDate: "",

    avgRating: "",

    poster: "",

    banner: "",

    trailer: "",

    director: "",

    producer: "",

    listingStatus:
      "ACTIVE",
  });

// =====================================================
// HELPERS
// =====================================================

const toDateInput = (
  value
) => {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date
    .toISOString()
    .slice(
      0,
      10
    );
};

const statusLabel = (
  status
) => {
  switch (status) {
    case "COMING_SOON":
      return "Coming Soon";

    case "HIDDEN":
      return "Hidden";

    default:
      return "Active";
  }
};

const statusClasses = (
  status
) => {
  switch (status) {
    case "COMING_SOON":
      return "border-blue-500/20 bg-blue-500/10 text-blue-400";

    case "HIDDEN":
      return "border-zinc-600 bg-zinc-800 text-zinc-400";

    default:
      return "border-green-500/20 bg-green-500/10 text-green-400";
  }
};

// =====================================================
// PAGE
// =====================================================

const AdminMovies = () => {
  const {
    token,
  } =
    useAuth();

  const [
    movies,
    setMovies,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("ALL");

  const [
    modalOpen,
    setModalOpen,
  ] =
    useState(false);

  const [
    editingMovie,
    setEditingMovie,
  ] =
    useState(null);

  const [
    form,
    setForm,
  ] =
    useState(
      createEmptyForm()
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  // ===================================================
  // AUTH HEADERS
  // ===================================================

  const authHeaders = {
    Authorization:
      `Bearer ${token}`,
  };

  // ===================================================
  // LOAD MOVIES
  // ===================================================

  const fetchMovies =
    async () => {
      if (!token) {
        return;
      }

      setLoading(
        true
      );

      try {
        const response =
          await axios.get(
            `${API_URL}/api/movies/admin/all`,

            {
              headers:
                authHeaders,
            }
          );

        setMovies(
          response.data
            ?.movies ||
            []
        );
      } catch (error) {
        console.error(
          "Movies error:",
          error
        );

        toast.error(
          error.response
            ?.data
            ?.error ||
            "Could not load movies."
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  useEffect(() => {
    fetchMovies();
  }, [token]);

  // ===================================================
  // FILTER
  // ===================================================

  const filteredMovies =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return movies.filter(
        (movie) => {
          const movieStatus =
            movie.listingStatus ||
            "ACTIVE";

          const matchesStatus =
            statusFilter ===
              "ALL" ||
            movieStatus ===
              statusFilter;

          if (
            !matchesStatus
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            movie.title,
            movie.genre,
            movie.language,
            movie.director,
            movie.producer,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(
              query
            );
        }
      );
    }, [
      movies,
      search,
      statusFilter,
    ]);

  // ===================================================
  // STATS
  // ===================================================

  const statusCounts =
    useMemo(() => {
      const counts = {
        ACTIVE: 0,
        COMING_SOON: 0,
        HIDDEN: 0,
      };

      movies.forEach(
        (movie) => {
          const status =
            movie.listingStatus ||
            "ACTIVE";

          if (
            Object.prototype.hasOwnProperty.call(
              counts,
              status
            )
          ) {
            counts[
              status
            ] += 1;
          }
        }
      );

      return counts;
    }, [movies]);

  // ===================================================
  // OPEN ADD
  // ===================================================

  const openAddMovie =
    () => {
      setEditingMovie(
        null
      );

      setForm(
        createEmptyForm()
      );

      setModalOpen(
        true
      );
    };

  // ===================================================
  // OPEN EDIT
  // ===================================================

  const openEditMovie =
    (movie) => {
      setEditingMovie(
        movie
      );

      setForm({
        title:
          movie.title ||
          "",

        description:
          movie.description ||
          "",

        genre:
          movie.genre ||
          "",

        duration:
          movie.duration ||
          "",

        language:
          movie.language ||
          "",

        rating:
          movie.rating ||
          "U/A",

        releaseYear:
          movie.releaseYear ||
          "",

        releaseDate:
          toDateInput(
            movie.releaseDate
          ),

        avgRating:
          movie.avgRating ??
          "",

        poster:
          movie.poster ||
          "",

        banner:
          movie.banner ||
          movie.backdrop ||
          "",

        trailer:
          movie.trailer ||
          "",

        director:
          movie.director ||
          "",

        producer:
          movie.producer ||
          "",

        listingStatus:
          movie.listingStatus ||
          "ACTIVE",
      });

      setModalOpen(
        true
      );
    };

  // ===================================================
  // FORM
  // ===================================================

  const handleChange =
    (event) => {
      const {
        name,
        value,
      } =
        event.target;

      setForm(
        (current) => ({
          ...current,

          [name]:
            value,
        })
      );
    };

  // ===================================================
  // SAVE
  // ===================================================

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (saving) {
        return;
      }

      if (
        !form.title.trim() ||
        !form.description.trim() ||
        !form.genre.trim() ||
        !form.duration.trim() ||
        !form.poster.trim()
      ) {
        toast.error(
          "Title, description, genre, duration and poster are required."
        );

        return;
      }

      setSaving(
        true
      );

      try {
        const payload = {
          ...form,

          releaseYear:
            form.releaseYear
              ? Number(
                  form.releaseYear
                )
              : undefined,

          releaseDate:
            form.releaseDate ||
            null,

          avgRating:
            form.avgRating !==
            ""
              ? Number(
                  form.avgRating
                )
              : 0,
        };

        if (
          editingMovie
        ) {
          await axios.put(
            `${API_URL}/api/movies/${editingMovie._id}`,

            payload,

            {
              headers:
                authHeaders,
            }
          );

          toast.success(
            "Movie updated."
          );
        } else {
          await axios.post(
            `${API_URL}/api/movies`,

            payload,

            {
              headers:
                authHeaders,
            }
          );

          toast.success(
            "Movie added."
          );
        }

        setModalOpen(
          false
        );

        setEditingMovie(
          null
        );

        setForm(
          createEmptyForm()
        );

        await fetchMovies();
      } catch (error) {
        console.error(
          "Save movie:",
          error
        );

        toast.error(
          error.response
            ?.data
            ?.error ||
            error.response
              ?.data
              ?.message ||
            "Could not save movie."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  // ===================================================
  // HIDE
  // ===================================================

  const hideMovie =
    async (
      movie
    ) => {
      const confirmed =
        window.confirm(
          `Hide "${movie.title}" from public listings? Existing booking history will remain intact.`
        );

      if (!confirmed) {
        return;
      }

      try {
        await axios.delete(
          `${API_URL}/api/movies/${movie._id}`,

          {
            headers:
              authHeaders,
          }
        );

        toast.success(
          "Movie hidden."
        );

        await fetchMovies();
      } catch (error) {
        toast.error(
          error.response
            ?.data
            ?.error ||
            "Could not hide movie."
        );
      }
    };

  // ===================================================
  // RESTORE
  // ===================================================

  const restoreMovie =
    async (
      movie
    ) => {
      try {
        await axios.put(
          `${API_URL}/api/movies/${movie._id}`,

          {
            listingStatus:
              "ACTIVE",
          },

          {
            headers:
              authHeaders,
          }
        );

        toast.success(
          "Movie restored."
        );

        await fetchMovies();
      } catch (error) {
        toast.error(
          error.response
            ?.data
            ?.error ||
            "Could not restore movie."
        );
      }
    };

  // ===================================================
  // UI
  // ===================================================

  return (
    <div>

      {/* HEADER */}

      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

        <div>

          <p className="text-sm uppercase tracking-[0.3em] text-red-500">
            Content
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Movies
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Manage movie information and public listing status.
          </p>

        </div>

        <button
          type="button"
          onClick={
            openAddMovie
          }
          className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold"
        >
          <Plus className="h-5 w-5" />

          Add Movie
        </button>

      </div>

      {/* STATS */}

      <div className="mt-7 grid gap-3 sm:grid-cols-3">

        <StatusCard
          label="Active"
          value={
            statusCounts.ACTIVE
          }
        />

        <StatusCard
          label="Coming Soon"
          value={
            statusCounts.COMING_SOON
          }
        />

        <StatusCard
          label="Hidden"
          value={
            statusCounts.HIDDEN
          }
        />

      </div>

      {/* FILTERS */}

      <div className="mt-8 flex flex-col gap-3 lg:flex-row">

        <div className="relative max-w-md flex-1">

          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

          <input
            value={
              search
            }
            onChange={(
              event
            ) =>
              setSearch(
                event.target
                  .value
              )
            }
            placeholder="Search movies..."
            className="w-full rounded-xl border border-white/10 bg-zinc-900 py-3 pl-11 pr-4 text-sm outline-none focus:border-red-500"
          />

        </div>

        <select
          value={
            statusFilter
          }
          onChange={(
            event
          ) =>
            setStatusFilter(
              event.target
                .value
            )
          }
          className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none"
        >
          <option value="ALL">
            All statuses
          </option>

          <option value="ACTIVE">
            Active
          </option>

          <option value="COMING_SOON">
            Coming Soon
          </option>

          <option value="HIDDEN">
            Hidden
          </option>
        </select>

      </div>

      {/* MOVIES */}

      {loading ? (
        <div className="py-24 text-center text-zinc-500">
          Loading movies...
        </div>
      ) : filteredMovies.length ===
        0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 py-24 text-center">

          <Film className="mx-auto h-10 w-10 text-zinc-700" />

          <p className="mt-4 text-zinc-500">
            No movies found.
          </p>

        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">

          {filteredMovies.map(
            (movie) => {
              const status =
                movie.listingStatus ||
                "ACTIVE";

              return (
                <div
                  key={
                    movie._id
                  }
                  className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50"
                >

                  {/* IMAGE */}

                  <div className="relative h-52 overflow-hidden bg-zinc-900">

                    {movie.banner ||
                    movie.poster ? (
                      <img
                        src={
                          movie.banner ||
                          movie.poster
                        }
                        alt={
                          movie.title
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">

                        <Film className="h-12 w-12 text-zinc-700" />

                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />

                    <span
                      className={`absolute left-3 top-3 rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                        status
                      )}`}
                    >
                      {statusLabel(
                        status
                      )}
                    </span>

                  </div>

                  {/* BODY */}

                  <div className="p-5">

                    <div className="flex items-start justify-between gap-4">

                      <div className="min-w-0">

                        <h2 className="truncate text-lg font-semibold">
                          {
                            movie.title
                          }
                        </h2>

                        <p className="mt-1 truncate text-sm text-zinc-500">
                          {movie.genre ||
                            "No genre"}
                        </p>

                      </div>

                      {movie.avgRating !=
                        null && (
                        <div className="flex items-center gap-1 text-sm">

                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />

                          {
                            movie.avgRating
                          }

                        </div>
                      )}

                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-500">

                      {movie.duration && (
                        <span className="rounded-full bg-white/5 px-3 py-1.5">
                          {
                            movie.duration
                          }
                        </span>
                      )}

                      {movie.language && (
                        <span className="rounded-full bg-white/5 px-3 py-1.5">
                          {
                            movie.language
                          }
                        </span>
                      )}

                      {movie.rating && (
                        <span className="rounded-full bg-white/5 px-3 py-1.5">
                          {
                            movie.rating
                          }
                        </span>
                      )}

                      {movie.releaseYear && (
                        <span className="rounded-full bg-white/5 px-3 py-1.5">
                          {
                            movie.releaseYear
                          }
                        </span>
                      )}

                    </div>

                    {/* ACTIONS */}

                    <div className="mt-5 grid grid-cols-2 gap-3">

                      <button
                        type="button"
                        onClick={() =>
                          openEditMovie(
                            movie
                          )
                        }
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-medium"
                      >
                        <Pencil className="h-4 w-4" />

                        Edit
                      </button>

                      {status ===
                      "HIDDEN" ? (
                        <button
                          type="button"
                          onClick={() =>
                            restoreMovie(
                              movie
                            )
                          }
                          className="flex items-center justify-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 py-3 text-sm font-medium text-green-400"
                        >
                          <Eye className="h-4 w-4" />

                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            hideMovie(
                              movie
                            )
                          }
                          className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 py-3 text-sm font-medium text-red-400"
                        >
                          <EyeOff className="h-4 w-4" />

                          Hide
                        </button>
                      )}

                    </div>

                  </div>

                </div>
              );
            }
          )}

        </div>
      )}

      {/* =================================================
          MODAL
      ================================================== */}

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">

          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111113]">

            {/* HEADER */}

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#111113] px-6 py-5">

              <div>

                <p className="text-xs uppercase tracking-[0.25em] text-red-500">
                  Movie Management
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  {editingMovie
                    ? "Edit Movie"
                    : "Add Movie"}
                </h2>

              </div>

              <button
                type="button"
                onClick={() =>
                  setModalOpen(
                    false
                  )
                }
                className="rounded-xl border border-white/10 p-2 text-zinc-500"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            {/* FORM */}

            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-6 p-6"
            >

              <div className="grid gap-5 md:grid-cols-2">

                <Field
                  label="Movie Title"
                  name="title"
                  value={
                    form.title
                  }
                  onChange={
                    handleChange
                  }
                  required
                />

                <Field
                  label="Genre"
                  name="genre"
                  value={
                    form.genre
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Action, Drama"
                  required
                />

                <Field
                  label="Duration"
                  name="duration"
                  value={
                    form.duration
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="2h 30m"
                  required
                />

                <Field
                  label="Language"
                  name="language"
                  value={
                    form.language
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Hindi"
                />

                <Field
                  label="Certificate"
                  name="rating"
                  value={
                    form.rating
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="U/A"
                />

                <Field
                  label="Release Year"
                  name="releaseYear"
                  type="number"
                  min="1888"
                  max="2100"
                  value={
                    form.releaseYear
                  }
                  onChange={
                    handleChange
                  }
                />

                <Field
                  label="Release Date"
                  name="releaseDate"
                  type="date"
                  value={
                    form.releaseDate
                  }
                  onChange={
                    handleChange
                  }
                />

                <Field
                  label="Average Rating"
                  name="avgRating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={
                    form.avgRating
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="4.5"
                />

                <Field
                  label="Director"
                  name="director"
                  value={
                    form.director
                  }
                  onChange={
                    handleChange
                  }
                />

                <Field
                  label="Producer"
                  name="producer"
                  value={
                    form.producer
                  }
                  onChange={
                    handleChange
                  }
                />

              </div>

              {/* STATUS */}

              <div>

                <label className="mb-2 block text-sm text-zinc-400">
                  Listing Status
                </label>

                <select
                  name="listingStatus"
                  value={
                    form.listingStatus
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-red-500"
                >
                  {STATUS_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {
                          option.label
                        }
                      </option>
                    )
                  )}
                </select>

                <p className="mt-2 text-xs text-zinc-600">
                  Active = normal listing, Coming Soon = upcoming release, Hidden = removed from public discovery.
                </p>

              </div>

              {/* DESCRIPTION */}

              <div>

                <label className="mb-2 block text-sm text-zinc-400">
                  Description
                </label>

                <textarea
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleChange
                  }
                  rows={5}
                  required
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-red-500"
                />

              </div>

              {/* URLS */}

              <div className="space-y-5">

                <Field
                  label="Poster URL"
                  name="poster"
                  value={
                    form.poster
                  }
                  onChange={
                    handleChange
                  }
                  required
                />

                <Field
                  label="Banner URL"
                  name="banner"
                  value={
                    form.banner
                  }
                  onChange={
                    handleChange
                  }
                />

                <Field
                  label="Trailer URL"
                  name="trailer"
                  value={
                    form.trailer
                  }
                  onChange={
                    handleChange
                  }
                />

              </div>

              {/* PREVIEW */}

              {form.poster && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">

                  <p className="mb-3 text-sm text-zinc-500">
                    Poster Preview
                  </p>

                  <img
                    src={
                      form.poster
                    }
                    alt="Poster preview"
                    className="h-48 rounded-xl object-cover"
                  />

                </div>
              )}

              {/* SAVE */}

              <div className="flex justify-end gap-3 border-t border-white/10 pt-6">

                <button
                  type="button"
                  onClick={() =>
                    setModalOpen(
                      false
                    )
                  }
                  className="rounded-xl border border-white/10 px-6 py-3 text-sm text-zinc-400"
                >
                  Cancel
                </button>

                <button
                  disabled={
                    saving
                  }
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />

                  {saving
                    ? "Saving..."
                    : editingMovie
                    ? "Save Changes"
                    : "Add Movie"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
};

// =====================================================
// FIELD
// =====================================================

const Field = ({
  label,
  ...props
}) => (
  <div>

    <label className="mb-2 block text-sm text-zinc-400">
      {label}
    </label>

    <input
      {...props}
      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-red-500"
    />

  </div>
);

// =====================================================
// STATUS CARD
// =====================================================

const StatusCard = ({
  label,
  value,
}) => (
  <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">

    <p className="text-xs text-zinc-500">
      {label}
    </p>

    <p className="mt-1 text-2xl font-semibold">
      {value}
    </p>

  </div>
);

export default AdminMovies;