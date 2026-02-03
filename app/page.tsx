
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Zap, Home, Shield, Leaf } from "lucide-react";  
import LuminoChat from "@/app/components/LuminoChat";

export default function LuminoHome() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50/40 via-white to-emerald-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 dark:bg-gray-950/85 backdrop-blur-xl border-b border-emerald-200/50 dark:border-emerald-800/40">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 via-lime-500 to-teal-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
              L
            </div>
            <span className="font-semibold text-xl tracking-tight text-emerald-700 dark:text-emerald-300">Lumino</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Pricing
            </Link>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button className="hidden sm:block text-sm font-medium px-4 py-1.5 rounded-full border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
              Log in
            </button>
            <button className="text-sm font-medium px-5 sm:px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-full shadow-md hover:shadow-lg hover:brightness-105 transition-all">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 md:pt-36 pb-16 md:pb-24 px-5 sm:px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lime-100/70 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-sm font-medium mb-5">
            <Leaf size={16} /> Smart • Secure • Connected
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-5 bg-gradient-to-br from-emerald-600 via-lime-500 to-teal-600 bg-clip-text text-transparent">
            Your Home,
            <br />
            Illuminated by Intelligence
          </h1>

          <p className="max-w-xl mx-auto text-base sm:text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-6">
            Central control for your devices with seamless integrations, voice commands, and strong privacy.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mb-8 inline-flex items-center gap-5 px-5 py-3 rounded-full bg-white/70 dark:bg-gray-900/60 backdrop-blur-md border border-emerald-200/50 dark:border-emerald-800/40 shadow-md"
          >
            <div className="flex items-center gap-2.5">
              <Zap size={20} className="text-orange-500 animate-pulse" />
              <span className="font-medium text-emerald-700 dark:text-emerald-300">Real-time Monitoring</span>
            </div>
            <div className="h-6 w-px bg-emerald-300/50 dark:bg-emerald-700/50" />
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Powered by Lumino Hub
            </div>
          </motion.div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="group px-7 py-3.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl hover:brightness-105 transition-all flex items-center gap-2">
              Start Free Trial
              <ArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
            </button>
            <button className="px-7 py-3.5 border-2 border-emerald-500 text-emerald-700 dark:text-emerald-300 rounded-full font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-24 bg-white/60 dark:bg-gray-900/40">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-10 bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
            Core Features
          </h2>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-10">
            {[
              {
                icon: Home,
                title: "Unified Control",
                desc: "Zigbee, Z-Wave, Wi-Fi — all your devices in one central hub.",
                color: "emerald",
              },
              {
                icon: Zap,
                title: "Voice & Integrations",
                desc: '"Hey Lumino" commands + HomeKit, Google, Alexa, IFTTT support.',
                color: "orange",
              },
              {
                icon: Shield,
                title: "Strong Privacy",
                desc: "Physical mic toggle + encrypted local recordings for peace of mind.",
                color: "emerald",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800/70 p-6 sm:p-8 rounded-2xl border border-emerald-200/50 dark:border-emerald-700/50 shadow-sm hover:shadow-lg transition-all group"
              >
                <div className={`w-12 h-12 rounded-xl bg-${feature.color}-100 dark:bg-${feature.color}-950/40 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform`}>
                  <feature.icon size={24} className={`text-${feature.color}-600 dark:text-${feature.color}-400`} />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section (so #pricing works) */}
      <section id="pricing" className="py-16 md:py-24 bg-gradient-to-br from-emerald-50/50 to-lime-50/50 dark:from-emerald-950/20 dark:to-lime-950/20">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-emerald-700 dark:text-emerald-300">
            Simple Pricing
          </h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Basic features are free forever. Unlock advanced capabilities with Sentinel Plus.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-sm">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <p className="text-3xl font-bold mb-4 text-emerald-600 dark:text-emerald-400">$0<span className="text-base font-normal">/month</span></p>
              <ul className="text-left space-y-2 text-gray-700 dark:text-gray-300">
                <li>• Core hub control & integrations</li>
                <li>• Voice commands ("Hey Lumino")</li>
                <li>• Privacy toggle & local encryption</li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl border-2 border-orange-400 bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/30 shadow-lg">
              <h3 className="text-2xl font-bold mb-2 text-orange-600 dark:text-orange-400">Sentinel Plus</h3>
              <p className="text-3xl font-bold mb-4">$4.99<span className="text-base font-normal">/month</span></p>
              <ul className="text-left space-y-2 text-gray-700 dark:text-gray-300">
                <li>• 30-day encrypted cloud storage</li>
                <li>• AI detection (people/pets/packages)</li>
                <li>• LTE cellular backup (NA only)</li>
              </ul>
            </div>
          </div>

          <button className="mt-10 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold rounded-full shadow-xl hover:shadow-2xl hover:brightness-105 transition-all">
            Upgrade to Sentinel Plus
          </button>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-emerald-500/5 via-lime-500/10 to-orange-500/10 dark:from-emerald-950/20 dark:via-lime-950/20 dark:to-orange-950/10">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-5 text-emerald-700 dark:text-emerald-300">
            Ready to Get Started?
          </h2>
          <button className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold rounded-full shadow-xl hover:shadow-2xl hover:brightness-105 transition-all">
            Start Your Free Trial Today
          </button>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
            No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      <LuminoChat />
    </div>
  );
}
