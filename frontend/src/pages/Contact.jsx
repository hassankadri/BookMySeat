import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, Send, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const WHATSAPP_NUMBER = '919876543210';

const locations = [
  { name: 'Grand Galleria Mall', address: 'Senapati Bapat Marg, Lower Parel (Above Big Bazaar)', city: 'Mumbai' },
  { name: 'Phoenix Marketcity', address: 'LBS Marg, Kurla West', city: 'Mumbai' },
  { name: 'Inorbit Mall', address: 'Link Road, Malad West', city: 'Mumbai' },
  { name: 'R City Mall', address: 'LBS Marg, Ghatkopar West', city: 'Mumbai' },
  { name: 'Viviana Mall', address: 'Eastern Express Highway, Thane', city: 'Thane' }
];

const subjects = [
  'Ticket Booking',
  'Group Events',
  'Membership Inquiry',
  'Technical Issue',
  'Refund Request',
  'Other'
];

const Contact = () => {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [sending, setSending] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      toast.success('Message sent successfully! We will get back to you soon.');
      setForm({ fullName: '', email: '', phone: '', subject: '', message: '' });
      setSending(false);
    }, 1000);
  };

  const handleWhatsApp = () => {
    const text = `Hi BookMySeat!%0A%0AName: ${form.fullName}%0AEmail: ${form.email}%0APhone: ${form.phone}%0ASubject: ${form.subject}%0AMessage: ${form.message}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
  };

  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="contact-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4" data-testid="contact-title">Contact Us</h1>
          <p className="text-zinc-400 text-lg mb-12">We'd love to hear from you. Reach out anytime.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <form onSubmit={handleSubmit} className="glassmorphism rounded-2xl p-8 space-y-6" data-testid="contact-form">
              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <input
                  type="text" name="fullName" value={form.fullName} onChange={handleChange} required
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="Your full name" data-testid="contact-name"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email" name="email" value={form.email} onChange={handleChange} required
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="you@email.com" data-testid="contact-email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Phone Number</label>
                  <input
                    type="tel" name="phone" value={form.phone} onChange={handleChange}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="+91 98765 43210" data-testid="contact-phone"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Subject</label>
                <select
                  name="subject" value={form.subject} onChange={handleChange} required
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-red-500 transition-colors appearance-none"
                  data-testid="contact-subject"
                >
                  <option value="">Select a subject</option>
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea
                  name="message" value={form.message} onChange={handleChange} required rows={5}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-red-500 transition-colors resize-none"
                  placeholder="Tell us what's on your mind..." data-testid="contact-message"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="submit" disabled={sending}
                  className="flex-1 inline-flex items-center justify-center rounded-full bg-red-600 px-8 py-3 font-semibold text-white transition-all hover:bg-red-500 active:scale-95 disabled:opacity-50"
                  data-testid="contact-submit-btn"
                >
                  <Send className="mr-2 h-5 w-5" strokeWidth={1.5} />
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
                <button
                  type="button" onClick={handleWhatsApp}
                  className="flex-1 inline-flex items-center justify-center rounded-full bg-green-600 px-8 py-3 font-semibold text-white transition-all hover:bg-green-500 active:scale-95"
                  data-testid="whatsapp-btn"
                >
                  <MessageCircle className="mr-2 h-5 w-5" strokeWidth={1.5} />
                  Send via WhatsApp
                </button>
              </div>
            </form>
          </motion.div>

          {/* Locations */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold mb-6">Our Locations</h2>
            {locations.map((loc, idx) => (
              <motion.div
                key={idx}
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 * idx }}
                className="glassmorphism rounded-xl p-6 hover:border-red-500/30 transition-all duration-300"
                data-testid={`location-${idx}`}
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-red-600/20 rounded-lg">
                    <MapPin className="h-6 w-6 text-red-500" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{loc.name}</h3>
                    <p className="text-zinc-400 text-sm">{loc.address}</p>
                    <p className="text-zinc-500 text-xs mt-1">{loc.city}</p>
                  </div>
                </div>
              </motion.div>
            ))}

            <div className="glassmorphism rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold">Quick Contact</h3>
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-red-500" strokeWidth={1.5} />
                <span className="text-zinc-300">+91 1800-123-4567</span>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-red-500" strokeWidth={1.5} />
                <span className="text-zinc-300">support@bookmyseat.com</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
