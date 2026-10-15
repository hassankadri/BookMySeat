
import React, { Suspense, lazy, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import copy from "../copy";
import cx from "../lib/cx";
import { getYoutubeId, releaseLabel } from "../lib/schedule";
import LazyBoundary, { withRetry } from "../primitives/LazyBoundary";
import MaskText from "../primitives/MaskText";
import Poster from "../primitives/Poster";
import Tilt from "../primitives/Tilt";

const loadTrailer = withRetry(() => import("./TrailerDialog"));
const TrailerDialog = lazy(loadTrailer);

// Films that are listed but not yet on a schedule. Never repeats a film that is already playing,
// and the whole section disappears when there is nothing to show.

const NextOnScreen = ({ films }) => {
  const [open, setOpen] = useState(null);
  const opener = useRef(null);
  const close = () => {
    setOpen(null);
    // Hand focus back to the play button that opened the trailer.
    requestAnimationFrame(() => opener.current?.focus());
  };
  if (!films.length) return null;
  const current = films.find((f) => f._id === open);

  return (
    <section id="next-on-screen" aria-labelledby="next-title" className="relative bg-ink px-5 py-24 md:px-8 lg:py-36" data-testid="next-on-screen">
      <div className="mx-auto max-w-[1280px]">
        <MaskText id="next-title" text={copy.nextOnScreen.heading} className="bms-display text-[clamp(3rem,8vw,8rem)]" />

        <ul className="mt-12 grid grid-cols-2 gap-3 md:gap-4 lg:mt-16 lg:auto-rows-[clamp(220px,23vw,330px)] lg:grid-cols-4">
          {films.map((film, i) => {
            const videoId = getYoutubeId(film.trailer);
            const date = releaseLabel(film) || copy.nextOnScreen.dateFallback;
            return (
              <li key={film._id} className={cx("flex flex-col", i === 0 && "lg:col-span-2 lg:row-span-2")}>
                <Tilt className="relative aspect-[2/3] min-h-0 rounded-[22px] lg:aspect-auto lg:flex-1">
                  <Link
                    to={`/movie/${film._id}`}
                    data-testid={`next-film-${i}`}
                    aria-label={`${film.title}, ${date}`}
                    className="group relative block h-full w-full overflow-hidden rounded-[22px] border border-line"
                  >
                    <Poster film={film} className="h-full w-full" imgClassName="group-hover:scale-[1.04]" />
                  </Link>
                  {videoId && (
                    <button
                      type="button"
                      onClick={(event) => {
                        opener.current = event.currentTarget;
                        setOpen(film._id);
                      }}
                      onPointerEnter={() => loadTrailer().catch(() => {})}
                      aria-label={copy.nextOnScreen.play(film.title)}
                      data-testid={`next-play-${i}`}
                      className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-paper text-ink transition-transform duration-300 hover:scale-110 active:scale-95 md:bottom-4 md:right-4 md:h-12 md:w-12"
                    >
                      <Play className="ml-0.5 h-4 w-4 fill-ink" />
                    </button>
                  )}
                </Tilt>
                <div className="pt-3" aria-hidden="true">
                  <p className={cx("bms-head line-clamp-1", i === 0 ? "text-[clamp(1.3rem,2.2vw,2.2rem)]" : "text-base md:text-lg")}>{film.title}</p>
                  <p className="bms-tabular text-sm text-mute">{date}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {current && (
        <LazyBoundary onFail={close} fallback={null}>
          <Suspense fallback={null}>
            <TrailerDialog film={current} videoId={getYoutubeId(current.trailer)} onClose={close} />
          </Suspense>
        </LazyBoundary>
      )}
    </section>
  );
};

export default NextOnScreen;
