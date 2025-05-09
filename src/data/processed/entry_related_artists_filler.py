import pandas as pd
import re
from collections import defaultdict
import os

# Get the directory of the script
script_dir = os.path.dirname(os.path.abspath(__file__))

# --- Load data ---
input_file = os.path.join(script_dir, "songs_albums_entries_fixed.csv")
df = pd.read_csv(input_file, quoting=1)  # Use QUOTE_ALL to handle commas in text

def build_lookup_map(artist_names):
    """
    Build simple lookup maps for:
    - Last names
    - Standalone nicknames (e.g., 'TVZ')
    - Band names
    """
    lookup = defaultdict(set)
    
    # Common nicknames/aliases mapping
    nicknames = {
        # Last names
        'van zandt': 'Townes Van Zandt',
        'parsons': 'Gram Parsons',
        'harris': 'Emmylou Harris',
        'clark': 'Guy Clark',
        'earle': 'Steve Earle',
        'isbell': 'Jason Isbell',
        'adams': 'Ryan Adams',
        'williams': 'Lucinda Williams',
        'welch': 'Gillian Welch',
        'rawlings': 'Dave Rawlings',
        'prine': 'John Prine',
        'nelson': 'Willie Nelson',
        'jennings': 'Waylon Jennings',
        'haggard': 'Merle Haggard',
        'kristofferson': 'Kris Kristofferson',
        'parton': 'Dolly Parton',
        'lynn': 'Loretta Lynn',
        'wynette': 'Tammy Wynette',
        'jones': 'George Jones',
        'williams': 'Hank Williams',
        'cash': 'Johnny Cash',
        'simpson': 'Sturgill Simpson',
        'lenderman': 'MJ Lenderman',
        'ellis': 'Robert Ellis',
        'gilmore': 'Jimmie Dale Gilmore',
        'clark': 'Gene Clark',
        
        # Band names
        'silos': 'The Silos',
        'tupelo': 'Uncle Tupelo',
        'old 97s': 'Old 97\'s',
        'magnolia': 'Magnolia Electric Co.',
        'slobberbone': 'Slobberbone',
        'whiskeytown': 'Whiskeytown',
        'ohia': 'Songs: Ohia',
        'marshall tucker': 'The Marshall Tucker Band',
        'pure prairie': 'Pure Prairie League',
        'gourds': 'The Gourds',
        'galoots': 'The Galoots',
        'volt': 'Son Volt',
        'burrito': 'The Flying Burrito Brothers',
        'byrds': 'The Byrds',
        'junkies': 'Cowboy Junkies',
        'knitters': 'The Knitters',
        'don juans': 'The Modern Don Juans',
        'obrien': 'Tim and Mollie O\'Brien',
        'lambchop': 'Lambchop',
        'smog': 'Golden Smog',
        'futurebirds': 'Futurebirds',
        'lucero': 'Lucero',
        'refreshments': 'The Refreshments',
        'tragically hip': 'The Tragically Hip',
        'allman brothers': 'Allman Brothers Band',
        
        # Standalone nicknames
        'tvz': 'Townes Van Zandt',
        'dbt': 'Drive-By Truckers',
        'gp': 'Gram Parsons',
        'eh': 'Emmylou Harris',
        'tth': 'Tom T. Hall'
    }
    
    # Filter nicknames to only include those that correspond to an artist in the 'Main Artist' column
    filtered_nicknames = {nickname: full_name for nickname, full_name in nicknames.items() if full_name in artist_names}
    
    for artist in artist_names:
        if pd.isna(artist):
            continue
            
        # Add full name
        lookup[artist.lower()].add(artist)
        
        # Split into parts
        parts = artist.split()
        
        # Add last name (primary identifier)
        if len(parts) >= 2:
            lookup[parts[-1].lower()].add(artist)  # Last name
    
    # Add nicknames
    for nickname, full_name in filtered_nicknames.items():
        if full_name in artist_names:
            lookup[nickname].add(full_name)
    
    return lookup

def find_related_artists(text, lookup_map):
    """
    Find all artist references in the text using the lookup map.
    Only matches standalone nicknames and proper case for last names/band names.
    """
    if pd.isna(text):
        return []
    
    found = set()
    
    # Convert text to lowercase for matching
    text_lower = text.lower()
    
    # List of nicknames that should only match when standalone
    standalone_nicknames = {'tvz', 'dbt', 'gp', 'eh', 'tth'}
    
    # Find all potential matches
    for key, artists in lookup_map.items():
        # Skip if key is a year (4 digits)
        if key.isdigit() and len(key) == 4:
            continue
            
        # For nicknames, only match if they appear as standalone words
        if key in standalone_nicknames:
            pattern = r'\b' + re.escape(key) + r'\b'
            if re.search(pattern, text_lower):
                found.update(artists)
        # For last names and band names, use case-sensitive matching
        else:
            pattern = r'\b' + re.escape(key) + r'\b'
            if re.search(pattern, text):
                found.update(artists)
    
    return sorted(found)

def enrich_related_artists(input_csv, output_csv):
    """
    Main function to process the CSV and add related artists.
    """
    print("Loading data...")
    df = pd.read_csv(input_csv, quoting=1)  # Use QUOTE_ALL to handle commas in text
    
    print("Building artist lookup maps...")
    artists = df['Main Artist'].dropna().unique()
    lookup_map = build_lookup_map(artists)
    
    print("Finding related artists...")
    # First find all related artists in the text_body
    df['Found Artists'] = df['text_body'].apply(lambda x: find_related_artists(x, lookup_map))
    
    # Then combine with existing Related Artists if they exist
    def combine_artists(row):
        found = set(row['Found Artists'])
        if pd.notna(row['Related Artists']) and row['Related Artists']:
            existing = set(row['Related Artists'].split('; '))
            found.update(existing)
        return '; '.join(sorted(found)) if found else ''
    
    df['Related Artists'] = df.apply(combine_artists, axis=1)
    df = df.drop('Found Artists', axis=1)  # Remove temporary column
    
    print("\nWriting results...")
    df.to_csv(output_csv, index=False, quoting=1)  # Use QUOTE_ALL to handle commas in text
    print(f"Enriched file written to: {output_csv}")
    
    # Print statistics
    total_entries = len(df)
    entries_with_related = len(df[df['Related Artists'] != ''])
    print(f"\nStatistics:")
    print(f"Total entries: {total_entries}")
    print(f"Entries with related artists: {entries_with_related}")
    print(f"Percentage with related artists: {(entries_with_related/total_entries)*100:.1f}%")

if __name__ == "__main__":
    input_file = os.path.join(script_dir, "songs_albums_entries_fixed.csv")
    output_file = os.path.join(script_dir, "songs_albums_entries_enriched.csv")
    enrich_related_artists(input_file, output_file)
