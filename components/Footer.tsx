import Link from "next/link";
import {
  ShoppingBag,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  CreditCard,
  Shield,
  RotateCcw,
  Headphones,
} from "lucide-react";
import NewsletterForm from "./NewsletterForm";

const quickLinks = [
  { label: "All Products", href: "/products" },
  { label: "New Arrivals", href: "/new-arrivals" },
  { label: "Best Sellers", href: "/best-sellers" },
  { label: "Deals & Offers", href: "/deals" },
  { label: "Gift Cards", href: "/gift-cards" },
  { label: "Track Your Order", href: "/orders/track" },
];

const supportLinks = [
  { label: "Help Center", href: "/help" },
  { label: "Return & Exchange", href: "/returns" },
  { label: "Shipping Policy", href: "/shipping" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Contact Us", href: "/contact" },
];

const socialLinks = [
  {
    label: "Facebook",
    href: "https://facebook.com",
    Icon: Facebook,
    color: "hover:text-blue-400",
  },
  {
    label: "Twitter",
    href: "https://twitter.com",
    Icon: Twitter,
    color: "hover:text-sky-400",
  },
  {
    label: "Instagram",
    href: "https://instagram.com",
    Icon: Instagram,
    color: "hover:text-pink-400",
  },
  {
    label: "YouTube",
    href: "https://youtube.com",
    Icon: Youtube,
    color: "hover:text-red-400",
  },
];

const perks = [
  {
    Icon: CreditCard,
    label: "Secure Payment",
    desc: "100% protected transactions",
  },
  { Icon: RotateCcw, label: "Easy Returns", desc: "30-day hassle-free returns" },
  { Icon: Shield, label: "2-Year Warranty", desc: "On all electronics" },
  {
    Icon: Headphones,
    label: "24/7 Support",
    desc: "Dedicated customer service",
  },
];

const CURRENT_YEAR = new Date().getFullYear();

export default function Footer() {
  const year = CURRENT_YEAR;

  return (
    <footer className="bg-gray-950 text-gray-300">
      {/* ── Perks bar ── */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 py-8 sm:grid-cols-4">
          {perks.map(({ Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main footer columns ── */}
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Col 1 — Brand / About */}
          <div className="sm:col-span-2 lg:col-span-1">
            {/* Logo */}
            <Link href="/" className="inline-flex items-center gap-2">
              <ShoppingBag className="h-7 w-7 text-indigo-400" strokeWidth={2} />
              <span className="text-xl font-extrabold tracking-tight text-white">
                Shop<span className="text-indigo-400">Nest</span>
              </span>
            </Link>

            <p className="mt-4 text-sm leading-relaxed text-gray-400">
              Your one-stop destination for quality products across electronics,
              fashion, home décor, fitness, and more. We bring you the best
              brands at honest prices.
            </p>

            {/* Newsletter */}
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold text-white">
                Subscribe to our newsletter
              </p>
              <NewsletterForm />
            </div>

            {/* Socials */}
            <div className="mt-6 flex gap-3">
              {socialLinks.map(({ label, href, Icon, color }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-400 transition hover:border-gray-600 hover:bg-gray-700 ${color}`}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2 — Quick Links */}
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-white">
              Shop
            </h3>
            <ul className="space-y-2.5">
              {quickLinks.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="group flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-indigo-400"
                  >
                    <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Support */}
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-white">
              Support
            </h3>
            <ul className="space-y-2.5">
              {supportLinks.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="group flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-indigo-400"
                  >
                    <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Contact */}
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-white">
              Contact Us
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                <span className="text-sm text-gray-400 leading-relaxed">
                  123 Market Street, Suite 400
                  <br />
                  San Francisco, CA 94105
                </span>
              </li>
              <li>
                <a
                  href="tel:+18005551234"
                  className="flex items-center gap-3 text-sm text-gray-400 transition hover:text-indigo-400"
                >
                  <Phone className="h-4 w-4 shrink-0 text-indigo-400" />
                  +1 (800) 555-1234
                </a>
              </li>
              <li>
                <a
                  href="mailto:hello@shopnest.com"
                  className="flex items-center gap-3 text-sm text-gray-400 transition hover:text-indigo-400"
                >
                  <Mail className="h-4 w-4 shrink-0 text-indigo-400" />
                  hello@shopnest.com
                </a>
              </li>
            </ul>

            {/* Payment badges */}
            <div className="mt-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                We Accept
              </p>
              <div className="flex flex-wrap gap-2">
                {["Visa", "MC", "Amex", "PayPal", "Apple Pay"].map((p) => (
                  <span
                    key={p}
                    className="rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-400"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Copyright bar ── */}
      <div className="border-t border-gray-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-gray-500 sm:flex-row">
          <p>© {year} ShopNest, Inc. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="transition hover:text-indigo-400">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition hover:text-indigo-400">
              Terms of Service
            </Link>
            <Link href="/sitemap" className="transition hover:text-indigo-400">
              Sitemap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
