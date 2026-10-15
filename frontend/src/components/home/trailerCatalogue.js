
const items = [
  ["godzilla-vs-kong", "Godzilla vs. Kong", /godzilla(?:\s+vs?\s+kong)?/],
  ["the-odyssey", "The Odyssey", /(?:the\s+)?odyssey/],
  ["spider-man-brand-new-day", "Spider-Man: Brand New Day", /spider\s*man\s+brand\s+new\s+day/],
  ["fast-and-furious-9", "Fast & Furious 9", /fast\s*(?:and\s*)?furious\s*(?:9|nine)|\bf9\b/],
  ["eternals", "Eternals", /\beternals\b/],
  ["star-wars-episode-ix", "Star Wars: Episode IX", /star\s+wars\s+(?:episode\s+)?(?:ix|9)|rise\s+of\s+skywalker/],
  ["captain-marvel", "Captain Marvel", /captain\s+marvel/],
  ["spider-man-no-way-home", "Spider-Man: No Way Home", /spider\s*man\s+no\s+way\s+home/],
  ["mortal-kombat", "Mortal Kombat", /mortal\s+kombat/],
  ["avatar-fire-and-ash", "Avatar: Fire and Ash", /avatar\s+(?:fire\s+and\s+ash|3)/],
  ["cruella", "Cruella", /\bcruella\b/],

  // Enable when the X-Men trailer has been downloaded and optimized.
  // ["x-men-dark-phoenix", "X-Men: Dark Phoenix", /dark\s+phoenix|x\s*men/],
];

const trailerCatalogue = items.map(([key, title, match]) => ({
  key,
  title,
  match,
  src: `/trailers/optimized/${key}.mp4`,
  poster: `/trailers/optimized/${key}.jpg`,
}));

export default trailerCatalogue;
