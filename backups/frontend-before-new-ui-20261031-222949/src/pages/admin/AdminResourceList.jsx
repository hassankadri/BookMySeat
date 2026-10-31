import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Armchair,
  Building2,
  Film,
  Search,
} from "lucide-react";

import {
  motion,
} from "framer-motion";

import axios from "axios";
import toast from "react-hot-toast";

import {
  useAuth,
} from "../../context/AuthContext";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

const config = {
  movies: {
    title: "Movies",
    subtitle:
      "Movies available in BookMySeat.",
    icon: Film,
    key: "movies",
  },

  theatres: {
    title: "Theatres",
    subtitle:
      "Cinema locations connected to the platform.",
    icon: Building2,
    key: "theatres",
  },

  screens: {
    title: "Screens",
    subtitle:
      "Physical cinema screens and seat layouts.",
    icon: Armchair,
    key: "screens",
  },
};

const AdminResourceList = ({
  type,
}) => {
  const {
    token,
  } = useAuth();

  const page =
    config[type];

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    search,
    setSearch,
  ] = useState("");

  useEffect(() => {
    const fetchItems =
      async () => {
        setLoading(true);

        try {
          const response =
            await axios.get(
              `${API_URL}/api/admin/${type}`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          setItems(
            response.data[
              page.key
            ] || []
          );
        } catch (error) {
          console.error(
            `${type} error:`,
            error
          );

          toast.error(
            `Could not load ${page.title.toLowerCase()}.`
          );
        } finally {
          setLoading(false);
        }
      };

    fetchItems();
  }, [
    token,
    type,
    page.key,
    page.title,
  ]);

  const filtered =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return items;
      }

      return items.filter(
        (item) =>
          JSON.stringify(
            item
          )
            .toLowerCase()
            .includes(query)
      );
    }, [
      items,
      search,
    ]);

  const Icon =
    page.icon;

  const getTitle =
    (item) => {
      if (
        type === "movies"
      ) {
        return (
          item.title ||
          "Untitled Movie"
        );
      }

      if (
        type ===
        "theatres"
      ) {
        return (
          item.name ||
          "Unnamed Theatre"
        );
      }

      return (
        item.name ||
        `Screen ${item.screenNumber || ""}`
      );
    };

  const getDetails =
    (item) => {
      if (
        type === "movies"
      ) {
        const genre =
          Array.isArray(
            item.genre
          )
            ? item.genre.join(
                ", "
              )
            : item.genre ||
              item.genres?.join?.(
                ", "
              ) ||
              "Movie";

        return [
          genre,
          item.language,
          item.duration
            ? `${item.duration} min`
            : null,
        ]
          .filter(Boolean)
          .join(" • ");
      }

      if (
        type ===
        "theatres"
      ) {
        return [
          item.city,
          item.address,
        ]
          .filter(Boolean)
          .join(" • ");
      }

      return [
        item.theatre?.name,
        item.format,
        item.audio,
        `${item.seats?.length || 0} seats`,
      ]
        .filter(Boolean)
        .join(" • ");
    };

  return (
    <div>

      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

        <div>

          <p className="text-sm uppercase tracking-[0.3em] text-red-500">
            Management
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            {page.title}
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            {page.subtitle}
          </p>

        </div>

        <div className="relative w-full sm:w-72">

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
            placeholder={`Search ${page.title.toLowerCase()}...`}
            className="w-full rounded-xl border border-white/10 bg-zinc-900 px-11 py-3 text-sm outline-none transition focus:border-red-500"
          />

        </div>

      </div>

      {loading ? (
        <div className="py-20 text-center text-zinc-500">
          Loading...
        </div>
      ) : filtered.length ===
        0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 py-20 text-center">

          <Icon className="mx-auto h-10 w-10 text-zinc-700" />

          <p className="mt-4 text-zinc-500">
            No {page.title.toLowerCase()} found.
          </p>

        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">

          {filtered.map(
            (
              item,
              index
            ) => (
              <motion.div
                key={
                  item._id
                }
                initial={{
                  opacity: 0,
                  y: 15,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay:
                    Math.min(
                      index *
                        0.03,
                      0.3
                    ),
                }}
                whileHover={{
                  y: -3,
                }}
                className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 transition hover:border-red-500/25"
              >

                <div className="flex items-start gap-4">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                    <Icon className="h-5 w-5 text-red-500" />
                  </div>

                  <div className="min-w-0">

                    <h2 className="truncate font-semibold">
                      {getTitle(
                        item
                      )}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      {getDetails(
                        item
                      ) ||
                        "No additional information"}
                    </p>

                    <p className="mt-3 text-xs text-zinc-700">
                      ID:{" "}
                      {item._id}
                    </p>

                  </div>

                </div>

              </motion.div>
            )
          )}

        </div>
      )}

    </div>
  );
};

export default AdminResourceList;