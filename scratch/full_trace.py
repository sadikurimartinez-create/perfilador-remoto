with open("src/components/PhotoAlbum.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

div_count = 0
section_count = 0
open_tags = []

for idx, line in enumerate(lines):
    line_num = idx + 1
    
    # We only tokenize HTML tags in a simple way
    # Split by '<' to find tag starts
    parts = line.split('<')
    for part in parts[1:]:
        # Check if it is a closing tag
        if part.startswith('/'):
            tag_name = part.split()[0].split('>')[0].replace('/', '')
            if tag_name in ['div', 'section', 'header', 'footer', 'main', 'span', 'label', 'button', 'textarea']:
                if open_tags and open_tags[-1][0] == tag_name:
                    open_tags.pop()
                else:
                    print(f"Mismatch: closed </{tag_name}> on line {line_num} but open tags are: {open_tags[-5:]}")
        else:
            # It's an opening tag
            tag_name = part.split()[0].split('>')[0]
            if tag_name in ['div', 'section', 'header', 'footer', 'main', 'span', 'label', 'button', 'textarea']:
                # Ensure it's not self-closing
                if not part.split('>')[0].endswith('/'):
                    open_tags.append((tag_name, line_num))

print("Remaining open tags:", open_tags)
