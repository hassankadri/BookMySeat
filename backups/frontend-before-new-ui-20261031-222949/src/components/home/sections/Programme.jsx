
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Heart,
  Pause, Play, Volume2, VolumeX, X,
} from "lucide-react";
import { Link } from "react-router-dom";
import trailerCatalogue from "../trailerCatalogue";
import { filmHref, nextShowLine } from "../lib/schedule";

const number = (n) => String(n + 1).padStart(2, "0");

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function Control({ title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white backdrop-blur-md transition-colors hover:border-white/80 hover:bg-white/20 md:h-11 md:w-11"
    >
      {children}
    </button>
  );
}

function Clip({ entry, playing, muted, visible }) {
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = muted;

    if (playing && visible) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [playing, muted, visible]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#080a0d]">
      {!posterFailed && (
        <img
          src={entry.poster}
          alt=""
          onError={() => setPosterFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            filter: "brightness(1.10) saturate(1.20)",
          }}
        />
      )}

      {!failed && (
        <video
          ref={videoRef}
          src={entry.src}
          autoPlay={playing && visible}
          playsInline
          muted={muted}
          loop
          preload="auto"
          onCanPlay={() => setReady(true)}
          onError={() => setFailed(true)}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{
            opacity: ready ? 1 : 0,
            filter: "brightness(1.12) saturate(1.28) contrast(1.03)",
          }}
        />
      )}

      {failed && (
        <p className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-lg bg-black/70 px-4 py-2 text-sm text-white">
          Preview unavailable — check the optimized MP4.
        </p>
      )}
    </div>
  );
}

export default function Programme({
  films = [],
  favIds,
  onToggleFavorite,
  scopeName,
  onClearScope,
}) {
  const reducedMotion = useReducedMotion();

  const sectionRef = useRef(null);
  const pickerRef = useRef(null);
  const indexRef = useRef(0);

  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [visible, setVisible] = useState(false);

  // Only your selected trailers.
  // No demo movies are appended.
  const entries = useMemo(
    () =>
      trailerCatalogue.map((trailer) => ({
        ...trailer,
        movie:
          (Array.isArray(films) ? films : []).find(
            (item) =>
              trailer.match.test(normalize(item.title))
          ) || null,
      })),
    [films]
  );

  const current = entries[index] || entries[0];

  const next = entries.length
    ? entries[(index + 1) % entries.length]
    : null;

  const movie = current?.movie;

  const favourite = Boolean(
    movie && favIds?.has?.(movie._id)
  );

  // Invisible rightmost 20% mouse-wheel interaction.
  // Everywhere else, the page scrolls normally.
  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return undefined;

    let accumulated = 0;
    let lastSwitchTime = 0;

    const SWITCH_THRESHOLD = 55;
    const SWITCH_COOLDOWN_MS = 900;

    const onWheel = (event) => {
      if (
        event.ctrlKey ||
        menuOpen ||
        entries.length < 2
      ) {
        return;
      }

      const bounds = element.getBoundingClientRect();

      // Check the cursor's location.
      // No visible panel or overlay is required.
      const insideRightEdge =
        event.clientX >=
          bounds.left + bounds.width * 0.8 &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;

      // Outside the rightmost 20%, let the
      // browser handle scrolling as usual.
      if (!insideRightEdge) {
        accumulated = 0;
        return;
      }

      // Normalize mouse-wheel and trackpad movement.
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 18
          : event.deltaMode === 2
          ? window.innerHeight
          : 1);

      if (Math.abs(delta) < 0.1) return;

      const direction = delta > 0 ? 1 : -1;
      const targetIndex = indexRef.current + direction;

      // Let the page scroll beyond the first
      // or last trailer instead of trapping the user.
      if (
        targetIndex < 0 ||
        targetIndex >= entries.length
      ) {
        accumulated = 0;
        return;
      }

      // Capture the wheel only inside the
      // invisible trailer-navigation area.
      event.preventDefault();

      const now = performance.now();

      // Prevent multiple rapid switches from
      // one strong mouse-wheel gesture.
      if (now - lastSwitchTime < SWITCH_COOLDOWN_MS) {
        accumulated = 0;
        return;
      }

      if (Math.sign(accumulated) !== direction) {
        accumulated = 0;
      }

      accumulated += delta;

      if (
        Math.abs(accumulated) >= SWITCH_THRESHOLD
      ) {
        accumulated = 0;
        lastSwitchTime = now;

        indexRef.current = targetIndex;
        setIndex(targetIndex);

        // Muted playback allows reliable
        // automatic switching between clips.
        setMuted(true);
        setPlaying(true);
      }
    };

    // A native non-passive listener is required
    // to prevent page movement in the 20% zone.
    element.addEventListener("wheel", onWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      element.removeEventListener(
        "wheel",
        onWheel,
        true
      );
    };
  }, [entries.length, menuOpen]);

  // Pause the video when the section is off-screen.
  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return undefined;

    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) =>
        setVisible(
          entry.isIntersecting && !document.hidden
        ),
      { threshold: 0.12 }
    );

    observer.observe(element);

    const checkVisibility = () => {
      const box = element.getBoundingClientRect();

      setVisible(
        !document.hidden &&
          box.top < window.innerHeight &&
          box.bottom > 0
      );
    };

    document.addEventListener(
      "visibilitychange",
      checkVisibility
    );

    return () => {
      observer.disconnect();

      document.removeEventListener(
        "visibilitychange",
        checkVisibility
      );
    };
  }, []);

  // Close the picker when clicking outside
  // or pressing Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const dismiss = (event) => {
      if (
        event.type === "keydown" &&
        event.key === "Escape"
      ) {
        setMenuOpen(false);
      }

      if (
        event.type === "pointerdown" &&
        !pickerRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      dismiss
    );

    document.addEventListener(
      "keydown",
      dismiss
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        dismiss
      );

      document.removeEventListener(
        "keydown",
        dismiss
      );
    };
  }, [menuOpen]);

  // Manual selection changes only the trailer.
  // It never scrolls the webpage.
  const chooseFilm = (requestedIndex) => {
    if (!entries.length) return;

    const target =
      (requestedIndex + entries.length) %
      entries.length;

    indexRef.current = target;

    setIndex(target);
    setMuted(true);
    setPlaying(true);
    setMenuOpen(false);
  };

  if (!current) return null;

  return (
    <section
      ref={sectionRef}
      id="programme"
      data-testid="programme"
      aria-label="Cinematic trailers"
      className="relative isolate h-[100svh] min-h-[600px] overflow-hidden bg-black"
    >
      {/* Disable old homepage scroll snapping. */}
      <style>{`
        html.bms-snap {
          scroll-snap-type: none !important;
        }

        .bms-home #next-seven-days {
          margin-top: 0 !important;
        }
      `}</style>

      {/* One-screen trailer section.
          The right navigation area is invisible. */}
      <div className="relative h-full overflow-hidden bg-black">
        <AnimatePresence
          mode="sync"
          initial={false}
        >
          <motion.div
            key={current.key}
            className="absolute inset-0"
            initial={{
              opacity: 0,
              scale: 1.02,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              scale: 1.02,
            }}
            transition={{
              duration: reducedMotion ? 0 : 0.8,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Clip
              entry={current}
              playing={playing}
              muted={muted}
              visible={visible}
            />
          </motion.div>
        </AnimatePresence>

        {/* Preload only the next optimized MP4. */}
        {visible &&
          next &&
          next.key !== current.key && (
            <video
              key={`preload-${next.key}`}
              src={next.src}
              preload="auto"
              muted
              playsInline
              aria-hidden="true"
              className="hidden"
            />
          )}

        {/* Light edge shading. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top,rgba(0,0,0,.55),rgba(0,0,0,.07) 30%,transparent 52%),linear-gradient(to right,rgba(0,0,0,.12),transparent 42%)",
          }}
        />

        {/* Top-left label */}
        <div className="pointer-events-none absolute left-5 top-24 z-20 md:left-10">
          <p className="text-[10px] font-bold uppercase tracking-[.24em] text-white md:text-xs">
            THE CINEMA WALL{" "}
            <span className="text-[#ff4562]">/</span>{" "}
            PREVIEWS
          </p>

          <p className="mt-2 text-xs text-white/80">
            {number(index)} /{" "}
            {number(entries.length - 1)}
            {" · "}
            Scroll on the right to change films
          </p>

          {scopeName && (
            <button
              type="button"
              onClick={onClearScope}
              className="pointer-events-auto mt-2 text-xs text-white/80 underline underline-offset-4"
            >
              {scopeName} · All cinemas
            </button>
          )}
        </div>

        {/* Compact film selector */}
        <div
          ref={pickerRef}
          className="absolute right-5 top-24 z-30 w-[min(320px,calc(100vw-40px))] md:right-10"
        >
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="trailer-picker"
            onClick={() =>
              setMenuOpen((open) => !open)
            }
            className="ml-auto flex items-center gap-2.5 rounded-full border border-white/30 bg-black/30 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-xl transition hover:border-white/70"
          >
            <span className="text-[#ff4562]">
              {number(index)}
            </span>

            <span>Choose film</span>

            {menuOpen ? (
              <X size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                id="trailer-picker"
                initial={{
                  opacity: 0,
                  y: -8,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -8,
                }}
                transition={{
                  duration: reducedMotion
                    ? 0
                    : 0.2,
                }}
                className="mt-2 max-h-[62svh] overflow-y-auto overscroll-contain rounded-xl border border-white/20 bg-black/85 p-2 backdrop-blur-xl"
              >
                {entries.map((entry, i) => (
                  <button
                    type="button"
                    key={entry.key}
                    onClick={() => chooseFilm(i)}
                    aria-current={
                      i === index
                        ? "true"
                        : undefined
                    }
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/10 ${
                      i === index
                        ? "bg-white/10 text-white"
                        : "text-white/75"
                    }`}
                  >
                    <span className="w-6 shrink-0 text-xs text-[#ff4562]">
                      {number(i)}
                    </span>

                    <span className="min-w-0 flex-1 truncate">
                      {entry.title}
                    </span>

                    {i === index && (
                      <Check
                        size={16}
                        className="text-[#ff4562]"
                      />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Movie title and booking actions */}
        <div className="pointer-events-none absolute bottom-20 left-5 z-20 max-w-[85vw] md:bottom-16 md:left-10 md:max-w-[600px]">
          <AnimatePresence
            mode="wait"
            initial={false}
          >
            <motion.div
              key={current.key}
              initial={{
                opacity: 0,
                y: 14,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -10,
              }}
              transition={{
                duration: reducedMotion
                  ? 0
                  : 0.4,
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-white/80">
                FEATURED TRAILER / {number(index)}
              </p>

              <h2 className="bms-display mt-2 text-[clamp(2.25rem,5vw,5rem)] leading-[.98] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,.5)]">
                {current.title}
              </h2>

              {movie?.nextShow && (
                <p className="mt-2 text-sm text-white/85">
                  {nextShowLine(movie)}
                </p>
              )}

              <div className="pointer-events-auto mt-5 flex flex-wrap items-center gap-2.5">
                {movie?.nextShow ? (
                  <>
                    <Link
                      to={filmHref(movie)}
                      className="rounded-full bg-[#D71935] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#ed2848]"
                    >
                      View showtimes
                    </Link>

                    <button
                      type="button"
                      onClick={() =>
                        onToggleFavorite?.(movie._id)
                      }
                      aria-label={
                        favourite
                          ? "Remove favourite"
                          : "Add favourite"
                      }
                      aria-pressed={favourite}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white backdrop-blur-md"
                    >
                      <Heart
                        size={17}
                        className={
                          favourite
                            ? "fill-current"
                            : ""
                        }
                      />
                    </button>
                  </>
                ) : (
                  <Link
                    to="/cinemas"
                    className="rounded-full bg-[#D71935] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#ed2848]"
                  >
                    Explore cinemas
                  </Link>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Playback and manual film navigation */}
        <div className="absolute bottom-7 right-5 z-20 flex items-center gap-2 md:bottom-9 md:right-10">
          <Control
            title={
              playing
                ? "Pause trailer"
                : "Play trailer"
            }
            onClick={() =>
              setPlaying((value) => !value)
            }
          >
            {playing ? (
              <Pause size={16} />
            ) : (
              <Play size={16} />
            )}
          </Control>

          <Control
            title={
              muted
                ? "Unmute trailer"
                : "Mute trailer"
            }
            onClick={() =>
              setMuted((value) => !value)
            }
          >
            {muted ? (
              <VolumeX size={17} />
            ) : (
              <Volume2 size={17} />
            )}
          </Control>

          <span className="mx-1 h-5 w-px bg-white/30" />

          <Control
            title="Previous trailer"
            onClick={() =>
              chooseFilm(index - 1)
            }
          >
            <ArrowLeft size={18} />
          </Control>

          <Control
            title="Next trailer"
            onClick={() =>
              chooseFilm(index + 1)
            }
          >
            <ArrowRight size={18} />
          </Control>
        </div>

        {/* Bottom progress indicator */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex h-[3px] gap-[2px]">
          {entries.map((entry, i) => (
            <div
              key={entry.key}
              className={`h-full flex-1 transition-colors duration-700 ${
                i <= index
                  ? "bg-[#D71935]"
                  : "bg-white/25"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
