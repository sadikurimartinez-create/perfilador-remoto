with open("src/components/PhotoAlbum.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

div_count = 4  # Starting at line 1851
for idx in range(1850, 2090):
    line_num = idx + 1
    line = lines[idx]
    clean_line = line.split('//')[0].split('/*')[0]
    
    opens_div = clean_line.count('<div')
    closes_div = clean_line.count('</div')
    div_count += opens_div - closes_div
    
    if opens_div or closes_div:
        print(f"Line {line_num}: divs={div_count} (+{opens_div}/-{closes_div}) | {line.strip()}")
