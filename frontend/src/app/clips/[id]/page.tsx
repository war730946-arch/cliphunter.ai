"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { clipApi } from "@/services/api";
import type { Clip } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Download,
  Trash2,
  Scissors,
  Loader2,
  AlertCircle,
  Clock,
  Film,
  Star,
  Settings,
} from "lucide-react";

export default function ClipPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [clip, setClip] = useState<Clip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadClip();
  }, [id]);

  const loadClip = async () => {
    try {
      const res = await clipApi.get(id);
      setClip(res.data.data.clip);
    } catch {
      setError("Failed to load clip.");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Player Controls ───────────────────────────────────
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
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

  const toggleFullscreen = async () => {
    const container = document.getElementById("player-container");
    if (!container) return;
    if (!document.fullscreenElement) {
      await container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleDownload = async (quality: "720p" | "1080p") => {
    try {
      const res = await clipApi.download(id, quality);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `clip_${id.slice(0, 8)}_${quality}.mp4`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Download failed.");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this clip?")) return;
    try {
      await clipApi.delete(id);
      router.push("/downloads");
    } catch {
      setError("Failed to delete clip.");
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  if (error && !clip) {
    return (
      <div className="text-center py-24 max-w-4xl mx-auto">
        <div className="p-4 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 w-fit mx-auto mb-4">
          <AlertCircle className="h-12 w-12 text-red-400" />
        </div>
        <p className="text-zinc-400 mb-4">{error}</p>
        <Button variant="outline" asChild>
          <Link href="/downloads">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Downloads
          </Link>
        </Button>
      </div>
    );
  }

  const isGenerating = clip?.file_url === null || clip?.file_url === undefined;
  const hasFailed = !isGenerating && !clip?.file_url;

  if (isGenerating) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/downloads">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Downloads
          </Link>
        </Button>
        <Card className="text-center py-16">
          <CardContent className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20 w-fit mx-auto">
              <Loader2 className="h-12 w-12 text-amber-400 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-white">Clip Still Processing</h2>
            <p className="text-zinc-400 text-sm max-w-md mx-auto">
              Your clip is being generated. This usually takes a few moments. 
              Please check back shortly or refresh the page.
            </p>
            <Badge variant="warning" className="text-xs">
              Processing...
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/downloads">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Downloads
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/clips/${id}/edit`)}>
            <Scissors className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ─── Player ─── */}
      <div
        id="player-container"
        className="relative rounded-2xl overflow-hidden bg-black group"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={clip?.file_url || clip?.preview_url || undefined}
          className="w-full aspect-video object-contain cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          playsInline
        />

        {/* ─── Controls Overlay ─── */}
        <div
          className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Top gradient */}
          <div className="bg-gradient-to-b from-black/60 to-transparent p-4">
            <div className="flex items-center gap-2">
              <Badge
                variant={clip?.highlight?.score && clip.highlight.score >= 80 ? "success" : clip?.highlight?.score && clip.highlight.score >= 60 ? "warning" : "secondary"}
                className="text-[10px] backdrop-blur-sm"
              >
                <Star className="h-3 w-3 mr-1" />
                {clip?.highlight?.score || "—"}
              </Badge>
              {clip?.duration && (
                <Badge variant="outline" className="text-[10px] backdrop-blur-sm text-white border-white/20">
                  {formatTime(clip.duration)}
                </Badge>
              )}
            </div>
          </div>

          {/* Bottom controls */}
          <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 space-y-2">
            {/* Progress bar */}
            <div
              className="relative h-1.5 bg-white/20 rounded-full cursor-pointer group/progress hover:h-2.5 transition-all"
              onClick={handleSeek}
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity"
                style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, marginLeft: "-7px" }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className="p-1.5 rounded-full hover:bg-white/10 transition"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 text-white" />
                  ) : (
                    <Play className="h-5 w-5 text-white" />
                  )}
                </button>

                {/* Time */}
                <span className="text-xs text-white/70 font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                {/* Volume */}
                <div className="hidden sm:flex items-center gap-1.5">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 accent-violet-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Quality download buttons */}
                <div className="hidden sm:flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                    onClick={() => handleDownload("720p")}
                    title="Download 720p"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                    onClick={() => handleDownload("1080p")}
                    title="Download 1080p"
                  >
                    <Download className="h-4 w-4" />
                    <span className="text-[10px] font-medium ml-0.5">HD</span>
                  </Button>
                </div>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-full hover:bg-white/10 transition"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4 text-white" />
                  ) : (
                    <Maximize2 className="h-4 w-4 text-white" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Clip Info ─── */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">
                {clip?.highlight?.summary || "Generated Clip"}
              </h1>
              {clip?.video?.title && (
                <p className="text-sm text-zinc-400 mt-1">
                  From: {clip.video.title}
                </p>
              )}
            </div>
            <Badge variant="success" className="text-xs flex-shrink-0">
              Ready
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-3 rounded-lg bg-zinc-800/50">
              <p className="text-xs text-zinc-500">Duration</p>
              <p className="text-sm font-medium text-white mt-0.5">
                {clip?.duration ? `${clip.duration.toFixed(1)}s` : "—"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/50">
              <p className="text-xs text-zinc-500">Format</p>
              <p className="text-sm font-medium text-white mt-0.5">MP4</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/50">
              <p className="text-xs text-zinc-500">Size</p>
              <p className="text-sm font-medium text-white mt-0.5">
                {clip?.size ? `${(clip.size / (1024 * 1024)).toFixed(1)} MB` : "—"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/50">
              <p className="text-xs text-zinc-500">Created</p>
              <p className="text-sm font-medium text-white mt-0.5">
                {clip?.created_at
                  ? new Date(clip.created_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                    })
                  : "—"}
              </p>
            </div>
          </div>

          {/* Download buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button onClick={() => handleDownload("720p")} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download 720p MP4
            </Button>
            <Button onClick={() => handleDownload("1080p")} variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download 1080p MP4
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
