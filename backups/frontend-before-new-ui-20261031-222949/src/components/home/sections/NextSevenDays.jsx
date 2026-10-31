
import React from "react";
import copy from "../copy";
import CountUp from "../primitives/CountUp";
import ScrubWords from "../primitives/ScrubWords";

// How big the programme is, in numbers taken straight from the schedule. Nothing to click:
// a calm pause between two image-led sections. Hidden when the next seven days are empty.

const NextSevenDays = ({ week, overlap }) => {
  if (!week || week.shows <= 0) return null;
  const c = copy.nextSevenDays;
  const figures = [
    { n: week.films, label: c.films(week.films), key: "films" },
    { n: week.shows, label: c.shows(week.shows), key: "shows" },
    { n: week.cinemas, label: c.cinemas(week.cinemas), key: "cinemas" },
  ].filter((f) => f.n > 0);

  return (
    <section
      id="next-seven-days"
      aria-labelledby="week-title"
      className={`relative z-10 px-3 sm:px-4 lg:px-6 ${overlap ? "lg:-mt-[65svh]" : "pt-3 lg:pt-6"} pb-3 lg:pb-6`}
      data-testid="next-seven-days"
    >
      <div className="relative flex min-h-[100svh] flex-col justify-between overflow-hidden rounded-[28px] border border-line bg-ink-1 px-6 py-10 sm:px-10 lg:rounded-[36px] lg:px-16 lg:py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="week-title" className="bms-head text-[22px] md:text-[26px]">
            {c.heading}
          </h2>
          <p className="text-sm text-mute">{c.scope}</p>
        </div>

        <ul className="my-12 grid gap-10 sm:grid-cols-3 sm:gap-6" data-testid="week-figures">
          {figures.map((f) => (
            <li key={f.key}>
              <p className="bms-display bms-tabular text-[clamp(5rem,13vw,12.5rem)]">
                <CountUp value={f.n} />
              </p>
              <p className="mt-3 text-lg text-soft">{f.label}</p>
            </li>
          ))}
        </ul>

        <div className="border-t border-line pt-8">
          {week.languages.length > 0 && (
            <ScrubWords
              words={week.languages}
              className="bms-display text-[clamp(2.4rem,6vw,5.6rem)] !leading-[1.02]"
            />
          )}
          {week.formats.length > 0 && (
            <ScrubWords
              words={week.formats}
              className="bms-display mt-2 text-[clamp(2.4rem,6vw,5.6rem)] !leading-[1.02]"
              from={0.95}
              to={0.65}
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default NextSevenDays;
