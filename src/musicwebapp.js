// MusicWebApp.jsx
// Dark‑mode React single‑page app for GitHub Pages
// v6 – Townes van Zandt palette + smoother hero dismiss + new title
// Palette: slate‑blue night #1f2b38, dusty‑tan #c5a77d, whiskey‑amber #d9a441, off‑white #e7e3d7
// Hero fades on first scroll or wheel, no opacity flicker.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "./components/ui/card";
import { Dialog, DialogContent } from "./components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import ForceGraph2D from "react-force-graph-2d";
import songsData from './data/songs.json';
import entriesData from './data/entries.json';

/* ---------- helpers ---------- */
// Helper to normalize album names for cover image paths
function getCoverPath(album) {
  if (!album) return "https://placehold.co/128x128";
  // Normalize: lowercase, replace spaces with underscores, remove special chars
  const safe = album.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return `/covers/${safe}.jpg`;
}

const buildGraph = (rows) => {
  const nodes = rows.map((r, idx) => ({
    id: idx,
    title: r.song,
    img: getCoverPath(r.album),
    artist: r.artist,
    album: r.album,
    genres: r.genres || [],
  }));
  const links = [];
  // Link all songs by the same artist
  nodes.forEach((n1, i) => {
    nodes.forEach((n2, j) => {
      if (i !== j && n1.artist === n2.artist) {
        links.push({ source: i, target: j, value: 2 });
      }
    });
  });
  // Also add original related artist links
  rows.forEach((r, i) => {
    const relAlbum = r.relatedArtists.album || [];
    const relOther = r.relatedArtists.other || [];
    nodes.forEach((n, j) => {
      if (i !== j) {
        if (relAlbum.includes(n.artist)) links.push({ source: i, target: j, value: 2 });
        else if (relOther.includes(n.artist)) links.push({ source: i, target: j, value: 1 });
        else {
          // Weak genre-based link
          const genresA = nodes[i].genres || [];
          const genresB = nodes[j].genres || [];
          const shared = genresA.filter(g => genresB.includes(g));
          if (shared.length > 0) {
            links.push({ source: i, target: j, value: 0.25 * shared.length });
          }
        }
      }
    });
  });
  return { nodes, links };
};

// Add Spotify font stack
const spotifyFont = 'circular, spotify-circular, Helvetica, Arial, sans-serif';

// Add fade-in animation CSS
const fadeInAnim = {
  animation: 'fadeInCard 0.7s cubic-bezier(0.4,0,0.2,1)'
};

// For month/era navigation
const months = [
  { label: 'May 2024', value: 5, year: 2024 },
  { label: 'Jun 2024', value: 6, year: 2024 },
  { label: 'Jul 2024', value: 7, year: 2024 },
  { label: 'Aug 2024', value: 8, year: 2024 },
  { label: 'Sep 2024', value: 9, year: 2024 },
  { label: 'Oct 2024', value: 10, year: 2024 },
  { label: 'Nov 2024', value: 11, year: 2024 },
  { label: 'Dec 2024', value: 12, year: 2024 },
  { label: 'Jan 2025', value: 1, year: 2025 },
  { label: 'Feb 2025', value: 2, year: 2025 },
  { label: 'Mar 2025', value: 3, year: 2025 },
  { label: 'Apr 2025', value: 4, year: 2025 },
  { label: 'May 2025', value: 5, year: 2025 },
];

// Album cover image cache for Cork Board
const useCoverImages = (nodes) => {
  const cache = useRef({});
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    nodes.forEach(node => {
      if (!cache.current[node.img]) {
        const img = new window.Image();
        img.src = node.img;
        img.onload = () => forceUpdate(x => x + 1);
        cache.current[node.img] = img;
      }
    });
  }, [nodes]);
  return cache.current;
};

export default function MusicWebApp() {
  const [rows, setRows] = useState([]);
  const [entries, setEntries] = useState([]);
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showHero, setShowHero] = useState(true);
  const [heroDismissed, setHeroDismissed] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [cardShouldShow, setCardShouldShow] = useState(false);
  const [cardShouldHide, setCardShouldHide] = useState(false);
  const graphRef = useRef();
  const listRef = useRef();

  /* ---------- load data ---------- */
  useEffect(() => {
    setRows(songsData);
    setEntries(entriesData);
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

  // Handle hero slide-out animation
  useEffect(() => {
    if (!showHero) {
      // Wait for animation to finish before removing from DOM
      const timeout = setTimeout(() => setHeroDismissed(true), 700);
      return () => clearTimeout(timeout);
    }
  }, [showHero]);

  // Handle card slide-in animation
  useEffect(() => {
    if (selected) {
      setCardShouldShow(true);
      setCardShouldHide(false);
      // Wait a tick to trigger slide-in
      setTimeout(() => setCardVisible(true), 10);
    } else if (cardVisible) {
      setCardVisible(false);
      setCardShouldHide(true);
      // Wait for animation to finish before removing from DOM
      const timeout = setTimeout(() => {
        setCardShouldShow(false);
        setCardShouldHide(false);
      }, 700);
      return () => clearTimeout(timeout);
    }
  }, [selected]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => a.number - b.number);
  }, [rows]);

  const graphData = useMemo(() => buildGraph(rows), [rows]);
  const coverImages = useCoverImages(graphData.nodes || []);

  /* ---------- UI ---------- */
  return (
    <div className="relative bg-[#ede5d0] text-[#222] min-h-screen font-sans selection:bg-[#bfa77a]/60" style={{minHeight: '100vh', minWidth: '100vw', overflowX: 'hidden'}}>
      {/* Parallax/Hero Overlay */}
      {(!heroDismissed) && (
        <section
          className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-auto bg-gradient-to-b from-[#f8f5f0] via-[#ede5d0] to-[#d6c7a1] transition-all duration-1500 ease-in-out
          ${!showHero ? 'opacity-0 -translate-y-32 pointer-events-none' : 'opacity-100 translate-y-0'}`}
        >
          <div className="text-center px-6" role="banner">
            <h1 className="text-4xl md:text-5xl font-serif tracking-wide text-[#bfa77a] mb-6 drop-shadow-sm select-none">
              Fussin' &amp; Lovin': A Year of Songs
            </h1>
            <p className="max-w-xl mx-auto text-lg leading-relaxed text-[#bfa77a]">
              365 entries of dusty folk, bar‑room blues and highway ballads—mapped, linked, fussed and
              loved. Scroll or press any key to ride along.
            </p>
            <div className="mt-10 animate-bounce text-[#bfa77a]">↓</div>
          </div>
        </section>
      )}

      <header className="w-full py-8 flex justify-center items-center">
        <h1 className="text-4xl md:text-5xl font-serif font-extrabold tracking-tight text-[#191414] drop-shadow-sm" style={{ letterSpacing: '-0.01em' }}>
          The Fussin' and Lovin' Web Archive
        </h1>
      </header>

      <main className="relative z-10 pt-16 px-6 md:px-10 pb-16">
        <Tabs defaultValue="list" className="w-full">
          <TabsList className="flex gap-4 mb-8">
            <TabsTrigger value="list" className="font-bold text-[#191414] tracking-wide" style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif', fontSize: '1.1rem'}}>The List</TabsTrigger>
            <TabsTrigger value="web" className="font-bold text-[#191414] tracking-wide" style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif', fontSize: '1.1rem'}}>The Cork Board</TabsTrigger>
          </TabsList>

          {/* List Tab */}
          <TabsContent value="list">
            <div className="mb-4 flex gap-2 items-center">
              <label htmlFor="month-jump" className="text-sm font-bold text-[#bfa77a]" style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif'}}>Jump to:</label>
              <select
                id="month-jump"
                className="rounded border border-[#bfa77a] px-3 py-2 bg-[#ede5d0] text-[#191414] tracking-wide focus:outline-none focus:ring-2 focus:ring-[#bfa77a] transition-colors duration-300"
                style={{ fontSize: '1rem', minWidth: 120, fontFamily: 'Inter, Helvetica, Arial, sans-serif', fontWeight: 400 }}
                onChange={e => {
                  const [year, month] = e.target.value.split('-').map(Number);
                  const idx = sorted.findIndex(row => {
                    const baseDate = new Date(2024, 4, 10);
                    const date = new Date(baseDate.getTime());
                    date.setDate(baseDate.getDate() + (row.number - 1));
                    return date.getFullYear() === year && date.getMonth() + 1 === month;
                  });
                  if (idx !== -1 && listRef.current) {
                    const rowEl = listRef.current.querySelectorAll('tr')[idx];
                    if (rowEl) {
                      // Custom smooth scroll with longer duration
                      const top = rowEl.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2 + rowEl.offsetHeight / 2;
                      window.scrollTo({ top, behavior: 'smooth' });
                      // Fallback for browsers that don't support smooth scroll
                      // setTimeout(() => window.scrollTo(0, top), 1200);
                    }
                  }
                }}
              >
                <option value="">Select month</option>
                {months.map(m => <option key={m.label} value={`${m.year}-${m.value}`}>{m.label}</option>)}
              </select>
            </div>
            <div ref={listRef} className="overflow-x-auto pl-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#c5a77d]/40">
                    <th className="py-2 pr-4 w-1/4 font-extrabold text-[#191414] tracking-wide" style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif'}}>Song</th>
                    <th className="py-2 pr-4 w-64 font-extrabold text-[#191414] tracking-wide" style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif'}}>Date posted</th>
                    <th className="py-2 pr-4 cursor-pointer font-bold text-[#191414] tracking-wide" style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif'}} onClick={() => setSortAsc(!sortAsc)}>
                      Artist {sortAsc ? "↑" : "↓"}
                    </th>
                    <th className="py-2 font-bold text-[#191414] tracking-wide" style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif'}}>Album</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, idx) => {
                    // Calculate date: May 10, 2024 + (row.number - 1) days
                    const baseDate = new Date(2024, 4, 10); // Month is 0-indexed
                    const date = new Date(baseDate.getTime());
                    date.setDate(baseDate.getDate() + (row.number - 1));
                    const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                    return (
                      <tr
                        key={idx}
                        className="hover:bg-[#d9a441]/15 transition-colors cursor-pointer"
                        onClick={() => setSelected(row)}
                      >
                        <td className="py-2 pr-4 font-medium text-[#d9a441]">{row.song}</td>
                        <td className="py-2 pr-4 text-gray-400 w-64">{dateStr}</td>
                        <td className="py-2 pr-4">{row.artist}</td>
                        <td className="py-2 italic">{row.album}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* The Cork Board Tab */}
          <TabsContent value="web" className="h-[70vh]">
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              backgroundColor="#ede5d0"
              linkColor={() => "#a88b4a"}
              nodeLabel={(n) => `${n.title} – ${n.artist}`}
              nodeCanvasObject={(node, ctx) => {
                const size = 32;
                ctx.save();
                ctx.beginPath();
                ctx.arc(node.x, node.y, size / 2 + 2, 0, 2 * Math.PI);
                ctx.fillStyle = "#d6c7a1";
                ctx.shadowColor = '#bfa77a';
                ctx.shadowBlur = 4;
                ctx.fill();
                const img = coverImages[node.img];
                if (img && img.complete && img.naturalWidth > 0) {
                  ctx.drawImage(img, node.x - size / 2, node.y - size / 2, size, size);
                } else {
                  // fallback: colored circle
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, size / 2 - 2, 0, 2 * Math.PI);
                  ctx.fillStyle = '#bfa77a';
                  ctx.fill();
                }
                ctx.restore();
              }}
              linkWidth={(link) => Math.max(1.5, link.value)}
              cooldownTicks={200}
              onNodeClick={(node) => setSelected(rows[node.id])}
              d3Force="charge"
              d3ForceStrength={-180}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal Blog Card */}
      {(cardShouldShow || cardShouldHide) && (
        <div className="fixed inset-0 z-50 flex items-center justify-end" style={{ pointerEvents: 'auto' }}>
          {/* Overlay */}
          <div
            className={`fixed inset-0 bg-black/40 transition-opacity duration-400 ${selected ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setSelected(null)}
            style={{ zIndex: 49 }}
          />
          {/* Sliding Card */}
          <DialogContent
            className={`bg-[#f8f5f0] text-[#222] w-full max-w-2xl border border-[#bfa77a]/40 max-h-[90vh] overflow-y-auto rounded-xl shadow-xl transition-transform duration-700 ease-in-out z-50
              ${cardVisible ? 'translate-x-0' : 'translate-x-full'}`}
            style={{ boxShadow: '-8px 0 32px 0 rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}
          >
            {selected && (
              <Card className="bg-transparent border-none shadow-none">
                <CardContent className="p-8 space-y-4 text-[#222]" style={fadeInAnim}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-serif tracking-wide text-[#191414]">
                          {selected.song}
                        </h2>
                        {entries.find(e => e.song === selected.song && e.artist === selected.artist)?.spotifyLink && (
                          <Button
                            asChild
                            variant="ghost"
                            className="rounded-full border border-[#bfa77a] bg-[#f8f5f0] text-[#191414] hover:bg-[#bfa77a]/20 text-base px-6 py-2 font-bold shadow"
                            style={{ fontFamily: spotifyFont, fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.01em' }}
                          >
                            <a
                              href={entries.find(e => e.song === selected.song && e.artist === selected.artist).spotifyLink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Listen on Spotify ↗
                            </a>
                          </Button>
                        )}
                      </div>
                      <p>
                        <span className="font-medium">Artist:</span>{' '}
                        {entries.find(e => e.song === selected.song && e.artist === selected.artist)?.artistWiki ? (
                          <a
                            href={entries.find(e => e.song === selected.song && e.artist === selected.artist).artistWiki}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#bfa77a] hover:underline"
                          >
                            {selected.artist}
                          </a>
                        ) : (
                          selected.artist
                        )}
                      </p>
                      <p>
                        <span className="font-medium">Album:</span>{' '}
                        {entries.find(e => e.song === selected.song && e.artist === selected.artist)?.albumWiki ? (
                          <a
                            href={entries.find(e => e.song === selected.song && e.artist === selected.artist).albumWiki}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#bfa77a] hover:underline"
                          >
                            {selected.album}
                          </a>
                        ) : (
                          selected.album
                        )}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      className="text-[#bfa77a] hover:text-[#7a5a3a] hover:bg-[#bfa77a]/10 text-3xl px-4 py-2"
                      style={{ fontSize: '2.5rem', lineHeight: 1 }}
                      onClick={() => setSelected(null)}
                    >
                      ✕
                    </Button>
                  </div>

                  {/* Robust text body display: fallback to first matching entry by song if artist match fails */}
                  {(() => {
                    const entry = entries.find(e => e.song === selected.song && e.artist === selected.artist) ||
                                   entries.find(e => e.song === selected.song);
                    return entry && entry.textBody ? (
                      <div className="mt-4 pt-4 border-t border-[#bfa77a]/20">
                        <div className="prose max-w-none">
                          <div className="text-sm whitespace-pre-wrap leading-relaxed text-[#222]">
                            {entry.textBody}
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Album cover image at top */}
                  <div className="flex justify-center mb-4">
                    <img
                      src={getCoverPath(selected.album)}
                      alt={selected.album}
                      style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12, boxShadow: '0 2px 12px #bfa77a44' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </DialogContent>
        </div>
      )}

      <footer className="w-full py-6 mt-12 text-center text-[#bfa77a] bg-[#ede5d0] text-sm font-semibold border-t border-[#d6c7a1]">
        © Osman R. Khan 2025. All rights reserved.
      </footer>
    </div>
  );
}
