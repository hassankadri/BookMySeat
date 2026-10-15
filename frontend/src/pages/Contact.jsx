
import React, { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

// ============================================================
// BOOKMYSEAT — CONTACT / CINEMATIC SOFT GLASS
// Single-page replacement; no extra CSS or dependencies.
//
// Preserves the existing POST /api/contact request shape,
// honeypot field, configured WhatsApp number, and 5 venues.
// ============================================================

const API_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const WHATSAPP_NUMBER = process.env.REACT_APP_WHATSAPP_NUMBER;

const SUBJECTS = [
  "Ticket Booking",
  "Technical Issue",
  "Refund Request",
  "Group Booking",
  "Payment Issue",
  "Other",
];

const LOCATIONS = [
  {
    name: "Grand Galleria Mall",
    area: "Senapati Bapat Marg, Lower Parel",
    city: "Mumbai",
  },
  {
    name: "Phoenix Marketcity",
    area: "LBS Marg, Kurla West",
    city: "Mumbai",
  },
  {
    name: "Inorbit Mall",
    area: "Link Road, Malad West",
    city: "Mumbai",
  },
  {
    name: "R City Mall",
    area: "LBS Marg, Ghatkopar West",
    city: "Mumbai",
  },
  {
    name: "Viviana Mall",
    area: "Eastern Express Highway",
    city: "Thane",
  },
];

const EMPTY_FORM = {
  fullName: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
  website: "", // Existing hidden bot-trap field.
};

const EASE = [0.22, 1, 0.36, 1];

const inputClass =
  "w-full rounded-[15px] border border-white/[0.085] " +
  "bg-[#0a0b0f]/80 px-4 py-[15px] text-[14px] text-white " +
  "placeholder:text-white/25 outline-none transition-[border-color,background-color,box-shadow] duration-300 " +
  "hover:border-white/[0.16] focus:border-[#d71935]/65 focus:bg-[#101015] " +
  "focus:shadow-[0_0_0_3px_rgba(215,25,53,0.075)]";

const labelClass =
  "mb-2.5 block text-[11px] font-medium tracking-[0.055em] text-white/55";

function SectionEyebrow({ number, children }) {
  return (
    <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
      <span className="text-[#d71935]">{number}</span>
      <span className="h-px w-7 bg-[#d71935]/55" />
      <span>{children}</span>
    </div>
  );
}

function Venue({ venue, index, open, onToggle, reducedMotion }) {
  const directionsUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${venue.name}, ${venue.area}, ${venue.city}`);

  return (
    <div
      className={`overflow-hidden border-b transition-colors duration-300 ${
        open ? "border-white/[0.12] bg-white/[0.035]" : "border-white/[0.07]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group flex w-full items-center gap-4 px-4 py-4 text-left sm:px-5"
      >
        <span className="w-7 shrink-0 font-mono text-[11px] text-white/25">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-white/85 transition-colors group-hover:text-white">
            {venue.name}
          </p>
          <p className="mt-1 truncate text-[12px] text-white/35">
            {venue.city}
          </p>
        </div>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] text-white/45 transition group-hover:border-[#d71935]/35 group-hover:text-[#ff6c81]">
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.25 }}
          >
            <ChevronDown size={15} />
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.055] px-4 pb-5 pt-4 sm:pl-16 sm:pr-5">
              <p className="flex items-start gap-2 text-[12px] leading-6 text-white/50">
                <MapPin
                  size={14}
                  className="mt-[5px] shrink-0 text-[#df3953]"
                />
                {venue.area}, {venue.city}
              </p>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#ff7488] transition hover:gap-2.5 hover:text-white"
              >
                View on Maps <ArrowUpRight size={14} />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Contact() {
  const reducedMotion = useReducedMotion();
  const formRef = useRef(null);
  const nameRef = useRef(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [expandedVenue, setExpandedVenue] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const setSubject = (subject) => {
    setForm((current) => ({ ...current, subject }));
  };

  const goToForm = () => {
    if (sent) setSent(false);
    formRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "center",
    });
    window.setTimeout(
      () => nameRef.current?.focus({ preventScroll: true }),
      reducedMotion ? 0 : 500
    );
  };

  // Same contact endpoint and payload as the existing page.
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (sending) return;

    if (!form.subject) {
      toast.error("Choose what your message is about.");
      return;
    }

    setSending(true);

    try {
      await axios.post(`${API_URL}/api/contact`, form);
      setSent(true);
      setForm({ ...EMPTY_FORM });
      toast.success("Message sent.");
    } catch (error) {
      console.error("Contact request failed:", error);

      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Could not send your message. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  // Reuses the existing WhatsApp configuration and message shape.
  const handleWhatsApp = () => {
    const digits = String(WHATSAPP_NUMBER || "").replace(/\D/g, "");

    if (!digits) {
      toast.error("WhatsApp number is not configured.");
      return;
    }

    const message = [
      "Hi BookMySeat!",
      "",
      `Name: ${form.fullName || "-"}`,
      `Email: ${form.email || "-"}`,
      `Phone: ${form.phone || "-"}`,
      `Subject: ${form.subject || "-"}`,
      "",
      `Message: ${form.message || "-"}`,
    ].join("\n");

    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const entryMotion = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.15 },
        transition: { duration: 0.65, ease: EASE },
      };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#07080b] pb-24 pt-[94px] text-white sm:pt-[104px]">
      {/* Ambient red light stays behind the interactive content. */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-[340px] -top-[260px] h-[760px] w-[760px] rounded-full bg-[radial-gradient(circle,rgba(215,25,53,0.155),transparent_67%)]" />
        <div className="absolute -right-[330px] top-[310px] h-[650px] w-[650px] rounded-full bg-[radial-gradient(circle,rgba(215,25,53,0.075),transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px)] [background-size:100%_90px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-[1300px] px-5 sm:px-7 lg:px-10">
        {/* ====================================================
            EDITORIAL HERO
        ==================================================== */}
        <section className="relative border-b border-white/[0.075] pb-7 sm:pb-9">
          <motion.div
            {...entryMotion}
            className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12"
          >
            <div>
              <SectionEyebrow number="BMS / 05">Customer care</SectionEyebrow>

              <h1 className="mt-5 text-[clamp(2.45rem,4.5vw,4.3rem)] font-semibold leading-[1.05] tracking-[-0.065em] text-white">
                Support <span className="text-white/65">& enquiries</span><span className="text-[#d71935]">.</span>
              </h1>

              <p className="mt-4 max-w-[540px] text-[14px] leading-[1.75] text-white/52 sm:text-[15px]">
                A question about your booking, payment or cinema visit? Tell us what happened.
                We'll help you find the next step.
              </p>
            </div>

            <div className="hidden border-l border-white/10 pb-1 pl-7 lg:block">
              <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">
                <span>Customer care</span>
                <Headphones size={17} className="text-[#d71935]" />
              </div>

              <p className="mt-4 text-[18px] font-medium leading-[1.45] tracking-[-0.035em] text-white/78">
                Good cinema experiences deserve good support.
              </p>

              <button
                type="button"
                onClick={goToForm}
                className="group mt-4 inline-flex items-center gap-3 text-[12px] font-semibold text-white/72 transition hover:text-white"
              >
                Write to us
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.14] transition group-hover:border-[#d71935]/55 group-hover:bg-[#d71935]/15">
                  <ArrowDownRight size={16} />
                </span>
              </button>
            </div>
          </motion.div>
        </section>

        {/* ====================================================
            FORM + CONTACT CHANNELS
        ==================================================== */}
        <section className="mt-9 grid items-start gap-5 lg:grid-cols-[minmax(0,1.16fr)_minmax(330px,0.84fr)] lg:gap-6">
          {/* FORM: no artificial full-height / empty space */}
          <motion.div
            {...entryMotion}
            ref={formRef}
            className="relative overflow-hidden rounded-[27px] border border-white/[0.085] bg-[linear-gradient(145deg,rgba(255,255,255,0.057),rgba(255,255,255,0.014)_48%,rgba(215,25,53,0.045))] p-5 shadow-[0_25px_100px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8 lg:p-9"
          >
            <div className="pointer-events-none absolute right-0 top-0 h-44 w-44 bg-[radial-gradient(circle_at_top_right,rgba(215,25,53,0.15),transparent_70%)]" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionEyebrow number="01">Send a message</SectionEyebrow>
                <Mail size={17} className="text-white/35" />
              </div>

              <h2 className="mt-5 text-[clamp(1.75rem,3.1vw,2.65rem)] font-semibold leading-tight tracking-[-0.052em]">
                Tell us what's going on.
              </h2>

              <p className="mt-2.5 text-[13px] leading-6 text-white/43">
                Fill in the details below and send them directly to our support inbox.
              </p>

              <div className="mt-7 h-px bg-white/[0.085]" />

              <AnimatePresence mode="wait" initial={false}>
                {sent ? (
                  <motion.div
                    key="sent"
                    initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex min-h-[420px] flex-col items-start justify-center py-10"
                    role="status"
                    aria-live="polite"
                  >
                    <motion.div
                      initial={reducedMotion ? false : { scale: 0.75 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 180, damping: 15 }}
                      className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.085] text-emerald-300"
                    >
                      <Check size={30} strokeWidth={1.8} />
                    </motion.div>

                    <h3 className="mt-6 text-3xl font-semibold tracking-[-0.05em]">
                      Message sent.
                    </h3>

                    <p className="mt-3 max-w-sm text-sm leading-7 text-white/50">
                      Your enquiry was submitted successfully. You can send another message whenever you need to.
                    </p>

                    <button
                      type="button"
                      onClick={() => setSent(false)}
                      className="group mt-8 inline-flex items-center gap-2 rounded-full bg-[#D71935] px-6 py-3.5 text-[13px] font-semibold transition hover:bg-[#ef2b48]"
                    >
                      Send another message
                      <ArrowRight
                        size={15}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit}
                    className="mt-7"
                  >
                    {/* Existing honeypot field for backend bot filtering. */}
                    <input
                      type="text"
                      name="website"
                      value={form.website}
                      onChange={handleChange}
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      className="pointer-events-none absolute -left-[9999px] h-px w-px opacity-0"
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClass} htmlFor="bms-contact-name">
                          Full name <span className="text-[#d71935]">*</span>
                        </label>

                        <input
                          ref={nameRef}
                          id="bms-contact-name"
                          type="text"
                          name="fullName"
                          value={form.fullName}
                          onChange={handleChange}
                          required
                          maxLength={100}
                          autoComplete="name"
                          placeholder="Your name"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className={labelClass} htmlFor="bms-contact-email">
                          Email address <span className="text-[#d71935]">*</span>
                        </label>

                        <input
                          id="bms-contact-email"
                          type="email"
                          name="email"
                          value={form.email}
                          onChange={handleChange}
                          required
                          maxLength={254}
                          autoComplete="email"
                          placeholder="you@example.com"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className={labelClass} htmlFor="bms-contact-phone">
                        Phone number{" "}
                        <span className="font-normal text-white/25">— optional</span>
                      </label>

                      <input
                        id="bms-contact-phone"
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        maxLength={24}
                        autoComplete="tel"
                        placeholder="+91 98765 43210"
                        className={inputClass}
                      />
                    </div>

                    <fieldset className="mt-7">
                      <legend className="mb-3 text-[11px] font-medium tracking-[0.055em] text-white/55">
                        What's this about? <span className="text-[#d71935]">*</span>
                      </legend>

                      <div className="flex flex-wrap gap-2">
                        {SUBJECTS.map((subject) => {
                          const active = form.subject === subject;

                          return (
                            <motion.button
                              key={subject}
                              type="button"
                              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                              onClick={() => setSubject(subject)}
                              aria-pressed={active}
                              className={`relative overflow-hidden rounded-full border px-3.5 py-2.5 text-[11px] font-medium tracking-[0.015em] transition-colors duration-200 sm:px-4 ${
                                active
                                  ? "border-[#d71935]/80 bg-[#d71935]/[0.16] text-white"
                                  : "border-white/[0.105] bg-white/[0.035] text-white/55 hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
                              }`}
                            >
                              <span className="relative z-10 inline-flex items-center gap-1.5">
                                {active && (
                                  <Check
                                    size={12}
                                    strokeWidth={2.5}
                                    className="text-[#ff7589]"
                                  />
                                )}
                                {subject}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <div className="mt-7">
                      <div className="mb-2.5 flex items-center justify-between gap-3">
                        <label
                          className="text-[11px] font-medium tracking-[0.055em] text-white/55"
                          htmlFor="bms-contact-message"
                        >
                          Your message <span className="text-[#d71935]">*</span>
                        </label>

                        <span className="font-mono text-[10px] text-white/30">
                          {form.message.length} / 3000
                        </span>
                      </div>

                      <textarea
                        id="bms-contact-message"
                        name="message"
                        value={form.message}
                        onChange={handleChange}
                        required
                        maxLength={3000}
                        rows={6}
                        placeholder="Tell us a little more about your issue. If it's about a booking, include your booking reference."
                        className={`${inputClass} min-h-[162px] resize-y leading-6`}
                      />
                    </div>

                    <div className="mt-7 flex flex-col gap-3 border-t border-white/[0.075] pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <p className="max-w-[205px] text-[11px] leading-[1.7] text-white/33">
                        Please don't include card details or passwords.
                      </p>

                      <motion.button
                        type="submit"
                        disabled={sending}
                        whileHover={reducedMotion ? undefined : { y: -2 }}
                        whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                        className="group inline-flex shrink-0 items-center justify-center gap-3 rounded-full bg-[#D71935] px-7 py-3.5 text-[13px] font-semibold text-white shadow-[0_10px_35px_rgba(215,25,53,0.18)] transition-colors hover:bg-[#ef2b48] disabled:cursor-wait disabled:opacity-50"
                      >
                        <Send size={16} />
                        {sending ? "Sending message..." : "Send message"}
                        {!sending && (
                          <ArrowUpRight
                            size={16}
                            className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          />
                        )}
                      </motion.button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* RIGHT: channels + interactive venues */}
          <div className="space-y-5">
            <motion.div
              {...entryMotion}
              className="overflow-hidden rounded-[27px] border border-white/[0.085] bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] sm:p-7"
            >
              <SectionEyebrow number="02">Reach us your way</SectionEyebrow>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <motion.button
                  type="button"
                  whileHover={reducedMotion ? undefined : { y: -3 }}
                  onClick={goToForm}
                  className="group flex min-h-[170px] flex-col items-start rounded-[19px] border border-white/[0.085] bg-[#0c0c10]/75 p-5 text-left transition-colors hover:border-[#d71935]/35 hover:bg-[#151216]"
                >
                  <span className="flex w-full items-center justify-between">
                    <Mail
                      size={21}
                      strokeWidth={1.8}
                      className="text-[#f15a72]"
                    />
                    <ArrowUpRight
                      size={17}
                      className="text-white/25 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
                    />
                  </span>
                  <span className="mt-auto block pt-5 text-[17px] font-semibold tracking-[-0.035em]">
                    Email support
                  </span>
                  <span className="mt-2 text-[12px] leading-5 text-white/40">
                    Send an enquiry through the form.
                  </span>
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={reducedMotion ? undefined : { y: -3 }}
                  onClick={handleWhatsApp}
                  className="group flex min-h-[170px] flex-col items-start rounded-[19px] border border-white/[0.085] bg-[#0c0c10]/75 p-5 text-left transition-colors hover:border-[#d71935]/35 hover:bg-[#151216]"
                >
                  <span className="flex w-full items-center justify-between">
                    <MessageCircle
                      size={21}
                      strokeWidth={1.8}
                      className="text-[#f15a72]"
                    />
                    <ArrowUpRight
                      size={17}
                      className="text-white/25 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
                    />
                  </span>
                  <span className="mt-auto block pt-5 text-[17px] font-semibold tracking-[-0.035em]">
                    WhatsApp
                  </span>
                  <span className="mt-2 text-[12px] leading-5 text-white/40">
                    Continue with your filled-in details.
                  </span>
                </motion.button>
              </div>
            </motion.div>

            <motion.div
              {...entryMotion}
              className="overflow-hidden rounded-[27px] border border-white/[0.085] bg-[linear-gradient(155deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))]"
            >
              <div className="flex items-end justify-between gap-4 border-b border-white/[0.075] px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
                <div>
                  <SectionEyebrow number="03">Find your cinema</SectionEyebrow>
                  <h2 className="mt-4 text-[25px] font-semibold tracking-[-0.055em]">
                    Our locations<span className="text-[#d71935]">.</span>
                  </h2>
                </div>
                <span className="pb-1 font-mono text-[11px] text-white/30">
                  05 VENUES
                </span>
              </div>

              <div className="pb-1">
                {LOCATIONS.map((venue, index) => (
                  <Venue
                    key={venue.name}
                    venue={venue}
                    index={index}
                    open={expandedVenue === index}
                    onToggle={() =>
                      setExpandedVenue((current) =>
                        current === index ? null : index
                      )
                    }
                    reducedMotion={reducedMotion}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 px-5 py-5 sm:px-7">
                <MapPin
                  size={15}
                  strokeWidth={1.8}
                  className="text-[#d71935]"
                />
                <p className="text-[11px] leading-5 text-white/35">
                  Tap a cinema to see its address and map link.
                </p>
              </div>
            </motion.div>

            <motion.div
              {...entryMotion}
              className="flex items-start gap-3 rounded-[21px] border border-white/[0.07] bg-white/[0.025] p-5"
            >
              <Ticket
                size={17}
                className="mt-0.5 shrink-0 text-[#d94a63]"
              />
              <div>
                <p className="text-[13px] font-medium text-white/80">
                  Already have a booking?
                </p>
                <p className="mt-1.5 text-[12px] leading-5 text-white/38">
                  Include your booking code in the message so support can identify your reservation.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* PAGE FOOTER */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-6">
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/25">
            BookMySeat / Support
          </span>
          <span className="flex items-center gap-2 text-[11px] text-white/30">
            <ShieldCheck size={14} />
            Every enquiry matters.
          </span>
        </div>
      </div>
    </main>
  );
}
