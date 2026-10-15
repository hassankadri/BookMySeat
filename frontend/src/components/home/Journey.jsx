
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { Cta, Photo, Poster, Skeleton, Tilt, Words, cx, formatClock, formatDay, IMAGES } from "./ui";

const STEPS = [
  {
    title: "Choose your cinema",
    body: "Every booking starts with a cinema, so you only see films that are actually scheduled there. Your last choice is remembered on this device.",
  },
  {
    title: "Pick a film and a showtime",
    body: "Open any film to see its showtimes at your cinema, along with the trailer, cast and ratings. No account needed for any of this.",
  },
  {
    title: "Choose your seats",
    body: "Tap seats on the live map. Seats someone else is holding or has already booked cannot be selected, and you can book up to 10 at a time.",
  },
  {
    title: "Pay and walk in",
    body: "Pay by card, then show the QR ticket from your confirmation or from My bookings. Staff scan it at the door.",
  },
];

// -----------------------------------------------------
// STEP VISUALS
// -----------------------------------------------------

const CinemaVisual = ({ theatres }) => {
  const list = theatres.slice(0, 3);
  const covers = [IMAGES.hall, IMAGES.lobby, IMAGES.screen];
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <p className="mb-1 text-sm text-beam/55">Cinemas near you</p>
      {list.length === 0
        ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[88px]" />)
        : list.map((theatre, i) => (
            <div
              key={theatre._id}
              className={cx(
                "flex items-center gap-4 rounded-2xl border p-3 transition-colors",
                i === 0 ? "border-aisle/70 bg-aisle/[0.07]" : "border-beam/10 bg-beam/[0.03]"
              )}
            >
              <Photo
                src={theatre.coverImage || covers[i % covers.length]}
                className="h-16 w-20 shrink-0 rounded-xl"
              />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold">{theatre.name}</p>
                <p className="truncate text-sm text-beam/55">{theatre.city}</p>
              </div>
            </div>
          ))}
    </div>
  );
};

const ShowVisual = ({ films, shows }) => {
  const film = films[0];
  const times = useMemo(() => {
    if (!film) return [];
    const now = new Date();
    return shows
      .filter((s) => s.movie?._id === film._id && new Date(s.startTime) > now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
      .slice(0, 6);
  }, [film, shows]);
  const [picked, setPicked] = useState(0);
  if (!film) {
    return (
      <div className="flex h-full flex-col justify-center gap-4">
        <Skeleton className="h-36" />
        <Skeleton className="h-12" />
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col justify-center gap-6">
      <div className="flex gap-4">
        <Poster movie={film} className="aspect-[2/3] w-[96px] shrink-0 rounded-xl" />
        <div className="min-w-0 self-center">
          <p className="font-display text-2xl font-bold leading-tight">{film.title}</p>
          <p className="mt-1 text-sm text-beam/60">{film.genre}</p>
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm text-beam/55">Upcoming showtimes</p>
        <div className="flex flex-wrap gap-2">
          {times.map((show, i) => (
            <button
              key={show._id}
              type="button"
              onClick={() => setPicked(i)}
              aria-pressed={picked === i}
              className={cx(
                "rounded-xl border px-4 py-2.5 text-left text-sm transition-colors",
                picked === i
                  ? "border-aisle bg-aisle text-hall"
                  : "border-beam/15 text-beam/80 hover:border-beam/40"
              )}
            >
              <span className="block font-semibold">{formatClock(show.startTime)}</span>
              <span className={cx("block text-xs", picked === i ? "text-hall/70" : "text-beam/50")}>
                {formatDay(show.startTime)}
                {show.format ? `, ${show.format}` : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const ROWS = "ABCDEFG".split("");
const COLS = 12;
const stateOf = (r, c) => {
  if ((r * 7 + c * 13) % 11 === 0 || (r === 3 && c > 7 && c < 10)) return "booked";
  if ((r * 5 + c * 3) % 17 === 0) return "held";
  return "free";
};

const SeatDemo = ({ picked, setPicked }) => {
  const toggle = (id) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else if (next.size >= 10) {
      toast.error("You can book up to 10 seats at a time.");
      return;
    } else next.add(id);
    setPicked(next);
  };
  const ids = [...picked].sort();
  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="mx-auto h-[3px] w-[70%] rounded-full bg-glow/70 shadow-[0_0_30px_6px_rgba(191,191,197,.35)]" />
        <p className="mt-2 text-center text-xs text-beam/45">Screen</p>
        <div className="mt-4 flex justify-center" style={{ perspective: 900 }}>
          <div className="space-y-2" style={{ transform: "rotateX(22deg)", transformOrigin: "50% 0" }}>
            {ROWS.map((row, r) => (
              <div key={row} className="flex items-center justify-center gap-1 sm:gap-2">
                <span className="w-4 text-center text-[11px] text-beam/35">{row}</span>
                {Array.from({ length: COLS }, (_, c) => {
                  const id = `${row}${c + 1}`;
                  const state = picked.has(id) ? "selected" : stateOf(r, c);
                  return (
                    <React.Fragment key={id}>
                      {c === COLS / 2 && <span className="w-2 sm:w-3" />}
                      <button
                        type="button"
                        disabled={state === "booked" || state === "held"}
                        onClick={() => toggle(id)}
                        aria-pressed={state === "selected"}
                        aria-label={`Row ${row}, seat ${c + 1}, ${state === "free" ? "available" : state === "held" ? "held by someone else" : state}`}
                        className={cx(
                          "h-[19px] w-[19px] rounded-t-[7px] rounded-b-[3px] transition-all duration-200 sm:h-6 sm:w-6",
                          state === "free" && "bg-beam/20 hover:-translate-y-0.5 hover:bg-beam/45",
                          state === "selected" && "-translate-y-0.5 bg-aisle shadow-[0_6px_16px_-4px_rgba(237,237,238,.8)]",
                          state === "held" && "animate-seat-hold cursor-not-allowed bg-glow/35",
                          state === "booked" && "cursor-not-allowed bg-beam/[0.06]"
                        )}
                      />
                    </React.Fragment>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-beam/60">
          {[
            ["bg-beam/20", "Available"],
            ["bg-aisle", "Selected"],
            ["bg-glow/35", "Held by someone else"],
            ["bg-beam/[0.06] ring-1 ring-beam/10", "Booked"],
          ].map(([swatch, label]) => (
            <span key={label} className="flex items-center gap-2">
              <span className={cx("h-3 w-3 rounded-sm", swatch)} />
              {label}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-beam/10 bg-hall/60 p-4">
          <p className="min-w-0 text-sm" aria-live="polite">
            {ids.length === 0 ? (
              <span className="text-beam/60">Tap a few seats to try it. This is a sample layout.</span>
            ) : (
              <>
                <span className="font-semibold">
                  {ids.length} {ids.length === 1 ? "seat" : "seats"}
                </span>
                <span className="ml-2 truncate text-beam/60">{ids.slice(0, 6).join(", ")}{ids.length > 6 ? "..." : ""}</span>
              </>
            )}
          </p>
          <Cta href="#cinemas" size="sm" className="shrink-0">Choose a cinema</Cta>
        </div>
      </div>
    </div>
  );
};

const TicketVisual = ({ films }) => {
  const film = films[0];
  const show = film?.nextShow;
  return (
    <div className="flex h-full items-center justify-center">
      <div
        className="ticket-cut w-full max-w-[340px] bg-beam text-hall shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)]"
        style={{ "--cut": "56%", borderRadius: 22 }}
      >
        <div className="p-6 pb-7">
          <p className="text-xs font-medium text-hall/55">Sample ticket</p>
          <p className="font-display-tight mt-2 line-clamp-2 text-[28px] font-bold leading-[1.02] tracking-[-0.02em]">
            {film?.title || "Your film"}
          </p>
          <p className="mt-2 text-sm text-hall/70">
            {show?.theatre?.name || "Your cinema"}
            {show?.startTime ? `, ${formatClock(show.startTime)}` : ""}
          </p>
          <div className="mt-5 flex gap-8 text-sm">
            <div>
              <p className="text-xs text-hall/50">Row</p>
              <p className="font-semibold">F</p>
            </div>
            <div>
              <p className="text-xs text-hall/50">Seats</p>
              <p className="font-semibold">7, 8</p>
            </div>
          </div>
        </div>
        <div className="mx-6 border-t-2 border-dashed border-hall/20" />
        <div className="flex items-center justify-between gap-4 p-6 pt-8">
          <p className="max-w-[120px] text-xs leading-relaxed text-hall/60">
            Show this code at the entrance. It is scanned once.
          </p>
          <QRCodeSVG value="BMS1:sample-ticket" size={92} fgColor="#0b0b0d" bgColor="transparent" />
        </div>
      </div>
    </div>
  );
};

const Visual = ({ step, theatres, films, shows, picked, setPicked }) => {
  if (step === 0) return <CinemaVisual theatres={theatres} />;
  if (step === 1) return <ShowVisual films={films} shows={shows} />;
  if (step === 2) return <SeatDemo picked={picked} setPicked={setPicked} />;
  return <TicketVisual films={films} />;
};

// -----------------------------------------------------
// SECTION
// -----------------------------------------------------

const Journey = ({ theatres, films, shows }) => {
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(() => new Set());
  const listRef = useRef(null);
  const stepRefs = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(Number(entry.target.dataset.step));
        });
      },
      { rootMargin: "-42% 0px -42% 0px" }
    );
    stepRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 62%", "end 62%"] });
  const rail = useSpring(scrollYProgress, { stiffness: 90, damping: 26 });

  const shared = { theatres, films, shows, picked, setPicked };

  return (
    <section id="how" className="relative bg-[#111114] py-24 md:py-36" aria-labelledby="how-title">
      <div className="mx-auto max-w-[1280px] px-5 md:px-8">
        <Words
          id="how-title"
          text="How booking works"
          className="font-display-wide max-w-3xl text-[clamp(2.4rem,5vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.03em]"
        />
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-beam/65">
          Four steps, each on its own screen, so you always know where you are.
        </p>

        <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
          <ol ref={listRef} className="relative min-w-0">
            <span aria-hidden="true" className="absolute bottom-0 left-[19px] top-0 hidden w-px bg-beam/10 md:block" />
            <motion.span
              aria-hidden="true"
              className="absolute left-[19px] top-0 hidden h-full w-px origin-top bg-aisle md:block"
              style={{ scaleY: rail }}
            />
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                ref={(el) => (stepRefs.current[i] = el)}
                data-step={i}
                className="relative pb-16 md:pl-16 lg:min-h-[64vh] lg:pb-0"
              >
                <span
                  className={cx(
                    "absolute left-0 top-1 hidden h-10 w-10 items-center justify-center rounded-full border font-display text-base font-bold transition-colors duration-500 md:flex",
                    active >= i ? "border-aisle bg-aisle text-hall" : "border-beam/20 bg-[#111114] text-beam/50"
                  )}
                >
                  {i + 1}
                </span>
                <h3
                  className={cx(
                    "font-display-tight text-3xl font-bold tracking-[-0.02em] transition-colors duration-500 md:text-4xl",
                    active === i ? "text-beam" : "text-beam/45"
                  )}
                >
                  <span className="mr-3 text-aisle md:hidden">{i + 1}.</span>
                  {step.title}
                </h3>
                <p className={cx("mt-4 max-w-md text-lg leading-relaxed transition-colors duration-500", active === i ? "text-beam/70" : "text-beam/40")}>
                  {step.body}
                </p>
                <div className="mt-8 lg:hidden">
                  <div className="h-[460px] rounded-[28px] border border-beam/10 bg-panel/70 p-5">
                    <Visual step={i} {...shared} />
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="hidden min-w-0 lg:block">
            <div className="sticky top-28">
              {/* The seat map is interactive, so the card holds still while it is on screen. */}
              <Tilt max={active === 2 ? 0 : 5} glare={active !== 2} className="rounded-[36px]">
                <div className="h-[600px] overflow-hidden rounded-[36px] border border-beam/10 bg-panel/70 p-8 shadow-[0_50px_120px_-40px_rgba(0,0,0,.9)]">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={active}
                      className="h-full"
                      initial={{ opacity: 0, y: 24, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -16, scale: 0.98 }}
                      transition={{ duration: 0.4, ease: [0.2, 0.7, 0.1, 1] }}
                    >
                      <Visual step={active} {...shared} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </Tilt>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Journey;
