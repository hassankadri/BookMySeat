
import React, { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Mail,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import PageShell from "../components/ui/PageShell";

const API_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
const WHATSAPP_NUMBER = process.env.REACT_APP_WHATSAPP_NUMBER;
const EASE = [0.22, 1, 0.36, 1];
const SUBJECTS = [
  "Ticket Booking", "Technical Issue", "Refund Request",
  "Group Booking", "Payment Issue", "Other",
];
const LOCATIONS = [
  { name: "Grand Galleria Mall", area: "Senapati Bapat Marg, Lower Parel", city: "Mumbai" },
  { name: "Phoenix Marketcity", area: "LBS Marg, Kurla West", city: "Mumbai" },
  { name: "Inorbit Mall", area: "Link Road, Malad West", city: "Mumbai" },
  { name: "R City Mall", area: "LBS Marg, Ghatkopar West", city: "Mumbai" },
  { name: "Viviana Mall", area: "Eastern Express Highway", city: "Thane" },
];
const EMPTY_FORM = {
  fullName: "", email: "", phone: "", subject: "", message: "", website: "",
};
const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#101014] px-4 py-3.5 text-sm text-white " +
  "outline-none placeholder:text-zinc-600 transition-all duration-300 " +
  "hover:border-white/20 focus:border-[#D71935]/70 focus:bg-[#171317] " +
  "focus:shadow-[0_0_0_3px_rgba(215,25,53,0.09)]";
const labelClass = "mb-2.5 block text-xs font-medium text-zinc-400";
const surface = "rounded-[22px] border border-white/10 bg-[#101013]/90";

function Eyebrow({ children, suffix }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.23em] text-[#ff526e] sm:text-[11px]">
      <span className="h-px w-7 bg-[#D71935]" />
      <span>{children}</span>
      {suffix && <span className="text-zinc-600">/ {suffix}</span>}
    </div>
  );
}

function Venue({ venue, index, isOpen, onToggle, reducedMotion }) {
  const directionsUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${venue.name}, ${venue.area}, ${venue.city}`);

  return (
    <div className={`border-b border-white/[0.08] transition-colors duration-300 ${isOpen ? "bg-white/[0.04]" : "hover:bg-white/[0.025]"}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="group flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <span className="w-6 shrink-0 text-[11px] tabular-nums text-[#ff526e]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="cine-head block truncate text-sm text-white">{venue.name}</span>
          <span className="mt-1 block text-xs text-zinc-500">{venue.city}</span>
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.25 }}
          className="text-zinc-500 group-hover:text-[#ff526e]"
        >
          <ChevronDown size={17} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] px-5 pb-5 pt-4 sm:pl-[68px]">
              <p className="flex items-start gap-2 text-xs leading-6 text-zinc-400">
                <MapPin size={14} className="mt-1 shrink-0 text-[#ff526e]" />
                {venue.area}, {venue.city}
              </p>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#ff778d] hover:text-white"
              >
                View on Maps
                <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const goToForm = () => {
    if (sent) setSent(false);
    formRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    window.setTimeout(() => nameRef.current?.focus({ preventScroll: true }), reducedMotion ? 0 : 450);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (sending) return;
    if (!form.subject) {
      toast.error("Choose what your message is about.");
      return;
    }
    setSending(true);
    try {
      // Preserve existing endpoint, payload and honeypot field.
      await axios.post(`${API_URL}/api/contact`, form);
      setForm({ ...EMPTY_FORM });
      setSent(true);
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

  const handleWhatsApp = () => {
    const digits = String(WHATSAPP_NUMBER || "").replace(/\D/g, "");
    if (!digits) {
      toast.error("WhatsApp number is not configured.");
      return;
    }
    const message = [
      "Hi BookMySeat!", "",
      `Name: ${form.fullName || "-"}`,
      `Email: ${form.email || "-"}`,
      `Phone: ${form.phone || "-"}`,
      `Subject: ${form.subject || "-"}`, "",
      `Message: ${form.message || "-"}`,
    ].join("\n");
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const enter = reducedMotion ? {} : {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.1 },
    transition: { duration: 0.7, ease: EASE },
  };

  return (
    <PageShell glow="left">
      <main className="relative mx-auto max-w-[1480px] px-5 pb-20 pt-10 text-white md:px-10 md:pt-14">
        {/* Same editorial header system as Cinemas. */}
        <motion.header
          {...enter}
          className="mb-9 flex flex-col justify-between gap-6 border-b border-white/10 pb-8 lg:mb-11 lg:flex-row lg:items-end"
        >
          <div className="min-w-0">
            <Eyebrow suffix="05">Customer care</Eyebrow>
            <h1 className="cine-display mt-5 text-[clamp(2.8rem,5.4vw,5.4rem)] leading-[.94] tracking-tight">
              Support <span className="text-[#ff4562]">& enquiries.</span>
            </h1>
          </div>
          <div className="max-w-[360px] lg:pb-1">
            <p className="text-sm leading-relaxed text-zinc-400 md:text-base">
              A question about your booking, payment or cinema visit? Tell us what happened. We'll help you find the next step.
            </p>
          </div>
        </motion.header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.14fr)_minmax(320px,.86fr)] lg:gap-8">
          <motion.section
            {...enter}
            ref={formRef}
            aria-label="Send a support message"
            className={`${surface} relative scroll-mt-28 overflow-hidden p-5 sm:p-8 lg:p-9`}
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top_right,rgba(215,25,53,.11),transparent_65%)]" />
            <div className="relative">
              <Eyebrow suffix="01">Get in touch</Eyebrow>
              <h2 className="cine-head mt-5 text-[clamp(1.7rem,3vw,2.7rem)] leading-tight">
                Tell us what's <span className="text-[#ff526e]">going on.</span>
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Send the details securely to our support team.
              </p>
              <div className="mt-7 border-t border-white/10" />

              <AnimatePresence mode="wait" initial={false}>
                {sent ? (
                  <motion.div
                    key="sent"
                    initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex min-h-[390px] flex-col items-start justify-center py-8"
                    role="status"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                      <Check size={28} />
                    </div>
                    <h3 className="cine-head mt-6 text-3xl">Message sent.</h3>
                    <p className="mt-3 max-w-sm text-sm leading-7 text-zinc-400">
                      Your enquiry was submitted successfully. You can send another message whenever you need to.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSent(false)}
                      className="group mt-7 inline-flex items-center gap-2 rounded-full bg-[#D71935] px-6 py-3 text-sm font-semibold transition-colors hover:bg-[#ea304b]"
                    >
                      Send another message
                      <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit}
                    className="mt-7 space-y-5"
                  >
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
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="bms-contact-name" className={labelClass}>Full name <span className="text-[#ff526e]">*</span></label>
                        <input ref={nameRef} id="bms-contact-name" name="fullName" type="text" required maxLength={100} autoComplete="name" placeholder="Your name" className={inputClass} value={form.fullName} onChange={handleChange} />
                      </div>
                      <div>
                        <label htmlFor="bms-contact-email" className={labelClass}>Email address <span className="text-[#ff526e]">*</span></label>
                        <input id="bms-contact-email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" className={inputClass} value={form.email} onChange={handleChange} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="bms-contact-phone" className={labelClass}>Phone number <span className="font-normal text-zinc-600">— optional</span></label>
                      <input id="bms-contact-phone" name="phone" type="tel" maxLength={24} autoComplete="tel" placeholder="+91 98765 43210" className={inputClass} value={form.phone} onChange={handleChange} />
                    </div>
                    <fieldset>
                      <legend className={`${labelClass} mb-3`}>What's this about? <span className="text-[#ff526e]">*</span></legend>
                      <div className="flex flex-wrap gap-2">
                        {SUBJECTS.map((subject) => (
                          <button
                            key={subject}
                            type="button"
                            aria-pressed={form.subject === subject}
                            onClick={() => setForm((previous) => ({ ...previous, subject }))}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-xs font-medium transition-all duration-200 ${
                              form.subject === subject
                                ? "border-[#D71935] bg-[#D71935]/20 text-white"
                                : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/25 hover:text-white"
                            }`}
                          >
                            {form.subject === subject && <Check size={13} className="text-[#ff526e]" />}
                            {subject}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div>
                      <div className="mb-2.5 flex justify-between gap-3">
                        <label htmlFor="bms-contact-message" className={labelClass}>Your message <span className="text-[#ff526e]">*</span></label>
                        <span className="text-[10px] tabular-nums text-zinc-600">{form.message.length} / 3000</span>
                      </div>
                      <textarea
                        id="bms-contact-message" name="message" required rows={6} maxLength={3000}
                        placeholder="Describe your issue. For booking questions, include your booking reference."
                        value={form.message} onChange={handleChange}
                        className={`${inputClass} min-h-[160px] resize-y leading-6`}
                      />
                    </div>
                    <div className="flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <p className="max-w-[230px] text-xs leading-5 text-zinc-500">Please don't include passwords or card details.</p>
                      <button
                        type="submit"
                        disabled={sending}
                        className="group inline-flex items-center justify-center gap-3 rounded-full bg-[#D71935] px-6 py-3.5 text-sm font-semibold transition-all duration-300 hover:bg-[#ed2a49] disabled:cursor-wait disabled:opacity-50"
                      >
                        <Send size={16} />
                        {sending ? "Sending message..." : "Send message"}
                        {!sending && <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.section>

          <aside className="space-y-5">
            <motion.section {...enter} className={`${surface} p-5 sm:p-7`}>
              <Eyebrow suffix="02">Contact channels</Eyebrow>
              <h2 className="cine-head mt-5 text-2xl">Reach us your way.</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <button type="button" onClick={goToForm} className="group flex min-h-[155px] flex-col items-start rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-[#D71935]/50 hover:bg-[#D71935]/[0.055]">
                  <span className="flex w-full items-center justify-between text-[#ff526e]"><Mail size={21} /><ArrowUpRight size={16} className="text-zinc-600 group-hover:text-white" /></span>
                  <span className="cine-head mt-auto pt-5 text-lg">Email support</span>
                  <span className="mt-1.5 text-xs leading-5 text-zinc-500">Send an enquiry through the form.</span>
                </button>
                <button type="button" onClick={handleWhatsApp} className="group flex min-h-[155px] flex-col items-start rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-[#D71935]/50 hover:bg-[#D71935]/[0.055]">
                  <span className="flex w-full items-center justify-between text-[#ff526e]"><MessageCircle size={21} /><ArrowUpRight size={16} className="text-zinc-600 group-hover:text-white" /></span>
                  <span className="cine-head mt-auto pt-5 text-lg">WhatsApp</span>
                  <span className="mt-1.5 text-xs leading-5 text-zinc-500">Continue with your filled-in details.</span>
                </button>
              </div>
            </motion.section>

            <motion.section {...enter} className={`${surface} overflow-hidden`}>
              <div className="flex items-end justify-between gap-4 border-b border-white/10 px-5 py-6 sm:px-7">
                <div>
                  <Eyebrow suffix="03">Find your cinema</Eyebrow>
                  <h2 className="cine-head mt-4 text-[26px]">Our locations<span className="text-[#ff526e]">.</span></h2>
                </div>
                <span className="shrink-0 text-[10px] tracking-wider text-zinc-500">05 VENUES</span>
              </div>
              {LOCATIONS.map((venue, index) => (
                <Venue key={venue.name} venue={venue} index={index} isOpen={expandedVenue === index} reducedMotion={reducedMotion} onToggle={() => setExpandedVenue((current) => current === index ? null : index)} />
              ))}
              <div className="flex items-center gap-2 px-5 py-5 text-xs leading-5 text-zinc-500 sm:px-7">
                <MapPin size={15} className="shrink-0 text-[#ff526e]" />
                Select a cinema for its address and directions.
              </div>
            </motion.section>
            <motion.div {...enter} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <Ticket size={18} className="mt-0.5 shrink-0 text-[#ff526e]" />
              <div>
                <p className="cine-head text-sm">Already have a booking?</p>
                <p className="mt-1.5 text-xs leading-5 text-zinc-500">Include your booking code so support can identify your reservation.</p>
              </div>
            </motion.div>
          </aside>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">BookMySeat / Customer care</span>
          <span className="flex items-center gap-2 text-xs text-zinc-500"><ShieldCheck size={15} /> Your experience matters.</span>
        </div>
      </main>
    </PageShell>
  );
}
