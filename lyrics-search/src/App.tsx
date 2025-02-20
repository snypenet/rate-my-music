import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import debounce from "lodash.debounce";
import Markdown from 'react-markdown';

interface Song {
  id: number;
  title: string;
  artist: string;
  thumbnail: string;
}

const baseUrl = import.meta.env.VITE_API_BASE_URL;


const App = () => {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [rating, setRating] = useState<string | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingRating, setLoadingRating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);


  // Debounce the search to avoid too many requests
  const fetchSongs = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) {
        setSongs([]);
        setShowDropdown(false);
        return;
      }
      try {
        const response = await axios.get(`${baseUrl}/search?q=${q}`);
        setSongs(response.data);
        setShowDropdown(true);
      } catch (error) {
        console.error("Error fetching songs:", error);
      }
    }, 300),
    []
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    fetchSongs(e.target.value);
  };

  
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin h-6 w-6 border-4 border-gray-400 border-t-transparent rounded-full"></div>
    </div>
  );
  

  const getLyrics = async (song: Song) => {
    setLoadingLyrics(true);
    setLyrics(null);
    setSummary(null);
    setRating(null);
    setShowDropdown(false);
    setSelectedSong(song);
    setQuery("");
  
    try {
      const lyricsResponse = await axios.get(
        `${baseUrl}/lyrics?artist=${encodeURIComponent(song.artist)}&song=${encodeURIComponent(song.title)}`
      );
      setLyrics(lyricsResponse.data.lyrics);
      fetchSongDetails(song.artist, song.title);
    } catch (error) {
      console.error("Error fetching lyrics:", error);
      setLyrics("Lyrics not found.");
    }
    setLoadingLyrics(false);
  };

  const fetchSongDetails = async (artist: string, song: string) => {
    setLoadingSummary(true);
    setLoadingRating(true);
    
    try {
      const [summaryResponse, ratingResponse] = await Promise.all([axios.post(`${baseUrl}/song-summary`, { 
        artist, song 
      }),  axios.post(`${baseUrl}/song-rating`, { 
        artist, song 
      })]);

      setRating(ratingResponse.data.rating);
      setSummary(summaryResponse.data.summary);
    } catch (error) {
      console.error("Error fetching data:", error);
      setSummary("Could not generate summary or rating.");
    } finally {
      setLoadingSummary(false);
      setLoadingRating(false);
    }
  };

  // Close the dropdown on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDropdown(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-4">
      {/* Page Title */}
      <h1 className="text-4xl font-bold mt-6 mb-6 text-center">Rate My Music</h1>

      {/* Search Box Container */}
      <div className="relative transition-all duration-500 w-full max-w-lg mx-auto my-6">
        <input
          type="text"
          value={query}
          onChange={handleSearch}
          placeholder="Search for a song..."
          className="w-full p-3 rounded-md border border-gray-600 
                     bg-gray-800 text-white placeholder-gray-400 
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        {/* Search Results Dropdown */}
        {showDropdown && songs.length > 0 && (
          <div className="absolute left-0 right-0 mt-2 bg-gray-800 
                       rounded-lg shadow-lg max-h-64 overflow-y-auto z-50"
          >
            {songs.map((song) => (
              <div
                key={song.id}
                className="flex items-center p-3 cursor-pointer hover:bg-gray-700 transition-all"
                onClick={() => getLyrics(song)}
              >
                <img
                  src={song.thumbnail}
                  alt={song.title}
                  className="w-12 h-12 rounded-md"
                />
                <div className="ml-4">
                  <p className="text-lg font-semibold">{song.title}</p>
                  <p className="text-sm text-gray-400">{song.artist}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Song Details */}
      {selectedSong && (
        <div className="text-center mt-6">
          <img
            src={selectedSong.thumbnail}
            alt={selectedSong.title}
            className="w-32 h-32 mx-auto rounded-md shadow-lg"
          />
          <h2 className="text-2xl font-bold mt-4">{selectedSong.title}</h2>
          <p className="text-lg text-gray-400">{selectedSong.artist}</p>
        </div>
      )}

      {/* Lyrics & Song Details */}
      {loadingLyrics ? (
        <p className="mt-6 text-lg"><LoadingSpinner/></p>
      ) : (
        lyrics && (
          <div className="mt-6 flex w-full max-w-5xl">
            {/* Rating (Left Column) */}
            <div className="w-1/3 p-4 text-center bg-gray-800 rounded-md mr-4">
              <h3 className="text-lg font-semibold">Rating</h3>
              {loadingRating ? <LoadingSpinner/> : <p><Markdown>{rating}</Markdown></p>}
            </div>

            {/* Lyrics & Summary (Right Column) */}
            <div className="w-3/4 bg-gray-800 p-4 rounded-md">
              {/* Summary */}
              <h3 className="text-lg font-semibold">Summary</h3>
              {loadingSummary ? <LoadingSpinner/> : <p className="mb-4"><Markdown>{summary}</Markdown></p>}

              {/* Lyrics */}
              <h3 className="text-lg font-semibold">Lyrics</h3>
              <pre className="whitespace-pre-wrap">{lyrics}</pre>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default App;
