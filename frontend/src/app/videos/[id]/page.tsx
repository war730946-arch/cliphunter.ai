"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { videoApi, clipApi } from "@/services/api";
import type { Video, Highlight, Clip } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Video as VideoIcon,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Zap,
  Clock,
  Star,
  Trash2,
  Play,
  Download,
  Film,
  Sparkles,
  Settings,
  CheckCircle,
} from "lucide-react";

type AspectRatio = "16:9" | "9:16" | "1:1";

export default function VideoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [video, setVideo] = useState<Video | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clip generation options
  const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(null);
  const [clipDuration, setClipDuration] = useState<string>("30");
  const [clipAspectRatio, setClipAspectRatio] = useState<AspectRatio>("16:9");
  const [clipQuality, setClipQuality] = useState<"720p" | "1080p">("720p");
  const [showClipForm, setShowClipForm] = useState(false);

  useEffect(() => {
    loadAll();
  }, [id]);

  const loadAll = async () => {
    try {
      const [videoRes, highlightsRes, clipsRes] = await Promise.all([
        videoApi.get(id),
        videoApi.getHighlights(id).catch(() => null),
        clipApi.list({ video_id: id }).catch(() => null),
      ]);
      setVideo(videoRes.data.data.video);
      setHighlights(highlightsRes?.data.data?.highlights || []);
      setClips(clipsRes?.data.data?.clips || []);
    } catch {
      setError("Failed to load video.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      await videoApi.analyze(id);
      setTimeout(async () => {
        try {
          const res = await videoApi.getHighlights(id);
          setHighlights(res.data.data?.highlights || []);
        } catch { /* ignore */ }
        setIsAnalyzing(false);
      }, 3000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Analysis failed.";
      setError(msg);
      setIsAnalyzing(false);
    }
  };

  const handleGenerateClip = async () => {
    if (!selectedHighlight) return;
    setIsGenerating(true);
    setError(null);
    try {
      await clipApi.generate({
        video_id: id,
        highlight_id: selectedHighlight.id,
        duration: clipDuration,
        aspect_ratio: clipAspectRatio,
        quality: clipQuality,
      });
      const clipsRes = await clipApi.list({ video_id: id });
      setClips(clipsRes.data.data?.clips || []);
      setShowClipForm(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Clip generation failed.";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteClip = async (clipId: string) => {
    if (!confirm("Delete this clip?")) return;
    try {
      await clipApi.delete(clipId);
      setClips((prev) => prev.filter((c) => c.id !== clipId));
    } catch {
      setError("Failed to delete clip.");
    }
  };

  const handleDownloadClip = async (clipId: string, quality: "720p" | "1080p") => {
    try {
      const res = await clipApi.download(clipId, quality);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `clip_${clipId}_${quality}.mp4`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Download failed.");
    }
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = video?.jobs?.[0]?.progress ?? 0;
  const jobStatus = video?.jobs?.[0]?.status;

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-col sm:flex-row gap-6">
          <Skeleton className="w-full sm:w-96 aspect-video rounded-xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !video) {
    return (
      <div className="text-center py-24">
        <div className="p-4 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 w-fit mx-auto mb-4">
          <AlertCircle className="h-12 w-12 text-red-400" />
        </div>
        <p className="text-zinc-400 mb-4">{error}</p>
        <Button variant="outline" asChild>
          <Link href="/videos">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Videos
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/videos">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Videos
        </Link>
      </Button>

      {/* Video Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-6">
        <div className="w-full sm:w-96 aspect-video rounded-xl bg-zinc-800 border border-zinc-700/50 overflow-hidden flex-shrink-0">
          {video?.thumbnail ? (
            <img src={video.thumbnail} alt={video?.title || "Video"} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <VideoIcon className="h-16 w-16 text-zinc-600" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <h1 className="text-2xl font-bold text-white">{video?.title || "Untitled Video"}</h1>

          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                video?.status === "ready" ? "success" :
                video?.status === "processing" ? "warning" :
                video?.status === "failed" ? "destructive" : "secondary"
              }
            >
              {video?.status}
            </Badge>
            {video?.duration && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(video.duration)}
              </Badge>
            )}
            {video?._count?.clips !== undefined && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Film className="h-3 w-3" />
                {video._count.clips} clips
              </Badge>
            )}
          </div>

          {video?.source_url && (
            <p className="text-xs text-zinc-500 break-all bg-zinc-800/50 p-2 rounded-lg">
              Source: {video.source_url}
            </p>
          )}

          <p className="text-xs text-zinc-500">
            Uploaded {video?.created_at && new Date(video.created_at).toLocaleDateString("en-US", {
              month: "long", day: "numeric", year: "numeric",
            })}
          </p>

          {/* Progress bar for processing videos */}
          {(video?.status === "processing" || video?.status === "pending") && (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-amber-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {jobStatus === "processing" ? "Processing..." : "Queued..."}
                </span>
                <span className="text-xs text-amber-400">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {error}
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">&times;</button>
        </div>
      )}

      {/* Analyze Button */}
      {video?.status !== "ready" && video?.status !== "failed" && (
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          size="lg"
          className="w-full"
        >
          {isAnalyzing ? (
            <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Analyzing...</>
          ) : (
            <><Zap className="h-5 w-5 mr-2" /> Analyze Video</>
          )}
        </Button>
      )}

      {/* ── Highlights Section ── */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-400" />
          AI Highlights ({highlights.length})
        </h2>

        {highlights.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-zinc-700/50 bg-zinc-800/30">
            <Sparkles className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">
              {video?.status === "ready"
                ? "No highlights found. Click Analyze to run detection."
                : "Highlights will appear once analysis is complete."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {highlights.map((hl) => (
              <div
                key={hl.id}
                className={`rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                  selectedHighlight?.id === hl.id
                    ? "border-violet-500/50 bg-violet-500/10 shadow-sm shadow-violet-500/10"
                    : "border-zinc-700/50 bg-zinc-800/50 hover:border-zinc-600/50 hover:bg-zinc-800/70"
                }`}
                onClick={() => { setSelectedHighlight(hl); setShowClipForm(true); }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 mb-2">{hl.summary || "Highlight segment"}</p>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(hl.start_time)} - {formatTime(hl.end_time)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      variant={hl.score >= 80 ? "success" : hl.score >= 60 ? "warning" : "secondary"}
                      className="text-xs"
                    >
                      {hl.score}/100
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                      onClick={(e) => { e.stopPropagation(); setSelectedHighlight(hl); setShowClipForm(true); }}
                      title="Generate clip"
                    >
                      <Film className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Clip Generation Form ── */}
      {showClipForm && selectedHighlight && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Settings className="h-4 w-4 text-violet-400" />
              Generate Clip
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowClipForm(false)}>
              &times;
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Duration</label>
                <select
                  value={clipDuration}
                  onChange={(e) => setClipDuration(e.target.value)}
                  className="w-full h-10 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                >
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="45">45 seconds</option>
                  <option value="60">60 seconds</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Aspect Ratio</label>
                <select
                  value={clipAspectRatio}
                  onChange={(e) => setClipAspectRatio(e.target.value as AspectRatio)}
                  className="w-full h-10 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                >
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Vertical</option>
                  <option value="1:1">1:1 Square</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Quality</label>
                <select
                  value={clipQuality}
                  onChange={(e) => setClipQuality(e.target.value as "720p" | "1080p")}
                  className="w-full h-10 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                >
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-800/50 text-xs text-zinc-400">
              <Clock className="h-3 w-3" />
              Clip: {formatTime(selectedHighlight.start_time)} - {formatTime(Math.min(selectedHighlight.start_time + parseInt(clipDuration), selectedHighlight.end_time))}
            </div>

            <Button
              onClick={handleGenerateClip}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" /> Generate Clip</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Generated Clips ── */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Play className="h-5 w-5 text-emerald-400" />
          Generated Clips ({clips.length})
        </h2>

        {clips.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-zinc-700/50 bg-zinc-800/30">
            <Film className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">Select a highlight above to generate a clip</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {clips.map((clip) => (
              <Card key={clip.id} className="overflow-hidden hover:border-zinc-600/50 transition">
                {/* Preview */}
                <div className="aspect-video bg-zinc-700 relative flex items-center justify-center group cursor-pointer">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="p-3 rounded-full bg-black/60 group-hover:bg-violet-500/80 transition-all group-hover:scale-110">
                      <Play className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  {video?.thumbnail && (
                    <img src={video.thumbnail} alt="" className="w-full h-full object-cover opacity-50" />
                  )}
                  {clip.duration && (
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-xs text-zinc-300 backdrop-blur-sm">
                      {clip.duration.toFixed(1)}s
                    </div>
                  )}
                </div>

                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-zinc-300 line-clamp-2">
                    {clip.highlight?.summary || "Generated clip"}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {clip.highlight && (
                        <Badge
                          variant={clip.highlight.score >= 80 ? "success" : clip.highlight.score >= 60 ? "warning" : "secondary"}
                          className="text-[10px]"
                        >
                          {clip.highlight.score}/100
                        </Badge>
                      )}
                      {clip.size && (
                        <span className="text-xs text-zinc-500">
                          {(clip.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {clip.file_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                          onClick={(e) => { e.stopPropagation(); handleDownloadClip(clip.id, "720p"); }}
                          title="Download 720p"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={(e) => { e.stopPropagation(); handleDeleteClip(clip.id); }}
                        title="Delete clip"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
