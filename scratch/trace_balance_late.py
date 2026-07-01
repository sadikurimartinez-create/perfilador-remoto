with open("src/components/PhotoAlbum.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

div_count = 1  # Starting at line 2082
for idx in range(2081, 3835):
    line_num = idx + 1
    line = lines[idx]
    clean_line = line.split('//')[0].split('/*')[0]
    
    opens_div = clean_line.count('<div')
    closes_div = clean_line.count('</div')
    div_count += opens_div - closes_div
    
    if opens_div or closes_div:
        # Only print when div_count is out of expected ranges or near the end
        if div_count < 0 or line_num > 3790 or opens_div != closes_div:
            print(f"Line {line_num}: divs={div_count} (+{opens_div}/-{closes_div}) | {line.strip()}")
