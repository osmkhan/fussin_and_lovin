import pandas as pd

def join_entries():
    # Read the CSV files
    entries_df = pd.read_csv('../raw/parsed_entries.csv')
    songs_df = pd.read_csv('../../../public/songs_with_links_albums_enriched.csv')
    
    # Print initial counts
    print(f"Total songs in enriched file: {len(songs_df)}")
    print(f"Total entries in parsed file: {len(entries_df)}")
    
    # Perform an outer join to see all differences
    joined_df = songs_df.merge(
        entries_df,
        left_on='Number',
        right_on='entry_number',
        how='outer',
        suffixes=('', '_entry')
    )
    
    # Find songs in enriched but not in entries
    missing_entries = joined_df[joined_df['text_body'].isnull()]
    print("\nSongs in enriched file but missing entries:")
    for _, row in missing_entries.iterrows():
        print(f"Song #{row['Number']}: '{row['Track Name']}' by {row['Main Artist']}")
    
    # Find entries that don't match any songs
    extra_entries = joined_df[joined_df['Track Name'].isnull()]
    print("\nEntries that don't match any songs:")
    for _, row in extra_entries.iterrows():
        print(f"Entry #{row['entry_number']}: '{row['song_title']}'")
    
    # Show all matches with their titles
    print("\nAll matches (showing both song and entry titles):")
    matches = joined_df[~joined_df['text_body'].isnull() & ~joined_df['Track Name'].isnull()]
    for _, row in matches.iterrows():
        print(f"#{row['Number']}: Song: '{row['Track Name']}' | Entry: '{row['song_title']}'")
    
    # Save the result
    output_file = 'songs_with_entries.csv'
    joined_df.to_csv(output_file, index=False)
    print(f"\nFull joined data saved to {output_file}")

if __name__ == "__main__":
    join_entries() 