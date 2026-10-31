
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

import "../components/home/home.css";
import "../components/home/legacy-sections.css";
import "../components/home/red-preview.css";

import useHomeData from "../components/home/useHomeData";
import useHomeSnap from "../components/home/hooks/useHomeSnap";

import Opening from "../components/home/sections/Opening";
import Programme from "../components/home/sections/Programme";
import Journey from "../components/home/Journey";
import BookingFAQ from "../components/home/BookingFAQ";
import NextOnScreen from "../components/home/sections/NextOnScreen";
import Ask from "../components/home/sections/Ask";

import {
  AccountSection,
  SiteFooter,
} from "../components/home/sections/AccountFooter";

const Home = () => {
  const { isAuthenticated } = useAuth();
  const data = useHomeData();

  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (!data.heroFilms.some((film) => film._id === activeId)) {
      setActiveId(data.heroFilms[0]?._id ?? null);
    }
  }, [data.heroFilms, activeId]);

  useHomeSnap(true);

  const finder = {
    hasCinemas: data.theatres.length > 0,
    cities: data.cities,
    city: data.city,
    onCity: data.selectCity,
    cityTheatres: data.cityTheatres,
    theatreId: data.theatreId,
    onTheatre: data.selectTheatre,
    onFind: () => data.chooseCinema(data.selectedTheatre),
  };

  const scheduleFailed = !data.loading && data.failed.shows;

  return (
    <div
      className="bms-home relative overflow-x-clip bg-ink"
      data-testid="home-page"
    >
      <main id="main-content">
        <span
          id="cinemas"
          aria-hidden="true"
          className="absolute left-0 top-0"
        />

        <Opening
          films={data.heroFilms}
          loading={data.loading}
          failed={scheduleFailed}
          onRetry={data.reload}
          finder={finder}
          scopeName={data.scopeTheatre?.name}
          activeId={activeId}
          onActive={setActiveId}
        />

        <Programme
          films={data.nowShowing}
          activeId={activeId}
          loading={data.loading}
          failed={scheduleFailed}
          onRetry={data.reload}
          scopeName={data.scopeTheatre?.name}
          onClearScope={data.clearScope}
          tail={false}
        />

        <Journey
          theatres={data.theatres}
          films={data.allNowShowing}
          shows={data.shows}
        />

        <NextOnScreen films={data.comingNext} />

        <Ask />

        <AccountSection isAuthenticated={isAuthenticated} />

        <BookingFAQ />
      </main>

      <SiteFooter isAuthenticated={isAuthenticated} />
    </div>
  );
};

export default Home;