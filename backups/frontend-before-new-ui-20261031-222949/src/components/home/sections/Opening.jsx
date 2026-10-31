
import React, { Suspense, lazy, useMemo, useRef, useState } from "react";
import * as Select from "@radix-ui/react-select";
import { Link } from "react-router-dom";
import {
  motion, useMotionValue, useReducedMotion, useSpring, useTransform,
} from "framer-motion";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Clapperboard, MapPin } from "lucide-react";
import copy from "../copy";
import cx from "../lib/cx";
import { chooseHallMode, readDevice } from "../lib/capabilities";
import useMedia from "../hooks/useMedia";
import useScrollProgress from "../hooks/useScrollProgress";
import MaskText from "../primitives/MaskText";
import LazyBoundary from "../primitives/LazyBoundary";
import HallFallback from "../stage/HallFallback";

const HallScene = lazy(() => import("../stage/HallScene"));
const EASE = [0.22, 1, 0.36, 1];

function CinemaSelect({ label, value, options, placeholder, onChange, icon: Icon }) {
  return (
    <Select.Root value={value || undefined} onValueChange={onChange}>
      <Select.Trigger
        aria-label={label}
        className="group flex h-[76px] w-full min-w-0 items-center gap-3 rounded-[17px] border border-white/15 bg-[#18171b]/90 px-4 text-left outline-none transition-[background,border-color,transform] duration-300 hover:-translate-y-[2px] hover:border-white/35 hover:bg-[#252229] focus-visible:border-[#e43b58] data-[state=open]:border-[#e43b58]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.05] text-[#ed5c76]">
          <Icon size={18} strokeWidth={1.7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[.19em] text-[#a9a0ab]">{label}</span>
          <span className="block truncate text-[15px] font-semibold text-white"><Select.Value placeholder={placeholder} /></span>
        </span>
        <Select.Icon>
          <ChevronDown size={16} className="text-white/60 transition-transform duration-300 group-data-[state=open]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={9}
          className="z-[110] max-h-72 w-[var(--radix-select-trigger-width)] min-w-[220px] overflow-hidden rounded-2xl border border-white/15 bg-[#18171d]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,.8)] backdrop-blur-xl"
        >
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="relative flex cursor-pointer select-none items-center justify-between rounded-xl px-4 py-3 text-[13px] text-[#dbd5dc] outline-none transition-colors data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator><Check size={15} className="text-[#ef6880]" /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function CinemaFinder({ finder, reduceMotion }) {
  const f = copy.opening.finder;
  if (!finder.hasCinemas) {
    return (
      <Link to="/cinemas" className="mt-10 inline-flex items-center gap-3 rounded-2xl bg-[#D71935] px-7 py-4 font-semibold text-white hover:bg-[#ed2b49]">
        {f.noCinemas}<ArrowUpRight size={18} />
      </Link>
    );
  }
  return (
    <div className="mt-8 w-full max-w-[650px]" data-testid="finder">
      <div className="mb-3 flex items-center gap-4 text-[10px] font-semibold uppercase tracking-[.22em] text-[#bab0b8]">
        Choose your experience <span className="h-px max-w-[110px] flex-1 bg-white/25" />
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,.78fr)_minmax(0,1.22fr)]">
        {finder.cities.length > 0 && (
          <CinemaSelect
            icon={MapPin} label={f.city} value={finder.city} onChange={finder.onCity}
            placeholder={f.cityPlaceholder} options={finder.cities.map((city) => ({ value: city, label: city }))}
          />
        )}
        <CinemaSelect
          icon={Clapperboard} label={f.cinema} value={finder.theatreId} onChange={finder.onTheatre}
          placeholder={f.cinemaPlaceholder}
          options={finder.cityTheatres.map((theatre) => ({ value: theatre._id, label: theatre.name }))}
        />
      </div>
      <motion.button
        type="button"
        disabled={!finder.theatreId}
        onClick={finder.onFind}
        data-testid="hero-find-shows"
        whileHover={reduceMotion ? undefined : { y: -2 }}
        whileTap={reduceMotion ? undefined : { scale: 0.987 }}
        className="group relative mt-2 flex min-h-[64px] w-full items-center justify-between overflow-hidden rounded-[17px] bg-[#D71935] px-6 text-left text-[15px] font-semibold text-white shadow-[0_18px_45px_rgba(215,25,53,.2)] transition-colors hover:bg-[#e72c49] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="relative z-10">{f.submit}</span>
        <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 transition-transform duration-300 group-hover:translate-x-1">
          <ArrowRight size={19} />
        </span>
      </motion.button>
    </div>
  );
}

export default function Opening({ finder, films = [], activeId }) {
  const systemReduced = useReducedMotion();
  const [optIn, setOptIn] = useState(() => {
    try { return sessionStorage.getItem("bms-cinematic-opt-in") === "yes"; }
    catch { return false; }
  });
  const reduced = Boolean(systemReduced && !optIn);
  const desktop = useMedia("(min-width: 1024px)");
  const pinned = desktop && !reduced;
  const [failed, setFailed] = useState(false);
  const device = useMemo(readDevice, []);
  const mode = failed ? "css" : chooseHallMode({ reduce: reduced, ...device, narrow: !desktop });
  const runway = useRef(null);
  const raw = useScrollProgress(runway, { a: 0, b: 1, enabled: pinned });
  const smooth = useSpring(raw, { stiffness: 80, damping: 24, mass: 0.5 });
  const zero = useMotionValue(0);
  const progress = pinned ? smooth : zero;
  const textOpacity = useTransform(smooth, [0.06, 0.34], [1, 0]);
  const textY = useTransform(smooth, [0, 0.4], [0, -70]);
  const hallOpacity = useTransform(smooth, [0.76, 0.95], [1, 0]);
  const film = films.find((item) => item._id === activeId) || films[0] || null;

  // The doors exist in the 3D scene, not as fake panels over the page.
  // Content appears after the camera has passed through them.
  const delay = reduced || mode !== "three" ? 0.1 : 3.02;
  const entrance = (extra = 0, distance = 20) => ({
    initial: reduced ? false : { opacity: 0, y: distance },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.85, delay: delay + extra, ease: EASE },
  });

  const enable = () => {
    try { sessionStorage.setItem("bms-cinematic-opt-in", "yes"); } catch { /* optional */ }
    setOptIn(true);
    setFailed(false);
  };

  const heading = (
    <>
      <motion.div {...entrance(0)} className="mb-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.23em] text-[#f08da0]">
        <span className="h-px w-9 bg-[#D71935]" /> A better way to the movies
      </motion.div>
      <MaskText
        as="h1" now delay={delay + 0.15} text={copy.opening.headline}
        className="bms-display max-w-[850px] text-[clamp(3rem,5.1vw,6rem)]"
      />
      <motion.p {...entrance(0.47)} className="mt-7 max-w-[30rem] text-[16px] leading-7 text-[#c4bac1] md:text-lg">
        {copy.opening.subline}
      </motion.p>
      <motion.div {...entrance(0.8, 28)}>
        <CinemaFinder finder={finder} reduceMotion={reduced} />
      </motion.div>
    </>
  );

  const hall = (
    <LazyBoundary key={mode} onFail={() => setFailed(true)} fallback={null}>
      {mode === "three" ? (
        <Suspense fallback={null}>
          <HallScene progress={progress} mobile={!desktop} film={film} reduceMotion={reduced} onFail={() => setFailed(true)} />
        </Suspense>
      ) : (
        <HallFallback film={film} progress={progress} mobile={!desktop} pinned={pinned} />
      )}
    </LazyBoundary>
  );

  if (!desktop) {
    return (
      <section id="bms-opening" className="relative overflow-hidden bg-ink pb-14" data-testid="opening" data-mode={mode}>
        <div className="relative z-20 mx-auto max-w-[760px] px-5 pb-7 pt-28 sm:px-8">{heading}</div>
        <div className="relative h-[430px] overflow-hidden sm:h-[560px]">
          <div className="absolute inset-0">{hall}</div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
        </div>
        {reduced && <button type="button" onClick={enable} className="relative z-30 mx-5 rounded-full border border-[#D71935]/60 px-5 py-3 text-sm text-white">Enable cinematic motion</button>}
      </section>
    );
  }

  return (
    <section ref={runway} id="bms-opening" className={cx("relative bg-ink", pinned && "h-[210svh]")} data-testid="opening" data-mode={mode}>
      <div className={cx("h-[100svh] min-h-[640px] overflow-hidden", pinned ? "sticky top-0" : "relative")}>
        <motion.div className="absolute inset-0" style={{ opacity: hallOpacity }}>{hall}</motion.div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.84)_0%,rgba(0,0,0,.66)_32%,transparent_75%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[18%] bg-gradient-to-t from-black/90 to-transparent" />
        <motion.div
          style={{ opacity: textOpacity, y: textY }}
          className="absolute inset-y-0 left-0 z-20 flex w-[58%] flex-col justify-center pb-6 pl-[max(2rem,5.3vw)] pr-3 pt-24"
        >
          {heading}
        </motion.div>
        {reduced && <button type="button" onClick={enable} className="absolute bottom-8 right-8 z-30 rounded-full border border-[#D71935]/60 bg-[#171115] px-6 py-3 text-sm font-semibold text-white">Enable cinematic motion</button>}
      </div>
    </section>
  );
}
