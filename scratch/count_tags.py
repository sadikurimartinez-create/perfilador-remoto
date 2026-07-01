import sys

def check_jsx_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    div_count = 0
    paren_count = 0
    brace_count = 0
    section_count = 0

    for idx, line in enumerate(lines):
        line_num = idx + 1
        
        # We only care about lines between 1373 and 3830
        if line_num < 1373 or line_num > 3830:
            continue

        # Simple tokenizer
        clean_line = line.split('//')[0].split('/*')[0]
        
        # Check div tags
        opens_div = clean_line.count('<div')
        closes_div = clean_line.count('</div')
        div_count += opens_div - closes_div

        # Check section tags
        opens_sec = clean_line.count('<section')
        closes_sec = clean_line.count('</section')
        section_count += opens_sec - closes_sec

        # Check braces
        opens_brace = clean_line.count('{')
        closes_brace = clean_line.count('}')
        brace_count += opens_brace - closes_brace

        # Check parens
        opens_paren = clean_line.count('(')
        closes_paren = clean_line.count(')')
        paren_count += opens_paren - closes_paren

        if opens_div or closes_div or opens_sec or closes_sec:
            print(f"Line {line_num}: divs={div_count} (change: +{opens_div}/-{closes_div}), sections={section_count}")

if __name__ == "__main__":
    check_jsx_balance("src/components/PhotoAlbum.tsx")
