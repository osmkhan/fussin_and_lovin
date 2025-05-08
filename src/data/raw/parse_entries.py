import csv
import re

def extract_song_info(text):
    # Extract song number and title
    song_match = re.search(r'Song #(\d+): "([^"]+)"', text)
    if not song_match:
        return None, None
    song_num = song_match.group(1)
    song_title = song_match.group(2)
    return song_num, song_title

def clean_text(text):
    # Remove extra whitespace and normalize line endings
    text = re.sub(r'\n\s*\n', '\n\n', text)
    return text.strip()

def parse_entries(file_path):
    entries = []
    
    # Read the file
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by the main delimiter
    raw_entries = content.split('////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////')
    
    for entry in raw_entries:
        if not entry.strip():
            continue
            
        # Extract song number and title
        song_num, song_title = extract_song_info(entry)
        if not song_num or not song_title:
            continue
            
        # Clean the text body
        text_body = clean_text(entry)
        
        entries.append({
            'entry_number': song_num,
            'song_title': song_title,
            'text_body': text_body
        })
    
    return entries

def write_csv(entries, output_file):
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['entry_number', 'song_title', 'text_body'])
        writer.writeheader()
        writer.writerows(entries)

def main():
    input_file = 'fnl_text_full.txt'
    output_file = 'parsed_entries.csv'
    
    entries = parse_entries(input_file)
    write_csv(entries, output_file)
    print(f"Successfully parsed {len(entries)} entries to {output_file}")

if __name__ == "__main__":
    main() 