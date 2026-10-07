import React, {
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  Check,
  Mail,
  MapPin,
  MessageCircle,
  Send,
} from "lucide-react";

import axios from "axios";
import toast from "react-hot-toast";

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

const WHATSAPP_NUMBER =
  process.env.REACT_APP_WHATSAPP_NUMBER;

// =====================================================
// DATA
// =====================================================

const locations = [
  {
    name:
      "Grand Galleria Mall",

    address:
      "Senapati Bapat Marg, Lower Parel",

    city:
      "Mumbai",
  },

  {
    name:
      "Phoenix Marketcity",

    address:
      "LBS Marg, Kurla West",

    city:
      "Mumbai",
  },

  {
    name:
      "Inorbit Mall",

    address:
      "Link Road, Malad West",

    city:
      "Mumbai",
  },

  {
    name:
      "R City Mall",

    address:
      "LBS Marg, Ghatkopar West",

    city:
      "Mumbai",
  },

  {
    name:
      "Viviana Mall",

    address:
      "Eastern Express Highway",

    city:
      "Thane",
  },
];

const subjects = [
  "Ticket Booking",
  "Technical Issue",
  "Refund Request",
  "Group Booking",
  "Payment Issue",
  "Other",
];

// =====================================================
// PAGE
// =====================================================

const Contact = () => {
  const [
    form,
    setForm,
  ] = useState({
    fullName: "",
    email: "",
    phone: "",
    subject: "",
    message: "",

    // Hidden bot trap.
    website: "",
  });

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    sent,
    setSent,
  ] = useState(false);

  // ===================================================
  // INPUT
  // ===================================================

  const handleChange =
    (event) => {
      const {
        name,
        value,
      } =
        event.target;

      setForm(
        (current) => ({
          ...current,

          [name]:
            value,
        })
      );
    };

  // ===================================================
  // EMAIL
  // ===================================================

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (sending) {
        return;
      }

      setSending(true);

      try {
        await axios.post(
          `${API_URL}/api/contact`,
          form
        );

        setSent(true);

        setForm({
          fullName: "",
          email: "",
          phone: "",
          subject: "",
          message: "",
          website: "",
        });

        toast.success(
          "Message sent."
        );

        setTimeout(
          () => {
            setSent(false);
          },
          3500
        );
      } catch (error) {
        console.error(
          "Contact error:",
          error
        );

        toast.error(
          error.response
            ?.data
            ?.error ||
            "Could not send your message."
        );
      } finally {
        setSending(false);
      }
    };

  // ===================================================
  // WHATSAPP
  // ===================================================

  const handleWhatsApp =
    () => {
      if (
        !WHATSAPP_NUMBER
      ) {
        toast.error(
          "WhatsApp number is not configured."
        );

        return;
      }

      const text = [
        "Hi BookMySeat!",
        "",
        `Name: ${form.fullName || "-"}`,
        `Email: ${form.email || "-"}`,
        `Phone: ${form.phone || "-"}`,
        `Subject: ${form.subject || "-"}`,
        "",
        `Message: ${form.message || "-"}`,
      ].join("\n");

      const url =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
          text
        )}`;

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    };

  // ===================================================
  // UI
  // ===================================================

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08090b] pt-28 pb-16">

      {/* BACKGROUND */}

      <motion.div
        animate={{
          x: [
            0,
            80,
            0,
          ],

          y: [
            0,
            -40,
            0,
          ],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease:
            "easeInOut",
        }}
        className="pointer-events-none absolute -left-40 top-20 h-[450px] w-[450px] rounded-full bg-red-600/10 blur-[130px]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* HEADER */}

        <motion.div
          initial={{
            y: 25,
            opacity: 0,
          }}
          animate={{
            y: 0,
            opacity: 1,
          }}
        >
          <p className="text-sm uppercase tracking-[0.3em] text-red-500">
            Support
          </p>

          <h1 className="mt-2 text-4xl font-bold sm:text-5xl">
            Contact Us
          </h1>

          <p className="mt-3 max-w-xl text-zinc-500">
            Booking issue, payment problem or just a question?
            Send us a message.
          </p>

        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_0.85fr]">

          {/* =========================================
              FORM
          ========================================== */}

          <motion.div
            initial={{
              y: 35,
              opacity: 0,
            }}
            animate={{
              y: 0,
              opacity: 1,
            }}
            transition={{
              delay: 0.1,
            }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur-xl sm:p-8"
          >

            <AnimatePresence
              mode="wait"
            >

              {sent ? (
                <motion.div
                  key="success"
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                  className="flex min-h-[560px] flex-col items-center justify-center text-center"
                >

                  <motion.div
                    initial={{
                      scale: 0,
                    }}
                    animate={{
                      scale: 1,
                    }}
                    transition={{
                      type:
                        "spring",

                      stiffness: 180,
                      damping: 14,
                    }}
                    className="flex h-24 w-24 items-center justify-center rounded-full bg-green-500/10"
                  >
                    <Check className="h-12 w-12 text-green-400" />
                  </motion.div>

                  <h2 className="mt-7 text-3xl font-bold">
                    Message sent
                  </h2>

                  <p className="mt-3 max-w-sm text-zinc-500">
                    Your message reached BookMySeat successfully.
                  </p>

                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                  onSubmit={
                    handleSubmit
                  }
                  className="space-y-5"
                >

                  {/* BOT FIELD */}

                  <input
                    type="text"
                    name="website"
                    value={
                      form.website
                    }
                    onChange={
                      handleChange
                    }
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                  />

                  {/* NAME */}

                  <div>

                    <label className="mb-2 block text-sm text-zinc-400">
                      Full Name
                    </label>

                    <input
                      name="fullName"
                      value={
                        form.fullName
                      }
                      onChange={
                        handleChange
                      }
                      required
                      placeholder="Your full name"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-4 outline-none transition focus:border-red-500 focus:shadow-[0_0_25px_rgba(239,68,68,0.06)]"
                    />

                  </div>

                  {/* EMAIL + PHONE */}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                    <div>

                      <label className="mb-2 block text-sm text-zinc-400">
                        Email
                      </label>

                      <input
                        type="email"
                        name="email"
                        value={
                          form.email
                        }
                        onChange={
                          handleChange
                        }
                        required
                        placeholder="you@email.com"
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-4 outline-none transition focus:border-red-500"
                      />

                    </div>

                    <div>

                      <label className="mb-2 block text-sm text-zinc-400">
                        Phone
                      </label>

                      <input
                        name="phone"
                        value={
                          form.phone
                        }
                        onChange={
                          handleChange
                        }
                        placeholder="+91..."
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-4 outline-none transition focus:border-red-500"
                      />

                    </div>

                  </div>

                  {/* SUBJECT */}

                  <div>

                    <label className="mb-2 block text-sm text-zinc-400">
                      Subject
                    </label>

                    <select
                      name="subject"
                      value={
                        form.subject
                      }
                      onChange={
                        handleChange
                      }
                      required
                      className="w-full rounded-xl border border-white/10 bg-[#111113] px-4 py-4 outline-none transition focus:border-red-500"
                    >
                      <option value="">
                        Select a subject
                      </option>

                      {subjects.map(
                        (
                          subject
                        ) => (
                          <option
                            key={
                              subject
                            }
                            value={
                              subject
                            }
                          >
                            {
                              subject
                            }
                          </option>
                        )
                      )}

                    </select>

                  </div>

                  {/* MESSAGE */}

                  <div>

                    <div className="mb-2 flex justify-between">

                      <label className="text-sm text-zinc-400">
                        Message
                      </label>

                      <span className="text-xs text-zinc-600">
                        {form.message.length}/3000
                      </span>

                    </div>

                    <textarea
                      name="message"
                      value={
                        form.message
                      }
                      onChange={
                        handleChange
                      }
                      required
                      maxLength={
                        3000
                      }
                      rows={6}
                      placeholder="Tell us what happened..."
                      className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-4 outline-none transition focus:border-red-500"
                    />

                  </div>

                  {/* ACTIONS */}

                  <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">

                    <motion.button
                      whileHover={{
                        scale: 1.01,
                      }}
                      whileTap={{
                        scale: 0.97,
                      }}
                      disabled={
                        sending
                      }
                      type="submit"
                      className="flex items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-4 font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                    >

                      <Send className="h-5 w-5" />

                      {sending
                        ? "Sending..."
                        : "Send Message"}

                    </motion.button>

                    <motion.button
                      whileHover={{
                        scale: 1.01,
                      }}
                      whileTap={{
                        scale: 0.97,
                      }}
                      type="button"
                      onClick={
                        handleWhatsApp
                      }
                      className="flex items-center justify-center gap-2 rounded-full bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-500"
                    >

                      <MessageCircle className="h-5 w-5" />

                      WhatsApp

                    </motion.button>

                  </div>

                </motion.form>
              )}

            </AnimatePresence>

          </motion.div>

          {/* =========================================
              RIGHT PANEL
          ========================================== */}

          <div className="space-y-5">

            <motion.div
              initial={{
                x: 30,
                opacity: 0,
              }}
              animate={{
                x: 0,
                opacity: 1,
              }}
              className="rounded-3xl border border-white/10 bg-zinc-900/60 p-7"
            >

              <Mail className="h-7 w-7 text-red-500" />

              <h2 className="mt-5 text-xl font-bold">
                Email Support
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Send your message through the form and it will
                reach our support inbox directly.
              </p>

            </motion.div>

            <motion.div
              initial={{
                x: 30,
                opacity: 0,
              }}
              animate={{
                x: 0,
                opacity: 1,
              }}
              transition={{
                delay: 0.1,
              }}
              className="rounded-3xl border border-green-500/10 bg-green-500/5 p-7"
            >

              <MessageCircle className="h-7 w-7 text-green-500" />

              <h2 className="mt-5 text-xl font-bold">
                WhatsApp
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Your form details are automatically copied into
                a WhatsApp message ready to send.
              </p>

            </motion.div>

            <h2 className="pt-4 text-xl font-bold">
              Cinema Locations
            </h2>

            {locations.map(
              (
                location,
                index
              ) => (
                <motion.div
                  key={
                    location.name
                  }
                  initial={{
                    x: 30,
                    opacity: 0,
                  }}
                  animate={{
                    x: 0,
                    opacity: 1,
                  }}
                  transition={{
                    delay:
                      0.15 +
                      index *
                        0.05,
                  }}
                  whileHover={{
                    x: 5,
                  }}
                  className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 transition hover:border-red-500/30"
                >

                  <div className="flex gap-4">

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10">

                      <MapPin className="h-5 w-5 text-red-500" />

                    </div>

                    <div>

                      <p className="font-semibold">
                        {
                          location.name
                        }
                      </p>

                      <p className="mt-1 text-sm text-zinc-500">
                        {
                          location.address
                        }
                      </p>

                      <p className="mt-1 text-xs text-zinc-600">
                        {
                          location.city
                        }
                      </p>

                    </div>

                  </div>

                </motion.div>
              )
            )}

          </div>

        </div>

      </div>

    </div>
  );
};

export default Contact;