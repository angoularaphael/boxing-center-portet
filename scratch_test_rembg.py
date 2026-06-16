import os
import sys
from PIL import Image

try:
    from rembg import remove
    print("rembg imported successfully!")
except Exception as e:
    print("Failed to import rembg:", e)
    sys.exit(1)

input_path = r"c:\Users\Mommy Jayce\Desktop\Boxing Center\Portet\boxing-center-portet\public\img\coaches\coach-brice.webp"
output_path = r"c:\Users\Mommy Jayce\Desktop\Boxing Center\Portet\boxing-center-portet\public\img\coaches\coach-brice-rembg-test.png"

try:
    img = Image.open(input_path)
    print("Original size:", img.size)
    # Resize up first
    img_large = img.resize((2048, int(2048 * img.size[1] / img.size[0])), Image.Resampling.LANCZOS)
    print("Resized size:", img_large.size)
    
    # Run rembg
    out = remove(img_large)
    out.save(output_path)
    print("Saved test cutout to:", output_path)
    print("Output size:", out.size)
except Exception as e:
    print("Error during rembg execution:", e)
