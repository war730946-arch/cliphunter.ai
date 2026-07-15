"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Zap, Shield, Video, ArrowRight, ChevronRight, Star } from "lucide-react";

const features = [
  {
    title: "AI-Powered Detection",
    description: "NLP-powered highlight scoring finds the best moments automatically. Our AI understands context, emotion, and action.",
    icon: Sparkles,
    color: "from-violet-500 to-indigo-500",
    gradient: "from-violet-500/10 to-indigo-500/10",
    border: "border-violet-500/20",
  },
  {
    title: "Instant Clip Generation",
    description: "Get highlight clips ready in seconds. Choose from multiple aspect ratios and quality settings for any platform.",
    icon: Zap,
    color: "from-emerald-500 to-teal-500",
    gradient: "from-emerald-500/10 to-teal-500/10",
    border: "border-emerald-500/20",
  },
  {
    title: "Zero Setup Required",
    description: "Works entirely in your browser. Upload a file or paste a URL and let our AI do the heavy lifting.",
    icon: Shield,
    color: "from-amber-500 to-orange-500",
    gradient: "from-amber-500/10 to-orange-500/10",
    border: "border-amber-500/20",
  },
];

const stats = [
  { value: "10K+", label: "Videos Processed" },
  { value: "99.9%", label: "Uptime" },
  { value: "< 30s", label: "Avg. Processing" },
  { value: "4.9★", label: "User Rating" },
];

export default function HomePage() {
  const router = useRouter();
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      router.push("/dashboard");
    }
  }, [token, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800/50 to-zinc-900 flex flex-col">
      {/* ─── Nav ─── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
            <Video className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">
            ClipHunter <span className="text-violet-400">AI</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/auth/login">Sign In</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/register">Get Started</Link>
          </Button>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="info" className="mb-6 px-4 py-1.5 text-sm animate-fade-in">
            <span className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
              AI-Powered Video Highlights
            </span>
          </Badge>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-tight mb-6">
            Smart Video{" "}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              Highlights
            </span>{" "}
            Instantly
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload any video or paste a URL. Our AI automatically detects the best moments — 
            goals, reactions, key moments — and generates short, shareable clips ready for social media.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/auth/register">
                Start for Free
                <ArrowRight className="h-5 w-5 ml-1" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/auth/login">
                Sign In
              </Link>
            </Button>
          </div>

          {/* Trusted by */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ─── Features ─── */}
      <section className="py-20 px-6 max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <Badge variant="info" className="mb-4">Features</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Built for Content Creators
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Everything you need to turn long videos into engaging highlight clips
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group hover:border-zinc-600/50 transition-all duration-300 hover:-translate-y-1"
            >
              <CardContent className="p-6">
                <div className={`p-3 rounded-lg bg-gradient-to-br ${feature.gradient} w-fit mb-4 ring-1 ${feature.border}`}>
                  <feature.icon className={`h-6 w-6 bg-gradient-to-r ${feature.color} bg-clip-text text-transparent`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-violet-300 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-20 px-6 max-w-6xl mx-auto w-full border-t border-zinc-800/50">
        <div className="text-center mb-12">
          <Badge variant="warning" className="mb-4">How It Works</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Three Simple Steps
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            From video to shareable clips in minutes
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connection lines (desktop) */}
          <div className="hidden md:block absolute top-12 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-0.5 bg-gradient-to-r from-violet-500/30 via-fuchsia-500/30 to-violet-500/30" />
          
          {[
            {
              step: "1",
              title: "Upload Your Video",
              description: "Drag & drop a file or paste any video URL. We support all major formats up to 200MB.",
              icon: Video,
            },
            {
              step: "2",
              title: "AI Analysis",
              description: "Our AI scans the video, detecting key moments, reactions, and highlight-worthy content.",
              icon: Sparkles,
            },
            {
              step: "3",
              title: "Get Your Clips",
              description: "Review generated highlights, customize duration and format, then download your clips.",
              icon: Star,
            },
          ].map((item) => (
            <div key={item.step} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25 mb-6">
                <item.icon className="h-7 w-7 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-xs font-bold text-violet-400">
                {item.step}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-zinc-400 max-w-xs">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button size="lg" asChild>
            <Link href="/auth/register">
              Get Started Now
              <ChevronRight className="h-5 w-5 ml-1" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-zinc-800/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-violet-400" />
            <span className="text-sm font-medium text-zinc-400">
              ClipHunter <span className="text-violet-400">AI</span>
            </span>
          </div>
          <p className="text-xs text-zinc-600">
            Built with ❤️ for content creators everywhere
          </p>
        </div>
      </footer>
    </div>
  );
}
