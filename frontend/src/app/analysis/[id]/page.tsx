"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { videoApi } from "@/services/api";
import type { Video, Job } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Video as VideoIcon,
  FileText,
  Sparkles,
  Film,
  Zap,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

// ─── Pipeline Stages ─────────────────────────────────────
interface PipelineStage {
  id: string;
  label: string;
  description: string;
  icon: typeof FileText;
  status: "pending" | "active" | "completed" | "failed";
  progress?: number;
}

const PIPELINE_STAGES: Omit<PipelineStage, "status" | "progress">[] = [
  {
    id: "transcribing",
    label: "Transcribing",
    description: "Extracting audio and generating transcript",
    icon: FileText,
  },
  {
    id: "analyzing",
    label: "Analyzing Content",
    description: "AI scans for key moments and highlights",
    icon: Sparkles,
  },
  {
    id: "scoring",
    label: "Scoring Highlights",
    description: "Ranking moments by relevance and impact",
    icon: Zap,
  },
  {
    id: "generating",
    label: "Generating Clips",
    description: "Preparing final highlight clips",
    icon: Film,
  },
];

const POLL_INTERVAL = 3000; // 3 seconds

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [video, setVideo] = useState<Video | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstLoad = useRef(true);

  // ─── Job type matching helpers ─────────────────────────
  function jobTypeMatchesStage(jobType: string, stageId: string): boolean {
    const t = jobType.toLowerCase();
    const s = stageId.toLowerCase();
    // Map stage IDs to their corresponding job type keywords
    if (s.startsWith("transcrib")) return t.includes("transcribe");
    if (s.startsWith("analyz")) return t.includes("analyze") || t.includes("highlight");
    if (s.startsWith("scor")) return t.includes("score");
    if (s.startsWith("generat")) return t.includes("clip") || t.includes("generate");
    return t.includes(s);
  }

  function findActiveStageIndex(jobList: Job[]): number {
    const activeJob = jobList.find((j) => j.status === "processing" || j.status === "pending");
    if (activeJob) {
      const jobType = activeJob.type?.toLowerCase() || "";
      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        if (jobTypeMatchesStage(jobType, PIPELINE_STAGES[i].id)) return i;
      }
      return 0;
    }
    const allCompleted = jobList.length > 0 && jobList.every((j) => j.status === "completed");
    return allCompleted ? PIPELINE_STAGES.length : -1;
  }

  // Compute pipeline stages from jobs
  const getPipelineStages = useCallback((): PipelineStage[] => {
    const videoStatus = video?.status;

    if (videoStatus === "ready") {
      return PIPELINE_STAGES.map((stage) => ({
        ...stage,
        status: "completed" as const,
        progress: 100,
      }));
    }

    if (videoStatus === "failed") {
      return PIPELINE_STAGES.map((stage) => ({
        ...stage,
        status: "failed" as const,
      }));
    }

    const activeStageIndex = findActiveStageIndex(jobs);

    return PIPELINE_STAGES.map((stage, index) => {
      let status: PipelineStage["status"] = "pending";
      if (index < activeStageIndex) {
        status = "completed";
      } else if (index === activeStageIndex) {
        status = "active";
      }

      // Find matching job by type
      const jobForStage = jobs.find((j) => jobTypeMatchesStage(j.type || "", stage.id));
      const progress = jobForStage?.progress;

      return {
        ...stage,
        status,
        progress,
      };
    });
  }, [jobs, video?.status]);

  // Load and poll
  const loadVideo = useCallback(async () => {
    try {
      const res = await videoApi.get(id);
      const { video: videoData, jobs: jobsData } = res.data.data;
      setVideo(videoData);
      setJobs(jobsData || []);
      setError(null);
    } catch (err) {
      // Only set error on initial load, not on poll errors
      if (isFirstLoad.current) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to load video.";
        setError(msg);
        isFirstLoad.current = false;
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadVideo();
    // Start polling
    pollRef.current = setInterval(() => {
      loadVideo();
      setTimeElapsed((prev) => prev + POLL_INTERVAL / 1000);
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadVideo]);

  // Stop polling when video is ready or failed
  useEffect(() => {
    if (video?.status === "ready" || video?.status === "failed") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [video?.status]);

  const pipeline = getPipelineStages();
  const isProcessing = video?.status === "processing" || video?.status === "pending";
  const isComplete = video?.status === "ready";
  const isFailed = video?.status === "failed";

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-64" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !video) {
    return (
      <div className="text-center py-24 max-w-3xl mx-auto">
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
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Link>
      </Button>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Analysis Status
          </h1>
          <Badge
            variant={isComplete ? "success" : isFailed ? "destructive" : "warning"}
            className="text-xs"
          >
            {isComplete ? "Completed" : isFailed ? "Failed" : "In Progress"}
          </Badge>
        </div>
        <p className="text-zinc-400">
          {video?.title || "Untitled Video"}
        </p>
      </div>

      {/* Video Info Card */}
      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-20 h-14 rounded-lg bg-zinc-700 overflow-hidden flex-shrink-0">
            {video?.thumbnail ? (
              <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full">
                <VideoIcon className="h-6 w-6 text-zinc-600" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {video?.title || "Untitled Video"}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
              {video?.duration && (
                <span>{formatTime(video.duration)}</span>
              )}
              <span>ID: {id.slice(0, 8)}...</span>
            </div>
          </div>
          {isProcessing && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 flex-shrink-0">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Live
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline */}
      <div className="relative">
        {/* Connection line */}
        <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-zinc-700/50 hidden sm:block" />

        <div className="space-y-3">
          {pipeline.map((stage, index) => (
            <div
              key={stage.id}
              className={`relative flex items-start gap-4 p-4 rounded-xl border transition-all duration-500 ${
                stage.status === "active"
                  ? "border-violet-500/50 bg-violet-500/5 shadow-sm shadow-violet-500/10"
                  : stage.status === "completed"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : stage.status === "failed"
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-zinc-700/50 bg-zinc-800/30 opacity-50"
              }`}
            >
              {/* Status indicator */}
              <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-500 ${
                stage.status === "active"
                  ? "bg-violet-500/20 ring-2 ring-violet-500/30"
                  : stage.status === "completed"
                  ? "bg-emerald-500/20"
                  : stage.status === "failed"
                  ? "bg-red-500/20"
                  : "bg-zinc-700/50"
              }`}>
                {stage.status === "completed" ? (
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                ) : stage.status === "failed" ? (
                  <XCircle className="h-5 w-5 text-red-400" />
                ) : stage.status === "active" ? (
                  <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
                ) : (
                  <Clock className="h-5 w-5 text-zinc-600" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className={`text-sm font-semibold ${
                      stage.status === "active"
                        ? "text-violet-300"
                        : stage.status === "completed"
                        ? "text-emerald-300"
                        : stage.status === "failed"
                        ? "text-red-300"
                        : "text-zinc-500"
                    }`}>
                      {stage.label}
                    </h3>
                    <p className={`text-xs mt-0.5 ${
                      stage.status === "active" ? "text-zinc-400" : "text-zinc-600"
                    }`}>
                      {stage.status === "active"
                        ? stage.description
                        : stage.status === "completed"
                        ? "Complete"
                        : stage.status === "failed"
                        ? "Failed"
                        : "Waiting..."}
                    </p>
                  </div>

                  {/* Progress for active stage */}
                  {stage.status === "active" && stage.progress !== undefined && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-medium text-violet-400">{stage.progress}%</span>
                    </div>
                  )}
                </div>

                {/* Progress bar for active stage */}
                {stage.status === "active" && stage.progress !== undefined && (
                  <Progress value={stage.progress} className="h-1.5 mt-3" />
                )}
              </div>

              {/* Step number */}
              <div className="hidden sm:flex absolute -left-[13px] top-7 w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-700 items-center justify-center z-10">
                <span className="text-[10px] font-bold text-zinc-500">{index + 1}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timer / Stats */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">
                {isComplete ? "✓" : isProcessing ? `${timeElapsed}s` : "—"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Time Elapsed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{jobs.length}</p>
              <p className="text-xs text-zinc-500 mt-1">Total Jobs</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {jobs.filter((j) => j.status === "completed").length}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{jobs.filter((j) => j.status === "processing" || j.status === "pending").length}</p>
              <p className="text-xs text-zinc-500 mt-1">Active</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {isComplete && (
          <Button onClick={() => router.push(`/videos/${id}`)} size="lg" className="flex-1">
            <Film className="h-4 w-4 mr-2" />
            View Results
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
        {isProcessing && (
          <Button onClick={() => router.push(`/videos/${id}`)} variant="outline" className="flex-1">
            View Video Details
          </Button>
        )}
        {isFailed && (
          <Button onClick={() => router.push(`/videos/${id}`)} variant="outline" className="flex-1">
            <AlertCircle className="h-4 w-4 mr-2" />
            View Error Details
          </Button>
        )}
      </div>
    </div>
  );
}
