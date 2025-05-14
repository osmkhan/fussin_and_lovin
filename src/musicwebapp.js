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
import songsData from './data/songs_cleaned.json';
import entriesData from './data/entries.json';

// Helper to manage listened songs in localStorage
const STORAGE_KEY = 'fussin_and_lovin_listened_songs';

function getListenedSongs() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
}

function saveListenedSongs(listenedSongs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(listenedSongs));
}

function toggleSongListened(songNumber, listenedSongs, setListenedSongs) {
  const newListenedSongs = {
    ...listenedSongs,
    [songNumber]: !listenedSongs[songNumber]
  };
  setListenedSongs(newListenedSongs);
  saveListenedSongs(newListenedSongs);
}

/* ---------- helpers ---------- */
// Helper to normalize album names for consistent map keys
function normalizeAlbumTitle(album) {
  return album ? album.trim().toLowerCase().replace(/[^a-z0-9]/gi, '_') : '';
}

function getCoverPath(album, number, albumEarliestMap) {
  if (!album) return "https://placehold.co/128x128";
  // In development, use relative path
  // In production (GitHub Pages), use absolute path
  const isDev = process.env.NODE_ENV === 'development';
  const basePath = isDev ? '' : '/fussin_and_lovin';
  // Try the current song's cover first
  if (number) {
    return `${basePath}/covers/${number}_${album.replace(/[^a-z0-9]/gi, '_')}.png`;
  }
  // Normalize album title for lookup
  const norm = normalizeAlbumTitle(album);
  // Fallback: use earliest song's number for this album
  if (albumEarliestMap && albumEarliestMap[norm]) {
    const earliestNum = albumEarliestMap[norm].number;
    return `${basePath}/covers/${earliestNum}_${album.replace(/[^a-z0-9]/gi, '_')}.png`;
  }
  // Final fallback
  return "https://placehold.co/128x128";
}

// Helper to get both possible cover paths for a node
function getNodeCoverPaths(album, number, albumEarliestMap) {
  if (!album) return ["https://placehold.co/128x128"];
  const isDev = process.env.NODE_ENV === 'development';
  const basePath = isDev ? '' : '/fussin_and_lovin';
  const ownCover = `${basePath}/covers/${number}_${album.replace(/[^a-z0-9]/gi, '_')}.png`;
  let earliestCover = ownCover;
  if (albumEarliestMap && albumEarliestMap[album]) {
    const earliestNum = albumEarliestMap[album].number;
    earliestCover = `${basePath}/covers/${earliestNum}_${album.replace(/[^a-z0-9]/gi, '_')}.png`;
  }
  return [ownCover, earliestCover, "https://placehold.co/128x128"];
}

const buildGraph = (rows, albumEarliestMap) => {
  const nodes = rows.map((r, idx) => {
    const [ownCover, earliestCover, placeholder] = getNodeCoverPaths(r.album, r.number, albumEarliestMap);
    return {
      id: idx,
      title: r.song,
      img: ownCover, // for cache preloading
      imgFallback: earliestCover,
      imgPlaceholder: placeholder,
      artist: r.artist,
      album: r.album,
      genres: r.genres || [],
    };
  });
  const links = [];
  // Link all songs by the same artist
  nodes.forEach((n1, i) => {
    nodes.forEach((n2, j) => {
      if (i !== j && n1.artist === n2.artist) {
        links.push({ source: i, target: j, value: 4 });
      }
    });
  });
  // Also add original related artist links
  rows.forEach((r, i) => {
    const relAlbum = r.relatedArtists.album || [];
    const relOther = r.relatedArtists.other || [];
    nodes.forEach((n, j) => {
      if (i !== j) {
        if (relAlbum.includes(n.artist)) links.push({ source: i, target: j, value: 3 });
        else if (relOther.includes(n.artist)) links.push({ source: i, target: j, value: 2 });
        else {
          // Weak genre-based link
          const genresA = nodes[i].genres || [];
          const genresB = nodes[j].genres || [];
          const shared = genresA.filter(g => genresB.includes(g));
          if (shared.length > 0) {
            links.push({ source: i, target: j, value: 0.5 * shared.length });
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
        img.onerror = () => {
          console.error('Cork Board image failed to load:', img.src, 'for node:', node);
        };
        cache.current[node.img] = img;
      }
    });
  }, [nodes]);
  return cache.current;
};

/* ---------- Weekly‑average chart (extracted) ---------- */
function WeeklyChart({ rows }) {
  // compute weekly medians (May 10 2024 start)
  const weeklyMedians = useMemo(() => {
    const totalWeeks = 52;
    return Array.from({ length: totalWeeks }, (_, weekIdx) => {
      const start = weekIdx * 7 + 1;
      const end = (weekIdx + 1) * 7;
      const weekSongs = rows.filter((r) => r.number >= start && r.number <= end);
      if (!weekSongs.length) return null;
      
      // Calculate median
      const wordCounts = weekSongs.map(s => s.wordCount || 0).sort((a, b) => a - b);
      const mid = Math.floor(wordCounts.length / 2);
      return wordCounts.length % 2 === 0
        ? (wordCounts[mid - 1] + wordCounts[mid]) / 2
        : wordCounts[mid];
    });
  }, [rows]);

  const [hoverIdx, setHoverIdx] = useState(null);

  const yMax = useMemo(() => {
    const nums = weeklyMedians.filter((v) => v !== null);
    return Math.ceil(Math.max(...nums, 0) / 250) * 250 || 250;
  }, [weeklyMedians]);

  const yTicks = useMemo(() => {
    const out = [];
    for (let v = 0; v <= yMax; v += 250) out.push(v);
    return out;
  }, [yMax]);

  /* ---- SVG helpers ---- */
  const paddingX = 12;
  const paddingY = 10;
  const viewW = 100;
  const viewH = 100;
  const usableW = viewW - 2 * paddingX;
  const usableH = viewH - 2 * paddingY;

  const points = weeklyMedians.map((cnt, i) => {
    if (cnt === null) return null;
    const x = paddingX + (i / (weeklyMedians.length - 1)) * usableW;
    const y = viewH - paddingY - (cnt / yMax) * usableH;
    return `${x},${y}`;
  });
  const filtered = points.filter(Boolean);
  const pathD = filtered.length ? ["M", filtered[0], ...filtered.slice(1).flatMap((p) => ["L", p])].join(" ") : "";

  /* ---- event handlers ---- */
  const onMove = (e) => {
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - left) / width;
    const idx = Math.round(pct * (weeklyMedians.length - 1));
    setHoverIdx(idx);
  };

  return (
    <div className="relative w-full h-64 sm:h-80 md:h-96 lg:h-[28rem] max-w-3xl mx-auto">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {/* grid */}
        {yTicks.map((val) => {
          const y = viewH - paddingY - (val / yMax) * usableH;
          return (
            <g key={val}>
              <line
                x1={paddingX}
                y1={y}
                x2={viewW - paddingX}
                y2={y}
                stroke="#c5a77d"
                strokeWidth="0.4"
                strokeOpacity="0.25"
              />
              <text
                x={paddingX - 2}
                y={y}
                fontSize="3.5"
                textAnchor="end"
                dominantBaseline="middle"
                fill="#e7e3d7"
                style={{ fontFamily: "Inter, Helvetica, Arial, sans-serif" }}
              >
                {val.toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* trend line */}
        <path
          d={pathD}
          fill="none"
          stroke="#d9a441"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* hover dot */}
        {hoverIdx !== null && weeklyMedians[hoverIdx] !== null && (
          <>
            {(() => {
              const cnt = weeklyMedians[hoverIdx];
              const x = paddingX + (hoverIdx / (weeklyMedians.length - 1)) * usableW;
              const y = viewH - paddingY - (cnt / yMax) * usableH;
              return (
                <>
                  <circle cx={x} cy={y} r="1.5" fill="#d9a441" stroke="#e7e3d7" strokeWidth="0.4" />
                  <text
                    x={x}
                    y={y - 3}
                    fontSize="3.5"
                    textAnchor="middle"
                    fill="#e7e3d7"
                    style={{ fontFamily: "Inter, Helvetica, Arial, sans-serif", fontWeight: 500 }}
                  >
                    {Math.round(cnt).toLocaleString()}
                  </text>
                </>
              );
            })()}
          </>
        )}

        {/* x‑axis title */}
        {/* <text
          x="50"
          y={viewH - 0.5}
          textAnchor="middle"
          fontSize="3.5"
          fill="#e7e3d7"
          style={{ fontFamily: "Inter, Helvetica, Arial, sans-serif", fontWeight: 500 }}
        >
          Week
        </text> */}
      </svg>

      {/* months underlay */}
      <div
        className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-[#e7e3d7] pointer-events-none select-none px-1 pb-1"
        style={{ fontFamily: "Inter, Helvetica, Arial, sans-serif" }}
      >
        <span className="w-12 text-center">May</span>
        <span className="w-12 text-center">Sep</span>
        <span className="w-12 text-center">Jan</span>
        <span className="w-12 text-center">May</span>
      </div>

      {/* interaction overlay */}
      <div
        className="absolute inset-0 cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      />
    </div>
  );
}

export default function MusicWebApp() {
  const [rows, setRows] = useState([]);
  const [entries, setEntries] = useState([]);
  const [sortField, setSortField] = useState('number');
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showHero, setShowHero] = useState(true);
  const [heroDismissed, setHeroDismissed] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [cardShouldShow, setCardShouldShow] = useState(false);
  const [cardShouldHide, setCardShouldHide] = useState(false);
  const [error, setError] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const graphRef = useRef();
  const listRef = useRef();
  const [showInfoBox, setShowInfoBox] = useState(true);
  const [listenedSongs, setListenedSongs] = useState(getListenedSongs());

  const sorted = useMemo(() => {
    if (!rows || !Array.isArray(rows)) return [];
    return [...rows].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'number') {
        comparison = a.number - b.number;
      } else if (sortField === 'date') {
        const baseDate = new Date(2024, 4, 10);
        const dateA = new Date(baseDate.getTime());
        const dateB = new Date(baseDate.getTime());
        dateA.setDate(baseDate.getDate() + (a.number - 1));
        dateB.setDate(baseDate.getDate() + (b.number - 1));
        comparison = dateA - dateB;
      } else if (sortField === 'wordCount') {
        comparison = a.wordCount - b.wordCount;
      } else {
        comparison = a[sortField].localeCompare(b[sortField]);
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [rows, sortField, sortAsc]);

  // Calculate progress
  const progress = useMemo(() => {
    const total = rows.length;
    const listened = Object.values(listenedSongs).filter(Boolean).length;
    return {
      listened,
      total,
      percentage: total ? Math.round((listened / total) * 100) : 0
    };
  }, [rows.length, listenedSongs]);

  // Add countWords function
  function countWords(text) {
    if (!text) return 0;
    // First, extract just the main content between the metadata and any replies
    let mainContent = text;
    
    // Remove everything before "Thoughts:"
    mainContent = mainContent.split('Thoughts:')[1] || mainContent;
    
    // Remove everything after "Reply from" if it exists
    if (mainContent.includes('Reply from')) {
      mainContent = mainContent.split('Reply from')[0];
    }
    
    // Clean up the text
    const cleanedText = mainContent
      .replace(/–.*?\n/gm, '') // Remove signatures anywhere in text
      .replace(/\(.*?\)/gm, '') // Remove parenthetical notes anywhere in text
      .replace(/_+\n/gm, '') // Remove separator lines anywhere in text
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Count non-empty words
    return cleanedText.split(' ').filter(word => word.length > 0).length;
  }

  /* ---------- load data ---------- */
  useEffect(() => {
    console.log('Loading data...');
    console.log('songsData:', songsData);
    console.log('entriesData:', entriesData);
    
    try {
      if (!songsData || !Array.isArray(songsData)) {
        throw new Error('Invalid songs data format');
      }
      
      // Use word counts directly from songs_cleaned.json
      setRows(songsData);
      setEntries(entriesData);
      console.log('Data loaded successfully');
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please refresh the page.');
    }
  }, []);

  /* ---------- keyboard navigation ---------- */
  useEffect(() => {
    if (!selected) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const currentIndex = sorted.findIndex(row => row.song === selected.song && row.artist === selected.artist);
        if (currentIndex === -1) return;
        
        const newIndex = e.key === 'ArrowLeft' 
          ? Math.max(0, currentIndex - 1)
          : Math.min(sorted.length - 1, currentIndex + 1);
        
        setSelected(sorted[newIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, sorted]);

  /* ---------- dismiss hero on first interaction ---------- */
  useEffect(() => {
    if (!showHero) return; // already dismissed
    const dismiss = (e) => {
      // Prevent first spacebar from scrolling
      if (e && e.type === 'keydown' && e.code === 'Space') {
        e.preventDefault();
      }
      setShowHero(false);
      // Prevent the scroll from affecting the page
      if (e && e.type === 'wheel') {
        e.preventDefault();
        window.scrollTo(0, 0); // Ensure user stays at the top
      }
    };
    const onScroll = () => {
      if (window.scrollY > 40) dismiss();
    };
    window.addEventListener("wheel", dismiss, { once: true, passive: false });
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
  }, [selected, cardVisible]);

  const handleSort = (field) => {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getSortIndicator = (field) => {
    if (field !== sortField) return "↕";
    return sortAsc ? "↑" : "↓";
  };

  // Build album-to-earliest-song map
  const albumEarliestMap = useMemo(() => {
    const map = {};
    songsData.forEach(song => {
      if (!song.album) return;
      if (!map[song.album] || song.number < map[song.album].number) {
        map[song.album] = song;
      }
    });
    return map;
  }, [songsData]);

  const graphData = useMemo(() => buildGraph(rows, albumEarliestMap), [rows, albumEarliestMap]);
  const coverImages = useCoverImages(graphData.nodes || []);

  // Lock scroll when hero is visible
  useEffect(() => {
    if (showHero) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showHero]);

  // Chart mouse handlers
  const handleChartMouseMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width);
    const idx = Math.round(xPct * 52);
    setHoverIdx(idx);
  };
  const handleChartMouseLeave = () => setHoverIdx(null);

  /* ---------- UI ---------- */
  return (
    <div className="relative bg-[#ede5d0] text-[#222] min-h-screen font-serif selection:bg-[#bfa77a]/60" style={{minHeight: '100vh', minWidth: '100vw', overflowX: 'hidden'}}>
      {error ? (
        <div className="fixed inset-0 flex items-center justify-center bg-[#ede5d0]">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-[#191414] mb-4">Error</h2>
            <p className="text-[#191414]">{error}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Parallax/Hero Overlay */}
          {(!heroDismissed) && (
            <section
              className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-auto transition-all duration-[2500ms] ease-in-out
              ${!showHero ? 'opacity-0 -translate-y-32 pointer-events-none' : 'opacity-100 translate-y-0'}`}
              style={{ background: 'linear-gradient(to bottom, #5a8fdc 0%, #a88b5a 100%)' }}
            >
              <div className="text-center px-6" role="banner">
                <h1 className="text-5xl md:text-6xl font-serif tracking-wide text-white mb-8 drop-shadow-sm select-none" style={{ fontFamily: 'Georgia, serif', letterSpacing: '-0.02em', fontWeight: 300 }}>
                  Fussin' &amp; Lovin': A Year of Songs
                </h1>
                <p className="max-w-2xl mx-auto text-xl leading-relaxed text-white space-y-4" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif', letterSpacing: '0.01em' }}>
                  <span className="block mb-6">A year-long journey through American country from Matt Radosevich.</span>
                  <span className="block mb-6">Collected by Osman Khan and Kevin Donohue.</span>
                  <span className="block">Press any key to continue.</span>
                </p>
                <div className="mt-12 animate-bounce text-white text-2xl">↓</div>
              </div>
            </section>
          )}

          <header className="w-full pt-12 pb-4 flex justify-center items-center">
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-serif font-extrabold tracking-tight text-[#191414] drop-shadow-sm mb-4" style={{ letterSpacing: '-0.01em' }}>
                The Fussin' and Lovin' Web Archive
              </h1>
              <div className="text-[#c5a77d] text-lg">
                {progress.listened === 365 ? "All done!" :
                 progress.listened < 100 ? "Get Crackin'" :
                 progress.listened > 300 ? "You've Almost Fussed Your Love!" :
                 progress.listened > 200 ? "I'm proud of you buckaroo" :
                 progress.listened > 100 ? "You Might But Could Do It" :
                 "Get Crackin'"} ({progress.listened} / {progress.total})
              </div>
            </div>
          </header>

          <main className="relative z-10 pt-16 px-6 md:px-10 pb-16">
            <Tabs defaultValue="list" className="w-full">
              <TabsList className="flex gap-4 mb-8">
                <TabsTrigger value="list" className="font-bold text-[#191414] tracking-wide" style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif', fontSize: '1.1rem'}}>The List</TabsTrigger>
                <TabsTrigger value="web" className="font-bold text-[#191414] tracking-wide" style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif', fontSize: '1.1rem'}}>The Cork Board</TabsTrigger>
                <TabsTrigger value="Notchin'" className="font-bold text-[#191414] tracking-wide" style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif', fontSize: '1.1rem'}}>Notchin'</TabsTrigger>
              </TabsList>

              {/* List Tab */}
              <TabsContent value="list">
                <div className="mb-4 flex gap-2 items-center pl-6">
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
                          const top = rowEl.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2 + rowEl.offsetHeight / 2;
                          window.scrollTo({ top, behavior: 'smooth' });
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
                        <th className="py-2 pr-4 w-12"></th>
                        <th 
                          className="py-2 pr-4 w-24 font-extrabold text-[#191414] tracking-wide cursor-pointer" 
                          style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif'}}
                          onClick={() => handleSort('number')}
                        >
                          Entry # {getSortIndicator('number')}
                        </th>
                        <th 
                          className="py-2 pr-4 w-1/4 font-extrabold text-[#191414] tracking-wide cursor-pointer" 
                          style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif'}}
                          onClick={() => handleSort('song')}
                        >
                          Song {getSortIndicator('song')}
                        </th>
                        <th 
                          className="py-2 pr-4 w-32 font-extrabold text-[#191414] tracking-wide cursor-pointer" 
                          style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif'}}
                          onClick={() => handleSort('date')}
                        >
                          Date posted {getSortIndicator('date')}
                        </th>
                        <th 
                          className="py-2 pr-4 cursor-pointer font-bold text-[#191414] tracking-wide" 
                          style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif'}}
                          onClick={() => handleSort('artist')}
                        >
                          Artist {getSortIndicator('artist')}
                        </th>
                        <th 
                          className="py-2 pr-4 cursor-pointer font-bold text-[#191414] tracking-wide" 
                          style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif'}}
                          onClick={() => handleSort('album')}
                        >
                          Album {getSortIndicator('album')}
                        </th>
                        <th 
                          className="py-2 pr-4 w-24 font-extrabold text-[#191414] tracking-wide cursor-pointer" 
                          style={{fontFamily: 'Inter, Helvetica, Arial, sans-serif'}}
                          onClick={() => handleSort('wordCount')}
                        >
                          Thought Count {getSortIndicator('wordCount')}
                        </th>
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
                            <td className="py-2 pr-4">
                              <input
                                type="checkbox"
                                checked={!!listenedSongs[row.number]}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleSongListened(row.number, listenedSongs, setListenedSongs);
                                }}
                                className="w-6 h-6 rounded border-[#c5a77d] text-[#d9a441] focus:ring-[#d9a441] focus:ring-offset-[#ede5d0]"
                                style={{ accentColor: '#d9a441' }}
                              />
                            </td>
                            <td className="py-2 pr-4 font-medium text-[#191414]">{row.number}</td>
                            <td className="py-2 pr-4 font-medium text-[#191414]">{row.song}</td>
                            <td className="py-2 pr-4 text-[#191414] w-32">{dateStr}</td>
                            <td className="py-2 pr-4">{row.artist}</td>
                            <td className="py-2 pr-4 italic">{row.album}</td>
                            <td className="py-2 pr-4 font-medium text-[#191414]">{row.wordCount || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              {/* The Cork Board Tab */}
              <TabsContent value="web" className="h-[70vh] p-8 bg-[#f0e6d2] rounded-xl border border-[#bfa77a]/40">
                <div className="flex gap-8 h-full">
                  <div className="flex-1 min-w-0">
                    <div className="w-full h-full rounded-lg overflow-hidden border border-[#bfa77a]/40 bg-[#f0e6d2]">
                      <ForceGraph2D
                        ref={graphRef}
                        graphData={graphData}
                        backgroundColor="#f0e6d2"
                        linkColor={() => "#cc3333"}
                        nodeLabel={(n) => `${n.title} – ${n.artist}`}
                        nodeCanvasObject={(node, ctx) => {
                          const size = 32;
                          ctx.save();
                          ctx.beginPath();
                          ctx.arc(node.x, node.y, size / 2 + 2, 0, 2 * Math.PI);
                          ctx.fillStyle = "#d6c7a1";
                          ctx.shadowColor = '#8b6b3a';
                          ctx.shadowBlur = 4;
                          ctx.fill();
                          const img = coverImages[node.img];
                          const imgFallback = coverImages[node.imgFallback];
                          if (img && img.complete && img.naturalWidth > 0) {
                            ctx.drawImage(img, node.x - size / 2, node.y - size / 2, size, size);
                          } else if (imgFallback && imgFallback.complete && imgFallback.naturalWidth > 0) {
                            ctx.drawImage(imgFallback, node.x - size / 2, node.y - size / 2, size, size);
                          } else {
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, size / 2 - 2, 0, 2 * Math.PI);
                            ctx.fillStyle = '#8b6b3a';
                            ctx.fill();
                          }
                          ctx.restore();
                        }}
                        linkWidth={(link) => Math.max(0.5, link.value)}
                        cooldownTicks={200}
                        onNodeClick={(node) => {
                          setSelected(rows[node.id]);
                          setShowInfoBox(false);
                        }}
                        d3Force="charge"
                        d3ForceStrength={-60}
                      />
                    </div>
                  </div>
                  {showInfoBox && (
                    <div 
                      className="w-[300px] flex-shrink-0 transition-all duration-300 ease-in-out"
                      onClick={() => setShowInfoBox(false)}
                    >
                      <Card className="bg-[#1f2b38]/90 backdrop-blur-sm border-[#c5a77d] h-full">
                        <CardContent className="p-4 text-[#e7e3d7]">
                          <h3 className="text-lg font-bold text-[#d9a441] mb-3">About The Cork Board</h3>
                          <div className="space-y-3 text-sm leading-relaxed">
                            <p>
                              Each album cover represents a song in the collection. The connections between them show relationships:
                            </p>
                            <ul className="list-disc pl-4 space-y-1.5">
                              <li>Thickest red lines connect songs by the same artist</li>
                              <li>Thick lines connect songs whose artists collaborated on albums</li>
                              <li>Medium lines show artists mentioned in other songs' entries</li>
                              <li>Thin lines show shared genres between songs</li>
                            </ul>
                            <p className="text-[#bfa77a] italic text-xs">
                              Note: Some albums and connections are missing, particularly for obscure releases. I got other shit to do.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Notchin' Tab (was Summary) */}
              <TabsContent value="Notchin'" className="p-8 bg-[#f0e6d2] rounded-xl border border-[#bfa77a]/40">
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-[#191414]">The Crew</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-[#1f2b38] border-[#c5a77d]">
                      <CardContent className="p-6 text-center">
                        <div className="text-3xl font-bold text-[#d9a441]">144</div>
                        <div className="text-[#e7e3d7]">Featured Artists</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#1f2b38] border-[#c5a77d]">
                      <CardContent className="p-6 text-center">
                        <div className="text-3xl font-bold text-[#d9a441]">21.5%</div>
                        <div className="text-[#e7e3d7]">Tragic Death Percentage</div>
                      </CardContent>
                    </Card>
                  </div>

                  <h2 className="text-2xl font-bold text-[#191414] mt-8">Thought Count Analysis</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-[#1f2b38] border-[#c5a77d]">
                      <CardContent className="p-6">
                        <div className="space-y-4 text-[#e7e3d7]">
                          <div>
                            <div className="font-bold mb-1 text-lg">Longest Entry:</div>
                            <div className="text-xl">2,709 words</div>
                            <div className="text-sm italic">Yeh Jo Halka Halka Suroor Hai by Nusrat Fateh Ali Khan</div>
                          </div>
                          <div>
                            <div className="font-bold mb-1 text-lg">Shortest Entry:</div>
                            <div className="text-xl">19 words</div>
                            <div className="text-sm italic">Nada by The Refreshments</div>
                          </div>
                          <div>
                            <div className="font-bold mb-1 text-lg">Average Entry:</div>
                            <div className="text-xl">394.87 thoughts</div>
                            <div className="text-sm italic">per song</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#1f2b38] border-[#c5a77d]">
                      <CardContent className="p-6">
                        <h3 className="text-xl font-bold text-[#e7e3d7] mb-6 text-center">Median Thought Count Per Week</h3>
                        <WeeklyChart rows={rows} />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </main>

          {/* Modal Blog Card */}
          {(cardShouldShow || cardShouldHide) && selected && (
            <div className="fixed inset-0 z-50 flex items-center justify-end" style={{ pointerEvents: 'auto' }}>
              {/* Overlay */}
              <div
                className={`fixed inset-0 bg-black/40 transition-opacity duration-400 ${selected ? 'opacity-100' : 'opacity-0'}`}
                onClick={() => {
                  setSelected(null);
                  setCardShouldShow(false);
                  setCardShouldHide(false);
                  setCardVisible(false);
                }}
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
                      <div className="relative">
                        {/* Header row with Spotify and X */}
                        <div className="flex items-start justify-between mb-6">
                          <div>
                            {entries.find(e => e.song === selected.song && e.artist === selected.artist)?.spotifyLink && (
                              <Button
                                asChild
                                variant="ghost"
                                className="rounded-full border border-[#bfa77a] bg-[#f8f5f0] text-[#191414] hover:bg-[#bfa77a]/20 text-base px-6 py-2 font-bold shadow mr-2"
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
                          <Button
                            variant="ghost"
                            className="text-[#bfa77a] hover:text-[#7a5a3a] hover:bg-[#bfa77a]/10 text-3xl px-4 py-2"
                            style={{ fontSize: '2.5rem', lineHeight: 1 }}
                            onClick={() => setSelected(null)}
                          >
                            ✕
                          </Button>
                        </div>
                        {/* Song title and cover */}
                        <div className="flex gap-6 items-start mb-4">
                          <div className="flex-1 min-w-0">
                            <h2 className="text-2xl font-serif tracking-wide text-[#191414] mb-2 break-words" style={{wordBreak: 'break-word'}}>
                              {selected.song}
                            </h2>
                            <p className="mb-1">
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
                          <div className="w-24 h-24 flex-shrink-0">
                            <img
                              src={getCoverPath(selected.album, selected.number, albumEarliestMap)}
                              alt={selected.album}
                              className="w-full h-full object-cover rounded-lg shadow-md"
                              onError={e => {
                                console.error('Dialog image failed to load:', e.target.src, 'for song:', selected.song, 'by', selected.artist);
                                e.target.style.display = 'none';
                                e.target.parentElement.style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
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
                    </CardContent>
                  </Card>
                )}
              </DialogContent>
            </div>
          )}

          <footer className="w-full py-6 mt-12 text-center text-[#bfa77a] bg-[#ede5d0] text-sm font-semibold border-t border-[#d6c7a1]">
            © Osman R. Khan 2025. All rights reserved. <a href="https://osmandi.us" target="_blank" rel="noopener noreferrer" className="hover:text-[#d9a441] transition-colors">osmandi.us</a>
          </footer>
        </>
      )}
    </div>
  );
}
