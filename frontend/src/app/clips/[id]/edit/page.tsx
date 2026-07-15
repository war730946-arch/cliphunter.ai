"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { clipApi, videoApi } from "@/services/api";
import type { Clip, Highlight, Video } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Play,
  Pause,
  Scissors,
  Loader2,
  AlertCircle,
  Clock,
  Film,
  Star,
  Crop,
  CheckCircle,
  RefreshCw,
} from "lucide-react";

type AspectRatio = "16:9" | "9:16" | "1:1";
type Quality = "720p" | "1080p";
type TrimMode = "duration" | "custom";

export default function ClipEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [clip, setClip] = useState<Clip | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Video player for preview
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Editor state
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(30);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [quality, setQuality] = useState<Quality>("720p");
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [trimMode, setTrimMode] = useState<TrimMode>("duration");

  useEffect(() => {
    loadAll();
  }, [id]);

  const loadAll = async () => {
    try {
      const [clipRes] = await Promise.all([
        clipApi.get(id),
      ]);
      const clipData = clipRes.data.data.clip;
      setClip(clipData);

      // Load the associated video
      if (clipData.video_id) {
        try {
          const videoRes = await videoApi.get(clipData.video_id);
          const videoData = videoRes.data.data.video;
          setVideo(videoData);

          // Also load highlights for this video
          const highlightsRes = await videoApi.getHighlights(clipData.video_id);
          setHighlights(highlightsRes.data.data?.highlights || []);

          // Find matching highlight
          if (clipData.highlight_id) {
            setSelectedHighlightId(clipData.highlight_id);
            const hl = highlightsRes.data.data?.highlights?.find(
              (h: Highlight) => h.id === clipData.highlight_id
            );
            if (hl) {
              setTrimStart(hl.start_time);
              setTrimEnd(hl.end_time);
            }
          }
        } catch {
          // Video might not be available
        }
      }
    } catch {
      setError("Failed to load clip.");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Player controls for trim preview ──────────────────
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      if (clip?.duration) {
        setTrimEnd(Math.min(clip.duration, videoRef.current.duration));
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const seekTime = percent * duration;
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ─── Trim controls ──────────────────────────────────────
  const handleTrimStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTrimStart(Math.max(0, Math.min(val, trimEnd - 1)));
  };

  const handleTrimEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTrimEnd(Math.max(trimStart + 1, Math.min(val, duration || 120)));
  };

  const handleDurationPreset = (seconds: number) => {
    setTrimMode("duration");
    const end = Math.min(trimStart + seconds, duration || 120);
    setTrimEnd(end);
  };

  const trimDuration = trimEnd - trimStart;

  // ─── Highlight selection ────────────────────────────────
  const handleHighlightSelect = (hl: Highlight) => {
    setSelectedHighlightId(hl.id);
    setTrimMode("custom");
    setTrimStart(hl.start_time);
    setTrimEnd(hl.end_time);
    // Seek to highlight
    if (videoRef.current) {
      videoRef.current.currentTime = hl.start_time;
      setCurrentTime(hl.start_time);
    }
  };

  // ─── Generate clip ──────────────────────────────────────
  const handleGenerate = async () => {
    setError(null);
    setSuccess(null);
    setIsGenerating(true);

    try {
      await clipApi.generate({
        video_id: clip?.video_id || "",
        highlight_id: selectedHighlightId || "",
        custom_start: trimStart,
        custom_end: trimEnd,
        aspect_ratio: aspectRatio,
        quality: quality,
      });
      setSuccess(`Clip generation started! New clip will be available shortly.`);
      // Refresh clip data
      const res = await clipApi.get(id);
      setClip(res.data.data.clip);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Generation failed. Please try again.";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error && !clip) {
    return (
      <div className="text-center py-24">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-zinc-400 mb-4">{error}</p>
        <Button variant="outline" asChild>
          <Link href="/downloads">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Downloads
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/clips/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Preview
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">Clip Editor</h1>
        <p className="text-zinc-400 mt-1">
          {clip?.highlight?.summary || "Edit and regenerate your clip"}
        </p>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">&times;</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto">&times;</button>
        </div>
      )}

      {/* Video Preview */}
      <div className="relative rounded-2xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={clip?.file_url || clip?.preview_url || video?.source_url || undefined}
          className="w-full aspect-video object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          playsInline
        />

        {/* Simple overlay controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2 rounded-full hover:bg-white/10 transition"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 text-white" />
              ) : (
                <Play className="h-5 w-5 text-white" />
              )}
            </button>
            <div
              className="flex-1 h-1.5 bg-white/20 rounded-full cursor-pointer relative"
              onClick={handleSeek}
            >
              <div
                className="absolute inset-y-0 left-0 bg-violet-500 rounded-full"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              {/* Trim indicators on timeline */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-emerald-400 z-10"
                style={{ left: `${duration > 0 ? (trimStart / duration) * 100 : 0}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-red-400 z-10"
                style={{ left: `${duration > 0 ? (trimEnd / duration) * 100 : 0}%` }}
              />
              {/* Trim range highlight */}
              <div
                className="absolute inset-y-0 bg-violet-500/30 rounded-full"
                style={{
                  left: `${duration > 0 ? (trimStart / duration) * 100 : 0}%`,
                  width: `${duration > 0 ? ((trimEnd - trimStart) / duration) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-xs text-white/70 font-mono flex-shrink-0">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Trim Controls ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Scissors className="h-4 w-4 text-violet-400" />
              Trim Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Duration presets */}
            <div>
              <Label className="text-xs text-zinc-400 mb-2 block">Quick Duration</Label>
              <div className="flex gap-2 flex-wrap">
                {[15, 30, 45, 60].map((sec) => (
                  <Button
                    key={sec}
                    variant={trimMode === "duration" && trimDuration === sec ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleDurationPreset(sec)}
                    className="text-xs"
                  >
                    {sec}s
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Custom trim */}
            <div className="space-y-3">
              <Label className="text-xs text-zinc-400">Custom Range</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-zinc-500">Start Time</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={trimEnd - 1}
                      step={0.5}
                      value={trimStart}
                      onChange={handleTrimStartChange}
                      className="text-sm"
                    />
                    <span className="text-xs text-zinc-500">s</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-zinc-500">End Time</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={trimStart + 1}
                      max={duration || 120}
                      step={0.5}
                      value={trimEnd}
                      onChange={handleTrimEndChange}
                      className="text-sm"
                    />
                    <span className="text-xs text-zinc-500">s</span>
                  </div>
                </div>
              </div>

              {/* Trim slider */}
              <div className="relative h-8 mt-2">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-zinc-700 rounded-full">
                  <div
                    className="absolute inset-y-0 bg-gradient-to-r from-emerald-500 to-red-500 rounded-full opacity-50"
                    style={{
                      left: `${duration > 0 ? (trimStart / duration) * 100 : 0}%`,
                      width: `${duration > 0 ? ((trimEnd - trimStart) / duration) * 100 : 0}%`,
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 120}
                  step={0.1}
                  value={trimStart}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setTrimStart(Math.min(val, trimEnd - 1));
                  }}
                  className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg"
                />
                <input
                  type="range"
                  min={0}
                  max={duration || 120}
                  step={0.1}
                  value={trimEnd}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setTrimEnd(Math.max(trimStart + 1, val));
                  }}
                  className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-400 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Trim: {formatTime(trimStart)} - {formatTime(trimEnd)}</span>
                <span>Duration: {formatTime(trimDuration)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Output Settings ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Crop className="h-4 w-4 text-violet-400" />
              Output Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Aspect Ratio */}
            <div>
              <Label className="text-xs text-zinc-400 mb-2 block">Aspect Ratio</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["16:9", "9:16", "1:1"] as const).map((ratio) => (
                  <Button
                    key={ratio}
                    variant={aspectRatio === ratio ? "default" : "outline"}
                    onClick={() => setAspectRatio(ratio)}
                    className="flex flex-col items-center gap-1 py-3 h-auto"
                  >
                    <div
                      className={`rounded border-2 transition-all ${
                        aspectRatio === ratio ? "border-white" : "border-zinc-600"
                      } ${
                        ratio === "16:9" ? "w-6 h-3.5" :
                        ratio === "9:16" ? "w-3.5 h-6" :
                        "w-5 h-5"
                      }`}
                    />
                    <span className="text-[10px]">{ratio}</span>
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">
                {aspectRatio === "16:9" ? "Best for YouTube, desktop" :
                 aspectRatio === "9:16" ? "Best for TikTok, Reels, Shorts" :
                 "Best for Instagram, Twitter"}
              </p>
            </div>

            <Separator />

            {/* Quality */}
            <div>
              <Label className="text-xs text-zinc-400 mb-2 block">Quality</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["720p", "1080p"] as const).map((q) => (
                  <Button
                    key={q}
                    variant={quality === q ? "default" : "outline"}
                    onClick={() => setQuality(q)}
                    className="py-3 h-auto"
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium">{q}</p>
                      <p className="text-[10px] opacity-70">
                        {q === "720p" ? "Smaller file" : "Best quality"}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Highlights to use */}
            {highlights.length > 0 && (
              <div>
                <Label className="text-xs text-zinc-400 mb-2 block">
                  Base Highlight <span className="text-zinc-600">(optional)</span>
                </Label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {highlights.map((hl) => (
                    <button
                      key={hl.id}
                      onClick={() => handleHighlightSelect(hl)}
                      className={`w-full text-left p-2 rounded-lg text-xs transition ${
                        selectedHighlightId === hl.id
                          ? "bg-violet-500/20 border border-violet-500/30"
                          : "bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-zinc-300 truncate">
                          {hl.summary || "Highlight segment"}
                        </span>
                        <Badge
                          variant={hl.score >= 80 ? "success" : hl.score >= 60 ? "warning" : "secondary"}
                          className="text-[10px] flex-shrink-0"
                        >
                          {hl.score}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-zinc-500">
                        {formatTime(hl.start_time)} - {formatTime(hl.end_time)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Summary */}
            <div className="p-3 rounded-lg bg-zinc-800/50 space-y-1">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Output Preview</span>
                <Badge variant="info" className="text-[10px]">MP4</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{aspectRatio} &bull; {quality}</span>
                <span>{formatTime(trimDuration)} duration</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !clip?.video_id}
        size="lg"
        className="w-full"
      >
        {isGenerating ? (
          <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Generating Clip...</>
        ) : (
          <><RefreshCw className="h-5 w-5 mr-2" /> Regenerate Clip</>
        )}
      </Button>
    </div>
  );
}
