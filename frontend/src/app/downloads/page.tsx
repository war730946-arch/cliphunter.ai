"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { clipApi } from "@/services/api";
import type { Clip } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Film,
  Play,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  Search,
  ArrowUpDown,
  FileVideo,
  HardDrive,
  Calendar,
} from "lucide-react";

interface DownloadHistoryEntry {
  id: string;
  clip_id: string;
  highlight_summary: string | null;
  video_title: string | null;
  quality: "720p" | "1080p";
  format: string;
  size: number | null;
  downloaded_at: string;
}

export default function DownloadsPage() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "ready" | "generating">("all");
  const [sortBy, setSortBy] = useState<"date" | "size" | "name">("date");
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryEntry[]>([]);

  useEffect(() => {
    loadClips();
    loadDownloadHistory();
  }, []);

  const loadClips = async () => {
    try {
      const { data } = await clipApi.list();
      setClips(data.data?.clips || []);
    } catch {
      setError("Failed to load clips.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDownloadHistory = () => {
    try {
      const stored = localStorage.getItem("cliphunter_download_history");
      if (stored) {
        setDownloadHistory(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  };

  const addToDownloadHistory = (clip: Clip, quality: "720p" | "1080p") => {
    const entry: DownloadHistoryEntry = {
      id: `dl_${Date.now()}`,
      clip_id: clip.id,
      highlight_summary: clip.highlight?.summary || null,
      video_title: clip.video?.title || null,
      quality,
      format: "MP4",
      size: clip.size,
      downloaded_at: new Date().toISOString(),
    };
    const updated = [entry, ...downloadHistory].slice(0, 50);
    setDownloadHistory(updated);
    localStorage.setItem("cliphunter_download_history", JSON.stringify(updated));
  };

  const handleDownload = async (clipId: string, quality: "720p" | "1080p") => {
    setDownloading(`${clipId}_${quality}`);
    try {
      const res = await clipApi.download(clipId, quality);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `clip_${clipId.slice(0, 8)}_${quality}.mp4`;
      a.click();
      window.URL.revokeObjectURL(url);

      // Record download
      const clip = clips.find((c) => c.id === clipId);
      if (clip) addToDownloadHistory(clip, quality);
    } catch {
      setError(`Download failed for clip ${clipId.slice(0, 8)}...`);
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (clipId: string) => {
    if (!confirm("Delete this clip?")) return;
    try {
      await clipApi.delete(clipId);
      setClips((prev) => prev.filter((c) => c.id !== clipId));
    } catch {
      setError("Failed to delete clip.");
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (seconds: number | null): string => {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Filter and sort
  const filteredClips = clips
    .filter((c) => {
      if (filter === "ready") return c.file_url;
      if (filter === "generating") return !c.file_url;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "date") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "size") return (b.size || 0) - (a.size || 0);
      if (sortBy === "name") return (a.highlight?.summary || "").localeCompare(b.highlight?.summary || "");
      return 0;
    });

  const readyCount = clips.filter((c) => c.file_url).length;
  const generatingCount = clips.filter((c) => !c.file_url).length;

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
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
            <h1 className="text-3xl font-bold text-white">Downloads</h1>
            <Badge variant="info" className="text-xs">
              {clips.length} clips
            </Badge>
          </div>
          <p className="text-zinc-400 mt-1">
            {readyCount} ready to download &bull; {generatingCount} still processing
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">&times;</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">All ({clips.length})</TabsTrigger>
            <TabsTrigger value="ready">Ready ({readyCount})</TabsTrigger>
            <TabsTrigger value="generating">Processing ({generatingCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-zinc-500" />
          {(["date", "size", "name"] as const).map((option) => (
            <Button
              key={option}
              variant={sortBy === option ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy(option)}
              className="text-xs h-8"
            >
              {option === "date" ? "Newest" : option === "size" ? "Size" : "Name"}
            </Button>
          ))}
        </div>
      </div>

      {/* Clip List */}
      {filteredClips.length === 0 ? (
        <div className="text-center py-24 rounded-2xl border border-zinc-700/50 bg-zinc-800/30">
          <div className="p-4 rounded-2xl bg-zinc-800/50 ring-1 ring-zinc-700/50 w-fit mx-auto mb-6">
            <Download className="h-12 w-12 text-zinc-600" />
          </div>
          <h3 className="text-xl font-medium text-zinc-400 mb-2">
            {filter === "generating" ? "No clips processing" : "No clips yet"}
          </h3>
          <p className="text-sm text-zinc-500 mb-6 max-w-sm mx-auto">
            {filter === "generating"
              ? "All your clips have been generated"
              : "Generate highlights from your videos to see clips here"}
          </p>
          {filter === "all" && (
            <Button asChild>
              <Link href="/videos">Go to Videos</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClips.map((clip) => {
            const isGenerating = !clip.file_url;

            return (
              <Card
                key={clip.id}
                className={`overflow-hidden hover:border-zinc-600/50 transition ${
                  isGenerating ? "opacity-70" : ""
                }`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Thumbnail */}
                    <Link
                      href={isGenerating ? "#" : `/clips/${clip.id}`}
                      className={`w-full sm:w-36 aspect-video sm:aspect-[16/9] rounded-lg bg-zinc-700 relative overflow-hidden flex-shrink-0 ${
                        !isGenerating ? "group cursor-pointer" : ""
                      }`}
                    >
                      {clip.thumbnail_url ? (
                        <img
                          src={clip.thumbnail_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : clip.video?.title ? (
                        <img
                          src={`https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200&h=112&fit=crop`}
                          alt=""
                          className="w-full h-full object-cover opacity-50"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Film className="h-8 w-8 text-zinc-600" />
                        </div>
                      )}

                      {!isGenerating && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                          <div className="p-2 rounded-full bg-violet-500/80">
                            <Play className="h-5 w-5 text-white" />
                          </div>
                        </div>
                      )}

                      {isGenerating && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <div className="text-center">
                            <Loader2 className="h-6 w-6 text-amber-400 animate-spin mx-auto mb-1" />
                            <span className="text-[10px] text-amber-400">Processing</span>
                          </div>
                        </div>
                      )}
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={isGenerating ? "#" : `/clips/${clip.id}`}
                            className={`text-sm font-medium line-clamp-1 ${
                              isGenerating
                                ? "text-zinc-400"
                                : "text-white hover:text-violet-300 transition-colors"
                            }`}
                          >
                            {clip.highlight?.summary || "Generated Clip"}
                          </Link>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {clip.video?.title || "Unknown video"}
                          </p>
                        </div>
                        <Badge
                          variant={isGenerating ? "warning" : "success"}
                          className="text-[10px] flex-shrink-0"
                        >
                          {isGenerating ? "Generating..." : "Ready"}
                        </Badge>
                      </div>

                      {/* Details */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                        {clip.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {clip.duration.toFixed(1)}s
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <FileVideo className="h-3 w-3" />
                          MP4
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3" />
                          {formatFileSize(clip.size)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(clip.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric",
                          })}
                        </span>
                        {clip.highlight && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {clip.highlight.score}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        {isGenerating ? (
                          <div className="flex items-center gap-2 text-xs text-amber-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Clip still processing — check back shortly
                          </div>
                        ) : (
                          <>
                            {/* Quality download options */}
                            <Button
                              size="sm"
                              onClick={() => handleDownload(clip.id, "720p")}
                              disabled={downloading === `${clip.id}_720p`}
                              className="h-8 text-xs"
                            >
                              {downloading === `${clip.id}_720p` ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Download className="h-3 w-3 mr-1" />
                              )}
                              720p
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(clip.id, "1080p")}
                              disabled={downloading === `${clip.id}_1080p`}
                              className="h-8 text-xs"
                            >
                              {downloading === `${clip.id}_1080p` ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Download className="h-3 w-3 mr-1" />
                              )}
                              1080p
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-zinc-500 hover:text-violet-400"
                              asChild
                            >
                              <Link href={`/clips/${clip.id}`} title="Preview">
                                <Play className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-zinc-500 hover:text-red-400"
                              onClick={() => handleDelete(clip.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Download History */}
      {downloadHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-lg">
              <Download className="h-5 w-5 text-emerald-400" />
              Download History
              <Badge variant="outline" className="text-[10px] ml-1">
                {downloadHistory.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {downloadHistory.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-700/30 transition group"
                >
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">
                      {entry.highlight_summary || "Generated clip"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {entry.video_title || "Unknown"} &bull; {entry.quality} &bull; {entry.format}
                      {entry.size ? ` &bull; ${formatFileSize(entry.size)}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-600 flex-shrink-0">
                    {new Date(entry.downloaded_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
            {downloadHistory.length > 10 && (
              <p className="text-xs text-zinc-600 text-center mt-3">
                +{downloadHistory.length - 10} more downloads
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {clips.length > 0 && (
        <div className="flex items-center justify-center gap-4 py-4 text-xs text-zinc-600 border-t border-zinc-800/50">
          <span className="flex items-center gap-1">
            <Film className="h-3 w-3" />
            {clips.length} total clips
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            Total: {formatFileSize(clips.reduce((acc, c) => acc + (c.size || 0), 0))}
          </span>
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {downloadHistory.length} downloads
          </span>
        </div>
      )}
    </div>
  );
}
