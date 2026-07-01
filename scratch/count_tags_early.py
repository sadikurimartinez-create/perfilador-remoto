import sys

def check_jsx_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    div_count = 0
    section_count = 0

    for idx, line in enumerate(lines):
        line_num = idx + 1
        if line_num < 1373 or line_num > 1850:
            continue

        clean_line = line.split('//')[0].split('/*')[0]
        
        opens_div = clean_line.count('<div')
        closes_div = clean_line.count('</div')
        div_count += opens_div - closes_div

        opens_sec = clean_line.count('<section')
        closes_sec = clean_line.count('</section')
        section_count += opens_sec - closes_sec

        if opens_div or closes_div or opens_sec or closes_sec:
            print(f"Line {line_num}: divs={div_count} (change: +{opens_div}/-{closes_div}), line='{clean_line.strip()}'")

if __name__ == "__main__":
    check_jsx_balance("src/components/PhotoAlbum.tsx")
