
// Pure scheduling helpers for the homepage. No React, no network.
// The rules here are the same ones the previous homepage used: a film counts as
// "now playing" only when it has a real, upcoming show.

const DAY = 24 * 60 * 60 * 1000;

const toTime = (value) => {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * One entry per film, each carrying its next show.
 * Optionally limited to a single cinema.
 */
export const deriveNowShowing = (shows, theatreId = null, now = Date.now()) => {
  const upcoming = (Array.isArray(shows) ? shows : [])
    .filter((show) => {
      const start = toTime(show?.startTime);
      return (
        show?.movie?._id &&
        start !== null &&
        start > now &&
        (!theatreId || show.theatre?._id === theatreId)
      );
    })
    .sort((a, b) => toTime(a.startTime) - toTime(b.startTime));

  const byMovie = new Map();
  upcoming.forEach((show) => {
    const existing = byMovie.get(show.movie._id);
    if (!existing) {
      byMovie.set(show.movie._id, {
        ...show.movie,
        nextShow: show,
        showCount: 1,
        theatreIds: new Set(show.theatre?._id ? [show.theatre._id] : []),
      });
      return;
    }
    existing.showCount += 1;
    if (show.theatre?._id) existing.theatreIds.add(show.theatre._id);
  });

  return Array.from(byMovie.values()).map(({ theatreIds, ...movie }) => ({
    ...movie,
    theatreCount: theatreIds.size,
  }));
};

const distinct = (values) => {
  const seen = new Map();
  values.forEach((raw) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return;
    const key = value.toLowerCase();
    const entry = seen.get(key);
    if (entry) entry.count += 1;
    else seen.set(key, { value, count: 1, order: seen.size });
  });
  // most common first; ties keep the order they first appeared in
  return [...seen.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map((entry) => entry.value);
};

/**
 * Figures for "The next seven days", across all cinemas.
 * Only values that exist in the schedule are reported.
 */
export const deriveWeek = (shows, now = Date.now()) => {
  const end = now + 7 * DAY;
  const inWindow = (Array.isArray(shows) ? shows : []).filter((show) => {
    const start = toTime(show?.startTime);
    return show?.movie?._id && start !== null && start > now && start <= end;
  });
  return {
    films: new Set(inWindow.map((s) => s.movie._id)).size,
    shows: inWindow.length,
    cinemas: new Set(inWindow.map((s) => s.theatre?._id).filter(Boolean)).size,
    languages: distinct(inWindow.map((s) => s.language)),
    formats: distinct(inWindow.map((s) => s.format)),
  };
};

/** Coming-soon films, never repeating a film already in the programme. */
export const deriveComingNext = (comingSoon, nowShowing) => {
  const playing = new Set((nowShowing || []).map((film) => film._id));
  return (Array.isArray(comingSoon) ? comingSoon : []).filter(
    (film) => film?._id && !playing.has(film._id)
  );
};

// ---------- formatting ----------

export const formatShowTime = (value) => {
  const t = toTime(value);
  if (t === null) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(t);
};

export const formatDay = (value) => {
  const t = toTime(value);
  if (t === null) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(t);
};

/** "12 Dec", else the year, else null (the caller supplies the fallback wording). */
export const releaseLabel = (movie) => {
  if (movie?.releaseDate) {
    const label = formatDay(movie.releaseDate);
    if (label) return label;
  }
  return movie?.releaseYear ? String(movie.releaseYear) : null;
};

export const getYoutubeId = (url) => {
  if (!url || typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "").slice(0, 11) || null;
    }
    const videoId = parsed.searchParams.get("v");
    if (videoId) return videoId.slice(0, 11);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const embedIndex = parts.findIndex((part) => part === "embed");
    if (embedIndex !== -1 && parts[embedIndex + 1]) {
      return parts[embedIndex + 1].slice(0, 11);
    }
  } catch {
    return null;
  }
  return null;
};

/** Where a film's page lives, keeping the cinema when one is known. */
export const filmHref = (film) => {
  const theatreId = film?.nextShow?.theatre?._id;
  return theatreId ? `/movie/${film._id}?theatre=${theatreId}` : `/movie/${film._id}`;
};

/** "Next show 8 Oct, 6:40 pm at Plaza Bandra, from ₹350", using only what exists. */
export const nextShowLine = (film) => {
  const show = film?.nextShow;
  if (!show?.startTime) return "";
  const time = formatShowTime(show.startTime);
  if (!time) return "";
  const price = Number(show.price);
  return [
    `Next show ${time}`,
    show.theatre?.name ? ` at ${show.theatre.name}` : "",
    Number.isFinite(price) && price > 0 ? `, from ₹${price}` : "",
  ].join("");
};
