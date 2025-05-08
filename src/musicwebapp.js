// MusicWebApp.jsx
// Dark‑mode React single‑page app for GitHub Pages
// v6 – Townes van Zandt palette + smoother hero dismiss + new title
// Palette: slate‑blue night #1f2b38, dusty‑tan #c5a77d, whiskey‑amber #d9a441, off‑white #e7e3d7
// Hero fades on first scroll or wheel, no opacity flicker.

import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Card, CardContent } from "./components/ui/card";
import { Dialog, DialogContent } from "./components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import ForceGraph2D from "react-force-graph-2d";

/* ---------- helpers ---------- */
const safeJSON = (txt) => {
  if (!txt) return [];
  try {
    return JSON.parse(txt);
  } catch {
    return [];
  }
};

const buildGraph = (rows) => {
  const nodes = rows.map((r, idx) => ({
    id: idx,
    title: r.song,
    img: r.cover_url || "https://placehold.co/128x128",
    artist: r.artist,
    album: r.album,
  }));
  const links = [];
  rows.forEach((r, i) => {
    const relAlbum = safeJSON(r["related artists - album"]);
    const relOther = safeJSON(r["related artists - other"]);
    nodes.forEach((n, j) => {
      if (i !== j) {
        if (relAlbum.includes(n.artist)) links.push({ source: i, target: j, value: 2 });
        else if (relOther.includes(n.artist)) links.push({ source: i, target: j, value: 1 });
      }
    });
  });
  return { nodes, links };
};

export default function MusicWebApp() {
  const [rows, setRows] = useState([]);
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showHero, setShowHero] = useState(true);

  /* ---------- load CSV ---------- */
  useEffect(() => {
    Papa.parse("/songs_with_links_albums_enriched.csv", {
      download: true,
      header: true,
      complete: ({ data }) => setRows(data.filter((d) => d.song)),
    });
  }, []);

  /* ---------- dismiss hero on first interaction ---------- */
  useEffect(() => {
    if (!showHero) return; // already dismissed
    const dismiss = () => setShowHero(false);
    const onScroll = () => {
      if (window.scrollY > 40) dismiss();
    };
    window.addEventListener("wheel", dismiss, { once: true });
    window.addEventListener("scroll", onScroll);
    window.addEventListener("keydown", dismiss, { once: true });
    return () => {
      window.removeEventListener("wheel", dismiss);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", dismiss);
    };
  }, [showHero]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => a.artist.localeCompare(b.artist) * (sortAsc ? 1 : -1));
  }, [rows, sortAsc]);

  const graphData = useMemo(() => buildGraph(rows), [rows]);

  /* ---------- UI ---------- */
  return (
    <div className="relative bg-[#1f2b38] text-[#e7e3d7] min-h-screen font-sans selection:bg-[#d9a441]/60">
      {/* Hero Overlay */}
      {showHero && (
        <section className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto bg-gradient-to-b from-[#1f2b38] via-[#344049] to-[#6b6756]">
          <div className="text-center px-6" role="banner">
            <h1 className="text-4xl md:text-5xl font-serif tracking-wide text-[#d9a441] mb-6 drop-shadow-sm select-none">
              Fussin' &amp; Lovin': A Year of Songs
            </h1>
            <p className="max-w-xl mx-auto text-lg leading-relaxed text-[#c5a77d]">
              365 entries of dusty folk, bar‑room blues and highway ballads—mapped, linked, fussed and
              loved. Scroll or press any key to ride along.
            </p>
            <div className="mt-10 animate-bounce text-[#d9a441]">↓</div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <main className="relative z-10 pt-8 px-6 md:px-10">
        <Tabs defaultValue="list" className="w-full">
          <TabsList className="flex gap-4 mb-8">
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="web">The Web</TabsTrigger>
          </TabsList>

          {/* List Tab */}
          <TabsContent value="list">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#c5a77d]/40">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4 cursor-pointer" onClick={() => setSortAsc(!sortAsc)}>
                      Artist {sortAsc ? "↑" : "↓"}
                    </th>
                    <th className="py-2 pr-4">Song</th>
                    <th className="py-2">Album</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-[#d9a441]/15 transition-colors cursor-pointer"
                      onClick={() => setSelected(row)}
                    >
                      <td className="py-2 pr-4 text-gray-400">{idx + 1}</td>
                      <td className="py-2 pr-4">{row.artist}</td>
                      <td className="py-2 pr-4 font-medium text-[#d9a441]">{row.song}</td>
                      <td className="py-2 italic">{row.album}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Web Tab */}
          <TabsContent value="web" className="h-[70vh]">
            <ForceGraph2D
              graphData={graphData}
              backgroundColor="#1f2b38"
              linkColor={() => "rgba(217,164,65,0.32)"}
              nodeLabel={(n) => `${n.title} – ${n.artist}`}
              nodeCanvasObject={(node, ctx) => {
                const img = new Image();
                img.src = node.img;
                const size = 18;
                ctx.beginPath();
                ctx.arc(node.x, node.y, size / 2 + 1, 0, 2 * Math.PI);
                ctx.fillStyle = "#344049";
                ctx.fill();
                ctx.drawImage(img, node.x - size / 2, node.y - size / 2, size, size);
              }}
              linkWidth={(link) => link.value}
              cooldownTicks={120}
              onNodeClick={(node) => setSelected(rows[node.id])}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal Blog Card */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-[#2a3642] text-[#e7e3d7] w-full max-w-md border border-[#c5a77d]/40">
          {selected && (
            <Card className="bg-transparent border-none shadow-none">
              <CardContent className="p-4 space-y-2">
                <h2 className="text-2xl font-serif tracking-wide text-[#d9a441]">
                  {selected.song}
                </h2>
                <p>
                  <span className="font-medium">Artist:</span> {selected.artist}
                </p>
                <p>
                  <span className="font-medium">Album:</span> {selected.album}
                </p>
                {selected.Description && (
                  <p className="text-sm text-[#c5a77d] whitespace-pre-wrap leading-relaxed">
                    {selected.Description}
                  </p>
                )}
                <Button
                  asChild
                  variant="ghost"
                  className="mt-4 border border-[#d9a441]/40 text-[#d9a441] hover:bg-[#d9a441]/10"
                >
                  <a
                    href={
                      selected.url ||
                      `https://www.google.com/search?q=${encodeURIComponent(
                        selected.song + " " + selected.artist
                      )}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Learn more ↗
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
