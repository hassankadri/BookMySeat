
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowRight,
  Check,
  Loader2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

const TYPES = [
  "ANY",
  "REGULAR",
  "PREMIUM",
  "RECLINER",
  "LOUNGER",
  "WHEELCHAIR",
];

const VIEWS = [
  { value: "CENTER", label: "Balanced" },
  { value: "FRONT", label: "Closer" },
  { value: "BACK", label: "Further back" },
];

const formatPrice = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

export default function SeatIntelligencePanel({
  showId,
  apiUrl,
  token,
  selectedCount = 0,
  busy = false,
  onApply,
}) {
  const [count, setCount] = useState(2);
  const [view, setView] = useState("CENTER");
  const [type, setType] = useState("ANY");
  const [aisle, setAisle] = useState(false);
  const [budget, setBudget] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchedKey, setSearchedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const preferenceKey = useMemo(
    () => JSON.stringify({
      showId,
      count,
      view,
      type,
      aisle,
      budget,
    }),
    [showId, count, view, type, aisle, budget]
  );

  useEffect(() => {
    setSuggestions([]);
    setSearchedKey("");
    setError("");
  }, [showId]);

  const current = searchedKey === preferenceKey;
  const visibleSuggestions = current ? suggestions : [];

  const canApply =
    !busy && !applying && selectedCount === 0;

  const findSeats = async () => {
    if (!showId || !token || loading || applying) return;

    const parsedBudget =
      budget.trim() === "" ? null : Number(budget);

    if (
      parsedBudget !== null &&
      (
        !Number.isFinite(parsedBudget) ||
        parsedBudget <= 0 ||
        parsedBudget > 1000000
      )
    ) {
      setError("Enter a valid total budget, or leave it blank.");
      return;
    }

    const requestKey = preferenceKey;

    setLoading(true);
    setError("");
    setSearchedKey("");

    try {
      const { data } = await axios.get(
        `${apiUrl.replace(/\/+$/, "")}/api/seat-intelligence/${encodeURIComponent(showId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            count,
            view,
            type,
            aisle: String(aisle),
            ...(parsedBudget !== null
              ? { budget: parsedBudget }
              : {}),
          },
          timeout: 12000,
        }
      );

      if (
        !data?.success ||
        !Array.isArray(data.suggestions)
      ) {
        throw new Error(
          "The recommendation service returned an invalid response."
        );
      }

      setSuggestions(data.suggestions);
      setSearchedKey(requestKey);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Recommendations are unavailable. Manual seat selection still works."
      );
    } finally {
      setLoading(false);
    }
  };

  const applySeats = async (suggestion) => {
    if (
      !canApply ||
      typeof onApply !== "function"
    ) {
      return;
    }

    setApplying(true);
    setError("");

    try {
      const success = await onApply(suggestion);

      if (!success) {
        setError(
          "Those seats could not be held. Refresh recommendations and try again."
        );
        setSearchedKey("");
      }
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Could not hold the suggested seats."
      );
      setSearchedKey("");
    } finally {
      setApplying(false);
    }
  };

  return (
    <section
      className="mb-6 rounded-2xl border border-white/10 bg-[#111115] p-4 text-white sm:p-5"
      aria-label="Smart seat finder"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D71935]/15 text-[#f36a83]">
          <Sparkles size={18} />
        </span>

        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight">
            Find your ideal seats
          </h3>
          <p className="text-xs text-white/50">
            A smarter way to choose seats together.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="text-xs text-white/70">
          Seats together
          <select
            value={count}
            onChange={(event) =>
              setCount(Number(event.target.value))
            }
            className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#1c1c21] px-3 py-2.5 text-sm text-white outline-none focus:border-[#D71935]"
          >
            {Array.from(
              { length: 10 },
              (_, index) => index + 1
            ).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "seat" : "seats"}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-white/70">
          Viewing position
          <select
            value={view}
            onChange={(event) =>
              setView(event.target.value)
            }
            className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#1c1c21] px-3 py-2.5 text-sm text-white outline-none focus:border-[#D71935]"
          >
            {VIEWS.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-white/70">
          Seat category
          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value)
            }
            className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#1c1c21] px-3 py-2.5 text-sm text-white outline-none focus:border-[#D71935]"
          >
            {TYPES.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item === "ANY"
                  ? "Any category"
                  : item.charAt(0) +
                    item.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-white/70">
          Total budget (₹)
          <input
            type="number"
            inputMode="decimal"
            min="1"
            max="1000000"
            step="1"
            value={budget}
            onChange={(event) =>
              setBudget(event.target.value)
            }
            placeholder="No limit"
            className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#1c1c21] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#D71935]"
          />
        </label>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-white/75">
        <input
          type="checkbox"
          checked={aisle}
          onChange={(event) =>
            setAisle(event.target.checked)
          }
          className="accent-[#D71935]"
        />
        Prefer aisle access
      </label>

      <button
        type="button"
        disabled={
          !token ||
          !showId ||
          loading ||
          applying
        }
        onClick={findSeats}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#D71935] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e72a47] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <Loader2
            size={16}
            className="animate-spin"
          />
        ) : (
          <SlidersHorizontal size={16} />
        )}

        {loading
          ? "Finding available seats…"
          : "Find best seats"}
      </button>

      {error && (
        <p
          role="alert"
          className="mt-3 text-xs leading-5 text-[#f9a1ae]"
        >
          {error}
        </p>
      )}

      {selectedCount > 0 && (
        <p className="mt-3 text-xs leading-5 text-white/55">
          Your existing seat selection is safe.
          Deselect your current seats before
          applying a suggested group.
        </p>
      )}

      {current &&
        !loading &&
        visibleSuggestions.length === 0 &&
        !error && (
          <p className="mt-4 text-xs leading-5 text-white/55">
            No adjacent seats match these
            preferences. Try a different category,
            group size or budget.
          </p>
        )}

      {visibleSuggestions.length > 0 && (
        <div
          className="mt-4 space-y-2"
          aria-live="polite"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
            Live recommendations
          </p>

          {visibleSuggestions.map(
            (suggestion, index) => (
              <div
                key={`${suggestion.seatIds.join("-")}-${index}`}
                className="rounded-xl border border-white/10 bg-white/[0.035] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-sm font-semibold">
                      {suggestion.seatIds.join(" · ")}
                    </span>

                    <p className="mt-1 text-[11px] text-white/50">
                      {suggestion.category.toLowerCase()}
                      {" · "}
                      {suggestion.reasons
                        ?.slice(0, 2)
                        .join(" · ")}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {formatPrice(
                        suggestion.totalPrice
                      )}
                    </div>

                    <p className="text-[11px] text-white/50">
                      Score {suggestion.score}/100
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canApply}
                  onClick={() =>
                    applySeats(suggestion)
                  }
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#D71935]/50 px-3 py-2 text-xs font-semibold text-[#ff9eae] transition hover:bg-[#D71935]/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {applying ? (
                    <Loader2
                      size={14}
                      className="animate-spin"
                    />
                  ) : selectedCount > 0 ? (
                    <Check size={14} />
                  ) : (
                    <ArrowRight size={14} />
                  )}

                  {applying
                    ? "Holding seats…"
                    : selectedCount > 0
                      ? "Current seats held"
                      : "Hold these seats"}
                </button>
              </div>
            )
          )}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-5 text-white/40">
        Recommendations are based on layout,
        price and current availability. Seats are
        not reserved until you hold them.
      </p>
    </section>
  );
}
