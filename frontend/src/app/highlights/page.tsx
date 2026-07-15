"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { videoApi, clipApi } from "@/services/api";
import { useVideos } from "@/hooks/useVideos";
import type { Highlight, Video, Clip } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Clock,
  Star,
  Play,
  Download,
  Film,
  Loader2,
  AlertCircle,
  TrendingUp,
  ArrowUpRight,
  Filter,
  LayoutGrid,
  SlidersHorizontal,
} from "lucide-react";

interface HighlightWithVideo extends Highlight {
  video_title: string | null;
  video_thumbnail: string | null;
  video_duration: number | null;
  video_id: string;
}

export default function HighlightsPage() {
  const { videos, isLoading: videosLoading, fetchVideos } = useVideos();
  const [highlights, setHighlights] = useState<HighlightWithVideo[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "date" | "duration">("score");
  const [minScore, setMinScore] = useState(0);

  useEffect(() => {
    fetchVideos({ limit: 50 });
    loadClips();
  }, [fetchVideos]);

  const loadClips = async () => {
    try {
      const { data } = await clipApi.list();
      setClips(data.data?.clips || []);
    } catch {
      // ignore
    }
  };

  // Fetch highlights for all ready videos
  useEffect(() => {
    const readyVideos = videos.filter((v) => v.status === "ready");
    if (readyVideos.length === 0 && !videosLoading) {
      setIsLoading(false);
      return;
    }

    const fetchAllHighlights = async () => {
      const results: HighlightWithVideo[] = [];

      for (const video of readyVideos) {
        try {
          const res = await videoApi.getHighlights(video.id);
          const videoHighlights: Highlight[] = res.data.data?.highlights || [];

          videoHighlights.forEach((hl) => {
            results.push({
              ...hl,
              video_title: video.title,
              video_thumbnail: video.thumbnail,
              video_duration: video.duration,
              video_id: video.id,
            });
          });
        } catch {
          // skip videos that fail
        }
      }

      setHighlights(results);
      setIsLoading(false);
    };

    fetchAllHighlights();
  }, [videos, videosLoading]);

  const hasClipForHighlight = useCallback(
    (highlightId: string) => clips.some((c) => c.highlight_id === highlightId),
    [clips]
  );

  const getClipForHighlight = useCallback(
    (highlightId: string) => clips.find((c) => c.highlight_id === highlightId),
    [clips]
  );

  const handleDownload = async (clipId: string, quality: "720p" | "1080p" = "720p") => {
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

  // Sort and filter
  const sortedHighlights = [...highlights]
    .filter((h) => h.score >= minScore)
    .sort((a, b) => {
      if (sortBy === "score") return b.score - a.score;
      if (sortBy === "date") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "duration") return (b.end_time - b.start_time) - (a.end_time - a.start_time);
      return 0;
    });

  const totalHighlights = highlights.length;
  const readyVideosCount = videos.filter((v) => v.status === "ready").length;

  if (isLoading || videosLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-72" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">Highlights Gallery</h1>
            <Badge variant="info" className="text-xs">
              {totalHighlights} highlights
            </Badge>
          </div>
          <p className="text-zinc-400 mt-1">
            AI-detected key moments across {readyVideosCount} video{readyVideosCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
          <span className="text-xs text-zinc-500 font-medium">Sort:</span>
          {(["score", "date", "duration"] as const).map((option) => (
            <Button
              key={option}
              variant={sortBy === option ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy(option)}
              className="text-xs h-8"
            >
              {option === "score" ? "Best Score" : option === "date" ? "Newest" : "Duration"}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-zinc-500" />
          <span className="text-xs text-zinc-500 font-medium">Min Score:</span>
          {[0, 50, 60, 70, 80, 90].map((score) => (
            <Button
              key={score}
              variant={minScore === score ? "default" : "outline"}
              size="sm"
              onClick={() => setMinScore(score)}
              className="text-xs h-8"
            >
              {score === 0 ? "All" : `${score}+`}
            </Button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">&times;</button>
        </div>
      )}

      {/* Gallery */}
      {sortedHighlights.length === 0 ? (
        <div className="text-center py-24 rounded-2xl border border-zinc-700/50 bg-zinc-800/30">
          <div className="p-4 rounded-2xl bg-zinc-800/50 ring-1 ring-zinc-700/50 w-fit mx-auto mb-6">
            <Sparkles className="h-12 w-12 text-zinc-600" />
          </div>
          <h3 className="text-xl font-medium text-zinc-400 mb-2">
            {highlights.length === 0 ? "No highlights yet" : "No highlights match your filters"}
          </h3>
          <p className="text-sm text-zinc-500 mb-6 max-w-sm mx-auto">
            {highlights.length === 0
              ? "Upload a video and wait for AI analysis to generate highlights"
              : "Try adjusting the score filter to see more results"}
          </p>
          {highlights.length === 0 && (
            <Button asChild>
              <Link href="/upload">
                Upload a Video
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedHighlights.map((highlight) => {
            const clip = getClipForHighlight(highlight.id);
            const hasClip = !!clip;

            return (
              <Card
                key={highlight.id}
                className="overflow-hidden group hover:border-zinc-600/50 hover:-translate-y-0.5 transition-all duration-300"
              >
                {/* Thumbnail / Preview */}
                <Link href={`/videos/${highlight.video_id}`}>
                  <div className="aspect-video bg-zinc-700 relative overflow-hidden">
                    {highlight.video_thumbnail ? (
                      <img
                        src={highlight.video_thumbnail}
                        alt={highlight.video_title || "Video"}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Film className="h-10 w-10 text-zinc-600" />
                      </div>
                    )}

                    {/* Score badge */}
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant={highlight.score >= 80 ? "success" : highlight.score >= 60 ? "warning" : "secondary"}
                        className="text-xs font-bold backdrop-blur-sm"
                      >
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        {highlight.score}
                      </Badge>
                    </div>

                    {/* Duration */}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-xs text-zinc-300 backdrop-blur-sm flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(highlight.start_time)} - {formatTime(highlight.end_time)}
                    </div>

                    {/* Hover play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40">
                      <div className="p-3 rounded-full bg-violet-500/80 group-hover:bg-violet-500 transition-all group-hover:scale-110">
                        <Play className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </div>
                </Link>

                <CardContent className="p-4 space-y-3">
                  {/* Video title */}
                  <Link
                    href={`/videos/${highlight.video_id}`}
                    className="text-sm font-medium text-zinc-200 hover:text-violet-300 transition-colors line-clamp-1"
                  >
                    {highlight.video_title || "Untitled Video"}
                  </Link>

                  {/* Summary */}
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                    {highlight.summary || "AI-detected highlight moment"}
                  </p>

                  {/* Stats row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {((highlight.end_time - highlight.start_time) / 60).toFixed(0)}min
                      </Badge>
                      <span className="text-[10px] text-zinc-600">
                        {new Date(highlight.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Preview button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10"
                        onClick={() => window.open(`/videos/${highlight.video_id}?highlight=${highlight.id}`, "_blank")}
                        title="Open highlight"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                      {/* Download button */}
                      {hasClip && clip?.file_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => handleDownload(clip.id)}
                          title="Download clip"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary footer */}
      {sortedHighlights.length > 0 && (
        <div className="flex items-center justify-center gap-4 py-4 text-xs text-zinc-600 border-t border-zinc-800/50">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            {totalHighlights} total highlights
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            Avg score: {Math.round(highlights.reduce((a, b) => a + b.score, 0) / highlights.length)}
          </span>
          <span className="flex items-center gap-1">
            <Film className="h-3 w-3" />
            {clips.length} clips generated
          </span>
        </div>
      )}
    </div>
  );
}
