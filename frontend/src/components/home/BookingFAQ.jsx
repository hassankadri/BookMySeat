
import React from "react";
import { Link } from "react-router-dom";
import * as Accordion from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";
import { Words } from "./ui";

const FAQ = [
  {
    q: "Do I need an account to browse?",
    a: "No. Cinemas, films, showtimes, trailers and the assistant are open to everyone. You only need an account when you want to choose seats and pay.",
  },
  {
    q: "How many seats can I book at once?",
    a: "Up to 10 seats in a single booking.",
  },
  {
    q: "What happens to the seats I choose?",
    a: "They are held for you while you check out, so nobody else can take them. If the hold runs out before you pay, the seats are released.",
  },
  {
    q: "How do I get into the cinema?",
    a: "Show the QR ticket from your confirmation page or from My bookings. Staff scan it at the entrance.",
  },
  {
    q: "Can I cancel a booking?",
    a: "Yes. Cancel from My bookings and the refund is sent back through Stripe, the same service that processed your payment.",
  },
  {
    q: "Who do I contact if something goes wrong?",
    a: "Use the contact page. You can send a message there, or start a WhatsApp chat from the same page.",
  },
];

const BookingFAQ = () => (
  <section id="faq" className="relative bg-hall py-24 md:py-36" aria-labelledby="faq-title">
      <div className="mx-auto grid max-w-[1280px] gap-14 px-5 md:px-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Words
            id="faq-title"
            text="Questions people ask before booking"
            className="font-display-wide text-[clamp(2.2rem,4.4vw,3.8rem)] font-extrabold leading-[0.97] tracking-[-0.03em]"
          />
          <p className="mt-5 max-w-sm text-beam/65">
            Something missing? <Link to="/contact" className="text-beam underline decoration-beam/30 underline-offset-4 hover:decoration-aisle">Ask us directly</Link>.
          </p>
        </div>
        <Accordion.Root type="single" collapsible className="border-t border-beam/10">
          {FAQ.map((item) => (
            <Accordion.Item key={item.q} value={item.q} className="border-b border-beam/10">
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center justify-between gap-6 py-6 text-left font-display text-xl font-semibold outline-none transition-colors hover:text-aisle focus-visible:text-aisle md:text-2xl">
                  {item.q}
                  <Plus className="h-5 w-5 shrink-0 transition-transform duration-500 ease-cine group-data-[state=open]:rotate-[135deg]" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <p className="max-w-xl pb-7 text-lg leading-relaxed text-beam/70">{item.a}</p>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
);

export default BookingFAQ;
