
import {
  deriveComingNext,
  deriveNowShowing,
  deriveWeek,
  filmHref,
  getYoutubeId,
  nextShowLine,
  releaseLabel,
} from "./schedule";

const NOW = new Date("2026-10-09T10:00:00Z").getTime();
const h = (hours) => new Date(NOW + hours * 3600 * 1000).toISOString();
const film = (id) => ({ _id: id, title: `Film ${id}` });
const cinema = (id) => ({ _id: id, name: `Cinema ${id}` });
const show = (id, movie, theatre, startTime, extra = {}) => ({
  _id: id,
  movie: film(movie),
  theatre: cinema(theatre),
  startTime,
  ...extra,
});

const SHOWS = [
  show("s1", "m1", "t1", h(2), { language: "Hindi", format: "2D", price: 220 }),
  show("s2", "m1", "t2", h(30), { language: "Hindi", format: "IMAX", price: 350 }),
  show("s3", "m2", "t1", h(5), { language: "English", format: "2D" }),
  show("s4", "m3", "t3", h(24 * 6), { language: "hindi ", format: "3D" }),
  show("s5", "m4", "t2", h(24 * 8), { language: "Marathi", format: "2D" }), // outside the 7-day window
  show("s6", "m5", "t1", h(-3), { language: "Tamil", format: "2D" }), // already started
  show("s7", "m6", "t1", "not a date", { language: "Tamil" }), // invalid time
  { _id: "s8", startTime: h(4), theatre: cinema("t1") }, // no movie
];

describe("deriveNowShowing", () => {
  const all = deriveNowShowing(SHOWS, null, NOW);

  test("counts each film once and ignores past, invalid and movie-less shows", () => {
    expect(all.map((f) => f._id).sort()).toEqual(["m1", "m2", "m3", "m4"]);
  });

  test("attaches each film's earliest show and its counts", () => {
    const m1 = all.find((f) => f._id === "m1");
    expect(m1.nextShow._id).toBe("s1");
    expect(m1.showCount).toBe(2);
    expect(m1.theatreCount).toBe(2);
    expect(m1.theatreIds).toBeUndefined();
  });

  test("can be limited to one cinema", () => {
    const t2 = deriveNowShowing(SHOWS, "t2", NOW);
    expect(t2.map((f) => f._id).sort()).toEqual(["m1", "m4"]);
    expect(t2.find((f) => f._id === "m1").nextShow._id).toBe("s2");
  });

  test("tolerates bad input", () => {
    expect(deriveNowShowing(undefined, null, NOW)).toEqual([]);
    expect(deriveNowShowing(null, "t1", NOW)).toEqual([]);
  });
});

describe("deriveWeek", () => {
  const week = deriveWeek(SHOWS, NOW);

  test("counts only upcoming shows in the next seven days", () => {
    expect(week.shows).toBe(4); // s1, s2, s3, s4
    expect(week.films).toBe(3); // m1, m2, m3
    expect(week.cinemas).toBe(3); // t1, t2, t3
  });

  test("lists distinct languages and formats, most common first, ignoring case", () => {
    expect(week.languages).toEqual(["Hindi", "English"]); // "hindi " merges into Hindi
    expect(week.formats).toEqual(["2D", "IMAX", "3D"]);
  });

  test("reports nothing when there are no shows", () => {
    expect(deriveWeek([], NOW)).toEqual({ films: 0, shows: 0, cinemas: 0, languages: [], formats: [] });
    expect(deriveWeek(undefined, NOW).shows).toBe(0);
  });
});

describe("deriveComingNext", () => {
  test("never repeats a film that is already playing", () => {
    const coming = [film("m1"), film("c1"), film("c2")];
    expect(deriveComingNext(coming, [film("m1")]).map((f) => f._id)).toEqual(["c1", "c2"]);
  });
  test("tolerates bad input", () => {
    expect(deriveComingNext(undefined, undefined)).toEqual([]);
  });
});

describe("formatting helpers", () => {
  test("getYoutubeId handles watch, short, embed and junk links", () => {
    expect(getYoutubeId("https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=3")).toBe("aqz-KE-bpKQ");
    expect(getYoutubeId("https://youtu.be/aqz-KE-bpKQ")).toBe("aqz-KE-bpKQ");
    expect(getYoutubeId("https://www.youtube.com/embed/aqz-KE-bpKQ")).toBe("aqz-KE-bpKQ");
    expect(getYoutubeId("not a url")).toBeNull();
    expect(getYoutubeId("")).toBeNull();
    expect(getYoutubeId(undefined)).toBeNull();
  });

  test("releaseLabel prefers the date, then the year, else null", () => {
    expect(releaseLabel({ releaseDate: "2026-12-12T00:00:00Z" })).toMatch(/12/);
    expect(releaseLabel({ releaseYear: 2027 })).toBe("2027");
    expect(releaseLabel({})).toBeNull();
    expect(releaseLabel({ releaseDate: "garbage", releaseYear: 2027 })).toBe("2027");
  });

  test("filmHref keeps the cinema when it is known", () => {
    expect(filmHref({ _id: "m1", nextShow: { theatre: { _id: "t9" } } })).toBe("/movie/m1?theatre=t9");
    expect(filmHref({ _id: "m1" })).toBe("/movie/m1");
  });

  test("nextShowLine uses only what exists", () => {
    const line = nextShowLine({ nextShow: { startTime: h(2), theatre: { name: "Plaza" }, price: 350 } });
    expect(line).toMatch(/^Next show .+ at Plaza, from ₹350$/);
    const bare = nextShowLine({ nextShow: { startTime: h(2) } });
    expect(bare).toMatch(/^Next show \d/);
    expect(bare).not.toMatch(/ at |₹/);
    expect(nextShowLine({ nextShow: { startTime: h(2), price: "abc" } })).not.toMatch(/₹/);
    expect(nextShowLine({})).toBe("");
  });
});
