"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVideos } from "@/hooks/useVideos";
import { useAuth } from "@/hooks/useAuth";
import { clipApi } from "@/services/api";
import type { Clip } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Video, Film, HardDrive, Activity, Upload, ArrowRight,
  Loader2, AlertCircle, Clock, CheckCircle, XCircle,
  Film as FilmIcon, Zap, Play, TrendingUp, Sparkles,
  Hash,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { videos, total, isLoading, error, fetchVideos } = useVideos();
  const [clips, setClips] = useState<Clip[]>([]);
  const [clipsLoading, setClipsLoading] = useState(true);

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
    } finally {
      setClipsLoading(false);
    }
  };

  // Derived stats
  const readyVideos = videos.filter((v) => v.status === "ready").length;
  const processingVideos = videos.filter((v) => v.status === "processing" || v.status === "pending").length;
  const totalClips = clips.length;

  // Estimate storage (MB)
  const totalStorageMB = videos.reduce((sum, v) => {
    return sum + (v.duration ? v.duration * 0.5 : 0);
  }, 0);
  const storageUsed = totalStorageMB > 1024
    ? `${(totalStorageMB / 1024).toFixed(1)} GB`
    : `${totalStorageMB.toFixed(0)} MB`;

  // Recent activity
  const recentActivity = [
    ...videos.map((v) => ({
      id: v.id,
      type: "video" as const,
      title: v.title || "Untitled Video",
      status: v.status,
      date: v.created_at,
    })),
    ...clips.map((c) => ({
      id: c.id,
      type: "clip" as const,
      title: `Clip from ${c.video?.title || "video"}`,
      status: c.file_url ? "ready" : "failed",
      date: c.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  // Processing queue
  const processingQueue = videos
    .filter((v) => v.status === "processing" || v.status === "pending")
    .map((v) => ({
      videoId: v.id,
      title: v.title || "Untitled Video",
      status: v.status as "pending" | "processing",
      progress: v.jobs?.[0]?.progress ?? 0,
    }));

  const stats = [
    {
      label: "Total Videos",
      value: total,
      icon: Video,
      gradient: "from-violet-500 to-indigo-600",
      bg: "bg-violet-500/10",
      text: "text-violet-400",
      badge: readyVideos > 0 ? `${readyVideos} ready` : undefined,
    },
    {
      label: "Generated Clips",
      value: clipsLoading ? "..." : totalClips,
      icon: Film,
      gradient: "from-emerald-500 to-teal-600",
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
    },
    {
      label: "Storage Used",
      value: storageUsed,
      icon: HardDrive,
      gradient: "from-amber-500 to-orange-600",
      bg: "bg-amber-500/10",
      text: "text-amber-400",
    },
    {
      label: "Processing",
      value: processingVideos,
      icon: Clock,
      gradient: "from-fuchsia-500 to-pink-600",
      bg: "bg-fuchsia-500/10",
      text: "text-fuchsia-400",
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Welcome{user?.name ? `, ${user.name}` : " back"} 👋
          </h1>
          <p className="text-zinc-400 mt-1">
            Here&apos;s what&apos;s happening with your video highlights.
          </p>
        </div>
        <Button asChild className="hidden sm:flex">
          <Link href="/upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload Video
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="hover:border-zinc-600/50 transition">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-zinc-400">{stat.label}</span>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.text}`} />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                {stat.badge && (
                  <Badge variant="success" className="text-[10px] px-1.5 py-0">
                    {stat.badge}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/upload"
          className="group rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-6 backdrop-blur-sm hover:from-violet-500/20 hover:to-fuchsia-500/20 transition-all duration-300 hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-violet-500/20 group-hover:bg-violet-500/30 transition-colors">
              <Upload className="h-6 w-6 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-white group-hover:text-violet-300 transition-colors">
                Upload a Video
              </h3>
              <p className="text-sm text-zinc-400 truncate">
                Upload a file or paste a URL to generate AI highlights
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-zinc-500 group-hover:text-violet-400 transition-colors flex-shrink-0" />
          </div>
        </Link>

        <Link
          href="/videos"
          className="group rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-6 backdrop-blur-sm hover:border-zinc-600/50 hover:-translate-y-0.5 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-zinc-700/50 group-hover:bg-zinc-700/70 transition-colors">
              <Video className="h-6 w-6 text-zinc-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-white group-hover:text-zinc-300 transition-colors">
                View All Videos
              </h3>
              <p className="text-sm text-zinc-400 truncate">
                Browse your video library and generated clips
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-zinc-500 group-hover:text-zinc-300 transition-colors flex-shrink-0" />
          </div>
        </Link>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processing Queue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Clock className="h-5 w-5 text-amber-400" />
              Processing Queue
            </CardTitle>
            {processingQueue.length > 0 && (
              <Badge variant="warning">{processingQueue.length} jobs</Badge>
            )}
          </CardHeader>
          <CardContent>
            {processingQueue.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-10 w-10 text-emerald-500/50 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No videos currently processing</p>
              </div>
            ) : (
              <div className="space-y-3">
                {processingQueue.map((item) => (
                  <Link
                    key={item.videoId}
                    href={`/videos/${item.videoId}`}
                    className="block p-3 rounded-lg bg-zinc-700/30 hover:bg-zinc-700/50 transition group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                        {item.title}
                      </span>
                      <span className={`flex items-center gap-1 text-xs font-medium ${
                        item.status === "processing" ? "text-amber-400" : "text-zinc-400"
                      }`}>
                        {item.status === "processing" ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Processing</>
                        ) : (
                          <><Clock className="h-3 w-3" /> Queued</>
                        )}
                      </span>
                    </div>
                    <Progress value={item.progress} className="h-1.5" />
                    <p className="text-xs text-zinc-500 mt-1">{item.progress}% complete</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Activity className="h-5 w-5 text-violet-400" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No activity yet. Upload a video to get started!</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentActivity.map((item) => (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={item.type === "video" ? `/videos/${item.id}` : "#"}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-700/30 transition group"
                  >
                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                      item.type === "video" ? "bg-violet-500/10" : "bg-emerald-500/10"
                    }`}>
                      {item.type === "video" ? (
                        <FilmIcon className="h-4 w-4 text-violet-400" />
                      ) : (
                        <Play className="h-4 w-4 text-emerald-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate group-hover:text-white transition">
                        {item.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(item.date).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {item.status === "ready" ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : item.status === "failed" ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Videos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Recent Videos</h2>
          {videos.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/videos" className="text-violet-400 hover:text-violet-300">
                View all &rarr;
              </Link>
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-3 py-16 text-zinc-500">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span>{error}</span>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-zinc-700/50 bg-zinc-800/30">
            <Video className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-400 mb-2">No videos yet</h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-sm mx-auto">
              Upload your first video to start generating AI-powered highlights automatically
            </p>
            <Button asChild>
              <Link href="/upload">
                <Upload className="h-4 w-4 mr-2" /> Upload Video
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.slice(0, 6).map((video) => (
              <Link
                key={video.id}
                href={`/videos/${video.id}`}
                className="group rounded-xl border border-zinc-700/50 bg-zinc-800/50 overflow-hidden hover:border-zinc-600/50 hover:bg-zinc-800/80 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="aspect-video bg-zinc-700 relative overflow-hidden">
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt={video.title || "Video thumbnail"}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Video className="h-10 w-10 text-zinc-600" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant={video.status === "ready" ? "success" : video.status === "processing" ? "warning" : video.status === "failed" ? "destructive" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {video.status}
                    </Badge>
                  </div>
                  {video.duration && (
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-xs text-zinc-300 backdrop-blur-sm">
                      {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, "0")}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-white truncate group-hover:text-violet-300 transition-colors">
                    {video.title || "Untitled Video"}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {new Date(video.created_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
