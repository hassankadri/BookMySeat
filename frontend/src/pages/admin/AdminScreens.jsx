import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Armchair,
  Building2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import axios from "axios";
import toast from "react-hot-toast";

import {
  useAuth,
} from "../../context/AuthContext";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

const SCREEN_FORMATS = [
  "STANDARD",
  "3D",
  "IMAX",
  "IMAX_3D",
  "4DX",
  "DOLBY_CINEMA",
];

const SEAT_TYPES = [
  "REGULAR",
  "PREMIUM",
  "RECLINER",
  "LOUNGER",
  "WHEELCHAIR",
];

const defaultRows = [
  {
    label: "A",
    seats: 8,
    type: "REGULAR",
  },
  {
    label: "B",
    seats: 8,
    type: "PREMIUM",
  },
  {
    label: "C",
    seats: 8,
    type: "RECLINER",
  },
];

const emptyForm = {
  theatre: "",
  name: "",
  screenNumber: "",
  format: "STANDARD",
  audio: "DOLBY_ATMOS",
  isActive: true,
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
      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition focus:border-red-500"
    />
  </div>
);

// =====================================================
// PAGE
// =====================================================

const AdminScreens = () => {
  const {
    token,
  } = useAuth();

  const [
    screens,
    setScreens,
  ] = useState([]);

  const [
    theatres,
    setTheatres,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editingScreen,
    setEditingScreen,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState(
    emptyForm
  );

  const [
    rows,
    setRows,
  ] = useState(
    defaultRows
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  // ===================================================
  // LOAD
  // ===================================================

  const fetchData =
    async () => {
      setLoading(true);

      try {
        const [
          screensResponse,
          theatresResponse,
        ] =
          await Promise.all([
            axios.get(
              `${API_URL}/api/admin/screens`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            ),

            axios.get(
              `${API_URL}/api/admin/theatres`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            ),
          ]);

        setScreens(
          screensResponse.data
            .screens || []
        );

        setTheatres(
          theatresResponse.data
            .theatres || []
        );
      } catch (error) {
        console.error(
          "Screen load error:",
          error
        );

        toast.error(
          "Could not load screens."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchData();
  }, [token]);

  // ===================================================
  // SEARCH
  // ===================================================

  const filteredScreens =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return screens;
      }

      return screens.filter(
        (screen) =>
          screen.name
            ?.toLowerCase()
            .includes(query) ||
          screen.theatre
            ?.name
            ?.toLowerCase()
            .includes(query) ||
          screen.format
            ?.toLowerCase()
            .includes(query)
      );
    }, [
      screens,
      search,
    ]);

  // ===================================================
  // GENERATE SEATS
  // ===================================================

  const generatedSeats =
    useMemo(() => {
      const seats = [];

      rows.forEach(
        (row) => {
          const count =
            Math.max(
              Number(
                row.seats
              ) || 0,
              0
            );

          const aisleAfter =
            Math.ceil(
              count / 2
            );

          for (
            let number = 1;
            number <= count;
            number++
          ) {
            // Leave one physical column gap
            // in the middle to represent an aisle.
            const column =
              number >
              aisleAfter
                ? number + 1
                : number;

            seats.push({
              seatId:
                `${row.label}${number}`,

              row:
                row.label,

              number,

              column,

              type:
                row.type,

              isActive:
                true,
            });
          }
        }
      );

      return seats;
    }, [rows]);

  // ===================================================
  // ADD
  // ===================================================

  const openAdd =
    () => {
      setEditingScreen(
        null
      );

      setForm({
        ...emptyForm,
      });

      setRows(
        defaultRows.map(
          (row) => ({
            ...row,
          })
        )
      );

      setModalOpen(true);
    };

  // ===================================================
  // BUILD ROWS FROM EXISTING SCREEN
  // ===================================================

  const buildRowsFromSeats =
    (seats = []) => {
      if (
        !Array.isArray(
          seats
        ) ||
        seats.length === 0
      ) {
        return defaultRows;
      }

      const map =
        new Map();

      seats.forEach(
        (seat) => {
          const label =
            seat.row ||
            String(
              seat.seatId ||
                ""
            )
              .replace(
                /\d/g,
                ""
              )
              .toUpperCase();

          if (!label) {
            return;
          }

          if (
            !map.has(label)
          ) {
            map.set(
              label,
              {
                label,

                seats: 0,

                type:
                  seat.type ||
                  "REGULAR",
              }
            );
          }

          const current =
            map.get(label);

          current.seats += 1;
        }
      );

      return [
        ...map.values(),
      ].sort(
        (a, b) =>
          a.label.localeCompare(
            b.label
          )
      );
    };

  // ===================================================
  // EDIT
  // ===================================================

  const openEdit =
    (screen) => {
      setEditingScreen(
        screen
      );

      setForm({
        theatre:
          screen.theatre
            ?._id ||
          screen.theatre ||
          "",

        name:
          screen.name || "",

        screenNumber:
          screen.screenNumber ||
          "",

        format:
          screen.format ||
          "STANDARD",

        audio:
          screen.audio ||
          "DOLBY_ATMOS",

        isActive:
          screen.isActive !==
          false,
      });

      setRows(
        buildRowsFromSeats(
          screen.seats
        )
      );

      setModalOpen(true);
    };

  // ===================================================
  // INPUT
  // ===================================================

  const handleChange =
    (event) => {
      const {
        name,
        value,
        type,
        checked,
      } = event.target;

      setForm(
        (current) => ({
          ...current,

          [name]:
            type ===
            "checkbox"
              ? checked
              : value,
        })
      );
    };

  // ===================================================
  // ROW EDITING
  // ===================================================

  const updateRow =
    (
      index,
      field,
      value
    ) => {
      setRows(
        (current) =>
          current.map(
            (
              row,
              rowIndex
            ) =>
              rowIndex ===
              index
                ? {
                    ...row,

                    [field]:
                      value,
                  }
                : row
          )
      );
    };

  const addRow = () => {
    if (
      rows.length >= 26
    ) {
      toast.error(
        "Maximum 26 rows supported."
      );

      return;
    }

    const nextLabel =
      String.fromCharCode(
        65 +
          rows.length
      );

    setRows(
      (current) => [
        ...current,

        {
          label:
            nextLabel,

          seats: 8,

          type:
            "REGULAR",
        },
      ]
    );
  };

  const removeRow =
    (index) => {
      if (
        rows.length <= 1
      ) {
        toast.error(
          "A screen needs at least one row."
        );

        return;
      }

      const remaining =
        rows.filter(
          (
            _,
            rowIndex
          ) =>
            rowIndex !==
            index
        );

      // Re-label A, B, C...
      setRows(
        remaining.map(
          (
            row,
            rowIndex
          ) => ({
            ...row,

            label:
              String.fromCharCode(
                65 +
                  rowIndex
              ),
          })
        )
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

      if (
        generatedSeats.length ===
        0
      ) {
        toast.error(
          "Create at least one seat."
        );

        return;
      }

      if (saving) {
        return;
      }

      setSaving(true);

      try {
        const payload = {
          theatre:
            form.theatre,

          name:
            form.name.trim(),

          screenNumber:
            Number(
              form.screenNumber
            ),

          format:
            form.format,

          audio:
            form.audio.trim(),

          seats:
            generatedSeats,

          totalSeats:
            generatedSeats.length,

          isActive:
            form.isActive,
        };

        if (
          editingScreen
        ) {
          await axios.put(
            `${API_URL}/api/screens/${editingScreen._id}`,

            payload,

            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

          toast.success(
            "Screen updated."
          );
        } else {
          await axios.post(
            `${API_URL}/api/screens`,

            payload,

            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

          toast.success(
            "Screen created."
          );
        }

        setModalOpen(false);

        setEditingScreen(
          null
        );

        await fetchData();
      } catch (error) {
        console.error(
          "Save screen error:",
          error
        );

        toast.error(
          error.response
            ?.data
            ?.error ||
            error.response
              ?.data
              ?.message ||
            "Could not save screen."
        );
      } finally {
        setSaving(false);
      }
    };

  // ===================================================
  // DEACTIVATE
  // ===================================================

  const deactivateScreen =
    async (
      screen
    ) => {
      const confirmed =
        window.confirm(
          `Deactivate "${screen.name}"?`
        );

      if (!confirmed) {
        return;
      }

      try {
        await axios.delete(
          `${API_URL}/api/screens/${screen._id}`,

          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        toast.success(
          "Screen deactivated."
        );

        await fetchData();
      } catch (error) {
        toast.error(
          error.response
            ?.data
            ?.error ||
            "Could not deactivate screen."
        );
      }
    };

  // ===================================================
  // REACTIVATE
  // ===================================================

  const reactivateScreen =
    async (
      screen
    ) => {
      try {
        await axios.put(
          `${API_URL}/api/screens/${screen._id}`,

          {
            isActive: true,
          },

          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        toast.success(
          "Screen reactivated."
        );

        await fetchData();
      } catch (error) {
        toast.error(
          error.response
            ?.data
            ?.error ||
            "Could not reactivate screen."
        );
      }
    };

  // ===================================================
  // SEAT STYLE
  // ===================================================

  const seatStyle =
    (type) => {
      switch (type) {
        case "PREMIUM":
          return "border-yellow-500/40 bg-yellow-500/10 text-yellow-400";

        case "RECLINER":
          return "border-purple-500/40 bg-purple-500/10 text-purple-400";

        case "LOUNGER":
          return "border-blue-500/40 bg-blue-500/10 text-blue-400";

        case "WHEELCHAIR":
          return "border-green-500/40 bg-green-500/10 text-green-400";

        default:
          return "border-zinc-700 bg-zinc-800 text-zinc-400";
      }
    };

  // ===================================================
  // PAGE
  // ===================================================

  return (
    <div>

      {/* HEADER */}

      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-red-500">
            Cinema Network
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Screens
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Manage screens and build their physical seat layouts.
          </p>
        </div>

        <motion.button
          whileHover={{
            scale: 1.02,
          }}
          whileTap={{
            scale: 0.97,
          }}
          onClick={
            openAdd
          }
          className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold hover:bg-red-500"
        >
          <Plus className="h-5 w-5" />

          Add Screen
        </motion.button>

      </div>

      {/* SEARCH */}

      <div className="relative mt-8 max-w-md">

        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

        <input
          value={search}
          onChange={(
            event
          ) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search screens..."
          className="w-full rounded-xl border border-white/10 bg-zinc-900 py-3 pl-11 pr-4 text-sm outline-none focus:border-red-500"
        />

      </div>

      {/* LIST */}

      {loading ? (
        <div className="py-24 text-center text-zinc-500">
          Loading screens...
        </div>
      ) : filteredScreens.length ===
        0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 py-24 text-center">

          <Armchair className="mx-auto h-10 w-10 text-zinc-700" />

          <p className="mt-4 text-zinc-500">
            No screens found.
          </p>

        </div>
      ) : (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">

          {filteredScreens.map(
            (
              screen,
              index
            ) => (
              <motion.div
                key={
                  screen._id
                }
                initial={{
                  opacity: 0,
                  y: 20,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay:
                    Math.min(
                      index *
                        0.04,
                      0.25
                    ),
                }}
                whileHover={{
                  y: -3,
                }}
                className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 transition hover:border-red-500/25"
              >

                <div className="flex justify-between gap-5">

                  <div>

                    <div className="flex items-center gap-3">

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10">
                        <Armchair className="h-5 w-5 text-red-500" />
                      </div>

                      <div>

                        <h2 className="font-semibold">
                          {
                            screen.name
                          }
                        </h2>

                        <p className="text-sm text-zinc-600">
                          Screen{" "}
                          {
                            screen.screenNumber
                          }
                        </p>

                      </div>

                    </div>

                  </div>

                  <span
                    className={`h-fit rounded-full px-3 py-1 text-xs ${
                      screen.isActive !==
                      false
                        ? "bg-green-500/10 text-green-400"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {screen.isActive !==
                    false
                      ? "Active"
                      : "Inactive"}
                  </span>

                </div>

                <div className="mt-5 flex items-start gap-2 text-sm text-zinc-500">

                  <Building2 className="mt-0.5 h-4 w-4 text-red-500" />

                  <span>
                    {screen.theatre
                      ?.name ||
                      "Unknown theatre"}

                    {screen.theatre
                      ?.city &&
                      ` • ${screen.theatre.city}`}
                  </span>

                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">

                  <div className="rounded-xl bg-black/20 p-3">

                    <p className="text-xs text-zinc-600">
                      Format
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {
                        screen.format
                      }
                    </p>

                  </div>

                  <div className="rounded-xl bg-black/20 p-3">

                    <p className="text-xs text-zinc-600">
                      Audio
                    </p>

                    <p className="mt-1 truncate text-sm font-medium">
                      {
                        screen.audio ||
                        "—"
                      }
                    </p>

                  </div>

                  <div className="rounded-xl bg-black/20 p-3">

                    <p className="text-xs text-zinc-600">
                      Seats
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {screen.totalSeats ||
                        screen.seats
                          ?.length ||
                        0}
                    </p>

                  </div>

                </div>

                {/* ACTIONS */}

                <div className="mt-5 grid grid-cols-2 gap-3">

                  <button
                    onClick={() =>
                      openEdit(
                        screen
                      )
                    }
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-medium transition hover:bg-white/5"
                  >
                    <Pencil className="h-4 w-4" />

                    Edit
                  </button>

                  {screen.isActive !==
                  false ? (
                    <button
                      onClick={() =>
                        deactivateScreen(
                          screen
                        )
                      }
                      className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 py-3 text-sm font-medium text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />

                      Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        reactivateScreen(
                          screen
                        )
                      }
                      className="rounded-xl border border-green-500/20 bg-green-500/5 py-3 text-sm font-medium text-green-400"
                    >
                      Reactivate
                    </button>
                  )}

                </div>

              </motion.div>
            )
          )}

        </div>
      )}

      {/* ===============================================
          MODAL
      ================================================ */}

      <AnimatePresence>

        {modalOpen && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >

            <motion.div
              initial={{
                opacity: 0,
                scale: 0.96,
                y: 20,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
              }}
              className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111113]"
            >

              {/* HEADER */}

              <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#111113]/95 px-6 py-5 backdrop-blur-xl">

                <div>

                  <p className="text-xs uppercase tracking-[0.25em] text-red-500">
                    Screen Management
                  </p>

                  <h2 className="mt-1 text-xl font-bold">
                    {editingScreen
                      ? "Edit Screen"
                      : "Add Screen"}
                  </h2>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setModalOpen(
                      false
                    )
                  }
                  className="rounded-xl border border-white/10 p-2 text-zinc-500 hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>

              <form
                onSubmit={
                  handleSubmit
                }
                className="space-y-8 p-6"
              >

                {/* BASIC */}

                <div>

                  <h3 className="font-semibold">
                    Screen Details
                  </h3>

                  <div className="mt-4 grid gap-5 md:grid-cols-2">

                    <div>

                      <label className="mb-2 block text-sm text-zinc-400">
                        Theatre
                      </label>

                      <select
                        name="theatre"
                        value={
                          form.theatre
                        }
                        onChange={
                          handleChange
                        }
                        required
                        className="w-full rounded-xl border border-white/10 bg-[#18181b] px-4 py-3 outline-none focus:border-red-500"
                      >

                        <option value="">
                          Select theatre
                        </option>

                        {theatres
                          .filter(
                            (
                              theatre
                            ) =>
                              theatre.isActive !==
                              false
                          )
                          .map(
                            (
                              theatre
                            ) => (
                              <option
                                key={
                                  theatre._id
                                }
                                value={
                                  theatre._id
                                }
                              >
                                {
                                  theatre.name
                                }{" "}
                                —{" "}
                                {
                                  theatre.city
                                }
                              </option>
                            )
                          )}

                      </select>

                    </div>

                    <Field
                      label="Screen Name"
                      name="name"
                      value={
                        form.name
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Screen 1"
                      required
                    />

                    <Field
                      label="Screen Number"
                      name="screenNumber"
                      type="number"
                      min="1"
                      value={
                        form.screenNumber
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="1"
                      required
                    />

                    <div>

                      <label className="mb-2 block text-sm text-zinc-400">
                        Format
                      </label>

                      <select
                        name="format"
                        value={
                          form.format
                        }
                        onChange={
                          handleChange
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#18181b] px-4 py-3 outline-none focus:border-red-500"
                      >

                        {SCREEN_FORMATS.map(
                          (
                            format
                          ) => (
                            <option
                              key={
                                format
                              }
                              value={
                                format
                              }
                            >
                              {
                                format
                              }
                            </option>
                          )
                        )}

                      </select>

                    </div>

                    <Field
                      label="Audio"
                      name="audio"
                      value={
                        form.audio
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="DOLBY_ATMOS"
                    />

                  </div>

                </div>

                {/* =====================================
                    LAYOUT BUILDER
                ====================================== */}

                <div className="border-t border-white/10 pt-7">

                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

                    <div>

                      <h3 className="font-semibold">
                        Seat Layout Builder
                      </h3>

                      <p className="mt-1 text-sm text-zinc-600">
                        Create rows and choose the seat category for each row.
                      </p>

                    </div>

                    <button
                      type="button"
                      onClick={
                        addRow
                      }
                      className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm transition hover:bg-white/5"
                    >
                      <Plus className="h-4 w-4" />

                      Add Row
                    </button>

                  </div>

                  {/* ROW CONFIG */}

                  <div className="mt-5 space-y-3">

                    {rows.map(
                      (
                        row,
                        index
                      ) => (
                        <div
                          key={
                            row.label
                          }
                          className="grid items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-[80px_1fr_1fr_44px]"
                        >

                          <div className="flex h-11 items-center justify-center rounded-lg bg-red-500/10 font-bold text-red-500">
                            Row{" "}
                            {
                              row.label
                            }
                          </div>

                          <div>

                            <label className="mb-1 block text-xs text-zinc-600">
                              Seats
                            </label>

                            <input
                              type="number"
                              min="1"
                              max="30"
                              value={
                                row.seats
                              }
                              onChange={(
                                event
                              ) =>
                                updateRow(
                                  index,
                                  "seats",
                                  event
                                    .target
                                    .value
                                )
                              }
                              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 outline-none focus:border-red-500"
                            />

                          </div>

                          <div>

                            <label className="mb-1 block text-xs text-zinc-600">
                              Seat Type
                            </label>

                            <select
                              value={
                                row.type
                              }
                              onChange={(
                                event
                              ) =>
                                updateRow(
                                  index,
                                  "type",
                                  event
                                    .target
                                    .value
                                )
                              }
                              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 outline-none"
                            >

                              {SEAT_TYPES.map(
                                (
                                  type
                                ) => (
                                  <option
                                    key={
                                      type
                                    }
                                    value={
                                      type
                                    }
                                  >
                                    {
                                      type
                                    }
                                  </option>
                                )
                              )}

                            </select>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeRow(
                                index
                              )
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                        </div>
                      )
                    )}

                  </div>

                </div>

                {/* =====================================
                    PREVIEW
                ====================================== */}

                <div className="border-t border-white/10 pt-7">

                  <div className="flex items-center justify-between">

                    <div>

                      <h3 className="font-semibold">
                        Layout Preview
                      </h3>

                      <p className="mt-1 text-sm text-zinc-600">
                        {
                          generatedSeats.length
                        }{" "}
                        total seats
                      </p>

                    </div>

                  </div>

                  <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-6">

                    {/* SCREEN */}

                    <div className="mx-auto mb-10 max-w-xl">

                      <div className="h-2 rounded-[100%] bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_25px_rgba(239,68,68,0.35)]" />

                      <p className="mt-3 text-center text-[10px] uppercase tracking-[0.5em] text-zinc-700">
                        Screen
                      </p>

                    </div>

                    {/* SEATS */}

                    <div className="min-w-max space-y-4">

                      {rows.map(
                        (
                          row
                        ) => {
                          const count =
                            Number(
                              row.seats
                            ) || 0;

                          const aisle =
                            Math.ceil(
                              count /
                                2
                            );

                          return (
                            <div
                              key={
                                row.label
                              }
                              className="flex items-center"
                            >

                              <span className="mr-5 w-5 text-xs font-bold text-zinc-600">
                                {
                                  row.label
                                }
                              </span>

                              <div className="flex items-center gap-2">

                                {Array.from(
                                  {
                                    length:
                                      count,
                                  },
                                  (
                                    _,
                                    seatIndex
                                  ) => {
                                    const number =
                                      seatIndex +
                                      1;

                                    return (
                                      <React.Fragment
                                        key={
                                          number
                                        }
                                      >

                                        {number ===
                                          aisle +
                                            1 && (
                                          <div className="w-5" />
                                        )}

                                        <div
                                          title={`${row.label}${number} • ${row.type}`}
                                          className={`flex h-8 w-8 items-center justify-center rounded-md border text-[10px] ${seatStyle(
                                            row.type
                                          )}`}
                                        >
                                          {
                                            number
                                          }
                                        </div>

                                      </React.Fragment>
                                    );
                                  }
                                )}

                              </div>

                            </div>
                          );
                        }
                      )}

                    </div>

                  </div>

                  {/* LEGEND */}

                  <div className="mt-4 flex flex-wrap gap-3">

                    {SEAT_TYPES.map(
                      (
                        type
                      ) => (
                        <div
                          key={
                            type
                          }
                          className="flex items-center gap-2 text-xs text-zinc-500"
                        >

                          <div
                            className={`h-4 w-4 rounded border ${seatStyle(
                              type
                            )}`}
                          />

                          {
                            type
                          }

                        </div>
                      )
                    )}

                  </div>

                </div>

                {/* ACTIVE */}

                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4">

                  <div>

                    <p className="font-medium">
                      Screen Active
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      Only active screens can be used for new shows.
                    </p>

                  </div>

                  <input
                    type="checkbox"
                    name="isActive"
                    checked={
                      form.isActive
                    }
                    onChange={
                      handleChange
                    }
                    className="h-5 w-5 accent-red-600"
                  />

                </label>

                {editingScreen && (
                  <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-xs leading-5 text-yellow-400">
                    Be careful when changing an existing seat layout.
                    Shows or bookings may already reference these seat IDs.
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
                    className="rounded-xl border border-white/10 px-6 py-3 text-sm text-zinc-400 hover:bg-white/5"
                  >
                    Cancel
                  </button>

                  <motion.button
                    whileTap={{
                      scale: 0.97,
                    }}
                    disabled={
                      saving
                    }
                    type="submit"
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
                  >

                    <Save className="h-4 w-4" />

                    {saving
                      ? "Saving..."
                      : editingScreen
                      ? "Save Changes"
                      : "Create Screen"}

                  </motion.button>

                </div>

              </form>

            </motion.div>

          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
};

export default AdminScreens;