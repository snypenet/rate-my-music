from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import os
import openai
import re
from bs4 import BeautifulSoup
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)

load_dotenv()

GENIUS_ACCESS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
GENIUS_API_URL = "https://api.genius.com/search"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

LYRICS_CACHE_FILE = "lyrics_cache.json"

# Ensure cache file exists
# if not os.path.exists(LYRICS_CACHE_FILE):
#     with open(LYRICS_CACHE_FILE, "w") as f:
#         json.dump({}, f)

# def load_lyrics_cache():
#     with open(LYRICS_CACHE_FILE, "r") as f:
#         return json.load(f)

# def save_lyrics_cache(cache):
#     with open(LYRICS_CACHE_FILE, "w") as f:
#         json.dump(cache, f, indent=4)

def get_cache_key(artist, song):
    return f"{artist.lower()}-{song.lower()}"

lyrics_cache = {}

@app.route('/search', methods=['GET'])
def search_song():
    query = request.args.get('q')
    if not query:
        return jsonify({"error": "Missing search query"}), 400

    headers = {"Authorization": f"Bearer {GENIUS_ACCESS_TOKEN}"}
    params = {"q": query}
    response = requests.get(GENIUS_API_URL, headers=headers, params=params)

    if response.status_code != 200:
        return jsonify({"error": "Failed to fetch data from Genius API"}), response.status_code

    data = response.json()

    # Extract relevant song details
    songs = []
    for hit in data.get("response", {}).get("hits", []):
        song = hit.get("result", {})
        songs.append({
            "id": song.get("id"),
            "title": song.get("title"),
            "artist": song.get("primary_artist", {}).get("name"),
            "thumbnail": song.get("song_art_image_thumbnail_url")
        })

    return jsonify(songs)

@app.route('/lyrics', methods=['GET'])
def get_lyrics():
    artist = request.args.get('artist')
    song = request.args.get('song')

    if not artist or not song:
        return jsonify({"error": "Missing artist or song"}), 400

    song_key = get_cache_key(artist, song)

    if song_key in lyrics_cache:
        return jsonify({"lyrics": lyrics_cache[song_key]})

    artist_slug = re.sub(r'[^a-zA-Z0-9-]', '', artist.lower().replace(' ', '-'))
    song_slug = re.sub(r'[^a-zA-Z0-9-]', '', song.lower().replace(' ', '-'))

    lyrics = scrape_lyrics(f"https://genius.com/{artist_slug}-{song_slug}-lyrics")

    if lyrics:
        lyrics_cache[song_key] = lyrics
        return jsonify({"lyrics": lyrics})
    
    return jsonify({"error": "Lyrics not found"}), 404

def scrape_lyrics(url):
    headers = {"User-Agent": "Mozilla/5.0"}
    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        return None

    soup = BeautifulSoup(response.text, "html.parser")
    divs = soup.find_all('div', class_=lambda x: x and x.startswith('Lyrics-sc'),
                         attrs={'data-lyrics-container': 'true'})

    if not divs:
        return None

    return divs[0].text.strip()

@app.route('/song-summary', methods=['POST'])
def song_summary():
    data = request.json
    artist = data.get('artist')
    song = data.get('song')

    if not artist or not song:
        return jsonify({"error": "Missing artist or song"}), 400

    song_key = get_cache_key(artist, song)

    
    lyrics = lyrics_cache[song_key] if song_key in lyrics_cache else None
    if not lyrics:
        return jsonify({"error": "Lyrics not found in cache"}), 404
    
    lyrics = lyrics_cache[song_key]

    openai.api_key = OPENAI_API_KEY
    prompt = f'''
        Summarize the theme and meaning of these "Lyrics:" in 3-4 sentences.  
        Be sure to highlight any controversial, positive, or negative themes in a candid light.

        Lyrics:
        {lyrics}
    '''
    
    try:
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert music analyst."},
                {"role": "user", "content": prompt}
            ]
        )
        summary = response.choices[0].message.content
    except Exception as e:
        return jsonify({"error": f"OpenAI API error: {str(e)}"}), 500

    return jsonify({"summary": summary})

@app.route('/song-rating', methods=['POST'])
def song_rating():
    data = request.json
    artist = data.get('artist')
    song = data.get('song')

    if not artist or not song:
        return jsonify({"error": "Missing artist or song"}), 400

    song_key = get_cache_key(artist, song)
    
    lyrics = lyrics_cache[song_key] if song_key in lyrics_cache else None
    if not lyrics:
        return jsonify({"error": "Lyrics not found in cache"}), 404
    
    lyrics = lyrics_cache[song_key]
    openai.api_key = OPENAI_API_KEY
    prompt = f'''
        Rate the following Lyrics: using the ESRB style rating system.  Provide a concise rating with a few bullet points to support your reasoning.

        Lyrics:
        {lyrics}
    '''

    try:
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert content reviewer for song lyrics."},
                {"role": "user", "content": prompt}
            ]
        )
        rating = response.choices[0].message.content
    except Exception as e:
        return jsonify({"error": f"OpenAI API error: {str(e)}"}), 500

    return jsonify({"rating": rating})

if __name__ == '__main__':
    app.run(debug=True)
