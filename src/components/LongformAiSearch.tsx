"use client";

import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2, Download } from "lucide-react";
import { UntappedNicheTable, UntappedNicheRow } from "@/components/UntappedNicheTable";
import { ChannelPerformanceGraph } from "@/components/ChannelPerformanceGraph";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import * as XLSX from "xlsx";

type GraphMode = "manual" | "top3_growth" | "top5_growth";

function formatRowsForExport(results: UntappedNicheRow[]) {
  return results.map((row) => {
    let popularTitle = row.firstVideoTitle;
    let popularUrl = row.firstVideoUrl;
    let popularViews = row.firstVideoViews;
    
    if (row.performanceSeries && row.performanceSeries.length > 0) {
      const best = [...row.performanceSeries].sort((a, b) => b.views - a.views)[0];
      if (best.views > popularViews) {
        popularTitle = best.title;
        popularUrl = best.videoId ? `https://www.youtube.com/watch?v=${best.videoId}` : popularUrl;
        popularViews = best.views;
      }
    }

    return {
      "Channel Name": row.channelName,
      "Channel URL": row.channelUrl,
      "Channel Creation Date": new Date(row.channelCreationDate).toISOString().slice(0, 10),
      "First Video Title": row.firstVideoTitle,
      "First Video URL": row.firstVideoUrl,
      "First Video Views": row.firstVideoViews,
      "First Video Upload Date": new Date(row.firstVideoUploadDate).toISOString().slice(0, 10),
      "Popular Video Title": popularTitle,
      "Popular Video URL": popularUrl,
      "Popular Video Views": popularViews,
      "Niche / Sub-niche": row.nicheLabel,
      "Detected Language": row.detectedLanguage,
      "Videos Per Day": row.uploadsPerDay ?? "",
      "Estimated Competition Level": row.competitionLevel,
      "Why Untapped": row.untappedReason,
    };
  });
}

function LongformDashboardContent() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UntappedNicheRow[]>([]);
  const [selectedGraphChannels, setSelectedGraphChannels] = useState<string[]>([]);
  const [graphMode, setGraphMode] = useState<GraphMode>("manual");
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setResults([]);
    setAiStatus("Parsing your prompt with Gemini AI...");
    
    try {
      // 1. Parse prompt via AI
      const aiRes = await fetch("/api/ai/parse-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const aiData = await aiRes.json();

      if (!aiRes.ok) {
        toast.error(aiData.error || "Failed to parse prompt");
        setLoading(false);
        setAiStatus(null);
        return;
      }

      const { queries, filters } = aiData.data;
      if (!queries || queries.length === 0) {
        toast.error("AI could not generate any search queries from your prompt.");
        setLoading(false);
        setAiStatus(null);
        return;
      }

      setAiStatus(`Searching YouTube for ${queries.length} niches...`);

      // 2. Run searches for each query in parallel or sequentially (we will do sequentially to avoiding rate limits)
      const allResults: UntappedNicheRow[] = [];
      const seenChannelIds = new Set<string>();

      for (let i = 0; i < queries.length; i++) {
        setAiStatus(`Searching YouTube for niche ${i + 1}/${queries.length}: "${queries[i]}"`);
        const searchRes = await fetch("/api/youtube/search", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             query: queries[i],
             filters: {
               videoDuration: filters.videoDuration || "long",
               minViews: filters.minViews,
               maxViews: filters.maxViews,
               firstVideoUploadedAfter: filters.firstVideoUploadedAfter,
               publishedAfter: filters.publishedAfter,
               publishedBefore: filters.publishedBefore,
             }
           })
        });

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const newRows: UntappedNicheRow[] = searchData.data || [];
          for (const r of newRows) {
             if (!seenChannelIds.has(r.channelId)) {
               seenChannelIds.add(r.channelId);
               allResults.push(r);
             }
          }
        }
      }

      setResults(allResults);
      setAiStatus(null);
      toast.success(`Search complete. Found ${allResults.length} matching channels.`);

      if (allResults.length > 0) {
        const rowsToExport = formatRowsForExport(allResults);
        toast.promise(
          fetch("/api/export/sheet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "AI Search: " + prompt, rows: rowsToExport })
          }).then(async r => {
            if (!r.ok) throw new Error("Failed to export");
            return r.json();
          }),
          {
            loading: "Saving results to Google Drive...",
            success: () => "Successfully saved to Google Sheets!",
            error: "Failed to automatically save to Drive."
          }
        );
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while processing your request.");
      setAiStatus(null);
    }
    setLoading(false);
  };

  const downloadAsExcel = () => {
    if (results.length === 0) return;
    const rows = formatRowsForExport(results);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AI Longform Niches");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `ai_longform_niches_${date}.xlsx`);
  };

  const totalChannels = results.length;
  const totalViews = results.reduce((acc, row) => acc + row.firstVideoViews, 0);
  const avgViews = totalChannels > 0 ? Math.round(totalViews / totalChannels) : 0;
  const avgCompetition = totalChannels > 0
    ? Number((results.reduce((acc, row) => acc + row.competitionLevel, 0) / totalChannels).toFixed(1))
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-primary" />
          Longform AI Search
        </h1>
        <p className="text-muted-foreground">Describe your ideal longform YouTube channels, and our AI will translate it into highly targeted searches.</p>
      </div>

      <div className="flex flex-col gap-4">
        <form onSubmit={handleSearch} className="flex flex-col gap-3">
          <Textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., What are currently recent trending channels that started in the last 60 days have an rpm of 5$ or higher and got atleast 1 million views in 30 days"
            className="h-24 text-lg bg-card resize-none"
          />
          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={loading} className="w-full md:w-auto">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
              {loading ? (aiStatus || "Processing...") : "Start AI Search"}
            </Button>
          </div>
        </form>
      </div>

      {loading && aiStatus && (
        <Card className="p-6 flex flex-col items-center justify-center text-center text-muted-foreground border-primary/20 bg-primary/5">
           <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
           <p className="text-lg font-medium text-foreground">{aiStatus}</p>
        </Card>
      )}

      {results.length > 0 && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Matched Channels</p>
            <p className="text-2xl font-bold">{totalChannels.toLocaleString()}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Views</p>
            <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Average Views</p>
            <p className="text-2xl font-bold">{avgViews.toLocaleString()}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Average Competition</p>
            <p className="text-2xl font-bold">{avgCompetition}</p>
          </Card>
        </div>
      )}

      {results.length > 0 && !loading && (
        <ChannelPerformanceGraph
          data={results}
          selectedChannelIds={selectedGraphChannels}
          onSelectedChannelIdsChange={setSelectedGraphChannels}
          growthMode={graphMode}
          onGrowthModeChange={setGraphMode}
        />
      )}

      {!loading && (
        <Card className="flex flex-col overflow-hidden">
          <div className="overflow-x-auto p-0">
            {results.length > 0 ? (
              <UntappedNicheTable data={results} />
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                Run an AI search to see results
              </div>
            )}
          </div>
        </Card>
      )}

      {!loading && results.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={downloadAsExcel} className="min-w-52">
            <Download className="w-4 h-4 mr-2" />
            Download as Excel
          </Button>
        </div>
      )}
    </div>
  );
}

export function LongformAiSearch() {
  return <LongformDashboardContent />;
}
